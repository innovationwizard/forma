"use server";

/**
 * Sales-tracker server actions — Batch 15.
 *
 *   - `updateHouseStatusAction({ id, toStatus, reason })` — transitions the
 *     RvUnit's status through the state machine encoded in
 *     `src/lib/calc/sales-status.ts`. Each transition writes an AuditLog row.
 *   - `recordPaymentAction({ id, paymentDate, amountUsd, amountGtq, ... })` —
 *     creates an RvPayment without a bank-transaction link. The Inbox flow
 *     (Batch 13b) is for bank-statement-sourced payments; this path is for
 *     ad-hoc / out-of-band entries (cash payments, payments not yet on a
 *     statement, etc.). Audited.
 *   - `linkBuyerAction({ id, partnerId, taxId? })` or `linkBuyerByNameAction`
 *     — links an existing Partner to a unit's `buyerId`, OR creates a new
 *     Partner from a name + optional taxId and links it. The "fill in
 *     missing data" workflow for Gate 15.1's "data incomplete" units.
 *
 * Per the durable RBAC pattern: every action `requireRole()` → `can()` →
 * atomic Prisma transaction wrapping mutation + AuditLog rows.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { RvUnitStatus } from "@prisma/client";

import { validateTransition } from "@/lib/calc/sales-status";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { can } from "@/lib/rbac/matrix";

const UUID = z.string().uuid();
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_STR = /^-?\d+(?:\.\d+)?$/;

export type SalesActionResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "not_found" | "invalid" | "internal"; message: string };

// ── 1. updateHouseStatusAction ─────────────────────────────────────────────

const updateStatusInputSchema = z.object({
  id: UUID,
  toStatus: z.enum(["AVAILABLE", "SOFT_HOLD", "RESERVED", "FROZEN", "SOLD"]),
  reason: z.string().trim().min(1).max(2000),
});

export type UpdateHouseStatusInput = z.infer<typeof updateStatusInputSchema>;

export async function updateHouseStatusAction(
  input: UpdateHouseStatusInput,
): Promise<SalesActionResult> {
  const { user, role } = await requireRole();
  if (!can(role, "UPDATE", "rv_units")) {
    return { ok: false, error: "forbidden", message: `Role ${role} cannot update unit status.` };
  }
  const parsed = updateStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", message: zodIssues(parsed.error) };
  }
  const data = parsed.data;

  const unit = await prisma.rvUnit.findFirst({
    where: { id: data.id, deletedAt: null },
    select: { id: true, status: true, name: true },
  });
  if (unit == null) return { ok: false, error: "not_found", message: "Unit not found." };

  const validation = validateTransition(unit.status, data.toStatus as RvUnitStatus);
  if (!validation.ok) {
    return { ok: false, error: "invalid", message: validation.message ?? "Illegal transition." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Side-effects for SOLD / RESERVED / AVAILABLE transitions:
      //   - SOLD: set soldAt to today.
      //   - RESERVED: set reservedAt to today.
      //   - AVAILABLE (from RESERVED/SOFT_HOLD): clear reservedAt/soldAt.
      const now = new Date();
      const sideEffects: { soldAt?: Date | null; reservedAt?: Date | null } = {};
      if (data.toStatus === "SOLD") sideEffects.soldAt = now;
      else if (data.toStatus === "RESERVED") sideEffects.reservedAt = now;
      else if (data.toStatus === "AVAILABLE") {
        sideEffects.soldAt = null;
        sideEffects.reservedAt = null;
      }
      await tx.rvUnit.update({
        where: { id: data.id },
        data: { status: data.toStatus as RvUnitStatus, ...sideEffects },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          entityType: "RvUnit",
          entityId: data.id,
          action: "UPDATE",
          fieldName: "status",
          oldValue: unit.status,
          newValue: data.toStatus,
          context: `Status transition: ${unit.status} → ${data.toStatus} · ${data.reason}`,
        },
      });
    });
  } catch (err) {
    return { ok: false, error: "internal", message: err instanceof Error ? err.message : String(err) };
  }

  revalidatePath("/sales");
  revalidatePath(`/sales/${data.id}`);
  revalidatePath(`/casa/${data.id}/reflujo`);
  revalidatePath("/");
  return { ok: true };
}

// ── 2. recordPaymentAction (manual RvPayment entry) ────────────────────────

const recordPaymentInputSchema = z.object({
  id: UUID,
  paymentDate: z.string().regex(ISO_DATE),
  amountUsd: z.string().regex(DECIMAL_STR),
  amountGtq: z.string().regex(DECIMAL_STR),
  exchangeRateUsed: z.string().regex(DECIMAL_STR),
  notes: z.string().trim().max(2000).nullable(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentInputSchema>;

export async function recordPaymentAction(
  input: RecordPaymentInput,
): Promise<SalesActionResult> {
  const { user, role } = await requireRole();
  if (!can(role, "CREATE", "rv_payment")) {
    return { ok: false, error: "forbidden", message: `Role ${role} cannot record payments.` };
  }
  const parsed = recordPaymentInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", message: zodIssues(parsed.error) };
  }
  const data = parsed.data;

  const unit = await prisma.rvUnit.findFirst({
    where: { id: data.id, deletedAt: null },
    select: { id: true },
  });
  if (unit == null) return { ok: false, error: "not_found", message: "Unit not found." };

  const tc = Number(data.exchangeRateUsed);
  if (!Number.isFinite(tc) || tc <= 0) {
    return { ok: false, error: "invalid", message: "Exchange rate must be positive." };
  }
  const amountUsd = Number(data.amountUsd);
  const amountGtq = Number(data.amountGtq);
  if (amountUsd <= 0 && amountGtq <= 0) {
    return { ok: false, error: "invalid", message: "Amount must be positive." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.rvPayment.create({
        data: {
          rvUnitId: data.id,
          bankTransactionId: null, // manual entry — no bank-tx provenance
          paymentDate: new Date(`${data.paymentDate}T00:00:00Z`),
          amountUsd: data.amountUsd,
          amountGtq: data.amountGtq,
          exchangeRateUsed: data.exchangeRateUsed,
          reconciliationStatus: "UNMATCHED",
          notes: data.notes,
          createdByUserId: user.id,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          entityType: "RvPayment",
          entityId: created.id,
          action: "CREATE",
          context: `Manual payment entry from /sales/${data.id} (no bank-tx link)`,
          newValue: JSON.stringify({
            usd: data.amountUsd,
            gtq: data.amountGtq,
            tc: data.exchangeRateUsed,
            note: data.notes,
          }),
        },
      });
    });
  } catch (err) {
    return { ok: false, error: "internal", message: err instanceof Error ? err.message : String(err) };
  }

  revalidatePath("/sales");
  revalidatePath(`/sales/${data.id}`);
  revalidatePath(`/casa/${data.id}/reflujo`);
  revalidatePath("/");
  return { ok: true };
}

// ── 3. linkBuyerAction (create-or-link Partner) ────────────────────────────

const linkBuyerInputSchema = z.object({
  id: UUID,
  /// Either: pick an existing partner by id…
  partnerId: UUID.nullable(),
  /// …or create a new one from this name. At least one of `partnerId` and
  /// `newBuyerName` MUST be set.
  newBuyerName: z.string().trim().min(1).max(255).nullable(),
  /// Optional NIT / tax id for newly-created partners.
  newBuyerTaxId: z.string().trim().max(64).nullable(),
});

export type LinkBuyerInput = z.infer<typeof linkBuyerInputSchema>;

export async function linkBuyerAction(input: LinkBuyerInput): Promise<SalesActionResult> {
  const { user, role } = await requireRole();
  if (!can(role, "UPDATE", "rv_units")) {
    return { ok: false, error: "forbidden", message: `Role ${role} cannot link buyers to units.` };
  }
  // Creating a new partner requires CREATE partner. Reusing an existing one
  // doesn't — UPDATE rv_units alone covers the relink.
  const parsed = linkBuyerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", message: zodIssues(parsed.error) };
  }
  const data = parsed.data;
  if (data.partnerId == null && (data.newBuyerName == null || data.newBuyerName.length === 0)) {
    return {
      ok: false,
      error: "invalid",
      message: "Must provide either an existing partnerId or a newBuyerName.",
    };
  }
  if (data.partnerId == null && !can(role, "CREATE", "partner")) {
    return {
      ok: false,
      error: "forbidden",
      message: `Role ${role} cannot create new partners. Pick an existing one.`,
    };
  }

  const unit = await prisma.rvUnit.findFirst({
    where: { id: data.id, deletedAt: null },
    select: { id: true, buyerId: true },
  });
  if (unit == null) return { ok: false, error: "not_found", message: "Unit not found." };

  try {
    await prisma.$transaction(async (tx) => {
      let partnerId = data.partnerId;
      if (partnerId == null) {
        const created = await tx.partner.create({
          data: {
            name: data.newBuyerName!,
            taxId: data.newBuyerTaxId,
            type: "INDIVIDUAL", // default for buyers; can be edited via Settings later
            isBuyer: true,
          },
          select: { id: true },
        });
        partnerId = created.id;
        await tx.auditLog.create({
          data: {
            userId: user.id,
            entityType: "Partner",
            entityId: created.id,
            action: "CREATE",
            context: `Partner created from /sales/${data.id} buyer-link form`,
            newValue: JSON.stringify({ name: data.newBuyerName, taxId: data.newBuyerTaxId }),
          },
        });
      }
      await tx.rvUnit.update({ where: { id: data.id }, data: { buyerId: partnerId } });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          entityType: "RvUnit",
          entityId: data.id,
          action: "UPDATE",
          fieldName: "buyerId",
          oldValue: unit.buyerId,
          newValue: partnerId,
          context: `Buyer linked via /sales/${data.id}`,
        },
      });
    });
  } catch (err) {
    return { ok: false, error: "internal", message: err instanceof Error ? err.message : String(err) };
  }

  revalidatePath("/sales");
  revalidatePath(`/sales/${data.id}`);
  return { ok: true };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function zodIssues(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}
