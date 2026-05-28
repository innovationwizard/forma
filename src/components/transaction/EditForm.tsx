"use client";

/**
 * Edit form for vendor name + description.
 *
 * Client component because we need `useTransition` + `useState` to show
 * the pending state and inline error feedback. The mutation itself runs
 * server-side via `editExpenditureAction` — the form is just a UI shell
 * around that. Per `feedback_rbac_approach` we DO NOT do role checks
 * here: the server action is the authoritative gate. If a CEO somehow
 * loads this component (they shouldn't — `canEdit` is passed from the
 * server), the action will still reject with `error: "forbidden"`.
 *
 * Renders nothing for roles without UPDATE access — `canEdit=false` from
 * the page hides the form entirely. The button-not-shown story is the
 * UI half of defense-in-depth; the action's `can()` check is the gate.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { editExpenditureAction } from "@/app/(app)/transaction/[id]/actions";

interface EditFormProps {
  id: string;
  initialVendorRaw: string;
  initialDescription: string;
  canEdit: boolean;
}

export function EditForm({
  id,
  initialVendorRaw,
  initialDescription,
  canEdit,
}: EditFormProps) {
  const [vendor, setVendor] = useState(initialVendorRaw);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!canEdit) {
    return (
      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-base font-semibold">EDITAR</h2>
          <p className="text-foreground/40 text-[10px] italic">(Modificar proveedor y descripción)</p>
        </div>
        <p className="text-foreground/60 mt-2 text-sm">
          Tu rol puede ver esta transacción pero no editarla.
        </p>
      </section>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await editExpenditureAction({
        id,
        vendorRaw: vendor,
        description,
      });
      if (result.ok) {
        setSavedAt(Date.now());
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  const dirty =
    vendor !== initialVendorRaw || description !== initialDescription;

  return (
    <section
      aria-labelledby="tx-edit-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <div>
        <h2 id="tx-edit-title" className="text-foreground text-base font-semibold">
          EDITAR
        </h2>
        <p className="text-foreground/40 text-[10px] italic">
          (Modificar proveedor y descripción)
        </p>
      </div>
      <p className="text-foreground/50 mt-1 text-xs">
        Solo proveedor y descripción. La recategorización vive en Ajustes.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <Field label="Proveedor (texto crudo)">
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            disabled={pending}
            className="border-foreground/10 focus:ring-foreground/40 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
        </Field>

        <Field label="Descripción">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={pending}
            rows={4}
            className="border-foreground/10 focus:ring-foreground/40 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
        </Field>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!dirty || pending}
            className="bg-foreground text-background disabled:bg-zinc-300 disabled:text-zinc-500 rounded-md px-4 py-2 text-sm font-medium"
          >
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
          {error != null ? (
            <span className="text-xs text-red-700" role="alert">
              {error}
            </span>
          ) : null}
          {savedAt != null && error == null ? (
            <span className="text-xs text-emerald-700" role="status">
              Guardado.
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}

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
