"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateIsrObligationRateAction } from "@/app/(app)/settings/rates/actions";

interface IsrRateFormProps {
  id: string;
  uiLabel: string; // "ISR 18" or "ISR 25" verbatim per D34
  currentRate: string; // fractional, e.g. "0.18"
  canEdit: boolean;
}

export function IsrRateForm({ id, uiLabel, currentRate, canEdit }: IsrRateFormProps) {
  const [rate, setRate] = useState(currentRate);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = rate !== currentRate;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateIsrObligationRateAction({
        id,
        newRate: rate,
        reason: reason.trim(),
      });
      if (!result.ok) setError(result.message);
      else {
        setSaved(true);
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-foreground font-mono">{uiLabel}</span>
      {canEdit ? (
        <>
          <input
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            disabled={pending}
            className="border-foreground/10 focus:ring-foreground/40 w-24 rounded-md border bg-background px-2 py-1 text-right tabular-nums focus:outline-none focus:ring-2"
          />
          {dirty ? (
            <>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                placeholder="Motivo"
                className="border-foreground/10 focus:ring-foreground/40 w-48 rounded-md border bg-background px-2 py-1 focus:outline-none focus:ring-2"
              />
              <button
                type="submit"
                disabled={pending || reason.trim().length === 0}
                className="bg-foreground text-background disabled:bg-zinc-300 disabled:text-zinc-500 rounded-md px-2.5 py-1 text-[10px] font-medium"
              >
                {pending ? "Guardando…" : "Guardar"}
              </button>
            </>
          ) : null}
          {error != null ? (
            <span role="alert" className="text-red-700">
              {error}
            </span>
          ) : null}
          {saved && !dirty && error == null ? (
            <span role="status" className="text-emerald-700">
              Guardado.
            </span>
          ) : null}
        </>
      ) : (
        <span className="text-foreground/60 tabular-nums">{currentRate}</span>
      )}
    </form>
  );
}
