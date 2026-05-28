/**
 * DataQualityFlag seeder per D31 — preserves every parser-emitted flag
 * verbatim so the app surfaces them with provenance.
 *
 * Idempotent by `(kind, sourceWorkbookRef, humanMessage)` — flags are
 * effectively rows in a log; re-running the parser + seed against the
 * same xlsx produces the same flag set.
 *
 * After the upsert pass, an ORPHAN SWEEP soft-deletes parser-sourced
 * flags that are in the DB but NOT in the current parser bundle. This
 * keeps the DB in sync when parser fixes remove a previously-emitted
 * flag (e.g. the cumulativeRevenue derivation flag was retired once the
 * parser switched from row 51 to row 48 reads). The sweep is scoped to
 * `sourceWorkbookRef` prefixes that match xlsx sheet names, so app-runtime
 * flags raised by user actions are never touched. Per D21 (soft-delete only).
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { writeImportAuditLog } from "../audit";
import type { ValidatedParseBundle } from "../types";

/// Prefixes that identify a flag as parser-sourced (vs app-runtime).
/// The orphan sweep is scoped to flags whose `sourceWorkbookRef` starts
/// with one of these; everything else (app-raised flags) is left alone.
const PARSER_SHEET_PREFIXES = ["FCFCasas2!", "Ppto Inversion!", "Detalle egresos!"];

export async function seedDataQualityFlags(
  prisma: PrismaClient,
  bundle: ValidatedParseBundle,
  userId: string,
  importStamp: string,
): Promise<{ created: number; updated: number; orphaned: number }> {
  let created = 0;
  let updated = 0;

  for (const f of bundle.dataQualityFlags) {
    const data = {
      kind: f.kind as Prisma.DataQualityFlagCreateInput["kind"],
      severity: f.severity,
      sourceWorkbookRef: f.sourceWorkbookRef,
      sourceValue: f.sourceValue,
      recomputedValue: f.recomputedValue,
      humanMessage: f.humanMessage,
      relatedEntityType: f.relatedEntityType,
      // The parser emits a NATURAL KEY for the related entity (e.g., "Casa 6"
      // or "Detalle egresos!row 64"). The schema expects a UUID for
      // related_entity_id. For seed-time we leave it null — the app's
      // resolver fills it on first surface if needed, OR a future enhancement
      // adds a `relatedEntityNaturalKey` column to the schema.
      relatedEntityId: null,
    };
    const wasCreated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.dataQualityFlag.findFirst({
        where: {
          kind: data.kind,
          sourceWorkbookRef: f.sourceWorkbookRef,
          humanMessage: f.humanMessage,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing) {
        const u = await tx.dataQualityFlag.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        });
        await writeImportAuditLog(
          tx,
          { userId, entityType: "DataQualityFlag", entityId: u.id, fieldName: "(re-seed)" },
          importStamp,
        );
        return false;
      }
      const c = await tx.dataQualityFlag.create({ data, select: { id: true } });
      await writeImportAuditLog(
        tx,
        { userId, entityType: "DataQualityFlag", entityId: c.id },
        importStamp,
      );
      return true;
    });
    if (wasCreated) created++;
    else updated++;
  }

  // ── Orphan sweep (D21 soft-delete + D31 hygiene) ───────────────────────
  // Soft-delete any parser-sourced flag in the DB whose composite key is no
  // longer emitted by the current parser. Scoped to known sheet prefixes so
  // app-runtime flags raised by user actions are untouched.
  const currentKeys = new Set(
    bundle.dataQualityFlags.map(
      (f) => `${f.kind}|${f.sourceWorkbookRef}|${f.humanMessage}`,
    ),
  );
  const parserDbFlags = await prisma.dataQualityFlag.findMany({
    where: {
      deletedAt: null,
      OR: PARSER_SHEET_PREFIXES.map((p) => ({ sourceWorkbookRef: { startsWith: p } })),
    },
    select: { id: true, kind: true, sourceWorkbookRef: true, humanMessage: true },
  });
  let orphaned = 0;
  const now = new Date();
  for (const f of parserDbFlags) {
    const key = `${f.kind}|${f.sourceWorkbookRef}|${f.humanMessage}`;
    if (currentKeys.has(key)) continue;
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.dataQualityFlag.update({
        where: { id: f.id },
        data: { deletedAt: now },
      });
      await writeImportAuditLog(
        tx,
        {
          userId,
          entityType: "DataQualityFlag",
          entityId: f.id,
          fieldName: "deletedAt",
          oldValue: null,
          newValue: now.toISOString(),
        },
        importStamp,
      );
    });
    orphaned++;
  }

  return { created, updated, orphaned };
}
