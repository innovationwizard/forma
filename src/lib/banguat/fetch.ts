/**
 * BANGUAT SOAP client.
 *
 * Two operations exposed:
 *   - `fetchToday()`           → today's official `referencia` rate
 *   - `fetchRange(from, to)`   → daily rates over an inclusive date range
 *
 * Both are pure functions over `globalThis.fetch` — no DB access, no caching,
 * no retries. The caller (cron route or backfill script) owns persistence
 * and the fallback semantics. Per the architectural split, this file knows
 * the wire format and nothing else.
 */

import { detectSoapFault, parseTipoCambioDia, parseTipoCambioRango } from "./parse";
import { BanguatFetchError, type BanguatRate } from "./types";

const ENDPOINT = "https://www.banguat.gob.gt/variables/ws/TipoCambio.asmx";
const NAMESPACE = "http://www.banguat.gob.gt/variables/ws/";
const DEFAULT_TIMEOUT_MS = 10_000;

export interface FetchOptions {
  /// AbortSignal for caller-driven cancellation; merged with the default
  /// 10s timeout. Useful for tests + cron deadline enforcement.
  signal?: AbortSignal;
  /// Override the default 10s timeout in milliseconds. The cron handler
  /// uses the default; the backfill script bumps to 30s because range
  /// queries take longer.
  timeoutMs?: number;
}

export async function fetchToday(opts: FetchOptions = {}): Promise<BanguatRate> {
  const envelope = soapEnvelope(`<TipoCambioDia xmlns="${NAMESPACE}" />`);
  const xml = await postSoap("TipoCambioDia", envelope, opts);
  return parseTipoCambioDia(xml);
}

export async function fetchRange(
  fromIso: string,
  toIso: string,
  opts: FetchOptions = {},
): Promise<BanguatRate[]> {
  const envelope = soapEnvelope(
    `<TipoCambioRango xmlns="${NAMESPACE}">
       <fechainit>${isoToFecha(fromIso)}</fechainit>
       <fechafin>${isoToFecha(toIso)}</fechafin>
     </TipoCambioRango>`,
  );
  const xml = await postSoap("TipoCambioRango", envelope, opts);
  return parseTipoCambioRango(xml);
}

async function postSoap(
  operation: string,
  body: string,
  opts: FetchOptions,
): Promise<string> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Allow caller-supplied signal to cancel us too.
  opts.signal?.addEventListener("abort", () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${NAMESPACE}${operation}"`,
      },
      body,
      signal: controller.signal,
      // BANGUAT is a public service; never cache the cron-driving response.
      cache: "no-store",
    });
  } catch (err) {
    throw new BanguatFetchError(
      `Network error calling ${operation}: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new BanguatFetchError(
      `${operation} returned HTTP ${response.status} ${response.statusText}`,
    );
  }

  const text = await response.text();
  const fault = detectSoapFault(text);
  if (fault != null) {
    throw new BanguatFetchError(`${operation} SOAP fault: ${fault}`);
  }
  return text;
}

function soapEnvelope(innerBody: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${innerBody}
  </soap:Body>
</soap:Envelope>`;
}

/// Convert ISO `YYYY-MM-DD` → BANGUAT `dd/mm/yyyy`. Mirror of `fechaToIso`
/// in parse.ts.
function isoToFecha(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m == null) throw new BanguatFetchError(`Invalid ISO date: ${iso}`);
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}
