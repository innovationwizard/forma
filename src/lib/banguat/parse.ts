/**
 * BANGUAT SOAP-response XML parsing.
 *
 * Hand-written regex parsing instead of a full SOAP client: see README.md
 * for the rationale. The response shapes are tiny, stable, and fully
 * documented from real probes on 2026-05-26. Each helper throws
 * `BanguatParseError` (with a response snippet) on unexpected shape — per
 * D31 the failure mode is loud + named, not silent or guess-corrected.
 */

import { BanguatParseError, type BanguatRate } from "./types";

/// Convert `dd/mm/yyyy` (BANGUAT's format) → `YYYY-MM-DD` (ISO). Throws
/// BanguatParseError on malformed input so the caller knows the response
/// shape changed.
export function fechaToIso(fecha: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fecha.trim());
  if (m == null) {
    throw new BanguatParseError(`Unexpected fecha format: ${fecha}`, fecha);
  }
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

/// Parse a `TipoCambioDia` response body to a single `BanguatRate`.
/// Throws `BanguatParseError` if `<fecha>` or `<referencia>` is missing.
export function parseTipoCambioDia(xml: string): BanguatRate {
  const fecha = extractScalar(xml, "fecha");
  const referencia = extractScalar(xml, "referencia");
  if (fecha == null || referencia == null) {
    throw new BanguatParseError(
      "TipoCambioDia response missing <fecha> or <referencia>",
      xml,
    );
  }
  return {
    date: fechaToIso(fecha),
    rateGtqPerUsd: referencia.trim(),
  };
}

/// Parse a `TipoCambioRango` response body to an ordered array of `BanguatRate`.
/// Reads `<venta>` (equal to `<compra>` and `<referencia>` for USD per WSDL +
/// live probes). Empty array if `<Vars>` has no `<Var>` children.
export function parseTipoCambioRango(xml: string): BanguatRate[] {
  // Each <Var>…</Var> block contains a single rate row.
  const varBlocks = xml.match(/<Var>[\s\S]*?<\/Var>/g);
  if (varBlocks == null) return [];
  return varBlocks.map((block) => {
    const fecha = extractScalar(block, "fecha");
    const venta = extractScalar(block, "venta");
    if (fecha == null || venta == null) {
      throw new BanguatParseError(
        "TipoCambioRango row missing <fecha> or <venta>",
        block,
      );
    }
    return {
      date: fechaToIso(fecha),
      rateGtqPerUsd: venta.trim(),
    };
  });
}

/// Detect a SOAP fault (legitimate server-side errors). Returns the
/// `<faultstring>` if present; null otherwise.
export function detectSoapFault(xml: string): string | null {
  const fault = /<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i.exec(xml);
  return fault != null && fault[1] ? fault[1].trim() : null;
}

function extractScalar(xml: string, tag: string): string | null {
  // Non-greedy match, case-sensitive (BANGUAT uses lowercase tags consistently).
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  const m = re.exec(xml);
  return m != null && m[1] != null ? m[1] : null;
}
