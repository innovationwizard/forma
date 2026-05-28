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
  /// Investment phases (FORMA's capital-deployment milestones — see the model
  /// docstring; NOT the buyer-side 3-phase sale model). ANALISTA fully manages
  /// the 5 phases + their status; AUXILIAR read-only.
  investment_phase: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: READ_ONLY,
  },

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

  // ── Batch 4.5 additions ──────────────────────────────────────────────────

  /// Per D33: composable amortization rules under a CreditFacility.
  /// ANALISTA owns these (forecast tweaks, mechanism changes); AUXILIAR
  /// read-only (formal banking artifact). Same posture as credit_facility.
  amortization_rule: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: READ_ONLY,
  },

  /// Per D33: partner equity flows (capital calls, distributions, in-kind
  /// asset contributions like the 2018 terreno aportación). ANALISTA owns
  /// these; AUXILIAR read-only because partner equity is a sensitive
  /// financial domain that should not be entered by juniors.
  partner_contribution: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: READ_ONLY,
  },

  /// Per D33: composable sources for a PartnerContribution. Same posture
  /// as the parent table.
  contribution_source: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: READ_ONLY,
  },

  /// Per D34: ISR obligations — both `ISR 18` and `ISR 25` literal rows.
  /// ANALISTA fully manages (rates may change with tax-regime updates);
  /// AUXILIAR read-only.
  isr_obligation: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: READ_ONLY,
  },

  /// Per D31: parser-emitted data-quality anomalies. ANALISTA can RESOLVE
  /// flags (UPDATE to set `resolvedAt` + `resolutionNote`); AUXILIAR can
  /// only READ (resolving flags is an authoritative act). CEO reads to see
  /// what needs attention. CREATE happens via the parser/system path, not
  /// via human UI — MASTER bypass covers system inserts. DELETE is soft
  /// per D21 (no resolved flags ever vanish — audit invariant).
  data_quality_flag: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: new Set(["READ", "UPDATE", "DELETE"]) as ReadonlySet<Action>,
    AUXILIAR: READ_ONLY,
  },

  // ── REFLUJO Batch 13a — bank-statement ingestion ─────────────────────────

  /// BRONZE: uploaded statement files. ANALISTA owns the full lifecycle.
  /// AUXILIAR can upload (CREATE) + view (READ) — a junior dropping files
  /// into the system is exactly the kind of low-risk grunt work that makes
  /// sense for AUXILIAR. UPDATE/DELETE stays out of AUXILIAR scope:
  /// retroactively editing an import (e.g., changing the uploader, the
  /// file hash) would defeat the audit trail. CEO read-only per global
  /// posture. MASTER full bypass.
  bank_statement_import: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: new Set(["CREATE", "READ"]) as ReadonlySet<Action>,
  },

  /// BRONZE: per-sheet records inside an import. ANALISTA can UPDATE to
  /// flip the `is_canonical` toggle (the twin-sheet decision per Jorge
  /// directive #2). AUXILIAR is read-only here because flipping canonical
  /// re-derives silver — meaningful side effect, ANALISTA territory.
  /// CREATE is system-only (happens during the upload action); no role
  /// needs explicit CREATE because MASTER bypasses and the upload action
  /// runs as the uploading user with MASTER-aware logic for the bronze
  /// insert. (Same pattern the seeder uses for AuditLog rows.)
  bank_statement_sheet: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: new Set(["READ", "UPDATE"]) as ReadonlySet<Action>,
    AUXILIAR: READ_ONLY,
  },

  /// BRONZE: raw rows. IMMUTABLE per architecture — the whole point of
  /// bronze is that it never changes. Every non-MASTER role is READ-only.
  /// MASTER keeps full access for emergency surgery / debugging.
  bank_statement_raw_row: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: READ_ONLY,
    AUXILIAR: READ_ONLY,
  },

  /// SILVER: normalized bank movements. ANALISTA classifies + edits
  /// (UPDATE writes classifier metadata, sets the gold-side FKs landing
  /// in Batch 13b). AUXILIAR can read + update so a junior can do basic
  /// classification (the "CASA" tagging Ronny does today). CREATE is
  /// SYSTEM-ONLY — silver rows only come from a bronze build pass, never
  /// from a human directly. DELETE is soft-only per D21 + ANALISTA-gated.
  bank_transaction: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: new Set(["READ", "UPDATE", "DELETE"]) as ReadonlySet<Action>,
    AUXILIAR: new Set(["READ", "UPDATE"]) as ReadonlySet<Action>,
  },

  // ── REFLUJO Batch 13b — gold addition: per-house payments ────────────────

  /// GOLD: per-house installment payments. Created via the classification
  /// queue at `/inbox` when an analyst maps an inflow BankTransaction to a
  /// sold RvUnit. ANALISTA + AUXILIAR can both CRUD because tagging payments
  /// to houses is the exact "CASA" annotation step Ronny does today — junior
  /// territory by design. CEO read-only.
  rv_payment: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: FULL_CRUD,
    AUXILIAR: FULL_CRUD,
  },

  // ── REFLUJO Batch 13d — issued cheques (FORMA's internal check register) ─

  /// GOLD/SILVER hybrid: each row represents a cheque DRAWN against a bank
  /// account (FORMA-internal record, not bank-generated). CREATE happens via
  /// the check-register import path — same flow as bronze, system-side; no
  /// human creates these directly. ANALISTA + AUXILIAR can READ + UPDATE
  /// (set cashed/classified FKs, fix typos, attach a bank account when the
  /// upload couldn't auto-bind). DELETE is soft + ANALISTA-gated per D21.
  /// CEO read-only.
  issued_cheque: {
    MASTER: FULL_CRUD,
    CEO: READ_ONLY,
    ANALISTA: new Set(["READ", "UPDATE", "DELETE"]) as ReadonlySet<Action>,
    AUXILIAR: new Set(["READ", "UPDATE"]) as ReadonlySet<Action>,
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
