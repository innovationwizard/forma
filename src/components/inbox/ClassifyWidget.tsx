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
    { id: "EXPENDITURE", label: "Expenditure (outflow)", visible: isOutflow },
    { id: "RV_PAYMENT", label: "RV Payment (inflow)", visible: isInflow },
    { id: "NON_BUSINESS", label: "Non-business", visible: true },
    { id: "SKIP", label: "Skip", visible: true },
  ];

  return (
    <section
      aria-labelledby="classify-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <h2 id="classify-title" className="text-foreground text-base font-semibold">
        Classify
      </h2>

      <nav className="border-foreground/10 mt-4 flex flex-wrap gap-1 border-b" aria-label="Classification path">
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
        Creates an <code>Expenditure</code> row linked back to this bank transaction.
        Source = <code>BANK_STATEMENT</code>, Status = <code>PENDING</code>. The
        bank-tx flips to <code>EXPENDITURE</code> classification.
      </p>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2" disabled={pending}>
        <Field label="Vendor (raw)">
          <input
            type="text"
            required
            value={vendorRaw}
            onChange={(e) => setVendorRaw(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Partner (optional link)">
          <select
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            className={inputClass}
          >
            <option value="">— unlinked —</option>
            {snapshot.expenditureChoices.partnerSuggestions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset disabled={pending}>
        <legend className="text-foreground/60 text-[10px] font-medium tracking-wide uppercase">
          Amounts (GTQ — IVA {(ivaRate * 100).toFixed(0)}%)
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={`Con IVA${activeAmount === "conIva" ? " · primary" : ""}`}>
            <input
              type="text"
              inputMode="decimal"
              value={conIva}
              onChange={(e) => setAmount("conIva", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={`Sin IVA${activeAmount === "sinIva" ? " · primary" : ""}`}>
            <input
              type="text"
              inputMode="decimal"
              value={sinIva}
              onChange={(e) => setAmount("sinIva", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={`IVA${activeAmount === "iva" ? " · primary" : ""}`}>
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
          USD reconstructed: <strong className="text-foreground tabular-nums">{formatUsd(sinIvaUsd)}</strong>{" "}
          (sin IVA ÷ TC {exchangeRate})
        </p>
      </fieldset>

      <Field label="Description">
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
        <Field label="L1 Partition">
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
            <option value="">— select —</option>
            {snapshot.expenditureChoices.partitions.map((p) => (
              <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="L2 Category">
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
            <option value="">— select —</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="L3 Sub-item (optional)">
          <select
            disabled={categoryId === "" || filteredSubItems.length === 0}
            value={subItemId}
            onChange={(e) => setSubItemId(e.target.value)}
            className={inputClass}
          >
            <option value="">— none —</option>
            {filteredSubItems.map((si) => (
              <option key={si.id} value={si.id}>{si.code} — {si.description}</option>
            ))}
          </select>
        </Field>
      </fieldset>

      <SubmitRow pending={pending} error={error} label="Save as Expenditure" />
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
        Creates an <code>RvPayment</code> row linking this inflow to a sold
        house. Reconciliation against the planned cuota schedule lands in
        Batch 13c — for now every new payment defaults to <code>UNMATCHED</code>.
      </p>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2" disabled={pending}>
        <Field label="Casa (sold unit)">
          <select
            required
            value={rvUnitId}
            onChange={(e) => setRvUnitId(e.target.value)}
            className={inputClass}
          >
            <option value="">— select —</option>
            {snapshot.rvUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.status === "SOLD" ? "(sold)" : `(${u.status.toLowerCase()})`}
                {u.buyer != null ? ` — ${u.buyer.name}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payment date">
          <input
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="GTQ → USD exchange rate">
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
            Amount USD: <strong className="text-foreground tabular-nums">{formatUsd(amountUsd)}</strong>
          </p>
          <p className="mt-1">
            Amount GTQ: <strong className="text-foreground tabular-nums">Q {amountGtq}</strong>
          </p>
        </div>
      </fieldset>

      <Field label="Notes (optional)">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={pending}
          className={inputClass}
        />
      </Field>

      <SubmitRow pending={pending} error={error} label="Save as RV Payment" />
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
        For events that don&apos;t belong in budget tracking (cross-account
        transfers, bank-charged fees, ISR retentions, etc.). Flips the
        bank-tx classification, no gold-side row created.
      </p>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2" disabled={pending}>
        <Field label="Kind">
          <select
            required
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className={inputClass}
          >
            <option value="INTERNAL_TRANSFER">Internal transfer (between own accounts)</option>
            <option value="INTEREST">Interest (NC PAGO INTERÉSES)</option>
            <option value="FEE">Bank fee</option>
            <option value="TAX">Tax (NOTA DEBITO ISR)</option>
            <option value="IGNORED">Ignored (other non-tracked event)</option>
          </select>
        </Field>
        <Field label="Note (required)">
          <input
            type="text"
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this classification?"
            className={inputClass}
          />
        </Field>
      </fieldset>

      <SubmitRow pending={pending} error={error} label={`Mark as ${kind.replace(/_/g, " ").toLowerCase()}`} />
    </form>
  );
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
        Keeps this transaction as <code>UNCLASSIFIED</code> but adds a note so
        a later reviewer (or you, on the next pass) knows why it was skipped.
      </p>
      <Field label="Why skip? (required)">
        <input
          type="text"
          required
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={pending}
          placeholder="e.g. needs Federico's input before I categorize"
          className={inputClass}
        />
      </Field>
      <SubmitRow pending={pending} error={error} label="Save note + skip" />
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
        {pending ? "Saving…" : label}
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
