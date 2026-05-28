/**
 * Global audit-log browser query — Batch 17.
 *
 * URL-driven filtering: ?user=<id>&entityType=<str>&entityId=<id>&action=<enum>&from=<date>&to=<date>&q=<text>
 *
 * Returns paginated results (50/page; offset pagination is simple here —
 * audit log isn't that hot today). Per D8 audit_log is immutable + has
 * READ-only for non-MASTER; we only render, never mutate.
 */

import type { AuditAction, PrismaClient } from "@prisma/client";

export interface AuditBrowserFilters {
  userId: string | null;
  entityType: string | null;
  entityId: string | null;
  action: AuditAction | null;
  fromDate: string | null; // ISO YYYY-MM-DD
  toDate: string | null;
  query: string | null; // free-text in context / field_name
  page: number; // 1-based
}

export interface AuditBrowserRow {
  id: string;
  timestamp: string;
  user: { id: string; fullName: string } | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  context: string | null;
}

export interface AuditBrowserSnapshot {
  rows: AuditBrowserRow[];
  total: number;
  pageSize: number;
  page: number;
  totalPages: number;
  /// Distinct entity types in the table (for the dropdown filter).
  entityTypes: string[];
  /// Top 100 users referenced in the table (for the dropdown filter).
  users: Array<{ id: string; fullName: string }>;
}

const PAGE_SIZE = 50;

export async function loadAuditBrowser(
  prisma: PrismaClient,
  filters: AuditBrowserFilters,
): Promise<AuditBrowserSnapshot> {
  const where: Record<string, unknown> = {};
  if (filters.userId != null) where["userId"] = filters.userId;
  if (filters.entityType != null) where["entityType"] = filters.entityType;
  if (filters.entityId != null) where["entityId"] = filters.entityId;
  if (filters.action != null) where["action"] = filters.action;
  if (filters.fromDate != null || filters.toDate != null) {
    where["timestamp"] = {
      ...(filters.fromDate != null ? { gte: new Date(`${filters.fromDate}T00:00:00Z`) } : {}),
      ...(filters.toDate != null ? { lte: new Date(`${filters.toDate}T23:59:59Z`) } : {}),
    };
  }
  if (filters.query != null && filters.query.length > 0) {
    where["OR"] = [
      { context: { contains: filters.query, mode: "insensitive" } },
      { fieldName: { contains: filters.query, mode: "insensitive" } },
      { oldValue: { contains: filters.query, mode: "insensitive" } },
      { newValue: { contains: filters.query, mode: "insensitive" } },
    ];
  }

  const page = Math.max(1, Math.floor(filters.page));
  const skip = (page - 1) * PAGE_SIZE;

  const [total, rows, entityTypesRaw, usersRaw] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: PAGE_SIZE,
      skip,
      include: { user: { select: { id: true, fullName: true } } },
    }),
    // Distinct entity types — small set; cached server-side per request.
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 100,
    }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp.toISOString(),
      user: r.user,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      fieldName: r.fieldName,
      oldValue: r.oldValue,
      newValue: r.newValue,
      context: r.context,
    })),
    total,
    pageSize: PAGE_SIZE,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    entityTypes: entityTypesRaw.map((e) => e.entityType),
    users: usersRaw,
  };
}
