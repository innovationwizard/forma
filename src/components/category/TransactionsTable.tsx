/**
 * Unified transactions table per SDD §5 Level 1 — Expenditure +
 * PartnerContribution rows in one chronological list.
 *
 * Filterable + sortable via URL search params (server-side, no client JS).
 * Each filter/sort control renders as a `<Link>` to the same page with
 * a tweaked query string — keeps the page a pure server component and
 * avoids client React state.
 *
 * Each row links to its L2 detail (`/transaction/{id}` for Expenditure;
 * PartnerContribution rows are POSTED-only today, no L2 yet — they get
 * a non-link badge until Batch 11 ships L2).
 */

import Link from "next/link";

import type {
  CategoryEventRow,
  SortKey,
} from "@/lib/queries/category-detail";
import { formatIsoDate, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ExpenditureStatus } from "@prisma/client";

type StatusFilter = ExpenditureStatus | "ALL";

interface TransactionsTableProps {
  categoryCode: string;
  events: CategoryEventRow[];
  totalEventCount: number;
  /// Currently-active URL state — drives the active link styling.
  activeSort: SortKey;
  activeStatus: StatusFilter;
  activeSearch: string;
}

const STATUS_FILTERS: StatusFilter[] = ["ALL", "VERIFIED", "PENDING", "FLAGGED", "VOIDED", "ANULADO"];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "date_desc", label: "Más recientes" },
  { key: "date_asc", label: "Más antiguas" },
  { key: "amount_desc", label: "Mayor monto" },
  { key: "amount_asc", label: "Menor monto" },
];

const STATUS_LABELS: Record<StatusFilter, string> = {
  ALL: "TODAS",
  VERIFIED: "VERIFICADA",
  PENDING: "PENDIENTE",
  FLAGGED: "MARCADA",
  VOIDED: "ANULADA (app)",
  ANULADO: "ANULADO (xlsx)",
};

