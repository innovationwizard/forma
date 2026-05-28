/**
 * Sales tracker queries — Batch 15.
 *
 * `loadSalesGrid()` — returns the 11 RvUnits with summary stats for the
 * `/sales` grid: status, buyer (or none), sale month, projected revenue,
 * total paid to date.
 *
 * `loadSalesDetail(id)` — per-house data for `/sales/[id]`: full unit +
 * buyer + reservation history + freeze history + RvPayments + projected
 * monthly schedule from `MonthlyProjection.revenuePerHouse`.
 *
 * Complements `loadCasaReflujo()` (Batch 13c). That query is flow-focused
 * (planned cuotas vs actuals); this one is buyer/lifecycle-focused.
 */

import type {
  PrismaClient,
  RvReservationStatus,
  RvFreezeRequestStatus,
  RvUnitStatus,
} from "@prisma/client";

import { decimalString } from "../calc/currency";

export interface SalesGridRow {
  id: string;
  name: string;
  status: RvUnitStatus;
  salePriceSinIvaUsd: string | null;
  saleMonth: number | null;
  deliveryMonth: number | null;
  buyer: { id: string; name: string } | null;
  /// Sum of RvPayment.amountUsd for this unit (not soft-deleted).
  totalPaidUsd: string;
  /// True when the unit is SOLD but has no buyer linked — the UI surfaces
  /// this as a data-incomplete badge.
  dataIncomplete: boolean;
}

export interface SalesGridSnapshot {
  rows: SalesGridRow[];
  totals: {
    /// Sum of salePriceSinIvaUsd across all 11 units. Reconciles to
    /// SDD §3.2.5 = $12,639,661.49.
    totalProjectedUsd: string;
    /// Sum of totalPaidUsd across all units.
    totalPaidUsd: string;
    unitCountSold: number;
    unitCountAvailable: number;
    unitCountOther: number; // SOFT_HOLD, RESERVED, FROZEN
    unitsWithIncompleteData: number;
  };
}

export async function loadSalesGrid(prisma: PrismaClient): Promise<SalesGridSnapshot> {
  const rawUnits = await prisma.rvUnit.findMany({
    where: { deletedAt: null },
    include: {
      buyer: { select: { id: true, name: true } },
      payments: {
        where: { deletedAt: null },
        select: { amountUsd: true },
      },
    },
  });

  // Sort by the numeric suffix in `name` ("Casa 1" → 1, "Casa 10" → 10) so the
  // grid reads Casa 1, 2, 3, …, 11 instead of the lexical 1, 10, 11, 2, 3, …
  // Names without a numeric suffix fall back to lexical at the end.
  const units = [...rawUnits].sort((a, b) => {
    const an = extractCasaNumber(a.name);
    const bn = extractCasaNumber(b.name);
    if (an != null && bn != null) return an - bn;
    if (an != null) return -1;
    if (bn != null) return 1;
    return a.name.localeCompare(b.name);
  });

  const rows: SalesGridRow[] = units.map((u) => {
    const totalPaid = u.payments.reduce(
      (acc, p) => acc + Number(decimalString(p.amountUsd)),
      0,
    );
    return {
      id: u.id,
      name: u.name,
      status: u.status,
      salePriceSinIvaUsd: u.salePriceSinIvaUsd != null ? decimalString(u.salePriceSinIvaUsd) : null,
      saleMonth: u.saleMonth,
      deliveryMonth: u.deliveryMonth,
      buyer: u.buyer,
      totalPaidUsd: totalPaid.toFixed(2),
      dataIncomplete: u.status === "SOLD" && u.buyer == null,
    };
  });

  const totals = {
    totalProjectedUsd: rows
      .reduce((acc, r) => acc + Number(r.salePriceSinIvaUsd ?? 0), 0)
      .toFixed(2),
    totalPaidUsd: rows.reduce((acc, r) => acc + Number(r.totalPaidUsd), 0).toFixed(2),
    unitCountSold: rows.filter((r) => r.status === "SOLD").length,
    unitCountAvailable: rows.filter((r) => r.status === "AVAILABLE").length,
    unitCountOther: rows.filter((r) => r.status !== "SOLD" && r.status !== "AVAILABLE").length,
    unitsWithIncompleteData: rows.filter((r) => r.dataIncomplete).length,
  };

  return { rows, totals };
}

// ── Per-house detail ────────────────────────────────────────────────────────

