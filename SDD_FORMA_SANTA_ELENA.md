# Software Design Document

## FORMA — Condominio Santa Elena Budget Tracker

### Version 0.4 — May 25, 2026 (Post-deep-inspection corrections)

> **What changed v0.3 → v0.4:** comprehensive deep + visual + cross-sheet inspection of the canonical workbook, plus a Ronny interview (analyst-level questions) and 6 corrections from the user during specification lock. **35+ findings** changed the data model, parity numbers, calculation semantics, and the parser/seed architecture. Highlights below; full per-decision detail in [PROGRESS.md](PROGRESS.md) Section 2 (D1-D35) and the workbook manifest at `docs/CONCILIACIÓN/04. MODELO PRESUPUESTARIO AL 210526 terminado (rrivas) vr2 — MANIFEST.md`.

---

## 0. Change Log (v0.3 → v0.4)

### Foundational architecture principle (D31)

**THE PARSER DOES NOT FAIL — neither loudly nor silently.** Both halves matter equally. Not loudly = no exceptions, no exit codes ≠ 0, no aborts. Not silently = no dropped rows, no lossy normalization, no filtered values, no coerced values. Every input cell with content is captured verbatim; anomalies become first-class `DataQualityFlag` rows. The APP surfaces discrepancies with provenance ("from xlsx" vs "from app calc"); never silently override. "Resilient" alone is ambiguous (can be misread to authorize silent failure) — the canonical short name is **"parser does not fail and does not drop data."**

### Data model expansions (new entities)

- **`DataQualityFlag`** (D31) — first-class entity for parser-detected anomalies (16+ kinds; severity spectrum)
- **`PartnerContribution`** + `ContributionSource` (D33) — partner equity flows, both CASH and IN_KIND (the Q9.1M 2018 terreno aportación + Q1.5M 2025 cash payment are seeded as separate events)
- **`IsrObligation`** (D34) — supports multi-rate ISR regimes; **both ISR 18 and ISR 25 rates are seeded as literal labels** (NOT abbreviated to "Effective"/"Nominal" — per UI directive)
- **`AmortizationRule`** (D33) — `CreditFacility` 1-to-many; supports evolving amortization mechanisms over the credit life
- **`Counterparty`** (or extended `Partner.type` enum from 3 → 5 values) — 5-category typology: VENDOR | TAX_AUTHORITY | BANK_AS_COUNTERPARTY | INTERNAL_ENTITY | INTERNAL_INDIVIDUAL
- **`InvestmentPhase`** (D24) — already-modeled per Batch 4; Fase 1–5 operator-side capital-deployment milestones (distinct from buyer-side 3-phase sale model per [[reference_sale_phases]])

### Parity number corrections (live totals supersede SDD §3.2.4 stale figures)

- **`Total executed: $2,001,163.72 USD`** (Ppto Inversion row 135 — live) supersedes `$1,988,922.82` (row 128 — stale snapshot). Both verified via direct cell extraction; row 135 = row 128 + row 132 (extra Licencias y Permisos line).
- **`Total executed GTQ: 15,408,960.63`** (verified across Ppto Inversion ED71 + Detalle egresos F5, single currency).
- **`Total budget sin IVA: $11,228,641.51`** unchanged (matches across FCFCasas2!H22 + Ppto Inversion!H62 + new row 135 grand budget).
- **`Total projected revenue: $12,639,661.49`** unchanged (FCFCasas2!H47 = Ppto Inversion!H76).
- **N3 in PROGRESS.md** explicitly says "use live parser output as ground truth; SDD §3 numbers are historical reference." This SDD version aligns with N3.

### Sheet scope (N6 + post-inspection confirmation)

Parser reads only **3 sheets**: `FCFCasas2` + `Ppto Inversion` + `Detalle egresos`. The other 6 (`resumen`, `FCFCasas` _(alternative high-revenue scenario, NOT a prior version)_, `FCF `_(trailing space; 27-unit historical template)_, `Gstos ProyectOct24`, `CB_DATA_`, `Estado de Resultados`) are explicitly skipped with documented reasons. Parser names what it reads and refuses anything unrecognized.

### Bank accounts (corrected count)

**9 distinct bank accounts** (not 5 as originally documented). 6 active + 3 legacy:
- Active: `G&T 002-0027233-2 (QTZ)` 94 tx, `G&T 002-9900597-5 (USD)` 87 tx, `PROMERICA 12331050054637 (QTZ)` 16, `PROMERICA 12555020002031 (QTZ)` 12, `BAC 90-326385-3 (QTZ)` 11, `INDUSTRIAL 547-001333-4 (QTZ)` 2.
- Legacy: `G&T 02-0014055-8 (QTZ)` 7, `BAC 90-149804-8 (QTZ)` 1, `G&T 02-0019053-5 (QTZ)` 1.

### Currency model (corrected from "mixed currency" to "GTQ-only ledger")

All MONTO values in Detalle egresos are GTQ regardless of which bank account is used (verified: USD-account rows have IVA = exactly 12.00% of MONTO SIN IVA = the Guatemalan IVA rate). The `Banco` column tells which bank account paid (account currency); the MONTO columns are GTQ-equivalent recordings. Schema: `Expenditure.amountGtq` is a single signed Decimal field. Original USD amounts for USD-account transactions live only on bank statements (Batch 13 reconciliation).

### Exchange rate model (4-way ambiguity)

The TC ambiguity has **4 sources** (not 2): `G2 = 7.7` (advertised), `I2 = "TC 7.8 PARA PRESUPUESTO"` (budgeting), `N4 = 7.6922` (historical effective from 2018 terreno math), and **per-transaction TC values embedded in Descripción** as `(T.C. - Q.X.XXXXXX)` patterns (20+ transactions). The parser must regex-extract per-tx TC values; without them, USD reconstruction is off 0.5–1% per transaction.

### Project history metadata (D30 — new findings)

- Original plan: **12 houses**; municipality rejected → forced revision to **11 houses**; internal approval **2025-04-22** (handwritten on the workbook).
- Model author: **Lic. Federico Javier Franco Jimenez** (CEO of FORMA per [[forma-team-roles-and-access-pattern]])
- Recent editor: **Ronny Rivas** (`rrivas` per filename — Analyst of FORMA)
- Legal representative: **Aguedo Ivan Escobar Velasquez**
- Property address: **5TA AVE. SUR FINAL, FINCA PAVON Y MATAMBO LOTE 3, SAN PEDRO EL PANORAMA, ANTIGUA GUATEMALA, SACATEPEQUEZ**
- Original landowner: **ANA DIAZ DURAN DURAN** (cash purchase 2025-06-16)
- 5 verbatim Spanish NOTAS (`Project.modelNotes` per D32) — preserved as authoritative model documentation.

### Sold/unsold buckets (D29 — operational override)

- **Sold**: {1, 2, **5**, 6, 7, 11} (6 units). Casa 5 added by operational override (D29) despite workbook note 5 excluding it; Casa 5 is in active renegotiation pending Q-CASA-5. Casa 6 retains sold-bucket membership despite a $487K USD enganche refund in Dec-25 (Q-CASA-6-STATUS pending).
- **Unsold**: {3, 4, 8, 9, 10} (5 units).

### Foundational events: terreno acquired in TWO events

- **2018-02-15:** Q9,096,780 **APORTACIÓN NO DINERARIA** (in-kind contribution by Condominio Antigua Panorama, S.A.)
- **2025-06-16:** Q1,535,506 **CASH PAYMENT** to Ana Diaz Duran Duran (original landowner)
- Combined Q10,632,286 = Ppto Inversion ED8 actuals
- Both seeded as separate `PartnerContribution` rows (`kind: IN_KIND_ASSET` and `kind: CASH_PURCHASE`).

### Casa 6 enganche refund (Q-CASA-6-STATUS — open)

- 2025-12-03: original buyer (Liza Johanna Castillo Beltranena) withdrew (desistimiento); Q3,751,493.90 refund issued.
- Per D31: parser captures both the refund event AND workbook note 5's "sold" classification verbatim; `DataQualityFlag.kind='UNIT_STATUS_CONTRADICTS_REFUND'` links the two. Casa 6 stays in sold bucket pending operational confirmation.

### Open questions (carried forward)

