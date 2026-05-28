"use client";

/**
 * Classification widget — Batch 13b.
 *
 * Four tabs (Expenditure / RvPayment / Non-business / Skip) — each tab is a
 * focused form against its own server action. The widget is client-only for
 * the standard `useTransition` + tab-state + inline error pattern.
 *
 * Per `feedback_rbac_approach`: NO inline role checks. The server actions
 * are the authoritative gate; the UI just hides irrelevant tabs (RvPayment
 * tab hidden on outflows; Expenditure tab hidden on inflows) as a UX nicety.
 *
 * All four actions redirect server-side back to `/inbox` on success, so the
 * success path doesn't return ok:true; only failure returns a value here.
 */

import { useState, useTransition } from "react";

import {
  classifyAsExpenditureAction,
  classifyAsRvPaymentAction,
  markAsNonBusinessAction,
  skipClassificationAction,
} from "@/app/(app)/inbox/[id]/actions";
import { computeIvaTriple } from "@/lib/forms/iva";
import type { InboxItemSnapshot } from "@/lib/queries/inbox";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "EXPENDITURE" | "RV_PAYMENT" | "NON_BUSINESS" | "SKIP";

interface ClassifyWidgetProps {
  snapshot: InboxItemSnapshot;
}

export function ClassifyWidget({ snapshot }: ClassifyWidgetProps) {
  const tx = snapshot.transaction;
  const isInflow = tx.direction === "CREDIT";
  const isOutflow = tx.direction === "DEBIT";

  // Default tab: outflow → Expenditure; inflow → RvPayment; fallback → Skip.
  const [tab, setTab] = useState<Tab>(
    isOutflow ? "EXPENDITURE" : isInflow ? "RV_PAYMENT" : "SKIP",
  );

  const tabs: Array<{ id: Tab; label: string; visible: boolean }> = [
    { id: "EXPENDITURE", label: "Gasto (egreso)", visible: isOutflow },
    { id: "RV_PAYMENT", label: "Pago de casa (ingreso)", visible: isInflow },
    { id: "NON_BUSINESS", label: "No relacionado", visible: true },
    { id: "SKIP", label: "Omitir", visible: true },
  ];

  return (
    <section
      aria-labelledby="classify-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <div>
        <h2 id="classify-title" className="text-foreground text-base font-semibold">
          CLASIFICAR
        </h2>
        <p className="text-foreground/40 text-[10px] italic">(Asignar el movimiento)</p>
      </div>

      <nav className="border-foreground/10 mt-4 flex flex-wrap gap-1 border-b" aria-label="Ruta de clasificación">
        {tabs.filter((t) => t.visible).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-t-md px-3 py-2 text-xs font-medium",
              tab === t.id
                ? "border-foreground border-b-2 text-foreground"
                : "text-foreground/60 hover:text-foreground",
            )}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-4">
        {tab === "EXPENDITURE" && isOutflow ? <ExpenditureForm snapshot={snapshot} /> : null}
        {tab === "RV_PAYMENT" && isInflow ? <RvPaymentForm snapshot={snapshot} /> : null}
        {tab === "NON_BUSINESS" ? <NonBusinessForm snapshot={snapshot} /> : null}
        {tab === "SKIP" ? <SkipForm snapshot={snapshot} /> : null}
      </div>
    </section>
  );
}

// ── EXPENDITURE FORM ────────────────────────────────────────────────────────

