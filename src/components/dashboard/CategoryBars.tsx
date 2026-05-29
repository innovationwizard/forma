/**
 * Block 1 — cost summary per D25.
 *
 * Renders the 11 dashboard-visible BudgetCategories IN CANONICAL ORDER
 * (BudgetCategory.sortOrder asc, matching FCFCasas2!A10:I20). Per D25 +
 * `feedback_intent_vs_implementation`:
 *
 *   > Canonical order is sacred. NEVER REORDER on the L0 dashboard.
 *   > Anomaly visibility comes from VISUAL TREATMENT (color, badges,
 *   > icons), not from re-sorting.
 *
 * The CEO learns the layout once; OVER_BUDGET items (TERRENOS today)
 * stand out via the red bar + ▲ badge wherever they sit in the list.
 *
 * Bars cap at 100% with an overflow indicator (`>100%` text) for
 * OVER_BUDGET categories. NOT_STARTED categories show a hollow track
 * with no fill.
 */

import Link from "next/link";

import type { CategoryHealth } from "@/lib/calc/types";
import { formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

import { statusStyle } from "./status-style";

interface CategoryBarsProps {
  categories: CategoryHealth[];
}

export function CategoryBars({ categories }: CategoryBarsProps) {
  // Per D25: filter to dashboard-visible categories. Order is the array
  // order given by the caller (already sorted by sortOrder via the DAL).
  const rows = categories.filter((c) => c.dashboardVisible);

  return (
    <section
      aria-labelledby="category-bars-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <h2 id="category-bars-title" className="text-foreground text-base font-semibold">
        CATEGORÍAS
      </h2>

      <ul role="list" className="mt-4 divide-y divide-zinc-100">
        {rows.map((c) => (
          <CategoryRow key={c.code} category={c} />
        ))}
      </ul>
    </section>
  );
}

function CategoryRow({ category }: { category: CategoryHealth }) {
  const style = statusStyle(category.status);
  const pctConsumed = Number(category.pctConsumed);
  const hasSpend = Number(category.spentUsd) > 0;
  // Visual fill caps at 100% so OVER rows don't push pixels off-row.
  const fillPct = Number.isFinite(pctConsumed)
    ? Math.min(1, Math.max(0, pctConsumed))
    : 0;
  const isOver = category.status === "OVER_BUDGET";

  const detailHref = `/category/${encodeURIComponent(category.code)}`;
  return (
    <li className={cn("rounded-md px-2 py-3 transition-colors hover:bg-zinc-50", style.rowClass)}>
      <Link
        href={detailHref}
        className="block focus:outline-none focus:ring-2 focus:ring-foreground/30 rounded-md"
        aria-label={`Abrir detalle de la categoría ${category.name}`}
      >
        <div className="grid grid-cols-[1fr_auto] items-baseline gap-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn("text-sm tabular-nums", style.textClass)}
              title={style.label}
            >
              {style.icon}
            </span>
            <span className="text-foreground truncate text-sm font-medium">
              {category.name}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
                style.badgeClass,
              )}
            >
              {style.label}
            </span>
          </div>
          <div className="text-foreground text-sm tabular-nums">
            {hasSpend ? formatPct(pctConsumed) : "—"}
          </div>
        </div>

      <div
        className="border-foreground/5 mt-2 h-2.5 w-full overflow-hidden rounded-full border bg-zinc-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={
          Number.isFinite(pctConsumed)
            ? Number((pctConsumed * 100).toFixed(1))
            : 0
        }
        aria-label={`${category.name}: ${
          hasSpend ? formatPct(pctConsumed) : "sin gasto"
        } del presupuesto consumido`}
      >
        <div
          className={cn("h-full", hasSpend ? style.barClass : "bg-transparent")}
          style={{ width: `${(fillPct * 100).toFixed(2)}%` }}
        />
      </div>

      <div className="text-foreground/60 mt-1.5 flex items-baseline justify-between gap-2 text-xs tabular-nums">
        <span>
          {formatUsd(category.spentUsd)} de {formatUsd(category.budgetUsd)}
        </span>
        {isOver ? (
          <span className={cn("font-medium", style.textClass)}>
            Sobre por {formatUsd(Math.abs(Number(category.remainingUsd)))}
          </span>
        ) : (
          <span className="text-foreground/50">
            {formatUsd(category.remainingUsd)} restante
          </span>
        )}
      </div>
      </Link>
    </li>
  );
}
