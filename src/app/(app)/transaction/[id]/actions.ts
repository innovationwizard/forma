"use server";

/**
 * Server actions for Expenditure mutations — Batch 11.
 *
 * Three actions: `editExpenditureAction`, `flagExpenditureAction`,
 * `voidExpenditureAction`. Each follows the same shape:
 *
 *   1. `requireRole()` — re-verifies the JWT against Supabase signing keys
 *      and resolves the user's role from `app_metadata.role`. A forged
 *      client cannot lie here.
 *   2. `can(role, "UPDATE", "expenditure")` — central authorization gate.
 *      Per `feedback_rbac_approach`: all authorization decisions route
 *      through `can()`. NO inline role comparisons in this file.
 *   3. Mutation + AuditLog rows in ONE Prisma transaction. Either both
 *      land or neither does — the audit invariant survives crashes.
 *   4. `revalidatePath("/transaction/[id]")` so the detail page re-renders
 *      with fresh data on the next navigation.
 *
 * RLS note (honest disclosure): the app's Prisma connection uses the
 * `postgres` superuser role, which BYPASSES Postgres RLS. RLS policies
 * generated in Batch 4/4.5 are defense-in-depth for direct Supabase API
 * access (PostgREST) — they're tested by `pnpm verify:rls` but they do
 * NOT enforce here. The authoritative gate for these actions is the
 * `can()` check below.
 *
 * Editable fields (Batch 11 scope): `vendorRaw`, `description`. Both are
 * frequent cleanup targets per workbook inspection. Re-categorization,
 * partner re-linking, etc. are deferred to Batch 17 (Settings).
 */

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { can } from "@/lib/rbac/matrix";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "not_found" | "invalid"; message: string };

interface EditInput {
  id: string;
  vendorRaw?: string;
  description?: string;
}

export async function editExpenditureAction(input: EditInput): Promise<ActionResult> {
  const { user, role } = await requireRole();
  if (!can(role, "UPDATE", "expenditure")) {
    return {
      ok: false,
      error: "forbidden",
      message: `Role ${role} cannot UPDATE expenditure rows.`,
    };
  }

  // Validate input shape inline (no zod for a 2-field action).
  const vendorRaw = typeof input.vendorRaw === "string" ? input.vendorRaw.trim() : undefined;
  const description = typeof input.description === "string" ? input.description : undefined;
  if (vendorRaw != null && vendorRaw.length === 0) {
    return { ok: false, error: "invalid", message: "Vendor cannot be empty." };
  }

  const existing = await prisma.expenditure.findFirst({
    where: { id: input.id, deletedAt: null },
    select: { id: true, vendorRaw: true, description: true },
  });
  if (existing == null) {
    return { ok: false, error: "not_found", message: "Transaction not found." };
  }

  // Detect actual changes — no-op writes don't earn an audit row.
  const diffs: Array<{ field: "vendorRaw" | "description"; old: string; next: string }> = [];
  if (vendorRaw != null && vendorRaw !== existing.vendorRaw) {
    diffs.push({ field: "vendorRaw", old: existing.vendorRaw, next: vendorRaw });
  }
  if (description != null && description !== existing.description) {
    diffs.push({ field: "description", old: existing.description, next: description });
  }
  if (diffs.length === 0) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.expenditure.update({
      where: { id: input.id },
      data: {
        ...(vendorRaw != null ? { vendorRaw } : {}),
        ...(description != null ? { description } : {}),
      },
    });
    for (const d of diffs) {
      await tx.auditLog.create({
        data: {
          userId: user.id,
          entityType: "Expenditure",
          entityId: input.id,
          action: "UPDATE",
          fieldName: d.field,
          oldValue: d.old,
          newValue: d.next,
        },
      });
    }
  });

  revalidatePath(`/transaction/${input.id}`);
  return { ok: true };
}

interface FlagInput {
  id: string;
  reason: string;
}

export async function flagExpenditureAction(input: FlagInput): Promise<ActionResult> {
  const { user, role } = await requireRole();
  if (!can(role, "UPDATE", "expenditure")) {
    return {
      ok: false,
      error: "forbidden",
      message: `Role ${role} cannot flag expenditure rows.`,
    };
  }

  const reason = input.reason.trim();
  if (reason.length === 0) {
    return { ok: false, error: "invalid", message: "Flag reason cannot be empty." };
  }

  const existing = await prisma.expenditure.findFirst({
    where: { id: input.id, deletedAt: null },
    select: { id: true, status: true },
  });
  if (existing == null) {
    return { ok: false, error: "not_found", message: "Transaction not found." };
  }
  if (existing.status === "FLAGGED") return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.expenditure.update({
      where: { id: input.id },
      data: { status: "FLAGGED" },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        entityType: "Expenditure",
        entityId: input.id,
        action: "UPDATE",
        fieldName: "status",
        oldValue: existing.status,
        newValue: "FLAGGED",
        context: `Flagged: ${reason}`,
      },
    });
  });

  revalidatePath(`/transaction/${input.id}`);
  return { ok: true };
}

interface VoidInput {
  id: string;
  reason: string;
}

export async function voidExpenditureAction(input: VoidInput): Promise<ActionResult> {
  const { user, role } = await requireRole();
  // VOID is treated as an UPDATE in the matrix (soft state change, not a
  // hard delete). Per D21 we never hard-delete; VOIDED is the canonical
  // user-driven void status. ANULADO is reserved for xlsx-source data.
  if (!can(role, "UPDATE", "expenditure")) {
    return {
      ok: false,
      error: "forbidden",
      message: `Role ${role} cannot void expenditure rows.`,
    };
  }

  const reason = input.reason.trim();
  if (reason.length === 0) {
    return { ok: false, error: "invalid", message: "Void reason cannot be empty." };
  }

  const existing = await prisma.expenditure.findFirst({
    where: { id: input.id, deletedAt: null },
    select: { id: true, status: true },
  });
  if (existing == null) {
    return { ok: false, error: "not_found", message: "Transaction not found." };
  }
  if (existing.status === "VOIDED") return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.expenditure.update({
      where: { id: input.id },
      data: { status: "VOIDED" },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        entityType: "Expenditure",
        entityId: input.id,
        action: "VOID",
        fieldName: "status",
        oldValue: existing.status,
        newValue: "VOIDED",
        context: `Voided: ${reason}`,
      },
    });
  });

  revalidatePath(`/transaction/${input.id}`);
  return { ok: true };
}
