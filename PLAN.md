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

- **Goal:** Supabase Auth wired via the SSR pattern (`@supabase/ssr`), a Next 16-compliant **Data Access Layer** that gates `/(app)/*` routes, and an enterprise-grade centralized RBAC matrix (4 roles: MASTER / CEO / ANALISTA / AUXILIAR per D14) — no inline role checks.
- **Inputs / Gates:** Batch 2 done.
- **Pattern note:** Next 16 deprecated `middleware.ts` (renamed to `proxy.ts`) and explicitly recommends against using proxy/middleware for auth gates. The Next 16 canonical pattern is a **Data Access Layer** invoked at the top of route-group layouts + Server Actions + Route Handlers, memoized via React's `cache()`. See `feedback_nextjs16_auth_pattern` memory and `node_modules/next/dist/docs/01-app/02-guides/authentication.md`.
- **Deliverables:**
  - `src/lib/supabase/server.ts` — server-side Supabase client built with `createServerClient` from `@supabase/ssr`. Reads/writes cookies via Next 16's async `cookies()` API.
  - `src/lib/supabase/client.ts` — browser Supabase client built with `createBrowserClient` from `@supabase/ssr`.
  - `src/lib/dal.ts` — Data Access Layer. Exports `verifySession()` (redirects to `/login` if no user) and `getUser()` (returns user or null). Both wrapped in React `cache()`. Uses `supabase.auth.getUser()` (server-verified JWT), **never** `getSession()`. Marked with `import 'server-only'` so accidental client imports crash the build.
  - `src/lib/rbac/matrix.ts` — single source of truth: `Role × Resource × Action → allow|deny`, exhaustive over the 4 roles + all resources. **All** authorization decisions route through `can(role, action, resource)`. See `feedback_rbac_approach` memory.
  - `src/lib/rbac/policies.ts` — Postgres RLS policy generator (so the matrix is mirrored at the DB layer; applied via migration in Batch 4).
  - `src/app/login/page.tsx` — minimal email-and-password sign-in form using real Supabase Auth Server Action. No mock users; first user invited via Supabase dashboard at launch (Gate 19.2).
  - `src/app/(app)/layout.tsx` — server-side `await verifySession()` at the top; renders nothing until auth resolved.
  - **Optional**, only if cookie-only optimistic redirect is wanted as a UX polish: `src/proxy.ts` that redirects unauthed users away from `/(app)/*` before render. Skipped by default — the DAL gate is sufficient, and proxy adds a check on every prefetched route. Revisit if there's a visible flash of unauth content.
