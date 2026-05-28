/**
 * Ppto Inversion parser.
 *
 * Per the manifest (comprehensive structural inspection + Jorge's
 * corners-of-the-sheet visual review):
 *   - This is a 10-year template (Dec 2017 → Apr 2027), 135 rows × 136 cols.
 *   - Santa Elena's data lives in cols DD..EC (May 2025 → Apr 2027) +
 *     summary columns ED (TOTAL A LA FECHA) + EE (POR EJECUTAR).
 *   - The Santa Elena monthly window is offset by 88 months from template col K.
 *   - 21 hidden columns + 4 numbered budget categories per N4 (3-level hierarchy).
 *   - Row 8 = TERRENO (overspent per finding #1 — flag emitted here).
 *   - Row 62 = "Total de Inversión mas Fee" = $11,228,641.51 budget (parity target).
 *   - Row 71 = "TOTAL EGRESOS" total actuals = 15,408,960.63 GTQ (parity target).
 *   - Row 76 = revenue placeholder; row 135 = $2,001,163.72 USD grand actuals.
 *   - F20 cell comment "Ya Cotizado final" (federico franco signoff per finding #8).
 *   - Calendar gap: Nov-2027 missing between AN + AO (this sheet ends Apr-2027
 *     so the gap doesn't apply here — calendar continuity check fires for
 *     FCFCasas2 only).
 *
 * Per D31: parser does not fail loudly or silently. Per D26: label-based
 * parsing — find rows by col-A/C content, find cols by row-5/6 headers.
 */

import type { Worksheet } from "exceljs";

import { getCellComment } from "../extract/cell-comments";
import type { FlagCollector } from "../flags";
import { normalizeWhitespace, toDecimalString } from "../normalize";

/// Subset of the Ppto Inversion data the parser surfaces. Most of the
/// per-month grid is informational; the seed-relevant values are the
/// budget totals + actuals + the F20 signoff.
export interface PptoInversionOutput {
  // Aggregate values used by the seed + dashboard validation.
  totalDeInversionMasFeeUsd: string | null; // H62
  totalEgresosUsd: string | null; // H71 (= H62 for SE)
  totalEgresosGtq: string | null; // I71 = 86,460,540 (informational)
  /// `Ppto Inversion!ED71` — the live actual-to-date total in GTQ.
  /// Should equal `Detalle egresos!F5` per the manifest.
  totalAFechaGtq: string | null;
  /// `Ppto Inversion!row 135 H` — the canonical USD grand actuals figure
  /// per N3. Supersedes the stale row 128 figure.
  grandActualsUsd: string | null;
  /// `Ppto Inversion!H135 - H128` adjustment row → tells us whether the
  /// "extra LICENCIAS Y PERMISOS" line is still present.
  row131Note: string | null;

  /// TERRENO summary: budget vs actual to drive the OVERSPEND flag.
  terrenoBudgetGtq: string | null; // I8
  terrenoActualsGtq: string | null; // ED8
  terrenoRemainingGtq: string | null; // EE8

  /// Project metadata captured from row 2 + row 3 + cell comments.
  projectTitle: string | null; // B2 "Proyecto Antigua - Residencias"
  presupuestoConstruccion: string | null; // B3 label
}

