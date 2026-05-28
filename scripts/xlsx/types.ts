/**
 * Output bundle shape for the Batch 5 XLSX parser.
 *
 * Per D31 (parser does not fail — neither loudly nor silently):
 *   - Every input cell with content is captured verbatim.
 *   - Anomalies become first-class `DataQualityFlag` entries.
 *   - The parser ALWAYS produces a complete bundle on every run.
 *
 * Per the architectural baseline (2026-05-25):
 *   - Output is written to `scripts/xlsx/output/parse-<timestamp>.json` plus
 *     a `parse-latest.json` symlink. Both gitignored.
 *   - Bundle shape mirrors target schema entities (defined in
 *     `prisma/schema.prisma` per Batch 4 + Batch 4.5).
 *
 * Money: all amounts are strings (decimal-as-string), never JS number, to
 * preserve precision across the JSON boundary per `_THE_RULES.MD` Rule 8.
 * The seed script (Batch 6) parses these to Prisma `Decimal`.
 */

// ── Top-level bundle ────────────────────────────────────────────────────────

export interface ParseBundle {
  schemaVersion: "1.0.0";
  parsedAt: string; // ISO8601
  sourceFile: string; // absolute path to xlsx
  sourceFileSize: number;
  sourceFileMtime: string; // ISO8601

  /// The project entity — singleton for Santa Elena per D11.
  project: ParsedProject;

  /// Bank accounts — 9 distinct per Detalle egresos finding #2.
  bankAccounts: ParsedBankAccount[];

  /// Counterparties (extended Partner) discovered in the Empresa column.
  /// Each carries the 5-value PartnerCategory typology per finding #5.
  counterparties: ParsedCounterparty[];

  /// 3-level partida hierarchy per N4 + D9. L1 = execution partition,
  /// L2 = budget category, L3 = sub-item.
  budgetExecutionPartitions: ParsedBudgetExecutionPartition[];
  budgetCategories: ParsedBudgetCategory[];
  budgetSubItems: ParsedBudgetSubItem[];

  /// The 11 RvUnits per D9 + D29. Sold bucket per workbook note 5 + D29
  /// operational override (Casa 5 added).
  rvUnits: ParsedRvUnit[];

  /// Reservations — currently sourced from FCFCasas2 metadata. RESERVAS
  /// workbook ingestion is a future batch.
  rvReservations: ParsedRvReservation[];

  /// 36-month projection grid from FCFCasas2 (label-based per D26).
  monthlyProjections: ParsedMonthlyProjection[];

  /// 242 transactions from Detalle egresos. Negative MONTO + ANULADO
  /// preserved per D31. Per-tx TC extracted where present per finding #11.
  expenditures: ParsedExpenditure[];

  /// Per D33 + Detalle egresos findings: foundational equity events
  /// (2018 aportación no dineraria + 2025 cash terreno purchase, at minimum).
  partnerContributions: ParsedPartnerContribution[];

  /// Per D33: CreditFacility + 1-to-many AmortizationRule.
  creditFacilities: ParsedCreditFacility[];
  amortizationRules: ParsedAmortizationRule[];

  /// Per D34: both ISR rates literal — "ISR 18" + "ISR 25".
  isrObligations: ParsedIsrObligation[];

  /// Per D31: all anomalies captured here, with provenance to source cell.
  /// The parser ALWAYS produces a bundle; flags are how non-fatal issues
  /// surface to the app. App reads + displays with badges + drilldown.
  dataQualityFlags: ParsedDataQualityFlag[];

  /// Cross-sheet correspondences (e.g., Casa 6 refund in Detalle egresos
  /// row 64 ↔ Ppto Inversion DK76 negative revenue). Informational; lets the
  /// app surface "these came from the same underlying event."
  crossSheetReconciliations: ParsedCrossSheetReconciliation[];

  /// Counts + totals by section. Echoed in the human-readable report.
  summary: ParseSummary;
}

// ── Per-entity shapes ──────────────────────────────────────────────────────

export interface ParsedProject {
  name: string;
  legalEntityName: string;
  company: string;
  location: string;
  address: string | null;
  currencyPrimary: "USD" | "GTQ";
  currencySecondary: "USD" | "GTQ";
  /// TC ambiguity — 4 sources per SDD §7.7 v0.4.
  lockedExchangeRate: string; // decimal-as-string (= advertised, Ppto Inversion!G2)
  tcBudgetaryLabel: string | null; // Ppto Inversion!I2 text
  tcEffectiveTerrenoHistorical: string | null; // Ppto Inversion!N4
  ivaRate: string; // 0.12
  startDate: string; // ISO date (YYYY-MM-DD)
  projectedEndDate: string;
  internalApprovalDate: string | null;
  regulatoryHistoryNote: string | null;
  modelAuthorName: string | null;
  modelRecentEditorName: string | null;
  legalRepresentativeName: string | null;
  originalLandowner: string | null;
  /// 5 verbatim Spanish strings per D32 + [[feedback_intent_vs_implementation]].
  modelNotes: string[];
}

