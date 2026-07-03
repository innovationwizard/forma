/**
 * One-shot inspection of MAYO/ — emits MAYO/MANIFEST.md.
 *
 * Per Dirty George + _THE_RULES.MD Rule 1: describe ONLY what is observed.
 * No assumptions about what the data means.
 *
 * Run:  pnpm tsx scripts/inspect-mayo.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";

const MAYO_DIR = path.join(process.cwd(), "MAYO");
const OUT = path.join(MAYO_DIR, "MANIFEST.md");
const PREVIEW_ROWS = 30;

interface SheetSummary {
  name: string;
  ref: string;
  rows: number;
  cols: number;
  preview: (string | number | null)[][];
  nonEmptyCellCount: number;
  columnTypeSamples: Array<{ col: string; types: Record<string, number> }>;
}

function cellToText(c: XLSX.CellObject | undefined): string | number | null {
  if (c == null) return null;
  if (c.v == null) return null;
  if (c.t === "n") return c.v as number;
  if (c.t === "d") return (c.v as Date).toISOString().slice(0, 10);
  if (c.t === "b") return String(c.v);
  return String(c.v);
}

function summarizeSheet(ws: XLSX.WorkSheet, name: string): SheetSummary {
  const ref = ws["!ref"] ?? "A1:A1";
  const range = XLSX.utils.decode_range(ref);
  const rows = range.e.r - range.s.r + 1;
  const cols = range.e.c - range.s.c + 1;

  const preview: (string | number | null)[][] = [];
  for (let r = range.s.r; r <= Math.min(range.s.r + PREVIEW_ROWS - 1, range.e.r); r++) {
    const row: (string | number | null)[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      row.push(cellToText(ws[addr] as XLSX.CellObject | undefined));
    }
    preview.push(row);
  }

  let nonEmptyCellCount = 0;
  const colTypeCounts: Record<number, Record<string, number>> = {};
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      if (cell == null || cell.v == null || cell.v === "") continue;
      nonEmptyCellCount++;
      const t = cell.t ?? "?";
      const counts = (colTypeCounts[c] ??= {});
      counts[t] = (counts[t] ?? 0) + 1;
    }
  }
  const columnTypeSamples = Object.keys(colTypeCounts)
    .map(Number)
    .sort((a, b) => a - b)
    .map((c) => ({
      col: XLSX.utils.encode_col(c),
      types: colTypeCounts[c] ?? {},
    }));

  return { name, ref, rows, cols, preview, nonEmptyCellCount, columnTypeSamples };
}

function renderPreviewTable(preview: (string | number | null)[][]): string {
  if (preview.length === 0) return "_(empty sheet)_";
  const maxCols = Math.max(...preview.map((r) => r.length));
  const cols = Array.from({ length: maxCols }, (_, i) => XLSX.utils.encode_col(i));
  const header = "| # | " + cols.join(" | ") + " |";
  const sep = "|---|" + cols.map(() => "---").join("|") + "|";
  const body = preview
    .map((row, i) => {
      const cells = row.map((c) => {
        if (c == null) return "";
        const s = String(c).replace(/\|/g, "\\|").replace(/\n/g, " ");
        return s.length > 60 ? s.slice(0, 57) + "…" : s;
      });
      while (cells.length < maxCols) cells.push("");
      return `| ${i + 1} | ` + cells.join(" | ") + " |";
    })
    .join("\n");
  return [header, sep, body].join("\n");
}

function renderSheet(s: SheetSummary): string {
  const typeLine = s.columnTypeSamples
    .slice(0, 30)
    .map((c) => {
      const tEntries = Object.entries(c.types).map(([t, n]) => `${t}:${n}`).join(",");
      return `${c.col}(${tEntries})`;
    })
    .join("  ");
  return [
    `### Sheet: \`${s.name}\``,
    "",
    `- **Used range:** \`${s.ref}\` — ${s.rows} rows × ${s.cols} cols`,
    `- **Non-empty cells:** ${s.nonEmptyCellCount}`,
    `- **Column types** (truncated to first 30 cols; t = n number, s string, d date, b bool):`,
    `  - ${typeLine}`,
    "",
    `**Preview (first ${PREVIEW_ROWS} rows):**`,
    "",
    renderPreviewTable(s.preview),
    "",
  ].join("\n");
}

function inspectFile(filePath: string): string {
  const name = path.basename(filePath);
  const stat = fs.statSync(filePath);
  const wb = XLSX.readFile(filePath, { cellDates: true, cellNF: true, cellText: true });
  const sheetNames = wb.SheetNames;
  const sheets = sheetNames.map((n) => {
    const ws = wb.Sheets[n];
    if (ws == null) {
      // Listed in SheetNames but absent from Sheets — a real anomaly, not
      // something to skip silently (Dirty George / _THE_RULES Rule 1).
      throw new Error(`Sheet "${n}" is in SheetNames but missing from wb.Sheets`);
    }
    return summarizeSheet(ws, n);
  });

  const head = [
    `## File: \`${name}\``,
    "",
    `- **Size:** ${stat.size.toLocaleString()} bytes`,
    `- **Sheets (${sheetNames.length}):** ${sheetNames.map((n) => "`" + n + "`").join(", ")}`,
    "",
  ].join("\n");

  return [head, ...sheets.map(renderSheet)].join("\n");
}

function main() {
  if (!fs.existsSync(MAYO_DIR)) {
    console.error(`MAYO dir not found at ${MAYO_DIR}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(MAYO_DIR)
    .filter((f) => /\.xlsx?$/i.test(f))
    .sort()
    .map((f) => path.join(MAYO_DIR, f));

  const header = [
    `# MAYO/ — File manifest`,
    "",
    `_Generated by \`scripts/inspect-mayo.ts\`. Verbatim observation only — no interpretation._`,
    "",
    `**Generated:** ${new Date().toISOString()}`,
    `**Files scanned:** ${files.length}`,
    "",
    `---`,
    "",
  ].join("\n");

  const body = files.map(inspectFile).join("\n---\n\n");
  fs.writeFileSync(OUT, header + body);
  console.log(`Wrote ${OUT}`);
  console.log(`Files: ${files.length}`);
}

main();