export interface SalesDetailSnapshot {
  unit: {
    id: string;
    name: string;
    type: string;
    areaM2: string;
    pricePerM2Usd: string | null;
    salePriceSinIvaUsd: string | null;
    engancheRate: string;
    status: RvUnitStatus;
    saleMonth: number | null;
    deliveryMonth: number | null;
    reservedAt: string | null;
    soldAt: string | null;
    vendedor: string | null;
    buyer: { id: string; name: string; taxId: string | null; type: string } | null;
  };
  reservations: Array<{
    id: string;
    status: RvReservationStatus;
    reservedAt: string;
    decidedAt: string | null;
    partner: { id: string; name: string };
  }>;
  freezeRequests: Array<{
    id: string;
    status: RvFreezeRequestStatus;
    reason: string;
    requestedAt: string;
    releasedAt: string | null;
  }>;
  payments: Array<{
    id: string;
    paymentDate: string;
    amountUsd: string;
    amountGtq: string;
    reconciliationStatus: string;
    notes: string | null;
    bankTransactionId: string | null;
  }>;
  schedule: Array<{
    monthNumber: number;
    monthDate: string;
    plannedUsd: string;
  }>;
  totals: {
    plannedUsd: string;
    paidUsd: string;
    /// Computed enganche = price × rate. The user-facing "expected first
    /// payment" number.
    engancheExpectedUsd: string;
  };
}

export async function loadSalesDetail(
  prisma: PrismaClient,
  id: string,
): Promise<SalesDetailSnapshot | null> {
  const unit = await prisma.rvUnit.findFirst({
    where: { id, deletedAt: null },
    include: {
      buyer: { select: { id: true, name: true, taxId: true, type: true } },
      reservations: {
        where: { deletedAt: null },
        orderBy: { reservedAt: "desc" },
        include: { partner: { select: { id: true, name: true } } },
      },
      freezeRequests: {
        where: { deletedAt: null },
        orderBy: { requestedAt: "desc" },
      },
      payments: {
        where: { deletedAt: null },
        orderBy: { paymentDate: "asc" },
        include: { bankTransaction: { select: { id: true } } },
      },
    },
  });
  if (unit == null) return null;

  const monthlies = await prisma.monthlyProjection.findMany({
    where: { deletedAt: null },
    orderBy: { monthNumber: "asc" },
    select: { monthNumber: true, monthDate: true, revenuePerHouse: true },
  });

  const schedule = monthlies.map((m) => {
    const perHouse = (m.revenuePerHouse ?? {}) as Record<string, number | string | null>;
    const raw = perHouse[unit.name];
    const num = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : 0;
    return {
      monthNumber: m.monthNumber,
      monthDate: m.monthDate.toISOString().slice(0, 10),
      plannedUsd: Number.isFinite(num) ? num.toFixed(2) : "0.00",
    };
  });

  const plannedTotal = schedule.reduce((acc, s) => acc + Number(s.plannedUsd), 0);
  const paidTotal = unit.payments.reduce(
    (acc, p) => acc + Number(decimalString(p.amountUsd)),
    0,
  );
  const price = unit.salePriceSinIvaUsd != null ? Number(decimalString(unit.salePriceSinIvaUsd)) : 0;
  const engancheExpected = price * Number(decimalString(unit.engancheRate));

  return {
    unit: {
      id: unit.id,
      name: unit.name,
      type: unit.type,
      areaM2: decimalString(unit.areaM2),
      pricePerM2Usd: unit.pricePerM2Usd != null ? decimalString(unit.pricePerM2Usd) : null,
      salePriceSinIvaUsd: unit.salePriceSinIvaUsd != null ? decimalString(unit.salePriceSinIvaUsd) : null,
      engancheRate: decimalString(unit.engancheRate),
      status: unit.status,
      saleMonth: unit.saleMonth,
      deliveryMonth: unit.deliveryMonth,
      reservedAt: unit.reservedAt?.toISOString().slice(0, 10) ?? null,
      soldAt: unit.soldAt?.toISOString().slice(0, 10) ?? null,
      vendedor: unit.vendedor,
      buyer: unit.buyer,
    },
    reservations: unit.reservations.map((r) => ({
      id: r.id,
      status: r.status,
      reservedAt: r.reservedAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
      partner: r.partner,
    })),
    freezeRequests: unit.freezeRequests.map((f) => ({
      id: f.id,
      status: f.status,
      reason: f.reason,
      requestedAt: f.requestedAt.toISOString(),
      releasedAt: f.releasedAt?.toISOString() ?? null,
    })),
    payments: unit.payments.map((p) => ({
      id: p.id,
      paymentDate: p.paymentDate.toISOString().slice(0, 10),
      amountUsd: decimalString(p.amountUsd),
      amountGtq: decimalString(p.amountGtq),
      reconciliationStatus: p.reconciliationStatus,
      notes: p.notes,
      bankTransactionId: p.bankTransaction?.id ?? null,
    })),
    schedule,
    totals: {
      plannedUsd: plannedTotal.toFixed(2),
      paidUsd: paidTotal.toFixed(2),
      engancheExpectedUsd: engancheExpected.toFixed(2),
    },
  };
}

/// Extract the trailing integer from a unit name like "Casa 1" / "Casa 11".
/// Returns null if the name doesn't end in digits, so the sales grid can fall
/// back to lexical ordering for non-standard names.
function extractCasaNumber(name: string): number | null {
  const m = name.match(/(\d+)\s*$/);
  if (!m || m[1] == null) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
