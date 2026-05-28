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
          ← Back to dashboard
        </Link>
        <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight">
          Import bank statement
        </h1>
        <p className="text-foreground/60 mt-1 text-sm">
          REFLUJO bronze ingestion: every row of every sheet captured verbatim.
          Silver promotion (deduplicated, signed amounts) happens automatically
          for the canonical sheet of each detected account. Twin-sheet decisions
          can be flipped on the import detail page.
        </p>
      </header>

      {canCreate ? (
        <UploadForm />
      ) : (
        <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
          <p className="text-foreground/70 text-sm">
            Your role ({role}) cannot upload bank statements. The server
            enforces this — submission requests are rejected with{" "}
            <code>403 forbidden</code>.
          </p>
        </section>
      )}
    </main>
  );
}
