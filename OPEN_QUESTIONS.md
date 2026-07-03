# Open questions

Questions that block work on the app. Each one names the audience whose call it is (Federico = CEO / strategic; Ronny = Analyst / operational; Jorge = product owner; data = needs inspection of the SSOT workbook before anyone can decide).

Resolved questions live at the bottom for context.

---

## Q2 — Dashboard summary cards (decision: Federico)

**Status:** partially answered. Federico confirmed the three cards he wants at the top of the dashboard:

1. **Capital autorizado a la fecha**
2. **ROI del proyecto**
3. **Utilidad neta del proyecto**

**Still open — field mapping:**

- *Capital autorizado a la fecha.* `CreditFacilityState` carries both `initialCapUsd` (cap at signing) and `currentCapUsd` (revalued cap per N1). "A la fecha" reads as *current* — confirm `currentCapUsd` is the right source.
- *ROI del proyecto.* Same field as Q4 — see below.
- *Utilidad neta del proyecto.* Model has `totalEbitdaUsd` (gross of tax) and `IsrSnapshot.projectedTotalIsrUsd`. Is "neta" used here in the after-tax sense (`totalEbitdaUsd − projectedTotalIsrUsd`) or in the EBITDA sense (`totalEbitdaUsd` alone)?

**Still open — layout:**

Do the three cards **replace** the current sub-blocks (`RESULTADO FINANCIERO`, `RITMO DE GASTO`, `PROYECCIÓN`) on the main screen, or sit **alongside** them with the others demoted?

---

## Q3 — Phase-1 (reserva) and phase-3 (bank-credit) sale data (decision: Ronny + data inspection)

The COBROS xlsx tracks **phase 2 (enganche) only**. The three-phase sale model implies phases 1 and 3 generate revenue too, but the app has no source for them — so the "realized revenue" figure on the dashboard is structurally incomplete.

**Federico routed this away** ("no es para Federico"). So:

- *For Ronny:* are phase-1 and phase-3 amounts tracked anywhere — notary records, bank confirmations, a separate sheet, paper files? If yes, where, and in what format?
- *For data inspection:* before assuming "we don't have that data," do a deep read of the xlsx workbook to confirm no tab/range carries phase-1 or phase-3 figures.
- *Product call (Jorge):* if neither source exists, the dashboard needs to acknowledge the gap explicitly — currently it implies completeness when it isn't.

---

## Q4 — TIR and ROI on `/forecast` (decision: Federico → Jorge to confirm field mapping)

**Status:** partially answered. Federico said: *"TIR es tasa interna de retorno. ROI es retorno sobre la inversión. Éstas son las únicas dos medidas finales que nos interesan."*

The calc layer ([src/lib/calc/projection-runner.ts:56-74](src/lib/calc/projection-runner.ts#L56-L74)) currently exposes **five** figures grouped as four returns:

1. `revenueToCostRatio` / `revenueToCostMarginPct` — Revenue ÷ Cost (e.g. "1.13× / +12.6% sobre costo")
2. `ebitdaMarginPct` — EBITDA ÷ Revenue (margin — the comment explicitly says "never abbreviated to ROI")
3. `irrAnnualizedFull` — TIR over the full 36 months (~31.2%)
4. `irrAnnualizedXlsx` — TIR over months 1–30, matching the xlsx as-written (~21.23%, per Q-TIRI-WINDOW)
5. `returnOnPeakEquity` — total EBITDA ÷ peak equity (structurally closest to "retorno sobre la inversión")

**Still open:**

- *TIR.* Which is *the* TIR — `irrAnnualizedFull` (36-month corrected) or `irrAnnualizedXlsx` (30-month xlsx-as-written)? Or both, side-by-side with literal labels?
- *ROI.* Is `returnOnPeakEquity` the right field? Or does Federico read "ROI" as something else (e.g. `revenueToCostMarginPct`)?
- *The remaining figures* (`revenueToCostRatio`, `ebitdaMarginPct`, and whichever IRR variant isn't kept) — confirm they get **deleted** from `/forecast`.

---

## Q6 — Casa renumbering + "venta desistida" (decision: Federico)

**Status:** partially answered. Federico said: *"Casa 6 en la nueva nomenclatura es Casa 5 y su estado es DISPONIBLE. El ingreso obtenido se considera como venta desistida."*

This is two coupled decisions:

### Q6a — Full old → new renumbering map

The directive says `old Casa 6 → new Casa 5`. But the model already has a `Casa 5` — same name, different unit. So what happens to the existing Casa 5?

- Is it being deleted (the slot no longer exists in the new nomenclature)?
- Is it being renumbered to another slot (Casa 6? Casa 12?)?
- Is the new nomenclature **10 units** total (1–4, then 5 = old-6, then 7–11)?

Need the **full map for all 11 (or fewer) units** before any rename — it affects unit IDs, sort order, reconciliation history, and every per-unit query.

### Q6b — "Venta desistida" treatment

The cash received for old-Casa-6 stays on the books; the unit reverts to `AVAILABLE`. Open:

- *Schema.* Is `VENTA_DESISTIDA` a new sale-status enum value, or does the unit sit as `AVAILABLE` with the historical revenue attached via a `DataQualityFlag` or similar marker?
- *Cash treatment.* The money — recognized income (buyer forfeited the deposit) or pending liability (refund owed)? This determines whether it flows into EBITDA / projected revenue or sits as a balance-sheet item.

---

## Q8 — ISR mechanic (decision: Federico → Jorge to choose UI framing)

**Status:** partially answered. Federico explained:

> 18% es la rule of thumb después de aplicar la estrategia fiscal. La base para el cálculo de la estrategia fiscal es el 25% (tasa legal) sobre el 70% (parte del precio que es VENTA, a diferencia del 30% que es APORTE a capital).

So: **25% legal rate × 70% of price (VENTA portion) ≈ 18% effective**. The 30% (APORTE a capital) isn't taxed. The 18% and 25% are **the same tax, expressed differently** — not two parallel obligations.

The current display in [src/components/dashboard/FinancialBottomLine.tsx](src/components/dashboard/FinancialBottomLine.tsx) shows both side-by-side as if they were independent — that's a misrepresentation.

**Still open:**

### Q8a — UI framing

Which presentation does Federico want?

- Effective rate only (≈18%) with the small-print derivation "25% × 70% del precio (VENTA)".
- Both rates, labeled **base legal** (25%) and **carga efectiva** (18%) so it's clear they're not additive.
- Only the absolute USD projected ISR, with the rate as a footnote.

### Q8b — Is the 70/30 split already in the calc layer?

`src/lib/calc/isr.ts` needs a read to confirm whether the ISR base is `pretax_profit_basis × 0.70` (correct) or the full pretax profit (a bug). Until that's verified, Q8a's options can't be sized as "UI-only fix" vs "calc fix + UI fix."

### Q8c — Is the 70/30 split uniform?

Does the split apply identically to all units, or does it vary per-house / per-buyer? If it varies, it needs to live as a field on `Unit` or `Sale`, not as a constant.

---

## Resolved (kept for context)

- **Q1 — Section names on the dashboard.** Federico confirmed the current nomenclature.
- **Q5 — Anomaly resolution workflow.** Anomalies are resolved outside the app. `/anomalias` remains as a read-only flag list; no resolution UI to build.
- **Q7 — Aguedo's view (legal role).** Out of place — not Federico's call.
