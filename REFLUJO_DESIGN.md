# REFLUJO Design — Bank-Statement Ingestion Pipeline

> Architecture for replacing Ronny's xlsx-based bank-statement workflow with
> an in-app pipeline. **Signed off 2026-05-27 by Jorge** on all 4 §8
> decisions (3-layer schema · sub-batch split · no existing-table refactor
> · RBAC posture). Implementation tracked in §9 below.
>
> _Authored 2026-05-27 in response to Jorge's directives (this document
> reflects those verbatim and answers them with industry best-practice +
> codebase fit)._

## 9. Progress tracker

Legend: ⬜ NOT_STARTED · 🟨 IN_PROGRESS · ✅ DONE · 🛑 BLOCKED

### Batch 13a — Bronze + silver + G&T adapter + upload UI

| # | Deliverable | Status | Notes |
|---|---|---|---|
| 13a.1 | Prisma schema: 4 new tables + 6 new enums + indexes + 2 dq-flag enum extensions | ✅ DONE | All formatted + validated |
| 13a.2 | Migrations 13.1 (bronze+silver) + 13.1b (dqflag enum) — via `migrate diff` per D23 | ✅ DONE | `20260527193908_batch_13a_reflujo_bronze_silver` + `20260527195044_batch_13a_dqflag_enum_extensions` applied |
| 13a.3 | RBAC matrix additions (4 resources) + `verify-rbac` green | ✅ DONE | `bank_statement_import`, `bank_statement_sheet`, `bank_statement_raw_row`, `bank_transaction` |
| 13a.4 | RLS policies for new tables + `verify-rls` green | ✅ DONE | Migration `20260527194107_batch_13a_reflujo_rls`. All bronze read-only for non-MASTER; silver UPDATE for ANALISTA + AUXILIAR |
| 13a.5 | `xlsx` SheetJS dep + `src/lib/import/` registry skeleton + workbook abstraction | ✅ DONE | `xlsx ^0.18.5`. Registry has 4 adapters: 1 enabled (G&T), 3 disabled stubs |
| 13a.6 | G&T adapter — `detect` + `parse` + 20 vitest cases (test suite 85/85+2 skipped) | ✅ DONE | Content-anchored header search; sign-convention drift handled per-row; D31-compliant (every source row → bronze, even trailing totals) |
| 13a.7 | Disabled stubs for PROMERICA / BAC / INDUSTRIAL | ✅ DONE | Each has its own folder + README + 1-file stub that throws on parse(). Drop-in pattern for future banks |
| 13a.8 | Upload page `/import/new` + server action | ✅ DONE | Role-gated (CREATE bank_statement_import). 10 MB file limit; `.xls`+`.xlsx` only. SHA-256 dedup before insert |
| 13a.9 | Import detail page `/import/[id]` + twin-sheet `is_canonical` toggle action | ✅ DONE | `flipCanonicalAction` atomically soft-deletes prior silver, flips canonical flag on requested sheet + alternates, re-derives silver from new canonical's bronze. Audited |
| 13a.10 | End-to-end validation against the 6 real G&T samples in `docs/REFLUJO/` | ✅ DONE | **132 bronze rows + 41 silver rows captured across 11 sheets. 0 parser warnings. 6/6 re-uploads correctly rejected by file-hash UNIQUE.** Smoke script cleaned up real data afterward (data smoke, no residue) |
| 13a.11 | PROGRESS.md + this tracker updated | ✅ DONE | |

#### 13a metrics from the real-data acceptance run

| File | Sheets | Bronze | Silver | Notes |
|------|-------:|-------:|-------:|-------|
| Jan USD | 2 | 18 | 4 | Twin-sheet pattern: 2nd sheet captured but silver only from canonical |
| Jan QTZ | 1 | 11 | 7 | Single-sheet file. Already-negative-debit sign convention handled |
| Feb USD | 2 | 20 | 5 | Twin-sheet |
| Feb QTZ | 2 | 34 | 13 | Twin-sheet. Largest single-sheet test of batched bronze inserts |
| Mar (combined) | 2 | 14 | 6 | Combined USD+QTZ in one file, no twin-sheet for either |
| Apr (combined) | 2 | 35 | 6 | Combined USD+QTZ; April USD has 0 transactions (empty period) |
| **Totals** | **11** | **132** | **41** | **0 flags raised** |

