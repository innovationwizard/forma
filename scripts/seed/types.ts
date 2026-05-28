/**
 * Zod schema for the Batch 5 parse-output bundle. Validates the JSON at
 * seed boot so a malformed/stale bundle fails fast (Rule 1: no fabrication;
 * Rule 8: production-grade explicit error handling).
 *
 * The schema is deliberately permissive on optional fields and strict on
 * shape: every collection must be present (the parser always emits all
 * collections per D31, even when empty).
 */

import { z } from "zod";

// Decimal-as-string for money; ISO-string for dates.
const moneyString = z.string();
const isoDateString = z.string(); // YYYY-MM-DD
const isoTimestampString = z.string(); // ISO8601

const parsedProject = z.object({
  name: z.string(),
  legalEntityName: z.string(),
  company: z.string(),
  location: z.string(),
  address: z.string().nullable(),
  currencyPrimary: z.enum(["USD", "GTQ"]),
  currencySecondary: z.enum(["USD", "GTQ"]),
  lockedExchangeRate: moneyString,
  tcBudgetaryLabel: z.string().nullable(),
  tcEffectiveTerrenoHistorical: moneyString.nullable(),
  ivaRate: moneyString,
  startDate: isoDateString,
  projectedEndDate: isoDateString,
  internalApprovalDate: isoDateString.nullable(),
  regulatoryHistoryNote: z.string().nullable(),
  modelAuthorName: z.string().nullable(),
  modelRecentEditorName: z.string().nullable(),
  legalRepresentativeName: z.string().nullable(),
  originalLandowner: z.string().nullable(),
  modelNotes: z.array(z.string()),
});

const parsedBankAccount = z.object({
  bankName: z.string(),
  accountNumber: z.string(),
  currency: z.enum(["USD", "GTQ"]),
  displayName: z.string(),
  isActive: z.boolean(),
  transactionCount: z.number().int().nonnegative(),
});

const parsedCounterparty = z.object({
  name: z.string(),
  taxId: z.string().nullable(),
  type: z.enum(["COMPANY", "INDIVIDUAL", "GOVERNMENT"]),
  category: z.enum([
    "VENDOR",
    "TAX_AUTHORITY",
    "BANK_AS_COUNTERPARTY",
    "INTERNAL_ENTITY",
    "INTERNAL_INDIVIDUAL",
  ]),
  isVendor: z.boolean(),
  isBuyer: z.boolean(),
  notes: z.string().nullable(),
});

const parsedBudgetExecutionPartition = z.object({
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int().nonnegative(),
});