Section 4 of PROGRESS.md tracks 30+ open questions, organized by routing (Federico-gated, Ronny-answerable, external bank/tax). Highlights still open: **Q-CASA-6-STATUS** (high priority), **Q-30-TO-36-EXTENSION** (Federico), **Q-TIRI-WINDOW** (Federico — bug confirmed, intent unknown), **Q-CALENDAR-GAP** (Federico), **Q-EQUITY-SOURCE** (Federico), **Q-RECYCLE** (bank), **Q-ISR-TIMING** (tax advisor), **Q-MISSING-PARTIDAS** (Ronny — operational cleanup), **Q-NEGATIVE-REVENUE** (resolved → was the Casa 6 refund).

---

## 1. Problem Statement

FORMA manages a real estate development project (Condominio Santa Elena, Antigua Guatemala) using a single Excel workbook with 9 sheets, 137 columns, and ~300 transaction rows. The workbook tracks a **$12.4M+ budget** across 12 cost categories, a **36-month cash flow model** for 11 houses, and a **transaction-level expenditure log** fed manually from bank statements, checks, and invoices.

The CEO's operating model is simple: one question — **"How are we against the budget?"** — answered instantly, with the ability to drill down into any anomaly. The current xlsx cannot deliver this. It requires someone to manually reconcile bank data, cross-reference invoices, and navigate a 137-column sheet to answer what should take 2 seconds.

---

## 2. Mission

Build a web application that:

1. **Answers "how are we against the budget?" in under 2 seconds** — the CEO's single question, answered visually, at a glance, any time.
2. **Enables systematic drill-down** — from high-level budget health → category → sub-category → individual transaction, entirely through UI navigation (no spreadsheet skills required).
3. **Completely replaces the xlsx** — all data entry, all formulas, all tracking, all reporting. Zero reason to go back.

### 2.1 Dashboard Design Philosophy: Anomaly Detector, Not Summary

The CEO's dashboard is not a budget summary. It is an **anomaly detector**.

The CEO manages remotely. He cannot walk the construction site daily. The dashboard must surface what can **surprise** him — categories where human judgment, theft, rework, scope creep, vendor mismanagement, or on-site chaos can silently blow up costs. These are the categories that need condensed, real-time visibility.

Categories like IMPUESTOS (taxes) are money and must be tracked in the system, but they don't belong on the main dashboard because they are **predictable**. You don't wake up to discover taxes doubled overnight. You do wake up to discover that materials got stolen, work got done incorrectly and must be repeated, or a subcontractor invoiced for phantom deliverables.

**Rule**: The main dashboard shows only categories where budget overruns are **actionable** — where seeing the problem early enough means the CEO can intervene. Predictable, non-actionable expenditures (taxes, fund transfers, fixed fees) are tracked in the system and accessible in detail views, but excluded from the Level 0 anomaly surface.

---

## 3. Data Model (Reverse-Engineered from XLSX)

### 3.1 Source Sheets → App Domains

| XLSX Sheet          | Purpose                                                                                                                                                        | App Domain             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **FCFCasas2**       | Cash flow forecast: 11 houses, 36-month timeline. Budget per category, monthly projected spend/income, EBITDA, credit facility, IRR, ROI.                      | **Forecast Engine**    |
| **Ppto Inversion**  | Detailed construction budget: line items with unit costs, quantities, monthly planned spend across 112 months (Dec 2017 → Apr 2027). Budget vs actual summary. | **Budget Master**      |
| **Detalle egresos** | Transaction log: 242 actual transactions, each with bank, date, vendor, amounts (with/without IVA), description, internal category, general category.          | **Expenditure Ledger** |

### 3.2 Core Entities

#### 3.2.1 Project

> **v0.4 — significant expansion per D30 (project history metadata), D34 (both ISR rates literally), and inspection findings (address, original landowner, model notes).** The single `isr_rate: 0.18` field is replaced by a separate `IsrObligation` entity (§3.2.10).

```
Project {
  id: uuid (v7 per _THE_RULES.MD)
  name: "Condominio Santa Elena"
  legalEntityName: "Condominio Antigua Panorama, S.A."  // D30
  company: "FORMA Capital Inmobiliario, S. A."
  location: "Antigua Guatemala"
  address: "5TA AVE. SUR FINAL, FINCA PAVON Y MATAMBO LOTE 3,
            SAN PEDRO EL PANORAMA, ANTIGUA GUATEMALA, SACATEPEQUEZ"  // D30 / new
  currency_primary: "USD"
  currency_secondary: "GTQ"
  // TC ambiguity (4 sources) — see §7.7 v0.4. Single locked field
  // remains the budget-comparison anchor.
  locked_exchange_rate: 7.7                  // = G2 "advertised"
  tc_budgetary_label: "TC 7.8 PARA PRESUPUESTO"  // I2 (text, info only)
  tc_effective_terreno_historical: 7.6922    // N4, 2018-era
  // (Per-transaction TC for individual expenditures lives on the
  // Expenditure entity — see §3.2.4 v0.4.)
  iva_rate: 0.12                             // Guatemala IVA (12%)
  // ISR — split into IsrObligation entity per D34. Both ISR 18 and
  // ISR 25 are deliberate per Federico; surfaced literally in UI.
  // Project no longer carries a single isr_rate.
  start_date: "2025-05-06"                   // FCFCasas2!K5 (Santa Elena timeline)
  projected_end_date: "2028-05-06"           // FCFCasas2!AT5 (timeline end)
  internal_approval_date: "2025-04-22"       // D30 (handwritten on workbook)
  regulatory_history_note: "Original plan was 12 houses;
    municipality rejected, reduced to 11 (internal approval 2025-04-22)"
  total_budget_sin_iva: 11_228_641.51         // FCFCasas2!H22 + Ppto Inversion!H62
  total_budget_con_iva: 12_429_903.15         // FCFCasas2!H24
  total_projected_revenue: 12_639_661.49      // FCFCasas2!H47 + Ppto Inversion!H76
  // Project history + author metadata (D30)
  model_author_name: "Lic. Federico Javier Franco Jimenez"     // FCFCasas2!C133
  model_recent_editor_name: "Ronny Rivas"                       // filename "(rrivas)"
  legal_representative_name: "Aguedo Ivan Escobar Velasquez"   // FCFCasas2!C141
  original_landowner: "ANA DIAZ DURAN DURAN"                   // Detalle egresos row 138
  // Author's verbatim NOTAS — D32 + feedback_intent_vs_implementation
  // Five Spanish strings preserved as-is from FCFCasas2!A105:A110
  model_notes: text[]                        // 5 entries; never translate
  // Soft delete invariant (D21)
  deleted_at: timestamptz?
}
```

#### 3.2.2 Budget Categories — three views, all derive from same underlying data

