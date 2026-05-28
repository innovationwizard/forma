"use server";

/**
 * Rate-override actions — Batch 17.
 *
 *   - `updateProjectRatesAction({ lockedExchangeRate?, ivaRate? })`
 *   - `updateIsrObligationRateAction({ id, newRate, reason })`
 *
 * Per the matrix:
 *   - `project` UPDATE for ANALISTA (the project entity is small + sensitive)
 *   - `isr_obligation` UPDATE for ANALISTA
 * Both audited per D8.
 *
 * Reasons REQUIRED for both — these rates are foundational to every calc.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { can } from "@/lib/rbac/matrix";

const DECIMAL_STR = /^-?\d+(?:\.\d+)?$/;

const projectInputSchema = z.object({
  lockedExchangeRate: z.string().regex(DECIMAL_STR).nullable(),
  ivaRate: z.string().regex(DECIMAL_STR).nullable(),
  reason: z.string().trim().min(1).max(2000),
});

const isrInputSchema = z.object({
  id: z.string().uuid(),
  newRate: z.string().regex(DECIMAL_STR),
  reason: z.string().trim().min(1).max(2000),
});

export type UpdateProjectRatesInput = z.infer<typeof projectInputSchema>;
export type UpdateIsrRateInput = z.infer<typeof isrInputSchema>;

export type RatesActionResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "not_found" | "invalid" | "internal"; message: string };

export async function updateProjectRatesAction(
  input: UpdateProjectRatesInput,
): Promise<RatesActionResult> {
  const { user, role } = await requireRole();
  if (!can(role, "UPDATE", "project")) {
    return { ok: false, error: "forbidden", message: `Role ${role} cannot update project rates.` };
  }
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", message: zodIssues(parsed.error) };
  }
  const data = parsed.data;
  if (data.lockedExchangeRate == null && data.ivaRate == null) {
    return { ok: false, error: "invalid", message: "Must change at least one rate." };
  }

  const existing = await prisma.project.findFirstOrThrow({
    where: { deletedAt: null },
    select: { id: true, lockedExchangeRate: true, ivaRate: true },
  });

  try {
    await prisma.$transaction(async (tx) => {
      const changes: Array<{ field: string; old: string; next: string }> = [];
      const updates: Record<string, string> = {};
      if (data.lockedExchangeRate != null) {
        const oldVal = existing.lockedExchangeRate.toString();
        if (oldVal !== data.lockedExchangeRate) {
          updates["lockedExchangeRate"] = data.lockedExchangeRate;
          changes.push({ field: "lockedExchangeRate", old: oldVal, next: data.lockedExchangeRate });
        }
      }
      if (data.ivaRate != null) {
        const oldVal = existing.ivaRate.toString();
        if (oldVal !== data.ivaRate) {
          updates["ivaRate"] = data.ivaRate;
          changes.push({ field: "ivaRate", old: oldVal, next: data.ivaRate });
        }
      }
      if (changes.length === 0) return; // no-op
      await tx.project.update({ where: { id: existing.id }, data: updates });
      for (const c of changes) {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            entityType: "Project",
            entityId: existing.id,
            action: "UPDATE",
            fieldName: c.field,
            oldValue: c.old,
            newValue: c.next,
            context: `Settings rate override · ${data.reason}`,
          },
        });
      }
    });
  } catch (err) {
    return { ok: false, error: "internal", message: err instanceof Error ? err.message : String(err) };
  }

  revalidatePath("/settings/rates");
  revalidatePath("/");
  return { ok: true };
}

export async function updateIsrObligationRateAction(
  input: UpdateIsrRateInput,
): Promise<RatesActionResult> {
  const { user, role } = await requireRole();
  if (!can(role, "UPDATE", "isr_obligation")) {
    return { ok: false, error: "forbidden", message: `Role ${role} cannot update ISR obligations.` };
  }
  const parsed = isrInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", message: zodIssues(parsed.error) };
  }
  const data = parsed.data;

  const existing = await prisma.isrObligation.findFirst({
    where: { id: data.id, deletedAt: null },
    select: { id: true, uiLabel: true, rate: true },
  });
  if (existing == null) return { ok: false, error: "not_found", message: "ISR obligation not found." };

  const oldRate = existing.rate.toString();
  if (oldRate === data.newRate) return { ok: true };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.isrObligation.update({
        where: { id: data.id },
        data: { rate: data.newRate },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          entityType: "IsrObligation",
          entityId: data.id,
          action: "UPDATE",
          fieldName: "rate",
          oldValue: oldRate,
          newValue: data.newRate,
          context: `Settings ISR override · ${existing.uiLabel} · ${data.reason}`,
        },
      });
    });
  } catch (err) {
    return { ok: false, error: "internal", message: err instanceof Error ? err.message : String(err) };
  }

  revalidatePath("/settings/rates");
  revalidatePath("/");
  return { ok: true };
}

function zodIssues(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}
