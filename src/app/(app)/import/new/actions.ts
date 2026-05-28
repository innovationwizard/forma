"use server";

/**
 * Bank-statement upload server action — Batch 13a.
 *
 * Form posts a `File` (`.xls` or `.xlsx`). Action:
 *   1. `requireRole()` → resolves the authenticated user + role.
 *   2. `can(role, "CREATE", "bank_statement_import")` → ANALISTA + AUXILIAR
 *      pass per the matrix; CEO is denied with structured error.
 *   3. Validates file extension + size limit (10 MB).
 *   4. Delegates to `ingestBankStatement()` which handles the full bronze
 *      capture + silver promotion + DataQualityFlag emission in one Prisma
 *      transaction.
 *   5. On success: redirects to `/import/[id]` so the user lands on the
 *      detail page with the preview + twin-sheet toggle.
 *
 * Per the BankStatementImport.fileSha256 UNIQUE constraint, re-uploading
 * the same file by hash redirects to the existing import — no error, no
 * duplicate row.
 *
 * RLS note (unchanged): Prisma bypasses RLS; `can()` here is the gate.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { ingestBankStatement } from "@/lib/import/ingest";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { can } from "@/lib/rbac/matrix";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = new Set([".xls", ".xlsx"]);

export type UploadResult =
  | { ok: true; importId: string; redirected: true }
  | { ok: false; error: "forbidden" | "invalid" | "internal"; message: string };

export async function uploadBankStatementAction(formData: FormData): Promise<UploadResult> {
  const { user, role } = await requireRole();
  if (!can(role, "CREATE", "bank_statement_import")) {
    return {
      ok: false,
      error: "forbidden",
      message: `Role ${role} cannot upload bank statements.`,
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "invalid", message: "No file provided." };
  }
  if (file.size === 0) {
    return { ok: false, error: "invalid", message: "File is empty." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: "invalid",
      message: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit is 10 MB.`,
    };
  }
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: "invalid",
      message: `Unsupported extension "${ext}". Allowed: .xls, .xlsx.`,
    };
  }

  const buffer = await file.arrayBuffer();

  let result;
  try {
    result = await ingestBankStatement(prisma, {
      fileName: file.name,
      fileBuffer: buffer,
      uploadedByUserId: user.id,
    });
  } catch (err) {
    return {
      ok: false,
      error: "internal",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (!result.ok) {
    if (result.error === "duplicate_file") {
      // Friendly redirect to the existing import — same file, same content,
      // not really an error per the schema's UNIQUE intent.
      revalidatePath("/import");
      redirect(`/import/${result.existingImportId}?dup=1`);
    }
    return { ok: false, error: result.error, message: result.message };
  }

  revalidatePath("/import");
  redirect(`/import/${result.importId}`);
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}