export function parsePptoInversion(ws: Worksheet, flags: FlagCollector): PptoInversionOutput {
  // ── Row 2 / Row 3 headers ────────────────────────────────────────────────
  const projectTitle = normalizeWhitespace(String(ws.getCell("B2").value ?? "")) || null;
  const presupuestoConstruccion =
    normalizeWhitespace(String(ws.getCell("B3").value ?? "")) || null;

  // TC values surfaced as flags so the FCFCasas2 parser + seed can cross-validate.
  const tcAdvertised = toDecimalString(ws.getCell("G2").value);
  const tcBudgetaryText = ws.getCell("I2").value;
  const tcEffectiveHistorical = toDecimalString(ws.getCell("N4").value);
  if (tcAdvertised && tcBudgetaryText) {
    flags.push({
      kind: "TC_AMBIGUITY",
      severity: "INFO",
      sourceWorkbookRef: "Ppto Inversion!G2 + I2 + N4",
      sourceValue: `G2=${tcAdvertised} | I2='${String(tcBudgetaryText)}' | N4=${tcEffectiveHistorical ?? "—"}`,
      humanMessage:
        "Three workbook-level TC values surfaced (advertised, budgetary, historical). Per SDD §7.7 v0.4 + D34, dashboard surfaces all three with literal labels; per-transaction TC overrides where present in Detalle egresos descriptions.",
    });
  }

  // ── F20 author signoff (finding #8) ───────────────────────────────────────
  const f20Comment = getCellComment(ws.getCell("F20"));
  if (f20Comment) {
    flags.push({
      kind: "CELL_COMMENT",
      severity: "INFO",
      sourceWorkbookRef: "Ppto Inversion!F20",
      sourceValue: f20Comment.text,
      humanMessage: `Author comment from ${f20Comment.author ?? "unknown"}: "${f20Comment.text}". Captured per D32 as model-author signoff metadata.`,
    });
  }

  // ── Budget row 62 (Total de Inversión mas Fee — USD budget anchor) ──────
  // Locate by col-C label per D26 (label-based, not position).
  const row62 = findRowByColumnCLabel(ws, [
    "Total de Inversión mas Fee",
    "Total de Inversion mas Fee",
  ]);
  const totalDeInversionMasFeeUsd = row62 ? toDecimalString(ws.getCell(row62, 8).value) : null;

  // ── TOTAL EGRESOS row 71 ────────────────────────────────────────────────
  const row71 = findRowByColumnCLabel(ws, ["TOTAL EGRESOS"]);
  const totalEgresosUsd = row71 ? toDecimalString(ws.getCell(row71, 8).value) : null;
  const totalEgresosGtq = row71 ? toDecimalString(ws.getCell(row71, 9).value) : null;
  const totalAFechaGtq = row71 ? toDecimalString(ws.getCell(row71, 134).value) : null;

  // ── TERRENO row 8 ───────────────────────────────────────────────────────
  const terrenoBudgetGtq = toDecimalString(ws.getCell("I8").value);
  const terrenoActualsGtq = toDecimalString(ws.getCell("ED8").value);
  const terrenoRemainingGtq = toDecimalString(ws.getCell("EE8").value);

  if (terrenoRemainingGtq && terrenoRemainingGtq.startsWith("-")) {
    flags.push({
      kind: "OVERSPEND",
      severity: "WARNING",
      sourceWorkbookRef: "Ppto Inversion!I8 vs ED8 / EE8",
      sourceValue: `budget=${terrenoBudgetGtq ?? "—"} GTQ | actuals=${terrenoActualsGtq ?? "—"} GTQ | por_ejecutar=${terrenoRemainingGtq} GTQ`,
      humanMessage:
        "TERRENO is over-budget: actuals exceed budgeted Q9,106,000. Per Q-TERRENO-OVERSPEND (open, Federico): the overspend reflects the dual-event acquisition (Q9.1M aportación 2018 + Q1.5M cash 2025 = Q10.6M total).",
      relatedEntityType: "BudgetCategory",
      relatedEntityNaturalKey: "TERRENOS",
    });
  }

  // ── Row 135 grand actuals (USD) per the corner-of-the-sheet review ──────
  const grandActualsUsd = toDecimalString(ws.getCell("H135").value);
  // Detect whether row 131 "LICENCIAS Y PERMISOS" extra line is present
  // (the workbook's CATEGORY_MISLABEL — Impuestos GTQ shows up under
  // LICENCIAS USD via the H131 = H106/G2 formula).
  const row131Note = (() => {
    const r131 = ws.getCell("C131").value;
    if (!r131) return null;
    const label = normalizeWhitespace(String(r131));
    const h131 = toDecimalString(ws.getCell("H131").value);
    if (label.toUpperCase().includes("LICENCIAS") && h131 && Number(h131) > 0) {
      flags.push({
        kind: "CATEGORY_MISLABEL",
        severity: "WARNING",
        sourceWorkbookRef: "Ppto Inversion!row 131",
        sourceValue: `C131='${label}' / H131=${h131} (= H106/G2)`,
        humanMessage:
          "Row 131 USD label says 'LICENCIAS Y PERMISOS' but the value is computed from row 106 (Impuestos GTQ ÷ G2 TC). Per the manifest, this is a workbook cross-category copy-paste; the dollar amount belongs to Impuestos.",
      });
      return `${label} = ${h131} USD`;
    }
    return null;
  })();

  // ── Floating-point residue at H64 (manifest finding) ────────────────────
  const h64 = toDecimalString(ws.getCell("H64").value);
  if (h64 && Math.abs(Number(h64)) < 1 && Number(h64) !== 0) {
    flags.push({
      kind: "FLOATING_POINT_RESIDUE",
      severity: "INFO",
      sourceWorkbookRef: "Ppto Inversion!H64",
      sourceValue: h64,
      humanMessage:
        "Residual subtraction artifact (=H63-H62, near zero). Cosmetic; ignore in rollups.",
    });
  }

  // ── Impuestos overspend (Q-IMPUESTOS-NO-BUDGET — row 106) ───────────────
  const impuestosGtqBudget = toDecimalString(ws.getCell("G106").value);
  const impuestosGtqActual = toDecimalString(ws.getCell("H106").value);
  if (
    impuestosGtqActual &&
    Number(impuestosGtqActual) > 0 &&
    impuestosGtqBudget &&
    Number(impuestosGtqBudget) === 0
  ) {
    flags.push({
      kind: "OVERSPEND",
      severity: "INFO",
      sourceWorkbookRef: "Ppto Inversion!row 106",
      sourceValue: `budget=${impuestosGtqBudget} | actuals=${impuestosGtqActual}`,
      humanMessage:
        "Impuestos has zero budget but non-zero actuals — 100% overspend per Q-IMPUESTOS-NO-BUDGET. Missing budget line or intentional out-of-plan tax obligation; pending Ronny.",
      relatedEntityType: "BudgetCategory",
      relatedEntityNaturalKey: "IMPUESTOS",
    });
  }

  return {
    totalDeInversionMasFeeUsd,
    totalEgresosUsd,
    totalEgresosGtq,
    totalAFechaGtq,
    grandActualsUsd,
    row131Note,
    terrenoBudgetGtq,
    terrenoActualsGtq,
    terrenoRemainingGtq,
    projectTitle,
    presupuestoConstruccion,
  };
}

/// Helper: find first row whose column-C value matches one of the labels
/// (after whitespace normalization). Returns 1-based row index or null.
function findRowByColumnCLabel(ws: Worksheet, candidates: readonly string[]): number | null {
  const normalized = new Set(candidates.map((c) => normalizeWhitespace(c).toLowerCase()));
  const rowCount = ws.rowCount;
  for (let r = 1; r <= rowCount; r++) {
    const v = ws.getCell(r, 3).value; // col C
    if (typeof v !== "string") continue;
    const norm = normalizeWhitespace(v).toLowerCase();
    if (normalized.has(norm)) return r;
  }
  return null;
}
