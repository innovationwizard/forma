/**
 * RLS verification — confirms the policies actually landed in Postgres and
 * that their per-action role coverage matches the matrix in
 * `src/lib/rbac/matrix.ts`.
 *
 * Run: `pnpm verify:rls`
 *
 * What it checks:
 *   1. Every matrix resource has its table's RLS enabled (`pg_class.relrowsecurity = true`).
 *   2. Every resource has a `<table>_master_bypass` policy.
 *   3. For each (resource × action), the policies declared in Postgres
 *      cover exactly the roles the matrix allows for that action.
 *
 * What it does NOT check (deliberately, for now):
 *   - End-to-end "user X with role CEO tries UPDATE on Y and is rejected."
 *     That requires provisioning real Supabase Auth users with JWT
 *     `app_metadata.role` set, signing in, and executing queries through the
 *     anon key path. Real-world enforcement is verified separately in a
 *     manual integration pass and will be automated when Vitest lands.
 *
 * Exits 0 on success, 1 on any check failure (suitable for CI when CI exists).
 */

import { PrismaClient } from "@prisma/client";

import { MATRIX } from "../src/lib/rbac/matrix";
import { ACTIONS, type Action, ROLES, type Role } from "../src/lib/rbac/types";

const prisma = new PrismaClient();

const ACTION_TO_PG_CMD: Readonly<Record<Action, string>> = {
  CREATE: "INSERT",
  READ: "SELECT",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
};

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    process.stdout.write(`  ✓ ${label}\n`);
  } else {
    process.stdout.write(`  ✗ ${label}${detail ? ` — ${detail}` : ""}\n`);
    failures++;
  }
}

function section(name: string): void {
  process.stdout.write(`\n${name}\n`);
}

interface PgPolicyRow {
  tablename: string;
  policyname: string;
  cmd: string; // INSERT / SELECT / UPDATE / DELETE / ALL
  qual: string | null; // USING clause
  with_check: string | null; // WITH CHECK clause
}

async function main(): Promise<void> {
  const resources = Object.keys(MATRIX);

  // ── 1. RLS enabled on every resource's table ──────────────────────────────
  section("[1] RLS enabled on every matrix-tracked table");
  const rlsRows = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY(${resources})
  `;
  const rlsMap = new Map(rlsRows.map((r) => [r.relname, r.relrowsecurity]));
  for (const resource of resources) {
    const enabled = rlsMap.get(resource) === true;
    check(`${resource}: RLS enabled`, enabled);
  }

  // ── 2 + 3. Per-policy checks ──────────────────────────────────────────────
  const policyRows = await prisma.$queryRaw<PgPolicyRow[]>`
    SELECT tablename, policyname, cmd, qual::text AS qual, with_check::text AS with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(${resources})
  `;
  const policiesByTable = new Map<string, PgPolicyRow[]>();
  for (const row of policyRows) {
    const arr = policiesByTable.get(row.tablename) ?? [];
    arr.push(row);
    policiesByTable.set(row.tablename, arr);
  }

  section("[2] MASTER bypass policy present on every table");
  for (const resource of resources) {
    const policies = policiesByTable.get(resource) ?? [];
    const bypass = policies.find((p) => p.policyname === `${resource}_master_bypass`);
    check(`${resource}: master_bypass policy present`, bypass !== undefined);
  }

  section("[3] Per-action role coverage matches matrix");
  // For each (resource × action), gather the roles that should be allowed
  // per the matrix, then check the corresponding policy in Postgres
  // mentions exactly those roles in its USING / WITH CHECK clause.
  for (const resource of resources) {
    const resourceRules = MATRIX[resource];
    if (!resourceRules) continue;
    const policies = policiesByTable.get(resource) ?? [];

    for (const action of ACTIONS) {
      const allowedRoles: Role[] = ROLES.filter((r) => {
        if (r === "MASTER") return false; // master is the bypass policy, not here
        return resourceRules[r]?.has(action) ?? false;
      });

      if (allowedRoles.length === 0) {
        // No policy expected for this (resource × action) — verify NONE exists
        // with name pattern <resource>_<action>.
        const policyName = `${resource}_${action.toLowerCase()}`;
        const exists = policies.some((p) => p.policyname === policyName);
        check(`${resource} ${action}: no policy (matrix denies all non-MASTER)`, !exists);
        continue;
      }

      const policyName = `${resource}_${action.toLowerCase()}`;
      const policy = policies.find((p) => p.policyname === policyName);
      if (!policy) {
        check(`${resource} ${action}: policy "${policyName}" exists`, false);
        continue;
      }

      // Verify cmd matches the Postgres verb (INSERT/SELECT/UPDATE/DELETE).
      const expectedCmd = ACTION_TO_PG_CMD[action];
      check(`${resource} ${action}: cmd = ${expectedCmd}`, policy.cmd === expectedCmd);

      // Verify the USING / WITH CHECK clause references exactly the allowed roles.
      // The clause text is like:
      //   ((auth.jwt() -> 'app_metadata'::text ->> 'role'::text) = ANY (ARRAY['ANALISTA'::text, ...]))
      // We assert each allowed role appears verbatim AND no disallowed role does.
      const clause = (policy.qual ?? "") + " " + (policy.with_check ?? "");
      const allRoleMatches = allowedRoles.every((r) => clause.includes(`'${r}'`));
      const anyForbiddenRole = ROLES.filter(
        (r) => r !== "MASTER" && !allowedRoles.includes(r),
      ).some((r) => clause.includes(`'${r}'`));

      check(
        `${resource} ${action}: clause names exactly ${allowedRoles.join(", ")}`,
        allRoleMatches && !anyForbiddenRole,
        anyForbiddenRole ? "clause includes a role the matrix denies" : undefined,
      );
    }
  }

  // ── Result ────────────────────────────────────────────────────────────────
  section("Result");
  if (failures === 0) {
    process.stdout.write(`  ✓ All RLS checks passed.\n`);
    await prisma.$disconnect();
    process.exit(0);
  }
  process.stdout.write(`  ✗ ${failures} RLS check(s) failed.\n`);
  await prisma.$disconnect();
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`verify-rls crashed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
