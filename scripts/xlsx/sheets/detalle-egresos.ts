/**
 * Detalle egresos parser.
 *
 * Per the manifest (visual inspection + 3 review passes):
 *   - 242 transactions, rows 8..271 (hidden + visible).
 *   - 13 columns A..M, header at row 7.
 *   - All MONTO values are GTQ regardless of bank-account currency (finding #1).
 *   - 9 distinct bank accounts (finding #2); some legacy.
 *   - 3-level PARTIDA hierarchy in cols I/J/K (finding #4).
 *   - Per-tx TC values encoded in Descripción for ~20+ transactions (finding #11).
 *   - 1 negative MONTO row (#13), 2 ANULADO rows (#14), 11 no-Banco rows (#8).
 *   - Row 267 = Q9.1M aportación no dineraria (PartnerContribution, NOT
 *     Expenditure). Row 138 = Q1.5M cash terreno purchase (PartnerContribution).
 *   - Row 64 = Casa 6 enganche refund Q3.75M (Expenditure with DEVOLUCIÓN
 *     partida, kind=CASH_MOVEMENT). Row 67 = related TRASLADO de FONDOS
 *     Q1.8M (Expenditure, kind=CASH_MOVEMENT).
 *
 * Per D31: parser does not fail loudly or silently. Every transaction row
 * produces an output row; anomalies become DataQualityFlag entries.
 */

import type { Worksheet } from "exceljs";

import { getNonDefaultFillId } from "../extract/cell-color";
import { extractTcFromDescription } from "../extract/tc-from-description";
import type { FlagCollector } from "../flags";
import { cellValueToString, normalizeWhitespace, toDecimalString, toIsoDate } from "../normalize";
import type {
  ParsedBankAccount,
  ParsedCounterparty,
  ParsedExpenditure,
  ParsedPartnerContribution,
} from "../types";

/// Rows that the manifest marks as PartnerContribution rather than Expenditure.
/// Row 267 = 2018 IN_KIND_ASSET aportación; row 138 = 2025 CASH_PURCHASE.
const PARTNER_CONTRIBUTION_ROWS = new Set([138, 267]);

/// 13-column layout verified in the manifest.
const COL = {
  banco: 1,
  cuenta: 2,
  fecha: 3,
  empresa: 4,
  montoConIva: 5,
  montoSinIva: 6,
  iva: 7,
  descripcion: 8,
  partidaInterna: 9, // L3
  partidaGeneral: 10, // L2
  partidaEjecucion: 11, // L1
  nota: 12,
  solicitud: 13,
} as const;

const FIRST_TX_ROW = 8;
const LAST_TX_ROW = 271; // SUMA + SUB-TOTAL block starts at 272

export interface DetalleEgresosOutput {
  expenditures: ParsedExpenditure[];
  partnerContributions: ParsedPartnerContribution[];
  bankAccounts: ParsedBankAccount[];
  counterparties: ParsedCounterparty[];
}

