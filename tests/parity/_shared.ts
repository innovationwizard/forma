/**
 * Shared vitest harness for the parity specs (Batch 18).
 *
 * Each `tests/parity/*.spec.ts` file calls `runCategory("Foo")` once. That
 * filters the central assertion catalog by category and emits one `it()`
 * block per assertion — giving vitest's reporter granular per-claim output.
 *
 * Per the convention established in `vitest.config.ts`, unit tests in
 * `tests/calc/` use synthetic fixtures; the parity suite is DB-backed
 * because it asserts numbers that ONLY exist in the seeded DB. Make sure
 * `pnpm seed` has run before invoking `pnpm test` (or `pnpm test --run tests/parity`).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { assertions } from "../../scripts/parity/assertions";

// Single shared Prisma client across all parity spec files within a worker.
// vitest isolates workers per-file by default, so this is per-file in
// practice — that's fine, the connection cost is negligible vs the asserts.
let prisma: PrismaClient | null = null;
async function getPrisma(): Promise<PrismaClient> {
  if (!prisma) {
    const { PrismaClient: PC } = await import("@prisma/client");
    prisma = new PC({ log: ["warn", "error"] });
  }
  return prisma;
}

export function runCategory(category: string): void {
  const catAssertions = assertions.filter((a) => a.category === category);
  if (catAssertions.length === 0) {
    throw new Error(
      `parity:tests — no assertions found for category "${category}". Did you typo it?`,
    );
  }
  describe(`parity vs xlsx — ${category} (${catAssertions.length} assertions)`, () => {
    let p: PrismaClient;
    beforeAll(async () => {
      p = await getPrisma();
    });
    afterAll(async () => {
      if (prisma) {
        await prisma.$disconnect();
        prisma = null;
      }
    });
    for (const a of catAssertions) {
      it(`[${a.id}] ${a.description}`, async () => {
        const actual = await a.query(p);
        if (a.tolerance === 0) {
          expect(
            actual,
            `SDD ref: ${a.sddRef}\nexpected (exact): ${a.expected}\nactual: ${actual}`,
          ).toBe(a.expected);
        } else {
          const e = Number(a.expected);
          const ac = Number(actual);
          expect(Number.isFinite(ac), `actual not numeric: ${actual}`).toBe(true);
          const delta = Math.abs(e - ac);
          expect(
            delta,
            `SDD ref: ${a.sddRef}\nexpected: ${a.expected}\nactual:   ${actual}\nΔ:        ${delta}\ntolerance: ±${a.tolerance}`,
          ).toBeLessThanOrEqual(a.tolerance);
        }
      });
    }
  });
}
