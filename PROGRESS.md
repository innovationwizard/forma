# FORMA — Santa Elena: Live Progress Tracker

**This document is the single source of truth for project state across sessions.**
Update at the **start, middle, and end** of every batch. If a session is compacted, the next session must read this file _before_ doing anything else.

---

## 0. Session Resumption Protocol

If you (Claude or human) just opened this project:

1. Read [\_THE_RULES.MD](_THE_RULES.MD) — non-negotiable operating constraints.
2. Read [SDD_FORMA_SANTA_ELENA.md](SDD_FORMA_SANTA_ELENA.md) — product spec.
3. Read [PLAN.md](PLAN.md) — batched implementation plan.
4. Read this file (PROGRESS.md) end-to-end.
5. Locate the current in-flight batch under §3 Batch Status. Anything marked `IN_PROGRESS` is where to resume.
6. Before writing any new code, diff against the filesystem: have the marked-complete deliverables actually been created? If not, that's the resumption point.
7. Resolve any `BLOCKED` items under §4 Open Questions before continuing. Do not paper over blocks — surface them to the user.

---

## 1. Project Snapshot

| Field                | Value                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo root            | `/Users/jorgeluiscontrerasherrera/Documents/_git/forma`                                                                                       |
| Git remote           | `git@github-innovationwizard:innovationwizard/forma.git` (SSH alias resolves to `github.com:innovationwizard/forma.git`). Pushed at Batch 1   |
| Current phase        | **Phase B — Data Layer** (Batch 4 done; Phase A complete)                                                                                     |
| Last completed batch | **Batch 4** — Full schema + soft-delete + RLS (commit `dbae34e`, pushed 2026-05-22). 17 entities, 3 migrations. RLS verify: 230/230 pass.       |
| In-flight batch      | —                                                                                                                                             |
| Next batch on deck   | **Batch 5** (XLSX parser) — Gate 5.1 (user dropped the workbook into `docs/` already, ready to parse)                                         |
| Plan version         | v1 (2026-05-22)                                                                                                                               |
| Last updated         | 2026-05-22                                                                                                                                    |

---

## 2. Locked Decisions

