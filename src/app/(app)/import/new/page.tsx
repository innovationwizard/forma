/**
 * Bank-statement upload page — Batch 13a.
 *
 *   /import/new
 *
 * Server-component shell with the upload form. Role-gates BEFORE rendering
 * — CEO sees the view-only stub. Server action enforces independently.
 */

import Link from "next/link";

import { UploadForm } from "@/components/import/UploadForm";
import { requireRole } from "@/lib/dal";
import { can } from "@/lib/rbac/matrix";

export const dynamic = "force-dynamic";

export default async function NewImportPage() {
  const { role } = await requireRole();
  const canCreate = can(role, "CREATE", "bank_statement_import");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/"
          className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          ← Volver al tablero
        </Link>
        <div className="mt-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            IMPORTAR ESTADO BANCARIO
          </h1>
                  </div>
      </header>

      {canCreate ? (
        <UploadForm />
      ) : (
        <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
          <p className="text-foreground/70 text-sm">
            Tu rol ({role}) no puede cargar estados bancarios. El servidor lo aplica —
            los envíos se rechazan con <code>403 prohibido</code>.
          </p>
        </section>
      )}
    </main>
  );
}
