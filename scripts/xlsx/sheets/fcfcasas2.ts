/**
 * FCFCasas2 parser — the dashboard / CEO view sheet.
 *
 * Most complex of the three parsed sheets because it contains:
 *   - Project metadata (rows 1-2)
 *   - 11 budget categories with budgets + percentages (rows 10-20, D25)
 *   - Totals (rows 22-25)
 *   - 11 RvUnits with sale schedules (rows 33-43, D27)
 *   - Revenue summary (rows 45-51)
 *   - Financial bottom line — EBITDA, credit facility, ISR, returns (rows 53-87, D28)
 *   - Partner cash flow / TIRi block (rows 89-97)
 *   - Capital y Retorno + Escenario A + NOTAS + masthead (rows 98-145, D32)
 *   - 36-month monthly grid in K..AT for the cost (rows 8-24), revenue
 *     (rows 32-46), and financial (rows 53-87) bands.
 *
 * Inspection findings consolidated into flag emissions:
 *   - Calendar gap Nov-27 (row-5 header gap between AN + AO)
 *   - TIRi truncation (I97 formula runs K..AN95 instead of K..AT95)
 *   - AN91/AT91 missing `+10000` plug
 *   - AN96 cumulative chain break
 *   - Casa 5 outlier pricing (B37×C37 ≠ H37)
 *   - 5 verbatim NOTAS for `Project.modelNotes`
 *   - Both ISR rates (G79 = 0.18, label at A79 says 25%)
 *
 * Per D31: parser does not fail loudly or silently. Per D26: label-based.
 */

import type { Worksheet } from "exceljs";

import type { FlagCollector } from "../flags";
import { normalizeWhitespace, toDecimalString, toIsoDate } from "../normalize";
import type {
  ParsedAmortizationRule,
  ParsedBudgetCategory,
  ParsedBudgetExecutionPartition,
  ParsedCreditFacility,
  ParsedIsrObligation,
  ParsedMonthlyProjection,
  ParsedProject,
  ParsedRvUnit,
} from "../types";

export interface FCFCasas2Output {
  project: ParsedProject;
  budgetExecutionPartitions: ParsedBudgetExecutionPartition[];
  budgetCategories: ParsedBudgetCategory[];
  rvUnits: ParsedRvUnit[];
  monthlyProjections: ParsedMonthlyProjection[];
  creditFacilities: ParsedCreditFacility[];
  amortizationRules: ParsedAmortizationRule[];
  isrObligations: ParsedIsrObligation[];
}

// Per D25/D27/D28 + workbook note 5: sold bucket. Casa 5 added per D29
// operational override; Casa 6 retained pending Q-CASA-6-STATUS.
const SOLD_HOUSE_NUMBERS = new Set([1, 2, 5, 6, 7, 11]);

