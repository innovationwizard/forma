"use client";

/**
 * Manual transaction entry form.
 *
 * Three sections:
 *   1. Counterparty + date + bank
 *   2. Amounts (con IVA / sin IVA / IVA — compute the missing two from the
 *      one being edited; project IVA rate from server)
 *   3. Categorization (cascading L1 partition → L2 category → L3 sub-item)
 *
 * Sidecar: exchange rate. On date change we call `resolveRateAction(date)`
 * which returns the BANGUAT cache hit (or nearest-previous / project locked
 * fallback) — user can override with a required reason.
 *
 * Live USD reconstruction below the amounts: `sinIvaGtq / exchangeRate`.
 *
 * Submit → `createExpenditureAction` → on success, server-side redirect to
 * `/transaction/[newId]` so the analyst lands on the audit trail immediately.
 */

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  createExpenditureAction,
  resolveRateAction,
  type CreateExpenditureInput,
} from "@/app/(app)/entry/new/actions";
import type { EntryFormChoices } from "@/lib/queries/entry-form";
import type { ResolvedRate } from "@/lib/exchange-rate/resolve";
import { computeIvaTriple, type IvaEntered } from "@/lib/forms/iva";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NewExpenditureFormProps {
  choices: EntryFormChoices;
  /// Default project locked TC — used as the seed value before the resolver
  /// returns. UI never displays the locked TC as canonical; it's purely a
  /// fallback for the first paint.
  defaultExchangeRate: string;
}

type ActiveAmount = IvaEntered;

interface FormState {
  date: string;
  vendorRaw: string;
  partnerId: string | "";
  bankAccountId: string | "";
  amountConIvaGtq: string;
  amountSinIvaGtq: string;
  ivaAmountGtq: string;
  description: string;
  partitionId: string | "";
  categoryId: string | "";
  subItemId: string | "";
  exchangeRate: string;
  exchangeRateOverridden: boolean;
  exchangeRateOverrideReason: string;
}

