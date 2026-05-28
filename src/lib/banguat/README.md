# BANGUAT Exchange-Rate Service

Source documentation for the Banco de Guatemala (BANGUAT) SOAP endpoint we
consume in Batch 9. Captured from a real WSDL fetch + live SOAP probes on
2026-05-26 so future-me isn't guessing.

## Endpoint

- Base: `https://www.banguat.gob.gt/variables/ws/TipoCambio.asmx`
- WSDL: `https://www.banguat.gob.gt/variables/ws/TipoCambio.asmx?WSDL`
- Transport: SOAP 1.1 over HTTPS (POST `text/xml; charset=utf-8`)
- Latency observed: ~400–500ms from US-East
- Auth: **none** (public service)

## Operations we use

### `TipoCambioDia` — today's official rate (no args)

```xml
<TipoCambioDia xmlns="http://www.banguat.gob.gt/variables/ws/" />
```

Response:

```xml
<TipoCambioDiaResult>
  <CambioDolar>
    <VarDolar>
      <fecha>26/05/2026</fecha>
      <referencia>7.6226</referencia>
    </VarDolar>
  </CambioDolar>
  <TotalItems>1</TotalItems>
</TipoCambioDiaResult>
```

The `referencia` field is the **single official daily reference rate**
published by BANGUAT — GTQ per USD. This is what we cache as the canonical
day-of-record value.

### `TipoCambioRango` — date-range query

```xml
<TipoCambioRango xmlns="http://www.banguat.gob.gt/variables/ws/">
  <fechainit>20/05/2026</fechainit>
  <fechafin>26/05/2026</fechafin>
</TipoCambioRango>
```

Response:

```xml
<TipoCambioRangoResult>
  <Vars>
    <Var>
      <moneda>2</moneda>
      <fecha>20/05/2026</fecha>
      <venta>7.62313</venta>
      <compra>7.62313</compra>
    </Var>
    <!-- ...one Var per day in range -->
  </Vars>
  <TotalItems>7</TotalItems>
</TipoCambioRangoResult>
```

For USD (`moneda=2`), `venta` and `compra` always equal each other and equal
today's `referencia` — they're three names for the same official rate. We
read `venta`.

## Quirks discovered

1. **Date format is `dd/mm/yyyy`.** Not ISO. Our parser converts to ISO
   before persisting.
2. **Weekends and holidays inherit the previous business day's rate.** In a
   range query, Saturday and Sunday return Friday's rate verbatim (same
   `fecha` field per day; values identical).
3. **`venta === compra === referencia`** for USD. Don't assume buy/sell
   spread on the public service — historically that spread lives elsewhere
   (commercial bank desks).
4. **`moneda=2` is USD.** The default for `TipoCambioRango` is USD; the
   `*Moneda` variants take a currency code. We do not call those.
5. **Range queries cap at 1000 results** (undocumented but observed on PA's
   historic data). For the Santa Elena backfill (2017-12 → today, ~3,000
   days) we chunk by year.
6. **Public, unauthenticated**. We add a CRON_SECRET on OUR side of the
   ingestion route to prevent the cron endpoint from being forged.

## Why we wrote raw SOAP

The full WSDL has 8 operations and a half-dozen complex types we don't
need. A minimal hand-written SOAP envelope + small regex/XML parsing
(`fast-xml-parser` if it gets thornier) is ~80 lines and stays auditable.
The alternative (a SOAP client like `strong-soap` or `easy-soap-request`)
adds ~15MB of dependencies for two endpoints we already understand. Per
`_THE_RULES.MD` Rule 5 (production-grade, no over-engineering): keep it
small and explicit.

## Failure modes we plan for

| Failure                       | Behavior                                                 |
| ----------------------------- | -------------------------------------------------------- |
| DNS / TCP failure             | Resolver falls back to nearest previous cached date with `isStale=true` |
| HTTP 5xx                      | Same as above                                            |
| SOAP fault (1xx-level error)  | Surfaced to caller; route handler returns 503            |
| Unexpected XML shape          | Parser throws explicit `BanguatParseError` w/ context    |
| Future date requested         | Resolver returns nearest previous date with `isStale=true` |
| Date older than backfill      | Resolver fetches single-day via `TipoCambioFechaInicial` |
| Two cron runs same day        | Idempotent upsert on `date`; second is a no-op           |
