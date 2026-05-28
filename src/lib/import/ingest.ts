/**
 * Bronze + silver ingestion pipeline.
 *
 * Called by the upload server action AFTER `requireRole()` + `can()` checks.
 * Pure orchestration over the registry + DB:
 *
 *   1. Hash the file. Reject if already imported (UNIQUE bank_statement_import.file_sha256).
 *   2. Parse the workbook (SheetJS).
 *   3. Run `detectBank()` to identify bank + per-sheet detection.
 *   4. Insert BRONZE: one BankStatementImport + N BankStatementSheet rows.
 *      For each matched sheet, run the adapter's `parse()` and insert
 *      BankStatementRawRow rows verbatim (per D31).
 *   5. SILVER-promote canonical sheets only: convert silver candidates
 *      to BankTransaction rows. The UNIQUE `natural_key` constraint
 *      catches overlap-export duplicates; we collect those into
 *      DataQualityFlag rows (kind=DUPLICATE_OF_PRIOR_IMPORT) instead of
 *      bubbling the error.
 *
 * All steps run in a single Prisma transaction so a mid-pipeline failure
 * doesn't leave partial state.
 *
 * Per Jorge directive #3: this is where overlap-export defense lives.
 * The bronze layer ALWAYS captures (so we know we received the file);
 * silver dedups via the UNIQUE constraint.
 *
 * Per Jorge directive #2 + D31: every sheet, every row, captured.
 * Twin-sheet behavior: first matched sheet is canonical; alternates are
 * captured but skipped for silver promotion until a user flips the toggle.
 */

import { createHash } from "node:crypto";

import type {
  BankName,
  BankTransactionDirection,
  Currency,
  Prisma,
  PrismaClient,
  RawRowParseStatus,
  SheetParseStatus,
} from "@prisma/client";

import { getAdapter, detectBank } from "./registry";
import { parseWorkbook } from "./workbook";
import type { ParserFlag, RawRowOutput, SilverCandidate } from "./types";

export type IngestResult =
  | { ok: true; importId: string; summary: IngestSummary }
  | { ok: false; error: "duplicate_file"; existingImportId: string }
  | { ok: false; error: "invalid"; message: string };

export interface IngestSummary {
  detectedBank: BankName;
  sheetsCount: number;
  sheetsMatched: number;
  rawRowsCount: number;
  silverInsertedCount: number;
  silverDuplicatesCount: number;
  /// Per REFLUJO Batch 13d: IssuedCheque-side promotion counts for
  /// CHECK_REGISTER sheets. Parallel to the silver counters above.
  issuedChequesInsertedCount: number;
  issuedChequesDuplicatesCount: number;
  flagsCount: number;
}

