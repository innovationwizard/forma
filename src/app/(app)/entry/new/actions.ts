"use server";

/**
 * Server actions for manual transaction entry — Batch 12.
 *
 * Two actions:
 *   - `resolveRateAction(date)`           — wraps Batch 9 resolver for the
 *     client to look up GTQ→USD on demand without exposing Prisma to the
 *     browser. Read-only; no `can()` check (every authenticated role can
 *     read exchange rates per the matrix).
 *   - `createExpenditureAction(input)`    — atomic Expenditure + AuditLog
 *     insert. Per `feedback_rbac_approach` the gate is `can(role,
 *     "CREATE", "expenditure")` — central, not inline. CEO is denied.
 *
 * Validation is via zod (already in deps from Batch 1). The shape mirrors
 * the form fields exactly. On success we redirect to the new row's L2
 * page so the analyst sees the audit trail immediately — satisfies the
 * Batch 12 acceptance criterion.
 *
 * Per Detalle egresos finding #1: amounts are always GTQ regardless of
 * which bank account paid. The bank's currency is a separate concern
 * (which account took the hit). USD reconstruction divides sin-IVA GTQ
 * by the per-tx TC or resolved rate.
 *
 * RLS note (unchanged from Batch 11): Prisma connects as `postgres` and
 * bypasses Postgres RLS. `can()` is the authoritative gate.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { resolveRate, type ResolvedRate } from "@/lib/exchange-rate/resolve";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { can } from "@/lib/rbac/matrix";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_STR = /^-?\d+(?:\.\d+)?$/;

const createInputSchema = z.object({
  date: z.string().regex(ISO_DATE, "Date must be YYYY-MM-DD"),
  vendorRaw: z.string().trim().min(1, "Vendor is required").max(255),
  partnerId: z.string().uuid().nullable(),
  bankAccountId: z.string().uuid().nullable(),
  amountConIvaGtq: z.string().regex(DECIMAL_STR, "Amount must be a decimal"),
  amountSinIvaGtq: z.string().regex(DECIMAL_STR, "Amount must be a decimal"),
  ivaAmountGtq: z.string().regex(DECIMAL_STR, "IVA must be a decimal"),
  description: z.string().trim().min(1, "Description is required").max(2000),
  partitionId: z.string().uuid(),
  categoryId: z.string().uuid(),
  subItemId: z.string().uuid().nullable(),
  exchangeRate: z.string().regex(DECIMAL_STR, "Exchange rate must be a decimal"),
  /// True when the user overrode the resolved rate — required to also
  /// supply `exchangeRateOverrideReason`. Drives an extra audit context line.
  exchangeRateOverridden: z.boolean(),
  exchangeRateOverrideReason: z.string().trim().nullable(),
});

export type CreateExpenditureInput = z.infer<typeof createInputSchema>;

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: "forbidden" | "invalid" | "internal"; message: string };

export async function createExpenditureAction(
  input: CreateExpenditureInput,
): Promise<CreateResult> {
  const { user, role } = await requireRole();
  if (!can(role, "CREATE", "expenditure")) {
    return {
      ok: false,
      error: "forbidden",
      message: `Role ${role} cannot create expenditure rows.`,
    };
  }

  const parsed = createInputSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return { ok: false, error: "invalid", message: issues };
  }
  const data = parsed.data;

  // Cross-field validation that zod can't express cleanly.
  if (data.exchangeRateOverridden) {
    if (data.exchangeRateOverrideReason == null || data.exchangeRateOverrideReason.length === 0) {
      return {
        ok: false,
        error: "invalid",
        message: "Override reason is required when overriding the resolved rate.",
      };
    }
  }
  const tcNum = Number(data.exchangeRate);
  if (!Number.isFinite(tcNum) || tcNum <= 0) {
    return { ok: false, error: "invalid", message: "Exchange rate must be a positive number." };
  }
  const sinIvaNum = Number(data.amountSinIvaGtq);
  if (!Number.isFinite(sinIvaNum)) {
    return { ok: false, error: "invalid", message: "Sin-IVA amount is invalid." };
  }
  // Verify partition + category match (defense against forged categoryId paired
  // with the wrong partition).
  const category = await prisma.budgetCategory.findFirst({
    where: { id: data.categoryId, partitionId: data.partitionId, deletedAt: null },
    select: { id: true },
  });
  if (category == null) {
    return {
      ok: false,
      error: "invalid",
      message: "Category does not belong to the selected partition.",
    };
  }
  if (data.subItemId != null) {
    const subItem = await prisma.budgetSubItem.findFirst({
      where: { id: data.subItemId, categoryId: data.categoryId, deletedAt: null },
      select: { id: true },
    });
    if (subItem == null) {
      return {
        ok: false,
        error: "invalid",
        message: "Sub-item does not belong to the selected category.",
      };
    }
  }

  const amountUsd = (sinIvaNum / tcNum).toFixed(2);

  try {
    const newId = await prisma.$transaction(async (tx) => {
      const created = await tx.expenditure.create({
        data: {
          date: new Date(`${data.date}T00:00:00Z`),
          vendorRaw: data.vendorRaw,
          partnerId: data.partnerId,
          bankAccountId: data.bankAccountId,
          amountConIva: data.amountConIvaGtq,
          amountSinIva: data.amountSinIvaGtq,
          ivaAmount: data.ivaAmountGtq,
          amountUsd,
          exchangeRate: data.exchangeRate,
          exchangeRateAtTransaction: data.exchangeRateOverridden ? data.exchangeRate : null,
          // currency = denomination of the bank account. Default to GTQ when
          // no bank account selected (cash flow / non-bank event).
          currency: await currencyForBank(tx, data.bankAccountId),
          description: data.description,
          descriptionNormalized: normalize(data.description),
          kind: "OPERATING_EXPENSE",
          partitionId: data.partitionId,
          categoryId: data.categoryId,
          subItemId: data.subItemId,
          source: "MANUAL",
          status: "PENDING",
          showOnDashboard: true,
          createdByUserId: user.id,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          entityType: "Expenditure",
          entityId: created.id,
          action: "CREATE",
          context: data.exchangeRateOverridden
            ? `Manual entry · TC override: ${data.exchangeRateOverrideReason}`
            : "Manual entry",
          newValue: JSON.stringify({
            date: data.date,
            vendor: data.vendorRaw,
            sinIvaGtq: data.amountSinIvaGtq,
            usd: amountUsd,
            tc: data.exchangeRate,
          }),
        },
      });
      return created.id;
    });

    // Revalidate the level 1 page so the new row appears + the L0 dashboard
    // so any health rollup updates land.
    const categoryRow = await prisma.budgetCategory.findUniqueOrThrow({
      where: { id: data.categoryId },
      select: { code: true },
    });
    revalidatePath(`/category/${categoryRow.code}`);
    revalidatePath("/");
    redirect(`/transaction/${newId}`);
  } catch (err) {
    // `redirect()` throws a NEXT_REDIRECT marker — let it propagate.
    if (err instanceof Error && err.message.startsWith("NEXT_REDIRECT")) throw err;
    return {
      ok: false,
      error: "internal",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function resolveRateAction(isoDate: string): Promise<{
  ok: true;
  rate: ResolvedRate;
} | { ok: false; message: string }> {
  if (!ISO_DATE.test(isoDate)) {
    return { ok: false, message: "Date must be YYYY-MM-DD." };
  }
  // No `can()` — exchange rates are READ-able by every role per the matrix.
  // `requireRole()` still runs so unauthenticated callers can't pull data.
  await requireRole();
  const project = await prisma.project.findFirstOrThrow({
    where: { deletedAt: null },
    select: { lockedExchangeRate: true },
  });
  const rate = await resolveRate(prisma, isoDate, {
    allowFetch: true,
    lockedExchangeRate: project.lockedExchangeRate.toString(),
  });
  return { ok: true, rate };
}

async function currencyForBank(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  bankAccountId: string | null,
): Promise<"GTQ" | "USD"> {
  if (bankAccountId == null) return "GTQ";
  const bank = await tx.bankAccount.findUnique({
    where: { id: bankAccountId },
    select: { currency: true },
  });
  return bank?.currency ?? "GTQ";
}

function normalize(s: string): string {
  return s.replace(/[\s ]+/g, " ").trim();
}
