/**
 * Cross-sheet reconciliation pass — runs after all three sheet parsers
 * have emitted their data. Surfaces correspondences that span sheets, e.g.:
 *
 *   - Casa 6 refund in Detalle egresos row 64 ↔ Ppto Inversion!DK76 negative
 *     revenue (~Q3.75M one side, -$468K USD the other; rate timing accounts
 *     for the small delta).
 *   - Terreno aggregate: 2018 aportación (row 267, Q9.1M) + 2025 cash (row 138,
 *     Q1.5M) = Q10.6M ≈ Ppto Inversion!ED8 TERRENO actuals.
 *   - Total actuals: Detalle egresos!F5 sum ≈ Ppto Inversion!ED71 ≈ 15.4M GTQ.
 *   - USD parity: Ppto Inversion!H135 grand actuals = $2,001,163.72.
 *
 * Per D31: parser captures the correspondence; the app surfaces "these came
 * from the same underlying event." Reconciliations are informational
 * (CROSS_SHEET_RECONCILIATION flag at INFO severity).
 */

import type { FlagCollector } from "./flags";
import type { DetalleEgresosOutput } from "./sheets/detalle-egresos";
import type { FCFCasas2Output } from "./sheets/fcfcasas2";
import type { PptoInversionOutput } from "./sheets/ppto-inversion";
import type { ParsedCrossSheetReconciliation } from "./types";