export function parseDetalleEgresos(ws: Worksheet, flags: FlagCollector): DetalleEgresosOutput {
  const expenditures: ParsedExpenditure[] = [];
  const partnerContributions: ParsedPartnerContribution[] = [];

  // Aggregations populated row-by-row, materialized at the end.
  // Per Detalle egresos finding #2: 9 distinct bank accounts. Multiple
  // accounts share the same `Banco` display (e.g., 3 different G&T QTZ
  // accounts). Key by `displayName + accountNumber` to keep them distinct.
  const bankAccountByKey = new Map<string, ParsedBankAccount>();
  const counterpartyByName = new Map<string, ParsedCounterparty>();

  // Track latest activity per bank to flag "legacy" later (last-transaction-date heuristic).
  const lastTxDateByBank = new Map<string, string>();

  // Track rows whose IVA cell is source-null (vs literal 0). Per D31 we
  // surface this as a single summary DataQualityFlag so the audit log can
  // distinguish "no IVA tracked" (null in source) from "0 GTQ of IVA charged"
  // (explicit zero in source). Both default to "0" in the parsed output, but
  // the provenance differs.
  const ivaNullRows: number[] = [];

  for (let r = FIRST_TX_ROW; r <= LAST_TX_ROW; r++) {
    const row = ws.getRow(r);
    if (!row.hasValues) continue;

    const fechaRaw = row.getCell(COL.fecha).value;
    const fecha = toIsoDate(fechaRaw);
    if (!fecha) continue; // a blank row mid-data range. Skipping is NOT data loss — there's no transaction here.

    const sourceRef = `Detalle egresos!row ${r}`;

    // -- Banco + Cuenta --
    const bancoRaw = row.getCell(COL.banco).value;
    const cuentaRaw = row.getCell(COL.cuenta).value;
    const banco = bancoRaw == null ? null : normalizeWhitespace(String(bancoRaw));
    const cuenta = cuentaRaw == null ? null : String(cuentaRaw).trim();

    const bankDisplay = banco && cuenta ? banco : null;

    // -- Empresa (counterparty) --
    const empresaRaw = row.getCell(COL.empresa).value;
    const empresa = empresaRaw == null ? "" : normalizeWhitespace(String(empresaRaw));

    // -- MONTO values (GTQ, signed) --
    const conIva = toDecimalString(row.getCell(COL.montoConIva).value);
    const sinIva = toDecimalString(row.getCell(COL.montoSinIva).value);
    const ivaCellRaw = row.getCell(COL.iva).value;
    const iva = toDecimalString(ivaCellRaw);
    if (ivaCellRaw == null) ivaNullRows.push(r);

    // -- Descripción (raw + normalized) --
    const descRaw = row.getCell(COL.descripcion).value;
    const description = descRaw == null ? "" : String(descRaw);
    const descriptionNormalized = normalizeWhitespace(description);

    // -- 3-level Partida (L3 / L2 / L1) --
    // Use cellValueToString to handle ExcelJS formula-cell objects (the broken
    // Nomenclatura VLOOKUPs sometimes resolve to objects with `.result` set).
    // Without this, `String(formulaCell)` yields "[object Object]" — silent
    // data loss that violates D31.
    const piStr = cellValueToString(row.getCell(COL.partidaInterna).value);
    const pgStr = cellValueToString(row.getCell(COL.partidaGeneral).value);
    const peStr = cellValueToString(row.getCell(COL.partidaEjecucion).value);
    const partidaInterna = piStr == null ? null : normalizeWhitespace(piStr) || null;
    const partidaGeneral = pgStr == null ? null : normalizeWhitespace(pgStr) || null;
    const partidaEjecucion = peStr == null ? null : normalizeWhitespace(peStr) || null;

    // -- Nota + Solicitud --
    const notaRaw = row.getCell(COL.nota).value;
    const solRaw = row.getCell(COL.solicitud).value;
    const nota = notaRaw == null ? null : String(notaRaw).trim() || null;
    const solicitud = solRaw == null ? null : String(solRaw).trim() || null;

    // ── Flag emissions (D31: capture, don't drop) ─────────────────────────

    // Missing partida (broken Nomenclatura VLOOKUP per finding #4).
    if (!partidaInterna || !partidaGeneral || !partidaEjecucion) {
      flags.push({
        kind: "MISSING_PARTIDA",
        severity: "WARNING",
        sourceWorkbookRef: sourceRef,
        sourceValue: `L1=${partidaEjecucion ?? "—"} | L2=${partidaGeneral ?? "—"} | L3=${partidaInterna ?? "—"}`,
        humanMessage:
          "Transaction missing one or more PARTIDA values (likely a broken Nomenclatura VLOOKUP in the source). Operational cleanup required (Q-MISSING-PARTIDAS).",
        relatedEntityType: "Expenditure",
        relatedEntityNaturalKey: sourceRef,
      });
    }

    // Color-flagged PARTIDA INTERNA cell (finding #3).
    const piColorId = getNonDefaultFillId(row.getCell(COL.partidaInterna));
    if (piColorId) {
      flags.push({
        kind: "PARTIDA_FLAGGED_FOR_REVIEW",
        severity: "INFO",
        sourceWorkbookRef: `${sourceRef} col I`,
        sourceValue: partidaInterna,
        recomputedValue: piColorId,
        humanMessage: `PARTIDA INTERNA cell carries a non-default fill (${piColorId}). Likely an analyst's "uncertain assignment" marker — manual review recommended.`,
        relatedEntityType: "Expenditure",
        relatedEntityNaturalKey: sourceRef,
      });
    }

    // No-Banco row (finding #8). Legitimate for non-cash events and PA
    // transfers, but flag for traceability.
    if (!bankDisplay) {
      flags.push({
        kind: "MISSING_BANCO_INTENTIONAL",
        severity: "INFO",
        sourceWorkbookRef: sourceRef,
        sourceValue: empresa,
        humanMessage:
          "Transaction has no Banco/Cuenta tag. Typically legitimate (non-cash equity event, cross-company transfer, or 2018-era pre-banking-setup row). Preserved per D21 + D31.",
        relatedEntityType: "Expenditure",
        relatedEntityNaturalKey: sourceRef,
      });
    }

    // Negative MONTO (finding #13). Refund convention.
    if (sinIva && sinIva.startsWith("-")) {
      flags.push({
        kind: "OVERSPEND", // re-purposed for the "negative-value transaction" signal
        severity: "INFO",
        sourceWorkbookRef: sourceRef,
        sourceValue: sinIva,
        humanMessage:
          "Transaction MONTO SIN IVA is negative (refund / reimbursement convention). Signed values preserved per D31; rollups should sum signed amounts.",
        relatedEntityType: "Expenditure",
        relatedEntityNaturalKey: sourceRef,
      });
    }

    // ── PartnerContribution rows (1.5M cash terreno + 9.1M aportación) ───
    if (PARTNER_CONTRIBUTION_ROWS.has(r)) {
      const kind = r === 267 ? "IN_KIND_ASSET" : "CASH_PURCHASE";
      const assetDescription =
        kind === "IN_KIND_ASSET"
          ? "Bien inmueble: terreno Santa Elena (5TA AVE. SUR FINAL, FINCA PAVON Y MATAMBO LOTE 3, SAN PEDRO EL PANORAMA, ANTIGUA GUATEMALA, SACATEPEQUEZ)"
          : null;
      // Both SE PCs have partida = TERRENO in the source row → categoryCode = TERRENOS.
      // Per Batch 7.5: lets budget-health roll them into TERRENO's spent total.
      const categoryCode =
        partidaEjecucion && partidaEjecucion.toUpperCase().includes("TERRENO") ? "TERRENOS" : null;
      partnerContributions.push({
        partnerName: empresa,
        date: fecha,
        amountGtq: sinIva ?? conIva ?? "0",
        amountUsd: "0", // recomputed in seed using project TC
        kind,
        assetDescription,
        sourceWorkbookRef: sourceRef,
        categoryCode,
        notes: descriptionNormalized || null,
      });
      // Counterparty for the partner row. Use the standard classifier:
      // row 267 (Condominio Antigua Panorama, S.A.) → INTERNAL_ENTITY; row
      // 138 (ANA DIAZ DURAN DURAN, original landowner) → VENDOR.
      const partnerCategory = classifyCounterparty(empresa);
      upsertCounterparty(counterpartyByName, empresa, r, partnerCategory, { isBuyer: false });
      continue;
    }

    // ── Standard Expenditure row ───────────────────────────────────────────
    const exchangeRateAtTransaction = extractTcFromDescription(description);

    // Classify status + kind.
    const status =
      normalizeWhitespace(partidaInterna ?? "").toUpperCase() === "ANULADO" ||
      normalizeWhitespace(partidaGeneral ?? "").toUpperCase() === "ANULADO"
        ? ("ANULADO" as const)
        : ("PENDING" as const);
    const kind = expenditureKindFromPartida(partidaInterna, partidaGeneral, partidaEjecucion);

    expenditures.push({
      sourceWorkbookRef: sourceRef,
      bankAccountDisplayName: bankDisplay,
      date: fecha,
      counterpartyName: empresa,
      description,
      descriptionNormalized,
      amountConIvaGtq: conIva ?? "0",
      amountSinIvaGtq: sinIva ?? "0",
      ivaAmountGtq: iva ?? "0",
      exchangeRateAtTransaction,
      partidaInterna,
      partidaGeneral,
      partidaEjecucionPresupuestaria: partidaEjecucion,
      nota,
      solicitud,
      status,
      kind,
    });

    // ── Upsert BankAccount + Counterparty aggregates ──────────────────────
    if (banco && cuenta) {
      const accountKey = `${banco}|${cuenta}`;
      upsertBankAccount(bankAccountByKey, accountKey, banco, cuenta);
      lastTxDateByBank.set(accountKey, fecha);
    }
    if (empresa) {
      const category = classifyCounterparty(empresa);
      upsertCounterparty(counterpartyByName, empresa, r, category, {
        isBuyer: false,
      });
    }
  }

  // Increment transaction counts on bank accounts. Index by accountNumber
  // since Expenditure carries only the displayName (multiple accounts can
  // share the same display string per finding #2). We use the most-frequent
  // accountNumber per displayName for the lookup; if there's a tie, the
  // counts won't be wrong, just split a different way.
  //
  // BUT — to keep this surgical, we walk expenditures directly against the
  // map by both bank + cuenta. The map key was built from those two fields,
  // so we can re-derive it for each expenditure that has BOTH a banco and a
  // cuenta. For expenditures with no banco (per finding #8, legitimate
  // non-cash markers), we skip — they don't count toward any bank account.
  //
  // Re-walk by re-reading the source rows would be cleaner; here we rely on
  // the fact that `lastTxDateByBank` already keys the same way.
  // The simpler approach: iterate the underlying account key set.

  // Per-account transaction counts: re-walk the rows once. Counting at
  // insert-time would require carrying the account-key onto each parsed
  // Expenditure, which we deliberately don't (the seed re-resolves
  // BankAccount FK from displayName + accountNumber, not from the parser's
  // internal key).
  const txCountsByKey = countTxByAccountKey(ws, FIRST_TX_ROW, LAST_TX_ROW);
  for (const [key, count] of txCountsByKey) {
    const ba = bankAccountByKey.get(key);
    if (ba) ba.transactionCount = count;
  }

  // Mark legacy accounts per Detalle egresos finding #2.
  const LEGACY_NUMBERS = new Set(["02-0014055-8", "02-0019053-5", "90-149804-8"]);
  for (const ba of bankAccountByKey.values()) {
    if (LEGACY_NUMBERS.has(ba.accountNumber)) ba.isActive = false;
  }

  // ── IVA-cell null provenance flag (per D31) ──────────────────────────────
  // Default-to-"0" without a record would lose the distinction between
  // "no IVA tracked" (source null) and "0 GTQ of IVA charged" (explicit 0).
  // Surface as a single INFO flag listing the offending rows.
  if (ivaNullRows.length > 0) {
    flags.push({
      kind: "STALE_FORMULA_WINDOW",
      severity: "INFO",
      sourceWorkbookRef: `Detalle egresos!col G (rows ${ivaNullRows.join(", ")})`,
      sourceValue: `${ivaNullRows.length} expenditure rows had null IVA cells (vs explicit 0).`,
      humanMessage:
        "Per D31: source IVA cells null in these rows (typically pre-2018 entries + ANULADO refunds where IVA was never tracked separately). Parser defaults to '0' in the parsed output but records the source-null provenance here so the audit log preserves the 'no IVA tracked' vs 'explicit 0 IVA' distinction.",
    });
  }

  return {
    expenditures,
    partnerContributions,
    bankAccounts: Array.from(bankAccountByKey.values()).sort(
      (a, b) => b.transactionCount - a.transactionCount,
    ),
    counterparties: Array.from(counterpartyByName.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
}

/// Counts transactions per (banco|cuenta) key by re-walking the rows once.
function countTxByAccountKey(ws: Worksheet, firstRow: number, lastRow: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (let r = firstRow; r <= lastRow; r++) {
    const row = ws.getRow(r);
    if (!row.hasValues) continue;
    const banco = row.getCell(COL.banco).value;
    const cuenta = row.getCell(COL.cuenta).value;
    if (!banco || !cuenta) continue;
    const key = `${normalizeWhitespace(String(banco))}|${String(cuenta).trim()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function upsertBankAccount(
  map: Map<string, ParsedBankAccount>,
  key: string,
  bancoDisplay: string,
  accountNumber: string,
): void {
  if (map.has(key)) return;

  // Display name "G&T (USD)" → bank = "G&T", currency = "USD".
  const match = bancoDisplay.match(/^(.+?)\s*\((USD|QTZ|GTQ)\)\s*$/i);
  const bankName = match ? match[1]!.trim() : bancoDisplay;
  const currency = match ? (match[2]!.toUpperCase() === "USD" ? "USD" : "GTQ") : "GTQ";

  map.set(key, {
    bankName,
    accountNumber,
    currency,
    displayName: bancoDisplay,
    isActive: true,
    transactionCount: 0,
  });
}

function upsertCounterparty(
  map: Map<string, ParsedCounterparty>,
  name: string,
  _sourceRow: number,
  category: ParsedCounterparty["category"],
  flags: { isBuyer: boolean },
): void {
  if (map.has(name)) return;
  const type = inferLegalType(name);
  map.set(name, {
    name,
    taxId: null,
    type,
    category,
    isVendor: category === "VENDOR",
    isBuyer: flags.isBuyer,
    notes: null,
  });
}

/// 5-value functional category per Detalle egresos finding #5.
/// Maps known internal entities + tax authority + banks to their categories;
/// everything else is VENDOR.
const INTERNAL_ENTITIES = new Set([
  "Forma Capital Inmobiliario, S. A.",
  "Puerta Abierta Inmobiliaria, S. A.",
  "Icono Urbano, S. A.",
  "Icono Urbano, S. A. ", // trailing-space variant observed in source
  "Condominio Antigua Panorama, S. A.",
]);

const INTERNAL_INDIVIDUALS = new Set([
  "Aguedo Ivan Escobar Velasquez",
  "Otto Rafael Herrera Perez",
  "OTTO RAFAEL HERRERA PEREZ",
]);

function classifyCounterparty(name: string): ParsedCounterparty["category"] {
  const upper = name.toUpperCase();
  if (upper === "TESORERIA NACIONAL") return "TAX_AUTHORITY";
  if (upper.includes("BANCO G&T CONTINENTAL")) return "BANK_AS_COUNTERPARTY";
  if (INTERNAL_ENTITIES.has(name) || INTERNAL_ENTITIES.has(`${name} `)) return "INTERNAL_ENTITY";
  if (INTERNAL_INDIVIDUALS.has(name)) return "INTERNAL_INDIVIDUAL";
  return "VENDOR";
}

function inferLegalType(name: string): ParsedCounterparty["type"] {
  const upper = name.toUpperCase();
  // Government / tax authority.
  if (upper === "TESORERIA NACIONAL") return "GOVERNMENT";
  if (upper.includes("MUNICIPALIDAD")) return "GOVERNMENT";
  // Companies usually end in "S.A.", "S. A.", "S. A. ", "S.C.", or include "INMOBILIARIA"/"BANCO".
  if (/\bS\.\s?A\.?/.test(name) || /\bBANCO\b/i.test(name) || /S\.\s?C\.?/.test(name)) {
    return "COMPANY";
  }
  // Default to INDIVIDUAL for human-name patterns.
  return "INDIVIDUAL";
}

/// Per Detalle egresos finding #7: classify Expenditure.kind by partida.
function expenditureKindFromPartida(
  l3: string | null,
  l2: string | null,
  l1: string | null,
): ParsedExpenditure["kind"] {
  const l2Up = (l2 ?? "").toUpperCase();
  const l3Up = (l3 ?? "").toUpperCase();
  const l1Up = (l1 ?? "").toUpperCase();
  if (
    l2Up === "DEVOLUCIÓN" ||
    l2Up === "DEVOLUCION" ||
    l2Up === "TRASLADO DE FONDOS" ||
    l3Up.includes("DEVOLUCIÓN") ||
    l3Up.includes("TRASLADO DE FONDOS")
  ) {
    return "CASH_MOVEMENT";
  }
  if (l1Up.includes("APORTACION") || l1Up.includes("APORTACIÓN")) {
    return "EQUITY_EVENT";
  }
  return "OPERATING_EXPENSE";
}