export interface ParsedBankAccount {
  bankName: string; // "G&T", "PROMERICA", "BAC", "INDUSTRIAL"
  accountNumber: string; // "002-9900597-5", "12331050054637", etc.
  currency: "USD" | "GTQ";
  displayName: string; // "G&T (USD)" — verbatim from xlsx Banco column
  isActive: boolean; // false for 3 legacy accounts per finding #2
  transactionCount: number;
}

export interface ParsedCounterparty {
  name: string; // verbatim from Empresa column
  taxId: string | null;
  /// Legal type (independent axis from category).
  type: "COMPANY" | "INDIVIDUAL" | "GOVERNMENT";
  /// 5-value functional category per Detalle egresos finding #5.
  category:
    | "VENDOR"
    | "TAX_AUTHORITY"
    | "BANK_AS_COUNTERPARTY"
    | "INTERNAL_ENTITY"
    | "INTERNAL_INDIVIDUAL";
  /// Mirrors Partner flags (Odoo res.partner pattern per D13).
  isVendor: boolean;
  isBuyer: boolean;
  notes: string | null;
}

export interface ParsedBudgetExecutionPartition {
  code: string; // verbatim from xlsx
  name: string;
  sortOrder: number;
}

export interface ParsedBudgetCategory {
  partitionCode: string; // FK by code
  code: string; // canonical code, e.g. "TERRENOS"
  name: string; // display name
  budgetAmountUsd: string; // decimal-as-string
  budgetPercentage: string;
  commissionRate: string | null;
  dashboardVisible: boolean;
  sortOrder: number;
}

export interface ParsedBudgetSubItem {
  categoryCode: string; // FK by code
  code: string; // not globally unique (unique within category)
  description: string;
  unit: string | null;
  quantity: string | null;
  unitPriceUsd: string | null;
  totalUsd: string;
  totalGtq: string;
}

export interface ParsedRvUnit {
  name: string; // "Casa 1" ... "Casa 11"
  type: string; // "A" for all SE houses
  areaM2: string;
  pricePerM2Usd: string | null;
  salePriceSinIvaUsd: string | null;
  engancheRate: string; // 0.25 default
  /// SOLD per D29 operational override (Casa 5 included) + workbook note 5.
  /// Casa 6 retains SOLD pending Q-CASA-6-STATUS resolution.
  status: "AVAILABLE" | "SOFT_HOLD" | "RESERVED" | "FROZEN" | "SOLD";
  buyerName: string | null; // free-text; linked to Counterparty in seed
  saleMonth: number | null;
  deliveryMonth: number | null;
  reservedAt: string | null; // ISO date
  soldAt: string | null;
}

export interface ParsedRvReservation {
  unitName: string; // FK by RvUnit.name
  partnerName: string; // FK by Counterparty.name
  status: "PENDING_REVIEW" | "CONFIRMED" | "REJECTED" | "DESISTED";
  reservedAt: string;
  decidedAt: string | null;
  notes: string | null;
}

export interface ParsedMonthlyProjection {
  monthNumber: number; // 1..36
  monthDate: string; // ISO date — DURABLE key per D26
  /// Costs by category (USD sin IVA). Keys = BudgetCategory.code.
  costByCategoryUsd: Record<string, string>;
  totalCostSinIvaUsd: string;
  ivaOnCostsUsd: string;
  totalCostConIvaUsd: string;
  cumulativeCostConIvaUsd: string;
  /// Revenue by RvUnit. Keys = RvUnit.name.
  revenueByUnitUsd: Record<string, string>;
  totalRevenueSinIvaUsd: string;
  cumulativeRevenueUsd: string;
  ebitdaConIvaUsd: string;
  ebitdaUsd: string;
  creditBalanceUsd: string;
  interestPaymentUsd: string;
  principalPaymentUsd: string;
}

export interface ParsedExpenditure {
  /// Sheet + cell ref for audit (e.g., "Detalle egresos!row 9").
  sourceWorkbookRef: string;
  bankAccountDisplayName: string | null; // verbatim Banco column; null = no Banco
  date: string; // ISO date
  counterpartyName: string; // verbatim Empresa column (linked to Counterparty in seed)
  description: string; // raw, verbatim — preserves whitespace anomalies
  descriptionNormalized: string; // .trim() + collapse-whitespace
  amountConIvaGtq: string; // signed Decimal
  amountSinIvaGtq: string;
  ivaAmountGtq: string;
  /// Per-tx TC extracted from description regex (~20 transactions per finding #11).
  /// Null when not present in description; seed falls back to project TC.
  exchangeRateAtTransaction: string | null;
  /// 3-level partida (L3, L2, L1). Strings, not FK IDs — seed resolves to FKs.
  partidaInterna: string | null; // L3; null = MISSING_PARTIDA flag emitted
  partidaGeneral: string | null; // L2
  partidaEjecucionPresupuestaria: string | null; // L1
  nota: string | null;
  solicitud: string | null;
  status: "VERIFIED" | "PENDING" | "FLAGGED" | "VOIDED" | "ANULADO";
  kind: "OPERATING_EXPENSE" | "CASH_MOVEMENT" | "EQUITY_EVENT";
}

