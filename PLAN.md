# FORMA — Santa Elena: Implementation Plan

**Source of truth:** [SDD_FORMA_SANTA_ELENA.md](SDD_FORMA_SANTA_ELENA.md) v0.3
**Operating contract:** [\_THE_RULES.MD](_THE_RULES.MD)
**Live tracker:** [PROGRESS.md](PROGRESS.md) — must be updated at the start, middle, and end of every batch.

---

## 0. Plan Conventions

Each batch below is a small, resumable unit of work with:

- **Goal** — what the batch accomplishes in one sentence
- **Inputs / Gates** — what must be true before the batch can start; gates block on user input
- **Deliverables** — concrete files / DB state / verifiable artifacts
- **Acceptance** — how we know the batch is _actually_ done (Rule 5: must serve a core function)
- **Risks / Open** — what could go wrong; open questions to surface

**Resumption contract:** if a session is compacted or lost mid-batch, the next session must:

1. Read [PROGRESS.md](PROGRESS.md) first.
2. Locate the in-flight batch (status `IN_PROGRESS`).
3. Re-read its **Deliverables** + **Acceptance** here.
4. Diff against the filesystem before writing anything new.
5. Resume from the first incomplete deliverable. No re-creation of completed files.

**Rule-derived invariants** (apply to every batch, not negotiable):

