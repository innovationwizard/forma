/**
 * Status → visual treatment lookup for the Level 0 dashboard.
 *
 * Per D25 + Q7: canonical order is preserved on Level 0 — anomalies surface
 * via VISUAL treatment (color, badge, icon), never by reordering. This
 * module is the single source of truth for that visual mapping; the
 * components below import from here so a future palette tweak is a
 * one-file change.
 *
 * Palette: Tailwind emerald (ON_TRACK) / amber (AT_RISK) / red
 * (OVER_BUDGET) / zinc (NOT_STARTED / DELAYED) — confirmed by PLAN.md Q7.
 *
 * Accessibility: every status carries a visible LABEL + ICON, not just a
 * color. Screen-reader and color-blind users get the same signal.
 */

import type { BudgetHealthStatus } from "@/lib/calc/types";

export interface StatusStyle {
  /// One-word label used in tile counters + badges.
  label: string;
  /// Single character or short glyph paired with the label for emphasis.
  /// Kept short to avoid font-dependent rendering.
  icon: string;
  /// Tailwind utility classes for the foreground bar/fill.
  barClass: string;
  /// Tailwind utility classes for the row's background tint.
  rowClass: string;
  /// Tailwind utility classes for the badge pill (used in CategoryBars +
  /// StatusTiles).
  badgeClass: string;
  /// Tailwind utility classes for the text version of the label.
  textClass: string;
}

const STYLES: Record<BudgetHealthStatus, StatusStyle> = {
  ON_TRACK: {
    label: "On track",
    icon: "•",
    barClass: "bg-emerald-500",
    rowClass: "bg-emerald-50/40",
    badgeClass: "bg-emerald-100 text-emerald-900 ring-emerald-200",
    textClass: "text-emerald-700",
  },
  AT_RISK: {
    label: "At risk",
    icon: "▲",
    barClass: "bg-amber-500",
    rowClass: "bg-amber-50/60",
    badgeClass: "bg-amber-100 text-amber-900 ring-amber-200",
    textClass: "text-amber-700",
  },
  OVER_BUDGET: {
    label: "Over budget",
    icon: "▲",
    barClass: "bg-red-600",
    rowClass: "bg-red-50/70",
    badgeClass: "bg-red-100 text-red-900 ring-red-300",
    textClass: "text-red-700",
  },
  DELAYED: {
    label: "Delayed",
    icon: "◷",
    barClass: "bg-zinc-400",
    rowClass: "bg-zinc-50/60",
    badgeClass: "bg-zinc-100 text-zinc-900 ring-zinc-200",
    textClass: "text-zinc-700",
  },
  NOT_STARTED: {
    label: "Not started",
    icon: "○",
    barClass: "bg-zinc-300",
    rowClass: "",
    badgeClass: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    textClass: "text-zinc-600",
  },
};

export function statusStyle(status: BudgetHealthStatus): StatusStyle {
  return STYLES[status];
}
