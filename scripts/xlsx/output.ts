/**
 * JSON bundle writer per the Batch 5 architectural baseline:
 *   - Output at `scripts/xlsx/output/parse-<UTC-timestamp>.json`
 *   - Symlink `parse-latest.json` always points at the latest run
 *   - Directory gitignored (contains PII per D3)
 *
 * Per D31: every parse always produces a bundle; no early-exit on data
 * issues. The writer also fails loud only on file-I/O failure (Rule 8).
 */

import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";

import type { ParseBundle } from "./types";

const OUTPUT_DIR = resolve(__dirname, "output");
const LATEST_NAME = "parse-latest.json";

export interface WriteResult {
  outputPath: string;
  latestPath: string;
  bytesWritten: number;
}

export function writeBundle(bundle: ParseBundle): WriteResult {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // UTC-timestamp filename — collision-free + sortable.
  const stamp = bundle.parsedAt.replace(/[:.]/g, "-");
  const fileName = `parse-${stamp}.json`;
  const outputPath = join(OUTPUT_DIR, fileName);

  const json = JSON.stringify(bundle, null, 2);
  writeFileSync(outputPath, json + "\n", { encoding: "utf-8" });
  const bytesWritten = statSync(outputPath).size;

  // Refresh the parse-latest.json symlink to point at this run.
  const latestPath = join(OUTPUT_DIR, LATEST_NAME);
  try {
    if (existsSync(latestPath)) unlinkSync(latestPath);
  } catch {
    // existsSync can lie for broken symlinks on some FS. Try unconditional unlink.
    try {
      unlinkSync(latestPath);
    } catch {
      /* tolerate ENOENT */
    }
  }
  symlinkSync(fileName, latestPath);

  return { outputPath, latestPath, bytesWritten };
}
