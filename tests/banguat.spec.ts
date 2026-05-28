/**
 * BANGUAT integration tests.
 *
 * Two layers:
 *   - **Offline (always run)**: parsing + error paths against fixtures
 *     captured from real probes on 2026-05-26. These cover the
 *     conversation between our XML parser and BANGUAT's documented shapes
 *     without depending on the network.
 *   - **Integration (opt-in)**: hits the real BANGUAT endpoint. Skipped by
 *     default; enable with `BANGUAT_LIVE=1 pnpm test`. Use this to catch
 *     drift if BANGUAT changes the response shape silently.
 *
 * Per Rule 9: fixtures are CAPTURED bytes from real responses, not
 * hand-authored mocks. The strings below are exact copies of what we
 * observed; don't edit them without re-capturing.
 */

import { describe, expect, it } from "vitest";

import { fetchToday, fetchRange } from "../src/lib/banguat/fetch";
import {
  detectSoapFault,
  fechaToIso,
  parseTipoCambioDia,
  parseTipoCambioRango,
} from "../src/lib/banguat/parse";
import { BanguatParseError } from "../src/lib/banguat/types";

const LIVE = process.env["BANGUAT_LIVE"] === "1";

// ── Real-capture fixtures (2026-05-26) ──────────────────────────────────────

const FIXTURE_TIPO_CAMBIO_DIA = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Body><TipoCambioDiaResponse xmlns="http://www.banguat.gob.gt/variables/ws/"><TipoCambioDiaResult><CambioDolar><VarDolar><fecha>26/05/2026</fecha><referencia>7.6226</referencia></VarDolar></CambioDolar><TotalItems>1</TotalItems></TipoCambioDiaResult></TipoCambioDiaResponse></soap:Body></soap:Envelope>`;

const FIXTURE_TIPO_CAMBIO_RANGO = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Body><TipoCambioRangoResponse xmlns="http://www.banguat.gob.gt/variables/ws/"><TipoCambioRangoResult><Vars><Var><moneda>2</moneda><fecha>20/05/2026</fecha><venta>7.62313</venta><compra>7.62313</compra></Var><Var><moneda>2</moneda><fecha>21/05/2026</fecha><venta>7.62184</venta><compra>7.62184</compra></Var><Var><moneda>2</moneda><fecha>22/05/2026</fecha><venta>7.62106</venta><compra>7.62106</compra></Var><Var><moneda>2</moneda><fecha>23/05/2026</fecha><venta>7.62106</venta><compra>7.62106</compra></Var><Var><moneda>2</moneda><fecha>24/05/2026</fecha><venta>7.62106</venta><compra>7.62106</compra></Var><Var><moneda>2</moneda><fecha>25/05/2026</fecha><venta>7.61679</venta><compra>7.61679</compra></Var><Var><moneda>2</moneda><fecha>26/05/2026</fecha><venta>7.6226</venta><compra>7.6226</compra></Var></Vars><TotalItems>7</TotalItems></TipoCambioRangoResult></TipoCambioRangoResponse></soap:Body></soap:Envelope>`;

const FIXTURE_SOAP_FAULT = `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultcode>soap:Server</faultcode><faultstring>System.FormatException: Cadena de entrada incorrecta.</faultstring></soap:Fault></soap:Body></soap:Envelope>`;

// ── Parser unit tests ───────────────────────────────────────────────────────

describe("fechaToIso", () => {
  it("converts dd/mm/yyyy → YYYY-MM-DD", () => {
    expect(fechaToIso("26/05/2026")).toBe("2026-05-26");
    expect(fechaToIso("01/12/2017")).toBe("2017-12-01");
  });

  it("throws BanguatParseError on malformed input", () => {
    expect(() => fechaToIso("2026-05-26")).toThrow(BanguatParseError);
    expect(() => fechaToIso("5/5/2026")).toThrow(BanguatParseError);
    expect(() => fechaToIso("")).toThrow(BanguatParseError);
  });
});

describe("parseTipoCambioDia", () => {
  it("extracts today's rate from the real fixture", () => {
    const result = parseTipoCambioDia(FIXTURE_TIPO_CAMBIO_DIA);
    expect(result).toEqual({
      date: "2026-05-26",
      rateGtqPerUsd: "7.6226",
    });
  });

  it("throws BanguatParseError when fields are missing", () => {
    expect(() => parseTipoCambioDia("<TipoCambioDiaResult></TipoCambioDiaResult>")).toThrow(
      BanguatParseError,
    );
  });
});

describe("parseTipoCambioRango", () => {
  it("parses the 7-day fixture into 7 rates", () => {
    const result = parseTipoCambioRango(FIXTURE_TIPO_CAMBIO_RANGO);
    expect(result).toHaveLength(7);
    expect(result[0]).toEqual({ date: "2026-05-20", rateGtqPerUsd: "7.62313" });
    expect(result[6]).toEqual({ date: "2026-05-26", rateGtqPerUsd: "7.6226" });
  });

  it("uses <venta> (which equals <compra> + <referencia> for USD)", () => {
    const result = parseTipoCambioRango(FIXTURE_TIPO_CAMBIO_RANGO);
    expect(result[0]?.rateGtqPerUsd).toBe("7.62313");
  });

  it("returns empty array when no <Var> entries", () => {
    const empty = `<TipoCambioRangoResult><Vars></Vars><TotalItems>0</TotalItems></TipoCambioRangoResult>`;
    expect(parseTipoCambioRango(empty)).toEqual([]);
  });
});

describe("detectSoapFault", () => {
  it("extracts the faultstring on a fault envelope", () => {
    expect(detectSoapFault(FIXTURE_SOAP_FAULT)).toBe(
      "System.FormatException: Cadena de entrada incorrecta.",
    );
  });

  it("returns null on a healthy response", () => {
    expect(detectSoapFault(FIXTURE_TIPO_CAMBIO_DIA)).toBeNull();
  });
});

// ── Live integration (opt-in via BANGUAT_LIVE=1) ────────────────────────────

describe.skipIf(!LIVE)("BANGUAT live integration", () => {
  it("fetchToday returns today's rate", async () => {
    const result = await fetchToday({ timeoutMs: 15_000 });
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number(result.rateGtqPerUsd)).toBeGreaterThan(7);
    expect(Number(result.rateGtqPerUsd)).toBeLessThan(9);
  }, 20_000);

  it("fetchRange returns daily rates", async () => {
    const result = await fetchRange("2026-05-20", "2026-05-26", { timeoutMs: 15_000 });
    expect(result.length).toBeGreaterThanOrEqual(7);
    for (const r of result) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number(r.rateGtqPerUsd)).toBeGreaterThan(7);
    }
  }, 20_000);
});
