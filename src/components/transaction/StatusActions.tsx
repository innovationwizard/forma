"use client";

/**
 * Flag + Void controls for a transaction.
 *
 * Each button opens a single `window.prompt` for the reason (intentionally
 * minimal — a richer modal lands in Batch 17 settings). Blank reasons are
 * rejected client-side (no server call); empty-trim rejection also lives
 * in the server action as defense-in-depth.
 *
 * Client component for the same reasons as `EditForm`: `useTransition` +
 * inline error state. The server actions are the authoritative gate — a
 * CEO whose UI hides these buttons would still hit a `forbidden` response
 * if they crafted a request manually.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  flagExpenditureAction,
  voidExpenditureAction,
} from "@/app/(app)/transaction/[id]/actions";
import type { ActionResult } from "@/app/(app)/transaction/[id]/actions";

interface StatusActionsProps {
  id: string;
  currentStatus: "VERIFIED" | "PENDING" | "FLAGGED" | "VOIDED" | "ANULADO";
  canMutate: boolean;
}

export function StatusActions({ id, currentStatus, canMutate }: StatusActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canMutate) {
    return null; // Server-side `can()` is the real gate; UI just hides.
  }

  const isVoided = currentStatus === "VOIDED" || currentStatus === "ANULADO";
  const isFlagged = currentStatus === "FLAGGED";

  function promptAndRun(prompt: string, action: (reason: string) => Promise<ActionResult>) {
    const reason = window.prompt(prompt);
    if (reason == null) return;
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setError("El motivo no puede estar vacío.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await action(trimmed);
      if (!result.ok) {
        setError(result.message);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending || isFlagged}
        onClick={() =>
          promptAndRun("Motivo para marcar:", (reason) =>
            flagExpenditureAction({ id, reason }),
          )
        }
        className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200 ring-inset disabled:opacity-50"
      >
        {isFlagged ? "Ya marcada" : "Marcar para revisión"}
      </button>
      <button
        type="button"
        disabled={pending || isVoided}
        onClick={() =>
          promptAndRun("Motivo para anular:", (reason) =>
            voidExpenditureAction({ id, reason }),
          )
        }
        className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-900 ring-1 ring-red-200 ring-inset disabled:opacity-50"
      >
        {isVoided ? "Ya anulada" : "Anular"}
      </button>
      {error != null ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}