export function NewExpenditureForm({
  choices,
  defaultExchangeRate,
}: NewExpenditureFormProps) {
  const ivaRate = Number(choices.ivaRate);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [state, setState] = useState<FormState>({
    date: today,
    vendorRaw: "",
    partnerId: "",
    bankAccountId: "",
    amountConIvaGtq: "",
    amountSinIvaGtq: "",
    ivaAmountGtq: "",
    description: "",
    partitionId: "",
    categoryId: "",
    subItemId: "",
    exchangeRate: defaultExchangeRate,
    exchangeRateOverridden: false,
    exchangeRateOverrideReason: "",
  });
  const [activeAmount, setActiveAmount] = useState<ActiveAmount>("sinIva");
  const [resolvedRate, setResolvedRate] = useState<ResolvedRate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Auto-resolve TC when date changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await resolveRateAction(state.date);
      if (cancelled) return;
      if (result.ok) {
        setResolvedRate(result.rate);
        // Only auto-fill if user hasn't overridden.
        if (!state.exchangeRateOverridden) {
          setState((s) => ({ ...s, exchangeRate: result.rate.rateGtqPerUsd }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // We only re-resolve on date changes; override toggle is handled inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.date]);

  // Cascading filters.
  const filteredCategories = choices.categories.filter(
    (c) => state.partitionId === "" || c.partitionId === state.partitionId,
  );
  const filteredSubItems = choices.subItems.filter(
    (si) => state.categoryId !== "" && si.categoryId === state.categoryId,
  );

  // Live USD computation.
  const sinIvaNum = Number(state.amountSinIvaGtq);
  const tcNum = Number(state.exchangeRate);
  const usdReconstructed =
    Number.isFinite(sinIvaNum) && Number.isFinite(tcNum) && tcNum > 0
      ? (sinIvaNum / tcNum).toFixed(2)
      : "0.00";

  function setAmount(field: ActiveAmount, raw: string) {
    setActiveAmount(field);
    // Empty string -> zero out everything visibly.
    if (raw === "") {
      setState((s) => ({ ...s, amountConIvaGtq: "", amountSinIvaGtq: "", ivaAmountGtq: "" }));
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      // Keep the literal string for the field the user is typing; derived
      // fields stay as-is. This avoids destroying mid-typing values like
      // "1." or "1.2e" before they're complete.
      setState((s) => ({ ...s, [primaryFieldKey(field)]: raw }));
      return;
    }
    const next = computeIvaTriple(field, n, ivaRate);
    setState((s) => ({
      ...s,
      amountConIvaGtq: next.conIva,
      amountSinIvaGtq: next.sinIva,
      ivaAmountGtq: next.iva,
      // Preserve the verbatim raw string in the field being edited (for the
      // 0.10 → 0.1 round-trip etc.).
      [primaryFieldKey(field)]: raw,
    }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    // Trim and normalize before sending.
    const input: CreateExpenditureInput = {
      date: state.date,
      vendorRaw: state.vendorRaw.trim(),
      partnerId: state.partnerId === "" ? null : state.partnerId,
      bankAccountId: state.bankAccountId === "" ? null : state.bankAccountId,
      amountConIvaGtq: normalizeDecimal(state.amountConIvaGtq),
      amountSinIvaGtq: normalizeDecimal(state.amountSinIvaGtq),
      ivaAmountGtq: normalizeDecimal(state.ivaAmountGtq),
      description: state.description,
      partitionId: state.partitionId === "" ? "" : state.partitionId,
      categoryId: state.categoryId === "" ? "" : state.categoryId,
      subItemId: state.subItemId === "" ? null : state.subItemId,
      exchangeRate: normalizeDecimal(state.exchangeRate),
      exchangeRateOverridden: state.exchangeRateOverridden,
      exchangeRateOverrideReason: state.exchangeRateOverridden
        ? state.exchangeRateOverrideReason.trim()
        : null,
    };

    startTransition(async () => {
      const result = await createExpenditureAction(input);
      // Success path = server-side `redirect()` — we never see `ok:true` here
      // because the redirect throws NEXT_REDIRECT before returning. Any
      // result that DOES return is an error.
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <div>
        <h2 className="text-foreground text-base font-semibold">NUEVA TRANSACCIÓN</h2>
              </div>
      <fieldset className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" disabled={pending}>
        <Field label="Fecha">
          <input
            type="date"
            required
            max={today}
            value={state.date}
            onChange={(e) => setState((s) => ({ ...s, date: e.target.value }))}
            className={inputClass}
          />
        </Field>

        <Field label="Cuenta bancaria">
          <select
            value={state.bankAccountId}
            onChange={(e) => setState((s) => ({ ...s, bankAccountId: e.target.value }))}
            className={inputClass}
          >
            <option value="">— ninguna (evento no bancario) —</option>
            {choices.bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName} · {b.accountNumber}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Proveedor (texto crudo)">
          <input
            type="text"
            required
            list="vendor-suggestions"
            value={state.vendorRaw}
            onChange={(e) => setState((s) => ({ ...s, vendorRaw: e.target.value }))}
            placeholder="Tal como aparece en la factura / comprobante"
            className={inputClass}
          />
          <datalist id="vendor-suggestions">
            {choices.partnerSuggestions.map((p) => (
              <option key={`p-${p.id}`} value={p.name} />
            ))}
            {choices.vendorHistory.map((v, i) => (
              <option key={`h-${i}`} value={v} />
            ))}
          </datalist>
        </Field>

        <Field label="Socio (vínculo opcional)">
          <select
            value={state.partnerId}
            onChange={(e) => setState((s) => ({ ...s, partnerId: e.target.value }))}
            className={inputClass}
          >
            <option value="">— sin vínculo —</option>
            {choices.partnerSuggestions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="mt-6" disabled={pending}>
        <legend className="text-foreground/60 text-[10px] font-medium tracking-wide uppercase">
          Montos (GTQ; tasa de IVA {(ivaRate * 100).toFixed(0)}%)
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={`Con IVA${activeAmount === "conIva" ? " · primario" : ""}`}>
            <input
              type="text"
              inputMode="decimal"
              value={state.amountConIvaGtq}
              onChange={(e) => setAmount("conIva", e.target.value)}
              onFocus={() => setActiveAmount("conIva")}
              className={inputClass}
            />
          </Field>
          <Field label={`Sin IVA${activeAmount === "sinIva" ? " · primario" : ""}`}>
            <input
              type="text"
              inputMode="decimal"
              value={state.amountSinIvaGtq}
              onChange={(e) => setAmount("sinIva", e.target.value)}
              onFocus={() => setActiveAmount("sinIva")}
              className={inputClass}
            />
          </Field>
          <Field label={`IVA${activeAmount === "iva" ? " · primario" : ""}`}>
            <input
              type="text"
              inputMode="decimal"
              value={state.ivaAmountGtq}
              onChange={(e) => setAmount("iva", e.target.value)}
              onFocus={() => setActiveAmount("iva")}
              className={inputClass}
            />
          </Field>
        </div>
        <p className="text-foreground/50 mt-2 text-xs">
          Escribe cualquiera; los otros dos se recalculan. La reconstrucción USD usa
          sin-IVA ÷ tipo de cambio (en vivo abajo).
        </p>
      </fieldset>

      <fieldset className="border-foreground/10 mt-6 rounded-xl border bg-background/50 p-4" disabled={pending}>
        <legend className="text-foreground/60 px-2 text-[10px] font-medium tracking-wide uppercase">
          Tipo de cambio
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="GTQ por USD">
            <input
              type="text"
              inputMode="decimal"
              value={state.exchangeRate}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  exchangeRate: e.target.value,
                  exchangeRateOverridden: true,
                }))
              }
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2 text-foreground/70 text-xs">
            <p>
              {resolvedRate != null ? (
                <>
                  Resuelto desde <Source rate={resolvedRate} />
                  {resolvedRate.isStale ? " (respaldo desactualizado)" : ""}.
                </>
              ) : (
                "Resolviendo…"
              )}
            </p>
            <p className="text-foreground mt-1 text-sm font-semibold tabular-nums">
              USD reconstruido: {formatUsd(usdReconstructed)}
            </p>
          </div>
        </div>
        {state.exchangeRateOverridden ? (
          <Field className="mt-3" label="Motivo del override (obligatorio cuando el override está activo)">
            <input
              type="text"
              required={state.exchangeRateOverridden}
              value={state.exchangeRateOverrideReason}
              onChange={(e) =>
                setState((s) => ({ ...s, exchangeRateOverrideReason: e.target.value }))
              }
              placeholder="ej. tasa publicada difiere del caché BANGUAT"
              className={inputClass}
            />
          </Field>
        ) : null}
        {state.exchangeRateOverridden && resolvedRate != null ? (
          <button
            type="button"
            className="text-foreground/60 hover:text-foreground mt-2 text-xs underline"
            onClick={() =>
              setState((s) => ({
                ...s,
                exchangeRate: resolvedRate.rateGtqPerUsd,
                exchangeRateOverridden: false,
                exchangeRateOverrideReason: "",
              }))
            }
          >
            Restaurar tasa resuelta
          </button>
        ) : null}
      </fieldset>

      <fieldset className="mt-6" disabled={pending}>
        <Field label="Descripción">
          <textarea
            required
            rows={3}
            value={state.description}
            onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
            placeholder="ej. FEE DE DESARROLLO DEL PROYECTO SANTA ELENA, MES DE MAYO 2026"
            className={inputClass}
          />
        </Field>
      </fieldset>

      <fieldset className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3" disabled={pending}>
        <Field label="Partición (L1)">
          <select
            required
            value={state.partitionId}
            onChange={(e) =>
              setState((s) => ({ ...s, partitionId: e.target.value, categoryId: "", subItemId: "" }))
            }
            className={inputClass}
          >
            <option value="">— elige —</option>
            {choices.partitions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Categoría (L2)">
          <select
            required
            disabled={state.partitionId === ""}
            value={state.categoryId}
            onChange={(e) => setState((s) => ({ ...s, categoryId: e.target.value, subItemId: "" }))}
            className={inputClass}
          >
            <option value="">— elige —</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Partida interna (L3, opcional)">
          <select
            disabled={state.categoryId === "" || filteredSubItems.length === 0}
            value={state.subItemId}
            onChange={(e) => setState((s) => ({ ...s, subItemId: e.target.value }))}
            className={inputClass}
          >
            <option value="">— ninguna —</option>
            {filteredSubItems.map((si) => (
              <option key={si.id} value={si.id}>
                {si.code} — {si.description}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-foreground text-background disabled:bg-zinc-300 disabled:text-zinc-500 rounded-md px-4 py-2 text-sm font-medium"
        >
          {pending ? "Enviando…" : "Enviar"}
        </button>
        {error != null ? (
          <span role="alert" className="text-xs text-red-700">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

// ── Local helpers ───────────────────────────────────────────────────────────

const inputClass =
  "border-foreground/10 focus:ring-foreground/40 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:bg-zinc-50 disabled:text-zinc-500";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-foreground/60 text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function Source({ rate }: { rate: ResolvedRate }) {
  return (
    <span className="font-medium">
      {rate.source} {rate.date}
      {rate.requestedDate !== rate.date ? ` (solicitado para ${rate.requestedDate})` : ""}
    </span>
  );
}

function primaryFieldKey(field: ActiveAmount): "amountConIvaGtq" | "amountSinIvaGtq" | "ivaAmountGtq" {
  switch (field) {
    case "conIva":
      return "amountConIvaGtq";
    case "sinIva":
      return "amountSinIvaGtq";
    case "iva":
      return "ivaAmountGtq";
  }
}

function normalizeDecimal(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "0";
  const n = Number(trimmed);
  return Number.isFinite(n) ? n.toString() : trimmed;
}