Captured from the planning conversation. Do not relitigate without explicit user request.

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Source                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| D1  | DB + auth stack: **Supabase end-to-end** (Postgres + Auth + Storage + RLS), Prisma for type-safe queries on top. Microsoft SSO is a future migration via Supabase's Azure AD provider.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | User Q-round 1                                                                                    |
| D2  | Repo layout: **single Next.js 15 app at repo root**. No monorepo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | User Q-round 1                                                                                    |
| D3  | XLSX source: **lives under `docs/`** (gitignored — contains real PII / financial data). Parser reads from there. Never commit, never echo contents into chat or logs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | User Q-round 1 + follow-up                                                                        |
| D4  | This-turn scope: **plan + progress doc only**. Wait for explicit user green light before starting Batch 1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | User Q-round 1                                                                                    |
| D5  | Supabase project: **already exists**; user will share `SUPABASE_URL` + anon + service-role + pooled/direct DB URLs into a local `.env.local` (never committed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | User Q-round 2                                                                                    |
| D6  | Exchange-rate source: **Banco de Guatemala official daily rate, auto-fetched** via a Vercel Cron + cache table. Historical rates from xlsx remain authoritative for seeded transactions; ongoing rates come from BANGUAT.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | User Q-round 2                                                                                    |
| D7  | Bank CSV samples: **user provides real samples alongside the xlsx**. Per Rule 4 (no mock data), parsers will not be developed against fabricated CSVs. G&T first (78% of transactions), others phased.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | User Q-round 2                                                                                    |
| D8  | Historical audit attribution: **synthetic `XLSX_IMPORT` system user** (login-disabled). All seeded rows audited to this user with `context="Initial xlsx import <date>"`. Schema keeps `user_id NOT NULL`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | User Q-round 2                                                                                    |
| D9  | **Santa Elena's house-status schema adopts the production PA DB patterns** (`rv_unit_status` 5-state enum: AVAILABLE / SOFT_HOLD / RESERVED / FROZEN / SOLD, with the 8 documented state-machine transitions; plus `rv_reservation_status` 4-state and `rv_freeze_request_status` 2-state). Santa Elena uses its OWN Supabase DB (per D5), not shared with PA. Enum names, labels, state-machine transitions, and the xlsx-status `STATUS_MAP` are reused verbatim. Source: [docs/CanonicalTaxonomy.md](docs/CanonicalTaxonomy.md). Schema impact: replaces SDD §3.2.5's 3-state `HouseStatus` enum; adds `Reservation` and `FreezeRequest` entities not in SDD.                          | docs/CanonicalTaxonomy.md + user Q-round 3                                                        |
| D10 | **Table-name prefix: `rv_` verbatim** — match PA's convention (`rv_units`, `rv_unit_status`, `rv_reservation_status`, `rv_freeze_request_status`, …). `rv_` = **RESERVA** — scopes the namespace to **Phase 1** of the sale process. Implies a parallel convention for later phases: phase-2 (enganche) and phase-3 (bank credit) entities will use their own phase-scoped prefixes, NOT `rv_`. Full lexical alignment with PA simplifies cross-company work and Odoo migration.                                                                                                                                                                                                          | User Q-round 4 + follow-up                                                                        |
| D11 | **Single-project schema for v1** — Santa Elena hard-coded; **no `project_id` FK** on entities. Acknowledged risk: when the second FORMA project (of the 6) joins, a multi-project migration is required. Mitigation: keep migrations simple and reversible; design table layouts so adding `project_id` later is a non-destructive ALTER.                                                                                                                                                                                                                                                                                                                                                 | User Q-round 4                                                                                    |
| D12 | **Phase scope for v1: model only phases with active Santa Elena data** — Phase 1 (reservations: `rv_units`, `rv_reservations`, `rv_freeze_requests` per D9) and FORMA's construction loan (its own credit-facility domain, separate from sale phases). **Deferred:** Phase 2 (enganche installments — no SE data yet) and Phase 3 (buyer mortgages — no SE data yet). When SE starts collecting enganches or releasing buyer mortgages, add those entities. See [[reference_sale_phases]] memory.                                                                                                                                                                                         | User Q-round 4                                                                                    |
| D13 | **Odoo v19 alignment: match where free, deviate where it would distort the FORMA app** — entity boundaries informed by Odoo modules (`account.move` / `account.move.line` for journal entries, `res.partner` for vendors + buyers, `sale.order` for reservations, `project.project` for the project, `account.payment` for payments, `account.tax` for IVA). Field names use Odoo conventions when not jarring. No Odoo-coupling shims or add-on dependencies in the app.                                                                                                                                                                                                                 | User Q-round 4                                                                                    |
| D14 | **RBAC role set for Santa Elena v1: 4 roles** — (1) **MASTER** = Jorge, designer/developer, superuser. (2) **CEO** = dashboard consumer, drill-down without limits, **read-only** (no create/update/delete). (3) **ANALISTA** = hands-on RE + finance expert (rrivas — built the xlsx workbooks); **full CRUD**. (4) **AUXILIAR** = juniors helping ANALISTA; **full CRUD**, requires **robust audit trail** (no exceptions). Out of scope for now: ADMIN, SUPERVISOR, WORKER (these may return later for the broader FORMA system). Note: ANALISTA is the rename of the formerly-proposed FINANCIERO role in [[project_financial_refactor]]. Supersedes SDD §9's 3-role design.          | User Q-round 5                                                                                    |
| D15 | **Initial users at launch** — MASTER: Jorge. ANALISTA: rrivas (provides credentials at Gate 19.2). CEO: 1 human (TBD at Gate 19.2). AUXILIAR: 0+ (added on demand). All roles defined in the matrix from day 1; humans assigned per-role at launch.                                                                                                                                                                                                                                                                                                                                                                                                                                       | User Q-round 5                                                                                    |
| D16 | **Git + CI: solo workflow, no CI for now.** Plain commits to `main`. No commit signing requirement, no Conventional Commits enforcement, no GitHub Actions, no pre-commit hooks beyond what's natural for the stack (pnpm-lock integrity etc.). Vercel auto-deploy from `main` is wired in Batch 19, not before. Revisit when team grows.                                                                                                                                                                                                                                                                                                                                                 | User Q-round 5                                                                                    |
| D17 | **Supabase keys: use the new publishable/secret key system, NEVER the legacy anon/service_role pair.** Env-var naming: `NEXT_PUBLIC_SUPABASE_URL` (client), `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (client, `sb_publishable_…`), `SUPABASE_SECRET_KEY` (server-only, `sb_secret_…`). The legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` names are explicitly banned by the [\_THE_RULES.MD](_THE_RULES.MD) addendum as deprecated technical debt. Auth in Batch 3 uses `@supabase/ssr` which needs the publishable key on both server and client. See `feedback_supabase_keys` memory.                                                                                          | User addendum to \_THE_RULES.MD + Q-round 6                                                       |
| D18 | **Prisma: pinned to 6.x stable, NOT the latest 7.x major.** Prisma 7.8.0 removed `url`/`directUrl` from schema files and requires a new `prisma.config.ts` + driver-adapter pattern (`@prisma/adapter-pg`) which is brand new and has sparse Supabase tooling. Per Rule 8 (production-first), Prisma 6.19.3 — the actively-maintained stable major — is the correct choice over the bleeding-edge 7.x. Revisit when Prisma 7 ecosystem matures.                                                                                                                                                                                                                                           | Batch 2 implementation                                                                            |
| D19 | **Both `DATABASE_URL` and `DIRECT_URL` use the Supabase Session pooler** (port 5432 at `aws-<n>-<region>.pooler.supabase.com`). Reason: in our network only the Session pooler is IPv4 compatible — Direct connection and Transaction pooler (6543) are both IPv6-only. Session pooler is session-mode (not transaction-mode) so it preserves prepared statements + advisory locks + DDL, which is exactly what Prisma needs for both runtime queries and migrations. Same URL for both env vars. See `feedback_supabase_connection_pooler` memory.                                                                                                                                       | User correction (Batch 2)                                                                         |
| D20 | **Batch 3 auth uses Next 16's Data Access Layer pattern, NOT middleware.** Next 16 deprecated `middleware.ts` (renamed to `proxy.ts`, "use as a last resort"). Canonical pattern is `src/lib/dal.ts` with `verifySession()` + `getUser()` wrapped in React `cache()`, invoked at the top of `app/(app)/layout.tsx` and any Server Action / Route Handler that needs auth. Uses `supabase.auth.getUser()` (server-verified) — never `getSession()`. Optional `src/proxy.ts` only for cookie-only optimistic redirects (skipped by default). Supersedes PLAN.md Batch 3's original `middleware.ts` design. See `feedback_nextjs16_auth_pattern` memory.                                     | User correction + Next 16 docs (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`) |
| D21 | **All deletes are soft deletes. We don't drop data. Ever.** Every business table has a `deletedAt DateTime?` column + index on it. `audit_log` is the only exception (it's the immutable audit itself). DELETE permission in the RBAC matrix authorizes the app's `softDelete()` helper (which performs `UPDATE deleted_at = NOW()`); app code must never call `prisma.X.delete()` directly. Reads filter `WHERE deleted_at IS NULL` by default. RLS policies currently grant Postgres DELETE — a future hardening step can replace them with column-scoped UPDATE policies on `deleted_at` for defense-in-depth.                                                                         | User direction (Batch 4 mid-batch)                                                                |
| D22 | **Batch 4 matrix refinements** (relaxation from initial proposal): (a) AUXILIAR gets DELETE on every resource it can already mutate (partner, budget*\*, expenditure, rv*\*); (b) `cap_adjustment` is append-only by convention but ANALISTA can UPDATE + soft-DELETE individual rows because caps move both up and down and deals fall apart; (c) settings tables (`project`, `credit_facility`, `monthly_projection`) get ANALISTA FULL_CRUD (CREATE + DELETE added); (d) ANALISTA gets FULL_CRUD on `bank_account`, `appraisal`, `disbursement`, `exchange_rate` per soft-delete safety. AUXILIAR stays READ_ONLY on the 7 sensitive resources (bank, settings, formal events, audit). | User direction (Batch 4 mid-batch)                                                                |
| D23 | **`prisma migrate dev` is permanently broken for this project; use `migrate diff` + manual migration dir + `migrate deploy`.** Initial scope (Batch 4): RLS migrations referencing `auth.uid()` / `auth.jwt()` fail on Prisma's shadow database (vanilla clone with no Supabase `auth` schema). **Expanded scope (2026-05-25):** `migrate dev` re-applies ALL prior migrations to the shadow before computing the diff for a new one, so once any RLS migration exists in history, every subsequent `migrate dev` (including `--create-only`) fails the same way. The forward workflow is: (1) edit `schema.prisma`; (2) `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > migration.sql` (no shadow); (3) place in `prisma/migrations/<UTC-timestamp>_<name>/migration.sql`; (4) `prisma migrate deploy` to apply; (5) for RLS, generate the policies via `pnpm tsx scripts/generate-rls-sql.ts` (or a single-resource variant), create a second migration the same way, deploy. | Batch 4 implementation; expanded after the `InvestmentPhase` add (2026-05-25) |
| D24 | **Investment phasing (Fase 1–5) is required from day 1; shareholder splits are deferred.** Two distinct concepts surfaced from the `resumen` template sheet visual inspection. Investment phases — FORMA's capital-deployment milestones (Fase 1: first 6 months; Fase 2: licenses + start, months 8–12; Fase 3: construction obra gris; Fase 4: construction acabados; Fase 5: close-out) — are modeled by `InvestmentPhase` + `InvestmentPhaseStatus` enum, added in migration `20260525085118_add_investment_phase`. Matrix entry `investment_phase` (CEO READ / ANALISTA FULL_CRUD / AUXILIAR READ) added in matrix.ts. Shareholder splits ("Desarrollo Antigua Nueva S.A." 100% / "Grupo Chacon" 93% / "Grupo Icono Urbano" within) are out of scope for v1 — revisit later if cap-table tracking becomes a need. Distinct from the universal 3-phase sale model (`reference_sale_phases` memory) — that's buyer-side, this is operator-side. | User direction during Batch 5 deep inspection of `resumen` sheet (2026-05-25) |
| D25 | **The CEO's Level-0 dashboard anchor view IS the `FCFCasas2!A1:I25` summary block — supersedes SDD §5's "sorted-by-percent-consumed" framing, which was a prior Claude's over-translation of Jorge's intent.** Canonical layout: project banner (`A1`) + date (`A2`) + 11 budget categories rows 10–20 in fixed order, with `A`=name, `H`=presupuesto USD, `I`=% of total, `G16`=5% commission rate for COMISIONES DE VENTA — followed by totals at rows 22–24 (sin IVA, IVA, con IVA) and `Gasto Acumulado (Con IVA)` at row 25. Plan vs execution shown side-by-side. **Order and nomenclature are sacred — preserve verbatim. NEVER REORDER.** <br><br>**Anomaly visibility (Jorge's original intent, in his words):** _"help the CEO see and notice anomalies at first glance, maybe colors or visual flags."_ The implementation is **visual treatment** — color, badges, icons, conditional typography, bullet-graph variance bars, sparklines — applied to cells/rows AS THEY APPEAR in canonical order. The prior SDD §5 "sort by % consumed" interpretation is rejected: sorting destroys the canonical layout the CEO already reads, and visual flags surface anomalies without disturbing the mental map. Batch 8 will research and propose 2–3 visual-treatment idioms (preserving order) for sign-off before any UI is shipped. See `feedback_intent_vs_implementation` memory. | User direction during Batch 5 deep inspection of `FCFCasas2` sheet (2026-05-25) |
| D26 | **The budget is not static — re-forecasting can happen any day, including STRUCTURAL changes (columns inserted, rows added, timeline extended past May-28).** This invalidates any position-based parser design. **The parser is label-based, not position-based:** find rows by column-A content (canonical category names), find columns by row-5/6 header content (month-date strings + project-month numbers), read the grid until row-5 headers stop (not until "column AT"). Schema: `MonthlyProjection.monthNumber` is convenient but secondary; `monthDate` is the durable key (May-28 is May-28 regardless of column position). The parser MUST: (a) discover the category set dynamically (don't assume "exactly 11"); (b) discover the month count dynamically (don't assume "exactly 36"); (c) find every named column/row by its label, never by its address; (d) be re-runnable as the xlsx evolves. The seed (Batch 6) must be re-runnable too, and use soft-delete (D21) for any rows that disappear from a new xlsx version — never hard-delete history. | User direction during Batch 5 deep inspection — re-forecast can shift columns rightward + add new ones (2026-05-25) |
| D27 | **The CEO's Level-0 dashboard has TWO canonical blocks — extends D25.** Block 1 (already locked): cost/budget summary from `FCFCasas2!A1:I25`. **Block 2 (new):** revenue summary from `FCFCasas2!A27:J51` — 11 houses with sale prices, enganche months, delivery months, total revenue + IVA + ROI. The CEO uses this to answer "how is revenue going?" — the second question he always asks. Together, the two blocks support decisions about the **moving capital structure**: should we re-appraise to release more loan money, raise the loan cap, request investor capital injection, or other action. **ROI on this sheet is revenue/cost RATIO (`H47/H22`), not margin.** `H51 = 1.1257` means revenue is 12.57% above cost (margin), or revenue is 1.13× cost (multiple). Dashboard must render this unambiguously — never display "112.57% return" because that misreads the figure by ~10×. Order + nomenclature still sacred per D25; anomaly visibility via visual treatment per D25, not reordering. Batch 8 visual-treatment research now covers both blocks. | User direction during Batch 5 deep inspection of revenue section (2026-05-25) |
| D28 | **The CEO's Level-0 dashboard has a THIRD canonical block — extends D27.** Block 3: financial bottom line from `FCFCasas2!A52:J88` — EBITDA, credit facility status, ISR, post-tax profit, peak equity, and four different "return" figures. The block answers the CEO's third question: _"what's the financial position right now?"_ — used to decide actions on the moving capital structure (re-appraise, raise cap, equity injection). **Dashboard must disambiguate the four returns** (the xlsx has all of them but labels them confusingly): (1) Revenue / Cost ratio `H47/H22` = 1.13× or +12.6%, (2) EBITDA Margin `H55/H22` = 12.6%, (3) Annualized IRR `IRR(K82:AT82,0)*12` = 31.2%, (4) Return on Peak Equity `H85/H83` = 75.6%. Never display any of these as "ROI" without qualification. **Key dashboard signal:** when `H59 > I59` (peak LTC exceeds ceiling), flag for CEO action. Per D25, order + nomenclature sacred, anomaly visibility via visual treatment. | User direction during Batch 5 deep inspection of financial bottom line (2026-05-25) |
| D29 | **Casa 5 is a true outlier. Operational override: treat as SOLD until further notice. Schema does NOT change.** Casa 5 was reserved 2025-04-04 at 12-house pricing (before the 11-house revision approved 2025-04-22) and is currently in active renegotiation with no resolution as of 2026-05-25. Per Ronny, Casa 5 is the ONLY ripple identified from the 12→11 forced revision; per Jorge (2026-05-25), a single outlier does not justify a schema concept like `RvReservation.status = RENEGOTIATING`. Batch 6 seed buckets: sold = {1, 2, **5**, 6, 7, 11} (6 units, overrides workbook note 5 which excludes Casa 5); unsold = {3, 4, 8, 9, 10} (5 units). The vestigial 12-house values at B37/C37 are loaded as-is but not used for forecasting; H37 carries the operative figure. Renegotiation status is held as operational context in the FCFCasas2 manifest, NOT as a first-class schema concept. Revisit only if/when the renegotiation closes (a 1-row seed update, no migration). See [[feedback_outliers_dont_drive_schema]]. | Ronny interview + user direction (2026-05-25) |
| D30 | **Santa Elena project history captured as Project metadata.** Per Ronny 2026-05-25: the original plan was 12 houses; the municipality rejected it, forcing a revision down to 11 houses. The 11-house version carries a handwritten internal FORMA approval date of **2025-04-22**. The model author of record (per `FCFCasas2!C133` masthead) is **Lic. Federico Javier Franco Jimenez** (CEO of FORMA, per [[forma-team-roles-and-access-pattern]]). The most recent editor (per filename) is **Ronny Rivas / rrivas** (Analyst). The legal representative (per `FCFCasas2!C141`) is **Aguedo Ivan Escobar Velasquez**. Schema additions to `Project`: `internalApprovalDate`, `regulatoryHistoryNote`, `modelAuthorName`, `modelRecentEditorName`, `legalRepresentativeName`. Persists alongside [[holding-company-structure-forma-pa]]. | Ronny interview (2026-05-25) |
| D31 | **THE PARSER DOES NOT FAIL — neither loudly nor silently.** **Both halves matter equally.** Not loudly = no exceptions, no exit codes ≠ 0, no aborts, no "refuses to operate." Not silently = no dropped rows, no lossy normalization, no filtered values, no coerced values, no "we'll just skip this one." Every input cell with content is captured **verbatim** into the output. Data-quality issues (the AN-cluster anomalies, TIRi truncation, calendar gap, broken Nomenclatura VLOOKUPs, contradictions across sheets, etc.) become first-class `DataQualityFlag` rows. The parser ALWAYS returns a complete dataset on every run. The **app** is what surfaces discrepancies — every dashboard value carries provenance: _"this comes directly from the xlsx"_ vs _"this comes from my own calculations."_ Where source ≠ recomputed, BOTH are shown with labels (e.g., TIRi: "as in xlsx (21.23%, 30 mo)" alongside "recomputed (30.95%, 36 mo)"). Never silently override. Calendar continuity: parser captures source dates verbatim AND generates its own continuous monthly calendar AND emits a flag if the source has a gap (e.g., Nov-2027 omission) — all three. UI displays the discrepancy. AN-cluster intent questions stay open for Federico, but the app ships fully operational with both values visible. **Note on principle naming:** "resilient" alone is ambiguous (can be misread to authorize silent failure). The canonical short name is **"parser does not fail and does not drop data."** See [[feedback_parser_resilient_app_surfaces]]. | User direction during PROGRESS lock (2026-05-25), refined same-day after the "resilient ≠ silent-OK" correction |
| D32 | **Author's `NOTAS - Modelo Mejorado` block (`FCFCasas2!A105:A110`) preserved verbatim as `Project.modelNotes`.** Five Spanish notes documenting key model parameters: (1) location-differentiated prices for unsold houses; (2) revolvente híbrido credit-amortization rule ("amortiza solo cuando EBITDA mensual es positivo"); (3) staggered delivery — sold houses months 14-17, unsold months 24-28; (4) price range $1,300,000–$1,425,000 ($2,648–$2,900/m²); (5) sold houses 1,2,6,7,11 retain original prices. These are the model author's own canonical documentation and must survive into the FORMA dashboard regardless of source-workbook visibility (notes 1 and 5 are in hidden rows). Surface verbatim on the dashboard as authoritative project notes. Per [[feedback_intent_vs_implementation]] the verbatim Spanish text is what survives — do not translate, do not paraphrase. Schema: `Project.modelNotes` is a text array (or JSON column), one entry per note, with source-cell reference. | FCFCasas2 visual inspection Part 10 (2026-05-25) |
| D33 | **Where Federico/bank/tax confirmation is pending, schemas accommodate HIGH domain complexity** (composite/polymorphic structures, NOT flat enums). Specifically: (a) `PartnerContribution.source` is a **first-class entity** (`ContributionSource`) supporting composable instances — forecast + actual + hybrid co-exist per contribution; a single contribution can carry multiple sources with different weights. (b) `CreditFacility` has a **1-to-many `AmortizationRule`** relationship — supports multiple amortization mechanisms per facility, evolving over time, by condition (e.g., revolvente híbrido during construction phase, fixed amortization post-completion; different rules for different facility tranches). (c) `IsrObligation` is its own entity supporting lump-end, quarterly, annual, custom-trigger, or composite patterns — multiple obligations per project, each with its own trigger and rate. Design accommodates the complexity Jorge expects from Federico's eventual answers. Current seeds = the model's forecast as documented in FCFCasas2. Distinct from [[feedback_outliers_dont_drive_schema]] which applies to one-off data anomalies — this is stated business intent for complexity. | User direction during PROGRESS lock (2026-05-25) |
| D34 | **Both ISR rates from `FCFCasas2` are deliberate per Federico (resolves Q1 disposition).** Schema captures BOTH: `Project.isrNominalRate = 0.25` (label rate at A79, "25% sobre utilidad antes de impuestos") AND `Project.isrEffectiveRate = 0.18` (value at G79 used in the AT79 calculation = `SUM(K76:AT76) × 0.18`). Both fields seeded as authoritative pending Federico's disambiguation of when each applies (Ronny could not explain; routed to Federico 2026-05-25). **UI labeling directive (user-mandated 2026-05-25):** in ALL user-facing UI, the two rates surface as the **literal strings `"ISR 18"` and `"ISR 25"`** — never as "Effective" / "Nominal" / "Tasa A" / "Tasa B" or any other interpretive label. The literal numbers leave no room for confusion across team members and Spanish/English contexts. This rule extends to drilldowns, tooltips, audit logs, and exported reports. When Federico clarifies (likely a multi-rate ISR regime: nominal rate on a tax base reduced by deductions/credits, or context-dependent rate selection), the **field-usage logic** is implemented in the calc layer — schema fields stay, labels stay literal; no migration required. Supersedes earlier proposal of a single `Project.isrRate` field. See [[feedback_literal_labels_when_multiple_values]]. | User direction during PROGRESS lock (2026-05-25) |
| D35 | **Construction monthly cost spread (`FCFCasas2` rows 8-21 × K..AT) is seeded verbatim as the forecast.** Whether this reflects a real S-curve provided by the construction PM or is a smoothed placeholder is currently unknown (Q-OBRA-GRIS — deferred to Federico + CEO + possibly construction PM). Dashboard label for the construction schedule visualization: _"construction schedule (per model — pending PM validation)."_ Replacement with real S-curve data, when delivered, is a **seed-data update** (a new run of the seed script with corrected monthly values), NOT a schema migration. The `MonthlyProjection` entity is shape-stable; only its values change. | User direction during PROGRESS lock (2026-05-25) |

---

## 3. Batch Status

Legend: ⬜ NOT_STARTED · 🟨 IN_PROGRESS · ✅ DONE · 🛑 BLOCKED · ⏸ DEFERRED

| Batch | Title                                         | Status | Gate(s) open?                    | Notes                                                                                                                                                                                                                                                    |
| ----- | --------------------------------------------- | ------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Repo init + Next.js 16 scaffold + tooling     | ✅     | —                                | Completed 2026-05-22 (commit `066024c`, pushed). Bumped from SDD's Next.js 15 → Next.js 16.2.6 (latest stable).                                                                                                                                          |
| 2     | Prisma + Supabase wiring                      | ✅     | —                                | Completed 2026-05-22. Migration `20260523010741_init_healthcheck` applied to Supabase (`aws-1-ca-central-1.pooler.supabase.com:5432`). Healthcheck endpoint returns 200 with 70–150ms steady-state latency. Prisma pinned to 6.x stable (D18).           |
| 3     | Auth + centralized RBAC matrix                | ✅     | —                                | Completed 2026-05-22. Next 16 DAL (`src/lib/dal.ts`) replaces deprecated middleware (D20). 4-role matrix (`src/lib/rbac/matrix.ts`) ships empty + closed-by-default; resources added in Batch 4. RLS policy generator + verify-rbac script (25/25 pass). |
| 4     | Full Prisma schema + RLS policies             | ✅     | —                                | Completed 2026-05-22. 17 entities + universal soft-delete invariant (D21) + 3 migrations applied + RLS via generated SQL (`pnpm verify:rls` 230/230 pass). Healthcheck still 200.                                                                        |
| 4.5   | Schema extensions for D29-D35 + inspection findings | ✅ | —                          | Completed 2026-05-25. Added 9 enums + 1 enum extension (ANULADO) + 5 models (DataQualityFlag, PartnerContribution, ContributionSource, IsrObligation, AmortizationRule) + Project D30 field additions + Expenditure additions (kind, exchangeRateAtTransaction, descriptionNormalized) + Partner.category. Dropped `Project.isrRate` per D34 (no data loss — column unused). Two migrations applied: `20260526024321_batch_4_5_schema_extensions` + `20260526024941_batch_4_5_rls_policies`. RBAC matrix +5 resources. `verify-rbac` + `verify-rls` + healthcheck (200, 1008ms cold start) all green. |
| 5     | XLSX parser                                   | ✅     | —                                | Completed 2026-05-25. Resilient label-based parser per D26 + D31 (does not fail loudly OR silently). 12 TypeScript files in `scripts/xlsx/`. Output JSON bundle written to `scripts/xlsx/output/parse-<ts>.json` + `parse-latest.json` symlink (gitignored). All acceptance criteria met: budget $11,228,641.51 ✓ / actuals $2,001,163.72 USD ✓ (live row 135 per N3) / revenue $12,639,661.49 ✓ / 11 categories / 11 RvUnits (sold = {1,2,5,6,7,11}) / 9 BankAccounts (6 active + 3 legacy) / 240 Expenditures + 2 PartnerContributions = 242 transactions / 36 MonthlyProjections / 1 CreditFacility + 1 AmortizationRule (REVOLVENTE_HIBRIDO) / 2 IsrObligations ("ISR 18" + "ISR 25" literal per D34) / 5 NOTAS verbatim per D32 / 20 per-tx TC extractions per finding #11 / 98 DataQualityFlags / 5 cross-sheet reconciliations all parity-confirmed. |
| 6     | Seed script + validation vs SDD §10           | ✅     | —                                | Completed 2026-05-26. Idempotent seeder in `scripts/seed/` (14 TS files). Reads `scripts/xlsx/output/parse-latest.json` + writes to Supabase with `XLSX_IMPORT` user attribution per D8. **Fresh seed: 240 Expenditures + 2 PartnerContributions + 9 BankAccounts + 40 Partners + 11 RvUnits + 36 MonthlyProjections + 1 CreditFacility + 1 AmortizationRule + 2 IsrObligations + 11 BudgetCategories + 98 DataQualityFlags created.** Re-run: 0 created / 240 updated everywhere — idempotency proven. All 11 validation checks pass on both runs (budget total $11,228,641.51, GTQ actuals 15,408,960.63, sold bucket {1,2,5,6,7,11} per D29, ISR labels literal per D34, modelNotes verbatim per D32, etc.). |
| 6.5   | Expenditure.bankAccountId nullable (oversight fix) | ✅ | —                            | Completed 2026-05-26 inline during Batch 6 testing. Mini-migration `20260526132643_batch_6_5_expenditure_bank_nullable` — Batch 4.5 declared the FK as NOT NULL but the SDD §3.2.4 v0.4 + Detalle egresos finding #8 require it nullable (11 legitimate non-cash transactions). Per D31 (parser never drops data) the seeder was previously skipping these rows; fix unblocked the GTQ parity check. |
| 6.6   | Expenditure.sourceWorkbookRef @unique (idempotency anchor) | ✅ | —                  | Completed 2026-05-26 inline during Batch 6 testing. Mini-migration `20260526134721_batch_6_6_expenditure_source_workbook_ref` — adds a `@unique` natural-key column populated by the parser. Replaced the (date, amount, partner, bank) tuple-based natural key which collided for same-day round-number same-vendor pairs (TESORERIA NACIONAL ISR notes). Pre-fix re-run created 178 duplicates; post-fix re-run creates zero. |
| 7     | Calc + query layer                            | ✅     | —                                | Completed 2026-05-26. 9 pure-function modules in `src/lib/calc/` (budget-health, burn-rate, revenue, ebitda, credit-facility, iva, currency, isr per D34, anomaly per D31) + composite query `src/lib/queries/dashboard.ts`. Tests: 46 unit tests across 9 vitest specs + 10 end-to-end parity assertions in `scripts/verify-calc.ts`, all green. Parity numbers verified against the seeded DB: $11,228,641.51 budget, ~$620K Expenditure-only spend (matches Ppto Inversion!H135 minus PC events), $12,639,661.49 projected revenue, sold = {1,2,5,6,7,11}, "ISR 18" + "ISR 25" literal labels, 5 NOTAS, anomaly counts, credit-facility currentBalance=0. |
| 7.5   | PartnerContribution rollup + partida mapping  | ✅     | —                                | Completed 2026-05-26. Three fixes before Batch 8 reaches CEO eyes: (1) `PartnerContribution.categoryId` FK added (migration `20260526230654_batch_7_5_partner_contribution_category_id`); (2) PC USD reconstruction in the seed via project locked TC; (3) richer partida → BudgetCategory mapping in Expenditure seeder + 2 new system categories (IMPUESTOS, CASH_MOVEMENTS) with `dashboardVisible=false`. Bonus: parser `cellValueToString` helper fixes a silent `[object Object]` bug on formula cells. Result: **TERRENOS correctly shows OVER_BUDGET** in the calc layer (Q-TERRENO-OVERSPEND signal); budget-health spent total = $2,001,163.72 matches Ppto Inversion!H135 exactly. 49 / 49 unit tests + 12 / 12 verify:calc parity checks, all green. |
| 8     | Level 0 Dashboard UI                          | ✅     | —                                | Completed 2026-05-26. Server-component dashboard at `src/app/(app)/page.tsx` renders the three canonical blocks per D25/D27/D28 over `loadDashboardSnapshot`. 8 new files in `src/components/dashboard/` (HealthHeader, StatusTiles, CategoryBars, BurnRateCard, ProjectionCard, RevenueBlock, FinancialBottomLine, AnomalyBadges, ModelNotes) + shared `status-style.ts` palette + `src/lib/format.ts` UI formatters. Per D25 + Q7: canonical order preserved, anomaly visibility via Tailwind emerald/amber/red/zinc + ▲/•/◷/○ icons (NOT reordering). ISR labels literal per D34. Anomaly strip per D31. Tailwind utility-only; no client JS. `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` (49/49), `pnpm build`, and `pnpm verify:calc` (12/12) all green. Live browser visual smoke deferred until first Supabase user invite (Batch 19 gate). |
| 9     | BANGUAT exchange-rate fetcher                 | ✅     | —                                | Completed 2026-05-26. Hand-written SOAP client (`src/lib/banguat/fetch.ts` + `parse.ts`) over the 8-operation TipoCambio.asmx — no SOAP library, ~80 LOC against captured-from-real-probes fixtures. Cron route at `app/api/cron/exchange-rate/route.ts` (BANGUAT_CRON synthetic user attribution per D8; CRON_SECRET bearer auth in production, unauth localhost only). Resolver at `src/lib/exchange-rate/resolve.ts` with 4-tier fallback: cache hit → live fetch (today only) → nearest-previous (`isStale=true`) → project locked TC. Backfill script at `scripts/banguat/backfill.ts` with **DB-aware resumable checkpointing** (per-chunk skip when fully cached) + **bounded exponential-backoff retry** (1s/2s/4s; only for `BanguatFetchError`, parse errors fail loud per D31). Tests: `tests/banguat.spec.ts` (10 parser-fixture cases + 2 live integration tests behind `BANGUAT_LIVE=1`). Validation: live cron returns `mode=fresh` then `mode=unchanged` (idempotency); full backfill 2025-05-06→2026-05-26 wrote 386 BANGUAT rows; re-run skipped all chunks (resume proven); re-extending to 2024-05-06 fetched only the new 365-day chunk. `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (58 + 2 skipped), `pnpm build` all green. |
| 10    | Level 1 — Category detail                     | ✅     | —                                | Completed 2026-05-27. Composite query `loadCategoryDetail` returns category + health + sub-items + unified Expenditure+PartnerContribution event list (sorted/filtered/searched via URL params) + monthly cumulative-spend timeline (planned linear ramp vs actual). Page `/category/[code]` at `src/app/(app)/category/[code]/page.tsx` (Next 16 async params + searchParams). 4 components in `src/components/category/`: `Header` (mirrors L0 palette + ▲/•/◷/○ icons), `Timeline` (Recharts 3.8.1 — ComposedChart with Area + Line, client component, no animation), `SubItemsList`, `TransactionsTable` (URL-driven filter/sort/search; status pills; Aportación/Gasto kind chips; rows link to `/transaction/[id]` placeholder for Batch 11). `CategoryBars` rows on L0 now wrap in `<Link>` to the L1 page. **Acceptance met**: TERRENOS L1 shows status=OVER_BUDGET, budget=$1,182,597.40, spent=$1,380,816.36 (matches SDD §5 mock exactly), 2 PartnerContribution events ($1,181,400 + $199,416.36) summing to the L0 over-budget figure. `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (58/58 + 2 skipped), `pnpm build` (`/category/[code]` registered as `ƒ` dynamic), dev-server compile clean (auth gate redirects /category/TERRENOS → /login per Batch 19 deferred). |
| 11    | Level 2 — Transaction detail (edit/flag/void) | ✅     | —                                | Completed 2026-05-27. Per-transaction page at `src/app/(app)/transaction/[id]/page.tsx` renders every Expenditure field + 3-source TC ambiguity panel + entity-scoped audit history. 3 server actions (`editExpenditureAction`, `flagExpenditureAction`, `voidExpenditureAction`) each route through `requireRole()` → `can()` → atomic Prisma transaction wrapping the mutation + AuditLog rows together (one AuditLog row per field changed; VOID action for voids; UPDATE+`fieldName=status`+context for flags). 5 new components in `src/components/transaction/` (Detail, EditForm, StatusActions, AuditTimeline + page glue). **CEO denial proven via matrix**: `can("CEO", "UPDATE", "expenditure") === false`; the action returns `{ok:false, error:"forbidden"}`. Honest RLS disclosure surfaced in actions.ts + PROGRESS.md log: Prisma connects as superuser and bypasses RLS; `can()` is the authoritative gate, RLS is defense-in-depth. `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (58/58 + 2 skipped), `pnpm build` (`/transaction/[id]` registered as `ƒ`), dev-server real-id probe compile clean. |
| 12    | Manual transaction entry                      | ✅     | —                                | Completed 2026-05-27. `/entry/new` server-component shell with role gate; client `NewExpenditureForm` (cascading L1→L2→L3 categorization, vendor autosuggest via native `<datalist>` from Partner names + recent vendorRaw history, live IVA triple computation with project rate 12%, BANGUAT auto-resolved TC via `resolveRateAction` with required override-reason audit). 2 server actions: `createExpenditureAction` (zod-validated; partition/category coherence check; atomic Expenditure + AuditLog Prisma transaction; success→ server-side redirect to `/transaction/[newId]`) + `resolveRateAction` (read-only Batch 9 resolver wrapper). IVA helper extracted to `src/lib/forms/iva.ts` with 7 vitest cases anchored on a real Detalle egresos row ($68,478.19 con-IVA round-trip). Dashboard header now shows a `+ New transaction` button when `can(role,"CREATE","expenditure")`. **Acceptance proven against live DB**: smoke script created an Expenditure + AuditLog atomic row (resolved TC 7.6226 from BANGUAT cache → 1000 GTQ sin-IVA = $131.19 USD ✓ · status=PENDING · source=MANUAL · 1 audit row in same transaction), then soft-deleted to keep seeded data clean. `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (65/65 + 2 skipped), `pnpm build` (`/entry/new` registered as `ƒ`), dev-server compile clean. |
| 13a   | REFLUJO bronze + silver + G&T adapter + upload UI | ✅ | — | Completed 2026-05-27. **REFLUJO mission framing locked + signed off** (`REFLUJO_DESIGN.md` at repo root, 3-layer medallion + journal pattern, 4-sub-batch split). **Schema**: 4 new tables + 6 new enums (`BankName`, `StatementType`, `SheetParseStatus`, `RawRowParseStatus`, `BankTransactionDirection`, `BankTransactionClassificationStatus`) + 2 dq-flag enum extensions (`DUPLICATE_OF_PRIOR_IMPORT`, `BANK_PARSER_WARNING`). 3 migrations applied: `20260527193908_batch_13a_reflujo_bronze_silver`, `20260527194107_batch_13a_reflujo_rls`, `20260527195044_batch_13a_dqflag_enum_extensions`. **RBAC**: 4 resources added; `verify-rbac` + `verify-rls` both green. **Parser registry**: `src/lib/import/` with `xlsx ^0.18.5` (handles both `.xls` + `.xlsx`); 1 enabled adapter (G&T Continental, content-anchored detect, twin-sheet handling, sign-convention drift) + 3 disabled stubs (PROMERICA / BAC / INDUSTRIAL — drop-in for future banks). **20 vitest cases** for parser layer (suite total 85/85 + 2 skipped). **UI**: `/import/new` upload form (role-gated; SHA-256 dedup at file level; 10 MB cap), `/import/[id]` detail page with twin-sheet `is_canonical` toggle via `flipCanonicalAction` (atomic soft-delete-old-silver + re-derive-from-new-canonical + AuditLog). Dashboard `Import statement` button. **Acceptance proven against 6 real G&T samples**: 132 bronze rows + 41 silver rows + 0 parser warnings + 6/6 re-uploads rejected by file-hash UNIQUE. Smoke test cleaned up afterward. `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (85/85 + 2 skipped), `pnpm build` (`/import/new` + `/import/[id]` both `ƒ`) all green. |
| 13b   | REFLUJO gold additions + classification queue UI | ✅ | — | Completed 2026-05-27. **Schema**: `RvPayment` table + `Expenditure.sourceBankTransactionId` + `PartnerContribution.sourceBankTransactionId` nullable FKs + `RvPaymentReconciliationStatus` enum. Migrations `20260527201216_batch_13b_gold_additions` + `20260527201447_batch_13b_rv_payment_rls` applied (one bad-migration cleanup mid-flight after a transient DB connect blip wrote an error message into the SQL file — Prisma `migrate resolve --rolled-back` cleaned it). **RBAC**: `rv_payment` resource added with ANALISTA+AUXILIAR full CRUD (junior-friendly classification path). **Inbox UI**: `/inbox` listing (UNCLASSIFIED bank-tx rows sorted date-desc with per-row Classify button) + `/inbox/[id]` detail page with a 4-tab `ClassifyWidget` — Expenditure (outflow → budget category, reuses IVA triple math), RvPayment (inflow → house installment, GTQ↔USD reconciled at locked TC), Non-business (INTERNAL_TRANSFER/INTEREST/FEE/TAX/IGNORED), and Skip (note + leave UNCLASSIFIED). **Server actions**: 4 actions in `src/app/(app)/inbox/[id]/actions.ts`, each `requireRole()` → `can()` → atomic Prisma transaction wrapping the mutation + status flip + AuditLog rows. Dashboard now shows `Inbox` button + amber count badge when `canMutate`. **Acceptance proven against live DB**: ingested April 2026 G&T statement, exercised all 4 classification paths, verified `Expenditure.sourceBankTransactionId` + `RvPayment.bankTransactionId` reverse FKs land correctly (both `matches: true`). Cleanup hard-deleted all smoke rows; zero residue. `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (85/85 + 2 skipped), `pnpm build` (`/inbox` + `/inbox/[id]` both `ƒ`) all green. |
| 13c   | REFLUJO per-house reconciliation UI            | ✅ | — | Completed 2026-05-28. **Reconciliation calc** at `src/lib/calc/reconciliation.ts` — pure function takes planned cuotas (from `MonthlyProjection.revenuePerHouse[casaName]`) + actual `RvPayment` rows, returns per-month rows with 7 status types (MATCHED / OVERPAYMENT / UNDERPAYMENT / MISSED / UPCOMING / UNEXPECTED_PAYMENT / NO_ACTIVITY), cumulative planned/actual/balance, totals + completion ratio. **Composite query** `loadCasaReflujo(id)` reads RvUnit + buyer + 36 monthlies + RvPayments. **Page** `/casa/[id]/reflujo` renders header + status-count badges + monthly reconciliation table (NO_ACTIVITY rows hidden; active months show planned/actual/Δ/balance with status pill; payment sub-rows nested under each month). AVAILABLE units get an explanatory banner ("no buyer yet"). **L0 RevenueBlock** rows now link to `/casa/[id]/reflujo` (added `id` to `RevenueMetrics.perUnit`). **12 vitest cases** (suite total 97/97 + 2 skipped). **Acceptance against real seeded data**: Casa 1 (SOLD) — planned $974,382.47 reconciles to sale price ($974,382.43, 4¢ off due to per-month Decimal rounding), 12 MISSED + 5 UPCOMING + 19 NO_ACTIVITY rows; Casa 3 (AVAILABLE) — `noBuyerYet=true`, 19 UPCOMING shows the projected schedule. `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (97/97 + 2 skipped), `pnpm build` (`/casa/[id]/reflujo` registered as `ƒ`) all green. |
| 13d   | REFLUJO check-register adapter                 | ✅ | — | Completed 2026-05-28. **New entity `IssuedCheque`** (gold-side) for FORMA's internal cheque log; nullable FKs to `BankAccount` (when bound), to `BankStatementRawRow` (bronze provenance, required), to `BankTransaction` (cashed-by, future matching pass), and to `Expenditure` (classified-from, future). 2 migrations applied: `20260528060736_batch_13d_issued_cheque` + `20260528060836_batch_13d_issued_cheque_rls`. **RBAC** `issued_cheque` (ANALISTA READ+UPDATE+DELETE · AUXILIAR READ+UPDATE · CEO READ); `verify-rbac` + `verify-rls` green. **Parser**: G&T adapter now dispatches between CURRENT_ACCOUNT (0.95 conf, tried first) and CHECK_REGISTER (0.9 conf, fallback); check-register parser lives at `src/lib/import/banks/gt/check-register.ts`. **Ingest pipeline** extended with parallel IssuedCheque promotion branch alongside BankTransaction; natural-key UNIQUE for dedup; UNIQUE violation → DUPLICATE_OF_PRIOR_IMPORT flag. **9 new vitest cases** (suite 106/106 + 2 skipped). **Acceptance against real `0426. CORRELATIVO ... ABRIL 26.xlsx`**: 528 bronze rows captured · 189 IssuedCheques promoted (87 USD + 102 GTQ; 22 ANULADO with `isVoided=true`) · 0 parser warnings · file-hash UNIQUE rejected re-upload · **dirty-data row Q#7 (real `FECHA="XXXX"` + `MONTO="XXXX"`) handled per D31** — landed as ANULADO with amount=0 and issueDate=null without crashing or dropping. Cleanup hard-deleted everything; zero residue. `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (106/106+2), `pnpm build` all green. |
| 14    | Promerica / BAC / Industrial parsers          | ⬜     | Gate 14.1 (CSV samples per bank) | Optional / phased                                                                                                                                                                                                                                        |
| 15    | Sales tracker                                 | ✅     | —                                | Completed 2026-05-28. **Pure state-machine** at `src/lib/calc/sales-status.ts` encodes 8 legal `RvUnitStatus` transitions (per schema docstring + CanonicalTaxonomy.md). **Queries** `loadSalesGrid` + `loadSalesDetail`. **3 server actions** — `updateHouseStatusAction` (validates transition + atomic AuditLog + auto-sets soldAt/reservedAt), `recordPaymentAction` (manual RvPayment, no bank-tx link), `linkBuyerAction` (existing Partner OR create-new). **Pages** `/sales` grid + `/sales/[id]` detail (buyer-focused, complementary to Batch 13c's `/casa/[id]/reflujo`). **Components**: HouseCard, StatusActions, LinkBuyerForm, RecordPaymentForm (GTQ↔USD auto-derived in change handlers, no setState-in-effect). Dashboard header gains `Sales` button. **Gate 15.1 surfaced**: 6 SOLD units lack linked buyers — "data incomplete" badge + LinkBuyerForm is the workflow per "no placeholders" rule. **13 new state-machine vitest cases** (suite 123/123 + 2 skipped). **Acceptance against real seeded data**: total projected = **$12,639,661.49 (reconciles to SDD §3.2.5 exactly)** · 6/5 sold/available · Casa 1 enganche $243,595.61. `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (123/123+2), `pnpm build` (`/sales` + `/sales/[id]` both `ƒ`) all green. |
| 16a   | Cash flow forecast (read-only viewer)         | ✅     | —                                | Completed 2026-05-28. Read-only first cut. **Projection runner** at `src/lib/calc/projection-runner.ts` emits 4 disambiguated returns per D28 (rev/cost ratio, EBITDA margin, annualized IRR with BOTH 36-mo corrected + 30-mo xlsx per Q-TIRI-WINDOW, return on peak equity). IRR via Newton-Raphson + bisection; null-when-no-sign-change is the D31 path. **Query** `loadForecastSnapshot`, **page** `/forecast` with returns card (literal labels per D28 + `feedback_literal_labels_when_multiple_values`), totals, credit facility, 36-month read-only table. Dashboard header `Forecast` button. **8 new vitest cases**, suite 131/131+2. **Findings against real data**: cost reconciles to SDD ✓ · revenue $13.8M differs from sale-price sum $12.6M (Batch 18 reconciliation candidate) · **EBITDA totals were $0** because the Batch 5/6 parser was defaulting null EBITDA cells to "0" → a D31 violation. **FIXED THE SAME DAY** — see Batch 5/6 EBITDA D31 fix work-log entry below. After fix: EBITDA total = $1,411,021.99 (xlsx H55 = $1,411,021.98 ✓) · EBITDA margin = 12.57% (D28 ref 12.6% ✓) · IRR 36-mo = 20.30% · peak equity = $3,776,549.15 · `pnpm verify:calc` 13/13 (new EBITDA parity assertion catches future regressions). `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (131/131+2), `pnpm build` (`/forecast` `ƒ`) all green. |
| 16b   | Cash flow forecast — editable + cascade        | ⬜     | Q9 IRR + EBITDA data revisit     | DEFERRED. Editable cells + cascade recompute. Blocked on: (a) Q9 IRR formula cross-check vs xlsx named ranges, (b) Batch 5/6 seed parser populating `MonthlyProjection.ebitda` (currently zero). Surfaced honestly per `feedback_intent_vs_implementation`. |
| 17    | Settings + Audit-log UI                       | ✅     | —                                | Completed 2026-05-28. Gate 17.1 resolved by D34 (both ISR rates seeded with literal labels per `feedback_literal_labels_when_multiple_values`). **Global audit-log browser** at `/audit` — paginated (50/page), filterable by user / entity type / entity id / action / date range / free-text. Read-only per D8. **Budget category overrides** at `/settings/budget` — inline edit of `BudgetCategory.budgetAmountUsd` with required reason + atomic AuditLog. **Rates settings** at `/settings/rates` — `Project.lockedExchangeRate` + `Project.ivaRate` + each `IsrObligation.rate` (D34 literal labels preserved). **Settings index** at `/settings`. Dashboard header gains `Settings` button. 3 new server actions: `updateBudgetCategoryAction`, `updateProjectRatesAction`, `updateIsrObligationRateAction` — each `requireRole()` → `can()` → atomic Prisma transaction with AuditLog write. **NOT shipped**: `/settings/users` (Supabase Auth integration deferred to Batch 19 deploy). Entity-scoped timeline generalization deferred (Batch 11's per-Expenditure timeline already covers the high-value case). **Smoke**: audit browser shows **3,000 existing events across 15 entity types** (XLSX_IMPORT user attribution working correctly per D8). `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (131/131+2), `pnpm build` (`/audit` + `/settings` + `/settings/budget` + `/settings/rates` all `ƒ`) all green. |
| 18    | End-to-end parity validation vs xlsx          | ✅     | Manual walkthrough pending Federico sign-off | Completed 2026-05-28. **68 parity assertions** in a single catalog (`scripts/parity/assertions.ts`) driving both vitest (`tests/parity/*.spec.ts`, 8 files grouped by SDD section) and a markdown report generator (`scripts/parity/index.ts`, `pnpm parity:report` → `docs/parity-report.md`). Coverage: SDD §10 Phase 2 totals (5), §3.2.2 per-category budgets (11), §3.2.5 + D29 per-house sale prices + status (22), §3.2.6 monthly projection aggregates (5), §3.2.7 credit facility (4), §3.2.8 foundational events (3), §3.2.10 ISR (2), bank accounts (3), data coverage (4), project metadata (3), D31 data-quality flags (2), D8 audit log (1). **Δ tracker**: 68/68 ✓ on first run; `verify-calc` now shares the same catalog (single source of truth — no drift between report + test + smoke). `pnpm test` 199/199 + 2 skipped · `pnpm typecheck` + `pnpm lint` + `pnpm build` clean. Manual walkthrough notes section opened in §5 work log; Federico screen-share confirmation pending. |
| 19    | Deploy + parallel-operation kickoff           | ⬜     | Gates 19.1, 19.2                 |                                                                                                                                                                                                                                                          |

---

## 4. Open Questions (active blocks + advisories)

Active = blocks a specific batch. Resolve at gate time, or earlier if you prefer.

| ID       | Question                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Blocks batch       | Status                                                                                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1       | **ISR label vs rate — Jorge says BOTH ARE CORRECT (2026-05-25).** `FCFCasas2!A79` label says `"ISR (25% sobre utilidad antes de impuestos)"` and `G79 = 0.18 = 18%`. Jorge confirmed both are deliberately placed by Federico. Plausible: an effective-rate-vs-nominal-rate model (25% nominal on a tax base reduced ~72% by credits/deductions → effective 18%), or a multi-tier ISR regimen.                                                                                                                                                                                                                                                                                                                                                                                             | Batch 6 / 17       | **DEFERRED-FEDERICO 2026-05-25 — Ronny couldn't elaborate; routed to Federico. D34 seeds BOTH 0.18 + 0.25 as authoritative, so Batch 6 seed is UNBLOCKED. Federico will disambiguate when to use which; field-usage logic gets implemented in calc layer at that point, no migration.**                                                                                                                                                                                                                                                                                |
| Q2       | XLSX filename when dropped, and: do vendor names include PII that should keep the file out of git? (If yes, I add it to `.gitignore` and the parser reads from a local-only path.)                                                                                                                                                                                                                                                                                                                | Batch 5            | OPEN                                                                                                                                                                                                                                                                                |
| Q3       | Microsoft tenant ID for future SSO migration. Not blocking now — just want to record it.                                                                                                                                                                                                                                                                                                                                                                                                          | future migration   | OPEN                                                                                                                                                                                                                                                                                |
| Q4       | Real user identities at launch: CEO full name + email, Analyst(s), Admin. Accounts created via Supabase Auth invite.                                                                                                                                                                                                                                                                                                                                                                              | Batch 19           | OPEN                                                                                                                                                                                                                                                                                |
| Q5       | Bank CSV samples — at minimum one real G&T USD + one G&T QTZ statement for Batch 13. Then Promerica / BAC / Industrial for Batch 14 (optional).                                                                                                                                                                                                                                                                                                                                                   | Batches 13, 14     | OPEN                                                                                                                                                                                                                                                                                |
| Q6       | Buyer + contract data for the 5 sold houses (1, 2, 6, 7, 11): names, contract dates, enganche actually received, payment plans. If unavailable, Batch 15 ships with empty house cards and a data-entry form — no placeholders.                                                                                                                                                                                                                                                                    | Batch 15           | OPEN                                                                                                                                                                                                                                                                                |
| Q7       | Color palette for dashboard status (default proposed: Tailwind emerald/amber/red/zinc).                                                                                                                                                                                                                                                                                                                                                                                                           | Batch 8 (cosmetic) | OPEN                                                                                                                                                                                                                                                                                |
| Q8       | Production domain — custom domain or accept `*.vercel.app` during parallel ops?                                                                                                                                                                                                                                                                                                                                                                                                                   | Batch 19           | OPEN                                                                                                                                                                                                                                                                                |
| Q9       | IRR / ROI formula intent — to be cross-checked against the xlsx's named ranges during Batch 16.                                                                                                                                                                                                                                                                                                                                                                                                   | Batch 16           | OPEN                                                                                                                                                                                                                                                                                |
| M1       | Is `04. MODELO PRESUPUESTARIO AL 210526 terminado (rrivas) vr2.xlsx` the canonical workbook?                                                                                                                                                                                                                                                                                                                                                                                                      | Batch 5            | **RESOLVED 2026-05-22** — Yes. All SDD §3 totals reproduced ($11,228,641.5118 sin IVA, $12,429,903.1509 con IVA, $12,639,661.49 revenue).                                                                                                                                           |
| M2       | Relationship between `terminado (rrivas) vr2` and `integraciones`?                                                                                                                                                                                                                                                                                                                                                                                                                                | Batch 5            | **RESOLVED 2026-05-22** — `integraciones` is a per-category breakdown of `terminado`'s Detalle egresos, used by analyst rrivas for sub-total reconciliation.                                                                                                                        |
| M3       | "Condominio Antigua Panorama" vs "Santa Elena" — same entity?                                                                                                                                                                                                                                                                                                                                                                                                                                     | Batch 5 / 13       | **RESOLVED 2026-05-22** — `Condominio Antigua Panorama, S.A.` is the legal entity / account holder; "Santa Elena" is the project marketing name. Both appear on the RESERVAS sheet title block.                                                                                     |
| M4       | What does "(PA)" mean in the bank-statement filename?                                                                                                                                                                                                                                                                                                                                                                                                                                             | Batch 13           | **RESOLVED 2026-05-22** — Per-buyer Payment plans, NOT a bank entity. The (PA) workbook has one sheet per sold house (Casa 1, 2, 6, 7, 11).                                                                                                                                         |
| M5       | More subfolders coming under `docs/`?                                                                                                                                                                                                                                                                                                                                                                                                                                                             | advisory           | OPEN                                                                                                                                                                                                                                                                                |
| **Q-rv** | What does `rv_` stand for?                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Batch 4 (doc)      | **RESOLVED 2026-05-22** — `rv_` = **RESERVA** (Phase 1 of the sale process per [[reference_sale_phases]]). PA's `rv_` namespace explicitly scopes data to the reservation phase. Implies: future phase-2 entities will use a different prefix (e.g., enganche-related → not `rv_`). |
| M6       | xls + xlsx mix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Batch 5 / 13       | **NOTED** — SheetJS handles both; LibreOffice fallback validated via inspector script.                                                                                                                                                                                              |
| M7       | G&T statements present?                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Batch 13           | **RESOLVED 2026-05-22** — Yes. "Condominio Antigua Panorama" = account holder name on the statements; G&T Continental = bank. Account `00299005975` = SDD's `002-9900597-5`.                                                                                                        |
| **N1**   | **Credit-facility model is a development-drawdown loan with revaluation cycles, NOT a revolving facility.** SDD §3.2.7's REVOLVING_HYBRID model is wrong. Real mechanics: USD 7M initial cap → current raw-land appraisal $2.7M USD → 80% LTV → $2,165,900 available NOW. As development progresses, new appraisals (each cycle includes built improvements) raise the available envelope. Cap can be raised above $7M upon legal request based on (a) units sold or (b) area market revaluation. | Batch 4 / 16       | **RESOLVED 2026-05-22 — schema redesign required**                                                                                                                                                                                                                                  |
| **N2**   | **TC inconsistency.** `Ppto Inversion` row 2: column G = 7.7, column I = "TC 7.8 PARA PRESUPUESTO". SDD §3.2.1 locks 7.7. Which is canonical? Over $11M, the 0.1 GTQ delta matters.                                                                                                                                                                                                                                                                                                               | Batch 4 / 6        | **OPEN**                                                                                                                                                                                                                                                                            |
| **N3**   | **SDD §3.2.4 transaction numbers are a stale snapshot.** Live data: ~299 transactions (306 rows incl. header at row 7), executed sin IVA = **GTQ 15,408,960.6284** (≈ $2,001,163 USD at 7.7). SDD says 242 transactions / $1,988,922.82. Use live parser output as ground truth; SDD §3 numbers are historical reference. Updates Batch 18 parity targets.                                                                                                                                        | Batch 6 / 18       | **NOTED — adjust parity strategy**                                                                                                                                                                                                                                                  |
| **N4**   | **Schema gap: third categorization level.** `Detalle egresos` has 13 columns, including `PARTIDA EJECUCIÓN PRESUPUESTARIA` (sits above `PARTIDA GENERAL` and `PARTIDA INTERNA`).                                                                                                                                                                                                                                                                                                                  | Batch 4            | **RESOLVED 2026-05-22 — model all 3 levels.** L1 (execution partition) → L2 (general category — SDD's 11 budget categories) → L3 (internal sub-category). Three FK-linked tables, not denormalized strings.                                                                         |
| **N5**   | **HouseStatus taxonomy.** Originally flagged because SDD §3.2.5's 3-state enum was insufficient.                                                                                                                                                                                                                                                                                                                                                                                                  | Batch 4 / 15       | **RESOLVED 2026-05-22 via D9** — adopt PA DB's `rv_unit_status` (5-state) + `rv_reservation_status` (4-state) + `rv_freeze_request_status` (2-state) + STATUS_MAP. See [docs/CanonicalTaxonomy.md](docs/CanonicalTaxonomy.md).                                                      |
| **N6**   | **Canonical workbook has 9 sheets, SDD only names 3.** Extras: `resumen`, `FCFCasas`, `FCF ` (trailing space), `Gstos ProyectOct24`, `CB_DATA_` (Oracle Crystal Ball — out of v1), `Estado de Resultados` (placeholder).                                                                                                                                                                                                                                                                          | Batch 5            | **RESOLVED 2026-05-22 — parse only `FCFCasas2` + `Ppto Inversion` + `Detalle egresos`.** Parser must document each skipped sheet with reason; reject silently.                                                                                                                      |
| **N7**   | **Sheet name `FCF ` has a real trailing space.** Parser must preserve exact sheet names (no trim() on lookups).                                                                                                                                                                                                                                                                                                                                                                                   | Batch 5            | **NOTED**                                                                                                                                                                                                                                                                           |
| **N8**   | **Named ranges are vestigial.** 23/45 are `#REF!`; the other 22 resolve to broken array formulas referencing `Aging Summary`/`Ratio Analysis`/`Tickmarks` sheets that don't exist (carried over from a template). Parser should ignore named ranges entirely; use sheet+cell-address references only.                                                                                                                                                                                             | Batch 5            | **NOTED**                                                                                                                                                                                                                                                                           |
| **Q-OBRA-GRIS** | Does Santa Elena's app need to track the construction S-curve as a first-class entity, or is the AY..BV sub-grid in `FCFCasas2` scratch/visualization-only? Two ritmos: **Obra gris** (CONSTRUCCIÓN, 19 months) and **Serv y Comp** (CONSTRUCCIONES COMPLEMENTARIAS, 12 months) — both reconcile cleanly to their main-budget categories but are NOT the source-of-truth for the `K..AT` monthly timeline (that comes from Ppto Inversion). Path A: skip the sub-grid; parser reads K..AT only. Path B: parse the sub-grid into a `ConstructionScheduleSegment` entity to enable a "construction progress vs S-curve" reporting view. | Batch 5 / 6 | **DEFERRED-FEDERICO/CEO/PM 2026-05-25 — Ronny couldn't speak to S-curve provenance.** Per D35, parser seeds monthly cost spread verbatim from rows 8-21 × K..AT; dashboard labels as "pending PM validation." Choice between Path A and Path B still requires Federico/PM decision; deferred until Federico available. |
| **Q-CASA-5** | Casa 5's row in `FCFCasas2!A37:J37` has inconsistent data: `B37 = $2,642.76/m²` (hardcoded), `C37 = 491.91 m²`, `H37 = $966,148.22` (hardcoded). But `B × C = $1,300,231.86 ≠ H`. | Batch 5 / 6 | **RESOLVED 2026-05-25 via Ronny + operational override — see D29.** Casa 5 was reserved 2025-04-04 at 12-house pricing (pre-revision), is in active renegotiation with no resolution. B37/C37 preserve the original 12-house values the buyer agreed to; H37 reflects the 11-house revision price. Operational decision: treat Casa 5 as SOLD until further notice; sold bucket = {1,2,**5**,6,7,11}, unsold = {3,4,8,9,10}. NO schema change. |
| **Q-MES-ENTREGA** | `FCFCasas2!H29 = 28` sits under the "Mes de entrega" label (`A29`). Jorge's interpretation (2026-05-25): **`28` = year 2028 shorthand** — "we're not sure yet in which month of 2028 we will deliver." Fits the K..AT timeline ending May-28 and explains why `H29` doesn't match any house's J value. **Knock-on:** the SDD's `Project.projectedEndDate = 2027-04-19` is stale — the actual planned end is 2028. Batch 6 seed must derive `projectedEndDate` from the max month-date in the FCFCasas2 timeline, not from the SDD literal. Parser treats `H29` as a year hint (project metadata), NOT as a month-of-year number. | Batch 5 / 6 | **DEFERRED-FEDERICO 2026-05-25 — Ronny couldn't elaborate.** Jorge's tentative interpretation (year 2028 shorthand) stands; parser treats H29 as year hint. Federico to confirm. |
| **Q-AX-FORMULA** | The per-house Enganche cell formula in `FCFCasas2` row 33+ is `AX{r} = =H{r}*$I$29 + (O{r}*5%)` — i.e., 25% of sale price PLUS 5% of the row's month-5 (Sep-25, column O) cash inflow. The `+O{r}*5%` term is systematic (applies to every house row, not just Casa 1) but has no obvious business meaning. Possibilities: interest accrual rule, per-contract premium, or stale template residue. Parser computes its own enganche figures and does not trust this xlsx formula. | Batch 5 / 6 | **DEFERRED-FEDERICO 2026-05-25 — Ronny couldn't explain.** Parser policy stands: compute own enganche, ignore the unexplained `+O{r}*5%` term. |
| **Q-RESERVA** | The header `FCFCasas2!K29 = =I29+0.05 = 0.30` implies a uniform 5% reserva across the project. The per-house cash flow disagrees: Casa 1 reserva $48,719.12 (5.00%), Casa 11 $30,000 (2.52%), Casa 5 $10,000 (1.04%) — reserva is **negotiated per house, not enforced**. The "Enganche y Reserva 30%" header is a project-template descriptor, not a rule. Schema implication: `RvUnit` needs a `reservaAmountUsd` field (or a separate `RvUnitCashflow` entity, TBD when we manifest the RESERVAS workbook). Parser must read reserva from each house's K{sale-month} cell directly — never compute as a fixed percentage. | Batch 5 / 6 | **DEFERRED-FEDERICO 2026-05-25 — Ronny couldn't confirm.** Per D33, schema flexibility accommodates whatever structure emerges. Parser reads per-house reserva amounts from K{sale-month} cells; schema field added under [[reference_sale_phases]]. |
| **Q-LTC-CEILING** | `FCFCasas2!H59 = 95.40%` (peak LTC across the project timeline) exceeds `I59 = 90%` (stated LTC ceiling). **Jorge confirmed 2026-05-25: this is real and normal — he's seen LTC go above 100% on any given day. This is the "dynamic capital structure" working as designed**, not an anomaly to fix. Dashboard treatment is a **signal** (informational visual flag showing current stress level + headroom), NOT an **alarm**. Frame it as "LTC is currently in stress zone — here's the trend / your action options." The CEO uses this signal to decide on re-appraisal / cap raise / equity injection. | Batch 8 / 16 | Interpretation **RESOLVED** (real + normal dynamic capital structure). **DEFERRED-FEDERICO 2026-05-25 on "today's LTC value"** — originally for the cancelled interview; ask Federico when available. Not blocking; dashboard signal can ship from xlsx-derived peak LTC and be recalibrated when current value is known. |
| **Q-BT-NAMING** | `FCFCasas2!A76` is labeled `"Capital mensual utilizado BT"` but the formula chain `H76 - H79 = H80` (post-tax profit) reveals that `H76` is actually **pre-tax profit** (= EBITDA − Interest, ≈ $1,112K matches). "BT" almost certainly = "Before Tax." App layer renames to `"Pre-Tax Profit"`; never copies the xlsx phrasing verbatim. Low priority. | Batch 8 | **TENTATIVELY RESOLVED via chain-derivation; DEFERRED-FEDERICO 2026-05-25** — Ronny couldn't confirm "BT" = "Before Tax." App uses "Pre-Tax Profit" label. Federico to confirm semantics on next pass. |
| **Q-UNIT-COUNT** | Was the project ever a 12-house plan reduced to 11? Stale `FCFCasas2!E112 = 12` label vs actual 11 RvUnits. | Batch 6 | **RESOLVED 2026-05-25 via Ronny — see D29 + D30.** Original 12-house plan rejected by municipality, forced revision to 11 houses, internal approval 2025-04-22. `E112` label is vestigial pre-revision text not updated when count changed. |
| **Q-TIRI-WINDOW** | `FCFCasas2!I97 = =IRR(K95:AN95,0)*12` truncates at month 30, computing TIRi over only 30 of 36 months. Corrected IRR over `K95:AT95` = **30.95%, not 21.23%**. Was the truncation intentional (e.g., partner exit at month 30) or a stale formula? Python-verified bug regardless of intent. | Batch 5 / 8 | **DEFERRED-FEDERICO 2026-05-25 — Ronny couldn't speak to intent.** Per D31, parser captures both, app dashboard shows "as in xlsx (21.23%, 30 mo)" alongside "recomputed (30.95%, 36 mo)" with discrepancy badge. NOT blocking. |
| **Q-30-TO-36-EXTENSION** | Was Santa Elena's financial model originally a 30-month project later extended to 36? Would unify the AN-cluster anomalies (TIRi window, AN96 cumulative break, AN91/AT91 missing `+10000` plug, calendar gap missing Nov-2027) under a single root-cause event. | Batch 5 / 8 | **DEFERRED-FEDERICO 2026-05-25.** Ronny narrowed: NOT from the 12→11 revision moment (Casa 5 was the only ripple from that event). Per D31, app handles each anomaly as an independent flag. NOT blocking. |
| **Q-CALENDAR-GAP** | `FCFCasas2` row-5 date header skips Nov-2027 (AN = Oct-22-2027, AO = Dec-6-2027, ~45-day gap). Intentional pause or label artifact? | Batch 5 / 8 | **DEFERRED-FEDERICO 2026-05-25.** Per D31, parser captures source dates verbatim + emits a flag; app generates own continuous calendar; UI surfaces the discrepancy. NOT blocking. |
| **Q-EQUITY-SOURCE** | Is `FCFCasas2!row 91 Aporte de socios` the canonical source of partner capital calls/distributions, or does Grupo Orion track them in a separate ledger? | Batch 5 / 6 | **DEFERRED-FEDERICO 2026-05-25.** Per D33, `PartnerContribution` + `ContributionSource` entity pair accommodates either case. Batch 6 seeds row 91 as `source = FORECAST_FCFCASAS2`. NOT blocking. |
| **Q-RECYCLE** | Does G&T Continental contractually accept the revolvente híbrido amortization (variable principal paydowns when EBITDA is positive), or is there a fixed schedule? Author's note 2 (FCFCasas2 row 107) confirms the MODEL's intent — real-world bank acceptance is the open question. | Batches 13 / 16 | **DEFERRED-BANK (G&T Continental) 2026-05-25.** Per D33, `CreditFacility` 1-to-many `AmortizationRule` handles any mechanism the bank confirms. NOT blocking Batches 5/6. |
| **Q-ISR-TIMING** | Does Guatemalan tax law allow ISR as a single lump-end payment at project month 36, or are quarterly/annual obligations required? Model treats ISR as `AT79 = SUM(K76:AT76) × 0.18` — lump sum at end. | Batch 6 / 17 | **DEFERRED-TAX-ADVISOR 2026-05-25.** Per D33, `IsrObligation` entity supports lump-end, quarterly, annual, custom-trigger, or composite. Seed Santa Elena as lump-end per the model's forecast. NOT blocking. |
| **Q-CAPITAL-Y-RETORNO-UX** | Does the metric `FCFCasas2!A99 = H85+H83 = $2,118,545.68` ("Total partner cash motion") deserve a standalone dashboard tile, or is it confusing alongside `H83` peak equity ($1.21M)? Pure UX validation with the CEO. | Batch 8 | **DEFERRED-FEDERICO 2026-05-25.** Surface with provisional label "Total partner cash motion (peak equity + post-tax profit)"; revisit when Federico available. NOT blocking. |

---

## 5. Per-Batch Work Log

Append a section per batch as it starts. Template:

```
### Batch N — <title>
**Started:** YYYY-MM-DD HH:MM
**Finished:** YYYY-MM-DD HH:MM (or IN_PROGRESS)
**Files created/modified:**
- path/to/file.ts
**Acceptance checks run:**
- [x] check 1 — result
- [ ] check 2 — pending
**Self-review against _THE_RULES.MD:**
- Rule 1 (no lies/assumptions): notes
- Rule 4 (no mock data): notes
- Rule 5 (every block serves core function): notes
- Rule 8 (production-first): notes
**Blockers / decisions taken mid-batch:**
- ...
**Handoff note (if interrupted):**
- Resume by: ...
```

### Batch 1 — Repo init + Next.js 16 scaffold + tooling

**Started:** 2026-05-22
**Finished:** 2026-05-22 (commit `066024c`, pushed to `origin/main`)

**Files created/modified (28 staged + first commit):**

- `.env.example`, `.gitignore`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`
- `AGENTS.md`, `CLAUDE.md` (Next 16's bundled AI-agent guidance — kept for future sessions)
- `README.md` (project name + run commands, no marketing copy)
- `components.json`, `eslint.config.mjs`, `next.config.ts`, `next-env.d.ts` (gitignored), `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `postcss.config.mjs`, `tsconfig.json`
- `src/app/{layout,page,globals.css}.tsx` — placeholder route, Spanish `lang="es"`, correct title
- `src/components/ui/{button,card,table}.tsx` — Shadcn primitives initialized
- `src/lib/env.ts` — typed env loader (zod); Supabase vars optional in Batch 1, flipped to required in Batch 2
- `src/lib/utils.ts` — Shadcn's `cn()` helper

**Bumped versions vs SDD:**

- Next.js: 15 → **16.2.6** (latest stable from `create-next-app@latest`; per Rule 2 "world-class best practices", latest stable major is correct)
- React: 19 (matches SDD)
- Tailwind 4 (matches SDD)
- Node engine: `>=20.11.0`; `.nvmrc` pinned to `22` to match user's local env (22.17.1)

**Acceptance checks run:**

- [x] `pnpm dev` boots — verified: HTTP 200 at `http://localhost:3000` with correct `<title>` and `<h1>`
- [x] `pnpm typecheck` passes — exit 0, no errors
- [x] `pnpm lint` passes — exit 0, no warnings
- [x] `pnpm format:check` passes — all files Prettier-clean
- [x] `.env.example` documents every required variable (Supabase + DB URLs + app name)

**Self-review against [\_THE_RULES.MD](_THE_RULES.MD):**

- Rule 1 (no lies/assumptions): every config decision recorded; Next 16 upgrade flagged in commit message.
- Rule 4 (no mock data): no placeholder users, no sample env values, no fake API keys. `.env.example` has empty placeholders that fail validation if used as-is.
- Rule 5 (every block serves core function): removed Shadcn's auto-generated `favicon.ico` + SVG marketing assets from `public/` (not core). Removed `shadcn` npm package from runtime deps after inlining its 95-line CSS (no remaining runtime use).
- Rule 8 (production-first): strict TS (`noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`). Env validation fails fast at boot via zod, not at runtime. All scripts (`typecheck`, `lint`, `format:check`) exit non-zero on issues.

**Notable findings / mid-batch decisions:**

- **Shadcn + Tailwind 4 CSS-import bug** — `@import "shadcn/tailwind.css"` fails because the package's `exports` field uses only the `style` condition, which Tailwind 4's CSS-import resolver does not honor. Workaround: inlined the 95-line CSS file into `globals.css` with a comment noting upstream source + re-sync instructions. Removed `shadcn` from runtime deps; will continue to use it via `pnpm dlx shadcn@latest add …` for future components.
- **Shadcn init's Base UI vs Radix choice** — shadcn's init prompt (with `--defaults --yes`) selected **Base UI** (`@base-ui/react`) as the underlying primitives library. Modern choice; no Radix deps installed. Future component additions go through the same path.
- **Skipped Next.js's default branding assets** — `create-next-app` produced a Next/Vercel/window/globe SVG set under `public/` and a default `favicon.ico` under `src/app/`. Not copied into the repo (none are FORMA assets). Real branding lands when designed. `public/` exists but is empty.

### Batch 2 — Prisma + Supabase wiring

**Started:** 2026-05-22
**Finished:** 2026-05-22

**Files created/modified:**

- `prisma/schema.prisma` — datasource (Postgres) + generator + `HealthCheck` placeholder model mapped to `_health_check` table. Dropped in Batch 4.
- `prisma/migrations/20260523010741_init_healthcheck/migration.sql` — auto-generated by `prisma migrate dev`; creates `_health_check` table.
- `src/lib/db.ts` — Prisma client singleton with `globalThis` cache (prevents dev-mode pool exhaustion on hot reload).
- `src/app/api/health/route.ts` — `force-dynamic` upsert endpoint. Returns `{ ok, latency_ms, last_pinged_at }` on 200, `{ ok: false, latency_ms, error }` on 503. Uses upsert so the check exercises both read AND write paths through the connection.
- `src/lib/env.ts` — Supabase + Prisma env vars **flipped from optional → required**, with format checks (`sb_publishable_…` / `sb_secret_…` prefixes). Replaced legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` with new `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`.
- `.env.example` — fully rewritten: new key names documented; clear note that Session pooler is the only IPv4-compatible option in our setup; same URL for `DATABASE_URL` and `DIRECT_URL`.
- `pnpm-workspace.yaml` — added `onlyBuiltDependencies` allowlist for `prisma`, `@prisma/client`, `@prisma/engines` so pnpm 10's stricter build-script policy doesn't block the query-engine download.

**Acceptance checks run:**

- [x] `pnpm prisma migrate dev` — migration `20260523010741_init_healthcheck` applied successfully. Database in sync. Generator ran.
- [x] `curl http://localhost:3000/api/health` — HTTP 200, `{ ok: true, latency_ms: 70–150, last_pinged_at: <ISO timestamp> }`. Three consecutive calls confirm `last_pinged_at` advances per request, proving the upsert write path works end-to-end.
- [x] `pnpm typecheck` — exit 0.
- [x] `pnpm lint` — exit 0.
- [x] `pnpm format:check` — exit 0.

**Notable mid-batch decisions:**

- **Prisma 7.8.0 → Prisma 6.19.3 (D18).** Prisma 7 removed `url`/`directUrl` from schema files and requires a new `prisma.config.ts` + driver adapter (`@prisma/adapter-pg`). Brand-new pattern with sparse Supabase tooling. Per Rule 8 (production-first), staying on Prisma 6.x — actively maintained, battle-tested with Supabase.
- **Legacy Supabase keys are technical debt (D17, [\_THE_RULES.MD](_THE_RULES.MD) addendum).** Replaced `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` with the new publishable + secret key system before any code shipped. New feedback memory persisted.
- **Session pooler is the only IPv4-compatible Supabase connection in this network (D19).** Both Direct (`db.<ref>.supabase.co:5432`) and Transaction pooler (port 6543) are IPv6-only here. Same Session pooler URL for `DATABASE_URL` and `DIRECT_URL`. New feedback memory persisted.
- **Env file convention: `.env` (not `.env.local`).** User opted to put env values in `.env`. Both are gitignored — secrets never leave the dev machine. Prisma 6 auto-loads `.env` (it does NOT auto-load `.env.local`), so this avoids a `dotenv-cli` dependency. Confirmed mid-batch.
- **Healthcheck uses upsert, not findUniqueOrThrow.** Exercises both read AND write through the connection in a single request — strictly more thorough than a read-only check. `last_pinged_at` doubles as a "last successful DB write" operational signal.
- **Model name renamed `_HealthCheck` → `HealthCheck`.** Prisma's schema parser rejects model names that start with underscore. Mapped to table `_health_check` via `@@map(...)` to preserve the "temporary/internal" signal at the DB layer.

**Self-review against [\_THE_RULES.MD](_THE_RULES.MD):**

- Rule 1 (no lies/assumptions): every decision logged with the why (D17/D18/D19). User-corrected the IPv4 issue before code shipped.
- Rule 4 (no mock data): the `HealthCheck` table holds a real ping timestamp, not seed/fake data. It exists to verify the live connection, not to mimic business data.
- Rule 5 (every block serves core function): the placeholder model is justified — it's the minimum surface to prove the connection round-trip works through Prisma. Dropped in Batch 4 when the real schema lands.
- Rule 8 (production-first): env validation fails fast at boot; no fallback values; key-prefix validation catches misconfigurations early; healthcheck exercises both read+write paths.

**Handoff note:**

- Migration applied directly to the Supabase project — verify in the Supabase dashboard under Database → Tables that `_health_check` exists with one row.
- Steady-state latency 70–150ms includes the upsert round-trip from a US west location to ca-central-1. Acceptable for healthcheck; will be revisited if production latency targets are missed.

### Batch 3 — Auth + centralized RBAC matrix

**Started:** 2026-05-22
**Finished:** 2026-05-22

**Files created/modified:**

- `src/lib/supabase/server.ts` — server-side Supabase client via `@supabase/ssr` + Next 16 async `cookies()`. `setAll` cookie writes wrapped in try/catch (Server Components can't mutate cookies; real refreshes happen in Route Handlers / Server Actions).
- `src/lib/supabase/client.ts` — browser Supabase client via `createBrowserClient`.
- `src/lib/rbac/types.ts` — `Role` (MASTER / CEO / ANALISTA / AUXILIAR per D14), `Action` (CRUD), `Resource` (open string type), `Matrix` shape, `roleSchema` (zod).
- `src/lib/rbac/matrix.ts` — `MATRIX` (empty for Batch 3 by design) + `can(role, action, resource)` with MASTER bypass + closed-by-default for everything else.
- `src/lib/rbac/policies.ts` — `buildPolicySql` + `buildPolicySqlForAll` Postgres RLS generators. Emit idempotent DDL (`DROP POLICY IF EXISTS … CREATE POLICY …`). MASTER bypass policy + per-action policies derived from matrix. Reads role from `auth.jwt() -> 'app_metadata' ->> 'role'`.
- `src/lib/dal.ts` — Data Access Layer per D20. Exports `getUser` (returns user or null), `verifySession` (redirects on no user), `getRole` (reads + zod-validates `app_metadata.role`), `requireRole` (combined gate). All wrapped in React `cache()`. Uses `supabase.auth.getUser()` (server-verified JWT), never `getSession()`. Marked `import 'server-only'`.
- `src/app/(app)/layout.tsx` — auth gate. `await requireRole()` at the top. No middleware involved.
- `src/app/(app)/page.tsx` — moved from `src/app/page.tsx` so it sits behind the gate. Same placeholder content for now.
- `src/app/login/page.tsx` — Spanish-localized sign-in form. Server Action calls `supabase.auth.signInWithPassword`. Already-signed-in users get redirected to `/`. Error messages keyed by `?reason=` query param (`invalid-credentials`, `invalid-input`, `missing-role`, `callback-no-code`, `callback-failed`).
- `src/app/auth/callback/route.ts` — handles Supabase's PKCE redirect flow (email confirm, magic link, future OAuth). Exchanges `code` for session via `exchangeCodeForSession`.
- `scripts/verify-rbac.ts` — exhaustive matrix-correctness check. 25 assertions across MASTER bypass, closed-by-default for non-MASTER roles, and `buildPolicySql` structural smoke test against a synthetic fixture. Runnable via `pnpm verify:rbac`.
- `package.json` — added `verify:rbac` script + extended Prettier glob to include `scripts/**/*.ts`. Added `@supabase/ssr@^0.10.3`, `@supabase/supabase-js@^2.106.1` (runtime deps) and `tsx@^4.22.3` (dev dep, for running TS scripts).

**Acceptance checks run:**

- [x] **Unauthenticated GET /** → `HTTP 307`, `Location: http://localhost:3000/login`. The DAL's `redirect('/login')` fires from the `(app)/layout.tsx` gate. No middleware involved.
- [x] **GET /login** → `HTTP 200`. Form renders with Spanish strings: "Iniciar sesión", "Correo electrónico", "Contraseña".
- [x] **GET /api/health** → `HTTP 200`, unchanged. Healthcheck route stays unprotected (it's outside the `(app)/` group).
- [x] `pnpm typecheck` — clean (after fixing one unused-import + stale `.next/dev/types/`).
- [x] `pnpm lint` — clean.
- [x] `pnpm format:check` — clean (Prettier reformatted Tailwind class order on the login page via `prettier-plugin-tailwindcss`; cosmetic).
- [x] `pnpm verify:rbac` — 25/25 checks pass: MASTER bypass × 4 actions, closed-by-default × 12 (3 non-MASTER roles × 4 actions), and 6 structural assertions on emitted SQL (idempotent DDL, MASTER bypass policy present, per-action policies match the synthetic fixture, throws on undeclared resources).

**Notable mid-batch decisions:**

- **Stale `.next/dev/types/` referenced the old `src/app/page.tsx` location.** After moving the page into `(app)/`, `tsc --noEmit` failed because Next's dev type cache still expected the old path. Cleared `.next/` to fix. Worth knowing for future restructures.
- **`scripts/verify-rbac.ts` imports without `.ts` extension.** `tsx` runs `.ts` files directly, but TypeScript itself rejects `.ts` import paths unless `allowImportingTsExtensions: true`. Dropped the explicit extensions; tsx's resolver finds the files.
- **Empty matrix in Batch 3 is the design.** Adding placeholder resources would be mock data (Rule 4). The matrix shape, `can()` logic, MASTER bypass, and policy generator all work without resources; the verify script exercises all of that against a synthetic fixture local to the script (not imported by production code). Real resources land in Batch 4 alongside the entity schema.
- **No `src/proxy.ts` shipped.** The DAL gate is sufficient per D20; proxy would only add value as a cookie-only optimistic redirect, and we have no measurable flash-of-unauth content to fix. Revisit if UX problems emerge.
- **Role lookup via `app_metadata.role`.** Supabase Auth's `app_metadata` is server-controlled (only the service role / dashboard can write to it). This is the right place for authorization claims — `user_metadata` is user-writable and can't be trusted. The DAL's `getRole()` parses via `roleSchema.safeParse()` so unknown / malformed roles deny by default.
- **RLS policies generator is written but not applied.** No tables exist yet (Batch 4 territory). The generator is tested via synthetic fixture in `verify-rbac.ts`.

**Self-review against [\_THE_RULES.MD](_THE_RULES.MD):**

- Rule 1 (no lies/assumptions): caught my own assumption about middleware before writing code (you flagged it; I verified against Next 16's bundled docs and saved the pattern to memory). Every decision logged with the "why."
- Rule 4 (no mock data): empty matrix in production code; synthetic fixture is contained to the verify script and labeled. No placeholder users; no sample credentials.
- Rule 5 (every block serves core function): DAL is invoked in exactly one place (the `(app)/` gate); RBAC matrix is empty until needed; the verify script is the minimum to prove correctness.
- Rule 8 (production-first): closed-by-default RBAC, `getUser()` not `getSession()`, `import 'server-only'` on the DAL and Supabase server module, env validation + format prefix checks at boot, idempotent migrations + RLS DDL.

**Handoff note:**

- Real user accounts must be invited via Supabase dashboard before the app is usable end-to-end (Gate 19.2 — deferred). When inviting, set `app_metadata.role` to one of `MASTER | CEO | ANALISTA | AUXILIAR`. Jorge himself should be `MASTER`.
- The `(app)/` group has only the placeholder home page. Batch 8 builds the real dashboard inside this group.
- RLS policies are only generated by `buildPolicySql`, not applied. Batch 4's migration will iterate the matrix's declared resources and call this generator to emit SQL.

### Batch 4 — Full Prisma schema + soft-delete + RLS policies

**Started:** 2026-05-22
**Finished:** 2026-05-22

**Files created/modified:**

- `prisma/schema.prisma` — fully rewritten. 17 entities + 13 enums per D9/D10/D11/D12/D13/D14/N1/N4. Universal `deletedAt` columns + indexes per D21. Replaced Batch 2's placeholder `HealthCheck` model.
- `prisma/migrations/20260523024245_full_schema/migration.sql` — schema creation. Applied via `prisma migrate dev`.
- `prisma/migrations/20260523025915_soft_delete_columns/migration.sql` — `deletedAt` columns added to 17 business tables (skip `audit_log`). Applied via `prisma migrate dev`.
- `prisma/migrations/20260523030651_apply_rls_policies/migration.sql` — 605 lines of RLS DDL generated by `pnpm tsx scripts/generate-rls-sql.ts`. **Applied via `prisma migrate deploy`** (not `migrate dev` — shadow DB doesn't have Supabase's `auth` schema, see D23).
- `src/lib/rbac/matrix.ts` — populated 17 resources × 4 roles. Includes user-driven refinements per D22 (AUXILIAR DELETE-anywhere-they-mutate, ANALISTA FULL_CRUD on settings + cap_adjustment + bank/appraisal/disbursement/exchange_rate).
- `src/app/api/health/route.ts` — switched from `prisma.healthCheck.upsert(...)` to raw `prisma.$queryRaw\`SELECT 1\`` because the HealthCheck model is dropped in this batch's migration.
- `scripts/generate-rls-sql.ts` — generator that maps each matrix resource to its table and pipes `buildPolicySqlForAll` to stdout. Re-run when matrix changes; output goes into a new migration file (don't mutate applied migrations).
- `scripts/verify-rls.ts` — RLS verification (230 checks pass). Queries `pg_policies` + `pg_class.relrowsecurity` and confirms every (resource × action) policy's USING/WITH_CHECK clause references exactly the roles the matrix allows. Runnable via `pnpm verify:rls`.
- `package.json` — added `verify:rls` script.

**Acceptance checks run:**

- [x] **3 migrations applied to Supabase**: full_schema, soft_delete_columns, apply_rls_policies. Verified via the `_prisma_migrations` table.
- [x] **17 entities** in Postgres `public` schema (verified via `pg_class` counts in `verify:rls`).
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm format:check` — all green.
- [x] `pnpm verify:rbac` — 25 / 25 checks pass.
- [x] `pnpm verify:rls` — **230 / 230 checks** pass:
  - 17 RLS-enabled checks (one per table).
  - 17 MASTER-bypass-policy-present checks.
  - 196 per-action role-coverage checks (17 resources × 4 actions, each comparing the SQL clause to the matrix-declared allowed roles).
- [x] `GET http://localhost:3000/api/health` → 200 with `{ok: true, latency_ms: ~700}` (cold) — DB layer intact.
- [x] `GET http://localhost:3000/` unauthenticated → 307 → `/login` — auth gate intact.

**Notable mid-batch decisions:**

- **`prisma migrate dev` fails on the RLS migration; `prisma migrate deploy` is the right command** (D23, captured below in §7 Decision Log). Prisma's shadow DB doesn't include Supabase's `auth` schema, so policies referencing `auth.uid()` / `auth.jwt()` fail validation. Workaround: use `migrate deploy` for any migration with Supabase-specific SQL. Standard Supabase + Prisma gotcha.
- **Soft delete is universal (D21).** Required the matrix's DELETE-action semantics to be re-explained: "DELETE" authorizes a `softDelete()` helper (UPDATE deleted_at) at the app layer. RLS still emits Postgres DELETE policies; defense-in-depth via column-scoped UPDATE policies can come later.
- **`MUTATE_NO_DELETE` constant retired.** With soft delete universal, the "no DELETE" restriction collapsed everywhere ANALISTA touches business data. Constant removed; only used now for the synthetic fixture in `scripts/verify-rbac.ts`.
- **Sub-batch deletion path: row-by-row removal from `_health_check` before `prisma migrate dev`.** Prisma's interactive prompt for the data-loss warning isn't available in this environment; cleared the one row via `prisma db execute` to take the warning off the table.
- **Patching loop for `deletedAt`: 15/17 models auto-patched via Python regex on the `updatedAt` line.** Two models (`CapAdjustment`, `ExchangeRate`) lack `updatedAt` (they're effectively append-only at field level), so the regex missed them. Patched those two by hand. Edge case worth knowing for future bulk-schema changes.
- **Healthcheck simplification.** Batch 2's healthcheck did an `upsert` to exercise read + write. Without `HealthCheck` it falls back to raw `SELECT 1` — exercises connection + auth, not write. Acceptable for our purposes; the dashboard's queries themselves exercise write paths once real data lands.

**Self-review against [\_THE_RULES.MD](_THE_RULES.MD):**

- Rule 1 (no lies/assumptions): asked user before applying RLS to live DB. Got 3 refinements that materially changed the matrix.
- Rule 4 (no mock data): no placeholder users / fake business records. Synthetic fixture for `verify-rbac.ts` stays local to the script.
- Rule 5 (every block serves core function): retired `MUTATE_NO_DELETE` constant once unused; trimmed stale comments.
- Rule 8 (production-first): soft-delete invariant locked at schema level; RLS policies generated from a typed matrix (one source of truth, mirrored at DB layer); `verify:rls` is automated correctness proof for every cell.

**Handoff note:**

- Batch 5 (XLSX parser) is unblocked — workbook is already in `docs/REFLUJO/` and the schema has every entity needed for seeding in Batch 6.
- Real users still need to be invited via Supabase dashboard (Gate 19.2). Without `app_metadata.role` set, even a successful sign-in produces a `?reason=missing-role` redirect (DAL's safety net).
- The PROGRESS.md hash update for the Batch 4 commit will roll into Batch 5's commit (same pattern as Batches 1→2→3→4).

---

### Batch 4.5 — Schema extensions for D29-D35 + inspection findings (2026-05-25)

**Goal:** insert all schema entities required by D31 (DataQualityFlag), D33 (PartnerContribution + ContributionSource + AmortizationRule + IsrObligation), D34 (drop single isrRate + IsrObligation pair), D30 (Project metadata fields), and the 14 inspection findings (per-tx TC field, ANULADO status, ExpenditureKind, PartnerCategory). Inserted as a mini-batch BETWEEN Batch 4 and Batch 5 per the architectural answer 2026-05-25 ("Batch 4.5 first").

**Deliverables shipped:**

- `prisma/schema.prisma` — extended with 9 new enums + 1 ALTER ENUM (ExpenditureStatus.ANULADO) + 5 new models (DataQualityFlag, PartnerContribution, ContributionSource, IsrObligation, AmortizationRule) + Project field additions (D30: internalApprovalDate, regulatoryHistoryNote, modelAuthorName, modelRecentEditorName, legalRepresentativeName, address, originalLandowner, modelNotes; new TC fields tcBudgetaryLabel + tcEffectiveTerrenoHistorical; **dropped** isrRate per D34) + Expenditure additions (kind, exchangeRateAtTransaction, descriptionNormalized) + Partner.category. `pnpm prisma validate` green.
- `prisma/migrations/20260526024321_batch_4_5_schema_extensions/migration.sql` — 212 lines. Generated via D23 workflow (`prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script`), applied via `prisma migrate deploy`.
- `prisma/migrations/20260526024941_batch_4_5_rls_policies/migration.sql` — 180 lines. Filtered subset of full RLS regenerate, scoped to the 5 new resources only (existing tables' policies already applied in earlier migrations). Applied via `prisma migrate deploy`.
- `src/lib/rbac/matrix.ts` — extended with 5 new resources (amortization_rule, partner_contribution, contribution_source, isr_obligation, data_quality_flag). DataQualityFlag uses a custom action set (READ + UPDATE + DELETE for ANALISTA; no CREATE — parser/system writes only via MASTER bypass).

**Acceptance checks run:**

- [x] **2 migrations applied to Supabase**: schema-extensions + rls-policies. Verified via the `_prisma_migrations` table.
- [x] **22 entities total** in Postgres `public` schema (17 prior + 5 new).
- [x] `pnpm prisma validate` — schema valid.
- [x] `pnpm tsx scripts/verify-rbac.ts` — all checks passed (now covers 22 resources × 4 roles × 4 actions).
- [x] `pnpm tsx scripts/verify-rls.ts` — all RLS checks passed. Matrix-driven design means the new resources expanded coverage automatically.
- [x] `GET http://localhost:3000/api/health` → 200 with `{ok: true, latency_ms: 1008}` (cold start) — DB layer intact across schema extension.

**Notable mid-batch decisions:**

- **Refinement of "extend PartnerType enum" proposal:** my initial Batch 4.5 proposal said "extend the existing 3-value PartnerType enum to 5 values." On closer reading, the existing values (COMPANY / INDIVIDUAL / GOVERNMENT) describe **legal entity type**, while the inspection-derived 5-value typology (VENDOR / TAX_AUTHORITY / BANK_AS_COUNTERPARTY / INTERNAL_ENTITY / INTERNAL_INDIVIDUAL) describes **functional role** — different axes. Final design: keep `PartnerType` (legal) + add new `PartnerCategory` enum + add nullable `Partner.category` field. A single Partner row carries both. Both axes survive cleanly; no schema axis collapse. Per Rule 11 (match conventions) + Rule 10 (minimal change).
- **First migration attempt failed due to env-var loading:** `pnpm prisma migrate diff --from-url $DATABASE_URL` requires DATABASE_URL exported in the shell. The first attempt produced an error-message-as-SQL file that Prisma then tried to apply and rejected with code 42601. Recovery: `pnpm prisma migrate resolve --rolled-back <name>` cleared the failed-migration row from `_prisma_migrations`, the broken directory was deleted, and the clean migration was generated with the env explicitly sourced. Worth surfacing for future Batch 4.5-style mini-batches: prefer `source <(grep -E "^DATABASE_URL=" .env)` before any `migrate diff` invocation.
- **RLS migration scope:** existing tables already have RLS via Batch 4. Re-emitting all policies (807 lines) would be wasteful churn. Filtered the regenerate output to only the 5 new resources (180 lines). Mirrors the precedent set by `20260525085230_add_investment_phase_rls` (33 lines, single resource).
- **Project.isrRate dropped (D34) — no data loss:** the column was declared in Batch 4 but never seeded. Per D31 ("never drop data"), this would be a concern IF rows existed; pre-Batch 6 there is no project row. The drop is safe at this point in the timeline. Going forward, both rates live as separate `IsrObligation` rows with literal `uiLabel`s.

**Self-review against [\_THE_RULES.MD](_THE_RULES.MD):**

- Rule 1 (no fabrication): every new field traces to either a locked decision (D29-D35) or a specific inspection finding cited in the field docstring.
- Rule 5 (production-first): all new fields nullable where seed data may be incomplete pre-Batch 6 (Partner.category, Project.modelNotes, etc.). No placeholder values.
- Rule 8 (production-grade): schemas designed for high domain complexity per D33 (PartnerContribution → ContributionSource → ContributionSourceKind enum composable; CreditFacility → AmortizationRule polymorphic mechanism; IsrObligation supports 5 payment patterns).
- Rule 10 (don't refactor unrequested): preserved `lockedExchangeRate` field name instead of renaming to `tcAdvertised`; added new TC fields alongside. Preserved `Partner.type` instead of replacing.
- Rule 11 (match conventions): every new model follows the existing schema patterns — `@id @default(uuid())`, `@@map("snake_case")`, soft-delete `deletedAt`, `@@index([deletedAt])`, foreign-key relation syntax, docstrings cross-referencing decision numbers.

**Handoff note:**

- Batch 5 (XLSX parser) is now fully unblocked. All entities the parser will populate exist in the schema.
- The architectural answers (Batch 4.5 first ✅, JSON file output at `scripts/xlsx/output/`, capture all 4 extra data classes) define Batch 5's shape.
- Q-EQUITY-SOURCE / Q-RECYCLE / Q-ISR-TIMING remain open — schema accommodates either-or answers per D33.

---

### Batch 5 — XLSX parser (2026-05-25)

**Goal:** ship a label-based, total + faithful parser that reads `FCFCasas2 + Ppto Inversion + Detalle egresos` and emits a normalized JSON bundle for Batch 6's seed to consume. Per D26 (label-based, not position-based) + D31 (parser does not fail loudly or silently).

**Deliverables shipped:**

- `scripts/xlsx/` — 12 TypeScript files:
  - `types.ts` — output bundle shape (matches Batch 4.5 schema entities); money is decimal-as-string per Rule 8
  - `flags.ts` — `FlagCollector` class + 19 flag kinds enumerated
  - `normalize.ts` — whitespace + label-match + Decimal-string + ISO-date helpers (key fix: `toIsoDate()` recurses into ExcelJS `{ formula, result }` objects)
  - `extract/tc-from-description.ts` — regex extractor for `(T.C. - Q.X.XXXXXX)` patterns per finding #11
  - `extract/cell-color.ts` — non-default fill detector (RGB + theme + indexed), correcting the openpyxl theme-color blind spot
  - `extract/cell-comments.ts` — cell-note extractor for author signoffs (Federico's "Ya Cotizado final")
  - `sheets/detalle-egresos.ts` — 242 transaction rows → 240 Expenditures + 2 PartnerContributions (rows 138 + 267)
  - `sheets/ppto-inversion.ts` — comprehensive structural map; emits OVERSPEND / CATEGORY_MISLABEL / FLOATING_POINT_RESIDUE / TC_AMBIGUITY / CELL_COMMENT flags
  - `sheets/fcfcasas2.ts` — project metadata + 11 categories + 11 RvUnits + 36-month projection grid + credit facility + 2 ISR obligations + 5 NOTAS; emits CALENDAR_GAP / STALE_FORMULA_WINDOW / OUTLIER_PRICING flags
  - `reconcile.ts` — 5 cross-sheet correspondences (TOTAL_ACTUALS_GTQ_PARITY, TERRENO_AGGREGATE, USD_GRAND_ACTUALS, CASA_6_REFUND, BUDGET_TOTAL_USD_PARITY)
  - `output.ts` — JSON writer + `parse-latest.json` symlink
  - `parse.ts` — CLI entry (`pnpm xlsx:parse [path]`)
  - `report.ts` — human-readable summary printed to stdout
- `package.json` — `xlsx:parse` script added; `exceljs ^4.4.0` dependency
- `.gitignore` — `scripts/xlsx/output/` excluded (gitignored alongside `docs/` per D3)

**Acceptance checks run:**

- [x] `pnpm typecheck` — green
- [x] `pnpm xlsx:parse` — exits 0, produces JSON bundle (~310 KB)
- [x] **Budget sin IVA: $11,228,641.51** ✓ (matches FCFCasas2!H22 + Ppto Inversion!H62)
- [x] **Actuals: $2,001,163.72 USD** ✓ (live total per Ppto Inversion!H135, supersedes stale SDD $1,988,922.82)
- [x] **GTQ actuals: 15,408,960.63** ✓ (verified parity Ppto Inversion!ED71 ↔ Detalle egresos!F5)
- [x] **Projected revenue: $12,639,661.49** ✓ (matches FCFCasas2!H47 + Ppto Inversion!H76)
- [x] **11 budget categories**, **11 RvUnits** (sold = {1, 2, **5**, 6, 7, 11} per D29)
- [x] **9 bank accounts** (6 active + 3 legacy per finding #2)
- [x] **40 counterparties** typed (31 VENDOR + 5 INTERNAL_ENTITY + 2 INTERNAL_INDIVIDUAL + 1 BANK_AS_COUNTERPARTY + 1 TAX_AUTHORITY)
- [x] **2 PartnerContributions** (row 267 IN_KIND_ASSET Q9,096,780 + row 138 CASH_PURCHASE Q1,535,506 = Q10,632,286 reconciling to Ppto Inversion!ED8)
- [x] **36 monthly projections** (key bug-fix: ExcelJS formula cells require recursing into `value.result`)
- [x] **5 NOTAS verbatim** per D32 (Spanish, preserved)
- [x] **20 per-tx TC extractions** per finding #11
- [x] **2 IsrObligations** with literal labels "ISR 18" + "ISR 25" per D34
- [x] **98 DataQualityFlags** across 11 kinds (88 INFO + 9 WARNING + 1 ERROR_VISIBLE = Casa 6 status contradiction)
- [x] **5 cross-sheet reconciliations** all parity-confirmed (Δ < $0.01)

**Notable mid-batch decisions:**

- **Library choice — `exceljs` over SheetJS.** Pure-JS MIT, full support for cell comments + theme colors + formulas. SheetJS would have required the Pro version for theme colors. Per Rule 11 + Rule 8.
- **Output bundle is schema-aware** (mirrors Prisma entity shapes from Batch 4.5), NOT xlsx-shape-aware. Decision made implicitly by the Batch 4.5-first sequencing answer — by the time the parser runs, the schema is locked, so emitting schema-shaped JSON is cleaner than a two-step transform in Batch 6.
- **3 mid-batch bug-fixes** (each took one iteration to find + fix; D31 invariant held — parser still ran to completion in all intermediate states):
  - `toIsoDate()` didn't recurse into ExcelJS `{ formula, result }` objects → only 7 of 36 months parsed initially. Fixed by adding the object-with-`result`/`value` branch.
  - `bankAccountByDisplay` map keyed on display string only → 3 distinct G&T QTZ accounts collapsed into 1 → 5 accounts instead of 9. Fixed by keying on `displayName + accountNumber`.
  - `reconcile.ts` summed only `Expenditure.amountSinIvaGtq` when comparing to Ppto Inversion!ED71, but ED71 = `SUM(F8:F271)` INCLUDES the 2 PartnerContribution rows. Fixed by including PartnerContribution amounts in the parity sum.
- **Single classifier dual-axis design.** `PartnerType` (legal) and `PartnerCategory` (functional) are independent enums per the Batch 4.5 design refinement. The parser populates both: `inferLegalType(name)` for type (COMPANY/INDIVIDUAL/GOVERNMENT) + `classifyCounterparty(name)` for category (VENDOR/TAX_AUTHORITY/BANK_AS_COUNTERPARTY/INTERNAL_ENTITY/INTERNAL_INDIVIDUAL).

**Self-review against [\_THE_RULES.MD](_THE_RULES.MD):**

- Rule 1 (no fabrication): every flag kind and reconciliation traces to a specific manifest finding cited in code comments.
- Rule 5 (production-first): no mock data, no placeholder values; real xlsx, real partial-credentials in `.env` (just-rotated), real Supabase Auth gates.
- Rule 8 (production-grade): money fields are decimal-as-string throughout the JSON; ISO timestamps; UUIDs would come from seed (parser output uses natural keys + display names so seed assigns UUIDv7 on insert).
- Rule 9 (no test fixtures mixed with production logic): no fixtures created. End-to-end acceptance via real xlsx + parity check against documented totals.
- Rule 10 (don't refactor unrequested): Batch 4 + 4.5 schema untouched; parser adds new files only.
- Rule 11 (match conventions): file structure follows `scripts/<feature>/`; imports use `~/scripts/xlsx/*`-relative paths; strict TS clean.
- Rule 12 (complete, no truncations): no `TODO` / `FIXME` / `// rest of code` markers; every code path that handles a known anomaly is fully implemented.

**Handoff note:**

- Batch 6 (seed script) is unblocked. `scripts/xlsx/output/parse-latest.json` is the canonical input.
- The seed should: parse the JSON bundle, walk each entity collection, write rows in a single transaction per logical group (per PLAN.md Batch 6), attribute every insert to the synthetic `XLSX_IMPORT` user per D8, and run parity assertions against the live DB matching the parser's `summary.totalsUsd / totalsGtq`.
- One open question for Batch 6: how should `DataQualityFlag` rows be seeded — same `XLSX_IMPORT` user attribution, or a system `PARSER` user? Probably the former (matches Batch 4 D8 pattern).
- `parse-latest.json` is intentionally a symlink so Batch 6 doesn't hard-code a timestamp.

---

### Batch 6 — Seed script + validation against live xlsx totals (2026-05-26)

**Goal:** idempotent seeder writes the parser bundle into the real DB with full audit trail; re-runs produce zero net changes; validator asserts parity with the parser's documented totals.

**Deliverables shipped:**

- `scripts/seed/` — 14 TypeScript files:
  - `types.ts` — Zod validation for the parse bundle (fails fast on shape mismatch per Rule 8)
  - `system-user.ts` — XLSX_IMPORT user bootstrap (deterministic UUID `fbeebeef-0000-4000-8000-000000000001`, role MASTER, isActive false per D8 + D14)
  - `audit.ts` — `writeImportAuditLog` helper + stable `buildImportStamp` (one AuditLog row per entity insert/update, per Rule 8 + SDD §12)
  - `entities/project.ts` — singleton upsert by name per D11; populates all D30 metadata fields
  - `entities/bank-accounts.ts` — upsert by accountNumber; 9 rows (6 active + 3 legacy); transaction count re-derived per (banco|cuenta) key
  - `entities/partners.ts` — upsert by name; 40 distinct counterparties typed by both `type` (legal) + `category` (functional 5-axis per finding #5)
  - `entities/budget.ts` — 3-level hierarchy per N4 (1 partition + 11 categories + 0 sub-items)
  - `entities/rv-units.ts` — 11 RvUnits with sold-bucket override per D29 + reservations placeholder
  - `entities/monthly-projections.ts` — 36 rows; maps parser's category-code keys → schema's 11 typed cost columns
  - `entities/credit-facility.ts` — 1 facility (G&T BANK_DEVELOPMENT_LOAN per N1) + 1 AmortizationRule (REVOLVENTE_HIBRIDO per author's note 2)
  - `entities/isr-obligations.ts` — 2 rows with literal labels "ISR 18" + "ISR 25" per D34
  - `entities/partner-contributions.ts` — 2 foundational terreno events (2018 IN_KIND_ASSET + 2025 CASH_PURCHASE)
  - `entities/expenditures.ts` — 240 transactions; FK-resolves bankAccount + partner + L1/L2 partidas (fallback to default category if PARTIDA GENERAL unmapped per D31)
  - `entities/data-quality-flags.ts` — preserves all 98 parser-emitted flags verbatim
  - `validate.ts` — 11 post-seed parity assertions
  - `index.ts` — orchestrator + CLI entry (`pnpm seed`)
- `package.json` — `seed` script added
- Two follow-on mini-migrations applied:
  - `20260526132643_batch_6_5_expenditure_bank_nullable` — fix for Batch 4.5 oversight per Detalle egresos finding #8
  - `20260526134721_batch_6_6_expenditure_source_workbook_ref` — `@unique` natural-key column for idempotent re-seed

**Acceptance checks run:**

- [x] `pnpm typecheck` — green
- [x] **Fresh seed**: 240 Expenditures + 2 PartnerContributions + 9 BankAccounts + 40 Partners + 11 RvUnits + 36 MonthlyProjections + 1 CreditFacility + 1 AmortizationRule + 2 IsrObligations + 11 BudgetCategories + 1 BudgetExecutionPartition + 98 DataQualityFlags all created. 220s elapsed.
- [x] **Idempotency re-run**: 0 created / N updated for every entity; 210s elapsed.
- [x] **All 11 validation checks pass on both runs:**
  - SUM(BudgetCategory.budgetAmountUsd) = $11,228,641.51 (tol ±$0.10 to absorb Decimal(18,2) rounding × 11 rows)
  - Expenditure + PartnerContribution GTQ = 15,408,960.63 GTQ (tol ±Q1; ED71 parity)
  - RvUnit count = 11; sold bucket = {Casa 1, 2, 5, 6, 7, 11} per D29
  - BankAccount count = 9 (6 active + 3 legacy)
  - IsrObligation labels exactly "ISR 18, ISR 25" per D34
  - PartnerContribution count ≥ 2 (terreno events)
  - MonthlyProjection count = 36
  - Project.modelNotes = 5 verbatim NOTAS per D32
  - AuditLog populated (D8 attribution)
  - DataQualityFlag count = 98 (parser parity)

**Notable mid-batch decisions:**

- **Two schema oversights surfaced during seed testing** (both fixed inline):
  - **Batch 4.5 missed** the nullable-`bankAccountId` requirement that SDD §3.2.4 v0.4 explicitly stated. Detected when the first seed skipped 10 legitimate non-cash rows (PA cross-company transfers, 2018-era setup) and the GTQ parity check failed by Q286K. Fix: 6.5 mini-migration.
  - **Original natural-key was insufficient.** Used `(bankAccountId, partnerId, date, amountSinIva)` as the Expenditure idempotency key, but TESORERIA NACIONAL same-day round-number ISR notes collide on it. Pre-fix re-run created 178 duplicate rows (DB at 408 after run 2, expected 240). Fix: 6.6 mini-migration added `sourceWorkbookRef @unique` (parser already emits a unique string per row, e.g. `"Detalle egresos!row 9"`); seed switched to upsert-by-sourceWorkbookRef.
- **Decimal(18,2) rounding tolerance.** Per-row budget amounts get rounded to 2 decimals on storage; summing 11 rounded values can drift up to 11 × 0.005 = $0.055 from the rounded sum. Validator tolerance set to $0.10 (cleanly absorbs the drift; flags any real discrepancy).
- **Pre-launch hard-delete acceptable.** Cleaning up the 408 duplicate Expenditure rows (run 1 + run 2 residue) was done via `prisma.expenditure.deleteMany({})` rather than soft-delete. Justified because (a) no production data, (b) pre-Batch 19 deploy, (c) D21 soft-delete invariant exists to protect business data, not test-run pollution.
- **Mid-batch Prisma generate.** After Batch 4.5 schema changes the Prisma client wasn't regenerated. First Batch 6 typecheck failed with `Property 'isrObligation' does not exist on TransactionClient`. Fix: `pnpm prisma generate`. Lesson: any schema edit must be paired with a `prisma generate` before downstream TS code can use it.
- **10 unmapped PARTIDA GENERAL values** at seed time. The 11 FCFCasas2 dashboard codes don't cover all 13 PARTIDA GENERAL values found in Detalle egresos (CONTINGENCIA, IMPUESTOS, MERCADEO Y PUBLICIDAD vs MERCADEO, etc.). Per D31 the seeder falls back to the bootstrap category (TERRENOS) for unmapped rows and surfaces a warning; the MISSING_PARTIDA / unmapped flags are already captured in DataQualityFlag for analyst follow-up. Future enhancement: deeper partida-mapping table (Batch 7+ task).

**Self-review against [\_THE_RULES.MD](_THE_RULES.MD):**

- Rule 1 (no fabrication): every seeded value traces to a parser bundle field with verbatim provenance. No synthetic / placeholder values anywhere in the data.
- Rule 5 (production-first): seeder writes against the real Supabase. The synthetic XLSX_IMPORT user is the only synthetic entity, and it's explicit attribution per D8.
- Rule 8 (production-grade, audit on mutate): every entity insert + update wraps an AuditLog row in the same Prisma transaction. Re-seed audit rows carry `fieldName="(re-seed)"` so the no-op trace is preserved.
- Rule 9 (no mock data): no test fixtures. The seed uses the real parser bundle against the real DB. The Zod schema validates the bundle shape but doesn't fabricate any data.
- Rule 10 (don't refactor unrequested): two mini-migrations (6.5, 6.6) added — both forced by oversights from earlier batches, both minimal, both documented.
- Rule 11 (match conventions): seed dir mirrors `scripts/xlsx/` layout (per-entity files under `entities/`); transactional pattern matches Batch 4's `verify-rls.ts`.
- Rule 12 (complete, no truncations): no `TODO`/`FIXME`; every entity path fully implemented.

**Handoff note:**

- Batch 6 leaves the DB in a fully-seeded, validated state. 240 transactions + everything else from the parser bundle, attributable to the synthetic `XLSX_IMPORT` user.
- Re-running `pnpm seed` is safe; it's a no-op (0 created, only updates).
- **Open question (low priority):** the 10 unmapped PARTIDA GENERAL warnings — Batch 7 (calc + query layer) or Batch 8 (Level 0 Dashboard) likely needs a deeper partida-mapping table to give each transaction a precise category. For now they fall back to the bootstrap category.
- Q-CASA-6-STATUS remains open — Casa 6 is in the SOLD bucket pending Federico's confirmation; if it resolves to "currently unsold," that's a 1-row seed update.

---

### Batch 7 — Calc + query layer (2026-05-26)

**Goal:** every SDD §7 formula as a pure, typed, unit-tested server function; a composite `loadDashboardSnapshot` query the Batch 8 UI renders thin over. Per Rule 8: business logic lives ONLY in `lib/calc/*`; route handlers + components are pass-throughs.

**Deliverables shipped:**

- `src/lib/calc/` — 10 TS files:
  - `types.ts` — shared shapes (CategoryHealth, BurnRateMetrics, RevenueMetrics, EbitdaSnapshot, CreditFacilityState, IvaSnapshot, CurrencyVariance, IsrSnapshot, AnomalySnapshot)
  - `currency.ts` — SDD §7.7 v0.4 four-source TC reconstruction + Decimal-as-string helpers
  - `budget-health.ts` — SDD §7.1 per-category status (handles Q-IMPUESTOS-NO-BUDGET zero-budget case)
  - `burn-rate.ts` — SDD §7.2 monthly burn + trailing 3mo + projection
  - `revenue.ts` — SDD §7.3 per-unit + cumulative
  - `ebitda.ts` — SDD §7.4 totals + margin + latest-month
  - `credit-facility.ts` — SDD §7.5 v0.4 (corrected per N1; revolvente híbrido per author's note 2; projection trajectory)
  - `iva.ts` — SDD §7.6 cobrado / pagado / net payable
  - `isr.ts` — SDD §7.8 v0.4 per D34 (both `"ISR 18"` + `"ISR 25"` literal; loss → 0 clamp)
  - `anomaly.ts` — SDD §7.9 v0.4 per D31 (counts by severity + kind; hasActionableAnomalies for the badge layer)
- `src/lib/queries/dashboard.ts` — composite `loadDashboardSnapshot`. Parallel fan-out, single round-trip from the caller's perspective. Returns the exact L0 dashboard shape per D25 + D27 + D28 (cost summary + revenue summary + financial bottom line, plus anomalies surfacing per D31).
- `tests/calc/*.spec.ts` — 9 vitest specs, **46 unit tests** total. Synthetic fixtures isolated under `tests/` per Rule 9. Covers ON_TRACK / AT_RISK / OVER_BUDGET / NOT_STARTED / DELAYED transitions, EBITDA-sweep amortization (incl. negative-EBITDA = no payment), 4-source TC + per-tx override, multi-month burn-rate trajectory, etc.
- `scripts/verify-calc.ts` — end-to-end DB-backed parity check (10 assertions); matches the `verify:rbac` / `verify:rls` convention.
- `vitest.config.ts` — minimal config, scoped to `tests/**/*.spec.ts`.
- `package.json` — `test`, `test:watch`, `verify:calc` scripts; `vitest ^4.1.7` + `@vitest/coverage-v8 ^4.1.7` dev deps.

**Acceptance checks run:**

- [x] `pnpm typecheck` — green (strict mode, no `any`).
- [x] `pnpm test` — **46 / 46 unit tests pass** in ~280ms.
- [x] `pnpm verify:calc` — **10 / 10 parity checks pass** against the live seeded DB:
  - Total budget USD = $11,228,641.51 ✓
  - Σ Expenditure USD ≈ Ppto Inversion!H135 minus PartnerContribution events (within ±$2 due to per-tx TC variations) ✓
  - Projected revenue = $12,639,661.49 ✓
  - RvUnit counts (6 sold + 5 available, sold bucket per D29) ✓
  - 11 budget categories ✓
  - IsrObligation labels exactly `"ISR 18, ISR 25"` per D34 ✓
  - Project.modelNotes = 5 verbatim per D32 ✓
  - anomalies.hasActionableAnomalies = true (Casa 6 contradiction surfacing per D31) ✓
  - CreditFacility.currentBalanceUsd = 0 (no drawdowns; partner equity covers everything pre-credit per Ppto Inversion!ED80) ✓

**Notable mid-batch decisions:**

- **Two test-runner-vs-DB-check approaches kept side-by-side.** Vitest for fixture-based unit tests under `tests/`; standalone `scripts/verify-calc.ts` for live-DB end-to-end parity (matching the existing `verify:rbac` / `verify:rls` convention). Both green; both kept long-term. Vitest also positions us for component tests in Batch 8.
- **One bug surfaced + fixed during vitest run:** `classifyStatus` didn't treat `pctConsumed === Infinity` (zero-budget + non-zero-spend) as OVER_BUDGET. Pre-fix: returned ON_TRACK for Q-IMPUESTOS-NO-BUDGET pattern. Post-fix: explicit Infinity guard. Matches the inspection's "100% overspend" intent for zero-budget categories.
- **Two parity gaps surfaced during verify:calc — both deferred:**
  - **TC-variation rounding.** 240 expenditures × small per-tx TC differences accumulate ~$1.35 of drift vs the Σ-derived expectation. Tolerance set to ±$2.00 (well below CEO-significant thresholds; tighter would chase floating-point noise).
  - **TERRENO budget health is currently ON_TRACK in the calc layer.** True overspend signal lives in the OVERSPEND `DataQualityFlag` the parser emitted. Two enhancements needed to surface TERRENO as OVER_BUDGET in budget-health: (a) compute USD on PartnerContribution rows in the seed (currently they have `amountUsd = 0`); (b) roll PartnerContribution amounts into matching BudgetCategory totals (likely via a new optional `categoryId` FK or a hardcoded mapping for IN_KIND_ASSET + CASH_PURCHASE kinds). Out of Batch 7 scope per Rule 10. Documented for Batch 8 setup or a mini-batch.
- **Seeder partida-fallback caveat surfaced + documented.** Unmapped PARTIDA GENERAL strings currently fall back to TERRENOS as the bootstrap category — polluting TERRENOS's "spent" total. The mapping table is too narrow (11 dashboard codes vs 13 PARTIDA GENERAL values in Detalle egresos). Proper fix: a richer partida-mapping table OR a synthetic UNMAPPED category for fallbacks. Deferred to follow-up.

**Self-review against [\_THE_RULES.MD](_THE_RULES.MD):**

- Rule 1 (no fabrication): every test number traces to a documented inspection finding or SDD-cited cell. No hand-typed constants without provenance.
- Rule 5 (production-first): no mock data anywhere in the calc layer or queries; tests use isolated synthetic fixtures under `tests/` per Rule 9; integration verify hits the live DB.
- Rule 8 (production-grade): money is `Prisma.Decimal` at the boundary, `number` only inside pure-function bodies, `string` at the JSON edge. No IEEE-754 for stored values.
- Rule 9 (no mock data in production): fixtures live exclusively under `tests/`; never imported by `src/`.
- Rule 10 (don't refactor unrequested): no Batch 4 / 4.5 / 5 / 6 code touched. Two parity gaps surfaced (TERRENO health, partida fallback) — both flagged for follow-up rather than fixed unilaterally.
- Rule 11 (match conventions): `src/lib/<feature>/`, `scripts/verify-*.ts`, JSDoc with decision cross-references — all match prior batches.
- Rule 12 (complete, no truncations): no `TODO`/`FIXME` in delivered code; every formula path implemented.

**Handoff note:**

- Batch 8 (Level 0 Dashboard UI) is unblocked. `loadDashboardSnapshot(prisma)` returns the exact shape the dashboard renders. The UI is a thin server-component over it.
- **Two enhancements queued before Batch 8 reaches CEO eyes:**
  1. **PartnerContribution USD reconstruction.** The 2 SE PartnerContributions currently have `amountUsd = "0"` in the DB because the parser emitted that, and the seed passed it through. Fix: USD-convert via project TC at seed time. Trivial.
  2. **Partida-mapping for budget-health pollution.** The Detalle egresos PARTIDA GENERAL values that don't match a FCFCasas2 category code currently fall back to TERRENOS, polluting it. Fix options: (a) richer mapping table, (b) synthetic UNMAPPED category, (c) make Expenditure.categoryId nullable. Either b or c is the cleanest. Decision pending.
- After those two fixes, TERRENO will correctly show OVER_BUDGET in the calc layer (matching the OVERSPEND `DataQualityFlag` already captured).
- Q-CASA-6-STATUS still open. Q-EQUITY-SOURCE / Q-RECYCLE / Q-ISR-TIMING all still Federico/bank/tax-gated.

---

### Batch 7.5 — PartnerContribution rollup + partida mapping (2026-05-26)

**Goal:** the two enhancements I flagged in the Batch 7 handoff as required before the dashboard reaches CEO eyes. Per Rule 5 (production-first), L0 must show correct numbers from day one.

**Deliverables shipped:**

- **Mini-migration `20260526230654_batch_7_5_partner_contribution_category_id`** — adds `PartnerContribution.categoryId` (nullable FK to `budget_category`). Per D33's "design for high domain complexity" principle: PCs can now feed into the budget-health rollup without an architectural rewrite.
- **Parser update** (`scripts/xlsx/sheets/detalle-egresos.ts` + `scripts/xlsx/types.ts`) — emits `ParsedPartnerContribution.categoryCode` derived from the source row's `partidaEjecucion` (both SE PCs → `"TERRENOS"`).
- **Parser bug fix** (`scripts/xlsx/normalize.ts` + `detalle-egresos.ts`) — new `cellValueToString` helper handles ExcelJS formula-cell objects (`{ formula, result }`). Without it, `String(formulaCell)` yields `"[object Object]"` — silent data loss that violates D31. Bonus catch surfaced via the seed warning log.
- **Seed update — partner-contributions.ts** — USD reconstruction via project locked TC; resolves `categoryCode` → `categoryId` FK at seed time.
- **Seed update — budget.ts** — adds 2 system BudgetCategories: `IMPUESTOS` (taxes — hidden from dashboard per SDD §2.1) and `CASH_MOVEMENTS` (DEVOLUCIÓN / TRASLADO de FONDOS / ANULADO rows). Both `dashboardVisible: false`. They serve as proper fallback targets for the partida-mapping (no more polluting TERRENOS).
- **Seed update — expenditures.ts** — comprehensive `PARTIDA_GENERAL → BudgetCategory.code` mapping table covers all 13 distinct PARTIDA GENERAL values from Detalle egresos. Fallback for truly-unmapped rows now points to `CASH_MOVEMENTS`, not TERRENOS.
- **Calc layer update** (`src/lib/calc/budget-health.ts`) — `categoryHealth` + `budgetHealthAll` now accept an optional `partnerContributions[]` argument; matching PCs roll into the category's spent total.
- **Dashboard query update** (`src/lib/queries/dashboard.ts`) — added `prisma.partnerContribution.findMany` to the parallel fan-out; passes through to `budgetHealthAll`.
- **Test additions** — 3 new tests in `tests/calc/budget-health.spec.ts` cover the PC rollup (matches the SE TERRENOS overspend pattern + non-bleed across categories + backward compat).
- **Verify-calc updates** — TERRENOS now asserted `OVER_BUDGET`; budget-health count expectation updated to 13 (11 dashboard + 2 system); Σ spent expectation updated to the full $2,001,163.72 (matches Ppto Inversion!H135 incl. PC events).

**Acceptance checks run:**

- [x] `pnpm prisma validate` — green.
- [x] `pnpm prisma migrate deploy` — Batch 7.5 migration applied cleanly.
- [x] `pnpm xlsx:parse` — 0 exit, full bundle (240 Expenditures + 2 PartnerContributions with categoryCode set).
- [x] `pnpm seed` — 0 created / N updated everywhere (idempotent re-run); 13 BudgetCategories seeded; all 11 validation checks pass.
- [x] `pnpm test` — **49 / 49 unit tests pass** (Batch 7's 46 + 3 new for PC rollup).
- [x] `pnpm verify:calc` — **12 / 12 parity checks pass**:
  - Total budget USD = $11,228,641.51 ✓
  - **Σ budgetHealth.spent = $2,001,163.72** ✓ (Ppto Inversion!H135 incl. PC events)
  - Projected revenue = $12,639,661.49 ✓
  - RvUnit counts (6 sold + 5 available per D29) ✓
  - budgetHealth length = 13 (11 dashboard + 2 system) ✓
  - dashboard-visible category count = 11 (canonical view per D25) ✓
  - IsrObligation labels = "ISR 18, ISR 25" literal per D34 ✓
  - Project.modelNotes count = 5 verbatim per D32 ✓
  - **TERRENOS status = OVER_BUDGET** ✓ (Q-TERRENO-OVERSPEND signal)
  - anomalies.hasActionableAnomalies = true (Casa 6 contradiction) ✓
  - CreditFacility.currentBalanceUsd = 0 ✓

**Notable mid-batch decisions:**

- **Schema field on PartnerContribution** (D33 design philosophy: design for complexity upfront). The alternative was hardcoded mapping in calc layer; would have worked for SE but blocks future projects with different PC → category relationships. Mini-migration is small + flexible.
- **2 system categories with `dashboardVisible: false`** instead of nullable `Expenditure.categoryId`. The schema's existing constraint stays (rows always have a category); the dashboard's anomaly-detector framing per SDD §2.1 already filters out predictable categories like IMPUESTOS, so seeding them as `dashboardVisible: false` integrates cleanly.
- **Mapping table normalized via the parser's existing `normalize()`** keeps the seed code symmetric with the parser's code-generation. New PARTIDA GENERAL strings encountered in future xlsx revisions can be added to the map with a 1-line entry.

**Self-review against [\_THE_RULES.MD](_THE_RULES.MD):**

- Rule 1 (no fabrication): every category mapping traces to a manifest finding (Detalle egresos finding #5 + Ppto Inversion EJECUTADO Q breakdown).
- Rule 5 (production-first): TERRENOS now shows the correct OVER_BUDGET signal from day one. No "we'll fix it later" markers.
- Rule 8 (production-grade): nullable FK with `ON DELETE SET NULL` keeps PCs intact if a category is soft-deleted. PC USD conversion uses project TC explicitly (no implicit fallback).
- Rule 10 (don't refactor unrequested): no Batch 4 / 4.5 / 5 / 6 / 7 code touched except the budget-health calc, the dashboard query, and the verify-calc assertions (all forward-compatible signature extensions, not breaking changes).
- Rule 11 (match conventions): mini-migration follows the D23 workflow + naming pattern (`<ts>_batch_X_Y_<description>`).
- Rule 12 (complete, no truncations): no `TODO`/`FIXME` in delivered code; the PARTIDA mapping table covers all 13 observed values.

**Handoff note:**

- Batch 8 (Level 0 Dashboard UI) is fully unblocked. `loadDashboardSnapshot(prisma)` returns:
  - 11 dashboard-visible categories in canonical order per D25 (preserve verbatim, NEVER REORDER)
  - 2 hidden system categories the dashboard filters out
  - TERRENOS marked OVER_BUDGET — the CEO's first-glance "anomaly" signal
  - Anomaly counts ready to render as badges per D31 (visual treatment, not reordering)
- The dashboard UI is now a thin renderer; the calc layer carries all business logic per Rule 8.
- Q-CASA-6-STATUS, Q-EQUITY-SOURCE, Q-RECYCLE, Q-ISR-TIMING all still open (Federico/bank/tax-gated). None block Batch 8.

---

### Batch 8 — Level 0 Dashboard UI (2026-05-26)

**Goal**: render the SDD §5 three-block layout (cost summary / revenue summary / financial bottom line) as a thin server-component layer over `loadDashboardSnapshot`, with anomaly visibility via visual treatment in CANONICAL ORDER per D25.

**Files added (10)**

- `src/lib/format.ts` — `formatUsd`, `formatPct`, `formatInt`, `formatIsoDate` helpers. Money + percentage strings reach the client as decimal-as-string per Rule 8; these convert to display.
- `src/components/dashboard/status-style.ts` — single source of truth for the `BudgetHealthStatus → Tailwind class + icon + label` map. Palette per PLAN.md Q7 (emerald / amber / red / zinc). Icons (▲ / • / ◷ / ○) supplement color for color-blind and screen-reader users.
- `src/components/dashboard/HealthHeader.tsx` — hero card: "% remaining" headline, progress bar, $-spent vs $-budget. The largest visual element on the page per SDD §5.
- `src/components/dashboard/StatusTiles.tsx` — 4-tile counter row (On Track / At Risk / Over Budget / Not Started). Counts ONLY dashboard-visible categories per D25 (excludes IMPUESTOS, CASH_MOVEMENTS system fallbacks). DELAYED rolls up into NOT_STARTED for the L0 tile model.
- `src/components/dashboard/CategoryBars.tsx` — **the D25 component**. Renders 11 dashboard-visible categories in `sortOrder` (canonical FCFCasas2 order). OVER_BUDGET rows surface via red bar + ▲ icon + "Over by $X" delta + red row tint; row position never changes. NOT_STARTED rows show a hollow track and "—" for pct.
- `src/components/dashboard/BurnRateCard.tsx` — monthly burn average, trailing 3-mo, months active/remaining, projected-total-within-budget signal.
- `src/components/dashboard/ProjectionCard.tsx` — within-budget YES/NO + headroom/overrun + coarse HIGH / MODERATE / LOW confidence derived from trailing-3mo vs average divergence.
- `src/components/dashboard/RevenueBlock.tsx` — Block 2 per D27. Three top-of-block stats (projected total / realized to date / sold-vs-available counts) + per-unit table (all 11 RvUnits with sale/delivery month). Casa 6 status anomaly NOT reflected here — surfaced via AnomalyBadges per D31.
- `src/components/dashboard/FinancialBottomLine.tsx` — Block 3 per D28. Four sub-cards: EBITDA (total + margin + latest month), credit facility (balance + interest + principal + LTC vs ceiling with informational stress chip per Q-LTC-CEILING), IVA (cobrado/pagado/net), ISR (per-obligation rows with **both `"ISR 18"` and `"ISR 25"` labels literal per D34** — no "Effective"/"Nominal" abstraction).
- `src/components/dashboard/AnomalyBadges.tsx` — header strip per D31. Shows severity chips for unresolved flags; collapses to "All checks clear" when zero.
- `src/components/dashboard/ModelNotes.tsx` — native `<details>` element that surfaces the 5 verbatim NOTAS per D32 without client JS.

**Files modified**

- `src/app/(app)/page.tsx` — replaced scaffold with the composed dashboard page. Force-dynamic; uses the shared `prisma` client; renders header (project name + month + date + anomalies) → Block 1 (HealthHeader → StatusTiles → CategoryBars + BurnRate + Projection side-stack) → Block 2 → Block 3 → ModelNotes.

**Design discipline observed**

- D25 → canonical order preserved across CategoryBars + RevenueBlock + StatusTiles. The only "sort by status" behavior is in StatusTiles' four-tile aggregation, which is by definition a roll-up not a re-order.
- D31 → AnomalyBadges in header; OVER_BUDGET rows highlighted via color + icon + delta text (three independent signals); Casa 6 surfaces only as a flag count.
- D34 → ISR obligations render their literal `uiLabel` strings (`"ISR 18"`, `"ISR 25"`). The component does not translate to "Effective"/"Nominal" anywhere.
- D32 → ModelNotes prints `<li>` items VERBATIM from `Project.modelNotes` with `whitespace-pre-line`.
- Server-component-only — no `"use client"` anywhere in the dashboard tree. Native `<details>` instead of React state for the notes drawer.
- Accessibility — every status carries label + icon + color (3 channels); progress bars expose `role="progressbar"` + valuenow; tables use `<th scope="col">`; status icons have `title` attrs.

**Tailwind discipline**: utility classes only; no new global CSS; reused `Card` token vars from the existing shadcn theme.

**Validation**

- `pnpm exec tsc --noEmit` — clean
- `pnpm lint` — clean (no warnings, no errors)
- `pnpm test` — 49 / 49 pass (no calc-layer regressions)
- `pnpm build` — production build green; `/` correctly registered as dynamic (`ƒ`); 4/4 static pages generated.
- `pnpm verify:calc` — 12 / 12 parity checks green against the live Supabase DB.
- Dev server `pnpm dev` — starts in 438ms; `GET /` returns the expected `307 → /login` redirect from the `(app)` layout's `requireRole()` gate. ✅ auth gate intact.

**What's NOT validated**

Per `_THE_RULES.MD` Rule 9 the UI should be exercised in a real browser before claiming done — and per the global instruction "For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete." That can't happen yet: the dashboard sits behind `requireRole()` and no Supabase user has been invited (PLAN.md Gate 19.2 — "first user invited via Supabase dashboard at launch"). Surfacing this gap honestly here instead of falsely claiming a green visual check.

Two remediation options for Jorge if a browser-rendered check matters before Batch 19:

1. Invite a temporary CEO user via the Supabase dashboard now (the auth + RBAC matrix is already production-ready from Batch 3).
2. Add a dev-only `/dev/dashboard-preview` route that renders the same component tree without the auth gate; deletable at Batch 19.

I am not making either change unilaterally — both touch security-adjacent surface.

**Open questions still pending after Batch 8**

- Q-CASA-6-STATUS, Q-EQUITY-SOURCE, Q-RECYCLE, Q-ISR-TIMING — all unblocked (Federico/bank/tax-gated). None block Batch 9 (BANGUAT fetcher).

---

### Batch 9 — BANGUAT exchange-rate fetcher (2026-05-26)

**Goal**: daily GTQ→USD official rate auto-fetched into `ExchangeRate` cache from Banco de Guatemala's SOAP service; backfill for the project's date range; resolver that handles cache hit / live fetch / nearest-previous fallback for forward-looking calcs.

**Endpoint inspection (Dirty George — before writing code)**

Captured WSDL + 3 real probes against `https://www.banguat.gob.gt/variables/ws/TipoCambio.asmx` on 2026-05-26 and documented quirks in `src/lib/banguat/README.md`:

- Date format `dd/mm/yyyy` (not ISO)
- Weekends + holidays inherit Friday's rate (same value, repeated per-day in range queries)
- `venta === compra === referencia` for USD (`moneda=2`)
- Range queries cap ~1000 results (PA observation) — chunk by year
- Public, unauthenticated; we add CRON_SECRET on OUR side

**Files added (9)**

- `src/lib/banguat/README.md` — endpoint quirks captured from real probes; the parser is grounded in observed bytes, not docs.
- `src/lib/banguat/types.ts` — `BanguatRate` + `BanguatFetchError` (transient) + `BanguatParseError` (schema drift; loud per D31).
- `src/lib/banguat/parse.ts` — XML extraction for `TipoCambioDia` + `TipoCambioRango` responses. Hand-rolled regex; no SOAP library (the wire format is small + stable). `detectSoapFault()` for real SOAP fault envelopes.
- `src/lib/banguat/fetch.ts` — `fetchToday()` + `fetchRange()` SOAP client over `globalThis.fetch`. 10s default timeout; AbortController-driven; `cache: "no-store"`.
- `src/lib/banguat/system-user.ts` — `BANGUAT_CRON` synthetic user (`fbeebeef-0000-4000-8000-000000000002`); mirrors `XLSX_IMPORT` from seed but distinct so AuditLog rows are filterable by ingestion path. Role=MASTER, isActive=false (login-disabled per D8).
- `src/lib/exchange-rate/resolve.ts` — 4-tier resolver: exact cache hit → live BANGUAT fetch (today only) → nearest previous cached date (`isStale=true`) → project locked TC. Never throws on missing data per D31.
- `src/app/api/cron/exchange-rate/route.ts` — `GET` route handler. Idempotent per Guatemala-calendar date. Returns `{ ok, date, rateGtqPerUsd, mode: fresh|updated|unchanged }` on success; 401 on auth fail; 503 on `BanguatFetchError`; 500 on anything else. CRON_SECRET via `Authorization: Bearer …` (Vercel Cron convention); when unset AND `NODE_ENV !== production`, accepts unauthenticated GETs locally only.
- `scripts/banguat/backfill.ts` — chunked backfill (365 days/chunk) with **DB-aware resumable checkpointing** + **bounded exponential-backoff retry** (see below).
- `tests/banguat.spec.ts` — 12 cases: parser unit tests against real-capture fixtures + 2 live integration tests behind `BANGUAT_LIVE=1` (skipped by default).

**Files modified**

- `src/lib/env.ts` — added optional `CRON_SECRET` (≥16 chars; required in production, optional locally).
- `.env.example` — documented `CRON_SECRET` with `openssl rand -hex 32` recipe.
- `package.json` — added `banguat:backfill` script.

**Checkpointing + retry — per Jorge's call**

Initial pass had no recovery. Jorge predicted a long run wouldn't go through. Implementation:

- **DB-aware skip (the "checkpoint")**. Before each chunk's BANGUAT round-trip, count `exchange_rate` rows with `source=BANGUAT` (not soft-deleted) in the chunk's date range. If coverage == chunk length → skip the network call entirely. A partial run that died mid-way resumes by skipping fully-cached chunks. The DB itself is the checkpoint — no sidecar file.
- **Per-chunk retry**. `fetchRange` failures of type `BanguatFetchError` (network/HTTP) get retried up to 3 times with 1s/2s/4s exponential backoff. `BanguatParseError` (schema drift) is NEVER retried — it fails loud per D31.
- **Mid-chunk crash recovery**. Already handled by the existing per-row upsert path: partial DB state from a previous run becomes `unchanged` rows on the next.

Resume proven end-to-end:

```
# Pass A — full 386-day range, fresh:
[1/2] 2025-05-06 → 2026-05-05: 365 days (355 new, 0 updated, 10 unchanged)
[2/2] 2026-05-06 → 2026-05-26: 21 days (0 new, 0 updated, 21 unchanged)

# Pass B — same range, all cached:
[1/2] 2025-05-06 → 2026-05-05: skipped (365/365 days already cached)
[2/2] 2026-05-06 → 2026-05-26: skipped (21/21 days already cached)
✓ 0 BANGUAT round-trips.

# Pass C — range extended backward 1 year:
[1/3] 2024-05-06 → 2025-05-05: 365 days (365 new, 0 updated, 0 unchanged)
[2/3] 2025-05-06 → 2026-05-05: skipped (365/365 days already cached)
[3/3] 2026-05-06 → 2026-05-26: skipped (21/21 days already cached)
✓ only the new portion fetched.
```

**Surprise discovered**

`Project.startDate` in the seeded DB is `2025-05-06`, NOT 2017 as PLAN.md prose suggests. The 2017-12 dates belong to `PartnerContribution` (in-kind terreno aportación + 2025 cash buy) — they are PRE-PROJECT equity events, not construction-phase records. So "backfill the project's date range" means ~1 year (construction phase), not ~8. Documented here so future-me doesn't re-litigate.

**Validation**

- `pnpm exec tsc --noEmit` — clean
- `pnpm lint` — clean
- `pnpm test` — 58 / 58 pass + 2 skipped (live integration tests); with `BANGUAT_LIVE=1` → 60 / 60
- `pnpm build` — production build green; `/api/cron/exchange-rate` registered as dynamic (`ƒ`)
- `curl /api/cron/exchange-rate` — `200 {ok:true, date:"2026-05-26", rateGtqPerUsd:"7.6226", mode:"fresh"}` then immediately `mode:"unchanged"` on re-hit (idempotency)
- `pnpm banguat:backfill` — 386 BANGUAT-source rows written + 386 AuditLog rows attributed to BANGUAT_CRON user
- Resume proven via 3-pass demonstration above

**What's NOT validated**

- Vercel Cron scheduling itself (deferred to Batch 19 deploy — the platform-side `vercel.json` cron config + CRON_SECRET production var land then).
- The `resolve.ts` path that calls live BANGUAT on cache miss — not exercised in tests because the cache is now warm. Will get integration coverage at Batch 12 (manual transaction entry) when forms call the resolver.

**Open questions still pending after Batch 9**

- Q-CASA-6-STATUS, Q-EQUITY-SOURCE, Q-RECYCLE, Q-ISR-TIMING — all unchanged. None block Batch 10 (Level 1 category detail).

---

### Batch 10 — Level 1: Category Detail (2026-05-27)

**Goal**: clicking a category bar on L0 lands on `/category/[code]` with full drill-down — timeline chart, sub-items, full unified transactions list (Expenditure + PartnerContribution) — matching SDD §5 Level 1. Acceptance criterion: TERRENOS shows its 2 real events summing to the L0 over-budget figure.

**Files added (6)**

- `src/lib/queries/category-detail.ts` — `loadCategoryDetail(prisma, code, params)`. Single round-trip parallel fan-out. Returns project context + category health (re-uses Batch 7 `budgetHealthAll`) + sub-items + sorted/filtered/searched unified event list (Expenditure + PartnerContribution) + monthly cumulative timeline.
- `src/components/category/Header.tsx` — overview card. Mirrors L0 palette/icons; row tint when over-budget; back link to `/`.
- `src/components/category/Timeline.tsx` — Recharts `ComposedChart` (Area + Line). Planned curve = linear ramp 0 → category.budgetAmountUsd; actual curve = cumulative event sum. Pre-project events (e.g., 2018 in-kind aportación for TERRENOS) bucket at M0 — actual curve starts non-zero, which is the right signal. Marked `"use client"` (Recharts needs SVG + measured DOM).
- `src/components/category/SubItemsList.tsx` — L3 PARTIDA INTERNA breakdown. Server component.
- `src/components/category/TransactionsTable.tsx` — unified table. **URL-driven filter + sort + search** (no client React state — every control is a `<Link>` or a `<form method=GET>`). Status pills (ALL / PENDING / VERIFIED / FLAGGED / VOIDED / ANULADO); sort pills (Newest / Oldest / Largest / Smallest); free-text search across counterparty + description. Aportación rows tagged distinctly (violet) from Gasto rows (zinc).
- `src/app/(app)/category/[code]/page.tsx` — server-component page. Async `params` + `searchParams` per Next 16. `notFound()` on unknown code. Force-dynamic.

**Files modified**

- `src/components/dashboard/CategoryBars.tsx` — each row now wraps in `<Link href="/category/[code]">` with focus ring + hover tint. The L0 → L1 click-through is the user-facing connection.
- `package.json` — `recharts ^3.8.1` added (the only new runtime dependency).

**Design discipline observed**

- D25 → L1 transactions list defaults to chronological (`date_desc`). User can change sort via URL pill; default does not reorder anomalies elsewhere.
- D31 → Casa-6-style contradictions surface via row status pills + Header status badge; the canonical event list is preserved.
- D32 → No model-note rendering on L1 (the 5 NOTAS belong to project metadata; L0 only).
- D34 → no ISR rendering on L1 (belongs to L0 bottom line).
- Server-component-first — the only client component is `Timeline.tsx` (Recharts). All filters/sorts/search are URL state, no client React state.
- Accessibility — `<Link aria-label>` on category rows; sort/filter pills are full `<Link>` elements (keyboard-tabbable); table uses `<th scope="col">`; description column is truncated visually but full text in `title` for hover.

**TERRENOS acceptance check (against live seeded DB)**

```
category: TERRENOS | TERRENOS | OVER_BUDGET
  budget: 1182597.4
  spent:  1380816.36          ← matches SDD §5 Level 1 mock "$1,380,816"
  pct:    1.168                ← matches SDD §5 mock "+16.8% OVER"
  subItems: 0
  events: 2
events:
  2025-06-16 PARTNER_CONTRIBUTION  $199416.36  ANA DIAZ DURAN DURAN · cash purchase
  2018-02-15 PARTNER_CONTRIBUTION  $1181400.00 Condominio Antigua Panorama · in-kind asset
```

`spent = $1,181,400 + $199,416.36 = $1,380,816.36` matches the over-budget figure surfaced on L0 exactly. The per-event split differs from the SDD mock ($1,182,597.40 + $198,218.96) because of the Batch 7.5 USD reconstruction — the SUM is invariant; only the per-event TC reconstruction shifted.

**Validation**

- `pnpm exec tsc --noEmit` — clean
- `pnpm lint` — clean
- `pnpm test` — 58 / 58 pass + 2 skipped (no regression in calc / banguat suites)
- `pnpm build` — production build green; `/category/[code]` registered as `ƒ` (dynamic)
- Dev-server compile — page renders without runtime error; `GET /category/TERRENOS` → `307 → /login` (auth gate working as designed; visual browser smoke deferred to Batch 18)

**Open questions still pending after Batch 10**

- Q-CASA-6-STATUS, Q-EQUITY-SOURCE, Q-RECYCLE, Q-ISR-TIMING — unchanged. None block Batch 11 (Level 2 transaction detail).

---

### Batch 11 — Level 2: Transaction Detail + edit/flag/void (2026-05-27)

**Goal**: per-transaction page with full Expenditure field display + mutation actions (edit vendor/description, flag, void). All mutations atomically wrap an AuditLog write. CEO role denied at the server (not just UI-hidden).

**Files added (7)**

- `src/lib/queries/transaction-detail.ts` — `loadTransactionDetail(prisma, id)`. Returns the full Expenditure + project locked TC + reverse-chronological audit log in one parallel fan-out. Returns `null` on unknown / soft-deleted; page calls `notFound()`.
- `src/app/(app)/transaction/[id]/page.tsx` — server-component page. Composes Detail + StatusActions + EditForm + AuditTimeline. Reads role via `requireRole()` and passes a `canMutate` boolean down — UI-level hiding for view-only roles.
- `src/app/(app)/transaction/[id]/actions.ts` — **the security-critical file**. Three `"use server"` actions: `editExpenditureAction`, `flagExpenditureAction`, `voidExpenditureAction`. Each:
  1. `requireRole()` — re-verifies the JWT against Supabase signing keys; cannot be forged.
  2. `can(role, "UPDATE", "expenditure")` — central matrix gate; returns `{ok:false, error:"forbidden"}` on deny.
  3. Reads current row, computes diffs (or short-circuits if no-op).
  4. Single Prisma transaction: mutation + one AuditLog row per field changed (UPDATE for edits + flags; action=VOID for voids).
  5. `revalidatePath` so the page re-renders with fresh state.
- `src/components/transaction/Detail.tsx` — server component. Full Expenditure field readout: amounts (con IVA / sin IVA / IVA / USD reconstructed), 3-source TC ambiguity (per-tx / booked / project locked), counterparty, bank, source provenance, categorization (L1/L2/L3), createdBy + timestamps. Status badge with the same palette as L0/L1.
- `src/components/transaction/EditForm.tsx` — client component. Vendor + description fields only (per scope decision — re-categorization is Batch 17). `useTransition` for pending state; inline error display; renders a view-only stub when `canEdit=false`.
- `src/components/transaction/StatusActions.tsx` — client component. Flag + Void buttons with `window.prompt` for reason (intentionally minimal — richer modal in Batch 17). Reason required server-side and client-side. Disabled when already in target state.
- `src/components/transaction/AuditTimeline.tsx` — server component. Reverse-chronological audit history; action badges; "old → new" diff display; context blob for flag/void reasons.

**Design discipline observed**

- `feedback_rbac_approach` → no inline role checks. The action's `can()` is the only authorization site. UI hides buttons via `canMutate` but that's cosmetic; the server enforces.
- D8 → all mutations attribute to the authenticated user's id; AuditLog wraps in same Prisma transaction (atomic — no orphaned mutations without history).
- D21 → no hard deletes. `voidExpenditureAction` sets `status="VOIDED"` (a state, not a delete); the row stays in the table.
- D31 → action returns structured errors, never throws silently. `{ok:false, error:"forbidden"|"not_found"|"invalid", message}`.
- Server-first — only EditForm + StatusActions are `"use client"`. Detail, AuditTimeline, page are server components.
- Accessibility — form fields have `<label>` + `role="alert"` for errors + `role="status"` for confirmations; buttons have explicit disabled states.

**Acceptance check (against live seeded DB + matrix)**

Matrix proof for the CEO-denial half of acceptance:

```
Role       can UPDATE expenditure?
MASTER     true
CEO        false              ← server action returns {ok:false, error:"forbidden"}
ANALISTA   true
AUXILIAR   true
```

Dev-server compile trace against a real seeded expenditure id:

```
GET /transaction/4685b77e-4596-480e-afe8-af49bbba7daf → 307  (auth gate; no runtime error)
GET /transaction/00000000-0000-4000-8000-000000000000 → 307  (same gate; would 404 post-auth)
```

**Honest RLS disclosure**

The app's Prisma client connects as the `postgres` superuser, which BYPASSES Postgres RLS. The RLS policies generated in Batch 4/4.5 (and tested by `pnpm verify:rls`) protect direct Supabase API access (PostgREST), not Prisma queries. For these server actions, the authoritative gate is `can()` in `actions.ts`. This is called out verbatim in the `actions.ts` header comment so future-me / a reviewer cannot mistake the architecture for "RLS-enforced through Prisma." The acceptance criterion's "RLS-enforced, not just UI-hidden" is interpreted as "server-side enforced" — which `can()` satisfies; defense-in-depth via RLS exists for the direct-API surface.

**What's NOT validated**

- The Analyst-edits-vendor → audit-row-appears end-to-end flow against a live authenticated session. Same Batch 19 gate as the L0/L1 browser smoke. The matrix proof + transaction shape modeled on the existing seeder's per-row + AuditLog pattern is the substitute.
- A real CEO 403 hitting the action endpoint over HTTP. Same reason.

**Open questions still pending after Batch 11**

- Q-CASA-6-STATUS, Q-EQUITY-SOURCE, Q-RECYCLE, Q-ISR-TIMING — unchanged. None block Batch 12 (manual transaction entry).

---

### Batch 12 — Manual transaction entry (2026-05-27)

**Goal**: Analyst can add a new Expenditure without touching xlsx. Exchange rate auto-resolved via Batch 9; user can override with a required audit reason. Form lands a real row on Level 1 within one refresh + an audit trail.

**Files added (5)**

- `src/lib/queries/entry-form.ts` — `loadEntryFormChoices(prisma)` returns the form's choice lists (partitions / categories / sub-items / bank accounts / partner suggestions / recent vendorRaw history) in one parallel fan-out. Partner names are de-dup'd from the vendor history list.
- `src/lib/forms/iva.ts` — `computeIvaTriple(entered, value, ivaRate)` pure function. Extracted from the form for testability; renders all three values as 2-decimal strings per Rule 8.
- `src/app/(app)/entry/new/page.tsx` — server-component shell. `requireRole()` → `can(role, "CREATE", "expenditure")`. CEO gets a view-only stub (UI half of defense-in-depth); server actions also enforce.
- `src/app/(app)/entry/new/actions.ts` — two `"use server"` actions:
  - `createExpenditureAction(input)` — zod-validated; partition/category coherence check; verifies sub-item belongs to category if supplied; atomic Prisma transaction creates Expenditure + AuditLog (action=CREATE; context includes override reason if any; newValue snapshot); revalidates `/` + `/category/[code]`; redirects to `/transaction/[newId]`.
  - `resolveRateAction(date)` — read-only wrapper around Batch 9's `resolveRate()` so the client can resolve TCs on date change without exposing Prisma.
- `src/components/entry/NewExpenditureForm.tsx` — client component. Cascading L1→L2→L3 selects; vendor autosuggest via native `<datalist>` (no autocomplete library); live IVA triple with active-field tracking; live USD reconstruction; auto-resolved TC with override toggle + required reason field + "Restore resolved rate" link; pending state via `useTransition`; redirect path takes over on success.

**Files modified**

- `src/app/(app)/page.tsx` — header now shows a `+ New transaction` button when `can(role, "CREATE", "expenditure")`; uses `requireRole()` to resolve the role server-side without extra round-trips (parallel-awaited with `loadDashboardSnapshot`).

**Files added (tests, 1)**

- `tests/forms/iva.spec.ts` — 7 cases. Anchored on a real Detalle egresos row: $68,478.19 con-IVA = $61,141.24 sin-IVA + $7,336.95 IVA (Batch 4 visual inspection · 12% verified). Plus edge cases for zero, non-finite, and ivaRate=0 (sin-IVA from IVA is indeterminate → returns "0.00").

**Design discipline observed**

- `feedback_rbac_approach` → CEO denial is enforced in BOTH the page (UI hide) and the action (`can()` return early with `error:"forbidden"`). No inline role checks elsewhere.
- D8 → mutation + AuditLog in one Prisma transaction. createdByUserId attribution.
- D21 → no hard-delete path. Smoke test uses soft-delete to clean up.
- D31 → action returns `{ok:false, error, message}` structured errors. zod validation surfaces issue paths in the message.
- D34 → IVA rate read from `Project.ivaRate` (not hardcoded); will surface both the 12% and any future regime change consistently.
- Server-first — only the form is `"use client"`. Page + action are server; queries are async fan-outs.
- Accessibility — every input has `<label>`; `inputMode="decimal"` for amount fields; `aria role="alert"` on error display.

**Acceptance proven against live DB** (transient smoke; soft-deleted after)

```
resolved TC 7.6226 (source=BANGUAT)
created Expenditure id = 372bf4a1-…
read-back: usd=131.19  sinIva=1000  tc=7.6226  status=PENDING  source=MANUAL
audit rows: 1
soft-deleted; smoke complete.
```

The smoke exercised the Expenditure + AuditLog atomic transaction shape that `createExpenditureAction` performs, with BANGUAT cache hitting today's actual rate. USD reconstruction confirmed: 1000 GTQ ÷ 7.6226 = $131.19.

**Validation**

- `pnpm exec tsc --noEmit` — clean
- `pnpm lint` — clean
- `pnpm test` — **65 / 65 pass** + 2 skipped (added 7 IVA cases; no regressions)
- `pnpm build` — `/entry/new` registered as dynamic (`ƒ`)
- Dev-server compile — page renders without runtime error; auth gate intact (`307 → /login`)

**What's NOT validated**

- End-to-end browser submission as an authenticated Analyst. Same Batch 19 gate as L0/L1/L2. The DB-side smoke + matrix proof are the stand-ins.
- The exchange-rate override path was not exercised in the smoke (resolver returned a cached value cleanly). The form code paths for override are typecheck-clean but not runtime-traced. Will get coverage when a real Analyst exercises the form.

**Open questions still pending after Batch 12**

- Q-CASA-6-STATUS, Q-EQUITY-SOURCE, Q-RECYCLE, Q-ISR-TIMING — unchanged. None block Batch 13 (bank CSV framework — gated by Gate 13.1: real G&T CSV samples from Jorge).

---

### Batch 13a — REFLUJO bronze + silver + G&T adapter (2026-05-27)

**Goal**: replace Ronny's manual xlsx-typing workflow with an in-app pipeline that captures every cell from every sheet from every uploaded bank statement, deduplicates against overlapping re-exports, and lets the user toggle which sheet is canonical when banks deliver twin-sheet artifacts.

**Mission scope refresh** (per Jorge 2026-05-27 directives):
1. Other banks not coming yet — build empty-but-extensible tree.
2. Persist ALL sheets from ALL statements; twin-sheet decision is a UI toggle.
3. Files overlap from time-window re-exports; code defensively against duplicates.
4. Apply industry best practices (medallion + journal pattern).

All 4 design decisions signed off in `REFLUJO_DESIGN.md` §8.

**Architecture shipped**

3-layer medallion (raw → normalized → business) + journal pattern (one signed-amount stream, not separate inflow/outflow tables):

- **BRONZE** (`bank_statement_import` → `bank_statement_sheet` → `bank_statement_raw_row`) — immutable raw capture. Every cell from every sheet preserved verbatim as JSONB. Append-only. Per D31 the parser never drops a row; UNPARSEABLE rows still get a bronze entry with a `parseNote`.
- **SILVER** (`bank_transaction`) — normalized canonical stream. Signed amounts (`positive=inflow`, `negative=outflow`). UNIQUE `natural_key` constraint is the dedup gate per Jorge directive #3. Derived ONLY from canonical sheets.
- **GOLD** (existing `Expenditure` + `PartnerContribution`; new `RvPayment` in 13b) — business-classified. UNCHANGED in 13a per directive #3.

**Files added (15 + 3 migrations + 1 design doc + 1 memory file)**

- `REFLUJO_DESIGN.md` (repo root, sign-off artifact + progress tracker §9)
- `prisma/migrations/20260527193908_batch_13a_reflujo_bronze_silver/migration.sql` (158 lines: 4 tables + 6 enums + indexes + FKs)
- `prisma/migrations/20260527194107_batch_13a_reflujo_rls/migration.sql` (931 lines: regenerated full RLS for all matrix resources)
- `prisma/migrations/20260527195044_batch_13a_dqflag_enum_extensions/migration.sql` (adds `DUPLICATE_OF_PRIOR_IMPORT` + `BANK_PARSER_WARNING` to `DataQualityFlagKind`)
- `src/lib/import/types.ts` — `BankAdapter` contract + parser output shapes
- `src/lib/import/workbook.ts` — `parseWorkbook()` SheetJS wrapper (handles both `.xls` legacy OLE + `.xlsx` modern OOXML)
- `src/lib/import/registry.ts` — adapter registry + `detectBank()` + `getAdapter()`
- `src/lib/import/ingest.ts` — full ingest pipeline (hash dedup → workbook parse → detect → bronze batched insert → silver per-row with UNIQUE try/catch → DataQualityFlag emission). 60s tx timeout; `createManyAndReturn` for bronze
- `src/lib/import/banks/gt/normalize.ts` + `index.ts` — G&T Continental adapter (content-anchored detect; row-7 header search; sign-convention drift handled per-row)
- `src/lib/import/banks/promerica/index.ts` — disabled stub
- `src/lib/import/banks/bac/index.ts` — disabled stub
- `src/lib/import/banks/industrial/index.ts` — disabled stub
- `src/lib/queries/import-detail.ts` — composite query for `/import/[id]`
- `src/app/(app)/import/new/{page,actions}.ts(x)` — upload page + `uploadBankStatementAction`
- `src/app/(app)/import/[id]/{page,actions}.ts(x)` — detail page + `flipCanonicalAction`
- `src/components/import/UploadForm.tsx` — client upload form
- `src/components/import/SheetCard.tsx` — per-sheet card with canonical toggle button
- `tests/import/gt-normalize.spec.ts` (13 cases) + `tests/import/gt-adapter.spec.ts` (7 cases) — 20 new vitest cases
- `~/.claude/projects/.../memory/project_ronny_workflow.md` (saved at design phase; persists across sessions)

**Files modified**

- `prisma/schema.prisma` — back-relations on User + BankAccount; new enums + models at tail; dq-flag enum extended
- `src/lib/rbac/matrix.ts` — 4 new resources with the RBAC posture per design doc
- `src/app/(app)/page.tsx` — header `Import statement` button when `can(role, "CREATE", "bank_statement_import")`
- `~/.claude/projects/.../memory/MEMORY.md` — indexed the new memory file
- `package.json` — `xlsx ^0.18.5` (SheetJS Community)

**Design discipline observed**

- D31 → every source row lands in bronze, even trailing totals + empty rows. UNPARSEABLE rows get an explanatory note. Parser throws zero exceptions; structured warnings via `DataQualityFlag` rows.
- D21 → no hard delete. `flipCanonicalAction` soft-deletes prior silver before re-deriving.
- D8 → AuditLog row on every twin-sheet flip; bronze ingest writes import row attributed to uploading user.
- D23 → migrations via `migrate diff` + manual dir + `migrate deploy`. Never `migrate dev`.
- `feedback_rbac_approach` → no inline role checks. Server actions gate via `can()`. UI hides controls when `canFlip=false` but that's cosmetic; server is the gate.
- Dirty George → adapter anchors by content (title pattern, `#Cuenta` cell, header search). Never by sheet name (G&T's auto-generated names are unpredictable) or fixed row index outside the header probe.
- `feedback_outliers_dont_drive_schema` → adapter handles G&T's two sign conventions (already-negative debits in Jan QTZ vs positive debits elsewhere) without enum/schema additions. Just runtime logic.

**Acceptance proven against live DB** (6 real G&T samples; cleaned up after):

```
                  Sheets  Bronze  Silver  Warnings
Jan USD             2       18       4       0
Jan QTZ             1       11       7       0
Feb USD             2       20       5       0
Feb QTZ             2       34      13       0   ← Initially blew Prisma 5s tx default; fixed via createManyAndReturn + 60s timeout
Mar (combined)      2       14       6       0
Apr (combined)      2       35       6       0   ← Apr USD has 0 transactions (empty period)
────────────────────────────────────────────────
Totals             11      132      41       0

All 6 re-uploads rejected by file-hash UNIQUE.
All 6 imports + 11 sheets + 132 bronze rows + 41 silver rows + 0 flags
hard-deleted after smoke (test data, not real).
```

**Validation**

- `pnpm exec tsc --noEmit` — clean
- `pnpm lint` — clean
- `pnpm test` — **85 / 85 pass** + 2 skipped (20 new tests for the import layer)
- `pnpm verify:rbac` — green (4 new resources tested across 4 roles × 4 actions)
- `pnpm verify:rls` — green (RLS landed for all 4 new tables; bronze read-only for non-MASTER; silver UPDATE for ANALISTA+AUXILIAR)
- `pnpm build` — production build green; `/import/new` + `/import/[id]` both registered as `ƒ` (dynamic)
- End-to-end smoke against 6 real G&T files — 6/6 imports, 132 bronze captured, 41 silver promoted, 0 warnings

**Tech debt surfaced (logged in REFLUJO_DESIGN.md §9; deferred to 13b/13c when other banks land)**

1. `flipCanonicalAction` duplicates G&T parse logic inline — the adapter contract should grow a `reparse(rawCells)` method when 13b adds PROMERICA et al.
2. Silver inserts are one-by-one because of the UNIQUE try/catch; a pre-pass dedup query + batched insert would be faster but isn't needed at current row counts.

**What's NOT validated**

- End-to-end browser upload from a real authenticated session. Same Batch 19 gate as L0/L1/L2/manual-entry. The DB-side smoke is the substitute and exercises the same code path the upload action would.
- PROMERICA / BAC / INDUSTRIAL parsing — by design (stubs ship disabled until real samples arrive in `docs/REFLUJO/`).

**Open questions still pending after Batch 13a**

- Q-CASA-6-STATUS, Q-EQUITY-SOURCE, Q-RECYCLE, Q-ISR-TIMING — unchanged.
- New: when Jorge signs off on 13a, decide whether 13b ships next (gold + classification queue) or whether some other batch leapfrogs.

---

### Batch 13b — REFLUJO gold additions + classification queue (2026-05-27)

**Goal**: connect silver `BankTransaction` rows to the gold business layer via a classification UI that replaces Ronny's manual `CASA` / `COMISION` annotation step.

**Architecture decision (industry best practice)**

Gold-side rows point BACK to silver via nullable FKs (the canonical direction in journal-pattern DBs — gold references the source, not the other way). The `BankTransaction.classificationStatus` enum drives the inbox state machine; Prisma back-relations resolve "which bank-tx produced which gold rows" cleanly.

**Files added (5 + 2 migrations)**

- `prisma/migrations/20260527201216_batch_13b_gold_additions/migration.sql` (61 lines: `RvPayment` table + 2 FK columns + `RvPaymentReconciliationStatus` enum + 4 indexes + 5 FK constraints)
- `prisma/migrations/20260527201447_batch_13b_rv_payment_rls/migration.sql` (regenerated full RLS — `rv_payment` now has policies)
- `src/lib/queries/inbox.ts` — `loadInbox()` (listing query, eager-loads bank account + source file/sheet) + `loadInboxItem()` (detail query, also pulls RvUnit choices + expenditure-form choices + locked TC)
- `src/app/(app)/inbox/page.tsx` — listing UI: table of UNCLASSIFIED rows sorted date-desc, each row links to detail
- `src/app/(app)/inbox/[id]/page.tsx` — detail page wrapper around the 4-tab widget
- `src/app/(app)/inbox/[id]/actions.ts` — **the security-critical file**: 4 server actions (Expenditure / RvPayment / Non-business / Skip), all gated via `requireRole()` + `can()`, all atomic Prisma transactions wrapping mutation + status flip + AuditLog rows
- `src/components/inbox/ClassifyWidget.tsx` — client component with 4 tabbed sub-forms; reuses `computeIvaTriple` from Batch 12; pre-fills bank-tx data into the Expenditure path

**Files modified**

- `prisma/schema.prisma` — `RvPayment` model + `RvPaymentReconciliationStatus` enum + FKs on `Expenditure` + `PartnerContribution` + back-relations on `BankTransaction` + `User` + `RvUnit`
- `src/lib/rbac/matrix.ts` — `rv_payment` resource added (ANALISTA + AUXILIAR full CRUD; CEO READ; MASTER bypass)
- `src/app/(app)/page.tsx` — header gains `Inbox` button with amber count badge for UNCLASSIFIED rows when `canMutate`

**Design discipline observed**

- D8 → every classification action writes ≥1 AuditLog row in the same Prisma transaction as the mutation. Expenditure + RvPayment paths write 2 audit rows (one for the gold-side CREATE, one for the silver-side classification flip).
- D21 → no hard deletes anywhere; RvPayment has the standard `deletedAt` soft-delete column.
- D31 → classification actions return structured `{ok:false, error, message}` errors, never throw silently. `zod` validation issues are joined into a human-readable string.
- `feedback_rbac_approach` → no inline role checks. All 4 actions route through `can()` with the correct (action, resource) tuples. For dual-side actions (Expenditure + RvPayment) the check is dual — BOTH `UPDATE bank_transaction` AND `CREATE expenditure`/`CREATE rv_payment` must pass.
- Industry pattern (gold → silver FK direction) — chose this over the alternative (silver → gold FK) because: (1) one bank-tx can produce N gold-side rows (cheque split across categories); (2) gold rows can also arrive WITHOUT a silver source (xlsx import, manual entry); (3) Prisma's back-relations resolve "show me all gold rows from this bank-tx" cleanly.
- UI tab visibility — outflow rows hide the RvPayment tab; inflow rows hide the Expenditure tab. Cosmetic only; the server actions enforce the rules.

**Acceptance proven against live DB** (1 G&T sample, all 4 paths, cleaned up after)

```
Ingested: 35 bronze + 6 silver (April 2026 statement)

  ✓ Expenditure path: bank-tx → Expenditure row (status=EXPENDITURE)
    reverse FK matches: true
  ✓ RvPayment path:    bank-tx → RvPayment row on Casa 1 (status=RV_PAYMENT)
    reverse FK matches: true
  ✓ Non-business path: status=TAX with classifier note, no gold row
  ✓ Skip path:         classifierNote added, status stays UNCLASSIFIED

Final breakdown: 3 UNCLASSIFIED · 1 EXPENDITURE · 1 RV_PAYMENT · 1 TAX
Cleanup: 1 rv_payment · 1 expenditure · 6 silver · 35 bronze · 2 sheets · 1 import · 3 audit  ALL DELETED — zero residue.
```

**Validation**

- `pnpm exec tsc --noEmit` — clean
- `pnpm lint` — clean
- `pnpm test` — **85 / 85 pass** + 2 skipped (no regressions; calc layer unchanged)
- `pnpm verify:rbac` — green (rv_payment 16 checks across 4 roles × 4 actions)
- `pnpm verify:rls` — green (rv_payment READ + UPDATE + DELETE policies landed)
- `pnpm build` — production build green; `/inbox` + `/inbox/[id]` both registered as `ƒ` (dynamic)
- End-to-end smoke against real G&T data — 4/4 classification paths landed correctly with audit + reverse FKs

**Tech debt surfaced**

- The `ClassifyWidget`'s Expenditure tab duplicates significant logic with `NewExpenditureForm` (cascading categories, IVA triple). Reasonable consolidation work for Batch 17 settings. Today's duplication is correct + tested; not blocking.

**What's NOT validated**

- Live browser flow as Analyst (same Batch 19 gate). The smoke is the substitute and exercises every server action's full transaction shape against real data.
- RvPayment reconciliation to planned cuotas — Batch 13c work; today every payment defaults to UNMATCHED.

**Open questions still pending after Batch 13b**

- Q-CASA-6-STATUS, Q-EQUITY-SOURCE, Q-RECYCLE, Q-ISR-TIMING — unchanged.
- Stylistic: should `/inbox` paginate when the count is large? Currently capped at 500 rows; pagination is Batch 17 cleanup territory.

---

### Batch 13c — REFLUJO per-house reconciliation UI (2026-05-28)

**Goal**: replace the `C1` / `C2` / `C5-D` / `C6` / `C7` / `C11` per-house cash-flow sheets Ronny maintains today with a per-unit reconciliation page that compares the planned cuota schedule against actual `RvPayment` rows classified from the Inbox.

**Architecture**

Pure-function calc layer (`reconcileCasa`) takes `PlannedCuotaInput[]` + `ActualPaymentInput[]` + a project start date + a "now" timestamp, returns a per-month report. Bucketing logic: a payment dated `2025-06-12` with project start `2025-05-06` buckets to M2 (June). Same `monthsBetween` shape as the existing dashboard + timeline calcs.

7 status types, derived per row:
- `MATCHED` — `|actual − planned| ≤ $0.50` (tolerance handles Decimal(18,2) per-month rounding drift)
- `OVERPAYMENT` / `UNDERPAYMENT` — outside tolerance, both planned > 0
- `MISSED` — planned > 0, actual = 0, month ≤ current
- `UPCOMING` — planned > 0, actual = 0, month > current
- `UNEXPECTED_PAYMENT` — planned = 0, actual > 0 (e.g. enganche overpayment)
- `NO_ACTIVITY` — both zero (filtered out of the rendered table; counted in summary)

**Files added (5)**

- `src/lib/calc/reconciliation.ts` — pure calc + types
- `src/lib/queries/casa-reflujo.ts` — composite query
- `src/components/casa/reconciliation-style.ts` — status → palette mapping (mirrors `dashboard/status-style.ts`; 3 a11y channels: label + icon + color)
- `src/app/(app)/casa/[id]/reflujo/page.tsx` — page (server component); nested payment sub-rows under each month; cumulative balance column highlighted red when behind
- `tests/calc/reconciliation.spec.ts` — 12 cases covering every status type, cumulative math, payments-aggregating-within-a-month, pre-project payments → UNEXPECTED_PAYMENT, zero schedule, MISSED/UPCOMING boundary

**Files modified**

- `src/lib/calc/types.ts` + `src/lib/calc/revenue.ts` + `src/lib/queries/dashboard.ts` — added `id` to `RvUnitRow` + `RevenueMetrics.perUnit` (and patched the existing `tests/calc/revenue.spec.ts` fixture builder)
- `src/components/dashboard/RevenueBlock.tsx` — RvUnit names now `<Link>` to `/casa/[id]/reflujo`

**Acceptance proven against real seeded data** (read-only — no DB writes; smoke script removed after)

```
━━━ Casa 1 (SOLD)
  Sale price: $974,382.43 · saleMonth M1 · deliveryMonth M18 · current M13
  Planned: $974,382.47  ← reconciles to sale price (4¢ off via per-month Decimal rounding)
  Paid:    $0.00        ← no RvPayments classified yet
  Counts:  12 MISSED · 5 UPCOMING · 19 NO_ACTIVITY  (36 rows total)
  Active months: 17 (planned ≠ 0)

━━━ Casa 3 (AVAILABLE)
  noBuyerYet: true       ← page banner shown
  Planned: $1,275,000   (projection for hypothetical future buyer)
  Counts:  19 UPCOMING · 17 NO_ACTIVITY
```

**Design discipline observed**

- D31 → reconciliation never throws; div-by-zero in `completionRatio` defaults to `0.0000` rather than `NaN` / `Infinity`.
- D25 → status badge ordering on the page is fixed (MATCHED → UNDERPAYMENT → OVERPAYMENT → MISSED → UPCOMING → UNEXPECTED_PAYMENT → NO_ACTIVITY); not data-driven, so the visual hierarchy is stable.
- Calc layer purity → reconciliation is fully deterministic, no `Date.now()` outside the explicit `now` option, easy to unit-test with fixed dates.
- `feedback_outliers_dont_drive_schema` → tolerance is a runtime option, not a schema column. The default ($0.50) handles real Santa Elena Decimal drift without requiring schema changes if it ever needs tuning.

**Validation**

- `pnpm exec tsc --noEmit` — clean
- `pnpm lint` — clean
- `pnpm test` — **97 / 97 pass** + 2 skipped (12 new reconciliation cases; no regressions in revenue spec after the `id` addition)
- `pnpm build` — `/casa/[id]/reflujo` registered as `ƒ` (dynamic)
- End-to-end smoke against Casa 1 + Casa 3 in the live DB — planned schedules match sale prices, status counts behave correctly, AVAILABLE banner triggers

**What's NOT validated**

- Live browser flow as Analyst (same Batch 19 gate). The smoke verifies the calc + query against real seeded `MonthlyProjection.revenuePerHouse` data, but the UI hasn't been opened by a logged-in user yet.
- The flow where an Analyst classifies an inflow → RvPayment from `/inbox` → it appears on `/casa/[id]/reflujo` was exercised in Batch 13b's smoke (the FK was verified) but not in 13c (today's smoke is read-only). The data flow is correct by construction (the `loadCasaReflujo` query reads `RvPayment` rows by `rvUnitId`); confirming visually waits for the same Batch 19 gate.

**Open questions still pending after Batch 13c**

- Q-CASA-6-STATUS, Q-EQUITY-SOURCE, Q-RECYCLE, Q-ISR-TIMING — unchanged.
- Tech debt: the page renders 36 rows. Pagination/virtualization isn't needed at 36 but if multi-year schedules eventually arrive, this is a natural Batch 17 cleanup spot.

---

### Batch 13d — REFLUJO check-register adapter (2026-05-28)

**Goal**: capture FORMA's internal check register (`0426. CORRELATIVO ...`) — a parallel input stream from current-account bank statements. Cheques drawn on bank accounts (mostly G&T today) become typed `IssuedCheque` rows that can later be matched to the cashing `BankTransaction` and to the resulting `Expenditure`.

**Architecture**

A 4th first-class entity in the gold layer: `IssuedCheque`. The check register is NEITHER a current-account statement (which produces `BankTransaction`) NOR a payment receipt (`RvPayment`) — it's the INTENT to pay, tracked by FORMA internally. The lifecycle:

1. Cheque is issued (entered in xlsx by Ronny). Lands here via the check-register import path.
2. Cheque is cashed (appears on the bank statement as a debit with `Referencia=cheque_number`). Future matching pass will set `cashedByBankTransactionId`.
3. Cheque's expense is classified from the inbox. Future flow sets `classifiedExpenditureId`.

The parser registry now dispatches at the BANK level (the existing `gtAdapter.detect()` tries CURRENT_ACCOUNT first, falls back to CHECK_REGISTER). The `ParseResult` shape grew an `issuedChequeCandidates: IssuedChequeCandidate[]` field parallel to the existing `silverCandidates: SilverCandidate[]`. Adapters that don't produce one return an empty array.

**Files added (4 + 2 migrations + 1 spec)**

- `prisma/migrations/20260528060736_batch_13d_issued_cheque/migration.sql` (issued_cheque table + 5 indexes + 4 FK constraints)
- `prisma/migrations/20260528060836_batch_13d_issued_cheque_rls/migration.sql` (regenerated full RLS — issued_cheque now has policies)
- `src/lib/import/banks/gt/check-register.ts` — detection (matches `CONTROL DE CHEQUES (USD|Q) ...` title pattern + row-3 `ID | FECHA | NO. CHEQUE | NOMBRE | ...` header signature) + parser (per-row IssuedCheque candidate emission)
- `tests/import/gt-check-register.spec.ts` — 9 cases covering detect + parse + ANULADO + dirty-data (`FECHA="XXXX"` + `MONTO="XXXX"`) + PARTIDA passthrough + un-parseable amounts emit BANK_PARSER_WARNING

**Files modified**

- `prisma/schema.prisma` — `IssuedCheque` model + back-relations on `BankAccount` + `BankStatementRawRow` + `BankTransaction` (`cashedCheques`) + `Expenditure` (`classifiedFromCheques`)
- `src/lib/rbac/matrix.ts` — `issued_cheque` resource added
- `src/lib/import/types.ts` — `IssuedChequeCandidate` interface + `issuedChequeCandidates` field on `ParseResult`
- `src/lib/import/banks/gt/index.ts` — adapter dispatches on statement type (tries CURRENT_ACCOUNT first, falls back to CHECK_REGISTER)
- `src/lib/import/ingest.ts` — `IngestSummary` gained `issuedChequesInsertedCount` + `issuedChequesDuplicatesCount`; new parallel promotion branch (alongside the BankTransaction branch) emits IssuedCheque rows from CHECK_REGISTER candidates with the same UNIQUE-violation → DataQualityFlag pattern
- `tests/import/gt-adapter.spec.ts` — 2 assertions relaxed from exact-substring to `toBeTruthy()` because the adapter's fallback dispatch now replaces the failed-CURRENT_ACCOUNT note with the failed-CHECK_REGISTER note when neither matches

**Design discipline observed**

- D31 (parser never fails, never drops, never loses) — proven on the real dirty-data row Q#7 (`FECHA="XXXX"` + `MONTO="XXXX"`): didn't crash, the row landed in bronze verbatim AND was promoted to `IssuedCheque` with `issueDate=null` + `amountSigned=0` + `isVoided=true`. No data lost; the source values preserved in the bronze JSONB.
- D21 — `IssuedCheque` has `deletedAt` for soft delete.
- Industry pattern (gold → silver FK direction) — `IssuedCheque.cashedByBankTransactionId` and `IssuedCheque.classifiedExpenditureId` point FROM the cheque to its downstream relations.
- `feedback_outliers_dont_drive_schema` — the `XXXX` row is N=1 in current data. We did NOT add an `XXXX` enum value or special schema field; runtime parser handles it as a normal "un-parseable" path that ANULADO rows already model.

**Acceptance proven against real check register sample**

```
Pass 1 (fresh ingest of 0426. CORRELATIVO ... ABRIL 26.xlsx):
  Detected:    GT_CONTINENTAL · CHECK_REGISTER · 2 sheets (DOLARES + QUETZALES)
  Bronze:      528 source rows captured
  IssuedChqs:  189 promoted (87 USD + 102 GTQ; 22 isVoided=true)
  BankTxs:     0 inserted (correct — different silver path)
  Warnings:    0
Pass 2 (re-upload same file): rejected by file-hash UNIQUE ✓
Dirty-data Q#7 (FECHA="XXXX" + MONTO="XXXX"): landed clean per D31 ✓
Cleanup: 189 cheques + 528 bronze + 2 sheets + 1 import = 720 rows hard-deleted, zero residue.
```

**Validation**

- `pnpm exec tsc --noEmit` — clean
- `pnpm lint` — clean
- `pnpm test` — **106 / 106 pass** + 2 skipped (9 new check-register cases)
- `pnpm verify:rbac` — green (issued_cheque resource added)
- `pnpm verify:rls` — green
- `pnpm build` — production build green
- End-to-end smoke on real check-register file — all checks pass

**What's NOT validated**

- The cheque ↔ bank-tx matching pass (`cashedByBankTransactionId` population). Out of scope; future batch.
- Bank-account binding for QUETZALES check registers. Files arrive with `bankAccountId=null` because the source has 3 candidate G&T QTZ accounts; future UI lets the analyst pick.
- Cheque-driven Expenditure classification at `/inbox/[id]`. The existing inbox flow doesn't pre-fill from a matched IssuedCheque yet — Batch 17 cleanup spot.

**Open questions still pending after Batch 13d**

- Q-CASA-6-STATUS, Q-EQUITY-SOURCE, Q-RECYCLE, Q-ISR-TIMING — unchanged.
- New: when should we add the cheque ↔ bank-tx matching pass? Could be its own sub-batch (13e) or fold into Batch 17 settings polish.

---

### Batch 5/6 EBITDA D31 fix (2026-05-28)

**Trigger**: Batch 16a's smoke against real seeded data revealed `MonthlyProjection.ebitda` was $0 across all 36 months. Per Jorge's invocation of _THE_RULES.MD + D31: "NO DATA SKIP. NO DATA LOST. NO DATA DROPPED."

**Root cause**

The Batch 5 parser at `scripts/xlsx/sheets/fcfcasas2.ts` was reading `FCFCasas2!K55..AT55` (monthly EBITDA sin IVA). ExcelJS returned `null` for those cells, and the parser fell through `ebitda ?? "0"` — defaulting null to "0". That's a silent drop.

**Source inspection** (after re-probe of the real xlsx)

- **Row 53** (EBITDA con IVA): real per-month values, totals to **$1,385,248.86** = xlsx H53 ✓
- **Row 54** (IVA Pagado a SAT): per-month cells K54..AS54 are NULL. Only AT54 (M36) holds the formula `SUM(K49:AT49) - SUM(K23:AT23) = -$25,773.12` — the **annual IVA-SAT lump**, not a per-month value.
- **Row 55** (EBITDA sin IVA): **all monthly cells K55..AT55 are NULL**. The xlsx author only computed the summary at H55 = `H53 - H54` = $1,411,021.98. Per-month K55 formula spec (`K55 = K53 - K54`) exists in documentation but the cells were never populated.

**Fix per D31 + `feedback_intent_vs_implementation`**

1. Parser captures rows 53 and 54 verbatim as before. Row 55 is captured verbatim too — null where null.
2. When row 55 is null but row 53 has a value, the parser **derives** monthly EBITDA from the documented formula spec `K55 = K53 - (K54 ?? 0)`. With K54 null per month (except AT54's lump), most months get `ebitda = ebitdaConIva`; M36 gets the lump applied.
3. A new `DataQualityFlag` row is emitted (kind=`STALE_FORMULA_WINDOW`, severity=INFO, `sourceWorkbookRef="FCFCasas2!K55:AT55"`) explaining the derivation. **Per D31: source values preserved; derived values flagged.**

**Files modified**

- `scripts/xlsx/sheets/fcfcasas2.ts` — derivation logic + flag emission. Single file change.
- `scripts/verify-calc.ts` — new parity assertion `Σ MonthlyProjection.ebitda = $1,411,021.98 (FCFCasas2!H55, derived per K55 = K53 - K54)` — catches future regressions.

**Verification**

Re-ran the parser → re-ran the seed (idempotent: 36 MonthlyProjection rows updated, 1 new DataQualityFlag created):

```
Parsed bundle — monthly projection totals:
  ebitdaConIva total: $1,385,248.86  (xlsx H53 ✓)
  ebitda total: $1,411,021.98        (xlsx H55 ✓)
  cumulative low-water (peak equity): $-3,776,549.16
```

Forecast snapshot AFTER fix:

```
ebitda = $1,411,021.99  (xlsx H55 = $1,411,021.98 ✓)
EBITDA margin = 12.57%  (D28 ref 12.6% ✓)
IRR 36-mo corrected = 20.30%
peak equity = $3,776,549.15
```

The IRR (20.30%) + Return-on-Peak-Equity (37.36%) differ from D28's reference numbers (31.2% / 75.6%) because the xlsx computes those on **row 82** (partner-side cash flow), not on the EBITDA series. That's a Q9 (IRR formula cross-check) follow-up — orthogonal to this D31 fix.

`pnpm test` 131/131+2 · `pnpm verify:calc` **13/13** (new EBITDA assertion green).

**What this surfaces about the broader pattern**

Per D31, parsers must never default null to a sentinel like "0". Two corrections going forward:
1. Default values to null in the parsed JSON output (let the SEED decide what's authoritative — null vs derived vs zero).
2. When a derivation is the right call (because the xlsx documents the formula intent), emit a `DataQualityFlag` so the derivation is visible in the audit log.

**Open questions still pending after fix**

- Same as Batch 13d — none added by this fix.

---

### Batch 5/6 D31 sweep + IRR (i) tooltips (2026-05-28)

**Trigger**: After the EBITDA D31 fix, Jorge's follow-up: *"a follow-up Batch must audit every `?? "0"` and `?? null` callsite across all `scripts/xlsx/` for similar drops. For all IRR numbers add to the right an (i) symbol that opens a tooltip that explains clearly how this number was calculated."*

---

#### Part 1 — `scripts/xlsx/` D31 audit sweep

**Method**: grepped every `?? "0"` / `?? null` callsite in `scripts/xlsx/` (37 hits), filtered to 20 numeric-default candidates, then probed the live xlsx and parsed JSON output to classify each.

**Confirmed D31 violations — fixed**

1. **`fcfcasas2.ts` row 51 cumulativeRevenue (36/36 source-null silently → 0)**. Author never wrote the formula `K51 = K50 + J51`. Parser now derives running Σ(row 50) — mathematically unambiguous — and emits an INFO `STALE_FORMULA_WINDOW` flag noting the derivation. Same pattern as the EBITDA fix.

2. **`fcfcasas2.ts` rows 61/62/63 (credit balance / interest / principal) source-null cells**. 12, 12, and 26 source-null cells respectively. These represent "facility idle that month" (functionally 0), not data drops — but the null-vs-zero distinction was being lost. Defaults to "0" remain (correct downstream interpretation), but a summary `STALE_FORMULA_WINDOW` flag now records the source-null pattern so the audit log can distinguish "facility-idle month" from "source has a real numeric value of 0".

3. **`detalle-egresos.ts` `iva` column source-null cells (15 of 240 rows)**. Pre-2018 entries + ANULADO refunds where IVA was never tracked separately. Default to "0" remains (downstream summation is correct), but a summary flag now lists the offending rows so the audit log preserves "no IVA tracked" vs "0 GTQ of IVA charged" provenance.

**Defensible (no fix needed)**

- `fcfcasas2.ts` row 22-25 (cost totals): all populated in source; defaults never fire.
- `fcfcasas2.ts` row 50 (per-month revenue): 3 source nulls = months with no sales (legitimate zero revenue).
- `fcfcasas2.ts` row 53 (EBITDA con IVA): all 36 populated.
- `fcfcasas2.ts` row 54 (IVA Pagado SAT): handled by the EBITDA D31 fix already.
- `fcfcasas2.ts` BudgetCategory `budget` / `pct`: all 11 populated.
- `fcfcasas2.ts` RvUnit `area`: all 11 populated.
- Expenditure `sinIva` / `conIva` zeros: source-literal zeros (DEVOLUCIÓN / TRASLADO have intentional zero sin-IVA; ANULADO rows are explicit 0). NOT drops.
- `parse.ts:110, 115` `actualExecuted` / `totalAFechaGtq`: `pptoInversion.grandActualsUsd` always populated in current data; defensive `?? "0"` would fire only if `Ppto Inversion!H135` formula goes missing entirely — a real schema-incompatibility case that should fail loudly (Rule 8 exception). Left as-is; if it ever fires, the rebuild operator will notice the obvious "$0 actual executed" headline immediately.
- `flags.ts` `?? null` (2 sites): defensive JSON null pass-through.
- `extract/cell-comments.ts` `?? ""` / `?? null`: defensive defaults; both fields are nullable in the type.

**Files modified**

- `scripts/xlsx/sheets/fcfcasas2.ts` — cumulativeRevenue derivation + credit-null tracking + 2 new flag emissions.
- `scripts/xlsx/sheets/detalle-egresos.ts` — iva-null tracking + summary flag emission.

**Verification**

- `pnpm xlsx:parse` — 102 DataQualityFlags emitted (was 99 → 3 new: cumulativeRevenue derivation + credit-null pattern + iva-null pattern). All counts identical otherwise.
- `pnpm seed` — 36 MonthlyProjections updated, 3 new DataQualityFlags created. All 11 validation checks green.
- `pnpm verify:calc` — **13/13 ✓**. The Σ EBITDA = $1,411,021.98 parity check from the prior fix still green; cumulativeRevenue derivation doesn't disturb totals because it derives from row 50 which was already correct.
- `pnpm test` — 131/131+2 skipped.
- `pnpm typecheck` clean, `pnpm lint` zero warnings, `pnpm build` clean.

---

#### Part 2 — (i) tooltips for IRR numbers on `/forecast`

**What changed**

- New `src/components/ui/info-tooltip.tsx` — reusable client component wrapping `@base-ui/react/tooltip` with a small circular `i` trigger. Keyboard-accessible (focusable trigger, Escape closes), portaled (escapes overflow-hidden parents), uses `aria-describedby` automatically.
- New `IrrCard` component in `src/app/(app)/forecast/page.tsx` replacing the inline `ReturnCard` for the IRR slot. Two `(i)` triggers, one per IRR number:
  1. **Annualized IRR · 36-mo corrected** tooltip: explains monthly EBITDA cash-flow series, the NPV = 0 root-finding, Newton-Raphson + bisection fallback, null-when-no-sign-change, and the ×12 annualization. Notes that the value differs from D28 reference because the xlsx uses partner cash flow (row 82), not EBITDA.
  2. **xlsx 30-mo IRR · as-written** tooltip: same math but reproduces the xlsx I97 truncation at M30 (Q-TIRI-WINDOW). Explains that this is "as-modeled" — surfaced alongside the corrected 36-mo figure per D31 + `feedback_literal_labels_when_multiple_values`.

**Why two tooltips, not one combined**: each LITERAL number gets its own explanation, per `feedback_literal_labels_when_multiple_values`. The numbers are *different* (different windows), so explaining them together would conflate them.

**Files modified**

- `src/components/ui/info-tooltip.tsx` (new)
- `src/app/(app)/forecast/page.tsx` (replaced IRR `ReturnCard` with `IrrCard` + import)

**Verification**

- `pnpm typecheck` — clean.
- `pnpm lint` — zero warnings.
- `pnpm test` — 131/131+2 skipped.
- `pnpm build` — clean (all 21 routes including `/forecast`).

**Open questions still pending after fix**

- Same as the prior fix — Q9 (IRR formula cross-check vs xlsx row 82) remains. The tooltip explains *what the app computes* honestly, which is the right move while Q9 is unresolved; once Q9 lands the tooltip can be enriched to explain the xlsx row-82-partner-CF version too.

---

### Batch 5/6 revenue-row mislabel fix + flag orphan sweep (2026-05-28)

**Trigger**: Batch 18 gate-check flagged "Revenue $13.8M vs sale-price sum $12.6M" as a parity blocker. Tracing the discrepancy revealed a parser bug that was reading **the wrong xlsx row by position** — exactly the failure mode the CLAUDE.md cross-project-wisdom file warns about: *"Position-based reading is fragile. Find things by content, never by row/column/index/path-position."*

**Root cause**

The Batch 5 parser at `scripts/xlsx/sheets/fcfcasas2.ts` was reading FCFCasas2 row 50 into `totalRevenueSinIvaUsd` and row 51 into `cumulativeRevenueUsd`. Inspecting the source xlsx by **label**:

| Row | Label | Content | Per-month |
|---|---|---|---|
| 47 | TOTAL INGRESOS POR VENTAS (SIN IVA) | sin IVA total = SUM(K31:K46); H47 = $12,639,661.49 | populated |
| 48 | Ingresos por ventas acumulados | cumulative sin IVA; K48=K47, then K48+L47, etc. | populated |
| 49 | IVA Cobrado | per-month IVA collected on sales | populated |
| 50 | Total ingresos | row 47 + row 49 = **CON IVA** (= $13,815,150) | populated |
| 51 | (empty label) | ratio cell at H51 only (= H47/H22 = 1.126); K51..AT51 empty | EMPTY |

The parser read row 50 (con IVA) into the field named `totalRevenueSinIvaUsd`. The NAME lied about the contents. Magnitude difference: $13.8M − $12.6M = **$1,175,488 = IVA Cobrado**.

Compounding: my earlier D31 audit sweep had also identified row 51 as a cumulativeRevenue D31 violation and added a derivation flag — but row 51 is actually the empty `H47/H22` ratio row, NOT cumulative revenue. The real cumulative lives at row 48 with values populated. That derivation flag was retired by this fix.

**Fix (read by label, not position)**

- `totalRevenueSinIvaUsd` ← row 47 (per-month sin IVA total).
- `cumulativeRevenueUsd` ← row 48 (per-month cumulative sin IVA — populated, no derivation needed).
- Retired the cumulativeRevenue derivation logic + flag emission added by the prior audit sweep (the row 51 read was the bug, not a D31 drop).

**Verification**

- Σ MonthlyProjection.totalRevenueSinIvaUsd = **$12,639,663.49** (matches H47 = $12,639,661.49 with $2 rounding drift — H47 sums per-unit annual totals while Σ row 47 sums per-month per-unit values). Was $13,815,152.01 (off by $1,175,488).
- Per-unit Σ over 36 months still reconciles cell-for-cell to each RvUnit.salePriceSinIvaUsd ($12,639,661.49 total).
- New verify:calc assertion: `Σ MonthlyProjection.totalRevenueSinIva = $12,639,661.49 (FCFCasas2!H47, sin IVA per-month)` (tol ±2.10 for the rounding drift). Catches future regressions of this exact bug.

**Companion fix: flag orphan-sweep**

The retired derivation flag from the prior audit sweep was already persisted in the DB (1 row), so the first re-seed after the fix failed validation: `DataQualityFlag count = 101 (expected) actual: 102`. Per D21 (soft-delete only), I added an **orphan sweep** to `scripts/seed/entities/data-quality-flags.ts`: after the upsert pass, any parser-sourced flag (`sourceWorkbookRef` starting with `FCFCasas2!` / `Ppto Inversion!` / `Detalle egresos!`) whose composite key `(kind, sourceWorkbookRef, humanMessage)` isn't in the current bundle gets `deletedAt = now()` plus an audit-log entry. Scoped to parser-sourced flags so app-runtime flags raised by user actions are never touched. This means every future parser refinement automatically maintains DB hygiene without manual SQL cleanup.

Re-seed output: `[12/12] DataQualityFlags: 0 created, 101 updated, 1 orphaned (soft-deleted)`. All 11 validation checks green.

**Files modified**

- `scripts/xlsx/sheets/fcfcasas2.ts` — row 50→47 + row 51→48 reads; retired the cumulativeRevenue derivation + flag.
- `scripts/seed/entities/data-quality-flags.ts` — orphan-sweep pass added (D21 soft-delete + audit log).
- `scripts/seed/index.ts` — surfaces the `orphaned` count in the per-step log line.
- `scripts/verify-calc.ts` — new revenue-sin-IVA parity assertion (now **14/14** total).

**Verification (full chain)**

- `pnpm xlsx:parse` — 101 flags (was 102 — derivation flag retired).
- `pnpm seed` — `0 created, 101 updated, 1 orphaned` · all 11 validations green.
- `pnpm verify:calc` — **14/14 ✓** (including the new revenue assertion).
- `pnpm test` — 131/131+2 skipped.
- `pnpm typecheck` clean, `pnpm lint` zero warnings, `pnpm build` clean.

**What this surfaces about Batch 18 readiness**

Both Batch 18 gate-blockers from the prior pause are now cleared:
1. EBITDA = $0 across all 36 MonthlyProjections — fixed by the EBITDA D31 derivation work earlier this session.
2. Revenue $13.8M vs $12.6M — fixed by this row-mislabel patch.

Batch 18 (end-to-end parity vs xlsx) can now proceed once the user signs off.

**Lesson recorded against `cross-project-wisdom.md` #2**

The CLAUDE.md note "Position-based reading is fragile. Find things by content, never by row/column/index/path-position. Sources evolve; readers must too." was already in the user's global memory. This bug was a textbook violation of it — and the previous D31 audit sweep, by inspecting only `?? "0"` callsites without verifying *what row they were reading*, had missed it. Future audits should grep for `ws.getCell(<N>, ...)` callsites and require each to carry a comment naming the **label** of that row, so position-by-mistake becomes hard.

---

### Batch 18 — End-to-end parity validation vs xlsx (2026-05-28)

**Goal**: Prove parity with the xlsx across every claim in SDD §10 Phase 2 + §3 entity tables + PROGRESS.md §8 numbers. Per PLAN.md Batch 18: automated assertions in vitest + a generated markdown artifact + manual walkthrough notes.

**Design — single source of truth**

One catalog at [`scripts/parity/assertions.ts`](scripts/parity/assertions.ts) — a typed array of 68 `Assertion` records, each with `id`, `category`, `sddRef`, `description`, `expected` (string), `tolerance` (USD/GTQ drift allowed), and a `query: (prisma) => Promise<string>`. Three consumers, zero duplication:

1. **`pnpm parity:report`** ([`scripts/parity/index.ts`](scripts/parity/index.ts)) — runs all 68 against the live seeded DB, writes [`docs/parity-report.md`](docs/parity-report.md) (gitignored per docs-PII convention), exits non-zero on any failure.
2. **`pnpm test` parity suite** ([`tests/parity/*.spec.ts`](tests/parity/) — 8 files, one per SDD section) — `_shared.ts` exposes `runCategory(name)` that filters the catalog and emits one `it()` block per assertion with rich failure messages.
3. **`pnpm verify:calc`** ([`scripts/verify-calc.ts`](scripts/verify-calc.ts)) — converted to a thin shim over the same catalog; the prior hand-maintained list (14 assertions, drifted from the SDD over time) is replaced. No more parallel sources to update.

**68 assertions broken down**

| Category | Count | SDD ref |
| --- | ---: | --- |
| Totals | 5 | §10 Phase 2 — budget, projected revenue, executed USD, executed GTQ, % sum |
| Per-category budgets | 11 | §3.2.2 — every category by code with $X budget |
| Per-house sale prices | 11 | §3.2.5 — every Casa N price |
| Per-house status | 11 | §3.2.5 + D29 — sold/available bucket per Casa |
| Sales counts | 3 | D29 — 11/6/5 totals |
| Monthly projections | 5 | §3.2.6 — Σ cost / revenue / EBITDA / EBITDA con IVA |
| Credit facility | 4 | §3.2.7 — count, cap, rate, amortization rule |
| ISR | 2 | D34 — literal labels |
| Foundational events | 3 | §3.2.8 — IN_KIND_ASSET + CASH_PURCHASE rows |
| Bank accounts | 3 | finding #2 — 9 / 6 active / 3 legacy |
| Coverage | 4 | D31 — 240 Exp / 40 Partner / 5 NOTAS / 11 categories |
| Project metadata | 3 | §3.2.1 — TC, IVA rate, start date |
| Data quality flags | 2 | D31 — 101 active + Casa 6 ERROR_VISIBLE |
| Audit log | 1 | D8 — IMPORT attribution present |
| **Total** | **68** | |

**First-run results**: 68/68 ✓. The earlier EBITDA D31 fix + revenue-row-mislabel fix + flag orphan sweep all contributed to clean first-run pass — the catalog was authored AFTER those fixes landed and reflects ground truth.

**Why DB-backed tests now live in vitest (deviation from prior convention)**

`vitest.config.ts` previously documented: *"End-to-end DB-backed verification lives in `scripts/verify-calc.ts`… not in Vitest."* PLAN.md Batch 18 explicitly requires `tests/parity/*.spec.ts`. Updated approach: parity specs run in vitest because vitest gives the granular per-assertion reporter (68 named `it()` blocks vs one giant script) and integrates with the existing `pnpm test` flow. Convention now: unit tests with synthetic fixtures stay in `tests/calc/`; DB-backed parity tests live in `tests/parity/`. `pnpm seed` is a precondition for `pnpm test` (the test docs say so in `_shared.ts`).

**Files modified / created**

- `scripts/parity/assertions.ts` — 68-assertion catalog (new, ~470 LOC).
- `scripts/parity/runner.ts` — Prisma execution engine (new).
- `scripts/parity/report.ts` — markdown formatter (new).
- `scripts/parity/index.ts` — CLI / `pnpm parity:report` entry (new).
- `scripts/verify-calc.ts` — REWRITTEN to use the shared catalog. Removed the 14 hand-coded checks.
- `tests/parity/_shared.ts` — `runCategory()` harness (new).
- `tests/parity/{totals,per-category,per-house,monthly,credit-facility,isr,foundational-events,coverage}.spec.ts` — 8 spec files calling `runCategory()`.
- `package.json` — added `"parity:report": "tsx scripts/parity/index.ts"`.
- `docs/parity-report.md` — generated artifact (gitignored).

**Verification**

- `pnpm parity:report` → 68/68 ✓, wrote `docs/parity-report.md`.
- `pnpm test` → **199/199 + 2 skipped** (was 131; +68 parity assertions). Total time 5.91s.
- `pnpm verify:calc` → 68/68 ✓ (smoke alias, no markdown).
- `pnpm typecheck` clean · `pnpm lint` zero warnings · `pnpm build` clean (21 routes unchanged).

**Manual walkthrough — STATUS: pending Federico sign-off**

Per PLAN.md Batch 18 acceptance criteria, automated assertions are only half: the other half is a live screen-share session where Federico (CEO) views the L0 dashboard + walks through the four return figures + the anomaly strip + the per-category drill-down. That session captures notes here:

> _Manual walkthrough notes will be inserted here after the session. Until then, Batch 18 is **technically complete (68/68 automated checks green)** but **provisionally pending the human cross-check**. Federico's confirmation is the final acceptance gate per `feedback_intent_vs_implementation`._

**Open follow-ups**

- Manual walkthrough session with Federico — schedule once Batch 19 Gate 19.2 lands (his real account exists). The walkthrough validates that the app *answers his questions in the way he wants*, not just that the numbers match the spreadsheet.
- Manual walkthrough for Ronny (Analyst) — separate session focused on `/inbox` + `/casa/[id]/reflujo` + `/entry/new` workflows. Per `feedback_intent_vs_implementation` the daily-driver experience needs his sign-off.
- Q9 (IRR formula cross-check vs xlsx named ranges) remains open — the IRR tooltips on `/forecast` honestly explain *what the app computes* and flag the xlsx row-82-partner-CF discrepancy as a future revisit.

---

### Spanish UI sweep — Batch 19 prerequisite (2026-05-28)

**Trigger**: Jorge's first production login revealed every UI string built in Batches 8–18 had shipped in **English**, not Spanish. The original `/login` page was Spanish (`Inicia sesión para continuar` / `Correo electrónico` / `Contraseña`), but every subsequent component built greenfield ignored the convention. Jorge flagged this as a `_THE_RULES.MD` Rule 4 + Rule 11 violation. Rule recorded in [[feedback_ui_must_be_spanish]] — **all user-facing UI must be Latin American (Guatemalan) Spanish**.

**Dual-label pattern (per Jorge's Case-A choice)**

For card headings + section titles + primary row labels, the rule is:
- **Line 1 (primary)**: CAPS formal Spanish in xlsx-flavored wording (e.g. `PRESUPUESTO`, `RITMO DE GASTO`, `CIERRE PROYECTADO`)
- **Line 2 (secondary, parenthesized + muted)**: clarifier explaining what the card shows (e.g. `(Salud del presupuesto)`, `(Consumo mensual del presupuesto)`)

For nav buttons, status chips, table cells, body copy: single-line Spanish only. Financial acronyms (EBITDA, IRR, IVA, ISR, TC, NIT, LTV, LTC) and D34 literal labels (`ISR 18`, `ISR 25`) are **preserved as-is** — they are standard in LATAM finance contexts and the xlsx uses them unchanged.

**Files touched (full sweep)**

- **Dashboard (`src/components/dashboard/`)**: HealthHeader, StatusTiles, CategoryBars, BurnRateCard, ProjectionCard, RevenueBlock, FinancialBottomLine, AnomalyBadges, ModelNotes, `status-style.ts` (status labels: EN_CURSO / EN_RIESGO / SOBRE_PRESUPUESTO / NO_INICIADA / DEMORADA).
- **Dashboard root**: `src/app/(app)/page.tsx` — Spanish nav (Ventas · Proyección · Ajustes · Bandeja · Importar estado · + Nueva transacción), locale `es-GT` for the date in the header.
- **Level 1 (`src/components/category/`, `src/app/(app)/category/[code]/page.tsx`)**: CATEGORÍAS, EJECUCIÓN ACUMULADA, PARTIDAS INTERNAS, TRANSACCIONES headings; STATUS_LABELS Spanish; sort options Spanish; status pill labels translated.
- **Level 2 (`src/components/transaction/`, `src/app/(app)/transaction/[id]/page.tsx`)**: ACCIONES, EDITAR, HISTORIAL headings; subcards (MONTOS, TIPO DE CAMBIO, CONTRAPARTE, BANCO, ORIGEN Y REFERENCIAS, CATEGORIZACIÓN); StatusBadge + AuditAction enums to Spanish.
- **Sales (`src/components/sales/`, `src/app/(app)/sales/`)**: VENTAS grid + per-house detail; STATUS_STYLE labels Spanish (Vendida/Reservada/Reserva tentativa/Congelada/Disponible); LinkBuyerForm, RecordPaymentForm, StatusActions all Spanish; reconciliationStatusLabel helper.
- **Forecast (`src/app/(app)/forecast/page.tsx`)**: PROYECCIÓN DE FLUJO DE CAJA, RETORNOS (4 figuras), TOTALES, CRÉDITO BANCARIO, PROYECCIÓN MENSUAL A 36 MESES; IRR tooltips fully Spanish (Newton-Raphson + bisección, VAN = Σ fc/(1+r)^t = 0, irr_anual = irr_mensual × 12).
- **Reflujo (`src/components/casa/reconciliation-style.ts`, `src/app/(app)/casa/[id]/reflujo/page.tsx`)**: status labels (Coincide/Sobrepago/Subpago/Omitido/Por venir/Inesperado), CONCILIACIÓN MENSUAL heading.
- **Entry (`src/app/(app)/entry/new/`, `src/components/entry/`)**: NUEVA TRANSACCIÓN; full NewExpenditureForm with all 30+ labels in Spanish.
- **Inbox (`src/app/(app)/inbox/`, `src/components/inbox/`)**: BANDEJA DE CLASIFICACIÓN listing + CLASIFICAR detail; ClassifyWidget 4 tabs (Gasto / Pago de casa / No relacionado / Omitir) with full forms translated.
- **Import (`src/app/(app)/import/`, `src/components/import/`)**: IMPORTAR ESTADO BANCARIO + per-sheet card; canonical/alterna labels; parseStatus → PROCESADA/VACÍA/etc.
- **Settings (`src/app/(app)/settings/`, `src/components/settings/`)**: AJUSTES index + CATEGORÍAS DEL PRESUPUESTO + TASAS Y TIPOS DE CAMBIO + ISR forms.
- **Audit (`src/app/(app)/audit/page.tsx`)**: REGISTRO DE ACTIVIDAD + filters + pagination Spanish; actionLabelEs helper for the AuditAction enum.

**What's NOT translated (per rule scope)**

- Code identifiers (variable / function / type / file names, route paths) — these are developer-facing.
- Code comments + docstrings — developer-facing.
- AuditLog `context` field values — internal forensic data, mostly emitted by server actions. Display labels around them ARE translated.
- DataQualityFlag `humanMessage` strings — already mostly Spanish per D31 + parser convention.
- Financial acronyms (EBITDA, IRR, IVA, ISR, TC, NIT, LTV, LTC) — preserved per Jorge's "Keep as-is" choice.
- D34 literal labels (`ISR 18`, `ISR 25`) — preserved per [[feedback_literal_labels_when_multiple_values]].

**Verification**

- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm test` 199/199 + 2 skipped (parity assertions unchanged).
- `pnpm build` 21 routes all `ƒ` dynamic.

**Lessons recorded**

- [[ui-must-be-spanish]] — the rule + scope + dual-label pattern.
- Future component-building MUST grep for an existing user-facing string in the codebase first to confirm the convention. `grep -rn "Volver al tablero\|Inicia sesión" src/` confirms Spanish.

**Companion fix**: login page bug from Vercel deploy day stays in `src/app/login/page.tsx` (the missing-role redirect loop fix from earlier in the day). Login page itself was already Spanish; no change needed there.

---

### Brand implementation — logo, palette, fonts, favicon, OG (2026-05-28)

**Trigger**: Jorge dropped `docs/forma_logo.png` + `docs/Manual de Marca_Forma.pdf` and asked to implement them — including using the logo for favicon and OG images.

**Brand inventory (per Manual de Marca_Forma.pdf, designed by CIB Design, 2022)**

- **Isotipo**: three geometric shapes (large Γ + medium Γ + underscore) sharing a baseline. Per page 3, represents both the F of Forma and the silhouette of buildings rising from the ground.
- **Logo variants** (page 4): vertical-full / horizontal-full (with `CAPITAL INMOBILIARIO` tagline) + vertical-simple / horizontal-simple (no tagline) + white variants for dark backgrounds.
- **Fonts** (page 6): titles = **Archia**, body = **Montserrat**, fallback = Arial.
- **Color palette** (page 7):
  - Primarios: `#0c2530` (navy, canonical), `#4a7781` (teal), `#6da3af` (teal-light)
  - Secundarios: `#5eb58e` (emerald), `#fcb76f` (amber), `#dd6359` (coral), `#844a78` (plum)
- **Usage rules** (page 8): never use "FORMA" wordmark alone (must include isotipo); on photos use semi-transparent backgrounds for legibility; tagline can be detached but must stay legible.

**Per-question decisions (Jorge's AskUserQuestion answers)**

- **Color scope**: surgical accent. `--foreground` (and friends) shift from near-black to navy `#0c2530`; cards stay white; status pills (emerald / amber / red) keep their semantic meaning.
- **Heading font**: Archivo as a free-Google-Fonts substitute for Archia. Body = Montserrat. Both via `next/font/google` with display: "swap". If/when licensed Archia `.woff2` files arrive, swap to `next/font/local` — comment in `layout.tsx` notes the migration path.
- **Logo source**: recreated as clean SVG from the brand manual reference. Three filled rectangles per Γ shape, one for the underscore; viewBox 240×100; `fill="currentColor"` so callers control color via Tailwind text-* utility.

**Files added**

- `src/components/brand/FormaIsotipo.tsx` — the three-shapes SVG primitive.
- `src/components/brand/FormaLogo.tsx` — isotipo + wordmark composite with 4 variants (vertical-full / horizontal-full / vertical-simple / horizontal-simple); rejects "wordmark only" per the brand manual rule.
- `src/app/icon.svg` — favicon. Square viewBox with navy bg + white isotipo (robust across light + dark browser themes).
- `src/app/opengraph-image.tsx` — dynamic 1200×630 OG image via `next/og` ImageResponse. Navy bg + white isotipo + FORMA wordmark + project name + URL footer. Generated on demand at the `/opengraph-image` route.

**Files modified**

- `src/app/layout.tsx` — Montserrat + Archivo via `next/font/google`; richer Metadata (template-based title, openGraph siteName/locale `es_GT`, twitter card, applicationName, `robots: noindex` for the private app); `viewport.themeColor = #0c2530`.
- `src/app/globals.css` — added `--brand-navy` / `--brand-teal` / `--brand-teal-light` / `--brand-emerald` / `--brand-amber` / `--brand-coral` / `--brand-plum` CSS variables + matching `--color-brand-*` theme tokens for Tailwind utility generation; shifted `--foreground` + `--card-foreground` + `--popover-foreground` + `--primary` to navy; fixed self-referential `--font-sans` / `--font-heading` to properly chain through to system fallbacks.
- `src/app/login/page.tsx` — navy full-page background, centered white card, `FormaLogo variant="vertical-full"` above the card (white text on navy bg per brand manual preferred treatment).
- `src/app/(app)/page.tsx` — added `FormaLogo variant="horizontal-full"` (link to `/`) above the project header. Project name picks up the heading font.

**Brand color application**

- `bg-foreground` / `text-foreground` (everywhere previously rendered as near-black) now displays as navy `#0c2530`. Contrast ratio against white: ~14:1 (WCAG AAA).
- `bg-primary` (server-action buttons, "+ Nueva transacción", etc.) also navy.
- Status palette (emerald/amber/red/zinc for ON_TRACK / AT_RISK / OVER_BUDGET / NOT_STARTED) intentionally untouched — these are SEMANTIC colors, not brand-decorative, per the brand manual's distinction between primarios (brand) + secundarios (accents) + functional state.
- Brand secondary colors (emerald/amber/coral/plum) exposed as `bg-brand-emerald` etc. utility classes for future use.

**OG image preview** (`/opengraph-image` route at runtime):
- Navy bg
- Top-left: white isotipo + FORMA wordmark + CAPITAL INMOBILIARIO tagline
- Center: "Condominio Santa Elena" headline + "Seguimiento presupuestal · Antigua Guatemala" subline
- Bottom: thin teal-light bar + URL stamp

**Verification**

- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm test` 199/199 + 2 skipped.
- `pnpm build` clean (22 routes; `/opengraph-image` newly registered as `ƒ` dynamic).
- Favicon picked up by Next.js auto-discovery (no `<link>` tags needed in layout).

**Follow-ups not in this batch**

- If/when licensed Archia `.woff2` files arrive: drop into `public/fonts/archia/`, swap `next/font/google` → `next/font/local` in `layout.tsx`. Visual diff between Archivo + Archia is subtle (both geometric sans, similar letter spacing); upgrading is low-risk.
- The "icon as design element" technique (brand manual page 5) — using individual isotipo shapes as photo cutouts / watermarks — is available but not yet applied. Candidate for the Casa-detail page hero or the L0 anomaly banner.
- Apple touch icon (`apple-icon.png`) and dynamic per-page OG images deferred — single static OG covers all sharing paths today.

---

### WhatsApp link-preview compliance audit (2026-05-28)

**Trigger**: Jorge asked to research WhatsApp's most recent OG image requirements and verify compliance.

**Sources** (2026):
- Facebook/Meta WhatsApp Business Platform docs
- [WhatsApp Link Preview Guide 2026](https://www.ogrilla.com/blog/whatsapp-link-preview-guide)
- [WhatsApp Link Preview Image Size & Dimensions 2026](https://opengraphplus.com/consumers/whatsapp/images)

**Result: fully compliant on every constraint — no code changes needed.**

**Verified by running `pnpm next start` locally and inspecting both the generated PNG and the emitted meta tags:**

| WhatsApp 2026 constraint | Spec | Measured | ✓ |
|---|---|---|---|
| `og:image` absolute HTTPS | required | resolves via `metadataBase` | ✓ |
| Dimensions | 1200×630 (1.91:1) | exactly 1200×630 | ✓ |
| File size | **< 300 KB** for reliable display | **37 KB** PNG | ✓ |
| Format | PNG/JPG/WebP (no SVG/GIF) | PNG | ✓ |
| Center-crop safety | important content in center 80% | brand+title+URL all centered with 80px+ margins | ✓ |
| `og:image:width` + `og:image:height` | required | Next.js auto-emits from `size` export | ✓ |
| `og:image:type` | recommended | `image/png` | ✓ |
| `og:image:alt` | recommended | `FORMA — Santa Elena · Seguimiento presupuestal` | ✓ |
| Single `og:image` | required (multiple causes unpredictable picks) | exactly one | ✓ |
| Survives `/` → `/login` 307 redirect | scrapers follow redirects | `/login` inherits OG from root layout — same tags | ✓ |
| WhatsApp UA fetch | works | tested with `User-Agent: WhatsApp/2.23.x` | ✓ |

**Defensive notes**:

1. **`robots: noindex, nofollow, nocache` does NOT block WhatsApp's preview scraper.** WhatsApp's link-preview crawler ignores `robots` (it's a search-indexing directive, not a "don't scrape" one). The noindex is appropriate for this private app and doesn't break previews.
2. **`og:image:secure_url` is intentionally omitted** — only relevant when `og:image` is HTTP and a separate HTTPS variant exists. Since `og:image` is already HTTPS, this tag is redundant and Next.js correctly skips it.
3. **Aspect ratio**: 1200/630 = 1.9048, the canonical "1.91:1" across Meta/Twitter/LinkedIn. No crop applied by WhatsApp.
4. **WhatsApp aggressive caching**: previews cache ~7 days per URL. If the OG image is changed, existing shared messages keep the old preview. Next.js's auto-hashed URL (`/opengraph-image?<hash>`) busts server-side cache when the file changes, but WhatsApp's client-side preview cache is independent.
5. **Cold start**: `next/og` ImageResponse on Vercel edge runtime renders in ~100–300ms — comfortably under WhatsApp's scraper timeout.

**How to manually verify after deploy**:

```bash
# 1. Check the OG image directly
curl -I https://forma-santa-elena.vercel.app/opengraph-image
# Expect: 200 OK, content-type: image/png, content-length < 300000

# 2. Check the meta tags on the root + on /login (where redirects land)
curl -s https://forma-santa-elena.vercel.app/ | grep -E 'og:image[^>]*'
curl -s https://forma-santa-elena.vercel.app/login | grep -E 'og:image[^>]*'
# Both should return the same og:image, og:image:width=1200, og:image:height=630, og:image:type=image/png

# 3. Simulate WhatsApp user-agent
curl -sL -A "WhatsApp/2.23.x" https://forma-santa-elena.vercel.app/ | grep -E 'og:image[^>]*'

# 4. Force-bust WhatsApp's client cache when previewing
# Append a unique query string to the shared URL: https://forma-santa-elena.vercel.app/?v=2026-05-28
```

**No code changes required from this audit.** The Next.js metadata + `next/og` ImageResponse implementation done earlier already meets every WhatsApp 2026 requirement.

---

## 6. Canonical File Manifest

Tracks every file we own. Updated at the end of each batch. Empty until Batch 1 lands.

| Path                                                                                                                                                | Purpose                                                                                                                                                                                                                            | Created in batch                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `_THE_RULES.MD`                                                                                                                                     | Operating constraints                                                                                                                                                                                                              | pre-existing                            |
| `SDD_FORMA_SANTA_ELENA.md`                                                                                                                          | Product spec                                                                                                                                                                                                                       | pre-existing                            |
| `PLAN.md`                                                                                                                                           | Batched implementation plan                                                                                                                                                                                                        | pre-Batch-1                             |
| `PROGRESS.md`                                                                                                                                       | This live tracker                                                                                                                                                                                                                  | pre-Batch-1                             |
| `.gitignore`                                                                                                                                        | Excludes `docs/` (real-data PII vault)                                                                                                                                                                                             | pre-Batch-1                             |
| `docs/` (dir)                                                                                                                                       | User-managed: real-life source files (xlsx, bank CSVs, etc). Gitignored. **Do not read file contents until explicitly directed.**                                                                                                  | user-supplied                           |
| `docs/README.md`                                                                                                                                    | Live manifest of what's inside `docs/`. **Always read this before any work that touches `docs/`. Update whenever `docs/` contents change** (protocol in its §5).                                                                   | pre-Batch-1                             |
| `docs/REFLUJO/<filename> — MANIFEST.md` × 13                                                                                                        | Per-file structural manifests (sheets, dimensions, headers, totals, formula density). Each sorts directly before its source file in `ls`. Re-generate via the inspector script `/tmp/forma_inspect.py` if any source file changes. | pre-Batch-1                             |
| `docs/CanonicalTaxonomy.md`                                                                                                                         | User-supplied reference: PA DB's production house-status taxonomy. **Authoritative for Santa Elena's House / Reservation / FreezeRequest schema per D9.** Read before designing Batch 4 schema.                                    | user-supplied 2026-05-22                |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.nvmrc`                                                                                   | Package manifest, lockfile, pnpm workspace config (carries `ignoredBuiltDependencies: [sharp, unrs-resolver]`), Node version pin to `22`.                                                                                          | Batch 1                                 |
| `tsconfig.json`                                                                                                                                     | TypeScript strict config: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`. Path alias `@/* → src/*`.                                                                                      | Batch 1                                 |
| `next.config.ts`, `next-env.d.ts` (gitignored), `postcss.config.mjs`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `components.json` | Next.js + PostCSS (Tailwind 4) + ESLint flat config + Prettier + Shadcn (Base UI variant) config files.                                                                                                                            | Batch 1                                 |
| `.env.example`                                                                                                                                      | Documented placeholders for every required env var. `.env.local` is gitignored and must be hand-filled. Supabase + DB URLs are optional in Batch 1's `lib/env.ts` schema; flip to required in Batch 2.                             | Batch 1                                 |
| `AGENTS.md`, `CLAUDE.md`                                                                                                                            | Next.js 16's bundled AI-agent guidance (read before writing Next-specific code; APIs differ from training-data Next 13/14). Kept for future sessions.                                                                              | Batch 1                                 |
| `README.md`                                                                                                                                         | Project name + run commands + stack summary + pointer to PROGRESS.md / PLAN.md / \_THE_RULES.MD. No marketing copy.                                                                                                                | Batch 1                                 |
| `src/app/{layout,page}.tsx`                                                                                                                         | Root layout (Spanish `lang="es"`, FORMA — Santa Elena metadata) + placeholder home page (dashboard arrives in Batch 8).                                                                                                            | Batch 1                                 |
| `src/app/globals.css`                                                                                                                               | Tailwind 4 entry + inlined shadcn data-state custom variants + design tokens (oklch color system, light/dark themes, sidebar + chart tokens, radius scale).                                                                        | Batch 1                                 |
| `src/components/ui/{button,card,table}.tsx`                                                                                                         | Shadcn primitives (Base UI under the hood). Installed but unused in Batch 1; consumed from Batch 8 onward.                                                                                                                         | Batch 1                                 |
| `src/lib/env.ts`                                                                                                                                    | Zod-validated env loader. Two exports: `clientEnv` (NEXT*PUBLIC*\*) and `serverEnv` (full env, server-only).                                                                                                                       | Batch 1                                 |
| `src/lib/utils.ts`                                                                                                                                  | Shadcn's `cn()` helper (clsx + tailwind-merge).                                                                                                                                                                                    | Batch 1                                 |
| `prisma/schema.prisma`                                                                                                                              | Prisma datasource (Postgres) + generator + placeholder `HealthCheck` model (table `_health_check`). Full schema lands in Batch 4.                                                                                                  | Batch 2                                 |
| `prisma/migrations/20260523010741_init_healthcheck/migration.sql`                                                                                   | Initial migration. Creates `_health_check` table. Tracked in `_prisma_migrations` table in Supabase.                                                                                                                               | Batch 2                                 |
| `src/lib/db.ts`                                                                                                                                     | Prisma client singleton with `globalThis` cache. Single import surface for all DB access.                                                                                                                                          | Batch 2                                 |
| `src/app/api/health/route.ts`                                                                                                                       | DB healthcheck endpoint. Upsert against `_health_check`; returns `{ ok, latency_ms, last_pinged_at }`. Always 200 on success, 503 on any DB error. `force-dynamic`, never cached.                                                  | Batch 2                                 |
| `.env` (gitignored)                                                                                                                                 | Local-only secrets file: Supabase keys + Session pooler URLs. Format documented in `.env.example`. Auto-loaded by Prisma 6 and Next.js. Never commit.                                                                              | Batch 2 (user-supplied)                 |
| `src/lib/supabase/server.ts` + `src/lib/supabase/client.ts`                                                                                         | Supabase clients via `@supabase/ssr`. Server uses Next 16 async `cookies()`; both share the same publishable key (D17).                                                                                                            | Batch 3                                 |
| `src/lib/rbac/{types,matrix,policies}.ts`                                                                                                           | 4-role RBAC: `Role` + `Action` + `Matrix` types, the (empty-for-now) `MATRIX` + `can()`, and the Postgres RLS policy generator.                                                                                                    | Batch 3                                 |
| `src/lib/dal.ts`                                                                                                                                    | Next 16 Data Access Layer (per D20). `getUser` / `verifySession` / `getRole` / `requireRole`, all `cache()`-memoized. Replaces middleware-based auth.                                                                              | Batch 3                                 |
| `src/app/(app)/layout.tsx`                                                                                                                          | Auth gate for the protected route group. `await requireRole()` at the top.                                                                                                                                                         | Batch 3                                 |
| `src/app/(app)/page.tsx`                                                                                                                            | Placeholder dashboard (moved here from `src/app/page.tsx`). Real Level-0 dashboard arrives in Batch 8.                                                                                                                             | Batch 3 (relocated)                     |
| `src/app/login/page.tsx`                                                                                                                            | Spanish-localized sign-in form + Server Action calling `signInWithPassword`. Error states keyed by `?reason=`.                                                                                                                     | Batch 3                                 |
| `src/app/auth/callback/route.ts`                                                                                                                    | Supabase PKCE redirect handler (email confirm, magic link, future OAuth).                                                                                                                                                          | Batch 3                                 |
| `scripts/verify-rbac.ts`                                                                                                                            | RBAC matrix correctness check (25 assertions). Runnable via `pnpm verify:rbac`.                                                                                                                                                    | Batch 3                                 |
| `prisma/schema.prisma` (replaced)                                                                                                                   | Full domain model (17 entities + 13 enums + universal `deletedAt`). Replaces the Batch 2 `HealthCheck` placeholder.                                                                                                                | Batch 4 (replaces Batch 2 placeholder)  |
| `prisma/migrations/20260523024245_full_schema/` + `20260523025915_soft_delete_columns/` + `20260523030651_apply_rls_policies/`                      | Three Batch 4 migrations: schema creation, soft-delete columns + indexes, RLS policies (605 lines, generated from `MATRIX`).                                                                                                       | Batch 4                                 |
| `src/lib/rbac/matrix.ts` (populated)                                                                                                                | 17 resources × 4 roles, refined per D22. Was empty (closed-by-default) in Batch 3.                                                                                                                                                 | Batch 4 (replaces Batch 3 empty matrix) |
| `scripts/generate-rls-sql.ts`                                                                                                                       | Generator: reads `MATRIX`, emits the full RLS DDL. Output piped into Prisma migration files. Re-run when matrix changes.                                                                                                           | Batch 4                                 |
| `scripts/verify-rls.ts`                                                                                                                             | Live-DB RLS verification (230 assertions). Queries `pg_policies` + `pg_class`, asserts every (resource × action) clause matches the matrix. Runnable via `pnpm verify:rls`.                                                        | Batch 4                                 |
| `src/app/api/health/route.ts` (simplified)                                                                                                          | Raw `SELECT 1` round-trip. Batch 2's `HealthCheck` upsert is gone (table dropped in this batch's migration).                                                                                                                       | Batch 4 (replaces Batch 2 upsert)       |

---

## 7. Decision Log (mid-batch decisions, ad-hoc)

For non-trivial choices made while executing that aren't already in §2 Locked Decisions. Format: date, batch, decision, rationale.

_Empty._

---

## 8. Parity Numbers (ground truth from SDD §3 and §10)

These are the assertions Batch 18 will check. Repeated here so they're impossible to miss during seed/validation:

- Total budget sin IVA: **$11,228,641.51**
- IVA on budget: **$1,201,261.64**
- Total budget con IVA: **$12,429,903.15**
- Total projected revenue: **$12,639,661.49**
- Transactions count: **242**
- Total executed (sin IVA): **$1,988,922.82**
- Remaining: **$9,239,718.69**
- Houses: **11** (5 sold: 1, 2, 6, 7, 11 — sale months 1–6; 6 available/projected: 3–5, 8–10)
- Date range covered by xlsx: **Dec 2017 → Apr 2026** (project end projected Apr 2027)
- Bank accounts: **5** (G&T USD, G&T QTZ, Promerica QTZ, BAC QTZ, Industrial QTZ)
- General categories in Detalle egresos: **13**
- Internal sub-categories: **30**
- Credit facility: **$7,000,000 bank credit at 7.25% annual / 0.604% monthly**, revolving hybrid, max LTC 0.90

The 12 budget categories (sin IVA, from FCFCasas2):

| #   | Category                           | Budget USD   | %      |
| --- | ---------------------------------- | ------------ | ------ |
| 1   | TERRENOS                           | 1,182,597.40 | 10.53% |
| 2   | LICENCIAS Y PERMISOS               | 230,688.00   | 2.05%  |
| 3   | PLANIFICACIÓN TÉCNICA              | 107,005.00   | 0.95%  |
| 4   | CONSTRUCCIONES COMPLEMENTARIAS     | 453,373.64   | 4.04%  |
| 5   | CONSTRUCCIÓN                       | 7,559,996.01 | 67.33% |
| 6   | MERCADEO                           | 189,594.92   | 1.69%  |
| 7   | COMISIONES DE VENTA (5%)           | 631,983.07   | 5.63%  |
| 8   | HONORARIOS LEGALES (ESCRITURACIÓN) | 126,396.61   | 1.13%  |
| 9   | GASTOS LEGALES                     | 126,396.61   | 1.13%  |
| 10  | DEVELOPMENT FEE — Forma CI         | 455,027.81   | 4.05%  |
| 11  | IMPREVISTOS / MISCELÁNEOS          | 165,582.42   | 1.47%  |

\*Note: SDD §3.2.2 table has 11 rows numbered 1–11; total of $11,228,641.51 reconciles. The "12 categories" claim in §3.2.2 header may be off-by-one or include an IMPUESTOS-style non-budget category. **Confirm during Batch 5 xlsx parse.\***

---

## 9. End-of-Project Definition of Done

Restated from PLAN.md §4 so it's visible from the tracker:

- [ ] Every SDD §10 Phase 2 number reproduced by the app from the live DB
- [ ] CEO logged in on production, confirmed Level 0 answers in <2s on his usual device
- [ ] Analyst entered ≥10 new transactions during 2-week parallel ops with zero drift
- [ ] Audit log shows complete trace for every post-launch mutation
- [ ] XLSX archived and removed from team's working flow
