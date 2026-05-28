/**
 * Cell-fill detection for the parser, covering BOTH RGB and theme-palette
 * fills. The Python openpyxl-based deep inspection mishandled theme colors
 * (silent type error swallowed → "no notable color coding" output), missing
 * the analyst's PARTIDA INTERNA highlights in Detalle egresos. ExcelJS
 * exposes both forms cleanly.
 *
 * Returns a string identifier when a non-default fill is present, null
 * otherwise. The identifier is opaque (consumed by the seed only for
 * tagging); presence/absence is what drives the
 * `PARTIDA_FLAGGED_FOR_REVIEW` flag emission.
 */

import type { Cell } from "exceljs";

export function getNonDefaultFillId(cell: Cell): string | null {
  // ExcelJS may not have set `fill` on cells using the workbook default style.
  // `style.fill` is the canonical surface; `fill` is a passthrough convenience.
  const fill = (cell.fill ?? cell.style?.fill) as
    | {
        type?: string;
        pattern?: string;
        fgColor?: { argb?: string; theme?: number; tint?: number; indexed?: number };
        bgColor?: { argb?: string; theme?: number; tint?: number; indexed?: number };
      }
    | undefined;

  if (!fill) return null;
  if (fill.type !== "pattern") return null;
  // Pattern type "none" means no fill applied.
  if (!fill.pattern || fill.pattern === "none") return null;

  const fg = fill.fgColor;
  if (!fg) return null;

  // Skip the workbook's "no fill" defaults — argb 00000000 (transparent) and
  // FFFFFFFF (white) often appear as the default for an empty cell.
  if (fg.argb && fg.argb !== "00000000" && fg.argb !== "FFFFFFFF") {
    return `rgb:${fg.argb}`;
  }
  if (typeof fg.theme === "number") {
    const tint = typeof fg.tint === "number" ? fg.tint.toFixed(4) : "0";
    return `theme:${fg.theme}/${tint}`;
  }
  if (typeof fg.indexed === "number") {
    return `indexed:${fg.indexed}`;
  }
  return null;
}
