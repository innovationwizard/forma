# Software Design Document

## FORMA — Condominio Santa Elena Budget Tracker

### Version 0.3 — May 22, 2026 (Design philosophy crystallized)

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

```
Project {
  id: uuid
  name: "Condominio Santa Elena"
  company: "FORMA Capital Inmobiliario"
  location: "Antigua Guatemala"
  currency_primary: "USD"
  currency_secondary: "GTQ"
  exchange_rate: 7.7                      // TC used in budget
  iva_rate: 0.12                          // Guatemala IVA (12%)
  isr_rate: 0.18                          // ISR rate used in model
  start_date: "2017-12-22"
  projected_end_date: "2027-04-19"
  total_budget_sin_iva: 11,228,641.51     // From FCFCasas2 H22
  total_budget_con_iva: 12,429,903.15     // From FCFCasas2 H24
  total_projected_revenue: 12,639,661.49  // From FCFCasas2 H47
}
```

#### 3.2.2 Budget Categories (12 categories from FCFCasas2)

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

#### 3.2.3 Budget Sub-Items (from Ppto Inversion)

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

```
Expenditure {
  id: uuid
  bank_account: string        // "G&T (USD)", "G&T (QTZ)", "PROMERICA (QTZ)", "BAC (QTZ)", "INDUSTRIAL (QTZ)"
  account_number: string      // "002-9900597-5", "002-0027233-2", etc.
  date: date
  vendor: string              // "Forma Capital Inmobiliario, S. A.", etc.
  amount_con_iva: decimal     // Column E
  amount_sin_iva: decimal     // Column F
  iva_amount: decimal         // Column G
  description: text           // Free text from bank/invoice
  internal_category: string   // Column I — "FEE de DESARROLLO", "LICENCIA DE CONSTRUCCION", etc.
  general_category: string    // Column J — maps to BudgetCategory
  currency: enum(USD, GTQ)    // Derived from bank_account name
  exchange_rate: decimal      // Actual TC at transaction date (GTQ→USD). 1.0 for USD transactions.
  amount_usd: decimal         // Computed: amount_sin_iva / exchange_rate (for GTQ) or amount_sin_iva (for USD)
  check_number?: string       // When from check statements
  invoice_reference?: string  // Cross-reference number
  source: enum(BANK_STATEMENT, CHECK, INVOICE, MANUAL)
  status: enum(VERIFIED, PENDING, FLAGGED, VOIDED)
  show_on_dashboard: boolean  // false for IMPUESTOS, TRASLADOS, etc.
}
```

**Transaction stats from current data:**

- 242 transactions total
- Date range: Dec 2017 → Apr 2026
- 5 bank accounts (2 USD, 3 GTQ)
- 13 general categories (PARTIDA GENERAL)
- 30 internal sub-categories (PARTIDA INTERNA)
- Total executed: ~$1,988,922.82 USD (17.7% of budget)

#### 3.2.5 House / Unit (from FCFCasas2 rows 33-43)

```
House {
  id: uuid
  name: string                // "Casa 1", "Casa 2", ..., "Casa 11"
  type: string                // "A"
  area_m2: decimal            // 491.91 for all houses
  price_per_m2: decimal       // $1,980 - $2,897
  sale_price_sin_iva: decimal // $960,658 - $1,375,000
  sale_month: integer         // Month when enganche received (1-19)
  delivery_month: integer     // Month when delivered (14-28)
  enganche_rate: decimal      // 0.25 (25%)
  status: enum(SOLD, AVAILABLE, RESERVED)
  buyer_name?: string
}
```

**11 Houses, current state:**

- Houses 1, 2, 6, 7, 11: Sold (sale months 1-6)
- Houses 3-5, 8-10: Available (projected sale months 12-19)
- Price range: $960,659 → $1,375,000
- Total projected revenue: $12,639,661.49

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

#### 3.2.7 Credit Facility (from FCFCasas2 rows 56-74)

