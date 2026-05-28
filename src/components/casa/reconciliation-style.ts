/**
 * Status → visual treatment lookup for the per-house reconciliation table.
 *
 * Same palette discipline as `src/components/dashboard/status-style.ts`:
 * 3 a11y channels per status (label + icon + color), so color-blind /
 * screen-reader users get the same signal as sighted users.
 */

import type { ReconciliationStatus } from "@/lib/calc/reconciliation";

export interface StatusStyle {
  label: string;
  icon: string;
  pillClass: string; // for the badge pill
  rowClass: string; // for the row tint (subtle)
  textClass: string; // for the delta text color
}

const STYLES: Record<ReconciliationStatus, StatusStyle> = {
  MATCHED: {
    label: "Coincide",
    icon: "•",
    pillClass: "bg-emerald-100 text-emerald-900 ring-emerald-200",
    rowClass: "",
    textClass: "text-emerald-700",
  },
  OVERPAYMENT: {
    label: "Sobrepago",
    icon: "▲",
    pillClass: "bg-sky-100 text-sky-900 ring-sky-200",
    rowClass: "bg-sky-50/40",
    textClass: "text-sky-700",
  },
  UNDERPAYMENT: {
    label: "Subpago",
    icon: "▽",
    pillClass: "bg-amber-100 text-amber-900 ring-amber-200",
    rowClass: "bg-amber-50/40",
    textClass: "text-amber-700",
  },
  MISSED: {
    label: "Omitido",
    icon: "✕",
    pillClass: "bg-red-100 text-red-900 ring-red-300",
    rowClass: "bg-red-50/40",
    textClass: "text-red-700",
  },
  UPCOMING: {
    label: "Por venir",
    icon: "◷",
    pillClass: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    rowClass: "",
    textClass: "text-zinc-600",
  },
  UNEXPECTED_PAYMENT: {
    label: "Inesperado",
    icon: "▲",
    pillClass: "bg-violet-100 text-violet-900 ring-violet-200",
    rowClass: "bg-violet-50/40",
    textClass: "text-violet-700",
  },
  NO_ACTIVITY: {
    label: "—",
    icon: "○",
    pillClass: "bg-zinc-50 text-zinc-500 ring-zinc-200",
    rowClass: "",
    textClass: "text-zinc-500",
  },
};

export function reconciliationStyle(status: ReconciliationStatus): StatusStyle {
  return STYLES[status];
}
