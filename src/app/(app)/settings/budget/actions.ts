"use server";

/**
 * Budget category override action — Batch 17.
 *
 * Admin path for adjusting a `BudgetCategory.budgetAmountUsd`. Each edit
 * lands a typed AuditLog row with the old/new values and the human-provided
 * reason. Per `feedback_rbac_approach` the gate is the central `can()`
 * against `budget_category` UPDATE.
 *
 * Reason is REQUIRED — D27 + the budget table is the contract with
 * the CEO; changes need an explanation in the trail.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { can } from "@/lib/rbac/matrix";

const DECIMAL_STR = /^-?\d+(?:\.\d+)?$/;

const inputSchema = z.object({
  id: z.string().uuid(),
  newBudgetUsd: z.string().regex(DECIMAL_STR, "Amount must be a decimal"),
  reason: z.string().trim().min(1, "Reason is required").max(2000),
});

export type UpdateBudgetInput = z.infer<typeof inputSchema>;

export type UpdateBudgetResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "not_found" | "invalid" | "internal"; message: string };

export async function updateBudgetCategoryAction(
  input: UpdateBudgetInput,
): Promise<UpdateBudgetResult> {
  const { user, role } = await requireRole();
  if (!can(role, "UPDATE", "budget_category")) {
    return {
      ok: false,
      error: "forbidden",
      message: `Role ${role} cannot update budget categories.`,
    };
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", message: zodIssues(parsed.error) };
  }
  const data = parsed.data;

  const existing = await prisma.budgetCategory.findFirst({
    where: { id: data.id, deletedAt: null },
    select: { id: true, code: true, budgetAmountUsd: true },
  });
  if (existing == null) {
    return { ok: false, error: "not_found", message: "Category not found." };
  }

  const newValue = Number(data.newBudgetUsd);
  if (!Number.isFinite(newValue) || newValue < 0) {
    return { ok: false, error: "invalid", message: "Budget must be a non-negative number." };
  }
  const oldValue = existing.budgetAmountUsd.toString();
  if (oldValue === data.newBudgetUsd) {
    return { ok: true }; // no-op, no audit row
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.budgetCategory.update({
        where: { id: data.id },
        data: { budgetAmountUsd: data.newBudgetUsd },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          entityType: "BudgetCategory",
          entityId: data.id,
          action: "UPDATE",
          fieldName: "budgetAmountUsd",
          oldValue,
          newValue: data.newBudgetUsd,
          context: `Settings budget override · ${existing.code} · ${data.reason}`,
        },
      });
    });
  } catch (err) {
    return {
      ok: false,
      error: "internal",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  revalidatePath("/settings/budget");
  revalidatePath(`/category/${existing.code}`);
  revalidatePath("/");
  return { ok: true };
}

function zodIssues(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}
