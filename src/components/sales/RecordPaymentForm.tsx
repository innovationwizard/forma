"use client";

/**
 * Manual RvPayment entry from `/sales/[id]` — Batch 15.
 *
 * Separate from `/inbox/[id]` (Batch 13b) which classifies a bank-tx into
 * an RvPayment. This form is for ad-hoc / out-of-band payments without a
 * bank-statement source (cash, payments not yet on a statement, etc.).
 *
 * GTQ + USD pair: enter either one, the other auto-derives via the supplied
 * exchange rate (default = project locked TC).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { recordPaymentAction } from "@/app/(app)/sales/[id]/actions";
import { formatUsd } from "@/lib/format";

interface RecordPaymentFormProps {
  unitId: string;
  lockedExchangeRate: string;
  canMutate: boolean;
}

type ActiveSide = "usd" | "gtq";

export function RecordPaymentForm({
  unitId,
  lockedExchangeRate,
  canMutate,
}: RecordPaymentFormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [paymentDate, setPaymentDate] = useState(today);
  const [side, setSide] = useState<ActiveSide>("usd");
  const [amountUsd, setAmountUsd] = useState<string>("");
  const [amountGtq, setAmountGtq] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState<string>(lockedExchangeRate);
  const [notes, setNotes] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  /// Derive the opposite currency in the change handler — keeps the
  /// pair consistent without a setState-in-effect anti-pattern.
  function updateUsd(raw: string) {
    setSide("usd");
    setAmountUsd(raw);
    const tc = Number(exchangeRate);
    const n = Number(raw);
    if (Number.isFinite(tc) && tc > 0 && Number.isFinite(n)) {
      setAmountGtq((n * tc).toFixed(2));
    }
  }

  function updateGtq(raw: string) {
    setSide("gtq");
    setAmountGtq(raw);
    const tc = Number(exchangeRate);
    const n = Number(raw);
    if (Number.isFinite(tc) && tc > 0 && Number.isFinite(n)) {
      setAmountUsd((n / tc).toFixed(2));
    }
  }

  function updateRate(raw: string) {
    setExchangeRate(raw);
    const tc = Number(raw);
    if (!Number.isFinite(tc) || tc <= 0) return;
    if (side === "usd") {
      const n = Number(amountUsd);
      if (Number.isFinite(n)) setAmountGtq((n * tc).toFixed(2));
    } else {
      const n = Number(amountGtq);
      if (Number.isFinite(n)) setAmountUsd((n / tc).toFixed(2));
    }
  }

  if (!canMutate) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await recordPaymentAction({
        id: unitId,
        paymentDate,
        amountUsd: amountUsd === "" ? "0" : amountUsd,
        amountGtq: amountGtq === "" ? "0" : amountGtq,
        exchangeRateUsed: exchangeRate,
        notes: notes.trim() === "" ? null : notes.trim(),
      });
      if (!result.ok) setError(result.message);
      else {
        setAmountUsd("");
        setAmountGtq("");
        setNotes("");
        router.refresh();
      }
    });
  }

  const usdDisplay = Number(amountUsd) > 0 ? formatUsd(amountUsd) : "—";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-foreground/60 text-xs">
        Manual entry — for payments without a bank-statement source. Use the
        Inbox flow when the payment already exists as a bank transaction.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-foreground/60 text-[10px] font-medium tracking-wide uppercase">
            Payment date
          </span>
          <input
            type="date"
            required
            max={today}
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            disabled={pending}
            className="border-foreground/10 focus:ring-foreground/40 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-foreground/60 text-[10px] font-medium tracking-wide uppercase">
            GTQ → USD rate
          </span>
          <input
            type="text"
            inputMode="decimal"
            required
            value={exchangeRate}
            onChange={(e) => updateRate(e.target.value)}
            disabled={pending}
            className="border-foreground/10 focus:ring-foreground/40 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-foreground/60 text-[10px] font-medium tracking-wide uppercase">
            Amount USD {side === "usd" ? "· primary" : ""}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={amountUsd}
            onChange={(e) => updateUsd(e.target.value)}
            onFocus={() => setSide("usd")}
            disabled={pending}
            className="border-foreground/10 focus:ring-foreground/40 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-foreground/60 text-[10px] font-medium tracking-wide uppercase">
            Amount GTQ {side === "gtq" ? "· primary" : ""}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={amountGtq}
            onChange={(e) => updateGtq(e.target.value)}
            onFocus={() => setSide("gtq")}
            disabled={pending}
            className="border-foreground/10 focus:ring-foreground/40 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-foreground/60 text-[10px] font-medium tracking-wide uppercase">
          Notes (optional)
        </span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. cash payment 2026-05-28, receipt #..."
          disabled={pending}
          className="border-foreground/10 focus:ring-foreground/40 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2"
        />
      </label>

      <div className="text-foreground/60 text-xs">
        Will record: <strong className="text-foreground tabular-nums">{usdDisplay}</strong>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-foreground text-background disabled:bg-zinc-300 disabled:text-zinc-500 rounded-md px-3 py-1.5 text-xs font-medium"
        >
          {pending ? "Recording…" : "Record payment"}
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