const parsedBudgetCategory = z.object({
  partitionCode: z.string(),
  code: z.string(),
  name: z.string(),
  budgetAmountUsd: moneyString,
  budgetPercentage: moneyString,
  commissionRate: moneyString.nullable(),
  dashboardVisible: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

const parsedBudgetSubItem = z.object({
  categoryCode: z.string(),
  code: z.string(),
  description: z.string(),
  unit: z.string().nullable(),
  quantity: moneyString.nullable(),
  unitPriceUsd: moneyString.nullable(),
  totalUsd: moneyString,
  totalGtq: moneyString,
});

const parsedRvUnit = z.object({
  name: z.string(),
  type: z.string(),
  areaM2: moneyString,
  pricePerM2Usd: moneyString.nullable(),
  salePriceSinIvaUsd: moneyString.nullable(),
  engancheRate: moneyString,
  status: z.enum(["AVAILABLE", "SOFT_HOLD", "RESERVED", "FROZEN", "SOLD"]),
  buyerName: z.string().nullable(),
  saleMonth: z.number().int().nullable(),
  deliveryMonth: z.number().int().nullable(),
  reservedAt: isoDateString.nullable(),
  soldAt: isoDateString.nullable(),
});

const parsedRvReservation = z.object({
  unitName: z.string(),
  partnerName: z.string(),
  status: z.enum(["PENDING_REVIEW", "CONFIRMED", "REJECTED", "DESISTED"]),
  reservedAt: z.string(),
  decidedAt: z.string().nullable(),
  notes: z.string().nullable(),
});

const parsedMonthlyProjection = z.object({
  monthNumber: z.number().int().min(1).max(60),
  monthDate: isoDateString,
  costByCategoryUsd: z.record(z.string(), moneyString),
  totalCostSinIvaUsd: moneyString,
  ivaOnCostsUsd: moneyString,
  totalCostConIvaUsd: moneyString,
  cumulativeCostConIvaUsd: moneyString,
  revenueByUnitUsd: z.record(z.string(), moneyString),
  totalRevenueSinIvaUsd: moneyString,
  cumulativeRevenueUsd: moneyString,
  ebitdaConIvaUsd: moneyString,
  ebitdaUsd: moneyString,
  creditBalanceUsd: moneyString,
  interestPaymentUsd: moneyString,
  principalPaymentUsd: moneyString,
});

const parsedExpenditure = z.object({
  sourceWorkbookRef: z.string(),
  bankAccountDisplayName: z.string().nullable(),
  date: isoDateString,
  counterpartyName: z.string(),
  description: z.string(),
  descriptionNormalized: z.string(),
  amountConIvaGtq: moneyString,
  amountSinIvaGtq: moneyString,
  ivaAmountGtq: moneyString,
  exchangeRateAtTransaction: moneyString.nullable(),
  partidaInterna: z.string().nullable(),
  partidaGeneral: z.string().nullable(),
  partidaEjecucionPresupuestaria: z.string().nullable(),
  nota: z.string().nullable(),
  solicitud: z.string().nullable(),
  status: z.enum(["VERIFIED", "PENDING", "FLAGGED", "VOIDED", "ANULADO"]),
  kind: z.enum(["OPERATING_EXPENSE", "CASH_MOVEMENT", "EQUITY_EVENT"]),
});

const parsedPartnerContribution = z.object({
  partnerName: z.string(),
  date: isoDateString,
  amountGtq: moneyString,
  amountUsd: moneyString,
  kind: z.enum(["CASH_CALL", "DISTRIBUTION", "IN_KIND_ASSET", "CASH_PURCHASE"]),
  assetDescription: z.string().nullable(),
  sourceWorkbookRef: z.string(),
  categoryCode: z.string().nullable(),
  notes: z.string().nullable(),
});

const parsedCreditFacility = z.object({
  ref: z.string(),
  lenderName: z.string(),
  facilityType: z.enum(["BANK_DEVELOPMENT_LOAN", "PRIVATE"]),
  mechanism: z.enum(["REVOLVING_HYBRID", "DEVELOPMENT_DRAWDOWN_WITH_REVALUATION"]),
  initialCapUsd: moneyString,
  currentCapUsd: moneyString,
  annualRate: moneyString,
  ltvRatio: moneyString,
  ltcCeiling: moneyString,
  bankAccountDisplayName: z.string().nullable(),
});

const parsedAmortizationRule = z.object({
  facilityRef: z.string(),
  appliesFromMonth: z.number().int().min(1),
  appliesToMonth: z.number().int().nullable(),
  mechanism: z.enum(["REVOLVENTE_HIBRIDO", "FIXED_AMORTIZATION", "BULLET", "INTEREST_ONLY"]),
  conditionsNote: z.string(),
});

const parsedIsrObligation = z.object({
  uiLabel: z.string(),
  rate: moneyString,
  rateKind: z.enum(["EFFECTIVE", "NOMINAL", "REGIMEN_SPECIFIC"]),
  sourceCell: z.string(),
  sourceTextVerbatim: z.string(),
  paymentPattern: z.enum(["LUMP_END", "QUARTERLY", "ANNUAL", "CUSTOM_TRIGGER", "COMPOSITE"]),
  notes: z.string().nullable(),
});

const parsedDataQualityFlag = z.object({
  kind: z.string(),
  severity: z.enum(["INFO", "WARNING", "ERROR_VISIBLE", "ERROR_BLOCKING"]),
  sourceWorkbookRef: z.string(),
  sourceValue: z.string().nullable(),
  recomputedValue: z.string().nullable(),
  humanMessage: z.string(),
  relatedEntityType: z.string().nullable(),
  relatedEntityNaturalKey: z.string().nullable(),
});

const parsedCrossSheetReconciliation = z.object({
  kind: z.string(),
  sourceCells: z.array(z.string()),
  humanMessage: z.string(),
  notes: z.string().nullable(),
});

const parseSummary = z.object({
  totalsUsd: z.object({
    budgetSinIva: moneyString,
    actualExecuted: moneyString,
    projectedRevenue: moneyString,
  }),
  totalsGtq: z.object({
    actualExecuted: moneyString,
  }),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  flagsByKind: z.record(z.string(), z.number().int().nonnegative()),
  flagsBySeverity: z.record(z.string(), z.number().int().nonnegative()),
});

export const parseBundleSchema = z.object({
  schemaVersion: z.literal("1.0.0"),
  parsedAt: isoTimestampString,
  sourceFile: z.string(),
  sourceFileSize: z.number().int().nonnegative(),
  sourceFileMtime: isoTimestampString,
  project: parsedProject,
  bankAccounts: z.array(parsedBankAccount),
  counterparties: z.array(parsedCounterparty),
  budgetExecutionPartitions: z.array(parsedBudgetExecutionPartition),
  budgetCategories: z.array(parsedBudgetCategory),
  budgetSubItems: z.array(parsedBudgetSubItem),
  rvUnits: z.array(parsedRvUnit),
  rvReservations: z.array(parsedRvReservation),
  monthlyProjections: z.array(parsedMonthlyProjection),
  expenditures: z.array(parsedExpenditure),
  partnerContributions: z.array(parsedPartnerContribution),
  creditFacilities: z.array(parsedCreditFacility),
  amortizationRules: z.array(parsedAmortizationRule),
  isrObligations: z.array(parsedIsrObligation),
  dataQualityFlags: z.array(parsedDataQualityFlag),
  crossSheetReconciliations: z.array(parsedCrossSheetReconciliation),
  summary: parseSummary,
});

export type ValidatedParseBundle = z.infer<typeof parseBundleSchema>;
