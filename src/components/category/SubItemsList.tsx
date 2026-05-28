/**
 * Sub-items list per SDD §5 Level 1.
 *
 * Renders the L3 PARTIDA INTERNA breakdown (BudgetSubItem rows) for the
 * current category. For most Santa Elena categories this is a handful of
 * rows; for CONSTRUCCION it'll be larger when that data lands.
 *
 * No interactive features — purely a static table. Per Rule 8 money is
 * decimal-as-string in props; we render via formatters.
 */

import { formatUsd } from "@/lib/format";

interface SubItem {
  id: string;
  code: string;
  description: string;
  unit: string | null;
  quantity: string | null;
  unitPriceUsd: string | null;
  totalUsd: string;
}

interface SubItemsListProps {
  subItems: SubItem[];
}

export function SubItemsList({ subItems }: SubItemsListProps) {
  if (subItems.length === 0) {
    return (
      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <h2 className="text-foreground text-base font-semibold">Sub-items</h2>
        <p className="text-foreground/60 mt-3 text-sm">
          No sub-items recorded for this category.
        </p>
      </section>
    );
  }

  const total = subItems
    .reduce((acc, si) => acc + Number(si.totalUsd), 0)
    .toFixed(2);

  return (
    <section
      aria-labelledby="subitems-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="subitems-title" className="text-foreground text-base font-semibold">
          Sub-items ({subItems.length})
        </h2>
        <span className="text-foreground/50 text-xs tabular-nums">
          Total {formatUsd(total)}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="text-foreground/80 w-full text-sm">
          <thead>
            <tr className="border-foreground/10 text-foreground/60 border-b text-left text-xs font-medium tracking-wide uppercase">
              <th scope="col" className="py-2 pr-3 font-medium">Code</th>
              <th scope="col" className="py-2 pr-3 font-medium">Description</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Qty</th>
              <th scope="col" className="py-2 pr-3 font-medium">Unit</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Unit price</th>
              <th scope="col" className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {subItems.map((si) => (
              <tr key={si.id}>
                <td className="text-foreground/60 py-2 pr-3 font-mono text-xs">
                  {si.code}
                </td>
                <td className="text-foreground py-2 pr-3">{si.description}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {si.quantity ?? "—"}
                </td>
                <td className="text-foreground/60 py-2 pr-3 text-xs">
                  {si.unit ?? "—"}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {si.unitPriceUsd != null ? formatUsd(si.unitPriceUsd) : "—"}
                </td>
                <td className="text-foreground py-2 text-right font-medium tabular-nums">
                  {formatUsd(si.totalUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
