import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

/**
 * Healthcheck endpoint. Proves the app process can reach Postgres via Prisma.
 *
 * Returns 200 on success, 503 on any failure (DNS, auth, pool exhaustion).
 *
 * Implementation: a raw `SELECT 1` round-trip. The earlier upsert against
 * `_health_check` was dropped in the Batch 4 schema migration. A raw query
 * is now the right shape — it verifies the connection layer without
 * coupling to any business table.
 */
export async function GET(): Promise<NextResponse> {
  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - startedAt);
    return NextResponse.json({ ok: true, latency_ms: latencyMs }, { status: 200 });
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
