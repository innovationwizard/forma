"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateProjectRatesAction } from "@/app/(app)/settings/rates/actions";

interface ProjectRatesFormProps {
  initialLockedExchangeRate: string;
  initialIvaRate: string;
  canEdit: boolean;
}

export function ProjectRatesForm({
  initialLockedExchangeRate,
  initialIvaRate,
  canEdit,
}: ProjectRatesFormProps) {
  const [tc, setTc] = useState(initialLockedExchangeRate);
  const [iva, setIva] = useState(initialIvaRate);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canEdit) {
    return (
      <p className="text-foreground/60 text-xs">
        Your role is read-only. Server enforces this; mutation requests would
        return <code>403 forbidden</code>.
      </p>
    );
  }

  const dirty = tc !== initialLockedExchangeRate || iva !== initialIvaRate;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateProjectRatesAction({
        lockedExchangeRate: tc !== initialLockedExchangeRate ? tc : null,
        ivaRate: iva !== initialIvaRate ? iva : null,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Locked exchange rate (GTQ per USD)">
          <input
            type="text"
            inputMode="decimal"
            value={tc}
            onChange={(e) => setTc(e.target.value)}
            disabled={pending}
            className={inputClass}
          />
        </Field>
        <Field label="IVA rate (fractional, e.g. 0.12 = 12%)">
          <input
            type="text"
            inputMode="decimal"
            value={iva}
            onChange={(e) => setIva(e.target.value)}
            disabled={pending}
            className={inputClass}
          />
        </Field>
      </div>
      {dirty ? (
        <Field label="Reason (required — these rates are foundational)">
          <input
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
            placeholder="e.g. BANGUAT publish + Federico sign-off"
            className={inputClass}
          />
        </Field>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || pending || reason.trim().length === 0}
          className="bg-foreground text-background disabled:bg-zinc-300 disabled:text-zinc-500 rounded-md px-3 py-1.5 text-xs font-medium"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {error != null ? (
          <span role="alert" className="text-xs text-red-700">
            {error}
          </span>
        ) : null}
        {saved && !dirty && error == null ? (
          <span role="status" className="text-xs text-emerald-700">
            Saved.
          </span>
        ) : null}
      </div>
    </form>
  );
}

const inputClass =
  "border-foreground/10 focus:ring-foreground/40 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2";

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