export function TransactionsTable({
  categoryCode,
  events,
  totalEventCount,
  activeSort,
  activeStatus,
  activeSearch,
}: TransactionsTableProps) {
  return (
    <section
      aria-labelledby="transactions-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id="transactions-title" className="text-foreground text-base font-semibold">
            TRANSACCIONES
          </h2>
          <p className="text-foreground/40 text-[10px] italic">
            (Gastos + aportaciones de la categoría)
          </p>
        </div>
        <span className="text-foreground/50 text-xs tabular-nums">
          Mostrando {events.length} de {totalEventCount}
        </span>
      </div>

      <Filters
        categoryCode={categoryCode}
        activeSort={activeSort}
        activeStatus={activeStatus}
        activeSearch={activeSearch}
      />

      {events.length === 0 ? (
        <p className="text-foreground/60 mt-6 text-sm">
          Ninguna transacción coincide con los filtros activos.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="text-foreground/80 w-full text-sm">
            <thead>
              <tr className="border-foreground/10 text-foreground/60 border-b text-left text-xs font-medium tracking-wide uppercase">
                <th scope="col" className="py-2 pr-3 font-medium">Fecha</th>
                <th scope="col" className="py-2 pr-3 font-medium">Contraparte</th>
                <th scope="col" className="py-2 pr-3 font-medium">Descripción</th>
                <th scope="col" className="py-2 pr-3 font-medium">Tipo</th>
                <th scope="col" className="py-2 pr-3 font-medium">Estado</th>
                <th scope="col" className="py-2 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {events.map((e) => (
                <Row key={`${e.kind}-${e.id}`} event={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Filters({
  categoryCode,
  activeSort,
  activeStatus,
  activeSearch,
}: {
  categoryCode: string;
  activeSort: SortKey;
  activeStatus: StatusFilter;
  activeSearch: string;
}) {
  const base = `/category/${encodeURIComponent(categoryCode)}`;

  function href(overrides: Partial<{ sort: SortKey; status: StatusFilter; q: string }>): string {
    const p = new URLSearchParams();
    const sort = overrides.sort ?? activeSort;
    const status = overrides.status ?? activeStatus;
    const q = overrides.q ?? activeSearch;
    if (sort !== "date_desc") p.set("sort", sort);
    if (status !== "ALL") p.set("status", status);
    if (q.length > 0) p.set("q", q);
    const qs = p.toString();
    return qs.length > 0 ? `${base}?${qs}` : base;
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-foreground/50 mr-1 text-[10px] font-medium tracking-wide uppercase">
          Estado:
        </span>
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={href({ status: s })}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs ring-1 ring-inset",
              s === activeStatus
                ? "bg-foreground text-background ring-foreground"
                : "bg-background text-foreground/70 ring-zinc-200 hover:bg-zinc-50",
            )}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-foreground/50 mr-1 text-[10px] font-medium tracking-wide uppercase">
          Ordenar:
        </span>
        {SORT_OPTIONS.map((o) => (
          <Link
            key={o.key}
            href={href({ sort: o.key })}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs ring-1 ring-inset",
              o.key === activeSort
                ? "bg-foreground text-background ring-foreground"
                : "bg-background text-foreground/70 ring-zinc-200 hover:bg-zinc-50",
            )}
          >
            {o.label}
          </Link>
        ))}
      </div>

      <form action={base} method="GET" className="flex items-center gap-2">
        <label htmlFor="counterparty-search" className="sr-only">
          Buscar contraparte o descripción
        </label>
        <input
          id="counterparty-search"
          type="search"
          name="q"
          defaultValue={activeSearch}
          placeholder="Buscar contraparte o descripción…"
          className="border-foreground/10 focus:ring-foreground/40 w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 sm:max-w-xs"
        />
        {activeSort !== "date_desc" ? (
          <input type="hidden" name="sort" value={activeSort} />
        ) : null}
        {activeStatus !== "ALL" ? (
          <input type="hidden" name="status" value={activeStatus} />
        ) : null}
        <button
          type="submit"
          className="bg-foreground text-background rounded-md px-3 py-1.5 text-xs font-medium"
        >
          Buscar
        </button>
        {activeSearch.length > 0 ? (
          <Link
            href={href({ q: "" })}
            className="text-foreground/60 hover:text-foreground text-xs"
          >
            Limpiar
          </Link>
        ) : null}
      </form>
    </div>
  );
}

function Row({ event }: { event: CategoryEventRow }) {
  const statusClass = statusClassFor(event.status);
  const detailHref = event.kind === "EXPENDITURE" ? `/transaction/${event.id}` : null;
  return (
    <tr>
      <td className="text-foreground py-2 pr-3 tabular-nums">{formatIsoDate(event.date)}</td>
      <td className="text-foreground py-2 pr-3 font-medium">{event.counterparty}</td>
      <td className="text-foreground/70 max-w-md truncate py-2 pr-3" title={event.description}>
        {event.description}
      </td>
      <td className="py-2 pr-3">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
            event.kind === "PARTNER_CONTRIBUTION"
              ? "bg-violet-50 text-violet-900 ring-violet-200"
              : "bg-zinc-100 text-zinc-700 ring-zinc-200",
          )}
        >
          {event.kind === "PARTNER_CONTRIBUTION" ? "Aportación" : "Gasto"}
        </span>
      </td>
      <td className="py-2 pr-3">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
            statusClass,
          )}
        >
          {eventStatusLabel(event.status)}
        </span>
      </td>
      <td className="py-2 text-right tabular-nums">
        {detailHref != null ? (
          <Link href={detailHref} className="text-foreground hover:underline">
            {formatUsd(event.amountUsd)}
          </Link>
        ) : (
          <span className="text-foreground">{formatUsd(event.amountUsd)}</span>
        )}
      </td>
    </tr>
  );
}

function statusClassFor(status: CategoryEventRow["status"]): string {
  switch (status) {
    case "VERIFIED":
    case "POSTED":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "FLAGGED":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "VOIDED":
    case "ANULADO":
      return "bg-red-50 text-red-900 ring-red-200";
    case "PENDING":
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

/// Expenditure + PartnerContribution status enums → Spanish display labels.
function eventStatusLabel(s: CategoryEventRow["status"]): string {
  switch (s) {
    case "VERIFIED":
      return "VERIFICADA";
    case "POSTED":
      return "REGISTRADA";
    case "FLAGGED":
      return "MARCADA";
    case "VOIDED":
      return "ANULADA";
    case "ANULADO":
      return "ANULADO";
    case "PENDING":
      return "PENDIENTE";
    default:
      return s;
  }
}
