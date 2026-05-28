/**
 * Cell-comment extractor. Surfaces author signoff notes — e.g. Federico
 * Franco's "Ya Cotizado final" annotation at `Ppto Inversion!F20` per the
 * Ppto Inversion deep inspection. Modest parser logic; high CEO-trust value
 * because it preserves human annotations from the workbook author into the
 * dashboard.
 *
 * The parser emits a `CELL_COMMENT` flag for each non-empty comment with
 * INFO severity, so the app surfaces them in the audit/notes panel.
 */

import type { Cell } from "exceljs";

export interface ExtractedComment {
  text: string;
  author: string | null;
}

export function getCellComment(cell: Cell): ExtractedComment | null {
  // ExcelJS exposes comments through `cell.note`. The note can be a plain
  // string OR a structured object with `texts: [{ text, font? }]`.
  const note = cell.note as
    | string
    | { texts?: Array<{ text?: string }>; author?: string }
    | null
    | undefined;

  if (!note) return null;

  if (typeof note === "string") {
    const trimmed = note.trim();
    if (!trimmed) return null;
    return { text: trimmed, author: null };
  }

  // Structured note. Concatenate the segments to recover the full text.
  const segments = note.texts ?? [];
  const text = segments
    .map((s) => s.text ?? "")
    .join("")
    .trim();
  if (!text) return null;
  return { text, author: note.author ?? null };
}
