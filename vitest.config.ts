/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Vitest config — scoped to `tests/` directory for unit tests of pure
 * functions in `src/lib/calc/`. Per Rule 9, fixtures are isolated under
 * `tests/` and never imported by production code.
 *
 * End-to-end DB-backed verification lives in `scripts/verify-calc.ts`
 * (run via `pnpm verify:calc`) per the existing `verify:rbac` / `verify:rls`
 * convention — not in Vitest.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
