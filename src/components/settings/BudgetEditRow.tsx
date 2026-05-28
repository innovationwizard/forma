"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateBudgetCategoryAction } from "@/app/(app)/settings/budget/actions";
import { formatUsd } from "@/lib/format";

interface BudgetEditRowProps {
  id: string;
  code: string;
  name: string;
  budgetUsd: string;
  canEdit: boolean;
}

export function BudgetEditRow({ id, code, name, budgetUsd, canEdit }: BudgetEditRowProps) {
  const [value, setValue] = useState(budgetUsd);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = value !== budgetUsd;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateBudgetCategoryAction({
        id,
        newBudgetUsd: value,
        reason,
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
    <tr>
      <td className="text-foreground/60 py-2 pr-3 font-mono text-xs">{code}</td>
      <td className="text-foreground py-2 pr-3 text-sm">{name}</td>
      <td className="text-foreground/60 py-2 pr-3 text-right text-xs tabular-nums">
        {formatUsd(budgetUsd)}
      </td>
      <td className="py-2 pr-3">
        {canEdit ? (
          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
              className="border-foreground/10 focus:ring-foreground/40 w-32 rounded-md border bg-background px-2 py-1 text-right text-xs tabular-nums focus:outline-none focus:ring-2"
            />
            {dirty ? (
              <>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={pending}
                  placeholder="Motivo (obligatorio)"
                  className="border-foreground/10 focus:ring-foreground/40 w-48 rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2"
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
              <span role="alert" className="text-[10px] text-red-700">
                {error}
              </span>
            ) : null}
            {saved && !dirty && error == null ? (
              <span role="status" className="text-[10px] text-emerald-700">
                Guardado.
              </span>
            ) : null}
          </form>
        ) : (
          <span className="text-foreground/40 text-xs">solo lectura</span>
        )}
      </td>
    </tr>
  );
}