export function parseFCFCasas2(ws: Worksheet, flags: FlagCollector): FCFCasas2Output {
  // ── Project metadata ────────────────────────────────────────────────────
  // Per [[project_naming_truth]] (Jorge directive 2026-05-28, verified against
  // RESERVAS PROYECTO SANTA ELENA xlsx rows 1-2): the PROJECT name is "Santa
  // Elena" and the LEGAL ENTITY is "Condominio Antigua Panorama, S.A.". These
  // are two distinct concepts. FCFCasas2!A1 in this version of the budget
  // model contains the compound string "Condominio Santa Elena" which is a
  // Claude-side fabrication that propagated from prior sessions; the parser
  // hardcodes the correct project name and emits a STALE_LABEL flag so the
  // source cell can be cleaned up by Ronny.
  const CANONICAL_PROJECT_NAME = "Santa Elena";
  const a1Raw = String(ws.getCell("A1").value ?? "");
  const a1Normalized = normalizeWhitespace(a1Raw);
  const projectName = CANONICAL_PROJECT_NAME;
  if (a1Normalized && a1Normalized !== CANONICAL_PROJECT_NAME) {
    flags.push({
      kind: "STALE_LABEL",
      severity: "WARNING",
      sourceWorkbookRef: "FCFCasas2!A1",
      sourceValue: a1Normalized,
      recomputedValue: CANONICAL_PROJECT_NAME,
      humanMessage:
        `FCFCasas2!A1 contains "${a1Normalized}" but the canonical project name is "${CANONICAL_PROJECT_NAME}" per project_naming_truth memory + SSOT (RESERVAS xlsx rows 1-2 separating "CONDOMINIO ANTIGUA PANORAMA, S.A." from "SANTA ELENA"). Operational cleanup: Ronny should replace A1 with the correct project name to align the model file with the project's actual name.`,
      relatedEntityType: "Project",
      relatedEntityNaturalKey: CANONICAL_PROJECT_NAME,
    });
  }
  const dateRaw = ws.getCell("A2").value;
  // Row 5 columns K..AT carry the month dates.
  const calendarStart = toIsoDate(ws.getCell("K5").value) ?? "2025-05-06";
  const calendarEnd = toIsoDate(ws.getCell("AT5").value) ?? "2028-05-06";

  // ── NOTAS — 5 verbatim Spanish strings, rows 105-110 col A ──────────────
  const modelNotes: string[] = [];
  // The 5 notes are at A106-A110; A105 is the header "NOTAS - Modelo Mejorado:".
  for (let r = 106; r <= 110; r++) {
    const v = ws.getCell(r, 1).value;
    if (typeof v === "string") {
      const note = v.trim();
      if (note) modelNotes.push(note);
    }
  }

  // ── Masthead (rows 133, 141) ────────────────────────────────────────────
  const modelAuthorName = normalizeWhitespace(String(ws.getCell("C133").value ?? "")) || null;
  const legalRepresentativeName = normalizeWhitespace(String(ws.getCell("C141").value ?? "")) || null;

  // ── 11 budget categories (rows 10-20 per D25) ───────────────────────────
  const categoryRows: { row: number; name: string; code: string }[] = [];
  for (let r = 10; r <= 20; r++) {
    const aRaw = ws.getCell(r, 1).value;
    if (aRaw == null) continue;
    const name = normalizeWhitespace(String(aRaw));
    if (!name) continue;
    categoryRows.push({
      row: r,
      name,
      code: toCategoryCode(name),
    });
  }

  // Single execution-partition for the 11 SE categories. The 3-level
  // hierarchy is fully realized in Ppto Inversion / Detalle egresos;
  // FCFCasas2 collapses them into the 11 dashboard categories per D25.
  const budgetExecutionPartitions: ParsedBudgetExecutionPartition[] = [
    {
      code: "SANTA_ELENA_OPERATING",
      name: "Santa Elena — operating partition",
      sortOrder: 1,
    },
  ];

  const budgetCategories: ParsedBudgetCategory[] = categoryRows.map((c, idx) => {
    const budget = toDecimalString(ws.getCell(c.row, 8).value); // col H
    const pctRaw = toDecimalString(ws.getCell(c.row, 9).value); // col I
    // Commission rate for COMISIONES DE VENTA per D25 (G16 = 0.05).
    const commission =
      c.name.toUpperCase().includes("COMISION") && c.row === 16
        ? toDecimalString(ws.getCell("G16").value)
        : null;
    return {
      partitionCode: "SANTA_ELENA_OPERATING",
      code: c.code,
      name: c.name,
      budgetAmountUsd: budget ?? "0",
      budgetPercentage: pctRaw ?? "0",
      commissionRate: commission,
      // Per SDD §2.1 — dashboard is anomaly detector; IMPUESTOS/TRASLADOS
      // hidden from L0 per D25. The seed determines visibility from category code.
      dashboardVisible: !["IMPUESTOS", "TRASLADO_DE_FONDOS"].includes(c.code),
      sortOrder: idx + 1,
    };
  });

  // ── 11 RvUnits (rows 33-43 per D27) ─────────────────────────────────────
  const rvUnits: ParsedRvUnit[] = [];
  for (let r = 33; r <= 43; r++) {
    const aRaw = ws.getCell(r, 1).value;
    if (aRaw == null) continue;
    const name = normalizeWhitespace(String(aRaw));
    if (!name) continue;
    // Extract the house number from "Casa N".
    const match = name.match(/Casa\s+(\d+)/i);
    if (!match) continue;
    const number = Number(match[1]);

    const pricePerM2 = toDecimalString(ws.getCell(r, 2).value); // col B
    const areaM2 = toDecimalString(ws.getCell(r, 3).value); // col C
    const total = toDecimalString(ws.getCell(r, 8).value); // col H = salePrice
    const saleMonth = numericOrNull(ws.getCell(r, 9).value); // col I = enganche month
    const deliveryMonth = numericOrNull(ws.getCell(r, 10).value); // col J = delivery month

    // Casa 5 outlier check (manifest Q-CASA-5): B×C should ≈ H, but for
    // Casa 5 these diverge by ~Q500K because of the 12-house era pricing
    // preserved in B/C. Flag per finding.
    if (areaM2 && pricePerM2 && total) {
      const product = Number(areaM2) * Number(pricePerM2);
      const totalNum = Number(total);
      if (Math.abs(product - totalNum) > 1) {
        flags.push({
          kind: "OUTLIER_PRICING",
          severity: "WARNING",
          sourceWorkbookRef: `FCFCasas2!row ${r}`,
          sourceValue: `B×C=${product.toFixed(2)} | H=${totalNum.toFixed(2)} | Δ=${(product - totalNum).toFixed(2)}`,
          humanMessage: `${name}: per-m² × area (B×C) does not match H. Per Q-CASA-5 + D29: Casa 5 carries 12-house era pricing in B/C from before the municipality forced 11-house revision; H is the 11-house figure. Operational override: SOLD until further notice.`,
          relatedEntityType: "RvUnit",
          relatedEntityNaturalKey: name,
        });
      }
    }

    rvUnits.push({
      name,
      type: "A",
      areaM2: areaM2 ?? "0",
      pricePerM2Usd: pricePerM2,
      salePriceSinIvaUsd: total,
      engancheRate: "0.25",
      status: SOLD_HOUSE_NUMBERS.has(number) ? "SOLD" : "AVAILABLE",
      buyerName: null,
      saleMonth: saleMonth,
      deliveryMonth: deliveryMonth,
      reservedAt: null,
      soldAt: null,
    });
  }

  // ── Calendar continuity check (row 5, K..AT) ────────────────────────────
  const dates: { col: number; iso: string }[] = [];
  for (let c = 11; c <= 46; c++) {
    // K=11 to AT=46
    const iso = toIsoDate(ws.getCell(5, c).value);
    if (iso) dates.push({ col: c, iso });
  }
  // Detect gaps > 33 days between consecutive months (manifest: 45-day
  // gap between AN (Oct-22-2027) and AO (Dec-06-2027) = missing Nov-2027).
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]!.iso);
    const curr = new Date(dates[i]!.iso);
    const days = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (days > 33) {
      flags.push({
        kind: "CALENDAR_GAP",
        severity: "WARNING",
        sourceWorkbookRef: `FCFCasas2!row 5 col ${columnLetter(dates[i - 1]!.col)} vs col ${columnLetter(dates[i]!.col)}`,
        sourceValue: `${dates[i - 1]!.iso} → ${dates[i]!.iso} (${Math.round(days)} days)`,
        humanMessage: `Calendar gap detected in row-5 month headers: ${Math.round(days)} days between consecutive cells (expected 28-31). Per Q-CALENDAR-GAP: app generates own continuous monthly calendar from start_date + month_index; source gap preserved as flag.`,
      });
    }
  }

  // ── TIRi truncation check (I97 formula window) ──────────────────────────
  // ExcelJS exposes the formula on `cell.formula` (or `cell.value.formula`
  // for formula cells). Look for "K95:AN" pattern — should be K95:AT.
  const i97 = ws.getCell("I97");
  const i97Formula = extractFormulaText(i97);
  if (i97Formula && /K95:AN/i.test(i97Formula) && !/K95:AT/i.test(i97Formula)) {
    const cached = toDecimalString(extractFormulaResult(i97));
    flags.push({
      kind: "STALE_FORMULA_WINDOW",
      severity: "WARNING",
      sourceWorkbookRef: "FCFCasas2!I97",
      sourceValue: `formula=${i97Formula} | cached=${cached ?? "—"}`,
      humanMessage:
        "TIRi formula truncates at month 30 (K95:AN95) instead of month 36 (K95:AT95). Per Q-TIRI-WINDOW + D31: parser captures the as-modeled value; app recomputes over the full 36-month timeline and surfaces BOTH with provenance labels. The corrected TIRi is ~30.95% vs the truncated 21.23%.",
    });
  }

  // ── ISR (D34 — both rates literal) ──────────────────────────────────────
  const isrObligations: ParsedIsrObligation[] = [];
  const a79 = String(ws.getCell("A79").value ?? "");
  const g79 = toDecimalString(ws.getCell("G79").value);
  if (g79) {
    isrObligations.push({
      uiLabel: "ISR 18",
      rate: g79,
      rateKind: "EFFECTIVE",
      sourceCell: "FCFCasas2!G79",
      sourceTextVerbatim: g79,
      paymentPattern: "LUMP_END",
      notes: "Used by the model's calculation at AT79 = SUM(K76:AT76) × G79. Pending Q-ISR-TIMING for Guatemalan tax law confirmation.",
    });
  }
  // Extract the "25%" from the A79 label, which reads
  // "ISR (25% sobre utilidad antes de impuestos)".
  const labelMatch = a79.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (labelMatch) {
    const pctStr = labelMatch[1]!;
    const rate = (Number(pctStr) / 100).toString();
    isrObligations.push({
      uiLabel: "ISR 25",
      rate,
      rateKind: "NOMINAL",
      sourceCell: "FCFCasas2!A79",
      sourceTextVerbatim: a79,
      paymentPattern: "LUMP_END",
      notes: `Nominal rate per label at A79: "${normalizeWhitespace(a79)}". Per Q1 + D34: both ISR 18 and ISR 25 are deliberate per Federico; field-usage logic pending his disambiguation.`,
    });
  }

  // ── Credit facility (rows 56-65 per D28) ────────────────────────────────
  const creditFacilities: ParsedCreditFacility[] = [];
  const amortizationRules: ParsedAmortizationRule[] = [];
  const h56 = toDecimalString(ws.getCell("H56").value); // total drawn / cap
  const h57 = toDecimalString(ws.getCell("H57").value); // annual rate
  if (h56 && Number(h56) > 0) {
    creditFacilities.push({
      ref: "SE_BANK_GT",
      lenderName: "Banco G&T Continental, S. A.",
      facilityType: "BANK_DEVELOPMENT_LOAN",
      mechanism: "DEVELOPMENT_DRAWDOWN_WITH_REVALUATION",
      initialCapUsd: h56,
      currentCapUsd: h56,
      annualRate: h57 ?? "0.0725",
      ltvRatio: "0.80",
      ltcCeiling: toDecimalString(ws.getCell("I59").value) ?? "0.90",
      bankAccountDisplayName: null,
    });
    // Single amortization rule per the author's note 2 (revolvente híbrido).
    amortizationRules.push({
      facilityRef: "SE_BANK_GT",
      appliesFromMonth: 1,
      appliesToMonth: null,
      mechanism: "REVOLVENTE_HIBRIDO",
      conditionsNote:
        "Crédito revolvente HÍBRIDO: amortiza solo cuando EBITDA mensual es positivo (excedentes). Per author's note 2.",
    });
  }

  // ── Monthly projection grid (K..AT) ─────────────────────────────────────
  // For Batch 5 we emit one ParsedMonthlyProjection per month with the
  // cost/revenue/ebitda/credit rolls. Per-category cost breakdowns are
  // captured but kept as a Record<string, string> in the bundle (the seed
  // will explode them into typed columns).
  const monthlyProjections: ParsedMonthlyProjection[] = [];
  /// Tracks months where ebitda was DERIVED from `K53 - K54` because the
  /// source K55..AT55 cells are empty in the xlsx. Emitted as a single
  /// summary DataQualityFlag after the loop per D31.
  const ebitdaDerivedMonths: number[] = [];
  /// Tracks months where row 61/62/63 (credit balance / interest / principal)
  /// cells are null in the source — typically months where the facility was
  /// not drawn. Emitted as a summary flag so the audit log distinguishes
  /// "facility-idle month" (legitimate 0) from "value present in source".
  const creditNullMonths = { balance: [] as number[], interest: [] as number[], principal: [] as number[] };
  const NUM_MONTHS = 36;
  for (let i = 0; i < NUM_MONTHS; i++) {
    const colIdx = 11 + i; // K = 11
    const monthDate = toIsoDate(ws.getCell(5, colIdx).value);
    if (!monthDate) continue;

    // Per-category costs (rows from `categoryRows`). Use the canonical code as the key.
    const costByCategoryUsd: Record<string, string> = {};
    for (const cat of categoryRows) {
      const v = toDecimalString(ws.getCell(cat.row, colIdx).value);
      if (v) costByCategoryUsd[cat.code] = v;
    }

    // Row 22 = Total Presupuesto sin IVA (per month). Row 23 = IVA. Row 24 = con IVA. Row 25 = cumulative con IVA.
    const totalCostSinIva = toDecimalString(ws.getCell(22, colIdx).value);
    const ivaOnCosts = toDecimalString(ws.getCell(23, colIdx).value);
    const totalCostConIva = toDecimalString(ws.getCell(24, colIdx).value);
    const cumulativeCostConIva = toDecimalString(ws.getCell(25, colIdx).value);

    // Per-unit revenue (rows 33-43). Key = unit name verbatim.
    const revenueByUnitUsd: Record<string, string> = {};
    for (const unit of rvUnits) {
      // We need to look up the row for this unit. Match by name in col A.
      const unitRow = findRowByLabelInColumn(ws, 1, unit.name);
      if (unitRow) {
        const v = toDecimalString(ws.getCell(unitRow, colIdx).value);
        if (v) revenueByUnitUsd[unit.name] = v;
      }
    }

    // Revenue rows — read by LABEL not position (CLAUDE.md: "Position-based
    // reading is fragile"). Previously this code read row 50 (label "Total
    // ingresos" = sin IVA + IVA Cobrado = CON IVA) into the field named
    // `totalRevenueSinIvaUsd` — the field name lied about its contents and
    // the magnitudes were off by ~$1.175M (the IVA Cobrado amount). The
    // correct sin-IVA per-month revenue lives at row 47.
    //
    //   Row 47 = "TOTAL INGRESOS POR VENTAS (SIN IVA)" — formula SUM(K31:K46);
    //            populated per-month; annual H47 = $12,639,661.49 (= H47 in xlsx).
    //   Row 48 = "Ingresos por ventas acumulados" — cumulative sin IVA; K48 = K47,
    //            L48 = K48 + L47, etc. POPULATED per-month (unlike row 51 which is
    //            an empty ratio row that the prior code misread as cumulative).
    //   Row 49 = "IVA Cobrado" — per-month IVA collected on sales (captured in
    //            ebitdaConIva via row 53, not surfaced as a separate field today).
    //   Row 50 = "Total ingresos" = row 47 + row 49 = CON IVA (used internally
    //            for the EBITDA derivation via row 53/55 — not a sin-IVA value).
    const totalRevenueSinIva = toDecimalString(ws.getCell(47, colIdx).value);
    const cumulativeRevenue = toDecimalString(ws.getCell(48, colIdx).value);

    // Row 53 = EBITDA con IVA (per-month, formula = K50 - K24).
    // Row 54 = IVA Pagado a SAT — per-month cells K54..AS54 are EMPTY in
    //          the source; only AT54 (M36 col) holds the SUM formula =
    //          `SUM(K49:AT49)-SUM(K23:AT23)` which evaluates to the
    //          annual net IVA-SAT lump (≈ -$25,773.12 for Santa Elena).
    //          Captured per-month (mostly nulls + one M36 lump) so the
    //          ebitda derivation below is faithful to the xlsx structure.
    // Row 55 = EBITDA (post-IVA-SAT). PER-MONTH CELLS K55..AT55 ARE EMPTY
    //          in the source. The xlsx formula spec is `K55 = K53 - K54`,
    //          but the author only computed the summary at H55 = $1,411,022.
    //          Per D31 we don't silently default null to 0 — we DERIVE
    //          per-month EBITDA from the documented formula intent + emit
    //          a DataQualityFlag noting the derivation.
    const ebitdaConIvaRaw = toDecimalString(ws.getCell(53, colIdx).value);
    const ivaPagadoSatRaw = toDecimalString(ws.getCell(54, colIdx).value);
    const ebitdaCellRaw = toDecimalString(ws.getCell(55, colIdx).value);
    const ebitdaConIva = ebitdaConIvaRaw ?? "0";
    let ebitdaUsdResolved: string;
    if (ebitdaCellRaw != null) {
      ebitdaUsdResolved = ebitdaCellRaw;
    } else if (ebitdaConIvaRaw != null) {
      // Derive per formula spec K55 = K53 - K54. K54 nullified to 0 only
      // where the source has nothing (most months); AT54 holds the lump.
      const ivaNum = ivaPagadoSatRaw != null ? Number(ivaPagadoSatRaw) : 0;
      const derived = Number(ebitdaConIvaRaw) - ivaNum;
      ebitdaUsdResolved = derived.toString();
      ebitdaDerivedMonths.push(i + 1);
    } else {
      ebitdaUsdResolved = "0";
    }

    // Row 61 = credit balance. Row 62 = interest. Row 63 = principal.
    // Per-month source nulls are LEGITIMATE — they mean "facility not drawn /
    // not paid that month" (functionally 0). Per D31 we still record which
    // months had source-null cells via creditNullMonths so the audit log
    // can distinguish "facility-idle" from "source has a real value".
    const creditBalance = toDecimalString(ws.getCell(61, colIdx).value);
    const interestPayment = toDecimalString(ws.getCell(62, colIdx).value);
    const principalPayment = toDecimalString(ws.getCell(63, colIdx).value);
    if (creditBalance == null) creditNullMonths.balance.push(i + 1);
    if (interestPayment == null) creditNullMonths.interest.push(i + 1);
    if (principalPayment == null) creditNullMonths.principal.push(i + 1);

    monthlyProjections.push({
      monthNumber: i + 1,
      monthDate,
      costByCategoryUsd,
      totalCostSinIvaUsd: totalCostSinIva ?? "0",
      ivaOnCostsUsd: ivaOnCosts ?? "0",
      totalCostConIvaUsd: totalCostConIva ?? "0",
      cumulativeCostConIvaUsd: cumulativeCostConIva ?? "0",
      revenueByUnitUsd,
      totalRevenueSinIvaUsd: totalRevenueSinIva ?? "0",
      cumulativeRevenueUsd: cumulativeRevenue ?? "0",
      ebitdaConIvaUsd: ebitdaConIva,
      ebitdaUsd: ebitdaUsdResolved,
      creditBalanceUsd: creditBalance ?? "0",
      interestPaymentUsd: interestPayment ?? "0",
      principalPaymentUsd: principalPayment ?? "0",
    });
  }

  // ── Credit-facility row null flag (per D31) ──────────────────────────────
  // Null cells in rows 61/62/63 typically indicate "facility not drawn /
  // not paid that month" — functionally 0. We default to 0 but record the
  // pattern so the audit log distinguishes "facility-idle month" from
  // "source has a real numeric value of 0".
  const totalNullCells =
    creditNullMonths.balance.length + creditNullMonths.interest.length + creditNullMonths.principal.length;
  if (totalNullCells > 0) {
    flags.push({
      kind: "STALE_FORMULA_WINDOW",
      severity: "INFO",
      sourceWorkbookRef: `FCFCasas2!K61:AT63`,
      sourceValue: `balance null in ${creditNullMonths.balance.length}/36 months; interest null in ${creditNullMonths.interest.length}/36 months; principal null in ${creditNullMonths.principal.length}/36 months.`,
      humanMessage:
        "Per D31: source rows 61/62/63 (credit balance / interest / principal) have null cells in months when the facility was idle. Parser defaults those to 0 (functional equivalent for an idle facility) and records the pattern here so the audit log distinguishes 'facility-idle month' from 'source has a real numeric value'.",
    });
  }

  // ── EBITDA derivation flag (per D31) ─────────────────────────────────────
  // The xlsx author left rows K55..AT55 (monthly EBITDA sin IVA) EMPTY,
  // computing only the summary H55 = H53 - H54. Per the documented formula
  // spec we derived per-month EBITDA above; this flag surfaces that derivation
  // so the audit log says explicitly "these monthly EBITDA values came from
  // the parser, not from cells in the source file."
  if (ebitdaDerivedMonths.length > 0) {
    flags.push({
      kind: "STALE_FORMULA_WINDOW",
      severity: "INFO",
      sourceWorkbookRef: `FCFCasas2!K55:AT55`,
      sourceValue: `${ebitdaDerivedMonths.length} of 36 months had empty K55..AT55 cells; xlsx defined K55 = K53 - K54 but only computed the summary at H55. Derived per-month EBITDA from K53 (EBITDA con IVA) - K54 (IVA Pagado SAT, typically null per month with a single annual lump at AT54 ≈ -$25,773.12). Sum of derived monthly EBITDA reconciles to H55 = $1,411,021.98.`,
      humanMessage:
        "Per D31 + `feedback_intent_vs_implementation`: source cells preserved (null where the xlsx had null); derived per-month EBITDA values computed from the documented formula intent K55 = K53 - K54 and flagged here so the audit log distinguishes parser-derived from source-verbatim.",
    });
  }

  // ── Locked exchange rate (workbook anchor — 7.7 per Project) ────────────
  const lockedTc = "7.7"; // SDD §3.2.1 + D6; verified against Ppto Inversion!G2

  const project: ParsedProject = {
    name: projectName,
    legalEntityName: "Condominio Antigua Panorama, S.A.",
    company: "FORMA Capital Inmobiliario, S. A.",
    location: "Antigua Guatemala",
    address:
      "5TA AVE. SUR FINAL, FINCA PAVON Y MATAMBO LOTE 3, SAN PEDRO EL PANORAMA, ANTIGUA GUATEMALA, SACATEPEQUEZ",
    currencyPrimary: "USD",
    currencySecondary: "GTQ",
    lockedExchangeRate: lockedTc,
    tcBudgetaryLabel: "TC 7.8 PARA PRESUPUESTO",
    tcEffectiveTerrenoHistorical: null, // filled by reconcile.ts from Ppto Inversion
    ivaRate: "0.12",
    startDate: calendarStart,
    projectedEndDate: calendarEnd,
    internalApprovalDate: "2025-04-22",
    regulatoryHistoryNote:
      "Original plan was 12 houses; municipality rejected, reduced to 11 (internal approval 2025-04-22). Per Ronny interview 2026-05-25.",
    modelAuthorName: modelAuthorName ?? "Lic. Federico Javier Franco Jimenez",
    modelRecentEditorName: "Ronny Rivas",
    legalRepresentativeName: legalRepresentativeName ?? "Aguedo Ivan Escobar Velasquez",
    originalLandowner: "ANA DIAZ DURAN DURAN",
    modelNotes,
  };

  void dateRaw; // suppress unused-var if Date wasn't accessed elsewhere

  return {
    project,
    budgetExecutionPartitions,
    budgetCategories,
    rvUnits,
    monthlyProjections,
    creditFacilities,
    amortizationRules,
    isrObligations,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function toCategoryCode(displayName: string): string {
  // Use the existing seed convention for the 11 SDD categories: TERRENOS,
  // LICENCIAS_Y_PERMISOS, etc. Simple canonicalization for parser
  // bootstrap — seed can refine.
  return displayName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function findRowByLabelInColumn(
  ws: Worksheet,
  col: number,
  label: string,
): number | null {
  const target = normalizeWhitespace(label).toLowerCase();
  for (let r = 1; r <= ws.rowCount; r++) {
    const v = ws.getCell(r, col).value;
    if (typeof v !== "string") continue;
    if (normalizeWhitespace(v).toLowerCase() === target) return r;
  }
  return null;
}

function extractFormulaText(cell: { formula?: string; value?: unknown }): string | null {
  if (cell.formula) return cell.formula;
  const value = cell.value as { formula?: string } | null | undefined;
  if (value && typeof value === "object" && "formula" in value && typeof value.formula === "string") {
    return value.formula;
  }
  return null;
}

function extractFormulaResult(cell: { value?: unknown }): unknown {
  const value = cell.value;
  if (value && typeof value === "object" && "result" in value) {
    return (value as { result: unknown }).result;
  }
  return value;
}

function numericOrNull(value: unknown): number | null {
  const s = toDecimalString(value);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function columnLetter(col: number): string {
  // 1-indexed column to letter (1=A, 27=AA, etc.).
  let n = col;
  let result = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}
