import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

/**
 * Healthcheck endpoint. Proves the app process can reach Postgres via Prisma
 * and that the round-trip latency is within expectations. Returns 200 on
 * success, 503 on any failure (DNS, auth, pool exhaustion, query error).
 *
 * Uses `upsert` against the `_health_check` table so the check exercises the
 * full path: connection pool → auth → query plan → row read + write. A raw
 * `SELECT 1` would skip everything past `auth`. The row is keyed at id=1 and
 * its `pingedAt` is refreshed on every request, giving operators a "last
 * successful DB write" signal.
 */
export async function GET(): Promise<NextResponse> {
  const startedAt = performance.now();
  try {
    const now = new Date();
    const row = await prisma.healthCheck.upsert({
      where: { id: 1 },
      create: { id: 1, pingedAt: now },
      update: { pingedAt: now },
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    return NextResponse.json(
      {
        ok: true,
        latency_ms: latencyMs,
        last_pinged_at: row.pingedAt.toISOString(),
      },
      { status: 200 },
    );
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt);
    return NextResponse.json(
      {
        ok: false,
        latency_ms: latencyMs,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}

// Healthcheck must always reflect live state — no caching, no ISR.
export const dynamic = "force-dynamic";
export const revalidate = 0;
