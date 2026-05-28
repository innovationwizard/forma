"use server";

/**
 * Classification server actions — Batch 13b.
 *
 * Four actions, one per classification path. Each follows the Batch 11 shape:
 *
 *   1. `requireRole()` re-verifies the Supabase JWT.
 *   2. `can(role, action, resource)` is the authoritative gate.
 *   3. Mutation + status flip + AuditLog row in ONE Prisma transaction.
 *   4. `revalidatePath` so the inbox + dashboard reflect fresh counts.
 *
 * All four actions UPDATE the same BankTransaction.classificationStatus enum
 * value — so the matrix gates them through `can(role, "UPDATE", "bank_transaction")`.
 * Where a gold-side row is created (Expenditure or RvPayment), there's an
 * ADDITIONAL `can()` check for that resource's CREATE permission.
 *
 * RLS note (unchanged from Batches 11/12/13a): Prisma bypasses RLS; `can()`
 * is the authoritative gate.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { BankTransactionClassificationStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { can } from "@/lib/rbac/matrix";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_STR = /^-?\d+(?:\.\d+)?$/;
const UUID = z.string().uuid();

export type ClassifyResult =
  | { ok: true; redirected?: true }
  | { ok: false; error: "forbidden" | "not_found" | "invalid" | "internal"; message: string };

// ── 1. Classify as Expenditure (outflow → budget category) ─────────────────

const expenditureInputSchema = z.object({
  bankTransactionId: UUID,
  partitionId: UUID,
  categoryId: UUID,
  subItemId: UUID.nullable(),
  partnerId: UUID.nullable(),
  vendorRaw: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(2000),
  amountSinIvaGtq: z.string().regex(DECIMAL_STR),
  amountConIvaGtq: z.string().regex(DECIMAL_STR),
  ivaAmountGtq: z.string().regex(DECIMAL_STR),
  exchangeRate: z.string().regex(DECIMAL_STR),
});

export type ClassifyExpenditureInput = z.infer<typeof expenditureInputSchema>;

export async function classifyAsExpenditureAction(
  input: ClassifyExpenditureInput,
): Promise<ClassifyResult> {
  const { user, role } = await requireRole();
  if (!can(role, "UPDATE", "bank_transaction") || !can(role, "CREATE", "expenditure")) {
    return {
      ok: false,
      error: "forbidden",
      message: `Role ${role} cannot classify bank transactions as Expenditure.`,
    };
  }
  const parsed = expenditureInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", message: zodIssues(parsed.error) };
  }
  const data = parsed.data;

  const tx = await prisma.bankTransaction.findFirst({
    where: { id: data.bankTransactionId, deletedAt: null },
    select: {
      id: true,
      bankAccountId: true,
      transactionDate: true,
      amountSigned: true,
      currency: true,
      classificationStatus: true,
    },
  });
  if (tx == null) return { ok: false, error: "not_found", message: "Bank transaction not found." };
  if (tx.classificationStatus !== "UNCLASSIFIED") {
    return {
      ok: false,
      error: "invalid",
      message: `Already classified as ${tx.classificationStatus}; cannot re-classify.`,
    };
  }

  // Verify category ↔ partition coherence (matches the manual-entry guard).
  const category = await prisma.budgetCategory.findFirst({
    where: { id: data.categoryId, partitionId: data.partitionId, deletedAt: null },
    select: { id: true },
  });
  if (category == null) {
    return {
      ok: false,
      error: "invalid",
      message: "Selected category does not belong to selected partition.",
    };
  }

  const sinIvaNum = Number(data.amountSinIvaGtq);
  const tcNum = Number(data.exchangeRate);
  if (!Number.isFinite(tcNum) || tcNum <= 0) {
    return { ok: false, error: "invalid", message: "Exchange rate must be positive." };
  }
  const amountUsd = (sinIvaNum / tcNum).toFixed(2);

  try {
    await prisma.$transaction(async (txDb) => {
      const created = await txDb.expenditure.create({
        data: {
          date: tx.transactionDate,
          vendorRaw: data.vendorRaw,
          partnerId: data.partnerId,
          bankAccountId: tx.bankAccountId,
          amountConIva: data.amountConIvaGtq,
          amountSinIva: data.amountSinIvaGtq,
          ivaAmount: data.ivaAmountGtq,
          amountUsd,
          exchangeRate: data.exchangeRate,
          exchangeRateAtTransaction: null,
          currency: tx.currency,
          description: data.description,
          descriptionNormalized: normalize(data.description),
          kind: "OPERATING_EXPENSE",
          partitionId: data.partitionId,
          categoryId: data.categoryId,
          subItemId: data.subItemId,
          source: "BANK_STATEMENT",
          status: "PENDING",
          showOnDashboard: true,
          createdByUserId: user.id,
          sourceBankTransactionId: tx.id,
        },
        select: { id: true },
      });

      await txDb.bankTransaction.update({
        where: { id: tx.id },
        data: {
          classificationStatus: "EXPENDITURE",
          classifiedAt: new Date(),
          classifiedByUserId: user.id,
        },
      });

      // Two audit rows: one for the Expenditure creation + one for the
      // BankTransaction status flip. The two events are different in
      // entityType so they live as separate rows even though they're in
      // the same transaction.
      await txDb.auditLog.create({
        data: {
          userId: user.id,
          entityType: "Expenditure",
          entityId: created.id,
          action: "CREATE",
          context: `Inbox classification from BankTransaction ${tx.id}`,
          newValue: JSON.stringify({ sinIvaGtq: data.amountSinIvaGtq, usd: amountUsd }),
        },
      });
      await txDb.auditLog.create({
        data: {
          userId: user.id,
          entityType: "BankTransaction",
          entityId: tx.id,
          action: "UPDATE",
          fieldName: "classification_status",
          oldValue: "UNCLASSIFIED",
          newValue: "EXPENDITURE",
          context: `Classified as Expenditure (id=${created.id}) via /inbox`,
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

  revalidatePath("/inbox");
  revalidatePath("/");
  redirect("/inbox");
}

// ── 2. Classify as RvPayment (inflow → house installment) ──────────────────

const rvPaymentInputSchema = z.object({
  bankTransactionId: UUID,
  rvUnitId: UUID,
  /// Optional override of the date (defaults to the BankTransaction's date).
  paymentDate: z.string().regex(ISO_DATE).nullable(),
  /// Project locked TC when GTQ→USD reconstruction is needed. Required from
  /// the form (the page passes the live value down).
  exchangeRateUsed: z.string().regex(DECIMAL_STR),
  notes: z.string().trim().max(2000).nullable(),
});

export type ClassifyRvPaymentInput = z.infer<typeof rvPaymentInputSchema>;

export async function classifyAsRvPaymentAction(
  input: ClassifyRvPaymentInput,
): Promise<ClassifyResult> {
  const { user, role } = await requireRole();
  if (!can(role, "UPDATE", "bank_transaction") || !can(role, "CREATE", "rv_payment")) {
    return {
      ok: false,
      error: "forbidden",
      message: `Role ${role} cannot classify bank transactions as RV Payment.`,
    };
  }
  const parsed = rvPaymentInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", message: zodIssues(parsed.error) };
  }
  const data = parsed.data;

  const tx = await prisma.bankTransaction.findFirst({
    where: { id: data.bankTransactionId, deletedAt: null },
    select: {
      id: true,
      transactionDate: true,
      amountSigned: true,
      currency: true,
      classificationStatus: true,
    },
  });
  if (tx == null) return { ok: false, error: "not_found", message: "Bank transaction not found." };
  if (tx.classificationStatus !== "UNCLASSIFIED") {
    return {
      ok: false,
      error: "invalid",
      message: `Already classified as ${tx.classificationStatus}; cannot re-classify.`,
    };
  }
  const rvUnit = await prisma.rvUnit.findFirst({
    where: { id: data.rvUnitId, deletedAt: null },
    select: { id: true },
  });
  if (rvUnit == null) {
    return { ok: false, error: "invalid", message: "Selected RvUnit does not exist." };
  }

  const tcNum = Number(data.exchangeRateUsed);
  if (!Number.isFinite(tcNum) || tcNum <= 0) {
    return { ok: false, error: "invalid", message: "Exchange rate must be positive." };
  }
  const signed = Number(tx.amountSigned);
  if (signed <= 0) {
    return {
      ok: false,
      error: "invalid",
      message: "Only inflow (credit) transactions can be classified as RV Payment.",
    };
  }

  // Reconstruct GTQ + USD from the signed amount + tx currency.
  let amountUsd: string;
  let amountGtq: string;
  if (tx.currency === "USD") {
    amountUsd = signed.toFixed(2);
    amountGtq = (signed * tcNum).toFixed(2);
  } else {
    amountGtq = signed.toFixed(2);
    amountUsd = (signed / tcNum).toFixed(2);
  }
  const paymentDate = data.paymentDate ?? tx.transactionDate.toISOString().slice(0, 10);

  try {
    await prisma.$transaction(async (txDb) => {
      const created = await txDb.rvPayment.create({
        data: {
          rvUnitId: data.rvUnitId,
          bankTransactionId: tx.id,
          paymentDate: new Date(`${paymentDate}T00:00:00Z`),
          amountUsd,
          amountGtq,
          exchangeRateUsed: data.exchangeRateUsed,
          reconciliationStatus: "UNMATCHED",
          notes: data.notes,
          createdByUserId: user.id,
        },
        select: { id: true },
      });
      await txDb.bankTransaction.update({
        where: { id: tx.id },
        data: {
          classificationStatus: "RV_PAYMENT",
          classifiedAt: new Date(),
          classifiedByUserId: user.id,
        },
      });
      await txDb.auditLog.create({
        data: {
          userId: user.id,
          entityType: "RvPayment",
          entityId: created.id,
          action: "CREATE",
          context: `Inbox classification: BankTransaction ${tx.id} → house ${data.rvUnitId}`,
          newValue: JSON.stringify({ amountUsd, amountGtq, tc: data.exchangeRateUsed }),
        },
      });
      await txDb.auditLog.create({
        data: {
          userId: user.id,
          entityType: "BankTransaction",
          entityId: tx.id,
          action: "UPDATE",
          fieldName: "classification_status",
          oldValue: "UNCLASSIFIED",
          newValue: "RV_PAYMENT",
          context: `Classified as RvPayment (id=${created.id}) via /inbox`,
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

  revalidatePath("/inbox");
  revalidatePath("/");
  redirect("/inbox");
}

// ── 3. Mark as non-business (internal transfer / interest / fee / tax / ignored) ──

const nonBusinessInputSchema = z.object({
  bankTransactionId: UUID,
  kind: z.enum(["INTERNAL_TRANSFER", "INTEREST", "FEE", "TAX", "IGNORED"]),
  note: z.string().trim().min(1).max(2000),
});

export type MarkNonBusinessInput = z.infer<typeof nonBusinessInputSchema>;

export async function markAsNonBusinessAction(
  input: MarkNonBusinessInput,
): Promise<ClassifyResult> {
  const { user, role } = await requireRole();
  if (!can(role, "UPDATE", "bank_transaction")) {
    return {
      ok: false,
      error: "forbidden",
      message: `Role ${role} cannot update bank-transaction classification.`,
    };
  }
  const parsed = nonBusinessInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", message: zodIssues(parsed.error) };
  }
  const data = parsed.data;

  const tx = await prisma.bankTransaction.findFirst({
    where: { id: data.bankTransactionId, deletedAt: null },
    select: { id: true, classificationStatus: true },
  });
  if (tx == null) return { ok: false, error: "not_found", message: "Bank transaction not found." };
  if (tx.classificationStatus !== "UNCLASSIFIED") {
    return {
      ok: false,
      error: "invalid",
      message: `Already classified as ${tx.classificationStatus}; cannot re-classify.`,
    };
  }

  try {
    await prisma.$transaction(async (txDb) => {
      await txDb.bankTransaction.update({
        where: { id: tx.id },
        data: {
          classificationStatus: data.kind as BankTransactionClassificationStatus,
          classifiedAt: new Date(),
          classifiedByUserId: user.id,
          classifierNote: data.note,
        },
      });
      await txDb.auditLog.create({
        data: {
          userId: user.id,
          entityType: "BankTransaction",
          entityId: tx.id,
          action: "UPDATE",
          fieldName: "classification_status",
          oldValue: "UNCLASSIFIED",
          newValue: data.kind,
          context: `Marked as ${data.kind} via /inbox · ${data.note}`,
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

  revalidatePath("/inbox");
  redirect("/inbox");
}

// ── 4. Skip (keep UNCLASSIFIED + add note) ─────────────────────────────────

const skipInputSchema = z.object({
  bankTransactionId: UUID,
  note: z.string().trim().min(1).max(2000),
});

export async function skipClassificationAction(
  input: z.infer<typeof skipInputSchema>,
): Promise<ClassifyResult> {
  const { user, role } = await requireRole();
  if (!can(role, "UPDATE", "bank_transaction")) {
    return {
      ok: false,
      error: "forbidden",
      message: `Role ${role} cannot update bank-transaction classification.`,
    };
  }
  const parsed = skipInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", message: zodIssues(parsed.error) };
  }
  const data = parsed.data;

  const tx = await prisma.bankTransaction.findFirst({
    where: { id: data.bankTransactionId, deletedAt: null },
    select: { id: true, classificationStatus: true, classifierNote: true },
  });
  if (tx == null) return { ok: false, error: "not_found", message: "Bank transaction not found." };
  if (tx.classificationStatus !== "UNCLASSIFIED") {
    return { ok: false, error: "invalid", message: "Cannot skip an already-classified row." };
  }

  try {
    await prisma.$transaction(async (txDb) => {
      await txDb.bankTransaction.update({
        where: { id: tx.id },
        data: { classifierNote: data.note },
      });
      await txDb.auditLog.create({
        data: {
          userId: user.id,
          entityType: "BankTransaction",
          entityId: tx.id,
          action: "UPDATE",
          fieldName: "classifier_note",
          oldValue: tx.classifierNote,
          newValue: data.note,
          context: `Skipped classification via /inbox`,
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

  revalidatePath("/inbox");
  redirect("/inbox");
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.replace(/[\s ]+/g, " ").trim();
}

function zodIssues(err: z.ZodError): string {
  return err.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}