> **v0.4 — clarification.** The workbook carries **3 different category rollup views** which drift apart over time (per ETL wisdom #6). The app aggregates fresh from `Expenditure` rows by partida + month; the 3 views become validation targets, not source-of-truth.

| View | Where | Count | Notes |
|------|-------|-------|-------|
| **CEO dashboard view** (canonical for the L0 dashboard per D25/D27/D28) | `FCFCasas2!A10:I20` | **11** | The view documented below |
| Numbered budget categories (Ppto Inversion) | `Ppto Inversion!rows 8-56` | 10 numbered ([1]–[10]) + 2 nested sub-parents under [2] | The 3-level partida hierarchy per N4 / §3.2.3 |
| EJECUTADO Q/$ flattened breakdown (frozen historical snapshot at TC 7.75) | `Ppto Inversion!rows 90-128` | 12 | Per D31 / N3 this is a historical snapshot, not live state |

##### CEO dashboard view (11 categories — the canonical L0 view per D25)

```
BudgetCategory {
  id: uuid
  code: string                // "TERRENOS", "LICENCIAS_PERMISOS", etc.
  name: string                // Display name
  budget_amount: decimal      // USD, sin IVA
  budget_percentage: decimal  // % of total budget
  commission_rate?: decimal   // Only for COMISIONES_DE_VENTA (5%)
  dashboard_visible: boolean  // true = actionable/surpriseable, shown on Level 0
  sort_order: integer
}
```

**Seed data (from FCFCasas2 column H, rows 10-20):**

| #   | Category                           | Budget (USD sin IVA) | %      |
| --- | ---------------------------------- | -------------------- | ------ |
| 1   | TERRENOS                           | 1,182,597.40         | 10.53% |
| 2   | LICENCIAS Y PERMISOS               | 230,688.00           | 2.05%  |
| 3   | PLANIFICACIÓN TÉCNICA              | 107,005.00           | 0.95%  |
| 4   | CONSTRUCCIONES COMPLEMENTARIAS     | 453,373.64           | 4.04%  |
| 5   | CONSTRUCCIÓN                       | 7,559,996.01         | 67.33% |
| 6   | MERCADEO                           | 189,594.92           | 1.69%  |
| 7   | COMISIONES DE VENTA (5%)           | 631,983.07           | 5.63%  |
| 8   | HONORARIOS LEGALES (ESCRITURACIÓN) | 126,396.61           | 1.13%  |
| 9   | GASTOS LEGALES                     | 126,396.61           | 1.13%  |
| 10  | DEVELOPMENT FEE - Forma CI         | 455,027.81           | 4.05%  |
| 11  | IMPREVISTOS / MISCELÁNEOS          | 165,582.42           | 1.47%  |

**Total sin IVA: $11,228,641.51**
**IVA: $1,201,261.64**
**Total con IVA: $12,429,903.15**

#### 3.2.3 Budget Sub-Items + 3-level Partida Hierarchy

> **v0.4 — replaced with 3-level hierarchy per N4 + D9 (PA DB alignment).** The xlsx has 3 ordered levels: `PARTIDA EJECUCIÓN PRESUPUESTARIA` (L1, broadest, 10 distinct values) → `PARTIDA GENERAL` (L2, 13 distinct) → `PARTIDA INTERNA` (L3, 38 distinct). The schema has 3 FK-linked tables (`BudgetExecutionPartition`, `BudgetCategory`, `BudgetSubItem`), NOT denormalized strings. Each `Expenditure` row carries all three FKs.

The original section 3.2.3 schema sketch below is preserved as background; the live schema is in `prisma/schema.prisma` (added in Batch 4).


```
BudgetSubItem {
  id: uuid
  category_id: fk → BudgetCategory
  code: string                // "2.1", "2.2", etc.
  description: string         // "Licencia de construcción"
  unit: string?               // "m2", "c/u", etc.
  quantity: decimal?
  unit_price_usd: decimal?
  total_usd: decimal
  total_gtq: decimal
}
```

**Example sub-items under PLANIFICACIÓN TÉCNICA ($107,005):**

- Estudio de suelos: $5,000
- Estudio hidrogeológico: $2,000
- Diseño de arquitectura: $55,000
- Diseño estructural: $10,802
- etc.

#### 3.2.4 Expenditure (from Detalle egresos — the actual spend)

> **v0.4 — comprehensive update.** Key changes: (1) all MONTO values are GTQ regardless of bank account currency — `currency` field removed, `amountGtq` is the single Decimal; (2) per-transaction TC extracted from Descripción regex; (3) 9 bank accounts (not 5); (4) ANULADO status preserved with zero values; (5) negative MONTO values allowed (1 transaction in current data); (6) counterparty typology (5 categories) replaces the simple `vendor` string; (7) row 267 (Q9.1M aportación) is NOT an Expenditure — it's a `PartnerContribution` per §3.2.8.

```
Expenditure {
  id: uuid (v7)
  bank_account_id: fk → BankAccount?   // nullable per finding #8
  date: date
  counterparty_id: fk → Counterparty   // see §3.2.11; typed VENDOR / TAX_AUTHORITY /
                                        // BANK_AS_COUNTERPARTY / INTERNAL_ENTITY / INTERNAL_INDIVIDUAL
  amount_con_iva_gtq: decimal          // Column E (GTQ, signed)
  amount_sin_iva_gtq: decimal          // Column F (GTQ, signed — negatives allowed)
  iva_amount_gtq: decimal              // Column G (GTQ)
  raw_description: text                // Column H verbatim (preserve whitespace anomalies)
  normalized_description: text         // .trim() + collapse-whitespace for matching
  // 3-level partida hierarchy per N4 — all 3 are FKs per D9
  l1_partida_id: fk → BudgetExecutionPartition  // Column K
  l2_partida_id: fk → BudgetCategory            // Column J
  l3_partida_id: fk → BudgetSubItem             // Column I
  nota: text?                          // Column L
  solicitud: text?                     // Column M
  // Per-transaction TC extracted from Descripción regex (~20 transactions)
  // per finding #11. Pattern: T\.?C\.?\s*[-:=]?\s*Q?\.?\s*([0-9]+\.[0-9]+)
  exchange_rate_at_transaction: decimal?  // optional; fall back to project rate
  // Derived USD amount, computed:
  // amount_sin_iva_gtq / (exchange_rate_at_transaction ?? Project.locked_exchange_rate)
  amount_usd_derived: decimal          // for reporting; per-transaction TC where available
  check_number?: string       // When from check statements
  invoice_reference?: string  // Cross-reference number
  source: enum(BANK_STATEMENT, CHECK, INVOICE, MANUAL, XLSX_IMPORT)
  status: enum(VERIFIED, PENDING, FLAGGED, VOIDED, ANULADO)  // v0.4 — ANULADO added per finding #14
  kind: enum(OPERATING_EXPENSE, CASH_MOVEMENT, EQUITY_EVENT)  // v0.4 — per finding #7
  show_on_dashboard: boolean  // false for IMPUESTOS, TRASLADOS, etc.
  // Soft delete invariant (D21)
  deleted_at: timestamptz?
}
```

**Transaction stats from current data (v0.4 — corrected):**

- **242 transactions** total (unchanged)
- **Date range**: 2017-12-28 → 2026-04-30 (~9 years; matches manifest)
- **9 distinct bank accounts** (NOT 5):
  - Active: `G&T 002-0027233-2 (QTZ)` 94 tx, `G&T 002-9900597-5 (USD)` 87, `PROMERICA 12331050054637 (QTZ)` 16, `PROMERICA 12555020002031 (QTZ)` 12, `BAC 90-326385-3 (QTZ)` 11, `INDUSTRIAL 547-001333-4 (QTZ)` 2
  - Legacy (older transactions only): `G&T 02-0014055-8 (QTZ)` 7, `BAC 90-149804-8 (QTZ)` 1, `G&T 02-0019053-5 (QTZ)` 1
- **10 PARTIDA EJECUCIÓN PRESUPUESTARIA** (L1) distinct values
- **13 PARTIDA GENERAL** (L2) distinct values
- **38 PARTIDA INTERNA** (L3) distinct values (NOT 30)
- **Total executed: $2,001,163.72 USD** (Ppto Inversion row 135 grand actuals; supersedes the stale $1,988,922.82 from row 128 per N3)
- **= 15,408,960.63 GTQ** (single-currency, all GTQ — verified via 12% IVA ratio test on USD-account rows)
- **11 transactions have no Banco tag** (intentional, per finding #8): mostly 2018-era setup transactions + the Q9.1M aportación + cross-company transfers to PA — legitimate non-cash markers, NOT data quality issues.
- **1 negative-MONTO transaction** (row 242, Dec 2023, −Q4,553.57): refund for Estudio Impacto Vial advance — accounted as negative expense per local convention. Schema's `amount_*_gtq` fields are signed Decimal.
- **2 ANULADO transactions** (rows 218, 220, both Sep 2024, Banco Promerica): cancelled events preserved with zero values per D21 (no hard delete).
- **20+ transactions have per-transaction TC** embedded in Descripción as `(T.C. - Q.X.XXXXXX)` — parser extracts via regex per finding #11.
- **Color-flagged cells:** PARTIDA INTERNA cells with non-default fills (theme colors openpyxl mishandles; SheetJS in the parser handles correctly) — emit `DataQualityFlag(kind='PARTIDA_FLAGGED_FOR_REVIEW')` per finding #3.
- **Broken Nomenclatura VLOOKUPs:** 33 cells in cols J/K reference an external `[2]Nomenclatura` workbook; most fail silently via `IFERROR(..., "")` leaving L2/L3 partida cells empty. Parser MUST emit `DataQualityFlag(kind='MISSING_PARTIDA')` for affected rows per finding #4 (deferred to Q-MISSING-PARTIDAS for Ronny's operational cleanup).

#### 3.2.5 RvUnit / RvReservation / RvFreezeRequest (replaces "House" per D9)

> **v0.4 — SUPERSEDED by D9 (PA DB canonical taxonomy).** The single `House` entity with a 3-state enum is replaced by three entities per [docs/CanonicalTaxonomy.md](docs/CanonicalTaxonomy.md):
> - **`RvUnit`** with `rv_unit_status` (5-state: `AVAILABLE | SOFT_HOLD | RESERVED | FROZEN | SOLD`) + 8 documented state-machine transitions
> - **`RvReservation`** with `rv_reservation_status` (4-state)
> - **`RvFreezeRequest`** with `rv_freeze_request_status` (2-state)
>
> Naming convention `rv_` per D10 = **RESERVA** (Phase 1 of the 3-phase sale model per [[reference_sale_phases]]). The full Prisma schema is in `prisma/schema.prisma` (added in Batch 4).
>
> **Per D29 operational override:** sold bucket = `{1, 2, 5, 6, 7, 11}` (6 units — Casa 5 added by override despite workbook note 5 excluding it, due to renegotiation status). Unsold = `{3, 4, 8, 9, 10}` (5 units).
>
> **Per Q-CASA-6-STATUS (pending):** Casa 6 stays in sold bucket pending Federico's confirmation. The original buyer withdrew Dec 2025 with a Q3,751,493.90 refund. Whether re-sold or genuinely unsold is the open question. Parser emits `DataQualityFlag(kind='UNIT_STATUS_CONTRADICTS_REFUND')` linking both citations; app surfaces both on Casa 6's tile.
>
> **Total projected revenue: $12,639,661.49 (unchanged).** Price range $960,659 → $1,375,000 (unchanged).

#### 3.2.6 Monthly Cash Flow Projection (from FCFCasas2 timeline)

```
MonthlyProjection {
  id: uuid
  month_number: integer       // 1-36
  month_date: date            // Jun 2025 → May 2028
  // Costs (per category, monthly)
  cost_terrenos: decimal
  cost_licencias: decimal
  cost_planificacion: decimal
  cost_construcciones_comp: decimal
  cost_construccion: decimal
  cost_mercadeo: decimal
  cost_comisiones: decimal
  cost_honorarios: decimal
  cost_gastos_legales: decimal
  cost_dev_fee: decimal
  cost_imprevistos: decimal
  total_cost_sin_iva: decimal
  iva_on_costs: decimal
  total_cost_con_iva: decimal
  cumulative_cost_con_iva: decimal
  // Revenue (per house, monthly)
  revenue_per_house: jsonb    // { "Casa 1": 48719.12, "Casa 2": 49862.76, ... }
  total_revenue_sin_iva: decimal
  cumulative_revenue: decimal
  // Derived
  ebitda_con_iva: decimal
  ebitda: decimal
  // Credit facility
  credit_balance: decimal
  interest_payment: decimal
  principal_payment: decimal
}
```

#### 3.2.7 Credit Facility + AmortizationRule (per N1 + D33)

> **v0.4 — corrected per N1.** The original "REVOLVING_HYBRID" naming was wrong; the actual mechanism is **a development-drawdown loan with revaluation cycles**, NOT a revolving facility. Funds are drawn against a USD 7M cap as construction progresses; each draw is gated by an LTV against a re-appraised garantía (with built improvements counted). Per D33, the facility model is composite (1-to-many `AmortizationRule`) to accommodate multiple mechanisms over the credit life — e.g. revolvente híbrido (EBITDA-sweep) during construction, fixed amortization post-completion.

```
CreditFacility {
  id: uuid (v7)
  project_id: fk → Project
  type: enum(BANK_DEVELOPMENT_LOAN, PRIVATE)  // per D33
  bank_account_id: fk → BankAccount?           // G&T for Santa Elena's active facility
  total_cap_usd: decimal                       // $7,000,000
  current_balance_usd: decimal                 // 0 as of seed (no draws yet per Ppto Inversion ED80)
  annual_rate: decimal                         // 0.0725 (7.25%)
  ltc_ceiling: decimal                         // 0.90 (informational; LTC can exceed per Q-LTC-CEILING)
  deleted_at: timestamptz?
}

AmortizationRule {
  id: uuid (v7)
  credit_facility_id: fk → CreditFacility
  applies_from_month: integer
  applies_to_month: integer?                   // null = open-ended
  mechanism: enum(REVOLVENTE_HIBRIDO, FIXED_AMORTIZATION, BULLET, INTEREST_ONLY)
  conditions_note: text                        // e.g. "amortiza solo cuando EBITDA mensual es positivo"
  deleted_at: timestamptz?
}
```

**Per author's note 2 in `Project.modelNotes`** (verbatim): `"Crédito revolvente HÍBRIDO: amortiza solo cuando EBITDA mensual es positivo (excedentes)"` — this is the seed mechanism for Santa Elena's single active `AmortizationRule`.

**Q-RECYCLE (open, bank-gated):** confirm G&T contractually accepts variable principal paydowns per the revolvente híbrido model, or imposes a fixed schedule. Schema accommodates either via additional `AmortizationRule` rows.

#### 3.2.8 PartnerContribution + ContributionSource (per D33 + foundational events)

> **v0.4 — new entity.** Tracks partner equity flows (capital calls + distributions + in-kind contributions). Per D33, a 1-to-many `ContributionSource` enables composable contributions (forecast + actual + hybrid co-exist).
>
> **Two foundational events for Santa Elena are seeded** at minimum:
> - **2018-02-15:** Q9,096,780 IN_KIND_ASSET contribution by `Condominio Antigua Panorama, S.A.` (the 1.5-acre lot in Antigua); `Detalle egresos!row 267`
> - **2025-06-16:** Q1,535,506 CASH purchase to Ana Diaz Duran Duran (original landowner, closing out her interest); `Detalle egresos!row 138`
> - Combined Q10,632,286 = `Ppto Inversion!ED8` TERRENO actuals

```
PartnerContribution {
  id: uuid (v7)
  project_id: fk → Project
  partner_id: fk → Counterparty                // INTERNAL_ENTITY for Condominio Antigua Panorama;
                                                 // INTERNAL_INDIVIDUAL for Ana Diaz Duran Duran
  date: date
  amount_gtq: decimal                          // signed (distributions are negative)
  amount_usd: decimal                          // derived using TC at date
  kind: enum(CASH_CALL, DISTRIBUTION, IN_KIND_ASSET, CASH_PURCHASE)
  asset_description: text?                     // for IN_KIND_ASSET only
  source_workbook_ref: text                    // "Detalle egresos!row 267" etc.
  deleted_at: timestamptz?

  sources: ContributionSource[]                // composable per D33
}

ContributionSource {
  contribution_id: fk → PartnerContribution
  source_kind: enum(FORECAST_FCFCASAS2, ACTUAL_LEDGER, HYBRID)
  weight: decimal                              // 0.0 - 1.0 for composable / hybrid
}
```

**Q-EQUITY-SOURCE (open, Federico-gated):** confirm whether the `Aporte de socios` row 91 of `FCFCasas2!K..AT` is the canonical capital-call schedule, or whether Grupo Orion tracks contributions in a separate ledger. Schema accommodates either via `ContributionSource.source_kind`.

#### 3.2.9 DataQualityFlag (per D31 — first-class entity)

> **v0.4 — new entity.** Required by D31. The parser emits `DataQualityFlag` rows for every anomaly class encountered; the app surfaces them with explanatory provenance.

```
DataQualityFlag {
  id: uuid (v7)
  kind: enum(...)                              // 16+ kinds enumerated below
  severity: enum(INFO, WARNING, ERROR_VISIBLE, ERROR_BLOCKING)
  source_workbook_ref: text                    // e.g. "FCFCasas2!I97" or "Detalle egresos!row 64"
  source_value: text?                          // verbatim source
  recomputed_value: text?                      // app's computed value when applicable
  human_message: text                          // short Spanish/English explanation
  related_entity_type: string?                 // "RvUnit", "Expenditure", etc.
  related_entity_id: uuid?
  raised_at: timestamptz default now()
  resolved_at: timestamptz?                    // analyst marks resolved
  resolved_by_user_id: fk → User?
  resolution_note: text?
  deleted_at: timestamptz?
}
```

**Flag kinds enumerated** (from the inspection findings):
- `MISSING_PARTIDA` — broken Nomenclatura VLOOKUP left L2/L3 partida cell empty
- `PARTIDA_FLAGGED_FOR_REVIEW` — analyst's color-coded "uncertain assignment" cells
- `UNIT_STATUS_CONTRADICTS_REFUND` — Casa 6 listed sold but has a refund event
- `CATEGORY_MISLABEL` — Ppto Inversion row 131 (Impuestos GTQ → Licencias y Permisos USD label)
- `TIMELINE_MISALIGNMENT` — FCFCasas2 ends May-28 vs Ppto Inversion ends Apr-27
- `CALENDAR_GAP` — Nov-27 missing in FCFCasas2 row 5
- `STALE_FORMULA_WINDOW` — TIRi truncated at K..AN95 (excludes 6 months of partner CF)
- `STALE_LABEL` — `E112=12` vs actual 11 units
- `FLOATING_POINT_RESIDUE` — Ppto Inversion `H64 = 0.006` from subtraction
- `TC_AMBIGUITY` — 4-way TC values surface
- `OVERSPEND` — TERRENO actuals > budget by $198K (real overspend, not a model error); Impuestos w/o budget
- `LARGE_NEGATIVE_REVENUE` — Ppto Inversion DK76 = −$468K → resolved as Casa 6 refund
- `MIXED_CURRENCY_SUM_VALIDATED_GTQ` — informational; confirms F5 sum is single-currency
- `MISSING_BANCO_INTENTIONAL` — non-cash events (aportación, transfers) legitimately have no bank
- `UNUSED_BUDGET_FORMULA` — Detalle egresos row 1/3 Pendiente formula references zero budget
- `OUTLIER_PRICING` — e.g. Casa 5's B×C ≠ H (12-house era pricing preserved in B/C vs 11-house era in H)

#### 3.2.10 IsrObligation (per D34 — both rates seeded literally)

> **v0.4 — new entity.** Per D34, both ISR rates from the workbook are deliberate per Federico (resolves Q1 disposition). Schema captures BOTH; the UI surfaces them as the **literal strings `"ISR 18"` and `"ISR 25"`** — never as "Effective"/"Nominal" abstractions. Per [[feedback_literal_labels_when_multiple_values]].

```
IsrObligation {
  id: uuid (v7)
  project_id: fk → Project
  ui_label: string                             // "ISR 18" or "ISR 25" — literal per D34
  rate: decimal                                // 0.18 or 0.25
  rate_kind: enum(EFFECTIVE, NOMINAL, REGIMEN_SPECIFIC)  // internal field; UI never shows this
  source_cell: text                            // "FCFCasas2!G79" or "FCFCasas2!A79"
  source_text_verbatim: text                   // e.g. "25% sobre utilidad antes de impuestos"
  payment_pattern: enum(LUMP_END, QUARTERLY, ANNUAL, CUSTOM_TRIGGER, COMPOSITE)
                                                // seed Santa Elena as LUMP_END pending Q-ISR-TIMING (tax advisor)
  notes: text?
  deleted_at: timestamptz?
}
```

**Q-ISR-TIMING (open, tax-advisor-gated):** confirm whether Guatemalan law allows ISR to settle as a single lump payment at project end (month 36), or whether quarterly/annual obligations apply. Per D33, schema supports any pattern via `payment_pattern`; seed defaults to LUMP_END per the model's forecast.

#### 3.2.11 Counterparty (5-type discriminator, replaces simple `Partner.type`)

> **v0.4 — new entity (or extension of `Partner`).** Per Detalle egresos finding #5, the `Empresa` column carries 5 distinct counterparty categories. The existing `Partner.type` enum (COMPANY | INDIVIDUAL | GOVERNMENT) is insufficient.

```
Counterparty {
  id: uuid (v7)
  name: string
  tax_id: string?                              // NIT in Guatemala
  type: enum(
    VENDOR,                                    // external vendors (Marroquin Perez, TCG Finanzas, etc.)
    TAX_AUTHORITY,                             // TESORERIA NACIONAL
    BANK_AS_COUNTERPARTY,                      // BANCO G&T CONTINENTAL when receiving license fees
    INTERNAL_ENTITY,                           // Forma Capital Inmobiliario, Puerta Abierta Inmobiliaria, Icono Urbano,
                                                 // Condominio Antigua Panorama — cross-company within Grupo Orion
    INTERNAL_INDIVIDUAL                        // Aguedo Ivan Escobar Velasquez, Otto Rafael Herrera Perez
  )
  notes: text?
  deleted_at: timestamptz?
}
```

The existing `Partner` entity in the schema (added Batch 4 with `type: COMPANY | INDIVIDUAL | GOVERNMENT`) MUST either: (a) be extended to the 5-value enum here (preferred per Rule 10 minimal-change), or (b) be replaced by `Counterparty`. Decision at schema-extension time (Gate 5.2).

---

## 4. Architecture

### 4.1 Tech Stack

| Layer           | Technology                        | Rationale                                                                                       |
| --------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Frontend**    | Next.js 15 + React 19             | Already in your stack. SSR for fast first paint.                                                |
| **Styling**     | Tailwind CSS 4 + Shadcn/ui        | Fast to build, professional look.                                                               |
| **Charts**      | Recharts + custom SVG             | Lightweight, React-native charting.                                                             |
| **State**       | Zustand                           | Minimal boilerplate for client state.                                                           |
| **Database**    | PostgreSQL (Aurora Serverless v2) | Already in your stack. JSONB for flexible projections.                                          |
| **ORM**         | Prisma                            | Already in your stack. Type-safe queries.                                                       |
| **API**         | Next.js API Routes (App Router)   | Colocated, zero extra infra.                                                                    |
| **Auth**        | Supabase Auth                     | Standalone now; abstracted for Microsoft SSO migration later. Role-based (CEO, Analyst, Admin). |
| **Hosting**     | Vercel                            | Already in your stack. Edge-optimized.                                                          |
| **File Import** | SheetJS (xlsx)                    | Parse bank statement CSVs and check exports.                                                    |

### 4.2 Deployment Topology

```
[Vercel Edge] → [Next.js App Router] → [Prisma] → [Aurora PostgreSQL]
                                                          ↑
                                            [Bank CSV Import Worker]
                                            [Manual Entry UI]
```

---

## 5. UI/UX Design — The Drill-Down Hierarchy

The entire interface is designed around **one interaction pattern: progressive disclosure**. You start with the answer to the CEO's question. You drill down only if something catches your eye.

### Level 0: The Answer (Dashboard)

**What the CEO sees when he opens the app.** No clicks required.

```
┌─────────────────────────────────────────────────────────────┐
│  SANTA ELENA                                    May 22, 2026│
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │         BUDGET HEALTH: 82.3% REMAINING           │       │
│  │         ████████████████████░░░░  17.7% spent     │       │
│  │         $1,988,923 of $11,228,642                │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ ON TRACK │  │ OVER    │  │ NOT     │  │ AT RISK │       │
│  │    7     │  │  1      │  │ STARTED │  │    1    │       │
│  │categories│  │TERRENOS │  │    2    │  │         │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │  CATEGORY BARS (sorted by % consumed)             │       │
│  │  TERRENOS        ████████████████████ 116.8% ⚠️   │       │
│  │  MERCADEO        ██████████████░░░░░  72.5%       │       │
│  │  HONOR. LEGALES  ██████████░░░░░░░░░  42.7%       │       │
│  │  PLANIF. TÉCNICA ███████░░░░░░░░░░░░  38.9%       │       │
│  │  DEV FEE         █████░░░░░░░░░░░░░░  26.0%       │       │
│  │  COMISIONES      ██░░░░░░░░░░░░░░░░░  10.7%       │       │
│  │  IMPREVISTOS     ██░░░░░░░░░░░░░░░░░  10.7%       │       │
│  │  GASTOS LEGALES  █░░░░░░░░░░░░░░░░░░   5.3%       │       │
│  │  LICENCIAS       ░ pending recon                   │       │
│  │  CONSTRUCCIÓN    ░ not started                     │       │
│  │  CONSTR. COMPL.  ░ not started                     │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  ┌────────────────────┐  ┌───────────────────────┐          │
│  │ BURN RATE          │  │ PROJECTED COMPLETION   │          │
│  │ $47,312/mo (avg)   │  │ Within budget: YES     │          │
│  │ Last 3mo: $62,841  │  │ Confidence: MODERATE   │          │
│  └────────────────────┘  └───────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

**Key design decisions:**

- The single most important metric (% remaining) is the largest visual element.
- Categories are **sorted by % consumed** (not alphabetically) — the one that's off stands out immediately.
- Color coding: green (on track), amber (>80% consumed), red (over budget), gray (not started).
- TERRENOS shows red + ⚠️ because it's 116.8% of budget ($1,380,816 actual vs $1,182,597 budget).

### Level 1: Category Detail (click any bar)

```
┌──────────────────────────────────────────────────────────────┐
│  ← TERRENOS                                                  │
│                                                              │
│  Budget: $1,182,597.40    Spent: $1,380,816.36   OVER +16.8%│
│                                                              │
│  ┌─ Timeline ──────────────────────────────────────────┐    │
│  │  [Projected spend curve vs actual spend curve]       │    │
│  │  Visual: area chart showing budget planned (line)    │    │
│  │  vs actual cumulative spend (filled area)            │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ Sub-Items (from Ppto Inversion) ───────────────────┐    │
│  │  Terreno / Unidad     $1,182,597.40   ██████████████ │    │
│  │  (only one sub-item for Terrenos)                     │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ Transactions (2 entries) ──────────────────────────┐    │
│  │  2017-12-28  |  Terreno Purchase  | $1,182,597.40   │    │
│  │  2018-02-22  |  Additional cost   | $198,218.96     │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Level 2: Transaction Detail (click any transaction row)

```
┌──────────────────────────────────────────────────────────────┐
│  ← Transaction Detail                                        │
│                                                              │
│  Date:        April 17, 2026                                 │
│  Vendor:      Forma Capital Inmobiliario, S. A.              │
│  Bank:        G&T (USD) — 002-9900597-5                      │
│  Amount:      $68,478.19 (con IVA)                           │
│  Sin IVA:     $61,141.24                                     │
│  IVA:         $7,336.95                                      │
│  Description: FEE DE DESARROLLO DEL PROYECTO SANTA ELENA     │
│               CORRESPONDIENTE AL MES DE ENERO 2026           │
│  Category:    ADMINISTRACION DE CONSTRUCCION Y DESARROLLO    │
│  Sub-cat:     FEE de DESARROLLO                              │
│  Status:      ✅ Verified                                     │
│  Source:      Bank Statement                                  │
│                                                              │
│  [Edit] [Flag for Review] [Void]                             │
└──────────────────────────────────────────────────────────────┘
```

### Secondary Views (accessible from nav, not the primary flow)

**Sales Tracker** — House-by-house status, revenue timeline, enganche tracking.
**Cash Flow Forecast** — The full 36-month projection from FCFCasas2, interactive.
**Credit Facility** — Revolving credit balance, interest accrual, LTC ratios.
**Data Entry** — Import bank CSVs, enter transactions manually, categorize, reconcile.
**Settings** — Budget adjustments, exchange rate, tax rates, user management.

---

## 6. Category Mapping Logic

The xlsx uses inconsistent naming between sheets. The app needs a canonical mapping:

| FCFCasas2 Category             | Ppto Inversion Section                 | Detalle egresos PARTIDA GENERAL             | Internal Sub-Categories (PARTIDA INTERNA)                                                                       |
| ------------------------------ | -------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| TERRENOS                       | 1. TERRENO                             | TERRENO                                     | TERRENO                                                                                                         |
| LICENCIAS Y PERMISOS           | 2.1 LICENCIAS Y PERMISOS               | LICENCIAS Y PERMISOS                        | LICENCIA DE CONSTRUCCION, LICENCIA - Forestal, LICENCIAS - MARN, ESTUDIO IMPACTO VIAL, ESTUDIO AMBIENTAL        |
| PLANIFICACIÓN TÉCNICA          | 2.2 PLANIFICACIÓN TECNICA              | PLANIFICACIÓN TÉCNICA                       | DISEÑO HIDROSANITARIO, DISEÑO ELECTRICO                                                                         |
| CONSTRUCCIONES COMPLEMENTARIAS | 3. SERVICIOS y CONSTR. COMPLEMENTARIAS | _(no transactions yet)_                     | —                                                                                                               |
| CONSTRUCCIÓN                   | 4. CONSTRUCCION                        | _(no transactions yet)_                     | —                                                                                                               |
| MERCADEO                       | 5. COMERCIALIZACION/VENTA              | MERCADEO Y PUBLICIDAD                       | Marketing, Corporativos, Sala de Ventas, Maqueta, Asesoria                                                      |
| COMISIONES DE VENTA            | 6. COMISIONES DE VENTA                 | COMISIONES                                  | COMISIONES                                                                                                      |
| HONORARIOS LEGALES             | 8. ADMON (gastos legales + honorarios) | HONORARIOS LEGALES                          | HONORARIOS LEGALES                                                                                              |
| GASTOS LEGALES                 | 8. ADMON                               | GASTOS LEGALES                              | GASTOS LEGALES                                                                                                  |
| DEVELOPMENT FEE                | Fee (row 60)                           | ADMINISTRACION DE CONSTRUCCION Y DESARROLLO | FEE de DESARROLLO                                                                                               |
| IMPREVISTOS / MISCELÁNEOS      | 9. VIALIDAD / OTROS                    | CONTINGENCIA                                | CONTABILIDAD, Mensajeria, SEGURIDAD, AVALUO, MANEJO DE CUENTA, Suministros, Papeleria, Servicio RL, Impresiones |

**Unmapped categories in Detalle egresos (need handling):**

- IMPUESTOS (45 transactions) — not a budget category, tracked separately
- ANULADO (2) — voided transactions, excluded from totals
- DEVOLUCIÓN (1) — refund, negative expenditure
- TRASLADO de FONDOS (1) — internal transfer, excluded

---

## 7. Key Calculations

### 7.1 Budget Health per Category

```
spent = SUM(expenditures WHERE general_category = category.mapping)
remaining = category.budget_amount - spent
pct_consumed = spent / category.budget_amount
status =
  if pct_consumed > 1.0 → OVER_BUDGET
  if pct_consumed > 0.80 → AT_RISK
  if pct_consumed == 0 and project_month > expected_start → DELAYED
  if pct_consumed == 0 → NOT_STARTED
  else → ON_TRACK
```

### 7.2 Burn Rate

```
monthly_burn = SUM(expenditures in month) / months_active
trailing_3mo = SUM(expenditures in last 3 months) / 3
projected_total = spent + (remaining_months × trailing_3mo)
on_budget_projection = projected_total <= budget × 1.05
```

### 7.3 Revenue Tracking

From FCFCasas2, each house has a payment schedule:

- **Enganche** (25%) collected at sale month
- **Monthly installments** from sale month to delivery month
- **Final payment** at delivery month
  Revenue projections update when house status changes (sold/reserved/available).

### 7.4 EBITDA

```
monthly_ebitda = total_revenue_con_iva - total_costs_con_iva
```

### 7.5 Credit Facility (development-drawdown with EBITDA-sweep amortization — per N1 + D33)

> **v0.4 — corrected per N1.** Previous "Revolving Hybrid" naming was wrong. Mechanism is a development-drawdown loan against a re-appraised garantía (built improvements lift the LTV envelope). Per the author's note 2 (`Project.modelNotes[1]`), the active amortization rule for Santa Elena is **revolvente híbrido** = pays down principal only when monthly EBITDA is positive.

```
// For each AmortizationRule active in a given month:
monthly_interest = outstanding_balance_usd × (annual_rate / 12)

// REVOLVENTE_HIBRIDO mechanism (current Santa Elena rule):
if monthly_ebitda > 0 AND outstanding_balance_usd > 0:
  principal_payment = min(monthly_ebitda, outstanding_balance_usd)
else:
  principal_payment = 0

// Drawdowns gated by LTV-against-appraisal:
appraisal_value = prior_appraisal + new_TERRENO + new_CONSTRUCCION + 0.80 × new_CONST_COMP
current_ltc = outstanding_balance_usd / appraisal_value
// LTC may exceed 90% ceiling — per Q-LTC-CEILING this is a signal not an alarm
// (CEO uses it to decide on re-appraisal / cap raise / equity injection)
```

### 7.6 IVA Handling

- Guatemala IVA = **12%** (verified via 12.00% MONTO_IVA / MONTO_SIN_IVA ratio across G&T USD-account rows; confirmed `Project.iva_rate = 0.12`)
- Some expenditures have IVA (services), some don't (government fees, ISR notes — see ANULADO + zero-IVA pattern)
- The model tracks IVA cobrado (on sales) vs IVA pagado (on purchases)
- Net IVA payable = IVA cobrado - IVA pagado

### 7.7 Currency Conversion (v0.4 — corrected)

> **v0.4 — major correction.** The original "TC 7.7 locked + actual TC per transaction" model is partially right but understates the ambiguity.

**FOUR distinct TC values exist in the source workbook**, each used in different contexts:

| Cell / Source | Value | Used for | Schema field |
|---------------|-------|----------|---------------|
| `Ppto Inversion!G2` | 7.7 | Advertised / reference TC for budget comparisons | `Project.locked_exchange_rate` |
| `Ppto Inversion!I2` (text) | "TC 7.8 PARA PRESUPUESTO" | Budgeting/forecasting reference | `Project.tc_budgetary_label` (text only) |
| `Ppto Inversion!N4` | 7.6922 | Historical effective TC from 2018 terreno math | `Project.tc_effective_terreno_historical` |
| **Per-transaction in `Detalle egresos` description** | varies (7.68458 – 7.73299) | Actual TC at the moment each USD transaction was recorded | `Expenditure.exchange_rate_at_transaction` (extracted via regex) |

**Critical:** all `MONTO` values in Detalle egresos are GTQ regardless of bank account currency. The `Banco` column tells which bank ACCOUNT paid (account currency). For USD-account transactions, the GTQ value recorded in the ledger is the GTQ-equivalent at the per-transaction TC.

**USD reconstruction rule** for an Expenditure row:

```
amount_usd = amount_sin_iva_gtq / (
  expenditure.exchange_rate_at_transaction
  ?? project.locked_exchange_rate   // fallback when no per-tx TC available
)
```

Without per-transaction TC extraction, USD reconstruction is off by 0.5–1% per transaction (the variation between 7.68458 and 7.73299 within 2025). Parser MUST regex-extract per finding #11.

**Currency variance reporting:**

```
currency_variance_usd = (actual_tc - project.locked_exchange_rate) × amount_gtq / actual_tc
// reportable metric for trailing periods
```

### 7.8 ISR Handling (v0.4 — new section per D34)

Two ISR rates are deliberate per Federico (resolves Q1):

- **`ISR 18`** (effective rate, `0.18`, from `FCFCasas2!G79`) — used by the model's calculation at `AT79 = SUM(K76:AT76) × 0.18`
- **`ISR 25`** (nominal rate, `0.25`, from `FCFCasas2!A79` label `"ISR (25% sobre utilidad antes de impuestos)"`)

Both are seeded as separate `IsrObligation` rows with **literal UI labels `"ISR 18"` and `"ISR 25"`** per D34 + [[feedback_literal_labels_when_multiple_values]]. Field-usage logic (when to apply which) is implemented in the calc layer; schema and labels stay literal.

Pending Q-ISR-TIMING (tax advisor): confirm whether the model's lump-end-at-month-36 ISR payment pattern matches Guatemalan tax obligations (quarterly/annual may apply). Per D33, `IsrObligation.payment_pattern` supports any pattern.

### 7.9 Anomaly handling — provenance + flag surfacing (v0.4 — new section per D31)

**THE PARSER DOES NOT FAIL — neither loudly nor silently.** Anomalies become `DataQualityFlag` rows; the app surfaces them with provenance.

Per D31, every dashboard value carries a provenance label:

- _"this comes directly from the xlsx"_ (raw / source)
- _"this comes from my own calculations"_ (recomputed / derived)

Where source ≠ recomputed (e.g., TIRi `21.23%` as in xlsx vs `30.95%` recomputed over full timeline), BOTH are shown side-by-side with labels. Never silently override. Never block the app on data quality.

The 16 enumerated `DataQualityFlag` kinds in §3.2.9 cover every anomaly class identified in the inspection. New kinds are added as needed; the parser never throws on a new anomaly class — it emits an `UNKNOWN_ANOMALY` flag and continues.

---

## 8. Data Entry & Import

### 8.1 Manual Entry

Simple form: date, vendor, amount, IVA, description, category, sub-category.
Auto-suggest vendor names and categories based on history.

### 8.2 Bank Statement Import (CSV)

**Architecture: Pluggable adapter pattern** — one parser class per bank format.

- **Phase 1**: G&T Continental parser (78% of transactions, 2 account formats: USD + QTZ)
- **Phase 2**: Promerica QTZ (12% of transactions)
- **Phase 3**: BAC QTZ (5%), Industrial QTZ (1%)
  Each parser normalizes to a common `RawTransaction` schema before categorization.
  Auto-categorization using vendor name matching + ML-assisted classification.
  **Unmatched transactions land in a "Pending Review" queue.**

### 8.3 Check Statement Import

Parser for check register format.
Fields: check number, date, payee, amount, description.
Cross-reference with bank statement debits.

### 8.4 Reconciliation Workflow

```
IMPORTED → [Auto-categorized?] → YES → PENDING_VERIFICATION → [Human confirms] → VERIFIED
                                → NO  → UNCATEGORIZED → [Human assigns category] → VERIFIED
```

---

## 9. Roles & Permissions

> **v0.4 — SUPERSEDED by D14 (4-role RBAC matrix locked in Batch 3).** Canonical: `MASTER` / `CEO` / `ANALISTA` / `AUXILIAR`. The 3-role matrix below is the original SDD §9 design from v0.3, retained for historical reference. **The actual live matrix lives in `src/lib/rbac/matrix.ts` per D14, D22, and D24** (refined during Batch 4: AUXILIAR DELETE-anywhere-they-mutate, ANALISTA FULL_CRUD on settings + cap_adjustment + bank/appraisal/disbursement/exchange_rate; AUXILIAR READ_ONLY on the 7 sensitive resources).

**Live role mapping** (per `[[forma-team-roles-and-access-pattern]]`):
- **MASTER** = Jorge (developer/superuser)
- **CEO** = Federico Franco (read-only dashboard consumer)
- **ANALISTA** = Ronny Rivas (rrivas; hands-on data management)
- **AUXILIAR** = juniors with robust audit trail (added on demand)

**Historical (v0.3) matrix — superseded but retained for diff:**

| Role        | See Dashboard | Drill Down | Enter Data | Edit Budget | Manage Users |
| ----------- | ------------- | ---------- | ---------- | ----------- | ------------ |
| **CEO**     | ✅            | ✅         | ❌         | ❌          | ❌           |
| **Analyst** | ✅            | ✅         | ✅         | ❌          | ❌           |
| **Admin**   | ✅            | ✅         | ✅         | ✅          | ✅           |

---

## 10. Migration Plan

> **v0.4 — Phase 2 parity numbers corrected per N3.** The original $1,988,922.82 (Ppto Inversion row 128 snapshot) is superseded by **$2,001,163.72** (Ppto Inversion row 135 live grand actuals).

### Phase 1: Seed Database (Batches 4–6)

- Import all 242 transactions from Detalle egresos (preserve ANULADO + negative MONTO + missing-Banco rows per §3.2.4 v0.4)
- Import 3-level partida hierarchy per N4 + D9
- Import 11 budget categories (CEO view) + 10 numbered + 12 EJECUTADO views (all three; aggregations computed fresh)
- Import 11 RvUnits + RvReservations per D29 sold-bucket override + Q-CASA-6-STATUS pending
- Import monthly projections from FCFCasas2 (label-based per D26)
- Import 2+ PartnerContribution events (terreno aportación 2018 + cash 2025)
- Import CreditFacility + AmortizationRule (revolvente híbrido per author's note 2)
- Import IsrObligation rows for `ISR 18` + `ISR 25` literal labels per D34
- Import 9 BankAccount rows (6 active + 3 legacy)
- Import all NOTAS verbatim per D32
- Import all `DataQualityFlag` rows emitted by the parser

### Phase 2: Validate (Batch 6 + Batch 18)

- **Reproduce live actuals** from app data:
  - `SUM(Expenditure.amount_sin_iva_gtq WHERE NOT deleted_at) = 15,408,960.63 GTQ` ✓ (Ppto Inversion ED71 + Detalle egresos F5)
  - **`USD-converted actuals = $2,001,163.72 USD`** ✓ (Ppto Inversion row 135 — supersedes the stale $1,988,922.82)
  - `SUM(BudgetCategory.budget_usd) = $11,228,641.51` ✓ (FCFCasas2 H22 + Ppto Inversion H62)
  - `SUM(RvUnit.price_usd) = $12,639,661.49` ✓ (FCFCasas2 H47 + Ppto Inversion H76)
- Each category's actual matches xlsx aggregations within $0.01 (with per-tx TC where available)
- `DataQualityFlag` table populated; counts surfaced in validator report (informational, NOT blocking per D31)
- Per-tx TC extraction successful for at least 20 transactions per finding #11
- Casa 5 + Casa 6 operational-override flags present and traceable

### Phase 3: Launch (Batch 19)

- Deploy to Vercel
- CEO (Federico) gets read-only dashboard access (CEO role per D14)
- Analista (Ronny) starts entering new transactions in the app (ANALISTA role per D14)
- Parallel operation with xlsx for 2 weeks
- Kill the xlsx

---

## 11. Resolved Design Decisions

> **v0.4 — superseded by PROGRESS.md Section 2 (D1-D35).** The 8 decisions captured below were the original v0.3 set; **the canonical decision log is now [PROGRESS.md](PROGRESS.md) Section 2**, which carries 35 locked decisions including all v0.3 decisions and 27 additional decisions earned during Batches 1-4 + deep inspection (May 22-25, 2026). PROGRESS.md is the authoritative source; this table is retained for v0.3 historical reference only.

**v0.3 historical decisions (retained for diff):**

| #   | Question              | Decision                                                                                                                                                                                                                                                                               |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Bank CSV formats      | **Differ per bank.** Pluggable parser interface. G&T first (78% of data), then Promerica, BAC, Industrial.                                                                                                                                                                             |
| 2   | Exchange rates        | **Actual rate at transaction date.** Budget comparison at TC 7.7; actuals at real rate. Currency variance is a reportable metric. _(v0.4 update: now also a 4-way TC ambiguity; per-tx TC extracted from Descripción — see §7.7 v0.4.)_                                              |
| 3   | Budget revisions      | **CEO decides, no approval flow.** Admin executes. Full audit trail with timestamp, user, old value, new value.                                                                                                                                                                        |
| 4   | Income tracking       | **Full scope.** Costs + revenue + EBITDA + cash flow. App is single source of truth.                                                                                                                                                                                                   |
| 5   | Authentication        | **Supabase Auth now.** Auth layer abstracted so Microsoft SSO migration is a config change later.                                                                                                                                                                                      |
| 6   | Concurrent users      | **Under 5.** Minimal infra. Supabase Postgres. _(v0.4: D19 — Session pooler is the only IPv4-compatible connection option in this network.)_                                                                                                                                          |
| 7   | Cash flow projections | **Fully editable living model.** House prices, sale dates, cost curves, credit terms — all editable. Every change versioned.                                                                                                                                                           |
| 8   | IMPUESTOS (ISR)       | **Tracked, not on dashboard.** _(v0.4: D34 — Both ISR 18 + ISR 25 rates seeded as separate `IsrObligation` rows with literal UI labels.)_                                                                                                                                          |

**v0.4 additional locked decisions (canonical source: [PROGRESS.md](PROGRESS.md) Section 2):**

| #     | Topic                                                                                          |
| ----- | ---------------------------------------------------------------------------------------------- |
| D9    | PA DB canonical taxonomy — RvUnit / RvReservation / RvFreezeRequest with state machines        |
| D10   | `rv_` prefix verbatim per PA convention                                                        |
| D11   | Single-project schema for v1 (Santa Elena hard-coded)                                          |
| D12   | Phase scope v1 — Phase 1 reservations only (no enganche/mortgage data yet for SE)              |
| D13   | Odoo v19 alignment where free                                                                  |
| D14   | 4-role RBAC matrix: MASTER / CEO / ANALISTA / AUXILIAR (replaces SDD §9's 3-role design)        |
| D15   | Initial users at launch                                                                        |
| D16   | Solo workflow, no CI for now                                                                   |
| D17   | Supabase publishable/secret key system (legacy anon/service_role names banned)                 |
| D18   | Prisma pinned to 6.x stable (not 7.x)                                                          |
| D19   | Session pooler only (IPv4 compatibility)                                                       |
| D20   | Next 16 DAL auth pattern (middleware.ts deprecated)                                            |
| D21   | All deletes are soft deletes — `deleted_at` on every business table                            |
| D22   | Batch 4 matrix refinements (AUXILIAR DELETE-on-mutables, ANALISTA full settings access)         |
| D23   | `prisma migrate dev` permanently broken — use `migrate diff` + manual + `migrate deploy`        |
| D24   | InvestmentPhase from day 1; shareholder splits deferred                                        |
| D25   | CEO L0 dashboard anchor view = `FCFCasas2!A1:I25` block; preserve canonical order; anomaly visibility via visual treatment NOT reordering |
| D26   | Parser is label-based per row-A content + row-5/6 headers; NEVER position-based                 |
| D27   | CEO L0 has TWO blocks — adds revenue block at `FCFCasas2!A27:J51`                              |
| D28   | CEO L0 has THIRD block — financial bottom line at `FCFCasas2!A52:J88`                          |
| D29   | Casa 5 is a true outlier — operational override: SOLD; NO schema change                        |
| D30   | Santa Elena project history metadata: 12→11 forced revision, internal approval 2025-04-22, author + legal-rep names captured |
| **D31** | **THE PARSER DOES NOT FAIL — neither loudly nor silently.** Captures every cell, drops nothing, emits flags. APP surfaces with provenance. |
| D32   | Author's NOTAS preserved verbatim as `Project.modelNotes`                                      |
| D33   | Schema flex for high domain complexity (`PartnerContribution.ContributionSource`, `CreditFacility.AmortizationRule`, `IsrObligation`) |
| D34   | Both ISR rates literal — `"ISR 18"` + `"ISR 25"` in all UI per [[feedback_literal_labels_when_multiple_values]] |
| D35   | S-curve seeded verbatim from FCFCasas2 cost rows; PM validation pending                         |

**Open questions** (Section 4 of PROGRESS.md tracks 30+):
- Federico-gated: Q-30-TO-36-EXTENSION, Q-TIRI-WINDOW, Q-CALENDAR-GAP, Q-EQUITY-SOURCE, Q-CASA-6-STATUS, Q-IN-KIND-CONTRIBUTION, Q-COUNTERPARTY-TYPING, Q-CAPITAL-Y-RETORNO-UX, S-curve
- Operational (Ronny): Q-MISSING-PARTIDAS, Q-PENDIENTE-FORMULA, Q-BANK-COVERAGE, Q-LEGACY-BANK-ACCOUNTS, Q-PARTIDA-FLAGGED-CELLS, Q-CASA-6-REFUND-FUNDING
- External: Q-RECYCLE (bank G&T), Q-ISR-TIMING (tax advisor), Q-RESUMEN-DEFINITION (CEO + Ronny)

---

## 12. Audit Trail System

Since everything is editable and the CEO makes decisions verbally, the audit trail is the institutional memory. Every mutation is captured.

### 12.1 AuditLog Entity

```
AuditLog {
  id: uuid
  timestamp: datetime
  user_id: fk → User
  entity_type: string         // "Expenditure", "BudgetCategory", "House", "MonthlyProjection", etc.
  entity_id: uuid
  action: enum(CREATE, UPDATE, DELETE, VOID, IMPORT)
  field_name: string?         // Which field changed (null for CREATE/DELETE)
  old_value: text?            // JSON-serialized previous value
  new_value: text?            // JSON-serialized new value
  context: text?              // Optional note: "CEO verbal approval", "Bank import batch #47", etc.
}
```

### 12.2 What Gets Audited

- **Every** budget amount change
- **Every** expenditure create/edit/void
- **Every** house price/status/date change
- **Every** projection parameter change
- **Every** exchange rate entry
- **Every** data import (batch-level + row-level)

### 12.3 UI Access

- Timeline view per entity ("show me the history of this transaction")
- Global activity feed ("what changed today?")
- Filterable by user, entity type, date range

---

## 13. Deliverables Sequence

1. **SDD** ← you are here
2. **Database schema** (Prisma) + seed script from xlsx
3. **Dashboard (Level 0)** — the CEO's one-glance answer
4. **Drill-down views (Levels 1-2)** — category → transaction
5. **Data entry + import** — manual + CSV parser
6. **Sales tracker** — house-by-house revenue
7. **Cash flow forecast** — interactive 36-month projection
8. **Polish + deploy**

---

_This is a living document. It will be updated as questions are answered and requirements evolve._