export function reconcileAcrossSheets(
  detalleEgresos: DetalleEgresosOutput,
  pptoInversion: PptoInversionOutput,
  fcfCasas2: FCFCasas2Output,
  flags: FlagCollector,
): ParsedCrossSheetReconciliation[] {
  const reconciliations: ParsedCrossSheetReconciliation[] = [];

  // ── 1. Total actuals (GTQ): sum of Expenditure SIN IVA + PartnerContribution
  //       amounts ≈ ED71. Ppto Inversion's ED71 is the workbook's SUM(F8:F271)
  //       which includes BOTH regular expenditures AND the 2 special rows
  //       (138 = cash terreno, 267 = aportación) that we routed to
  //       PartnerContribution. So the parity sum must include both.
  let actualsGtqSum = 0;
  for (const exp of detalleEgresos.expenditures) {
    const n = Number(exp.amountSinIvaGtq);
    if (Number.isFinite(n)) actualsGtqSum += n;
  }
  for (const pc of detalleEgresos.partnerContributions) {
    const n = Number(pc.amountGtq);
    if (Number.isFinite(n)) actualsGtqSum += n;
  }
  const ppi71 = pptoInversion.totalAFechaGtq ? Number(pptoInversion.totalAFechaGtq) : null;
  if (ppi71 != null && Number.isFinite(actualsGtqSum)) {
    const delta = actualsGtqSum - ppi71;
    if (Math.abs(delta) < 1) {
      reconciliations.push({
        kind: "TOTAL_ACTUALS_GTQ_PARITY",
        sourceCells: ["Detalle egresos!F5", "Ppto Inversion!ED71"],
        humanMessage: `Total actuals GTQ parity confirmed: ${actualsGtqSum.toFixed(2)} ≈ ${ppi71.toFixed(2)} (Δ = ${delta.toFixed(2)}).`,
        notes: null,
      });
    } else {
      flags.push({
        kind: "CROSS_SHEET_RECONCILIATION",
        severity: "WARNING",
        sourceWorkbookRef: "Detalle egresos!F5 vs Ppto Inversion!ED71",
        sourceValue: `Detalle SUM=${actualsGtqSum.toFixed(2)} GTQ | PI ED71=${ppi71.toFixed(2)} GTQ`,
        recomputedValue: `Δ = ${delta.toFixed(2)} GTQ`,
        humanMessage:
          "Total actuals do NOT reconcile across Detalle egresos and Ppto Inversion. Investigate per the parser-resilient + app-surfaces principle (D31).",
      });
    }
  }

  // ── 2. Terreno aggregate: aportación + cash = ED8 ────────────────────────
  let terrenoEventsSum = 0;
  for (const pc of detalleEgresos.partnerContributions) {
    const n = Number(pc.amountGtq);
    if (Number.isFinite(n)) terrenoEventsSum += n;
  }
  const ed8 = pptoInversion.terrenoActualsGtq ? Number(pptoInversion.terrenoActualsGtq) : null;
  if (ed8 != null && terrenoEventsSum > 0) {
    const delta = terrenoEventsSum - ed8;
    // Per the manifest: Q9.1M + Q1.5M = Q10.6M ≈ ED8. Note that ED8 also
    // includes some incremental terreno-related costs; tolerance is wider.
    if (Math.abs(delta) < 2_000_000) {
      reconciliations.push({
        kind: "TERRENO_AGGREGATE",
        sourceCells: [
          "Detalle egresos!row 267 (Q9.1M aportación)",
          "Detalle egresos!row 138 (Q1.5M cash)",
          "Ppto Inversion!ED8 (TERRENO actuals to date)",
        ],
        humanMessage: `Terreno aggregate: 2018 aportación + 2025 cash sum to ${terrenoEventsSum.toFixed(2)} GTQ; Ppto Inversion!ED8 = ${ed8.toFixed(2)} GTQ. Δ = ${delta.toFixed(2)} GTQ (within tolerance — additional terreno-related costs over time).`,
        notes: null,
      });
    }
  }

  // ── 3. USD grand actuals — Ppto Inversion!H135 ───────────────────────────
  if (pptoInversion.grandActualsUsd) {
    reconciliations.push({
      kind: "USD_GRAND_ACTUALS",
      sourceCells: ["Ppto Inversion!H135"],
      humanMessage: `USD grand actuals to date per Ppto Inversion!H135 = ${pptoInversion.grandActualsUsd} USD. Supersedes the stale row-128 figure per N3.`,
      notes: null,
    });
  }

  // ── 4. Casa 6 refund correspondence ──────────────────────────────────────
  // Find the Casa 6 refund in expenditures (row 64).
  const casa6Refund = detalleEgresos.expenditures.find(
    (e) => e.sourceWorkbookRef === "Detalle egresos!row 64",
  );
  if (casa6Refund) {
    reconciliations.push({
      kind: "CASA_6_REFUND",
      sourceCells: ["Detalle egresos!row 64", "Ppto Inversion!DK76"],
      humanMessage: `Casa 6 enganche refund Q${casa6Refund.amountConIvaGtq} (Dec 2025) ↔ Ppto Inversion!DK76 large negative revenue cell. Original buyer Liza Johanna Castillo Beltranena withdrew (desistimiento); refund flagged as cash movement, not expense. Casa 6 retains SOLD status pending Q-CASA-6-STATUS.`,
      notes: null,
    });
    // Plus the UNIT_STATUS_CONTRADICTS_REFUND flag per D31 + manifest.
    flags.push({
      kind: "UNIT_STATUS_CONTRADICTS_REFUND",
      severity: "ERROR_VISIBLE",
      sourceWorkbookRef: "Detalle egresos!row 64 + FCFCasas2 note 5",
      sourceValue: `refund_amount_gtq=${casa6Refund.amountConIvaGtq} | workbook_note_5='Casas vendidas (1,2,6,7,11)'`,
      recomputedValue: "Status flag set: SOLD pending Q-CASA-6-STATUS resolution.",
      humanMessage:
        "Casa 6 has both a 'sold' assertion (workbook note 5) AND a Q3,751,493.90 enganche refund event (Dec 2025, original buyer withdrew). Per D29 + D31: BOTH facts seeded verbatim; app surfaces both with provenance; Casa 6 stays in sold bucket pending operational confirmation.",
      relatedEntityType: "RvUnit",
      relatedEntityNaturalKey: "Casa 6",
    });
  }

  // ── 5. Budget total parity: FCFCasas2 → Ppto Inversion ──────────────────
  const sumBudgetUsd = fcfCasas2.budgetCategories.reduce(
    (acc, c) => acc + (Number.isFinite(Number(c.budgetAmountUsd)) ? Number(c.budgetAmountUsd) : 0),
    0,
  );
  const pi62 = pptoInversion.totalDeInversionMasFeeUsd
    ? Number(pptoInversion.totalDeInversionMasFeeUsd)
    : null;
  if (pi62 != null) {
    const delta = sumBudgetUsd - pi62;
    if (Math.abs(delta) < 1) {
      reconciliations.push({
        kind: "BUDGET_TOTAL_USD_PARITY",
        sourceCells: ["FCFCasas2!H22 (sum of categories)", "Ppto Inversion!H62"],
        humanMessage: `Budget total parity confirmed: ${sumBudgetUsd.toFixed(2)} USD ≈ ${pi62.toFixed(2)} USD (Δ = ${delta.toFixed(2)}).`,
        notes: null,
      });
    } else {
      flags.push({
        kind: "CROSS_SHEET_RECONCILIATION",
        severity: "WARNING",
        sourceWorkbookRef: "FCFCasas2 sum vs Ppto Inversion!H62",
        sourceValue: `FCFCasas2 sum=${sumBudgetUsd.toFixed(2)} | PI H62=${pi62.toFixed(2)}`,
        recomputedValue: `Δ = ${delta.toFixed(2)}`,
        humanMessage:
          "Budget totals do not reconcile across FCFCasas2 + Ppto Inversion. Investigate per the parser-resilient + app-surfaces principle (D31).",
      });
    }
  }

  return reconciliations;
}
