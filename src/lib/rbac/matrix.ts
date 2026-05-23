import type { Action, Matrix, Resource, Role } from "./types";

/**
 * The single source of truth for authorization across the Santa Elena app.
 * Every authorization decision in the codebase MUST route through `can()` —
 * no inline role checks (per feedback_rbac_approach memory).
 *
 * Role behavior summary (per D14 in PROGRESS.md + user refinement 2026-05-22):
 *  - MASTER:   superuser. Bypasses the matrix entirely in `can()`.
 *  - CEO:      strict read-only across every resource. Drills down without
 *              limits but cannot create / update / delete anything.
 *  - ANALISTA: hands-on RE + finance expert. Full CRUD on every business
 *              resource they own (including cap adjustments and settings —
 *              caps move both up and down in reality, deals fall apart).
 *              Cannot write to audit_log (system-only). Cannot manage users
 *              (MASTER-only).
 *  - AUXILIAR: junior to ANALISTA. Per user refinement: can DELETE anything
 *              they can mutate. Cannot manage bank accounts, appraisals,
 *              disbursements, cap adjustments, exchange rates, or users —
 *              those are ANALISTA-or-MASTER territory (AUXILIAR is read-only
 *              on read-only resources).
 *
 * **Project invariant (user, 2026-05-22): "All deletes are soft deletes. We
 * don't drop data. Ever."** Every business table has a `deletedAt` column.
 * A DELETE permission in this matrix authorizes the application's
 * `softDelete()` helper (which performs UPDATE deleted_at = NOW()), not a
 * Postgres hard DELETE. Reads filter `WHERE deleted_at IS NULL` by default.
 * The RLS policy generator emits Postgres DELETE policies as before; app
 * code is responsible for never calling `prisma.X.delete()` directly. A
 * future hardening step can replace the DELETE policy with a column-scoped
 * UPDATE policy on `deleted_at` for defense-in-depth.
 *
 * Resources are named after the Postgres table names (snake_case) so the
 * policy generator can pass `resource` straight through to RLS SQL.
 */

const READ_ONLY: ReadonlySet<Action> = new Set(["READ"]);
const FULL_CRUD: ReadonlySet<Action> = new Set(["CREATE", "READ", "UPDATE", "DELETE"]);
const NONE: ReadonlySet<Action> = new Set();

export const MATRIX: Matrix = {
  // ── Singleton-ish config ─────────────────────────────────────────────────
  /// Project-level constants (rates, dates, names). ANALISTA has FULL_CRUD
  /// per user direction (project is conceptually singleton; the app layer
  /// enforces "max 1 project row" — schema permission stays open).
  project: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: READ_ONLY,
  },

  // ── Identity ─────────────────────────────────────────────────────────────
  /// User management is MASTER-only. Inviting users, changing roles,
  /// deactivating accounts. ANALISTA/AUXILIAR/CEO have NO access — they
  /// cannot even READ the users table directly (the auth gate exposes
  /// only the current user's identity via the DAL).
  users: {
    MASTER: FULL_CRUD,
    CEO: NONE,
    ANALISTA: NONE,
    AUXILIAR: NONE,
  },

  /// Partners (vendors + buyers + counterparties). Both ANALISTA and
  /// AUXILIAR can fully manage. With soft deletes universal, "delete"
  /// hides the row from queries without dropping data.
  partner: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: FULL_CRUD,
  },

  /// Bank accounts are sensitive — typo in an account number routes money
  /// to the wrong place. ANALISTA can edit (e.g., add a new account when
  /// FORMA opens one); AUXILIAR is read-only.
  bank_account: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: READ_ONLY,
  },

  // ── Budget hierarchy ─────────────────────────────────────────────────────
  /// The 3-level budget structure (partition → category → sub-item) per N4.
  /// ANALISTA and AUXILIAR both have FULL_CRUD. Soft delete protects historical
  /// transactions from orphaning even if a sub-item is deleted.
  budget_execution_partition: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: FULL_CRUD,
  },
  budget_category: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: FULL_CRUD,
  },
  budget_sub_item: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: FULL_CRUD,
  },

  // ── Expenditures ─────────────────────────────────────────────────────────
  /// The hot table. Both ANALISTA and AUXILIAR write here daily. With soft
  /// deletes, a wrong transaction can be soft-deleted (or marked VOIDED in
  /// the status field — both paths preserve history).
  expenditure: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: FULL_CRUD,
  },

  // ── rv_* Phase 1 ─────────────────────────────────────────────────────────
  /// Unit lifecycle. ANALISTA and AUXILIAR can both manage everything
  /// including soft-deleting (e.g., a unit that was canceled before sale).
  rv_units: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: FULL_CRUD,
  },
  /// Reservation events. AUXILIAR submits new reservations on behalf of
  /// buyers; ANALISTA confirms / rejects. Both can soft-delete entries to
  /// correct mistakes.
  rv_reservations: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: FULL_CRUD,
  },
  /// Freeze requests. Same shape as reservations.
  rv_freeze_requests: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: FULL_CRUD,
  },

  // ── Projection / Credit ──────────────────────────────────────────────────
  /// Monthly projection. ANALISTA has FULL_CRUD per user direction
  /// (forecasts evolve over time, including adding/removing months).
  /// AUXILIAR read-only — forecasting is ANALISTA's domain.
  monthly_projection: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: READ_ONLY,
  },

  /// Credit facility parameters. ANALISTA has FULL_CRUD per user direction
  /// (FORMA could open a second facility, close one, etc.). Per-row params
  /// (rate, LTV, cap) live here; cap raises are AUDIT-tracked separately in
  /// `cap_adjustment`.
  credit_facility: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: READ_ONLY,
  },

  /// Appraisal cycles. ANALISTA adds new cycles + edits values. AUXILIAR
  /// read-only — appraisals are formal events tied to bank documentation.
  appraisal: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: READ_ONLY,
  },

  /// Drawdown events. ANALISTA has FULL_CRUD; soft-delete is the path for
  /// removing an erroneous entry (the bank record is preserved with
  /// `deletedAt` set). Conventional corrections still go via offsetting
  /// rows where appropriate.
  disbursement: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: READ_ONLY,
  },

  /// Cap-raise (or reduction) events. Per user direction 2026-05-22: caps
  /// move both up and down in reality (units sold, market revalue, deals
  /// fall apart). Append-only behavior is the rule (every change = a new
  /// row), AND ANALISTA can UPDATE / soft-DELETE individual rows to fix
  /// data-entry errors. Soft-delete preserves the original record.
  cap_adjustment: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: READ_ONLY,
  },

  // ── Exchange rates (BANGUAT cache + manual overrides) ────────────────────
  /// BANGUAT cron writes BANGUAT-source rows automatically. Humans can add
  /// MANUAL-source rows (rare, for off-day transactions). ANALISTA can
  /// correct a wrong manual entry but not hard-delete historical rates.
  exchange_rate: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: READ_ONLY,
  },

  // ── Audit log ────────────────────────────────────────────────────────────
  /// Writes are SYSTEM-ONLY — the audit log is written by mutation
  /// transactions, never by humans directly. All four non-MASTER roles can
  /// READ for transparency; nobody can write through `can()` (MASTER bypass
  /// remains for break-glass scenarios). `audit_log` does NOT have a
  /// `deletedAt` column — the audit itself is immutable.
  audit_log: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: READ_ONLY,
    AUXILIAR: READ_ONLY,
  },
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
