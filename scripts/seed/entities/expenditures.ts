/**
 * Expenditure seeder — 240 transactions for Santa Elena (242 ledger rows
 * minus the 2 routed to PartnerContribution).
 *
 * Idempotent by `sourceWorkbookRef`-derived natural key — we look up by
 * `(date + amountSinIva + counterpartyId + bankAccountId)` because the
 * schema lacks a sourceWorkbookRef column. The combination is unique in
 * practice for the FCFCasas2 dataset.
 *
 * The schema's existing fields are honored:
 *   - `vendorRaw` ← parser's `counterpartyName` (verbatim Empresa column)
 *   - `partnerId` ← resolved from `counterpartyName`
 *   - `bankAccountId` ← resolved from `bankAccountDisplayName`
 *     (nullable — finding #8 legitimate no-Banco rows)
 *   - `currency` ← derived from BankAccount.currency, or default GTQ
 *   - `exchangeRate` (existing) ← if per-tx TC present use it, else 1.0 USD or project rate
 *   - `exchangeRateAtTransaction` ← per-tx TC regex extraction
 *   - `amountUsd` ← derived from amountSinIvaGtq / TC
 *
 * Per-Expenditure transaction includes its AuditLog row.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { writeImportAuditLog } from "../audit";
import type { BankAccountIndex } from "./bank-accounts";
import type { BudgetIndex } from "./budget";
import type { PartnerIndex } from "./partners";
import type { ValidatedParseBundle } from "../types";

const FALLBACK_TC = "7.7"; // project locked TC; only used when per-tx TC absent

export interface ExpenditureSeedResult {
  created: number;
  updated: number;
  skipped: number;
  unmappedPartidaGeneral: Set<string>;
}

export async function seedExpenditures(
  prisma: PrismaClient,
  bundle: ValidatedParseBundle,
  bankAccounts: BankAccountIndex,
  partners: PartnerIndex,
  budget: BudgetIndex,
  userId: string,
  importStamp: string,
): Promise<ExpenditureSeedResult> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const unmappedPartidaGeneral = new Set<string>();

  // Build category-name → categoryId lookup. Detalle egresos rows use
  // verbatim Spanish strings (e.g., "MERCADEO Y PUBLICIDAD"); FCFCasas2-
  // derived codes use normalized form (e.g., "MERCADEO"). Match both.
  const categoriesByVerbatim = new Map<string, string>();
  const categoriesByNormalized = new Map<string, string>();
  for (const [code, id] of budget.categoriesByCode) {
    categoriesByVerbatim.set(code, id);
    categoriesByNormalized.set(normalize(code), id);
  }

  // Same for execution partitions (L1) and sub-items (L3, currently empty).
  const partitionsByVerbatim = new Map<string, string>();
  const partitionsByNormalized = new Map<string, string>();
  for (const [code, id] of budget.partitionsByCode) {
    partitionsByVerbatim.set(code, id);
    partitionsByNormalized.set(normalize(code), id);
  }
  // Fallback: at least one partition must exist or we can't seed anything.
  const fallbackPartitionId = budget.partitionsByCode.get("SANTA_ELENA_OPERATING");
  if (!fallbackPartitionId) {
    throw new Error(
      "Expenditure seeder requires the SANTA_ELENA_OPERATING BudgetExecutionPartition to be seeded first.",
    );
  }
  // System fallback categories per Batch 7.5 (added in budget.ts):
  //   IMPUESTOS       → tax payments (hidden from dashboard per SDD §2.1)
  //   CASH_MOVEMENTS  → DEVOLUCIÓN / TRASLADO de FONDOS / ANULADO
  // No more polluting TERRENOS with unmapped rows.
  const fallbackImpuestosId = budget.categoriesByCode.get("IMPUESTOS");
  const fallbackCashMovementsId = budget.categoriesByCode.get("CASH_MOVEMENTS");
  if (!fallbackImpuestosId || !fallbackCashMovementsId) {
    throw new Error(
      "Expenditure seeder requires IMPUESTOS + CASH_MOVEMENTS system BudgetCategories (seeded by budget.ts per Batch 7.5).",
    );
  }

  // Comprehensive PARTIDA GENERAL → BudgetCategory.code mapping per Batch 7.5.
  // Covers all 13 PARTIDA GENERAL values observed in Detalle egresos
  // (per finding #5 of the manifest). Keys are NORMALIZED forms of the
  // verbatim Spanish strings.
  const PARTIDA_GENERAL_TO_CATEGORY_CODE: Record<string, string> = {
    TERRENO: "TERRENOS",
    LICENCIAS_Y_PERMISOS: "LICENCIAS_Y_PERMISOS",
    PLANIFICACION_TECNICA: "PLANIFICACION_TECNICA",
    MERCADEO_Y_PUBLICIDAD: "MERCADEO",
    COMISIONES: "COMISIONES_DE_VENTA",
    HONORARIOS_LEGALES: "HONORARIOS_LEGALES_ESCRITURACION",
    GASTOS_LEGALES: "GASTOS_LEGALES",
    ADMINISTRACION_DE_CONSTRUCCION_Y_DESARROLLO: "DEVELOPMENT_FEE_FORMA_CI",
    CONTINGENCIA: "IMPREVISTOS_MISCELANEOS",
    IMPUESTOS: "IMPUESTOS",
    DEVOLUCION: "CASH_MOVEMENTS",
    TRASLADO_DE_FONDOS: "CASH_MOVEMENTS",
    ANULADO: "CASH_MOVEMENTS",
  };

  for (const e of bundle.expenditures) {
    // -- FK resolution --
    const bankAccountId = e.bankAccountDisplayName
      ? bankAccounts.byDisplayName.get(e.bankAccountDisplayName) ?? null
      : null;
    if (!bankAccountId && e.bankAccountDisplayName) {
      // We have a display name in the parser output but no matching account in the DB.
      // Per D31 we don't skip; we use null + rely on the no-Banco flag already emitted.
    }
    const partnerId = partners.byName.get(e.counterpartyName) ?? null;

    // Partida resolution. Try verbatim match first, then normalized fallback.
    let partitionId = null as string | null;
    if (e.partidaEjecucionPresupuestaria) {
      partitionId =
        partitionsByVerbatim.get(e.partidaEjecucionPresupuestaria) ??
        partitionsByNormalized.get(normalize(e.partidaEjecucionPresupuestaria)) ??
        null;
    }
    let categoryId: string | null = null;
    if (e.partidaGeneral) {
      const normalized = normalize(e.partidaGeneral);
      // 1. Comprehensive mapping table (Batch 7.5) — Detalle egresos
      //    Spanish strings → canonical BudgetCategory.code.
      const mappedCode = PARTIDA_GENERAL_TO_CATEGORY_CODE[normalized];
      if (mappedCode) {
        categoryId = budget.categoriesByCode.get(mappedCode) ?? null;
      }
      // 2. Fallback: direct verbatim/normalized match (for codes that
      //    already align without translation, e.g. GASTOS_LEGALES).
      if (!categoryId) {
        categoryId =
          categoriesByVerbatim.get(e.partidaGeneral) ??
          categoriesByNormalized.get(normalized) ??
          null;
      }
      if (!categoryId) unmappedPartidaGeneral.add(e.partidaGeneral);
    }
    // Per D31: NEVER drop a row because of FK resolution failure. Truly
    // unmapped rows fall back to CASH_MOVEMENTS (not TERRENOS — that was
    // the Batch 7 pollution bug). The MISSING_PARTIDA flag is already
    // emitted by the parser for the most-affected cases.
    const finalPartitionId = partitionId ?? fallbackPartitionId;
    const finalCategoryId = categoryId ?? fallbackCashMovementsId;

    // Currency + TC derivation.
    const currency: "USD" | "GTQ" = inferCurrencyFromBankDisplay(e.bankAccountDisplayName);
    const exchangeRate = e.exchangeRateAtTransaction ?? FALLBACK_TC;
    const amountUsd = computeUsd(e.amountSinIvaGtq, exchangeRate);

    // Per D31 (never drop data) + Batch 6.5 (Expenditure.bankAccountId now
    // nullable): we PRESERVE no-Banco rows. They're legitimate non-cash
    // events per Detalle egresos finding #8. The Partner FK is required
    // (counterparty is always known); skip only on missing partner, which
    // shouldn't happen if Partner seeding ran successfully.
    if (!partnerId) {
      skipped++;
      continue;
    }

    const data = {
      bankAccountId,
      partnerId,
      vendorRaw: e.counterpartyName,
      date: new Date(e.date),
      amountConIva: e.amountConIvaGtq,
      amountSinIva: e.amountSinIvaGtq,
      ivaAmount: e.ivaAmountGtq,
      currency,
      exchangeRate,
      exchangeRateAtTransaction: e.exchangeRateAtTransaction,
      amountUsd,
      description: e.description,
      descriptionNormalized: e.descriptionNormalized,
      partitionId: finalPartitionId,
      categoryId: finalCategoryId,
      subItemId: null,
      checkNumber: null,
      invoiceReference: null,
      source: "XLSX_IMPORT" as const,
      // Natural key for idempotent re-seed per Batch 6.6. The parser emits
      // a unique source ref per transaction row (e.g., "Detalle egresos!row 9").
      sourceWorkbookRef: e.sourceWorkbookRef,
      status: e.status,
      kind: e.kind,
      showOnDashboard: true,
      createdByUserId: userId,
    };

    const wasCreated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // sourceWorkbookRef is @unique per Batch 6.6 → bulletproof idempotency.
      const existing = await tx.expenditure.findUnique({
        where: { sourceWorkbookRef: e.sourceWorkbookRef },
        select: { id: true },
      });
      if (existing) {
        const u = await tx.expenditure.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "Expenditure", entityId: u.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return false;
      }
      const c = await tx.expenditure.create({ data, select: { id: true } });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "Expenditure", entityId: c.id },
        importStamp,
      );
      return true;
    });
    if (wasCreated) created++;
    else updated++;
  }

  return { created, updated, skipped, unmappedPartidaGeneral };
}

// ── Helpers ────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function inferCurrencyFromBankDisplay(display: string | null): "USD" | "GTQ" {
  if (!display) return "GTQ";
  return /\(USD\)/i.test(display) ? "USD" : "GTQ";
}

/// USD reconstruction: amountSinIvaGtq / TC. The parser's invariant
/// (per Detalle egresos finding #1) is that MONTO is GTQ regardless of
/// account. USD-account rows simply pay out of a USD account but record
/// the GTQ equivalent.
function computeUsd(amountGtq: string, tc: string): string {
  const a = Number(amountGtq);
  const r = Number(tc);
  if (!Number.isFinite(a) || !Number.isFinite(r) || r === 0) return "0";
  return (a / r).toFixed(2);
}
