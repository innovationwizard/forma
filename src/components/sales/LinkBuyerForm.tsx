"use client";

/**
 * Buyer-link form — Batch 15.
 *
 * Two modes:
 *   - Pick existing partner (dropdown)
 *   - Create new partner from name + optional taxId
 *
 * Per Gate 15.1: this is the "fill in data incomplete units" workflow.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { linkBuyerAction } from "@/app/(app)/sales/[id]/actions";

interface LinkBuyerFormProps {
  unitId: string;
  partnerSuggestions: Array<{ id: string; name: string }>;
  canMutate: boolean;
}

export function LinkBuyerForm({ unitId, partnerSuggestions, canMutate }: LinkBuyerFormProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [partnerId, setPartnerId] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const [newTaxId, setNewTaxId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canMutate) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await linkBuyerAction({
        id: unitId,
        partnerId: mode === "existing" && partnerId !== "" ? partnerId : null,
        newBuyerName: mode === "new" && newName.trim() !== "" ? newName.trim() : null,
        newBuyerTaxId: mode === "new" && newTaxId.trim() !== "" ? newTaxId.trim() : null,
      });
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="mode"
            value="existing"
            checked={mode === "existing"}
            onChange={() => setMode("existing")}
          />
          Elegir socio existente
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="mode"
            value="new"
            checked={mode === "new"}
            onChange={() => setMode("new")}
          />
          Crear nuevo socio
        </label>
      </div>

      {mode === "existing" ? (
        <select
          required
          value={partnerId}
          onChange={(e) => setPartnerId(e.target.value)}
          disabled={pending}
          className="border-foreground/10 focus:ring-foreground/40 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2"
        >
          <option value="">— elige un socio —</option>
          {partnerSuggestions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre legal completo del comprador"
            disabled={pending}
            className="border-foreground/10 focus:ring-foreground/40 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
          <input
            type="text"
            value={newTaxId}
            onChange={(e) => setNewTaxId(e.target.value)}
            placeholder="NIT (opcional)"
            disabled={pending}
            className="border-foreground/10 focus:ring-foreground/40 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-foreground text-background disabled:bg-zinc-300 disabled:text-zinc-500 rounded-md px-3 py-1.5 text-xs font-medium"
        >
          {pending ? "Vinculando…" : "Vincular comprador"}
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