export async function ingestBankStatement(
  prisma: PrismaClient,
  args: {
    fileName: string;
    fileBuffer: ArrayBuffer;
    uploadedByUserId: string;
  },
): Promise<IngestResult> {
  const fileSha256 = sha256Hex(args.fileBuffer);
  const existing = await prisma.bankStatementImport.findUnique({
    where: { fileSha256 },
    select: { id: true },
  });
  if (existing != null) {
    return { ok: false, error: "duplicate_file", existingImportId: existing.id };
  }

  let workbook;
  try {
    workbook = parseWorkbook(args.fileBuffer);
  } catch (err) {
    return {
      ok: false,
      error: "invalid",
      message: `Could not open the file as a workbook: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const detection = detectBank({ workbook });
  const adapter = detection.match ? getAdapter(detection.bank) : null;

  // ── Resolve account FKs upfront (one round-trip) ──────────────────────
  const accountNumbersWanted = new Set<string>();
  for (const s of detection.sheets) {
    if (s.detected?.accountNumber != null) accountNumbersWanted.add(s.detected.accountNumber);
  }
  const accountRows = await prisma.bankAccount.findMany({
    where: { deletedAt: null },
    select: { id: true, accountNumber: true },
  });
  const accountIdByNumber = new Map<string, string>();
  for (const a of accountRows) {
    // Detected numbers may be unformatted ("00299005975"); seeded ones are
    // dash-formatted ("002-9900597-5"). Normalize both sides to digits-only
    // for matching, but the original detected value stays in the bronze
    // layer for provenance.
    accountIdByNumber.set(digitsOnly(a.accountNumber), a.id);
  }

  let importId: string;
  const summary: IngestSummary = {
    detectedBank: detection.bank,
    sheetsCount: detection.sheets.length,
    sheetsMatched: detection.sheets.filter((s) => s.match).length,
    rawRowsCount: 0,
    silverInsertedCount: 0,
    silverDuplicatesCount: 0,
    issuedChequesInsertedCount: 0,
    issuedChequesDuplicatesCount: 0,
    flagsCount: 0,
  };

  // Default transaction window is 5s; large statements + Supabase session-pooler
  // latency can blow that even with batched inserts. Bumped to 60s defensively
  // — single-file ingest is bounded by the 10 MB upload limit, so wall-clock
  // can't realistically exceed this.
  await prisma.$transaction(async (tx) => {
    const importRow = await tx.bankStatementImport.create({
      data: {
        fileName: args.fileName,
        fileSha256,
        fileSizeBytes: args.fileBuffer.byteLength,
        uploadedByUserId: args.uploadedByUserId,
        detectedBank: detection.bank,
      },
      select: { id: true },
    });
    importId = importRow.id;

    // Track canonical sheets created so we can assign alternates_link_id
    // for matched twins.
    const canonicalSheetByAccountAndCurrency = new Map<string, string>(); // key: `${account}|${currency}` → sheetId

    for (let i = 0; i < workbook.sheets.length; i++) {
      const sheet = workbook.sheets[i]!;
      const sheetDetection = detection.sheets[i]!;
      const detected = sheetDetection.detected;

      const parseStatus: SheetParseStatus = detected != null ? "PARSED" : sheet.rowCount === 0 ? "EMPTY" : "UNPARSEABLE";
      const detectedBankAccountId = detected?.accountNumber
        ? accountIdByNumber.get(digitsOnly(detected.accountNumber)) ?? null
        : null;

      // Twin-sheet linking: when this sheet matches AND there's already a
      // canonical sheet for the same account+currency, mark this one as an
      // alternate and link to the canonical id.
      let alternatesLinkId: string | null = null;
      let isCanonical = detected?.isCanonical ?? true;
      if (detected != null && detected.accountNumber != null && detected.currency != null) {
        const key = `${detected.accountNumber}|${detected.currency}`;
        if (canonicalSheetByAccountAndCurrency.has(key)) {
          alternatesLinkId = canonicalSheetByAccountAndCurrency.get(key) ?? null;
          isCanonical = false;
        }
      }

      const sheetRow = await tx.bankStatementSheet.create({
        data: {
          importId,
          sheetName: sheet.name,
          sheetIndex: sheet.index,
          rowCount: sheet.rowCount,
          statementType: detected?.statementType ?? "UNKNOWN",
          detectedBankAccountId,
          detectedCurrency: detected?.currency as Currency | undefined,
          detectedPeriodStart: detected?.periodStart ? new Date(`${detected.periodStart}T00:00:00Z`) : null,
          detectedPeriodEnd: detected?.periodEnd ? new Date(`${detected.periodEnd}T00:00:00Z`) : null,
          parseStatus,
          parseNote: sheetDetection.noteWhenNotMatched ?? null,
          isCanonical,
          alternatesLinkId,
        },
        select: { id: true },
      });

      if (isCanonical && detected?.accountNumber != null && detected?.currency != null) {
        canonicalSheetByAccountAndCurrency.set(
          `${detected.accountNumber}|${detected.currency}`,
          sheetRow.id,
        );
      }

      if (adapter == null || !sheetDetection.match) continue;

      // ── PARSE ──────────────────────────────────────────────────────────
      const parseResult = adapter.parse({ workbook, sheet, sheetDetection });

      // Insert ALL raw rows (D31) — even UNPARSEABLE ones. Batched via
      // createManyAndReturn so a 30-row sheet doesn't blow the Prisma
      // transaction window. Returns rows in INSERTION ORDER, which is the
      // order we'll use to index back into the silver candidates.
      let bronzeIdsByIndex: string[] = [];
      if (parseResult.rawRows.length > 0) {
        const created = await tx.bankStatementRawRow.createManyAndReturn({
          data: parseResult.rawRows.map((raw) => ({
            sheetId: sheetRow.id,
            sourceRowNumber: raw.sourceRowNumber,
            rawCells: raw.rawCells as Prisma.InputJsonValue,
            parseStatus: raw.parseStatus as RawRowParseStatus,
            parseNote: raw.parseNote ?? null,
          })),
          select: { id: true, sourceRowNumber: true },
        });
        // Re-index by the parser's original ordering (sourceRowNumber).
        // createManyAndReturn preserves insertion order on Postgres but
        // sorting explicitly is safer + match the parser's bronzeRowIndex.
        const idBySourceRow = new Map(created.map((c) => [c.sourceRowNumber, c.id]));
        bronzeIdsByIndex = parseResult.rawRows.map((r) => idBySourceRow.get(r.sourceRowNumber) ?? "");
        summary.rawRowsCount += parseResult.rawRows.length;
      }

      // Silver-promotion: canonical sheets only.
      if (isCanonical && detectedBankAccountId != null) {
        for (const candidate of parseResult.silverCandidates) {
          const bronzeRowId = bronzeIdsByIndex[candidate.bronzeRowIndex];
          if (bronzeRowId == null) continue;

          const naturalKey = buildNaturalKey({
            bankAccountId: detectedBankAccountId,
            transactionDate: candidate.transactionDate,
            reference: candidate.reference,
            description: candidate.description,
            amountSigned: candidate.amountSigned,
          });

          // Try-insert; on UNIQUE violation we record a DataQualityFlag and move on.
          try {
            await tx.bankTransaction.create({
              data: {
                bankAccountId: detectedBankAccountId,
                transactionDate: new Date(`${candidate.transactionDate}T00:00:00Z`),
                amountSigned: candidate.amountSigned,
                currency: candidate.currency,
                reference: candidate.reference,
                description: candidate.description,
                agencia: candidate.agencia,
                direction: candidate.direction as BankTransactionDirection,
                saldoAfter: candidate.saldoAfter,
                bronzeRowId,
                naturalKey,
              },
            });
            summary.silverInsertedCount += 1;
          } catch (err) {
            // P2002 = unique constraint failure
            if ((err as { code?: string }).code === "P2002") {
              summary.silverDuplicatesCount += 1;
              await tx.dataQualityFlag.create({
                data: {
                  kind: "DUPLICATE_OF_PRIOR_IMPORT",
                  severity: "INFO",
                  sourceWorkbookRef: `BankStatementImport:${importId}/Sheet:${sheet.name}/RowIdx:${candidate.bronzeRowIndex}`,
                  sourceValue: `naturalKey=${naturalKey}`,
                  humanMessage:
                    `Silver-promotion candidate hit the natural-key UNIQUE constraint — ` +
                    `this transaction was already imported in a prior file. ` +
                    `Bronze row preserved per D31; silver insert skipped per Jorge directive #3 (overlapping re-export defense).`,
                  relatedEntityType: "BankStatementRawRow",
                  relatedEntityId: bronzeRowId,
                },
              });
            } else {
              throw err;
            }
          }
        }
      }

      // ── REFLUJO Batch 13d: IssuedCheque promotion (CHECK_REGISTER sheets) ─
      //
      // CHECK_REGISTER sheets emit `issuedChequeCandidates` from the parser
      // and have empty `silverCandidates`. We promote each candidate into
      // `issued_cheque`. The natural-key UNIQUE catches semantic dedup when
      // a bank account is bound; with unbound rows (bankAccountId null),
      // the natural-key falls back to `bronzeRowId` so each ingest gets
      // unique rows — the file-hash UNIQUE on `BankStatementImport` is the
      // duplicate-defense for the unbound case.
      //
      // ANULADO rows ARE promoted (with `isVoided=true`, amount=0) per D31.
      // They occupy cheque-number slots and the operator needs to see them.
      if (isCanonical && parseResult.issuedChequeCandidates.length > 0) {
        for (const candidate of parseResult.issuedChequeCandidates) {
          const bronzeRowId = bronzeIdsByIndex[candidate.bronzeRowIndex];
          if (bronzeRowId == null) continue;

          const naturalKey = `${candidate.currency}|${candidate.chequeNumber}|${detectedBankAccountId ?? bronzeRowId}`;

          try {
            await tx.issuedCheque.create({
              data: {
                chequeNumber: candidate.chequeNumber,
                issueDate: candidate.issueDate
                  ? new Date(`${candidate.issueDate}T00:00:00Z`)
                  : null,
                currency: candidate.currency,
                bankAccountId: detectedBankAccountId,
                payeeName: candidate.payeeName,
                amountSigned: candidate.amountSigned,
                concepto: candidate.concepto,
                solicitud: candidate.solicitud,
                partida: candidate.partida,
                cxc: candidate.cxc,
                saldoAfter: candidate.saldoAfter,
                isVoided: candidate.isVoided,
                bronzeRowId,
                naturalKey,
              },
            });
            summary.issuedChequesInsertedCount += 1;
          } catch (err) {
            if ((err as { code?: string }).code === "P2002") {
              summary.issuedChequesDuplicatesCount += 1;
              await tx.dataQualityFlag.create({
                data: {
                  kind: "DUPLICATE_OF_PRIOR_IMPORT",
                  severity: "INFO",
                  sourceWorkbookRef: `BankStatementImport:${importId}/Sheet:${sheet.name}/RowIdx:${candidate.bronzeRowIndex}`,
                  sourceValue: `naturalKey=${naturalKey}`,
                  humanMessage:
                    `IssuedCheque candidate (${candidate.currency} #${candidate.chequeNumber}) hit ` +
                    `the natural-key UNIQUE constraint — already imported from a prior file with the ` +
                    `same bank-account binding. Bronze row preserved per D31; cheque insert skipped.`,
                  relatedEntityType: "BankStatementRawRow",
                  relatedEntityId: bronzeRowId,
                },
              });
            } else {
              throw err;
            }
          }
        }
      }

      // Parser-raised flags — bucket under the generic BANK_PARSER_WARNING
      // enum value. The adapter's specific kind goes into the humanMessage
      // so each adapter's sub-taxonomy doesn't require a schema migration.
      for (const flag of parseResult.flags) {
        await tx.dataQualityFlag.create({
          data: {
            kind: "BANK_PARSER_WARNING",
            severity: flag.severity,
            sourceWorkbookRef:
              flag.sourceRowNumber != null
                ? `BankStatementImport:${importId}/Sheet:${sheet.name}/Row:${flag.sourceRowNumber}`
                : `BankStatementImport:${importId}/Sheet:${sheet.name}`,
            humanMessage: `[${flag.kind}] ${flag.context}`,
            relatedEntityType: "BankStatementSheet",
            relatedEntityId: sheetRow.id,
          },
        });
        summary.flagsCount += 1;
      }
    }
  }, {
    timeout: 60_000,
    maxWait: 10_000,
  });

  return { ok: true, importId: importId!, summary };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sha256Hex(buffer: ArrayBuffer): string {
  const hash = createHash("sha256");
  hash.update(new Uint8Array(buffer));
  return hash.digest("hex");
}

function digitsOnly(s: string): string {
  return s.replace(/[^\d]/g, "");
}

/// Natural key for silver dedup. Per the schema comment: when reference is
/// null, substitute a description hash so the UNIQUE constraint still bites.
/// Format: `account|YYYY-MM-DD|<ref-or-hash>|amount`.
function buildNaturalKey(args: {
  bankAccountId: string;
  transactionDate: string;
  reference: string | null;
  description: string;
  amountSigned: string;
}): string {
  const refOrHash =
    args.reference != null && args.reference.length > 0
      ? args.reference
      : `descSha:${createHash("sha256").update(args.description).digest("hex").slice(0, 16)}`;
  return `${args.bankAccountId}|${args.transactionDate}|${refOrHash}|${args.amountSigned}`;
}

/// Used by the unused-flag-helper to silence the type warning for ParserFlag
/// importing — keeps the public re-export surface explicit.
export type { ParserFlag, RawRowOutput, SilverCandidate };
