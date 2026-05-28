#!/usr/bin/env tsx
/**
 * Backfill the `ExchangeRate` cache from BANGUAT for a given date range.
 *
 *   pnpm banguat:backfill                          # project start → today
 *   pnpm banguat:backfill 2025-01-01               # given date → today
 *   pnpm banguat:backfill 2025-01-01 2025-12-31    # explicit range
 *
 * **Idempotent and resumable.** Two mechanisms cooperate:
 *
 *   1. **DB-aware skip (the resumable checkpoint).** Before each chunk's
 *      BANGUAT round-trip we count how many days in the chunk's date range
 *      already exist in `exchange_rate` (source=BANGUAT, not soft-deleted).
 *      If coverage == chunk length, we skip the network call entirely. A
 *      partial run that died mid-way resumes by skipping already-cached
 *      chunks and starting at the first one that's incomplete. This
 *      replaces a checkpoint file — the DB itself is the checkpoint.
 *
 *   2. **Per-chunk retry with backoff.** Network/HTTP failures
 *      (`BanguatFetchError`) get retried up to 3 times with 1s/2s/4s
 *      exponential backoff. Parse failures (`BanguatParseError`) are
 *      NOT retried — schema drift is a loud failure per D31.
 *
 * Mid-chunk crash recovery is handled by the existing per-row upsert path:
 * partial DB state from a previous run becomes "unchanged" on the next.
 *
 * PER GATE 6.1: backfill writes ONLY to the `ExchangeRate` cache. It does
 * NOT update historical `Expenditure` rows — those keep their per-tx TC
 * (Detalle egresos finding #11) or project locked TC. Backfilling past
 * dates is for the resolver's benefit (forward-looking calcs + new-entry
 * rate resolution), not for rewriting history.
 *
 * Chunks at 365 days because TipoCambioRango caps somewhere around 1000
 * results (PA team observation) — chunking by year keeps us well under.
 */

import { PrismaClient } from "@prisma/client";

import { fetchRange } from "../../src/lib/banguat/fetch";
import { ensureBanguatCronUser } from "../../src/lib/banguat/system-user";
import {
  BanguatFetchError,
  BanguatParseError,
  type BanguatRate,
} from "../../src/lib/banguat/types";

