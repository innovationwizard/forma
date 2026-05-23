import type { Action, Matrix, Resource, Role } from "./types";

/**
 * The single source of truth for authorization across the Santa Elena app.
 * Every authorization decision in the codebase MUST route through `can()` —
 * no inline role checks (per feedback_rbac_approach memory).
 *
 * Batch 3 ships an empty matrix: real resources are added in Batch 4 alongside
 * the entity schema. The contract enforced today:
 *   - MASTER bypasses all checks (see `can`).
 *   - Every other (role, resource, action) tuple denies unless the matrix
 *     explicitly allows it.
 *
 * To add a resource (Batch 4+):
 *   1. Add an entry to MATRIX below: `<resource_name>: { ROLE: new Set([...]) }`.
 *   2. Spell out ALL four roles for that resource — TypeScript will reject the
 *      object if a role key is missing (Record<Role, …> is exhaustive).
 *   3. Add a test row to `scripts/verify-rbac.ts`.
 *   4. Re-run `pnpm verify:rbac`.
 */
export const MATRIX: Matrix = {
  // Resources land here in Batch 4. Examples of how they will look:
  //
  //   budget_category: {
  //     MASTER:   new Set(['CREATE', 'READ', 'UPDATE', 'DELETE']),
  //     CEO:      new Set(['READ']),
  //     ANALISTA: new Set(['CREATE', 'READ', 'UPDATE', 'DELETE']),
  //     AUXILIAR: new Set(['CREATE', 'READ', 'UPDATE', 'DELETE']),
  //   },
};

/**
 * Returns true iff the given role may perform the given action on the given
 * resource. Closed by default: unknown resources, unknown roles, and unknown
 * actions all return false (except for MASTER, which bypasses).
 *
 * Performance: O(1) — Set membership + property access. Safe to call on hot
 * paths.
 */
export function can(role: Role, action: Action, resource: Resource): boolean {
  if (role === "MASTER") return true;

  const resourceRules = MATRIX[resource];
  if (!resourceRules) return false;

  const allowedActions = resourceRules[role];
  if (!allowedActions) return false;

  return allowedActions.has(action);
}
