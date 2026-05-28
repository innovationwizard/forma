/**
 * Exchange-rate resolver.
 *
 * Order of precedence for `resolveRate(date)`:
 *   1. `ExchangeRate` cache hit on the exact date.
 *   2. BANGUAT live fetch (only if the date is today or earlier and the
 *      caller permits network — controlled by `allowFetch`).
 *   3. Nearest previous cached date; `isStale=true` on the returned row.
 *   4. Project's `lockedExchangeRate` as last-resort fallback. Returned
 *      with `isStale=true` AND `source="MANUAL"` so the UI can flag it.
 *
 * Per `_THE_RULES.MD` Rule 9 the historical seeded transactions keep their
 * per-tx TC (Detalle egresos finding #11) or project locked TC; this
 * resolver is for **forward-looking** calculations and manual entry only.
 * Backfilling the BANGUAT cache for past dates is fine — but importing
 * a BANGUAT rate into a historical Expenditure row is a `kind=MANUAL`
 * override decision a human must make, not an automatic one.
 *
 * Per D31 the resolver never throws on missing data — it returns a value
 * with `isStale=true` so the calling UI can decorate accordingly.
 */

import type { ExchangeRateSource, PrismaClient } from "@prisma/client";

import { fetchToday } from "@/lib/banguat/fetch";
import { ensureBanguatCronUser } from "@/lib/banguat/system-user";
import { BanguatFetchError } from "@/lib/banguat/types";

export interface ResolvedRate {
  /// Date we ultimately used (may differ from the requested date if we
  /// fell back to the nearest previous cached row).
  date: string;
  /// GTQ per USD as decimal string.
  rateGtqPerUsd: string;
  source: ExchangeRateSource;
  /// True if this is NOT the requested date's actual rate (fallback path).
  isStale: boolean;
  /// Original date the caller asked for. Lets the UI show
  /// "no rate for 2026-05-10, showing 2026-05-08".
  requestedDate: string;
}

export interface ResolveOptions {
  /// Allow live BANGUAT fetch on cache miss. Default true. Set false for
  /// hot paths that must remain DB-only (page renders).
  allowFetch?: boolean;
  /// Lock TC to use as last-resort fallback (Project.lockedExchangeRate).
  /// If omitted, the resolver returns a `7.7` literal — DEV ONLY; pass it
  /// in real calls.
  lockedExchangeRate?: string;
}

export async function resolveRate(
  prisma: PrismaClient,
  isoDate: string,
  opts: ResolveOptions = {},
): Promise<ResolvedRate> {
  const allowFetch = opts.allowFetch ?? true;
  const requestedDate = isoDate;

  // 1. Cache hit?
  const exact = await prisma.exchangeRate.findFirst({
    where: { date: new Date(`${isoDate}T00:00:00Z`), deletedAt: null },
  });
  if (exact != null) {
    return {
      date: toIso(exact.date),
      rateGtqPerUsd: exact.rateGtqPerUsd.toString(),
      source: exact.source,
      isStale: exact.isStale,
      requestedDate,
    };
  }

  // 2. Live BANGUAT for today (no past dates — we don't backfill on demand;
  //    use `banguat:backfill` for that).
  if (allowFetch && isoDate === todayInGuatemala()) {
    try {
      const live = await fetchToday();
      const userId = await ensureBanguatCronUser(prisma);
      await prisma.$transaction(async (tx) => {
        await tx.exchangeRate.upsert({
          where: { date: new Date(`${live.date}T00:00:00Z`) },
          create: {
            date: new Date(`${live.date}T00:00:00Z`),
            rateGtqPerUsd: live.rateGtqPerUsd,
            source: "BANGUAT",
            isStale: false,
          },
          update: { rateGtqPerUsd: live.rateGtqPerUsd, source: "BANGUAT", isStale: false },
        });
        await tx.auditLog.create({
          data: {
            userId,
            entityType: "ExchangeRate",
            entityId: "00000000-0000-4000-8000-000000000000",
            action: "CREATE",
            context: `resolveRate live-fetch ${live.date} = ${live.rateGtqPerUsd}`,
            newValue: JSON.stringify({ date: live.date, rateGtqPerUsd: live.rateGtqPerUsd }),
          },
        });
      });
      return {
        date: live.date,
        rateGtqPerUsd: live.rateGtqPerUsd,
        source: "BANGUAT",
        isStale: false,
        requestedDate,
      };
    } catch (err) {
      // BANGUAT unreachable — fall through to nearest-previous lookup.
      if (!(err instanceof BanguatFetchError)) throw err;
    }
  }

  // 3. Nearest previous cached date.
  const previous = await prisma.exchangeRate.findFirst({
    where: {
      date: { lt: new Date(`${isoDate}T00:00:00Z`) },
      deletedAt: null,
    },
    orderBy: { date: "desc" },
  });
  if (previous != null) {
    return {
      date: toIso(previous.date),
      rateGtqPerUsd: previous.rateGtqPerUsd.toString(),
      source: previous.source,
      isStale: true,
      requestedDate,
    };
  }

  // 4. Last resort — project locked TC.
  return {
    date: requestedDate,
    rateGtqPerUsd: opts.lockedExchangeRate ?? "7.7",
    source: "MANUAL",
    isStale: true,
    requestedDate,
  };
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/// "Today" in Guatemala time (UTC-6 year-round, no DST). The BANGUAT
/// publish boundary is local Guatemala calendar day, not UTC.
export function todayInGuatemala(): string {
  const now = new Date();
  // Subtract 6 hours, then read the UTC date components.
  const gt = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return gt.toISOString().slice(0, 10);
}
