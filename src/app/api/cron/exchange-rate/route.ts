/**
 * Daily BANGUAT exchange-rate cron endpoint.
 *
 *   GET /api/cron/exchange-rate
 *
 * Idempotent per Guatemala-calendar date: re-running on the same day is a
 * no-op (the upsert reaches the same final row). Persists to `ExchangeRate`
 * with `source="BANGUAT"`; writes an `AuditLog` row attributed to the
 * `BANGUAT_CRON` synthetic user.
 *
 * Auth: production deployments set `CRON_SECRET` in env; Vercel Cron sends
 * `Authorization: Bearer ${CRON_SECRET}`. Locally the endpoint accepts
 * unauthenticated GETs to ease curl-based testing — but only when
 * `CRON_SECRET` is unset AND `NODE_ENV !== "production"`. Per
 * `feedback_prod_first_urls`, production is the default; localhost is the
 * explicit exception.
 *
 * Per D31 the route NEVER fails silently. Failures return a structured
 * JSON error with HTTP 503 (BANGUAT unreachable) or 500 (anything else).
 *
 * Response shape:
 *   200 → { ok: true, date, rateGtqPerUsd, mode: "fresh"|"unchanged" }
 *   401 → { ok: false, error: "unauthorized" }
 *   503 → { ok: false, error: "banguat_unreachable", cause }
 *   500 → { ok: false, error: "internal", cause }
 */

import { NextResponse, type NextRequest } from "next/server";

import { fetchToday } from "@/lib/banguat/fetch";
import { ensureBanguatCronUser } from "@/lib/banguat/system-user";
import { BanguatFetchError, BanguatParseError } from "@/lib/banguat/types";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = checkCronAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let rate;
  try {
    rate = await fetchToday();
  } catch (err) {
    if (err instanceof BanguatFetchError || err instanceof BanguatParseError) {
      return NextResponse.json(
        {
          ok: false,
          error: "banguat_unreachable",
          cause: err.message,
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: "internal",
        cause: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  // Determine fresh vs. unchanged so the response carries something
  // meaningful for cron monitoring dashboards.
  const dateBoundary = new Date(`${rate.date}T00:00:00Z`);
  const existing = await prisma.exchangeRate.findFirst({
    where: { date: dateBoundary, deletedAt: null },
  });
  const isUnchanged =
    existing != null && existing.rateGtqPerUsd.toString() === rate.rateGtqPerUsd;

  if (!isUnchanged) {
    const userId = await ensureBanguatCronUser(prisma);
    await prisma.$transaction(async (tx) => {
      await tx.exchangeRate.upsert({
        where: { date: dateBoundary },
        create: {
          date: dateBoundary,
          rateGtqPerUsd: rate.rateGtqPerUsd,
          source: "BANGUAT",
          isStale: false,
        },
        update: { rateGtqPerUsd: rate.rateGtqPerUsd, source: "BANGUAT", isStale: false },
      });
      await tx.auditLog.create({
        data: {
          userId,
          entityType: "ExchangeRate",
          entityId: "00000000-0000-4000-8000-000000000000",
          action: existing == null ? "CREATE" : "UPDATE",
          context: `cron BANGUAT fetch ${rate.date} = ${rate.rateGtqPerUsd}`,
          newValue: JSON.stringify({ date: rate.date, rateGtqPerUsd: rate.rateGtqPerUsd }),
        },
      });
    });
  }

  return NextResponse.json(
    {
      ok: true,
      date: rate.date,
      rateGtqPerUsd: rate.rateGtqPerUsd,
      mode: isUnchanged ? "unchanged" : existing == null ? "fresh" : "updated",
    },
    { status: 200 },
  );
}

function checkCronAuth(request: NextRequest): { ok: boolean } {
  const secret = serverEnv.CRON_SECRET;
  if (secret == null) {
    // Local-dev convenience: allow unauthenticated GET when no secret is
    // configured AND we're not in production. In production, CRON_SECRET
    // is required (set during Batch 19 deploy).
    return { ok: serverEnv.NODE_ENV !== "production" };
  }
  const header = request.headers.get("authorization");
  return { ok: header === `Bearer ${secret}` };
}
