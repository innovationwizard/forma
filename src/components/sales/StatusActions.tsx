"use client";

/**
 * House status state-machine widget — Batch 15.
 *
 * Renders one button per legal next state. Each button opens a
 * `window.prompt` for the reason (intentionally minimal per the same
 * pattern as Batch 11's StatusActions; richer modal lands in Batch 17).
 *
 * Per `feedback_rbac_approach`: NO inline role checks. UI hides buttons
 * for view-only roles via `canMutate`; the server action is the gate.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { RvUnitStatus } from "@prisma/client";

import { updateHouseStatusAction } from "@/app/(app)/sales/[id]/actions";
import { allowedNextStatuses } from "@/lib/calc/sales-status";

interface StatusActionsProps {
  id: string;
  currentStatus: RvUnitStatus;
  canMutate: boolean;
}

const LABELS: Record<RvUnitStatus, string> = {
  AVAILABLE: "Marcar como Disponible",
  SOFT_HOLD: "Reserva tentativa",
  RESERVED: "Marcar como Reservada",
  FROZEN: "Congelar",
  SOLD: "Marcar como Vendida",
};

const STATUS_LABELS: Record<RvUnitStatus, string> = {
  AVAILABLE: "DISPONIBLE",
  SOFT_HOLD: "RESERVA TENTATIVA",
  RESERVED: "RESERVADA",
  FROZEN: "CONGELADA",
  SOLD: "VENDIDA",
};

export function StatusActions({ id, currentStatus, canMutate }: StatusActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canMutate) return null;

  const nextStates = allowedNextStatuses(currentStatus);
  if (nextStates.length === 0) {
    return (
      <p className="text-foreground/50 text-xs italic">
        El estado <strong>{STATUS_LABELS[currentStatus]}</strong> es terminal en la máquina de estados actual.
      </p>
    );
  }

  function run(to: RvUnitStatus) {
    const reason = window.prompt(`Motivo para cambiar a ${STATUS_LABELS[to]}:`);
    if (reason == null) return;
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setError("El motivo no puede estar vacío.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateHouseStatusAction({ id, toStatus: to, reason: trimmed });
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {nextStates.map((to) => (
        <button
          key={to}
          type="button"
          disabled={pending}
          onClick={() => run(to)}
          className="border-foreground/20 text-foreground hover:bg-zinc-50 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {LABELS[to]}
        </button>
      ))}
      {error != null ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}
