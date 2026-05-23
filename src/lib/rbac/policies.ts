import { ACTIONS, type Action, type Matrix, type Resource, ROLES } from "./types";

/**
 * Emits Postgres RLS policy SQL for a single resource, derived from the
 * authorization matrix. The intent is that whatever `can()` enforces in
 * application code is ALSO enforced at the DB layer, so a compromised
 * application can't widen access beyond what the matrix declares.
 *
 * Batch 3 ships the generator only — actual policies are applied in Batch 4
 * once the tables exist. The generated SQL assumes:
 *   - Auth identity comes from `auth.uid()` (Supabase Auth).
 *   - Each protected table has (or joins to) a `user_id` foreign-key column
 *     so per-row ownership can be enforced. For tables without row-level
 *     ownership (e.g., global config), the policy is purely role-gated.
 *   - The user's role is stored in `auth.jwt() -> 'app_metadata' ->> 'role'`,
 *     consistent with the DAL's `getRole()` lookup.
 *
 * MASTER always bypasses (matches `can()`'s behavior).
 */

const ACTION_TO_PG_VERB: Readonly<Record<Action, string>> = {
  CREATE: "INSERT",
  READ: "SELECT",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
};

/**
 * Returns the SQL needed to enable RLS and install one policy per
 * (action × role-allowed-for-that-action) combination for a given resource.
 *
 * The generator emits idempotent DDL (`DROP POLICY IF EXISTS … CREATE
 * POLICY …`) so re-running it in a migration is safe. Per the Rules
 * Addendum's Rule 12 (Scalability & Idempotency), migrations must be
 * re-executable.
 *
 * Pass the database table name explicitly — it does not have to equal the
 * matrix resource key (the schema is owned by Prisma in Batch 4, the matrix
 * is owned here, and the mapping between them lives at the migration site).
 */
export function buildPolicySql(opts: {
  matrix: Matrix;
  resource: Resource;
  tableName: string;
  schema?: string;
}): string {
  const { matrix, resource, tableName } = opts;
  const schema = opts.schema ?? "public";
  const qualified = `"${schema}"."${tableName}"`;

  const resourceRules = matrix[resource];
  if (!resourceRules) {
    throw new Error(
      `buildPolicySql: resource "${resource}" not declared in matrix. ` +
        `Add it to MATRIX before generating policies.`,
    );
  }

  const lines: string[] = [
    `-- RLS policies for ${qualified} (matrix resource: "${resource}")`,
    `ALTER TABLE ${qualified} ENABLE ROW LEVEL SECURITY;`,
    "",
    `-- MASTER bypass: a permissive policy granting full access when the JWT's role is MASTER.`,
    `DROP POLICY IF EXISTS "${tableName}_master_bypass" ON ${qualified};`,
    `CREATE POLICY "${tableName}_master_bypass" ON ${qualified}`,
    `  AS PERMISSIVE FOR ALL TO authenticated`,
    `  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'MASTER')`,
    `  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'MASTER');`,
    "",
  ];

  for (const action of ACTIONS) {
    const verb = ACTION_TO_PG_VERB[action];
    const allowedRoles = ROLES.filter((role) => {
      if (role === "MASTER") return false; // handled by the bypass policy above
      return resourceRules[role]?.has(action) ?? false;
    });

    if (allowedRoles.length === 0) {
      // No non-MASTER role allowed for this action — emit a deliberately
      // restrictive policy to make the intent explicit in migration SQL.
      lines.push(
        `-- ${action}: no non-MASTER role allowed by the matrix.`,
        `DROP POLICY IF EXISTS "${tableName}_${action.toLowerCase()}_deny" ON ${qualified};`,
        `-- (No CREATE POLICY emitted; absence of a permissive policy implicitly denies.)`,
        "",
      );
      continue;
    }

    const roleList = allowedRoles.map((r) => `'${r}'`).join(", ");
    const policyName = `${tableName}_${action.toLowerCase()}`;
    const usingClause = `((auth.jwt() -> 'app_metadata' ->> 'role') IN (${roleList}))`;

    lines.push(
      `-- ${action}: allowed for ${allowedRoles.join(", ")}.`,
      `DROP POLICY IF EXISTS "${policyName}" ON ${qualified};`,
      `CREATE POLICY "${policyName}" ON ${qualified}`,
      `  AS PERMISSIVE FOR ${verb} TO authenticated`,
      verb === "INSERT" ? `  WITH CHECK ${usingClause};` : `  USING ${usingClause};`,
      "",
    );
  }

  return lines.join("\n");
}

/**
 * Maps a (matrix-resource → table-name) plan into one big SQL blob. Useful
 * when a migration applies policies to many tables at once.
 */
export function buildPolicySqlForAll(opts: {
  matrix: Matrix;
  tables: ReadonlyArray<{ resource: Resource; tableName: string; schema?: string }>;
}): string {
  return opts.tables
    .map(({ resource, tableName, schema }) =>
      buildPolicySql({ matrix: opts.matrix, resource, tableName, schema }),
    )
    .join("\n");
}