const CHUNK_DAYS = 365;
const BACKFILL_ENTITY_ID = "00000000-0000-4000-8000-000000000000";
const RETRY_BACKOFFS_MS = [1_000, 2_000, 4_000];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const prisma = new PrismaClient({ log: ["warn", "error"] });

  try {
    const project = await prisma.project.findFirstOrThrow({
      where: { deletedAt: null },
      select: { startDate: true },
    });

    const fromIso = args[0] ?? toIso(project.startDate);
    const toIsoArg = args[1] ?? todayInGuatemala();

    process.stdout.write(`━━━ BANGUAT backfill ━━━\n`);
    process.stdout.write(`Range: ${fromIso} → ${toIsoArg}\n`);

    const userId = await ensureBanguatCronUser(prisma);
    const chunks = chunkDates(fromIso, toIsoArg, CHUNK_DAYS);
    process.stdout.write(`Chunks: ${chunks.length} (max ${CHUNK_DAYS} days each)\n\n`);

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let skipped = 0;
    let totalDays = 0;

    for (const [i, chunk] of chunks.entries()) {
      const label = `[${i + 1}/${chunks.length}] ${chunk.from} → ${chunk.to}`;
      const chunkSize = inclusiveDaysBetween(chunk.from, chunk.to);

      // ── Checkpoint: skip if chunk is fully cached ───────────────────────
      const cachedCount = await countCached(prisma, chunk.from, chunk.to);
      if (cachedCount >= chunkSize) {
        skipped += 1;
        process.stdout.write(`${label}: skipped (${cachedCount}/${chunkSize} days already cached)\n`);
        continue;
      }

      // ── Fetch with retry; persist with per-row idempotency ──────────────
      let rates: BanguatRate[];
      try {
        rates = await fetchRangeWithRetry(chunk.from, chunk.to, label);
      } catch (err) {
        // Persist partial progress up to this chunk before re-throwing so
        // the next run can resume cleanly.
        process.stderr.write(
          `\n${label}: FAILED after retries — ${err instanceof Error ? err.message : String(err)}\n`,
        );
        process.stderr.write(`Resume by re-running the same command; cached chunks will skip.\n`);
        throw err;
      }

      totalDays += rates.length;
      const result = await persistChunk(prisma, userId, rates);
      created += result.created;
      updated += result.updated;
      unchanged += result.unchanged;
      process.stdout.write(
        `${label}: ${rates.length} days (${result.created} new, ${result.updated} updated, ${result.unchanged} unchanged)\n`,
      );
    }

    process.stdout.write(
      `\n✓ Backfill complete: ${totalDays} days fetched · ${created} new · ${updated} updated · ${unchanged} unchanged · ${skipped} chunk${skipped === 1 ? "" : "s"} skipped (resumed).\n`,
    );
  } catch (err) {
    process.stderr.write(
      `FATAL: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (err instanceof Error && err.stack) process.stderr.write(err.stack + "\n");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

interface PersistResult {
  created: number;
  updated: number;
  unchanged: number;
}

async function persistChunk(
  prisma: PrismaClient,
  userId: string,
  rates: BanguatRate[],
): Promise<PersistResult> {
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const rate of rates) {
    const dateBoundary = new Date(`${rate.date}T00:00:00Z`);
    const existing = await prisma.exchangeRate.findFirst({
      where: { date: dateBoundary, deletedAt: null },
    });

    if (existing == null) {
      await prisma.$transaction(async (tx) => {
        await tx.exchangeRate.create({
          data: {
            date: dateBoundary,
            rateGtqPerUsd: rate.rateGtqPerUsd,
            source: "BANGUAT",
            isStale: false,
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            entityType: "ExchangeRate",
            entityId: BACKFILL_ENTITY_ID,
            action: "CREATE",
            context: `backfill BANGUAT ${rate.date} = ${rate.rateGtqPerUsd}`,
            newValue: JSON.stringify(rate),
          },
        });
      });
      created += 1;
      continue;
    }

    if (existing.rateGtqPerUsd.toString() === rate.rateGtqPerUsd) {
      unchanged += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.exchangeRate.update({
        where: { date: dateBoundary },
        data: { rateGtqPerUsd: rate.rateGtqPerUsd, source: "BANGUAT", isStale: false },
      });
      await tx.auditLog.create({
        data: {
          userId,
          entityType: "ExchangeRate",
          entityId: BACKFILL_ENTITY_ID,
          action: "UPDATE",
          fieldName: "rateGtqPerUsd",
          oldValue: existing.rateGtqPerUsd.toString(),
          newValue: rate.rateGtqPerUsd,
          context: `backfill BANGUAT ${rate.date}`,
        },
      });
    });
    updated += 1;
  }

  return { created, updated, unchanged };
}

/// Count `exchange_rate` rows with `source=BANGUAT` (not soft-deleted) in
/// the inclusive date range. Used by the resumable-checkpoint mechanism.
async function countCached(
  prisma: PrismaClient,
  fromIso: string,
  toIso_: string,
): Promise<number> {
  return prisma.exchangeRate.count({
    where: {
      date: {
        gte: new Date(`${fromIso}T00:00:00Z`),
        lte: new Date(`${toIso_}T00:00:00Z`),
      },
      source: "BANGUAT",
      deletedAt: null,
    },
  });
}

/// Wrap `fetchRange` with bounded exponential-backoff retry. Only retries
/// on `BanguatFetchError` (transient network/HTTP) — `BanguatParseError`
/// signals schema drift and must fail loud per D31.
async function fetchRangeWithRetry(
  fromIso: string,
  toIso_: string,
  label: string,
): Promise<BanguatRate[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_BACKOFFS_MS.length; attempt++) {
    try {
      return await fetchRange(fromIso, toIso_, { timeoutMs: 30_000 });
    } catch (err) {
      lastErr = err;
      if (err instanceof BanguatParseError) throw err;
      if (!(err instanceof BanguatFetchError)) throw err;
      const wait = RETRY_BACKOFFS_MS[attempt];
      if (wait == null) break; // exhausted retries
      process.stderr.write(
        `${label}: ${err.message} — retry ${attempt + 1}/${RETRY_BACKOFFS_MS.length} in ${wait}ms\n`,
      );
      await sleep(wait);
    }
  }
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkDates(
  fromIso: string,
  endIso: string,
  daysPerChunk: number,
): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = new Date(`${fromIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  if (cursor > end) return chunks;
  while (cursor <= end) {
    const chunkEnd = new Date(cursor.getTime());
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + daysPerChunk - 1);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push({ from: toIso(cursor), to: toIso(chunkEnd) });
    cursor = new Date(chunkEnd.getTime());
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return chunks;
}

function inclusiveDaysBetween(fromIso: string, toIso_: string): number {
  const start = new Date(`${fromIso}T00:00:00Z`).getTime();
  const end = new Date(`${toIso_}T00:00:00Z`).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayInGuatemala(): string {
  const now = new Date();
  const gt = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return gt.toISOString().slice(0, 10);
}

main();