- No mock, sample, or placeholder data anywhere — code, DB, or tests against business logic. Test fixtures only when (a) isolated under `tests/`, (b) labeled, (c) never imported by production code.
- No `TODO` / `FIXME` / `// rest of code` truncations in delivered code.
- Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`). No `any` without an inline justification.
- Every mutation writes an `AuditLog` row in the same transaction.
- Every monetary value is `Decimal` (Prisma) / `string` in JSON — never `number`. IEEE-754 is not acceptable for budget figures.
- All money has explicit `currency` + (for non-USD) `exchange_rate` + `amount_usd` derived.
- RLS policies enforce role boundaries server-side; client-side checks are UX hints only.

---

## 1. Phase Map

| Phase                    | Batches | Outcome                                                        |
| ------------------------ | ------- | -------------------------------------------------------------- |
| **A. Foundation**        | 1–3     | Repo, scaffold, auth shell, RBAC matrix                        |
| **B. Data Layer**        | 4–6     | Schema + real seed from xlsx, validated against SDD §10 totals |
| **C. Level 0 Dashboard** | 7–9     | "How are we against the budget?" answered in <2s               |
| **D. Drill-Down**        | 10–11   | Category and transaction detail views                          |
| **E. Write Paths**       | 12–14   | Manual entry + bank CSV importers                              |
| **F. Secondary Views**   | 15–17   | Sales, cash flow forecast, settings + audit UI                 |
| **G. Launch**            | 18–19   | End-to-end validation, deploy, parallel-ops kickoff            |

Total: **19 batches**. Each sized so a single session can plausibly finish it. Gates are explicit.

---

## Phase A — Foundation

### Batch 1 — Repo init + Next.js 15 scaffold + tooling

- **Goal:** Working Next.js 15 (App Router) app skeleton with strict TypeScript, Tailwind 4, Shadcn/ui, ESLint, Prettier, pnpm, and a clean `.env` boundary.
- **Inputs / Gates:** None.
- **Deliverables:**
  - `git init` at repo root; first commit
  - `package.json` (pnpm), `tsconfig.json` (strict), `next.config.ts`, `eslint.config.mjs`, `prettier.config.mjs`, `.gitignore`, `.env.example` (no secrets)
  - `app/` skeleton with root layout, `app/page.tsx` placeholder route, global Tailwind styles
  - `components/ui/` Shadcn primitives initialized (button, card, table — installed, not used yet)
  - `lib/env.ts` — typed env loader using `zod` so missing vars fail at boot, not at runtime
  - `README.md` (project name + run commands only; no marketing copy)
- **Acceptance:** `pnpm dev` boots without errors. `pnpm typecheck` and `pnpm lint` pass with zero warnings. `.env.example` documents every required variable.
- **Risks / Open:** Node version pin needed — propose `>=20.11` via `engines` + `.nvmrc`.

### Batch 2 — Prisma + Supabase wiring

- **Goal:** App connects to the user's Supabase Postgres via Prisma; first migration applied; healthcheck route returns DB ping.
- **Inputs / Gates:** **Gate 2.1** — user provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooled), `DIRECT_URL` (unpooled, for migrations). Pasted into a local `.env.local` the user creates; never committed.
- **Deliverables:**
  - `prisma/schema.prisma` minimal (datasource + generator + one placeholder `_HealthCheck` model that we drop in Batch 4)
  - `prisma/migrations/0001_init/` applied to user's Supabase
  - `lib/db.ts` — single Prisma client with `globalThis` cache (Next.js dev-friendly)
  - `app/api/health/route.ts` — `SELECT 1` round-trip, returns `{ ok, latency_ms }`
- **Acceptance:** `curl localhost:3000/api/health` returns `{ ok: true }`. Migration visible in Supabase dashboard.
- **Risks / Open:** Prisma + Supabase needs both pooled and direct URLs. Document in `.env.example`.

### Batch 3 — Auth + centralized RBAC matrix

- **Goal:** Supabase Auth wired with email/password + magic-link, protected-route middleware, and an enterprise-grade centralized RBAC matrix (per saved memory: feedback_rbac_approach — no inline role checks).
- **Inputs / Gates:** Batch 2 done.
- **Deliverables:**
  - `lib/auth/server.ts` — server-side Supabase client (cookies), `getUser()`, `requireUser()`, `requireRole()`
  - `lib/auth/client.ts` — browser Supabase client
  - `lib/rbac/matrix.ts` — single source of truth: `Role × Resource × Action → allow|deny`, exhaustive over enums; **all** authorization decisions route through `can(user, action, resource)`
  - `lib/rbac/policies.ts` — Postgres RLS policy generator (so the matrix is mirrored at the DB layer)
  - `middleware.ts` — protects all routes except `/login`, `/api/health`
  - `app/login/page.tsx` — minimal email + password form using real Supabase Auth (no mock users)
  - `app/(app)/layout.tsx` — server-side `requireUser()` gate; renders nothing until auth resolved
- **Acceptance:** Unauthenticated GET of any `/(app)/*` route 302s to `/login`. Logged-in user lands at `/(app)`. `can()` returns deterministic results for every (role, resource, action) tuple — proven by Batch 4's RLS tests.
- **Risks / Open:**
  - **Gate 3.1** (deferred to launch): Real user identities (CEO + analyst + admin emails + full names). Not blocking — Batch 3 ships with no seeded users; first user is created post-deploy via Supabase dashboard invitation.
  - **Gate 3.2** (deferred): Microsoft tenant ID for future SSO. Recorded in `lib/auth/README.md` as a known migration path; no work done now.

---

## Phase B — Data Layer

### Batch 4 — Full Prisma schema + RLS policies

- **Goal:** All entities from SDD §3 modeled in Prisma; RLS policies mirror the RBAC matrix; migrations applied.
- **Inputs / Gates:** Batch 3 done.
- **Deliverables:**
  - `prisma/schema.prisma` models:
    - `Project` (singleton-style; one row for Santa Elena)
    - `BudgetCategory`
    - `BudgetSubItem`
    - `Expenditure`
    - `House`
    - `MonthlyProjection`
    - `CreditFacility`
    - `ExchangeRate` (BANGUAT daily cache; added per Batch 9 needs but modeled now)
    - `AuditLog`
    - `User` (mirror of Supabase Auth users, with `role` enum)
    - Enums: `Role`, `Currency`, `ExpenditureStatus`, `ExpenditureSource`, `HouseStatus`, `CreditType`, `AuditAction`
  - All monetary fields `Decimal(18, 2)` (or `(20, 4)` for rates)
  - `prisma/migrations/0002_full_schema/` applied
  - `prisma/policies.sql` — RLS policies generated from `lib/rbac/matrix.ts` (one SQL file per entity), applied via migration
  - `tests/rls.spec.ts` — runs against the real Supabase instance with separate JWTs per role; verifies CEO cannot mutate, Analyst cannot edit budget, Admin can do all
- **Acceptance:** Migration runs idempotently (apply twice → second is no-op). RLS tests pass: 3 roles × N resources × CRUD = full matrix coverage with no `expect` skips.
- **Risks / Open:**
  - **Gate 4.1:** Confirm ISR rate. SDD §3.2.1 says `isr_rate: 0.18`. Guatemalan real-estate developers typically use 5%/7% regimen optativo or 25% on net. 18% is unusual — needs confirmation before any tax-aware calculation. Until confirmed, the field exists but no calc consumes it.

### Batch 5 — XLSX parser

- **Goal:** A standalone, testable parser that reads the workbook and emits normalized, validated records ready for seeding. No DB writes in this batch.
- **Inputs / Gates:** **Gate 5.1** — user drops the actual `.xlsx` into the repo (filename TBD; will be added to `.gitignore` if it contains PII).
- **Deliverables:**
  - `scripts/xlsx/parse.ts` — entry point
  - `scripts/xlsx/sheets/fcfcasas2.ts` — extracts: project totals, 12 categories with budgets, 11 houses with payment schedules, 36-month monthly projection, credit facility params
  - `scripts/xlsx/sheets/ppto-inversion.ts` — extracts: budget sub-items per category with unit/qty/price
  - `scripts/xlsx/sheets/detalle-egresos.ts` — extracts: all transactions with bank, date, vendor, amounts, IVA, internal/general category, source flags
  - `scripts/xlsx/normalize.ts` — maps xlsx category names → canonical `BudgetCategory.code` per SDD §6; flags any unmapped rows for human review
  - `scripts/xlsx/validate.ts` — internal consistency checks:
    - Sum of category budgets equals project total sin IVA
    - Sum of category percentages ≈ 100% (±0.01)
    - All transactions reference a known bank account
    - All transactions have a resolvable category (or are flagged `IMPUESTOS`/`ANULADO`/`DEVOLUCIÓN`/`TRASLADO` per §6)
  - `scripts/xlsx/report.ts` — human-readable summary printed when parser runs: counts per sheet, unmapped rows, total executed
- **Acceptance:** `pnpm xlsx:parse <path>` outputs:
  - 12 categories totaling $11,228,641.51 sin IVA
  - 11 houses totaling $12,639,661.49 projected revenue
  - 242 transactions totaling **$1,988,922.82** executed (the SDD §3.2.4 number)
  - Zero unflagged unmapped rows
  - Exits non-zero if any validation fails
- **Risks / Open:**
  - If xlsx structure differs from SDD's reverse-engineering, parser exits with a precise diff (which sheet, which cell range). No silent fallbacks.
  - PII concern: vendor names may include individuals. Decide gitignore policy when file lands.

### Batch 6 — Seed script + validation against SDD §10 Phase 2

- **Goal:** Idempotent seeder writes the parsed xlsx into the real DB with full audit trail. The output reproduces the xlsx's Ppto Inversion summary numbers exactly.
- **Inputs / Gates:** Batches 4 + 5 done.
- **Deliverables:**
  - `scripts/seed/index.ts` — orchestrator; runs in a single Prisma transaction per logical group
  - Creates the synthetic `XLSX_IMPORT` user (role: `SYSTEM`, marked `is_login_disabled: true`) — single source of attribution for historical rows
  - Seeds in order: `Project` → `BudgetCategory` → `BudgetSubItem` → `House` → `MonthlyProjection` → `CreditFacility` → `Expenditure`
  - Each insert emits an `AuditLog` row with `action=IMPORT`, `user_id=XLSX_IMPORT`, `context="Initial xlsx import <date>"`
  - Idempotency: re-running the seed against the same xlsx produces zero diffs (uses content-hash keys on natural identifiers like `BudgetCategory.code`, `Expenditure (bank + date + amount + vendor)`)
  - `scripts/seed/validate.ts` — runs SDD §10 Phase 2 assertions directly against the seeded DB:
    - Total executed = $1,988,922.82
    - Total remaining = $9,239,718.69
    - Each category's actual matches xlsx within $0.01
- **Acceptance:** `pnpm seed` from a clean DB lands all data, audit log shows N=(categories+subitems+houses+projections+expenditures) IMPORT entries, validator passes all assertions, second run is a no-op.
- **Risks / Open:** None blocking. **Gate 6.1** (advisory): exchange rate column on historical GTQ transactions — use the rate stored in the xlsx for that row; do not refetch from BANGUAT for historical seeding (preserves audit fidelity).

---

## Phase C — Level 0 Dashboard

### Batch 7 — Calculation + query layer

- **Goal:** All §7 formulas exist as pure, unit-tested server functions consumed by every view that follows. The dashboard is a thin renderer over these.
- **Inputs / Gates:** Batch 6 done (real data in DB).
- **Deliverables:**
  - `lib/calc/budget-health.ts` — per-category spent/remaining/pct/status (SDD §7.1)
  - `lib/calc/burn-rate.ts` — monthly burn, trailing 3mo, projected total (§7.2)
  - `lib/calc/revenue.ts` — revenue per house, cumulative, by month (§7.3)
  - `lib/calc/ebitda.ts` — monthly EBITDA (§7.4)
  - `lib/calc/credit-facility.ts` — revolving hybrid mechanics (§7.5)
  - `lib/calc/iva.ts` — IVA cobrado vs pagado, net payable (§7.6)
  - `lib/calc/currency.ts` — variance calc using stored vs locked TC 7.7 (§7.7)
  - `lib/queries/dashboard.ts` — composite query: returns the exact shape the Level 0 view needs in a single round-trip
  - `tests/calc/*.spec.ts` — each formula tested against the seeded real data, comparing to the xlsx-derived ground truth (numbers from SDD pasted as assertions). Tests fail loudly on any drift.
- **Acceptance:** Calc tests reproduce SDD §10 Phase 2 numbers. No business logic in route handlers — only in `lib/calc/*`.
- **Risks / Open:** None.

### Batch 8 — Level 0 Dashboard UI

- **Goal:** The CEO opens the app and sees the SDD §5 Level 0 layout in under 2 seconds.
- **Inputs / Gates:** Batch 7 done.
- **Deliverables:**
  - `app/(app)/page.tsx` — server component using `lib/queries/dashboard.ts`
  - `components/dashboard/HealthHeader.tsx` — big "82.3% remaining" card with progress bar
  - `components/dashboard/StatusTiles.tsx` — On Track / Over / Not Started / At Risk
  - `components/dashboard/CategoryBars.tsx` — sorted by % consumed; respects `dashboard_visible` flag (IMPUESTOS excluded per §2.1 / §11 #8)
  - `components/dashboard/BurnRateCard.tsx`
  - `components/dashboard/ProjectionCard.tsx`
  - Tailwind utility-only styling; Recharts not yet needed (bars are CSS)
  - First-paint perf: server-rendered with no client JS for the health card or bars (only the optional trend chart hydrates)
- **Acceptance:**
  - Visual: matches the ASCII mock in SDD §5 Level 0 (sorted order, colors per status, ⚠️ on over-budget categories)
  - Numerical: TERRENOS shows 116.8% over (driven by real data, not a hardcoded value)
  - Perf: Lighthouse LCP < 2.0s against the deployed dev instance with seeded data
  - Accessibility: keyboard nav, semantic landmarks, color is not the only status signal (status icons present)
- **Risks / Open:** Confirm color palette preferences before launch (default: Tailwind emerald/amber/red/zinc).

### Batch 9 — BANGUAT exchange-rate fetcher

- **Goal:** Daily GTQ→USD official rate auto-fetched and cached, available to all forward-looking calculations and to manual entry.
- **Inputs / Gates:** Batch 4 done (ExchangeRate model exists).
- **Deliverables:**
  - `lib/banguat/fetch.ts` — calls the Banco de Guatemala public SOAP/REST service; parses; returns `{ date, rate }`
  - `app/api/cron/exchange-rate/route.ts` — Vercel Cron-callable endpoint, idempotent per date, writes to `ExchangeRate` with `source="BANGUAT"`, audited
  - `lib/exchange-rate/resolve.ts` — given a date, returns the rate: cache → fetch-on-miss → fallback to nearest previous date if BANGUAT unreachable, with a `is_stale` flag
  - Backfill script `scripts/banguat/backfill.ts` for the project's date range (Dec 2017 → today), used **only** to populate the cache for _future_ lookups; historical xlsx rates remain authoritative for seeded transactions
  - `tests/banguat.spec.ts` — hits the real BANGUAT endpoint (integration), then a stubbed offline test for the fallback path. Stubs are explicitly labeled and live in `tests/`, not in `lib/`.
- **Acceptance:** `curl /api/cron/exchange-rate` populates today's rate. Re-running same day is a no-op. Resolver returns correct rate for any date with a populated cache.
- **Risks / Open:** BANGUAT endpoint quirks (SOAP). May need a small XML parser. If unreachable, document expected response shapes in `lib/banguat/README.md` so future-me isn't guessing.

---

## Phase D — Drill-Down

### Batch 10 — Level 1: Category Detail

- **Goal:** Click a bar → land on `/(app)/category/[code]` with timeline chart, sub-items, and transactions list (SDD §5 Level 1).
- **Inputs / Gates:** Batch 8 done.
- **Deliverables:**
  - `app/(app)/category/[code]/page.tsx`
  - `components/category/Timeline.tsx` — area chart: projected cumulative spend (line) vs actual cumulative (filled), using Recharts
  - `components/category/SubItemsList.tsx`
  - `components/category/TransactionsTable.tsx` — paginated, sortable, filterable by status/date/vendor
  - `lib/queries/category-detail.ts` — server-side aggregation; single round-trip
- **Acceptance:** TERRENOS detail page shows the two real transactions ($1,182,597.40 + $198,218.96) summing to the over-budget figure surfaced on Level 0.
- **Risks / Open:** None.

### Batch 11 — Level 2: Transaction Detail + edit / flag / void

- **Goal:** Per-transaction view with full field display and mutation actions. All mutations audited.
- **Inputs / Gates:** Batch 10 done.
- **Deliverables:**
  - `app/(app)/transaction/[id]/page.tsx`
  - `components/transaction/Detail.tsx` — every field from `Expenditure` rendered with explicit currency, IVA breakdown, exchange rate
  - `components/transaction/EditForm.tsx` — role-gated via `can()`
  - Server actions: `editExpenditure`, `flagExpenditure`, `voidExpenditure` — each wraps mutation + AuditLog in one Prisma transaction
  - `components/transaction/AuditTimeline.tsx` — entity-scoped history view
- **Acceptance:** As Analyst, editing a transaction's vendor name persists, surfaces in the audit timeline immediately, and is rejected for CEO role with a proper 403 (RLS-enforced, not just UI-hidden).
- **Risks / Open:** None.

---

## Phase E — Write Paths

### Batch 12 — Manual transaction entry

- **Goal:** Analyst can add a new transaction without touching xlsx. Form auto-resolves exchange rate via Batch 9.
- **Inputs / Gates:** Batches 9 + 11 done.
- **Deliverables:**
  - `app/(app)/entry/new/page.tsx` + Server Action
  - Form fields: date, vendor (autosuggest from history), bank account, amount con/sin IVA (compute the third), description, general + internal category (cascading), source = MANUAL, status = PENDING (until verified)
  - Vendor + category autosuggest drawn from existing data
  - On GTQ entry, exchange rate auto-resolved via `lib/exchange-rate/resolve.ts`; user can override with audit reason
  - Submit creates `Expenditure` + `AuditLog` in a single transaction
- **Acceptance:** Submitting the form lands a real row visible on Level 1 within one refresh, with correct USD conversion and audit trail.
- **Risks / Open:** None.

### Batch 13 — Bank CSV parser framework + G&T parser

- **Goal:** Upload G&T CSVs (USD + QTZ); rows auto-categorized where possible; unmapped land in a Pending Review queue.
- **Inputs / Gates:** **Gate 13.1** — user provides at least one real G&T USD CSV and one real G&T QTZ CSV. Per Rule 4, I will not fabricate sample CSVs.
- **Deliverables:**
  - `lib/import/types.ts` — `RawTransaction` normalized schema
  - `lib/import/registry.ts` — pluggable adapter registry: `BankParser` interface
  - `lib/import/parsers/gt-usd.ts`, `lib/import/parsers/gt-qtz.ts`
  - `lib/import/categorize.ts` — vendor-name + description heuristics; confidence score per match
  - `app/(app)/import/page.tsx` — upload UI, preview, dedupe-by-hash, commit-to-DB step
  - `app/(app)/review/page.tsx` — Pending Review queue for unmapped rows
  - Every imported row's audit context includes batch ID + filename + original row index for full traceability
- **Acceptance:** Importing a G&T statement that overlaps with already-seeded transactions produces zero duplicates; new rows surface in the review queue; verified rows appear on Level 1.
- **Risks / Open:** Categorization heuristic quality. Acceptable v1: precision > recall (rather miss-and-route-to-review than mis-categorize silently).

### Batch 14 — Remaining bank parsers (optional / phased)

- **Goal:** Promerica, BAC, Industrial QTZ parsers.
- **Inputs / Gates:** **Gate 14.1** — user provides at least one real CSV per bank. Can ship without this batch if launch pressure exists; manual entry covers them per SDD §8.2 phasing.
- **Deliverables:** Three new files under `lib/import/parsers/`. Each registered in the registry.
- **Acceptance:** Each parser correctly imports its sample CSV, dedupes against existing data, routes unmapped to review.
- **Risks / Open:** None — drop-in pattern after Batch 13's framework.

---

## Phase F — Secondary Views

### Batch 15 — Sales tracker

- **Goal:** House-by-house revenue dashboard: status, payment schedule, enganche received, projected vs actual revenue per unit.
- **Inputs / Gates:** **Gate 15.1** — user confirms what real data exists today for the 5 sold houses (1, 2, 6, 7, 11): buyer names, contract dates, enganche amounts actually received, payment plans. If unavailable, the batch ships with house cards in a "data incomplete" state and a form to fill them — no placeholders.
- **Deliverables:**
  - `app/(app)/sales/page.tsx` — grid of 11 house cards
  - `app/(app)/sales/[house]/page.tsx` — per-house drill-down with payment schedule
  - `components/sales/PaymentSchedule.tsx` — visualizes 25% enganche + monthly installments + final at delivery
  - Server actions: `updateHouseStatus`, `recordPayment`, all audited
- **Acceptance:** Total projected revenue across cards reconciles to $12,639,661.49 (SDD §3.2.5). Sold houses show their actual data; available houses show projection only.
- **Risks / Open:** Buyer PII handling — confirm storage approach + RLS at gate.

### Batch 16 — Cash flow forecast (editable 36-month model)

- **Goal:** The full living projection from FCFCasas2 — editable in-app, every change versioned.
- **Inputs / Gates:** Batch 15 done.
- **Deliverables:**
  - `app/(app)/forecast/page.tsx` — month-by-month table + summary KPIs (EBITDA, cumulative cost, credit balance)
  - `components/forecast/EditableCell.tsx` — inline edit with audit + revert
  - `components/forecast/CreditFacilityPanel.tsx` — interest, principal, LTC over time
  - Recompute pipeline: editing month N triggers recompute for N..36 (server-side, cached)
  - `lib/calc/projection-runner.ts` — pure function: given inputs → 36-month series
- **Acceptance:** Editing a cost cell propagates to cumulative cost, EBITDA, credit balance, and IRR in <500ms. Reverting returns to pre-edit state. Every cell edit is in the audit log.
- **Risks / Open:** IRR/ROI calc details — verify formula intent against the xlsx's named ranges during this batch (Gate 16.1).

### Batch 17 — Settings + Audit-log UI

- **Goal:** Admin panel for budget adjustments, exchange-rate overrides, tax rates, user management; plus the global audit-log browser.
- **Inputs / Gates:** Batch 16 done.
- **Deliverables:**
  - `app/(app)/settings/budget/page.tsx` — edit category budgets with audit + reason
  - `app/(app)/settings/rates/page.tsx` — IVA, ISR, locked-TC overrides (with strong warnings; audited)
  - `app/(app)/settings/users/page.tsx` — invite/role-change/disable; mirrors Supabase Auth
  - `app/(app)/audit/page.tsx` — global activity feed, filterable by user / entity / date
  - `app/(app)/audit/[entityType]/[entityId]/page.tsx` — entity-scoped timeline (already partial in Batch 11; this generalizes)
- **Acceptance:** Admin changes a category budget; CEO sees the new value on Level 0 next page load; audit log shows old → new with timestamp + user + reason.
- **Risks / Open:** **Gate 17.1** — ISR rate confirmation (carried from Gate 4.1) must resolve before tax settings ship a usable default.

---

## Phase G — Launch

### Batch 18 — End-to-end validation vs xlsx

- **Goal:** Prove parity with the xlsx across every claim in SDD §10 Phase 2, plus a manual side-by-side walkthrough.
- **Inputs / Gates:** Batches 1–17 done.
- **Deliverables:**
  - `tests/parity/*.spec.ts` — automated assertions for every named number in the SDD (totals, percentages, per-category, per-house, per-month projection cells)
  - `docs/parity-report.md` — generated artifact: every SDD number, the app's number, delta, pass/fail
  - Manual walkthrough notes captured in [PROGRESS.md](PROGRESS.md) — recorded by user during a live screen-share session
- **Acceptance:** 100% of automated parity assertions pass. User signs off on the manual walkthrough.
- **Risks / Open:** Any deltas surface real bugs or real xlsx inconsistencies. Each gets a row in the parity report with resolution (app-side fix vs data-side correction with audit trail).

### Batch 19 — Deploy + parallel-operation kickoff

- **Goal:** Production deployment; CEO has read access; analyst starts entering live transactions in the app; xlsx remains in parallel for 2 weeks per SDD §10 Phase 3.
- **Inputs / Gates:**
  - **Gate 19.1** — Vercel project + custom domain (user provides; or confirms a `*.vercel.app` is acceptable for the parallel period)
  - **Gate 19.2** — Real user accounts created in Supabase (CEO, Analyst, Admin) with confirmed emails
  - Batch 18 signed off
- **Deliverables:**
  - Vercel project linked, env vars set (prod separate from dev), preview deployments on PRs
  - Vercel Cron for daily BANGUAT fetch (Batch 9 endpoint)
  - Custom domain DNS configured (if applicable)
  - `docs/runbook.md` — deploy, rollback, common-issue cheatsheet
  - `docs/parallel-ops.md` — two-week protocol: analyst enters in app first, reconciles xlsx weekly; success criterion to kill the xlsx at day 14
- **Acceptance:** CEO logs in on production, lands on dashboard, sees real numbers. Analyst's first net-new transaction (post-deploy) appears within seconds.
- **Risks / Open:** Domain + DNS timing.

---

## 2. Cross-Cutting Concerns (apply to every batch)

- **Type safety:** Strict TS, zod validation at every boundary (HTTP, env, parsed CSV, parsed xlsx).
- **Observability:** Structured logs via `pino` with request IDs; server actions instrumented with start/end + error.
- **Error handling:** No swallowed errors. Server actions return discriminated-union results; UI surfaces the failure with a specific message, not a toast that says "Something went wrong".
- **Security:**
  - Secrets only via Supabase service-role on server actions; never exposed to the client
  - RLS enforced at the DB layer; client checks are UX hints
  - CSRF tokens on all mutating forms (Next.js Server Actions default OK; verify per route)
  - No PII in logs
- **Performance budget:** Level 0 LCP < 2s; drill-down nav < 500ms; CSV upload of 10k rows < 30s server-side.
- **Testing strategy:**
  - Unit: pure functions in `lib/calc/*` with seeded-data assertions
  - Integration: RLS + server actions against the real Supabase instance
  - Parity: SDD numbers as ground truth (Batch 18)
  - No mocking of the database for tests that exercise business logic
- **Code review gates:** Every batch ends with a self-review checklist in PROGRESS.md against `_THE_RULES.MD` (especially Rules 4, 5, 8) before marking DONE.

---

## 3. Outstanding Questions (rolled into batch gates)

These do not block plan writing, only specific batches. Tracked live in [PROGRESS.md](PROGRESS.md) §Open Questions.

| ID  | Question                                                                        | Blocks                                 |
| --- | ------------------------------------------------------------------------------- | -------------------------------------- |
| Q1  | What is the actual ISR rate? SDD says 0.18; 5%/7%/25% are more common.          | Batch 4 (advisory) / Batch 17 (hard)   |
| Q2  | xlsx filename + whether vendor names are PII-sensitive (gitignore?)             | Batch 5                                |
| Q3  | Microsoft tenant ID for future SSO migration                                    | Batch 3 (notes only); future migration |
| Q4  | Real user accounts (CEO + Analyst + Admin names, emails)                        | Batch 19                               |
| Q5  | Bank CSV samples (G&T first; then Promerica, BAC, Industrial)                   | Batches 13, 14                         |
| Q6  | Buyer / contract data for 5 sold houses                                         | Batch 15                               |
| Q7  | Color palette preferences for status (default: Tailwind emerald/amber/red/zinc) | Batch 8 (cosmetic)                     |
| Q8  | Production domain (custom vs `*.vercel.app` for parallel period)                | Batch 19                               |
| Q9  | IRR / ROI formula confirmation vs xlsx named ranges                             | Batch 16                               |

---

## 4. Definition of Done (whole project)

- Every SDD §10 Phase 2 number is reproduced by the app from the live DB.
- CEO has logged in on production and confirmed Level 0 answers the question in under 2 seconds, on his usual device.
- Analyst has entered ≥10 new transactions in the app over 2 weeks of parallel operation, with zero data drift between app and xlsx.
- Audit log shows complete trace for every post-launch mutation.
- xlsx archived (not deleted) and removed from the team's working flow.

When that's true, the mission per SDD §2 is satisfied. We stop. No scope creep.
