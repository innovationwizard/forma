#!/usr/bin/env tsx
/**
 * Fast smoke alias for the Batch 18 parity report — shares the SAME
 * assertion catalog at `scripts/parity/assertions.ts`. Use this when you
 * just want a one-line pass/fail and don't need the markdown artifact.
 *
 *   pnpm verify:calc    # short summary only
 *   pnpm parity:report  # full markdown report + summary
 *
 * Per Rule 8: exits non-zero on any parity failure.
 */

import { PrismaClient } from "@prisma/client";

import { assertions } from "./parity/assertions";
import { runAssertions, summarize } from "./parity/runner";

async function main(): Promise<void> {
  const prisma = new PrismaClient({ log: ["warn", "error"] });
  try {
    const results = await runAssertions(prisma, assertions);
    const summary = summarize(results);

    process.stdout.write(`━━━ verify:calc (${assertions.length} parity assertions) ━━━\n`);
    for (const r of results) {
      const icon = r.pass ? "✓" : "✗";
      const tol = r.tolerance === 0 ? "" : ` (tol ±${r.tolerance})`;
      process.stdout.write(`  ${icon} [${r.category}] ${r.description}${tol}\n`);
      if (!r.pass) {
        process.stdout.write(`      expected: ${r.expected}\n`);
        process.stdout.write(`      actual:   ${r.actual}\n`);
        if (r.error) process.stdout.write(`      error:    ${r.error}\n`);
      }
    }
    process.stdout.write(`\n${summary.passed}/${summary.total} passed · ${summary.failed} failed\n`);
    if (summary.failed > 0) {
      process.stderr.write("\n✗ verify:calc — one or more parity checks FAILED.\n");
      process.exit(1);
    }
    process.stdout.write("\n✓ All parity checks passed. (Run `pnpm parity:report` for the markdown artifact.)\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  process.stderr.write(
    `FATAL (verify:calc unexpected): ${err instanceof Error ? err.message : String(err)}\n`,
  );
  if (err instanceof Error && err.stack) process.stderr.write(err.stack + "\n");
  process.exit(1);
});
