/**
 * Entity-scoped audit history.
 *
 * Shows every AuditLog row for this Expenditure in reverse-chronological
 * order: who, when, what action, which field, before → after, plus a
 * free-text context for VOID / FLAG reasons.
 *
 * Server component — pure rendering of a denormalized list shipped by
 * `loadTransactionDetail`. Per `feedback_audit_log` (D8 in PROGRESS.md):
 * the audit log is immutable; rows are never updated or deleted. So this
 * view is read-only by definition.
 */

import type { AuditEvent } from "@/lib/queries/transaction-detail";
import { cn } from "@/lib/utils";

interface AuditTimelineProps {
  events: AuditEvent[];
}

export function AuditTimeline({ events }: AuditTimelineProps) {
  return (
    <section
      aria-labelledby="audit-title"
      className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm"
    >
      <div>
        <h2 id="audit-title" className="text-foreground text-base font-semibold">
          HISTORIAL ({events.length})
        </h2>
              </div>

      {events.length === 0 ? (
        <p className="text-foreground/60 mt-3 text-sm">
          No hay eventos de auditoría para esta transacción.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {events.map((e) => (
            <li
              key={e.id}
              className="border-foreground/5 bg-background/50 rounded-lg border p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
                      actionClass(e.action),
                    )}
                  >
                    {auditActionLabel(e.action)}
                  </span>
                  {e.fieldName != null ? (
                    <span className="text-foreground/70 font-mono text-xs">
                      {e.fieldName}
                    </span>
                  ) : null}
                </div>
                <span className="text-foreground/50 text-xs tabular-nums">
                  {new Date(e.timestamp).toLocaleString("es-GT")}
                </span>
              </div>

              {e.fieldName != null && (e.oldValue != null || e.newValue != null) ? (
                <div className="text-foreground/70 mt-2 text-xs">
                  <span className="text-foreground/50">{e.oldValue ?? "(ninguno)"}</span>{" "}
                  <span className="text-foreground/40">→</span>{" "}
                  <span className="text-foreground font-medium">
                    {e.newValue ?? "(ninguno)"}
                  </span>
                </div>
              ) : null}

              {e.context != null ? (
                <p className="text-foreground/60 mt-2 text-xs">{e.context}</p>
              ) : null}

              <p className="text-foreground/40 mt-2 text-[10px]">
                por {e.user?.fullName ?? "(sistema / usuario eliminado)"}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function actionClass(action: AuditEvent["action"]): string {
  switch (action) {
    case "CREATE":
    case "IMPORT":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "UPDATE":
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
    case "VOID":
    case "DELETE":
      return "bg-red-50 text-red-900 ring-red-200";
  }
}

function auditActionLabel(action: AuditEvent["action"]): string {
  switch (action) {
    case "CREATE":
      return "CREADA";
    case "IMPORT":
      return "IMPORTADA";
    case "UPDATE":
      return "ACTUALIZADA";
    case "VOID":
      return "ANULADA";
    case "DELETE":
      return "ELIMINADA";
  }
}
