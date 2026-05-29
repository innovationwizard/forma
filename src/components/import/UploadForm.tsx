"use client";

/**
 * Bank-statement upload form.
 *
 * Single file input + submit button. Client component for the standard
 * useTransition + inline error pattern. The server-side `uploadBankStatementAction`
 * is the authoritative gate (can() check + extension + size validation).
 *
 * Success path = server redirect to `/import/[id]`; we never see ok:true.
 */

import { useRef, useState, useTransition } from "react";

import { uploadBankStatementAction } from "@/app/(app)/import/new/actions";

export function UploadForm() {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = formRef.current;
    if (form == null) return;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await uploadBankStatementAction(formData);
      // Success path = server-side redirect throws NEXT_REDIRECT; we never
      // see ok:true here. Any return means failure.
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      encType="multipart/form-data"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <div>
        <h2 className="text-foreground text-base font-semibold">CARGAR ESTADO</h2>
              </div>
      <div className="mt-5 flex flex-col gap-3">
        <label className="border-foreground/15 hover:border-foreground/30 flex cursor-pointer flex-col items-start gap-1 rounded-lg border border-dashed bg-background/50 p-4">
          <span className="text-foreground/70 text-xs font-medium tracking-wide uppercase">
            Archivo
          </span>
          <input
            type="file"
            name="file"
            required
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            disabled={pending}
            className="text-foreground/80 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-background"
          />
          {fileName != null ? (
            <span className="text-foreground/60 mt-1 text-xs">Seleccionado: {fileName}</span>
          ) : null}
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || fileName == null}
            className="bg-foreground text-background disabled:bg-zinc-300 disabled:text-zinc-500 rounded-md px-4 py-2 text-sm font-medium"
          >
            {pending ? "Importando…" : "Subir + importar"}
          </button>
          {error != null ? (
            <span role="alert" className="text-xs text-red-700">
              {error}
            </span>
          ) : null}
        </div>
      </div>

    </form>
  );
}