- **Acceptance:**
  - Unauthenticated GET of `/(app)/*` → 307 redirect to `/login` via `redirect()` (Next's helper, not a proxy 302).
  - Authenticated user lands at `/(app)` and renders.
  - `can()` returns deterministic results for every (role, resource, action) tuple — proven by Batch 4's RLS test suite.
  - DAL is called exactly once per render pass (verified by inspecting Supabase request logs during a multi-component page render) — proves `cache()` memoization works.
- **Risks / Open:**
  - **Gate 3.1** (deferred to launch): Real user identities (full names, emails) for the 4 roles. Not blocking — Batch 3 ships with no seeded users; first user invited via Supabase dashboard at Batch 19.
  - **Gate 3.2** (deferred): Microsoft tenant ID for future SSO. Recorded in `src/lib/supabase/README.md` as a known migration path; no work done now.

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

### Batch 4.5 — Schema extensions for D29-D35 + inspection findings

> **Inserted 2026-05-25 as a mini-batch between Batch 4 and Batch 5.** Required because the Batch 5 parser produces output for entities that didn't yet exist in the Batch 4 schema. Architectural decision 2026-05-25: "Batch 4.5 first" — cleanest separation; keeps Batch 5 parser-only as PLAN.md intends.

- **Goal:** extend `prisma/schema.prisma` with all entities + fields required by D29-D35 and the 14 inspection findings, so Batch 5's parser output bundle has unambiguous schema targets and Batch 6's seed script has tables to write to.

- **Inputs / Gates:** Batch 4 done. No external gates.

- **Deliverables:**
  - **9 new enums** in `prisma/schema.prisma`: `DataQualityFlagKind` (19 values per the 16+ enumerated flag kinds in SDD §3.2.9), `DataQualityFlagSeverity`, `PartnerContributionKind`, `ContributionSourceKind`, `IsrPaymentPattern`, `IsrRateKind` (internal — UI uses literal `uiLabel`), `AmortizationMechanism`, `ExpenditureKind`, `PartnerCategory`.
  - **1 enum extension:** `ExpenditureStatus + ANULADO` (preserves source workbook's discriminator per [[feedback_literal_labels_when_multiple_values]]; distinct from VOIDED which is app-internal).
  - **5 new models:** `DataQualityFlag` (D31), `PartnerContribution` + `ContributionSource` (D33 composable equity flows), `IsrObligation` (D34 both rates literal), `AmortizationRule` (D33 CreditFacility 1-to-many).
  - **`Project` field additions per D30:** `internalApprovalDate`, `regulatoryHistoryNote`, `modelAuthorName`, `modelRecentEditorName`, `legalRepresentativeName`, `address`, `originalLandowner`, `modelNotes` (JSONB array). Plus TC ambiguity: `tcBudgetaryLabel`, `tcEffectiveTerrenoHistorical`. **Drop `isrRate`** per D34 (replaced by `IsrObligation`; no data loss — column was unseeded).
  - **`Expenditure` field additions:** `kind ExpenditureKind` (default OPERATING_EXPENSE), `exchangeRateAtTransaction Decimal?` (per-tx TC from regex extraction per Detalle egresos finding #11), `descriptionNormalized Text?` (parallel to `description` per [[feedback_intent_vs_implementation]]).
  - **`Partner.category PartnerCategory?`** — the 5-value functional typology (independent axis from `Partner.type` legal enum). Nullable; seed populates from inspection mapping.
  - **2 migrations** generated via D23 workflow:
    - `prisma/migrations/<ts>_batch_4_5_schema_extensions/migration.sql`
    - `prisma/migrations/<ts>_batch_4_5_rls_policies/migration.sql` (filtered to the 5 new resources only)
  - **`src/lib/rbac/matrix.ts` extended** with 5 new resources, slotted into the existing D14/D22 pattern. `data_quality_flag` uses a custom action set (ANALISTA: READ + UPDATE + DELETE; no CREATE — parser/system writes via MASTER bypass).

- **Acceptance:**
  - `pnpm prisma validate` — schema valid.
  - `pnpm prisma migrate deploy` — applies both migrations cleanly.
  - `pnpm tsx scripts/verify-rbac.ts` — all checks pass (matrix-driven; new resources expand coverage automatically).
  - `pnpm tsx scripts/verify-rls.ts` — all RLS checks pass (matrix-driven; new policies match the matrix).
  - `GET /api/health` → 200, DB layer intact across schema extension.

- **Risks / Open:**
  - **Env-var loading for `migrate diff`:** observed gotcha — `pnpm prisma migrate diff --from-url $DATABASE_URL` requires explicit env source (e.g., `source <(grep -E "^DATABASE_URL=" .env)`) BEFORE the command. Otherwise generates an error-message-as-SQL file that fails downstream. Documented for future mini-batches.
  - **None blocking Batch 5.** Schema is shape-stable; field additions are backward-compatible (nullable). Existing Batch 4 entities + migrations untouched.

---

### Batch 5 — XLSX parser

> **Spec updated 2026-05-25 after deep inspection (PROGRESS.md D26, D31, D32, D33, D34, D35 + 14 inspection findings consolidated in `docs/CONCILIACIÓN/04. MODELO PRESUPUESTARIO AL 210526 terminado (rrivas) vr2 — MANIFEST.md`).** The original v0.3 spec assumed a fail-loud validator and stale SDD parity numbers; both replaced.

- **Goal:** A standalone, testable parser that reads the workbook and emits a normalized output bundle ready for seeding. **No DB writes in this batch.** Parser is **total + faithful** per D31: it does NOT fail (no exceptions, no exit codes ≠ 0) AND it does NOT silently drop data (no skipped rows, no lossy normalization, no filtered values). Every input cell with content is captured verbatim; anomalies become `DataQualityFlag` rows in the output.

- **Inputs / Gates:**
  - **Gate 5.1 (RESOLVED 2026-05-22):** xlsx already in `docs/CONCILIACIÓN/04. MODELO PRESUPUESTARIO AL 210526 terminado (rrivas) vr2.xlsx`; directory is gitignored. Per D3, parser never echoes contents to logs/chat.
  - **Gate 5.2 (NEW):** schema extensions per D33+D34 must exist before Batch 6 can consume parser output. Whether they're added inline (Batch 5) or as a Batch 4.5 mini-batch is TBD. Parser itself can produce JSON without DB schema being final.

- **Deliverables:**
  - `scripts/xlsx/parse.ts` — entry point; CLI + library API. Writes timestamped JSON to `scripts/xlsx/output/` (gitignored).
  - `scripts/xlsx/sheets/fcfcasas2.ts` — extracts per D25/D27/D28 dashboard blocks: project metadata (banner, date, internal approval, author/editor/legal-rep names per D30), 11 budget categories (CEO view) with budgets, 11 RvUnits with payment schedules + per-unit Phase 2/3 month indexes from cols I/J, 36-month monthly projection grid (label-based per D26, NOT position), credit facility params per D33's `AmortizationRule` shape, partner cash flows (rows 89-97), the 5 verbatim NOTAS (rows 105-110) per D32, the historical scenario comparison (rows 112-124) including the abandoned 27-unit alternative as `Project.historicalAlternativesNote`.
  - `scripts/xlsx/sheets/ppto-inversion.ts` — extracts: 10 numbered budget categories with 3-level hierarchy (PARTIDA EJECUCIÓN > PARTIDA GENERAL > PARTIDA INTERNA per N4), monthly grid (label-based; identifies Santa Elena window inside the 10-year template starting at column DD = May 2025), summary columns ED (TOTAL A LA FECHA) + EE (POR EJECUTAR), EJECUTADO Q/$ frozen snapshot (rows 90-135) tagged as historical snapshot not live, cash flow rollup (rows 76-87), Federico Franco's cell comment at F20 ("Ya Cotizado final") + any other cell comments encountered, and per-row USD totals discovered via H → G → (I÷TC) fallback chain.
  - `scripts/xlsx/sheets/detalle-egresos.ts` — extracts all 242 transactions (rows 8-271, hidden + visible) into `Expenditure`-shaped records: `Banco`, `No. Cta`, `Fecha`, `Empresa`, MONTO CON IVA, MONTO SIN IVA, IVA, Descripción (verbatim), `PARTIDA INTERNA` (L3), `PARTIDA GENERAL` (L2), `PARTIDA EJECUCIÓN PRESUPUESTARIA` (L1), `NOTA / OTROS`, `SOLICITUD`. Preserves negative amounts, ANULADO statuses, missing-bank rows, and cells with theme-color fills (the broken Nomenclatura VLOOKUP affected rows).
  - `scripts/xlsx/extract/tc-from-description.ts` — regex extractor for per-transaction TC values embedded in Descripción (`T\.?C\.?\s*[-:=]?\s*Q?\.?\s*([0-9]+\.[0-9]+)`). Populates `Expenditure.exchangeRateAtTransaction` for the ~20 affected transactions per Detalle egresos finding #11.
  - `scripts/xlsx/extract/cell-color.ts` — detects non-default fills (BOTH RGB and theme palette — openpyxl mishandles theme; TypeScript via SheetJS handles both correctly). Emits `DataQualityFlag(kind='PARTIDA_FLAGGED_FOR_REVIEW')` rows for highlighted PARTIDA INTERNA cells.
  - `scripts/xlsx/extract/cell-comments.ts` — captures cell comments (e.g., Federico Franco's F20 signoff). Stored alongside their source cell in output.
  - `scripts/xlsx/reconcile.ts` — cross-sheet reconciliations: e.g., Casa 6 refund in Detalle egresos row 64 cross-references `Ppto Inversion!DK76` negative revenue, terreno aportación row 267 + cash payment row 138 reconcile to `Ppto Inversion!ED8` total. Emits `crossSheetReconciliations[]` in output (informational, not flags).
  - `scripts/xlsx/flags.ts` — `DataQualityFlag` shape + factory. Flag kinds enumerated: `MISSING_PARTIDA` (broken Nomenclatura VLOOKUP rows), `PARTIDA_FLAGGED_FOR_REVIEW` (color-coded cells), `UNIT_STATUS_CONTRADICTS_REFUND` (Casa 6 + note 5), `CATEGORY_MISLABEL` (Ppto Inversion row 131 mismatch), `TIMELINE_MISALIGNMENT` (FCFCasas2 ends May-28 vs Ppto Inversion ends Apr-27), `CALENDAR_GAP` (Nov-27 missing in FCFCasas2 row 5), `STALE_FORMULA_WINDOW` (TIRi truncated at K..AN95), `STALE_LABEL` (E112=12 vs actual 11 units), `FLOATING_POINT_RESIDUE` (Ppto Inversion H64 = 0.006), `TC_AMBIGUITY` (3-way 7.7/7.8/7.6922 + per-tx values), `OVERSPEND` (TERRENO actuals > budget, Impuestos w/o budget), `LARGE_NEGATIVE_REVENUE` (Ppto Inversion DK76), `MIXED_CURRENCY_SUM_VALIDATED_GTQ` (Detalle egresos F5 sum confirmed GTQ-only via 12% IVA ratio test), `MISSING_BANCO_INTENTIONAL` (non-cash events, cross-company transfers), `UNUSED_BUDGET_FORMULA` (Detalle egresos row 1/3 Pendiente formula referencing zero budget).
  - `scripts/xlsx/normalize.ts` — maps source partida strings → canonical app IDs; **NEVER drops or filters** rows with unmapped values — instead emits `MISSING_PARTIDA` flag with row pointer. Whitespace normalization happens in parallel fields (`raw*` + `normalized*`).
  - `scripts/xlsx/validate.ts` — invariant checks. **All produce flags, none throw.** Checks: budget category totals reconcile to project total sin IVA, transactions reference known banks (or emit `MISSING_BANCO_INTENTIONAL`), per-row B×C ≈ H sanity (or emit `OUTLIER_PRICING` like Casa 5), calendar continuity (or emit `CALENDAR_GAP`), per-cell formula extracted vs cached value match (or emit `FORMULA_MISMATCH`).
  - `scripts/xlsx/report.ts` — human-readable summary printed when parser runs: counts per sheet, flags-by-severity, totals + provenance, recognized vs unmapped partidas. Exits 0 always (per D31). Non-zero only on real I/O failures.

- **Acceptance criteria (UPDATED — supersedes original v0.3 acceptance):**
  - `pnpm xlsx:parse` produces a JSON bundle under `scripts/xlsx/output/parse-<timestamp>.json` containing:
    - **11 budget categories** (CEO view from FCFCasas2) totaling **$11,228,641.51 sin IVA** _(verified parity with FCFCasas2!H22, Ppto Inversion!H62, Ppto Inversion row 135 grand budget)_
    - **11 RvUnits** with sale-month + delivery-month + sale price; sold ⊆ {1, 2, 5, 6, 7, 11} per D29 + workbook note 5 (Casa 5 operational override per D29; Casa 6 retains sold-bucket membership pending Q-CASA-6-STATUS resolution per recent inspection finding)
    - Projected revenue total **$12,639,661.49** _(FCFCasas2!H47 = Ppto Inversion!H76)_
    - **242 Expenditure rows** totaling **$2,001,163.72 USD** _(Ppto Inversion row 135 grand actuals — per N3, this LIVE total supersedes the stale SDD §3.2.4 $1,988,922.82 figure)_
    - At least **2 PartnerContribution rows**: row 267 (2018-02-15, Q9,096,780, IN_KIND_ASSET, Condominio Antigua Panorama S.A.) + row 138 (2025-06-16, Q1,535,506, CASH, Ana Diaz Duran Duran)
    - **9 BankAccount rows** (6 active + 3 legacy) per Detalle egresos finding #2
    - **5 NOTAS captured verbatim** per D32 in `Project.modelNotes[]` Spanish strings
    - Per-transaction TC successfully extracted from at least 20 Descripción cells per finding #11
    - **`DataQualityFlag[]` populated** with the expected kinds (none of these are blockers; they're surfaced for app/dashboard)
  - Parser **exits 0 on every successful read** regardless of data anomalies. Exits non-zero ONLY on file-missing / file-unreadable / OOM. No middle ground.
  - Re-running the parser against the same xlsx produces a byte-identical output bundle except for the timestamp (deterministic ordering of records).

- **Risks / Open:**
  - **No risk of parser failure on data issues** (D31). The risk is the opposite: omitted anomalies. Mitigation = the validate.ts checks emit flags for every known anomaly class; new anomalies discovered later become new flag kinds.
  - **Schema-extension sequencing (Gate 5.2):** until schema entities exist (`DataQualityFlag`, `PartnerContribution`, `IsrObligation`, `AmortizationRule`, extended `Counterparty`/`Partner.type`, new `Project` fields per D30), Batch 6 cannot consume the parser output. Decision pending: (a) Batch 4.5 schema-extension mini-batch first, (b) bundle schema extensions into Batch 5, (c) schema-agnostic JSON output deferred to Batch 6 for mapping.
  - **PII concern:** vendor + buyer names are real individuals. `docs/CONCILIACIÓN/` is gitignored per D3; `scripts/xlsx/output/` MUST be too. Parser output is local-machine artifact only.

### Batch 6 — Seed script + validation against live xlsx totals

> **Spec updated 2026-05-25 after deep inspection.** Entity names corrected (`House` → `RvUnit` per D9), parity numbers updated to live totals (per N3), new entity seeds added per D29-D35 + 14 inspection findings, sold-bucket override per D29 + Casa 6 pending status per Q-CASA-6-STATUS.

- **Goal:** Idempotent seeder writes the parsed xlsx output (from Batch 5) into the real DB with full audit trail. The seed reproduces the xlsx's live actual totals (Ppto Inversion row 135 grand totals) exactly. **Replays of the seed against the same parser output produce zero diffs.**

- **Inputs / Gates:**
  - Batch 4 done + schema-extension dependencies satisfied (Gate 5.2 from Batch 5).
  - Batch 5 done with successful parse output at `scripts/xlsx/output/parse-latest.json`.

- **Deliverables:**
  - `scripts/seed/index.ts` — orchestrator; runs each entity group in a single Prisma transaction.
  - Creates the synthetic `XLSX_IMPORT` user (role: `MASTER` per D14 — `SYSTEM` is not a defined role; `is_active: false`) — single attribution source for historical rows per D8.
  - Seeds in order: `Project` (with all D30 metadata + both ISR rates per D34) → `BudgetExecutionPartition` → `BudgetCategory` → `BudgetSubItem` → `BankAccount` (9 rows per Detalle egresos finding #2) → `Counterparty` (or extended `Partner`, per Q1 schema decision) → `RvUnit` (11 units) → `RvReservation` (per workbook note 5 + D29 sold-bucket override) → `MonthlyProjection` (with calendar continuity per D31) → `CreditFacility` + `AmortizationRule` (per D33) → `IsrObligation` (per D34, with `ISR 18` + `ISR 25` literal labels) → `PartnerContribution` (2018 aportación + 2025 cash) → `Expenditure` (242 rows + preserved ANULADO + negative-MONTO row 242) → `InvestmentPhase` (per D24) → `DataQualityFlag` (all flags from the parse output) → `AuditLog` (one per insert).
  - Per D30, `Project` gets seeded with: `internalApprovalDate = 2025-04-22`, `regulatoryHistoryNote` (12→11 forced revision), `modelAuthorName = "Lic. Federico Javier Franco Jimenez"`, `modelRecentEditorName = "Ronny Rivas"`, `legalRepresentativeName = "Aguedo Ivan Escobar Velasquez"`, `address = "5TA AVE. SUR FINAL, FINCA PAVON Y MATAMBO LOTE 3, SAN PEDRO EL PANORAMA, ANTIGUA GUATEMALA, SACATEPEQUEZ"`, `originalLandowner = "ANA DIAZ DURAN DURAN"`, `modelNotes` (5 verbatim Spanish notes per D32).
  - Per D29, `RvUnit.classification` for Casa 5 set to `SOLD` via operational override (annotated in seed comment + DataQualityFlag); Casa 6 stays `SOLD` per Casa 5 precedent pending Q-CASA-6-STATUS resolution (also annotated + flagged).
  - Per D34, `IsrObligation` rows: one row for ISR 18 (effective) + one row for ISR 25 (nominal label) — both literal labels surface in UI per the D34 directive.
  - Each insert emits `AuditLog { action: IMPORT, userId: XLSX_IMPORT, context: "Initial xlsx import 2026-05-25" }` per D8.
  - **Idempotency:** content-hash keys on natural identifiers — `BudgetCategory.code`, `Expenditure (bankAccountId + date + amount + counterpartyId + description-hash)`. Re-running the seed against the same parse output is a no-op.
  - `scripts/seed/validate.ts` — runs assertions directly against the seeded DB. **All produce structured pass/fail records; no exceptions. Exit non-zero only if budget reconciliation fails (a real correctness issue, not a data-quality flag).**

- **Acceptance criteria (UPDATED):**
  - `pnpm seed` from a clean DB lands all data; second run is a no-op.
  - Audit log shows N IMPORT entries where N = sum of seeded rows across all entity types.
  - Validator assertions (all GTQ via D31's "values are GTQ" finding):
    - **`SUM(Expenditure.amountGtq WHERE NOT deleted_at)` = `15,408,960.63 GTQ`** (matches Ppto Inversion ED71 + Detalle egresos F5)
    - **`USD-converted actuals` = `$2,001,163.72 USD`** (matches Ppto Inversion row 135) using per-transaction TC where available + default 7.7 fallback
    - **`SUM(BudgetCategory.budgetUsd)` = `$11,228,641.51`** (matches FCFCasas2!H22)
    - **`SUM(RvUnit.priceUsd)` = `$12,639,661.49`** (matches FCFCasas2!H47)
    - `Project.modelNotes.length == 5` per D32
    - `PartnerContribution.count >= 2` (the 2018 + 2025 terreno events)
    - `BankAccount.count == 9` per finding #2
    - `IsrObligation` contains exactly 2 rows with literal labels `"ISR 18"` and `"ISR 25"` per D34
  - `DataQualityFlag` table is populated (count > 0) — the seed PRESERVES every flag from the parse output. Counts are surfaced in the validator report but do NOT block.

- **Risks / Open:**
  - **Gate 6.1 (advisory, unchanged):** exchange rate on historical GTQ transactions — use the per-transaction TC from Descripción extraction (per finding #11) when available; fall back to `Project.tcAdvertised = 7.7` otherwise. Do NOT refetch from BANGUAT for historical seeding (audit fidelity).
  - **Schema-extension dependency:** if Batch 5 emits JSON for entities that don't yet exist in the schema, this batch is blocked. Gate 5.2 must be resolved first.
  - **Casa 6 operational status (Q-CASA-6-STATUS):** if Federico confirms Casa 6 is currently unsold (original buyer withdrew, no re-sale), Casa 6's `RvReservation` row gets soft-deleted + flag updated. This is a 1-row seed update.

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