```
CreditFacility {
  type: enum(BANK, PRIVATE)
  total_amount: decimal       // $7,000,000 bank credit
  annual_rate: decimal        // 7.25%
  monthly_rate: decimal       // 0.604%
  max_ltc: decimal            // 0.90 (LTC ceiling)
  mechanism: "REVOLVING_HYBRID"  // Pays principal only when EBITDA > 0
}
```

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

### 7.5 Credit Facility (Revolving Hybrid)

```
monthly_interest = outstanding_balance × (annual_rate / 12)
// Principal paid ONLY when EBITDA > 0
if monthly_ebitda > 0:
  principal_payment = min(monthly_ebitda, outstanding_balance)
```

### 7.6 IVA Handling

- Guatemala IVA = 12%
- Some expenditures have IVA (services), some don't (government fees, taxes)
- The model tracks IVA cobrado (on sales) vs IVA pagado (on purchases)
- Net IVA payable = IVA cobrado - IVA pagado

### 7.7 Currency Conversion

- Budget is denominated in USD at TC 7.7 (locked budget rate)
- Transactions arrive in USD _and_ GTQ
- Every GTQ transaction stores the **actual exchange rate at transaction date**
- Budget comparison: GTQ actuals converted at 7.7 (apples-to-apples vs budget)
- Reporting: actual TC stored separately, enabling **currency variance analysis**
- Currency variance = (actual_rate - 7.7) × GTQ_amount — reportable metric

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

| Role        | See Dashboard | Drill Down | Enter Data | Edit Budget | Manage Users |
| ----------- | ------------- | ---------- | ---------- | ----------- | ------------ |
| **CEO**     | ✅            | ✅         | ❌         | ❌          | ❌           |
| **Analyst** | ✅            | ✅         | ✅         | ❌          | ❌           |
| **Admin**   | ✅            | ✅         | ✅         | ✅          | ✅           |

---

## 10. Migration Plan

### Phase 1: Seed Database

- Import all 242 transactions from Detalle egresos
- Import budget categories and amounts from FCFCasas2
- Import sub-items from Ppto Inversion
- Import house data and payment schedules from FCFCasas2
- Import monthly projections from FCFCasas2 timeline

### Phase 2: Validate

- Reproduce the Ppto Inversion summary (rows 115-127) from the app's data
- Match totals: $1,988,922.82 executed, $9,239,718.69 remaining
- Verify each category's budget vs actual matches the xlsx

### Phase 3: Launch

- Deploy to Vercel
- CEO gets read-only dashboard access
- Analyst starts entering new transactions in the app
- Parallel operation with xlsx for 2 weeks
- Kill the xlsx

---

## 11. Resolved Design Decisions

| #   | Question              | Decision                                                                                                                                                                                                                                                                               |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Bank CSV formats      | **Differ per bank.** Pluggable parser interface. G&T first (78% of data), then Promerica, BAC, Industrial.                                                                                                                                                                             |
| 2   | Exchange rates        | **Actual rate at transaction date.** Budget comparison at TC 7.7; actuals at real rate. Currency variance is a reportable metric.                                                                                                                                                      |
| 3   | Budget revisions      | **CEO decides, no approval flow.** Admin executes. Full audit trail with timestamp, user, old value, new value.                                                                                                                                                                        |
| 4   | Income tracking       | **Full scope.** Costs + revenue + EBITDA + cash flow. App is single source of truth.                                                                                                                                                                                                   |
| 5   | Authentication        | **Supabase Auth now.** Auth layer abstracted so Microsoft SSO migration is a config change later.                                                                                                                                                                                      |
| 6   | Concurrent users      | **Under 5.** Minimal infra. Aurora Serverless min capacity or Supabase Postgres. No connection pooling.                                                                                                                                                                                |
| 7   | Cash flow projections | **Fully editable living model.** House prices, sale dates, cost curves, credit terms — all editable. Every change versioned.                                                                                                                                                           |
| 8   | IMPUESTOS (ISR)       | **Tracked, not on dashboard.** Taxes are money but not surprises — they're predictable and non-actionable. The dashboard is an anomaly detector for categories where early visibility enables CEO intervention (construction, vendors, scope creep). Taxes accessible in detail views. |

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
