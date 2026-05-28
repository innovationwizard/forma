/**
 * AuditLog helper — every mutation in the seed writes one of these rows in
 * the same transaction as the entity insert. Per _THE_RULES.MD Rule 8 +
 * SDD §12.
 *
 * The seed uses `action: IMPORT` and a stable context string so subsequent
 * audit-log queries can scope to "Initial xlsx import 2026-05-25" cleanly.
 */

import type { Prisma } from "@prisma/client";

export const IMPORT_CONTEXT_PREFIX = "Initial xlsx import";

export interface AuditInput {
  userId: string;
  entityType: string; // e.g. "Expenditure", "RvUnit"
  entityId: string;
  /// Optional. For seed-time inserts, omit (AuditLog already records action=IMPORT).
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}

export async function writeImportAuditLog(
  tx: Prisma.TransactionClient,
  input: AuditInput,
  importStamp: string,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: "IMPORT",
      fieldName: input.fieldName ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      context: `${IMPORT_CONTEXT_PREFIX} ${importStamp}`,
    },
  });
}

/// Returns the YYYY-MM-DD stamp used in the audit `context`. Stable across
/// the whole seed run.
export function buildImportStamp(now: Date = new Date()): string {
  const y = now.getUTCFullYear().toString().padStart(4, "0");
  const m = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = now.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}
