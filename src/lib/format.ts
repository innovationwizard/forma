/**
 * UI-side display formatters. Money + percentage strings reach the client as
 * decimal-as-string per `_THE_RULES.MD` Rule 8; these helpers turn them into
 * what the CEO actually reads. All formatting is locale-pinned to `en-US` for
 * monetary stability — the underlying data is GTQ + USD but the dashboard
 * surfaces USD as the canonical CEO unit per SDD §5.
 */

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdCompactFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatUsd(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  return usdFormatter.format(n);
}

export function formatUsdCompact(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "$0";
  return usdCompactFormatter.format(n);
}

/// Renders a fractional value as a 1-decimal percentage (0.823 → "82.3%").
/// Returns "—" for non-finite (e.g. Infinity from zero-budget categories).
export function formatPct(fractional: string | number): string {
  const n = typeof fractional === "number" ? fractional : Number(fractional);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function formatInt(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0";
  return integerFormatter.format(n);
}

export function formatIsoDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return dateFormatter.format(d);
}