export interface ParsedPartnerContribution {
  partnerName: string; // verbatim Empresa column (linked in seed)
  date: string;
  amountGtq: string; // signed
  amountUsd: string;
  kind: "CASH_CALL" | "DISTRIBUTION" | "IN_KIND_ASSET" | "CASH_PURCHASE";
  assetDescription: string | null;
  sourceWorkbookRef: string;
  /// Per Batch 7.5: optional BudgetCategory.code for budget-health rollup.
  /// For SE both PCs map to "TERRENOS" (their source row's partida = TERRENO).
  categoryCode: string | null;
  notes: string | null;
}

export interface ParsedCreditFacility {
  /// Stable identifier within the bundle, used by AmortizationRule.facilityRef.
  ref: string; // e.g. "SE_BANK_GT"
  lenderName: string;
  facilityType: "BANK_DEVELOPMENT_LOAN" | "PRIVATE";
  mechanism: "REVOLVING_HYBRID" | "DEVELOPMENT_DRAWDOWN_WITH_REVALUATION";
  initialCapUsd: string;
  currentCapUsd: string;
  annualRate: string;
  ltvRatio: string;
  ltcCeiling: string;
  bankAccountDisplayName: string | null;
}

export interface ParsedAmortizationRule {
  facilityRef: string; // FK by CreditFacility.ref
  appliesFromMonth: number;
  appliesToMonth: number | null;
  mechanism: "REVOLVENTE_HIBRIDO" | "FIXED_AMORTIZATION" | "BULLET" | "INTEREST_ONLY";
  conditionsNote: string; // verbatim Spanish per D32
}

export interface ParsedIsrObligation {
  uiLabel: string; // LITERAL per D34 — "ISR 18" or "ISR 25"
  rate: string;
  rateKind: "EFFECTIVE" | "NOMINAL" | "REGIMEN_SPECIFIC";
  sourceCell: string; // e.g. "FCFCasas2!G79"
  sourceTextVerbatim: string;
  paymentPattern: "LUMP_END" | "QUARTERLY" | "ANNUAL" | "CUSTOM_TRIGGER" | "COMPOSITE";
  notes: string | null;
}

export interface ParsedDataQualityFlag {
  kind: DataQualityFlagKind;
  severity: "INFO" | "WARNING" | "ERROR_VISIBLE" | "ERROR_BLOCKING";
  sourceWorkbookRef: string;
  sourceValue: string | null;
  recomputedValue: string | null;
  humanMessage: string;
  relatedEntityType: string | null; // "RvUnit", "Expenditure", etc.
  relatedEntityNaturalKey: string | null; // e.g. RvUnit.name or Expenditure.sourceWorkbookRef
}

export type DataQualityFlagKind =
  | "MISSING_PARTIDA"
  | "PARTIDA_FLAGGED_FOR_REVIEW"
  | "UNIT_STATUS_CONTRADICTS_REFUND"
  | "CATEGORY_MISLABEL"
  | "TIMELINE_MISALIGNMENT"
  | "CALENDAR_GAP"
  | "STALE_FORMULA_WINDOW"
  | "STALE_LABEL"
  | "FLOATING_POINT_RESIDUE"
  | "TC_AMBIGUITY"
  | "OVERSPEND"
  | "LARGE_NEGATIVE_REVENUE"
  | "MIXED_CURRENCY_SUM_VALIDATED_GTQ"
  | "MISSING_BANCO_INTENTIONAL"
  | "UNUSED_BUDGET_FORMULA"
  | "OUTLIER_PRICING"
  | "CELL_COMMENT"
  | "CROSS_SHEET_RECONCILIATION"
  | "UNKNOWN_ANOMALY";

export interface ParsedCrossSheetReconciliation {
  kind: string; // e.g. "CASA_6_REFUND", "TERRENO_AGGREGATE"
  sourceCells: string[]; // ["Detalle egresos!row 64", "Ppto Inversion!DK76"]
  humanMessage: string;
  notes: string | null;
}

export interface ParseSummary {
  totalsUsd: {
    /// Per D28: budget total sin IVA = $11,228,641.51
    budgetSinIva: string;
    /// Per N3 + Ppto Inversion row 135: live actuals = $2,001,163.72
    actualExecuted: string;
    /// Per FCFCasas2!H47 + Ppto Inversion!H76: projected revenue = $12,639,661.49
    projectedRevenue: string;
  };
  totalsGtq: {
    /// Per Ppto Inversion!ED71 + Detalle egresos!F5: live actuals = 15,408,960.63 GTQ
    actualExecuted: string;
  };
  counts: {
    bankAccounts: number;
    counterparties: number;
    budgetCategories: number;
    rvUnits: number;
    monthlyProjections: number;
    expenditures: number;
    partnerContributions: number;
    creditFacilities: number;
    amortizationRules: number;
    isrObligations: number;
    dataQualityFlags: number;
    crossSheetReconciliations: number;
  };
  flagsByKind: Record<DataQualityFlagKind, number>;
  flagsBySeverity: Record<"INFO" | "WARNING" | "ERROR_VISIBLE" | "ERROR_BLOCKING", number>;
}
