/**
 * Block 3 — financial bottom line per D28 (mirrors `FCFCasas2!A52:J88`
 * on the L0 dashboard).
 *
 * Surfaces four sub-cards:
 *   1. EBITDA (sin + con IVA totals + margin + latest month)
 *   2. Credit facility (current balance, monthly P+I, LTC stress signal
 *      per Q-LTC-CEILING — informational, not alarm)
 *   3. IVA position (cobrado / pagado / net payable)
 *   4. ISR obligations — BOTH labels literal per D34 (`"ISR 18"` and
 *      `"ISR 25"`); the calc layer carries pattern + rate, the UI does
 *      not abbreviate to "Effective"/"Nominal".
 */

import type {
  CreditFacilityState,
  EbitdaSnapshot,
  IsrSnapshot,
  IvaSnapshot,
} from "@/lib/calc/types";
import { formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

interface FinancialBottomLineProps {
  ebitda: EbitdaSnapshot;
  creditFacility: CreditFacilityState | null;
  iva: IvaSnapshot;
  isr: IsrSnapshot;
}

export function FinancialBottomLine({
  ebitda,
  creditFacility,
  iva,
  isr,
}: FinancialBottomLineProps) {
  return (
    <section
      aria-labelledby="bottom-line-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <h2 id="bottom-line-title" className="text-foreground text-base font-semibold">
            RESULTADO FINANCIERO
          </h2>
          <p className="text-foreground/40 text-[10px] italic">
            (EBITDA · crédito · IVA · ISR)
          </p>
        </div>
        <span className="text-foreground/50 text-xs">
          EBITDA · crédito · IVA · ISR
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <EbitdaCard ebitda={ebitda} />
        <CreditFacilityCard facility={creditFacility} />
        <IvaCard iva={iva} />
        <IsrCard isr={isr} />
      </div>
    </section>
  );
}

function SubCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "border-foreground/10 bg-background/50 rounded-xl border p-4",
        className,
      )}
    >
      <h3 className="text-foreground/60 text-xs font-medium tracking-wider uppercase">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </article>
  );
}

function EbitdaCard({ ebitda }: { ebitda: EbitdaSnapshot }) {
  return (
    <SubCard title="EBITDA (proyecto)">
      <div className="flex items-baseline gap-2">
        <span className="text-foreground text-2xl font-semibold tabular-nums">
          {formatUsd(ebitda.totalEbitdaUsd)}
        </span>
        <span className="text-foreground/50 text-xs">sin IVA</span>
      </div>
      <dl className="text-foreground/70 mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-foreground/50">Con IVA</dt>
        <dd className="text-foreground text-right tabular-nums">
          {formatUsd(ebitda.totalEbitdaConIvaUsd)}
        </dd>
        <dt className="text-foreground/50">Margen</dt>
        <dd className="text-foreground text-right tabular-nums">
          {formatPct(ebitda.marginPct)}
        </dd>
        {ebitda.latestMonth ? (
          <>
            <dt className="text-foreground/50">
              Último (M{ebitda.latestMonth.monthNumber})
            </dt>
            <dd className="text-foreground text-right tabular-nums">
              {formatUsd(ebitda.latestMonth.ebitdaUsd)}
            </dd>
          </>
        ) : null}
      </dl>
    </SubCard>
  );
}

function CreditFacilityCard({ facility }: { facility: CreditFacilityState | null }) {
  if (facility == null) {
    return (
      <SubCard title="Crédito bancario">
        <p className="text-foreground/60 text-sm">Sin crédito activo registrado.</p>
      </SubCard>
    );
  }
  const stress = facility.inStressZone;
  return (
    <SubCard title="Crédito bancario">
      <div className="text-foreground/60 text-xs">{facility.lenderName}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-foreground text-2xl font-semibold tabular-nums">
          {formatUsd(facility.currentBalanceUsd)}
        </span>
        <span className="text-foreground/50 text-xs">saldo</span>
      </div>
      <dl className="text-foreground/70 mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-foreground/50">Cupo inicial</dt>
        <dd className="text-foreground text-right tabular-nums">
          {formatUsd(facility.initialCapUsd)}
        </dd>
        <dt className="text-foreground/50">Interés mensual</dt>
        <dd className="text-foreground text-right tabular-nums">
          {formatUsd(facility.monthlyInterestUsd)}
        </dd>
        <dt className="text-foreground/50">Capital mensual</dt>
        <dd className="text-foreground text-right tabular-nums">
          {formatUsd(facility.monthlyPrincipalPaymentUsd)}
        </dd>
        <dt className="text-foreground/50">LTC / tope</dt>
        <dd
          className={cn(
            "text-right tabular-nums",
            stress ? "text-amber-700" : "text-foreground",
          )}
        >
          {formatPct(facility.currentLtc)} / {formatPct(facility.ltcCeiling)}
        </dd>
      </dl>
      {stress ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200 ring-inset">
          <span aria-hidden className="mr-1">▲</span>
          Sobre el tope LTC — informativo por Q-LTC-CEILING.
        </p>
      ) : null}
    </SubCard>
  );
}

function IvaCard({ iva }: { iva: IvaSnapshot }) {
  const net = Number(iva.netIvaPayableUsd);
  return (
    <SubCard title="Posición de IVA">
      <div className="flex items-baseline gap-2">
        <span className="text-foreground text-2xl font-semibold tabular-nums">
          {formatUsd(iva.netIvaPayableUsd)}
        </span>
        <span className="text-foreground/50 text-xs">
          {net >= 0 ? "neto a pagar" : "neto a favor"}
        </span>
      </div>
      <dl className="text-foreground/70 mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-foreground/50">Cobrado</dt>
        <dd className="text-foreground text-right tabular-nums">
          {formatUsd(iva.ivaCobradoUsd)}
        </dd>
        <dt className="text-foreground/50">Pagado</dt>
        <dd className="text-foreground text-right tabular-nums">
          {formatUsd(iva.ivaPagadoUsd)}
        </dd>
      </dl>
    </SubCard>
  );
}

function IsrCard({ isr }: { isr: IsrSnapshot }) {
  return (
    <SubCard title="Obligaciones de ISR">
      <div className="flex items-baseline gap-2">
        <span className="text-foreground text-2xl font-semibold tabular-nums">
          {formatUsd(isr.projectedTotalIsrUsd)}
        </span>
        <span className="text-foreground/50 text-xs">proyectado</span>
      </div>
      <ul className="text-foreground/70 mt-3 space-y-1 text-xs">
        {isr.obligations.map((o) => (
          <li key={o.uiLabel} className="flex items-baseline justify-between gap-2">
            <span className="flex items-baseline gap-2">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase text-zinc-700 ring-1 ring-zinc-200 ring-inset">
                {o.uiLabel}
              </span>
              <span className="text-foreground/50 normal-case">
                {isrPatternLabel(o.appliedIfPattern)}
              </span>
            </span>
            <span className="text-foreground tabular-nums">
              {formatPct(o.rate)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-foreground/50 mt-3 text-[10px]">
        Base de utilidad antes de impuestos: {formatUsd(isr.preTaxProfitBasisUsd)}
      </p>
    </SubCard>
  );
}

/// Convert ISR payment-pattern enum to Spanish display label.
function isrPatternLabel(p: string): string {
  switch (p) {
    case "LUMP_END":
      return "pago único al cierre";
    case "QUARTERLY":
      return "trimestral";
    case "ANNUAL":
      return "anual";
    case "CUSTOM_TRIGGER":
      return "evento gatillo";
    case "COMPOSITE":
      return "compuesto";
    default:
      return p.toLowerCase().replace(/_/g, " ");
  }
}