function ExpenditureForm({ snapshot }: { snapshot: InboxItemSnapshot }) {
  const tx = snapshot.transaction;
  const ivaRate = Number(snapshot.expenditureChoices.ivaRate);
  // Outflow amount is negative-signed; we work with absolute GTQ for IVA.
  const absSignedGtq =
    tx.currency === "USD"
      ? Math.abs(Number(tx.amountSigned)) * Number(snapshot.lockedExchangeRate)
      : Math.abs(Number(tx.amountSigned));
  const initialTriple = computeIvaTriple("conIva", absSignedGtq, ivaRate);

  const [vendorRaw, setVendorRaw] = useState(deriveVendorFromDescription(tx.description));
  const [description, setDescription] = useState(tx.description);
  const [partnerId, setPartnerId] = useState<string>("");
  const [partitionId, setPartitionId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [subItemId, setSubItemId] = useState<string>("");
  const [conIva, setConIva] = useState(initialTriple.conIva);
  const [sinIva, setSinIva] = useState(initialTriple.sinIva);
  const [iva, setIva] = useState(initialTriple.iva);
  const [activeAmount, setActiveAmount] = useState<"conIva" | "sinIva" | "iva">("conIva");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const exchangeRate = snapshot.lockedExchangeRate;

  function setAmount(field: "conIva" | "sinIva" | "iva", raw: string) {
    setActiveAmount(field);
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) {
      if (field === "conIva") setConIva(raw);
      if (field === "sinIva") setSinIva(raw);
      if (field === "iva") setIva(raw);
      return;
    }
    const next = computeIvaTriple(field, n, ivaRate);
    setConIva(next.conIva);
    setSinIva(next.sinIva);
    setIva(next.iva);
  }

  const filteredCategories = snapshot.expenditureChoices.categories.filter(
    (c) => partitionId === "" || c.partitionId === partitionId,
  );
  const filteredSubItems = snapshot.expenditureChoices.subItems.filter(
    (si) => categoryId !== "" && si.categoryId === categoryId,
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await classifyAsExpenditureAction({
        bankTransactionId: tx.id,
        partitionId,
        categoryId,
        subItemId: subItemId === "" ? null : subItemId,
        partnerId: partnerId === "" ? null : partnerId,
        vendorRaw: vendorRaw.trim(),
        description,
        amountSinIvaGtq: normalizeDecimal(sinIva),
        amountConIvaGtq: normalizeDecimal(conIva),
        ivaAmountGtq: normalizeDecimal(iva),
        exchangeRate,
      });
      if (!result.ok) setError(result.message);
    });
  }

  const sinIvaUsd = (Number(normalizeDecimal(sinIva)) / Number(exchangeRate)).toFixed(2);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-foreground/60 text-xs">
        Crea un <code>Gasto</code> vinculado a esta transacción bancaria.
        Origen = <code>ESTADO BANCARIO</code>, Estado = <code>PENDIENTE</code>. La
        transacción bancaria cambia a clasificación <code>GASTO</code>.
      </p>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2" disabled={pending}>
        <Field label="Proveedor (texto crudo)">
          <input
            type="text"
            required
            value={vendorRaw}
            onChange={(e) => setVendorRaw(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Socio (vínculo opcional)">
          <select
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            className={inputClass}
          >
            <option value="">— sin vínculo —</option>
            {snapshot.expenditureChoices.partnerSuggestions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset disabled={pending}>
        <legend className="text-foreground/60 text-[10px] font-medium tracking-wide uppercase">
          Montos (GTQ — IVA {(ivaRate * 100).toFixed(0)}%)
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={`Con IVA${activeAmount === "conIva" ? " · primario" : ""}`}>
            <input
              type="text"
              inputMode="decimal"
              value={conIva}
              onChange={(e) => setAmount("conIva", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={`Sin IVA${activeAmount === "sinIva" ? " · primario" : ""}`}>
            <input
              type="text"
              inputMode="decimal"
              value={sinIva}
              onChange={(e) => setAmount("sinIva", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={`IVA${activeAmount === "iva" ? " · primario" : ""}`}>
            <input
              type="text"
              inputMode="decimal"
              value={iva}
              onChange={(e) => setAmount("iva", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <p className="text-foreground/50 mt-2 text-xs">
          USD reconstruido: <strong className="text-foreground tabular-nums">{formatUsd(sinIvaUsd)}</strong>{" "}
          (sin IVA ÷ TC {exchangeRate})
        </p>
      </fieldset>

      <Field label="Descripción">
        <textarea
          required
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={pending}
          className={inputClass}
        />
      </Field>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3" disabled={pending}>
        <Field label="Partición (L1)">
          <select
            required
            value={partitionId}
            onChange={(e) => {
              setPartitionId(e.target.value);
              setCategoryId("");
              setSubItemId("");
            }}
            className={inputClass}
          >
            <option value="">— elige —</option>
            {snapshot.expenditureChoices.partitions.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Categoría (L2)">
          <select
            required
            disabled={partitionId === ""}
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setSubItemId("");
            }}
            className={inputClass}
          >
            <option value="">— elige —</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Partida interna (L3, opcional)">
          <select
            disabled={categoryId === "" || filteredSubItems.length === 0}
            value={subItemId}
            onChange={(e) => setSubItemId(e.target.value)}
            className={inputClass}
          >
            <option value="">— ninguna —</option>
            {filteredSubItems.map((si) => (
              <option key={si.id} value={si.id}>{si.code} — {si.description}</option>
            ))}
          </select>
        </Field>
      </fieldset>

      <SubmitRow pending={pending} error={error} label="Guardar como gasto" />
    </form>
  );
}

// ── RV PAYMENT FORM ─────────────────────────────────────────────────────────

function RvPaymentForm({ snapshot }: { snapshot: InboxItemSnapshot }) {
  const tx = snapshot.transaction;
  const [rvUnitId, setRvUnitId] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState(tx.transactionDate);
  const [exchangeRateUsed, setExchangeRateUsed] = useState(snapshot.lockedExchangeRate);
  const [notes, setNotes] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tcNum = Number(exchangeRateUsed);
  const signed = Number(tx.amountSigned);
  const amountUsd =
    tx.currency === "USD"
      ? Math.abs(signed).toFixed(2)
      : tcNum > 0
        ? (Math.abs(signed) / tcNum).toFixed(2)
        : "0.00";
  const amountGtq =
    tx.currency === "USD"
      ? (Math.abs(signed) * tcNum).toFixed(2)
      : Math.abs(signed).toFixed(2);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await classifyAsRvPaymentAction({
        bankTransactionId: tx.id,
        rvUnitId,
        paymentDate: paymentDate === tx.transactionDate ? null : paymentDate,
        exchangeRateUsed: normalizeDecimal(exchangeRateUsed),
        notes: notes.trim() === "" ? null : notes.trim(),
      });
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-foreground/60 text-xs">
        Crea un <code>Pago de casa</code> vinculando este ingreso con una casa
        vendida. La conciliación contra el calendario planeado vive aparte
        en cada página de conciliación de la casa.
      </p>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2" disabled={pending}>
        <Field label="Casa (unidad vendida)">
          <select
            required
            value={rvUnitId}
            onChange={(e) => setRvUnitId(e.target.value)}
            className={inputClass}
          >
            <option value="">— elige —</option>
            {snapshot.rvUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.status === "SOLD" ? "(vendida)" : `(${u.status.toLowerCase()})`}
                {u.buyer != null ? ` — ${u.buyer.name}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha del pago">
          <input
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Tipo de cambio (GTQ → USD)">
          <input
            type="text"
            inputMode="decimal"
            required
            value={exchangeRateUsed}
            onChange={(e) => setExchangeRateUsed(e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="text-foreground/70 self-end text-xs">
          <p>
            Monto USD: <strong className="text-foreground tabular-nums">{formatUsd(amountUsd)}</strong>
          </p>
          <p className="mt-1">
            Monto GTQ: <strong className="text-foreground tabular-nums">Q {amountGtq}</strong>
          </p>
        </div>
      </fieldset>

      <Field label="Notas (opcional)">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={pending}
          className={inputClass}
        />
      </Field>

      <SubmitRow pending={pending} error={error} label="Guardar como pago de casa" />
    </form>
  );
}

// ── NON-BUSINESS FORM ───────────────────────────────────────────────────────

function NonBusinessForm({ snapshot }: { snapshot: InboxItemSnapshot }) {
  const tx = snapshot.transaction;
  const [kind, setKind] = useState<"INTERNAL_TRANSFER" | "INTEREST" | "FEE" | "TAX" | "IGNORED">(
    "INTERNAL_TRANSFER",
  );
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await markAsNonBusinessAction({
        bankTransactionId: tx.id,
        kind,
        note: note.trim(),
      });
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-foreground/60 text-xs">
        Para eventos que no pertenecen al seguimiento del presupuesto (transferencias
        entre cuentas propias, cargos del banco, retenciones de ISR, etc.).
        Cambia la clasificación de la transacción bancaria; no crea fila en el lado dorado.
      </p>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2" disabled={pending}>
        <Field label="Tipo">
          <select
            required
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className={inputClass}
          >
            <option value="INTERNAL_TRANSFER">Transferencia interna (entre cuentas propias)</option>
            <option value="INTEREST">Interés (NC PAGO INTERÉSES)</option>
            <option value="FEE">Cargo bancario</option>
            <option value="TAX">Impuesto (NOTA DEBITO ISR)</option>
            <option value="IGNORED">Ignorar (otro evento no rastreado)</option>
          </select>
        </Field>
        <Field label="Nota (obligatoria)">
          <input
            type="text"
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="¿Por qué esta clasificación?"
            className={inputClass}
          />
        </Field>
      </fieldset>

      <SubmitRow pending={pending} error={error} label={`Marcar como ${nonBusinessKindLabel(kind)}`} />
    </form>
  );
}

function nonBusinessKindLabel(k: string): string {
  switch (k) {
    case "INTERNAL_TRANSFER":
      return "transferencia interna";
    case "INTEREST":
      return "interés";
    case "FEE":
      return "cargo bancario";
    case "TAX":
      return "impuesto";
    case "IGNORED":
      return "ignorar";
    default:
      return k.toLowerCase().replace(/_/g, " ");
  }
}

// ── SKIP FORM ──────────────────────────────────────────────────────────────

function SkipForm({ snapshot }: { snapshot: InboxItemSnapshot }) {
  const tx = snapshot.transaction;
  const [note, setNote] = useState<string>(tx.classifierNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await skipClassificationAction({
        bankTransactionId: tx.id,
        note: note.trim(),
      });
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-foreground/60 text-xs">
        Mantiene esta transacción como <code>SIN CLASIFICAR</code> pero agrega una nota
        para que un revisor posterior (o tú, en la próxima pasada) sepa por qué se omitió.
      </p>
      <Field label="¿Por qué omitir? (obligatorio)">
        <input
          type="text"
          required
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
          placeholder="ej. requiere la opinión de Federico antes de categorizarla"
          className={inputClass}
        />
      </Field>
      <SubmitRow pending={pending} error={error} label="Guardar nota + omitir" />
    </form>
  );
}

// ── Small shared bits ──────────────────────────────────────────────────────

const inputClass =
  "border-foreground/10 focus:ring-foreground/40 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:bg-zinc-50 disabled:text-zinc-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-foreground/60 text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function SubmitRow({
  pending,
  error,
  label,
}: {
  pending: boolean;
  error: string | null;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background disabled:bg-zinc-300 disabled:text-zinc-500 rounded-md px-4 py-2 text-sm font-medium"
      >
        {pending ? "Guardando…" : label}
      </button>
      {error != null ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function normalizeDecimal(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "0";
  const n = Number(trimmed);
  return Number.isFinite(n) ? n.toString() : trimmed;
}

/// Best-effort vendor extraction from a bank description. G&T descriptions
/// like `"NC ORDEN DE PAGO"` or `"PAGO DE CHEQUE"` don't always carry a
/// vendor — we just pre-fill the whole description and let the user edit.
function deriveVendorFromDescription(desc: string): string {
  return desc.trim();
}
