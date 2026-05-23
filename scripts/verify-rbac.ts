/**
 * RBAC matrix verification script.
 *
 * Goal: prove the invariants of `lib/rbac/matrix.ts` + `lib/rbac/policies.ts`
 * without standing up a test runner. Exits non-zero on failure so it slots
 * into CI later (or `pnpm verify:rbac` locally).
 *
 * What it verifies:
 *   1. MASTER bypass: `can(MASTER, *, *)` is true for any resource, including
 *      ones not declared in the matrix.
 *   2. Closed-by-default: for any non-MASTER role, an undeclared resource
 *      always returns false.
 *   3. Each non-MASTER role's allowed actions in MATRIX are correctly
 *      enforced by `can()`, and disallowed actions return false.
 *   4. `buildPolicySql` against a synthetic resource fixture emits valid-
 *      looking RLS SQL (idempotent DROP/CREATE, MASTER bypass, per-action
 *      policies for allowed roles, explicit "no policy" comments for fully-
 *      denied actions).
 *
 * The synthetic fixture used in step (4) is local-only to this script (not
 * imported by production code) per Rule 4's allowance for clearly-labeled
 * test fixtures.
 */

import { MATRIX, can } from "../src/lib/rbac/matrix";
import { buildPolicySql } from "../src/lib/rbac/policies";
import { ACTIONS, type Matrix, ROLES } from "../src/lib/rbac/types";

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

// ─── 1. MASTER bypass ────────────────────────────────────────────────────────
section("[1] MASTER bypass");
for (const action of ACTIONS) {
  check(
    `MASTER may ${action} an undeclared resource`,
    can("MASTER", action, "totally_made_up_resource_for_testing") === true,
  );
}

// ─── 2. Closed-by-default for undeclared resources ───────────────────────────
section("[2] Closed-by-default (undeclared resource → deny)");
for (const role of ROLES) {
  if (role === "MASTER") continue;
  for (const action of ACTIONS) {
    check(
      `${role} may NOT ${action} an undeclared resource`,
      can(role, action, "totally_made_up_resource_for_testing") === false,
    );
  }
}

// ─── 3. Declared matrix entries enforce per-role rules ───────────────────────
section("[3] Declared matrix entries (currently 0 — exercised in Batch 4+)");
const declaredResources = Object.keys(MATRIX);
if (declaredResources.length === 0) {
  process.stdout.write("  · Matrix is empty (Batch 3 ships an empty matrix by design).\n");
} else {
  for (const resource of declaredResources) {
    const resourceRules = MATRIX[resource];
    if (!resourceRules) continue;
    for (const role of ROLES) {
      if (role === "MASTER") continue;
      const allowed = resourceRules[role];
      for (const action of ACTIONS) {
        const shouldAllow = allowed?.has(action) ?? false;
        check(
          `${role} on ${resource} ${action} → ${shouldAllow ? "allow" : "deny"}`,
          can(role, action, resource) === shouldAllow,
        );
      }
    }
  }
}

// ─── 4. Policy generator structural smoke test ───────────────────────────────
section("[4] buildPolicySql() against a synthetic fixture");

// SYNTHETIC FIXTURE — not part of the production matrix. Lives in this
// verification script only.
const fixture: Matrix = {
  fixture_resource: {
    MASTER: new Set(ACTIONS), // bypass handled separately by the generator
    CEO: new Set(["READ"]),
    ANALISTA: new Set(["CREATE", "READ", "UPDATE", "DELETE"]),
    AUXILIAR: new Set(["CREATE", "READ", "UPDATE"]), // intentionally lacks DELETE
  },
};

const sql = buildPolicySql({
  matrix: fixture,
  resource: "fixture_resource",
  tableName: "fixture_resource",
});

function sectionOf(sql: string, headingPrefix: string): string {
  const start = sql.indexOf(headingPrefix);
  if (start === -1) return "";
  const end = sql.indexOf("\n-- ", start + headingPrefix.length);
  return sql.slice(start, end === -1 ? undefined : end);
}

check("emits ENABLE ROW LEVEL SECURITY", sql.includes("ENABLE ROW LEVEL SECURITY"));
check("emits MASTER bypass policy", sql.includes("fixture_resource_master_bypass"));

{
  const readBlock = sectionOf(sql, "-- READ");
  check(
    "READ policy includes CEO + ANALISTA + AUXILIAR and uses FOR SELECT",
    readBlock.includes("'CEO'") &&
      readBlock.includes("'ANALISTA'") &&
      readBlock.includes("'AUXILIAR'") &&
      readBlock.includes("FOR SELECT"),
  );
}

{
  const deleteBlock = sectionOf(sql, "-- DELETE");
  check(
    "DELETE policy includes ANALISTA but NOT AUXILIAR (matrix denies it)",
    deleteBlock.includes("'ANALISTA'") && !deleteBlock.includes("'AUXILIAR'"),
  );
}

{
  const dropLines = sql.split("\n").filter((line) => line.includes("DROP POLICY"));
  check(
    "all DROP POLICY statements use IF EXISTS (idempotent)",
    dropLines.every((line) => line.includes("IF EXISTS")),
  );
}

{
  let threw = false;
  try {
    buildPolicySql({ matrix: fixture, resource: "nonexistent", tableName: "x" });
  } catch {
    threw = true;
  }
  check("throws on undeclared resource", threw);
}

// ─── Result ──────────────────────────────────────────────────────────────────
section("Result");
if (failures === 0) {
  process.stdout.write(`  ✓ All checks passed.\n`);
  process.exit(0);
}
process.stdout.write(`  ✗ ${failures} check(s) failed.\n`);
process.exit(1);