#### 13a tech-debt surfaced (move to 13b if needed)

- **`flipCanonicalAction` duplicates G&T parse logic.** The re-derivation step inlines a copy of `gtAdapter.parse()`'s normalization. When 13b adds support for other banks (PROMERICA et al.), the adapter contract should grow a `reparse(rawCells)` method so re-derivation routes through the same code path. Today's inline version is correct but tightly G&T-coupled.
- **Bronze inserts use `createManyAndReturn`** (batched per the Feb QTZ timeout discovery). Silver inserts stay one-by-one because of the try/catch around the UNIQUE-constraint dedup path — a future improvement is to do a pre-pass dedup query then a batch insert, but the current shape is correct and fast enough for ~30-row sheets.

### Batch 13b — Gold additions + classification queue

| # | Deliverable | Status | Notes |
|---|---|---|---|
| 13b.1 | Prisma schema: `RvPayment` + 3 gold-to-silver nullable FKs + `RvPaymentReconciliationStatus` enum | ✅ DONE | |
| 13b.2 | Migration 13.2 — via `migrate diff` per D23 | ✅ DONE | `20260527201216_batch_13b_gold_additions`. (One bad-migration cleanup en route — `20260527201135` got Prisma's `migrate resolve --rolled-back` treatment after a transient DB connect error wrote an error message into the SQL file) |
| 13b.3 | RBAC matrix: `rv_payment` resource + `verify-rbac` green | ✅ DONE | ANALISTA + AUXILIAR full CRUD per `feedback_outliers_dont_drive_schema` (junior territory by design — same shape as Ronny's `CASA` annotation step today) |
| 13b.4 | RLS policies for `rv_payment` + `verify-rls` green | ✅ DONE | `20260527201447_batch_13b_rv_payment_rls` |
| 13b.5 | Inbox composite query | ✅ DONE | `loadInbox()` (listing) + `loadInboxItem()` (per-row detail with RvUnit choices + expenditure choices + locked TC) |
| 13b.6 | `/inbox` listing + `/inbox/[id]` classification detail | ✅ DONE | Listing sorted date-desc; detail shows full bank-tx + 4-tab classification widget |
| 13b.7 | Classification server actions | ✅ DONE | `classifyAsExpenditureAction` (creates Expenditure + flips status + 2 audit rows), `classifyAsRvPaymentAction` (creates RvPayment + flips status + 2 audit rows), `markAsNonBusinessAction` (flips status + classifierNote + audit row, no gold-side row), `skipClassificationAction` (note + audit, status stays UNCLASSIFIED) |
| 13b.8 | Dashboard `Inbox` button + count badge | ✅ DONE | Amber badge shows UNCLASSIFIED count when > 0; hidden for roles without `UPDATE bank_transaction` |
| 13b.9 | End-to-end smoke (all 4 classification paths) | ✅ DONE | Ingested 1 G&T sample, exercised all 4 paths, verified reverse FKs (`Expenditure.sourceBankTransactionId` + `RvPayment.bankTransactionId` both wire back correctly), cleaned up |
| 13b.10 | PROGRESS.md + this tracker updated | ✅ DONE | |

#### 13b smoke metrics

```
Ingested: 35 bronze + 6 silver (April 2026 statement)
Classified:
  ✓ Expenditure path → Expenditure row created, status=EXPENDITURE, FK verified
  ✓ RvPayment path → RvPayment row created on Casa 1, status=RV_PAYMENT, FK verified
  ✓ Non-business path → status=TAX, no gold-side row
  ✓ Skip path → classifierNote added, status stays UNCLASSIFIED
Final breakdown: 3 UNCLASSIFIED · 1 EXPENDITURE · 1 RV_PAYMENT · 1 TAX
Cleanup: 1+1+6+35+2+1+3 rows hard-deleted; zero residue.
```

### Batch 13c — Per-house reconciliation UI

| # | Deliverable | Status | Notes |
|---|---|---|---|
| 13c.1 | Reconciliation calc (pure function): planned cuotas + `RvPayment` rows → per-month rows + cumulative + 7 status types | ✅ DONE | `src/lib/calc/reconciliation.ts` |
| 13c.2 | Composite query `loadCasaReflujo(id)` | ✅ DONE | Reads `RvUnit` + buyer + 36 `MonthlyProjection` rows (extracts `revenuePerHouse[casaName]`) + all `RvPayment` rows |
| 13c.3 | `/casa/[id]/reflujo` page | ✅ DONE | Header + status badge counts + monthly reconciliation table with payment sub-rows + cumulative balance column |
| 13c.4 | Wire links from L0 RevenueBlock | ✅ DONE | RvUnit names now link to `/casa/[id]/reflujo` from the L0 dashboard. Added `id` to `RevenueMetrics.perUnit` (revenue.ts + types.ts + dashboard query); patched the existing revenue spec |
| 13c.5 | Vitest cases for reconciliation calc | ✅ DONE | 12 new cases covering all 7 status types + cumulative math + edge cases (pre-project payments, zero schedule, MISSED/UPCOMING boundary). Suite total 97/97 + 2 skipped |
| 13c.6 | End-to-end smoke against real seeded data | ✅ DONE | Casa 1 (SOLD): planned $974,382.47 = sale price; 12 MISSED past months + 5 UPCOMING + 19 NO_ACTIVITY (months with planned=0). Casa 3 (AVAILABLE): `noBuyerYet=true`, planned $1.275M shows as UPCOMING throughout |
| 13c.7 | PROGRESS.md + this tracker updated | ✅ DONE | |

#### 13c smoke metrics (read-only — no DB writes)

```
Casa 1 (SOLD, M13 current):
  Sale price: $974,382.43
  Planned:    $974,382.47   ← sums to sale price (Decimal rounding drift across 17 active months)
  Paid:       $0.00         ← no RvPayments classified into system yet
  Counts:     12 MISSED · 5 UPCOMING · 19 NO_ACTIVITY  (36 rows total)

Casa 3 (AVAILABLE):
  noBuyerYet: true   ← banner shown on page
  Planned:    $1,275,000   (projection for hypothetical future buyer)
  Counts:     19 UPCOMING · 17 NO_ACTIVITY
```

### Batch 13d — Check-register adapter

| # | Deliverable | Status | Notes |
|---|---|---|---|
| 13d.1 | Prisma schema: `IssuedCheque` model + relations + indexes + UNIQUE natural-key | ✅ DONE | |
| 13d.2 | Migration 13.3 via `migrate diff` per D23 | ✅ DONE | `20260528060736_batch_13d_issued_cheque` |
| 13d.3 | RBAC: `issued_cheque` resource + `verify-rbac` green | ✅ DONE | ANALISTA: READ+UPDATE+DELETE · AUXILIAR: READ+UPDATE · CEO: READ |
| 13d.4 | RLS policies for `issued_cheque` + `verify-rls` green | ✅ DONE | `20260528060836_batch_13d_issued_cheque_rls` |
| 13d.5 | Parser types: add `issuedChequeCandidates` to `ParseResult` | ✅ DONE | |
| 13d.6 | G&T check-register adapter + tests | ✅ DONE | `banks/gt/check-register.ts`. 9 new vitest cases covering detect + parse + dirty-data scenarios. |
| 13d.7 | Main G&T `index.ts` dispatches on detected statement type | ✅ DONE | CURRENT_ACCOUNT tried first (0.95 conf); falls back to CHECK_REGISTER (0.9 conf) if no current-account match. Parse dispatches to the correct sub-adapter on the detected `statementType`. |
| 13d.8 | `ingest.ts`: IssuedCheque promotion path | ✅ DONE | Parallel branch to BankTransaction. Same dedup pattern via natural-key UNIQUE; UNIQUE-violation → DUPLICATE_OF_PRIOR_IMPORT flag; bronze always captured per D31. |
| 13d.9 | End-to-end smoke against the real check-register sample | ✅ DONE | See metrics below |
| 13d.10 | PROGRESS.md + this tracker updated | ✅ DONE | |

#### 13d smoke metrics (real `0426. CORRELATIVO DE CHEQUES ANTIGUA ABRIL 26.xlsx`)

```
Detected:  GT_CONTINENTAL · CHECK_REGISTER · 2 sheets matched (DOLARES + QUETZALES)
Bronze:    528 source rows captured verbatim
Promoted:  189 IssuedCheques (87 USD + 102 GTQ)
           22 of those marked isVoided=true (ANULADO rows)
Silver (BankTransaction):  0 — correct; check register is a parallel path
Parser warnings:           0
File-hash UNIQUE:          ✓ re-upload rejected
Dirty-data row Q#7:        FECHA="XXXX" + MONTO="XXXX" → handled per D31
                           (payee="ANULADO", amount=0, issueDate=null, isVoided=true)
Cleanup:                   189 + 528 + 2 + 1 = 720 rows hard-deleted, zero residue.
```

---

## 10. What's NOT done (parking-lot for future batches)

- **Bank-account binding for unbound IssuedCheques** — Today's QUETZALES check register lands with `bankAccountId=null` because the file title doesn't identify the specific G&T QTZ account (3 candidates). A future UI flow lets the analyst pick the binding per import. USD cheques could be auto-bound (1 G&T USD account); not implemented today to keep the path uniform.
- **Cheque ↔ bank-transaction reconciliation** — When a cheque is cashed, the bank statement shows `Referencia=cheque_number`. Matching pass (set `IssuedCheque.cashedByBankTransactionId`) is future work — pure read-side logic that doesn't need new schema.
- **Cheque-driven Expenditure classification** — Today the `/inbox/[id]` widget for an outflow bank-tx asks for vendor/category. When the bank-tx represents a cashed cheque, the widget COULD pre-fill from `IssuedCheque.concepto` + `payeeName` + `partida`. Reasonable Batch 17 work.

#### 13d architectural decisions

- **Why `IssuedCheque` as a new entity instead of just dumping into bronze JSONB or attaching to Expenditure**: Ronny uses the check register to track INTENT to pay (which cheques exist + are voided + are pending vs cashed), which is different from the actual Expenditure (the accounting outflow once the cheque clears). The two are linked via cheque number — `IssuedCheque.classifiedExpenditureId` (nullable) connects them when classification happens.
- **Why under `banks/gt/`**: today's only check register is FORMA's internal log for cheques drawn on G&T accounts. When other-bank registers arrive, we'd either add `banks/promerica/check-register.ts` or extract a shared `statement-types/check-register.ts` helper. For now, G&T-scoped keeps it simple.
- **Why `bankAccountId` is nullable**: the check register file's title says "CONDOMINIO ANTIGUA PANORAMA" but doesn't identify a specific bank account. USD sheet → only 1 G&T USD account → deterministic bind. QTZ sheet → 3 G&T QTZ accounts → ambiguous → null + user binds later via UI.
- **`isVoided: boolean`** for ANULADO rows. Source values (`NOMBRE="ANULADO"`, amount=0) preserved verbatim; the boolean is a derived convenience field so queries can `where: { isVoided: false }` cleanly.
- **Dirty-data observed in QUETZALES sheet row 10**: `FECHA="XXXX"` (string, not a date), `MONTO Q="XXXX"` (string, not a number). The parser handles this per D31: row lands in bronze verbatim; IssuedCheque gets `issueDate=null` + `amountSigned=0` + a `BANK_PARSER_WARNING` flag.

---

---

## 1. Mission framing

Ronny's daily job today, captured in `memory/project_ronny_workflow.md`:

1. Download monthly statements from each bank's website (one `.xls` per
   account, per month; sometimes a combined file).
2. Manually type rows into the master xlsx workbook (`Detalle egresos` sheet).
3. Annotate each row with `CASA` (sold-house mapping) + `COMISION` flag.
4. Reconcile to per-house cash-flow sheets (`C1` … `C11`).
5. Maintain a separate check register; cross-reference cheque numbers.

The app replaces steps 2–5. Step 1 stays human (until banks expose an API,
which is not on the horizon).

### Hard rules (Jorge, 2026-05-27, verbatim spirit)

- **The parser never fails, never drops, never loses data.** Contradictions
  and edge cases surface in the UI as `DataQualityFlag` rows + provenance.
  This is D31 — already governing the xlsx parser since Batch 5.
- Format varies bank-to-bank, statement-to-statement, even within a single
  file (G&T monthlies have a "twin sheet" pattern). Parser must be
  content-anchored, not position-anchored.
- Files often overlap (Ronny re-exports overlapping date ranges by habit or
  by accident). Code defensively against duplicates.

---

## 2. Data shapes observed in `docs/REFLUJO/` (from MANIFEST scans 2026-05-22)

### 2.1 G&T monthly statements (`.xls`, 2 sheets per file)

- **Title row 1:** `ESTADO DE CUENTA POR RANGO DE FECHAS - MONETARIO (DOL|QTZ)`
- **Row 3:** `#Cuenta | _ | <account#> | _ | Nombre de la Cuenta | <legal entity>`
- **Rows 4–5:** Fecha Inicial / Fecha Final / Saldo Inicial / Saldo Final / Generado el
- **Row 7 header:** `# | Fecha | Referencia | Descripción | Débito | Crédito | Saldo | Agencia`
- **Row 8 onwards:** transactions
- **Trailing rows:** `Total Débitos`, `Total créditos`, `Total de Transacciones`

**Variability observed across the 6 monthlies + the consolidated workbook:**

| Variant axis | Examples |
|---|---|
| Sheet names | `9998717622__3_18_2026_1_11_49_P` (Jan), `Cta QTZ 00200272332` (Mar), `DOLARES 00299005975` (Apr), `$ abr26` (consolidated) — never the same twice |
| Sign convention | Jan QTZ stores debits **negative**; Feb QTZ second sheet stores same debits **positive** |
| Currency restatement | USD files often have a second sheet with values restated in GTQ-equivalent (×~7.66) |
| Combined vs split | Jan/Feb each have two files (USD + QTZ separately); Mar/Apr have one file with two sheets |
| Date format | `dd/mm/yyyy` strings AND native Excel dates both seen |
| Header row | Always row 7 (5 files inspected). Anchor on this. |

### 2.2 Check register (`0426. CORRELATIVO ... .xlsx`, 2 sheets `DOLARES` + `QUETZALES`)

- **Row 3 header:** `_ | ID | FECHA | NO. CHEQUE | NOMBRE | MONTO Q | MONTO $ | SOLICITUD | CONCEPTO | PARTIDA | CXC | SALDO`
- **`ANULADO` rows present** with the literal text in NOMBRE/CONCEPTO and amount 0 — these are voided cheques and must flow through the parser per D31. They map to `kind=VOIDED_CHEQUE` at silver layer, not to outflow Expenditures.

### 2.3 Consolidated annotated workbook (`2026-05-13 ... (FORMA).xlsx`, 9 sheets)

This is Ronny's CURRENT WORK PRODUCT, not an input. Useful for understanding
the target shape but it does not flow into the parser pipeline. The sheets
`C1`, `C2`, `C5-D`, `C6`, `C7`, `C11` are per-house cash-flow reconciliations
(planned cuotas vs actual payments). The `$ abr26` + `Q abr26` sheets show
the April statements re-imported with `CASA` + `COMISION` columns added —
this is the **annotation step** the app will replace.

---

## 3. Architecture — medallion + journal

```
┌─────────────────────────────── BRONZE (immutable raw capture) ────────────────────────────────┐
│                                                                                                │
│  BankStatementImport ─────► BankStatementSheet ─────► BankStatementRawRow                      │
│  (1 per uploaded file)      (1 per sheet)            (1 per source data row, JSONB)            │
│                                                                                                │
│  - file_sha256 UNIQUE       - is_canonical (toggle)  - raw_cells JSONB                         │
│  - uploaded_by_user_id      - detected_account_id    - source_row_number                       │
│  - file_size, file_name     - detected_currency      - parse_status (OK | UNPARSEABLE)         │
│                             - detected_period_start                                            │
│                             - alternates_link_id                                               │
│                                                                                                │
│  ► Append-only. Never modified. Source of truth that the parser captured EVERYTHING.           │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │  silver-build pass (deterministic, re-runnable)
                                       ▼
┌─────────────────────────────── SILVER (normalized canonical stream) ──────────────────────────┐
│                                                                                                │
│  BankTransaction                                                                               │
│  - bank_account_id (FK)                                                                        │
│  - transaction_date                                                                            │
│  - amount_signed (positive = inflow, negative = outflow)                                       │
│  - currency                                                                                    │
│  - reference (cheque #, ACH ref, etc.)                                                         │
│  - description                                                                                 │
│  - agencia                                                                                     │
│  - bronze_row_id (FK, single source of provenance)                                             │
│  - classification_status  (UNCLASSIFIED | EXPENDITURE | RV_PAYMENT | PARTNER_CONTRIBUTION |    │
│                            INTERNAL_TRANSFER | INTEREST | FEE | TAX)                           │
│  - classified_expenditure_id (FK nullable)                                                     │
│  - classified_rv_payment_id (FK nullable)                                                      │
│                                                                                                │
│  UNIQUE (bank_account_id, transaction_date, reference, amount_signed)                          │
│  ◄── this is where the overlap-defense lives                                                   │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │  human classification (UI replaces Ronny's CASA/COMISION step)
                                       ▼
┌─────────────────────────────── GOLD (business-classified) ────────────────────────────────────┐
│                                                                                                │
│  Expenditure (existing)        outflows already classified to budget category                  │
│   + sourceBankTransactionId FK NEW                                                             │
│                                                                                                │
│  PartnerContribution (existing) equity events                                                  │
│   + sourceBankTransactionId FK NEW (nullable — historical PCs are pre-bank)                    │
│                                                                                                │
│  RvPayment (NEW)               inflows tied to a house's installment schedule                  │
│   - id, rvUnitId (FK), bankTransactionId (FK)                                                  │
│   - amountUsd, amountGtq, exchangeRateUsed                                                     │
│   - matchedScheduleEntryId (FK nullable — if matched to a specific planned cuota)              │
│   - reconciliationStatus (MATCHED | OVERPAYMENT | UNDERPAYMENT | UNMATCHED)                    │
│                                                                                                │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Why this shape

- **Bronze = D31 made explicit.** The parser dumps every cell from every sheet
  from every file into JSONB. If we later realize we missed a column, we
  re-derive silver without re-uploading anything.
- **Silver = the place we trust.** Every downstream calc (budget health,
  cash-flow reconciliation, EBITDA) reads from silver, not from gold-specific
  tables. Gold is just a classification overlay.
- **Twin-sheet decision is a UI toggle on `bank_statement_sheet.is_canonical`.**
  Silver derives only from canonical sheets. Flipping the toggle re-derives
  silver — no re-upload, no data loss, full audit trail.
- **The UNIQUE constraint at silver is the dedup gate.** Bronze can grow
  indefinitely from overlapping exports; silver stays one-row-per-real-event.
- **Existing tables stay.** `Expenditure` and `PartnerContribution` keep
  doing what they do; they gain an optional FK back to `BankTransaction`.
  Historical xlsx-sourced rows have a null FK, which is fine.

### 3.2 Why NOT the alternatives

| Alternative considered | Why rejected |
|---|---|
| One `Expenditure` table with `kind=INFLOW` discriminator | Overloads a table whose purpose is "classified outflow against budget." Inflows have their own lifecycle (cuota matching, reconciliation status) that doesn't fit the budget-category model. |
| Separate `BankInflow` + `BankOutflow` tables | Violates the journal-pattern enterprise-DB norm. Doubles the join surface for every "where did this money come from" query. Reconciliation across both becomes a UNION query. |
| Skip the bronze layer; parse directly to canonical rows | Violates D31. If we drop a cell during initial parse, we can never recover it. Bronze is the safety net. |
| Skip silver; have gold tables read from bronze JSONB directly | Pushes interpretation cost to every read. Loses the dedup guarantee. Loses signed-amount semantic clarity. |

### 3.3 Parity with industry pattern

- **Medallion architecture** (Databricks / Microsoft Fabric / dbt) — the
  bronze/silver/gold layering is the industry standard for raw-data
  ingestion pipelines.
- **Journal / single-ledger pattern** (every accounting system since Pacioli
  1494; Odoo's `account.move.line`; QuickBooks; SAP `BSEG`) — one stream
  with signed amounts + direction discriminator.
- The PA DB (FORMA's sister-company system that Jorge has previously
  flagged as "ahead in normalization") almost certainly uses this exact
  pattern. Worth confirming before migration lands.

---

## 4. Parser registry

```
src/lib/import/
  registry.ts                   ← single export: BANKS = [gtAdapter, /* promericaAdapter, ... */]
  detect.ts                     ← runs adapter.detect() in order; first match wins; "UNKNOWN" otherwise
  types.ts                      ← BankAdapter interface

  banks/
    gt/
      detect.ts                 ← title-row + #Cuenta-cell signature
      parse.ts                  ← header-anchored row extractor
      types.ts                  ← G&T-specific raw shape
      __fixtures__/             ← captured-byte fixtures from real probes (gitignored if PII)
    promerica/
      detect.ts                 ← STUB — returns { match: false }
      README.md                 ← "fill in when a sample arrives in docs/REFLUJO/"
    bac/
      detect.ts                 ← STUB
      README.md
    industrial/
      detect.ts                 ← STUB
      README.md

  statement-types/
    current-account.ts          ← generic shape used by all current-account adapters
    check-register.ts           ← different schema; check-register adapters reference this
```

### 4.1 `BankAdapter` interface (proposal)

```ts
interface BankAdapter {
  bank: BankName;               // "GT" | "PROMERICA" | "BAC" | "INDUSTRIAL"
  detect(file: ParsedWorkbook): DetectResult;
  parse(file: ParsedWorkbook, sheetIndex: number): ParseResult;
}

interface DetectResult {
  match: boolean;
  confidence: number;           // 0..1 — for tie-breaking if two adapters match
  detectedAccount?: string;     // account # extracted from file
  detectedCurrency?: "GTQ" | "USD";
  detectedPeriod?: { from: string; to: string };
  statementType: "CURRENT_ACCOUNT" | "CHECK_REGISTER" | "CREDIT_CARD" | "UNKNOWN";
}

interface ParseResult {
  /// Bronze rows: 1 per source data row, JSONB-shaped, NEVER dropped.
  rawRows: Array<{ rowNumber: number; cells: Record<string, unknown>; parseStatus: "OK" | "UNPARSEABLE"; note?: string }>;
  /// Silver-promotion candidates: derived from rawRows where parseStatus=OK.
  /// May be empty if the sheet is a non-data variant (TOTAL row only, etc.).
  silverCandidates: Array<NormalizedTransaction>;
  /// DataQualityFlag rows the parser wants the app to surface.
  flags: Array<{ kind: string; severity: "INFO" | "WARNING" | "ERROR_VISIBLE"; context: string; rowNumber?: number }>;
}
```

### 4.2 G&T adapter behavior (the one we ship real)

1. Detection: file contains a sheet with row-1 cell `A1` matching
   `/^ESTADO DE CUENTA POR RANGO DE FECHAS .* MONETARIO \((DOL|QTZ)\)/i`
   AND row-3 cell `A3` = `#Cuenta` → match with confidence 0.95.
2. Twin-sheet handling: if file has multiple sheets matching, take the
   first as canonical and link the rest via `alternates_link_id`. The UI
   shows both; user toggles which is canonical.
3. Header anchor: locate the row whose A-column = `#` AND B = `Fecha`
   AND C = `Referencia` (etc). Per Batch 5 + the Dirty George principle:
   find by content, never by row index.
4. Per row: capture every cell into `BankStatementRawRow.raw_cells` JSONB.
   Then derive `silverCandidates` with normalized amounts (sign normalized
   so that `Débito > 0` becomes `amount_signed < 0`; `Crédito > 0` becomes
   `amount_signed > 0`).
5. Sign-convention drift defense: if 90% of debits in a sheet are positive,
   we trust the sign; if mixed, we emit a `DataQualityFlag` with
   `kind=SIGN_CONVENTION_AMBIGUOUS` and rely on the `Saldo` column running
   total to validate row-by-row.

---

## 5. UI flow

### 5.1 Upload page (`/import/new`)

- File input accepts `.xls`, `.xlsx`, `.csv`
- Drop file → `parseAndPreview()` server action returns bronze + detection +
  silver candidates without persisting yet
- Preview screen shows: detected bank, detected accounts, detected periods,
  N sheets found, N silver candidates per sheet, flagged anomalies
- `Confirm import` → persists bronze + silver (within UNIQUE constraint).
  Returns a list of `BankTransaction` rows landed + duplicates suppressed +
  flags raised.

### 5.2 Twin-sheet toggle (`/import/[id]`)

- Each sheet in the import shows its rows + `is_canonical` toggle
- Flipping the toggle: server action re-derives silver from the new canonical set
- Read-only audit trail of who toggled what when

### 5.3 Classification queue (`/inbox`)

- Replaces Ronny's `CASA` / `COMISION` annotation step
- `BankTransaction WHERE classification_status = UNCLASSIFIED` ordered by date
- Per-row classification widget:
  - "Outflow → Expenditure" → opens a mini version of `/entry/new` pre-filled with the bank-transaction data; on submit, creates Expenditure + sets `BankTransaction.classified_expenditure_id`
  - "Inflow → RV Payment" → picks a Casa + a planned cuota row (if any) → creates RvPayment
  - "Internal transfer" / "Interest" / "Fee" / "Tax" → flags the row, no gold-side row created
  - "Skip" → keeps as UNCLASSIFIED with a `reviewer_note`

### 5.4 Per-house reconciliation (`/casa/[id]/reflujo`)

- Replaces `C1` / `C2` / `C5-D` / `C6` / `C7` / `C11` sheets
- Planned cuotas (from RvUnit's payment schedule) vs RvPayment rows
- Status pills: MATCHED / OVERPAYMENT / UNDERPAYMENT / UNMATCHED

---

## 6. Migration plan

If you sign off on this design:

### Migration 13.1 — Bronze + silver tables

```
+ bank_statement_import
+ bank_statement_sheet
+ bank_statement_raw_row
+ bank_transaction         (with UNIQUE (bank_account_id, transaction_date, reference, amount_signed))
```

### Migration 13.2 — Gold additions

```
+ rv_payment
+ Expenditure.source_bank_transaction_id (nullable FK)
+ PartnerContribution.source_bank_transaction_id (nullable FK)
```

### Migration 13.3 — RBAC additions

```
+ resource: bank_statement_import (ANALISTA full CRUD; AUXILIAR CREATE+READ; CEO READ; MASTER full)
+ resource: bank_statement_sheet  (same)
+ resource: bank_statement_raw_row (READ-only for all non-MASTER — bronze is immutable)
+ resource: bank_transaction      (ANALISTA full CRUD; AUXILIAR READ+UPDATE; CEO READ)
+ resource: rv_payment            (ANALISTA full CRUD; AUXILIAR full CRUD; CEO READ)
```

### Code additions (post-migration)

1. `src/lib/import/` registry + detect + G&T adapter
2. `src/lib/queries/import-preview.ts` — server-side preview shape
3. `src/app/(app)/import/new/page.tsx` + `actions.ts` — upload + confirm
4. `src/app/(app)/import/[id]/page.tsx` — twin-sheet toggle UI
5. `src/app/(app)/inbox/page.tsx` — classification queue
6. `src/app/(app)/casa/[id]/reflujo/page.tsx` — per-house reconciliation
7. Tests: registry detection, G&T adapter against captured fixtures, silver
   dedup against overlapping-export scenarios

---

## 7. Sub-batch breakdown (proposed)

PLAN.md's Batch 13 was framed as "Bank CSV parser framework + G&T parser."
Reality is bigger — splitting into 4 sub-batches:

| Sub | Goal | Scope |
|---|---|---|
| 13a | Bronze + silver schema + G&T adapter + upload UI + dedup | Migrations 13.1+13.3, registry skeleton + G&T real adapter + 3 disabled stubs, `/import/new` + `/import/[id]` UI |
| 13b | Gold additions + classification queue | Migration 13.2, `/inbox` UI, gold-side FKs wired up |
| 13c | Per-house reconciliation | `/casa/[id]/reflujo` UI, RvPayment matching to planned cuotas |
| 13d | Check-register adapter | Different schema; separate adapter; gold-side mapping to Expenditure with check_number FK |

Each lands separately with its own PROGRESS.md entry. Ronny gets value at
the end of 13a (uploads work, no more retyping). Annotation replacement at
13b. Reconciliation at 13c. Cheque flow at 13d.

---

## 8. What I need from you before any of this lands

1. **Sign-off on the 3-layer schema** — explicitly or with edits. This is the
   load-bearing decision; everything else follows.
2. **Sign-off on the sub-batch split** (13a / 13b / 13c / 13d). If you'd
   rather collapse into 1 or 2 bigger batches, say so.
3. **Confirmation that NO existing tables get refactored** — specifically
   that `Expenditure` and `PartnerContribution` stay as-is plus the new
   nullable FK. (I am not proposing to rewrite the xlsx-sourced rows into
   bronze.)
4. **Confirmation on the RBAC posture** — specifically that AUXILIAR can
   `CREATE` a `bank_statement_import` (i.e., a junior can upload a statement)
   but can only `READ+UPDATE` on `bank_transaction` (cannot create new
   silver rows out of thin air — they come from bronze).

When you're rested. No rush.
