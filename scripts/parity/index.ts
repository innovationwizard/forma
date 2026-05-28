#!/usr/bin/env tsx
/**
 * Batch 18 — End-to-end parity CLI.
 *
 *   pnpm parity:report
 *
 * Loads the live Supabase DB, runs every assertion in `assertions.ts`,
 * writes `docs/parity-report.md`, and exits non-zero if any check fails.
 *
 * The same `assertions.ts` array drives `tests/parity/*.spec.ts`, so the
 * vitest run and the markdown report stay in lockstep.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

import { PrismaClient } from "@prisma/client";

import { assertions } from "./assertions";
import { renderMarkdownReport } from "./report";
import { runAssertions, summarize } from "./runner";

const REPORT_PATH = resolve(__dirname, "../../docs/parity-report.md");

async function main(): Promise<void> {
  const prisma = new PrismaClient({ log: ["warn", "error"] });
  try {
    process.stdout.write(`━━━ Batch 18 parity report ━━━\n`);
    process.stdout.write(`Running ${assertions.length} assertions against live DB…\n\n`);

    const results = await runAssertions(prisma, assertions);
    const summary = summarize(results);
    const report = renderMarkdownReport(results, summary, new Date());

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, report, "utf8");

    // Console summary (per-line so you see fail-fast info before the file is written)
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
    process.stdout.write(
      `\n${summary.passed}/${summary.total} passed · ${summary.failed} failed\n`,
    );
    process.stdout.write(`Wrote ${REPORT_PATH}\n`);

    if (summary.failed > 0) {
      process.stderr.write(
        `\n✗ One or more parity checks FAILED. See ${REPORT_PATH} for full detail.\n`,
      );
      process.exit(1);
    }
    process.stdout.write("\n✓ All parity checks passed.\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  process.stderr.write(
    `FATAL (parity:report unexpected): ${err instanceof Error ? err.message : String(err)}\n`,
  );
  if (err instanceof Error && err.stack) process.stderr.write(err.stack + "\n");
  process.exit(1);
});
