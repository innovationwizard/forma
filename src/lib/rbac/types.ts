import { z } from "zod";

/**
 * The 4 roles for Santa Elena's pilot. Per decision D14 in PROGRESS.md:
 *  - MASTER:   superuser. The developer (Jorge). Bypasses matrix checks.
 *  - CEO:      dashboard consumer. Read-only across the system.
 *  - ANALISTA: hands-on RE + finance expert (rrivas). Full CRUD.
 *  - AUXILIAR: junior to the analyst. Full CRUD, requires audit trail (the
 *              audit-on-mutate invariant is enforced at the data layer in
 *              Batch 4, not here).
 *
 * Out of scope for the pilot: ADMIN, SUPERVISOR, WORKER. Reintroduced only
 * when the broader FORMA system extends to multi-project / field-ops.
 */
export const ROLES = ["MASTER", "CEO", "ANALISTA", "AUXILIAR"] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

/**
 * Standard CRUD set. Matches Postgres-RLS verbs (INSERT/SELECT/UPDATE/DELETE)
 * and our app's mutation surface. Adding actions here must be done
 * deliberately — every entry in the matrix is required to be exhaustive.
 */
export const ACTIONS = ["CREATE", "READ", "UPDATE", "DELETE"] as const;
export type Action = (typeof ACTIONS)[number];

/**
 * Resource is an open string union for now. Each resource added (Batch 4+)
 * MUST register itself in the matrix and SHOULD be added to a typed list
 * here at the same time to keep IntelliSense useful. For Batch 3 the matrix
 * is intentionally empty — the goal is to prove the closed-by-default
 * behavior of `can()`.
 */
export type Resource = string;

/**
 * Matrix shape: resource → role → allowed actions.
 * A resource not in the matrix means "deny for all roles except MASTER".
 * A role not in a resource's row means "deny for that role on that resource".
 * MASTER bypasses the matrix entirely (see `can` in `./matrix.ts`).
 */
export type Matrix = Readonly<Record<Resource, Readonly<Record<Role, ReadonlySet<Action>>>>>;
