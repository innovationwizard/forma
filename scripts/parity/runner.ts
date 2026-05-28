/**
 * Parity assertion runner — executes the assertions from `assertions.ts`
 * against a Prisma client and returns structured results.
 *
 * Pure function over an injected Prisma instance — used by both:
 *   - `scripts/parity/index.ts` (the CLI / report generator)
 *   - `tests/parity/*.spec.ts` (the vitest suite)
 */

import type { PrismaClient } from "@prisma/client";

import type { Assertion, AssertionResult } from "./assertions";

export async function runAssertions(
  prisma: PrismaClient,
  assertions: Assertion[],
): Promise<AssertionResult[]> {
  const results: AssertionResult[] = [];
  for (const a of assertions) {
    try {
      const actual = await a.query(prisma);
      results.push(buildResult(a, actual, null));
    } catch (err) {
      results.push(
        buildResult(a, "(error)", err instanceof Error ? err.message : String(err)),
      );
    }
  }
  return results;
}

function buildResult(a: Assertion, actual: string, error: string | null): AssertionResult {
  let pass = false;
  let delta = "—";
  if (error != null) {
    pass = false;
  } else if (a.tolerance === 0) {
    pass = actual === a.expected;
  } else {
    const e = Number(a.expected);
    const ac = Number(actual);
    if (Number.isFinite(e) && Number.isFinite(ac)) {
      const d = Math.abs(e - ac);
      delta = d.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
      pass = d <= a.tolerance;
    } else {
      pass = false;
    }
  }
  return {
    id: a.id,
    category: a.category,
    description: a.description,
    sddRef: a.sddRef,
    expected: a.expected,
    actual,
    delta,
    tolerance: a.tolerance,
    pass,
    error,
  };
}

export interface ResultSummary {
  total: number;
  passed: number;
  failed: number;
  byCategory: Array<{ category: string; total: number; passed: number; failed: number }>;
}

export function summarize(results: AssertionResult[]): ResultSummary {
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = total - passed;
  const cats = new Map<string, { passed: number; failed: number }>();
  for (const r of results) {
    const c = cats.get(r.category) ?? { passed: 0, failed: 0 };
    if (r.pass) c.passed++;
    else c.failed++;
    cats.set(r.category, c);
  }
  const byCategory = Array.from(cats.entries()).map(([category, v]) => ({
    category,
    total: v.passed + v.failed,
    passed: v.passed,
    failed: v.failed,
  }));
  return { total, passed, failed, byCategory };
}
