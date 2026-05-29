/**
 * Global audit-log browser — Batch 17.
 *
 *   /audit?user=<id>&entityType=<str>&action=<enum>&from=<date>&to=<date>&q=<text>&page=<n>
 *
 * Filterable, paginated, read-only. Per D8 the audit log is immutable —
 * no mutate-this-row UI. Every entry has timestamp + user + action +
 * entity reference + (optional) field-level diff + context note.
 */

import Link from "next/link";

import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { loadAuditBrowser, type AuditBrowserFilters } from "@/lib/queries/audit-browser";
import { cn } from "@/lib/utils";

import type { AuditAction } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_ACTIONS: ReadonlySet<AuditAction> = new Set([
  "CREATE",
  "UPDATE",
  "DELETE",
  "VOID",
  "IMPORT",
]);

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AuditPage({ searchParams }: PageProps) {
  await requireRole();
  const search = await searchParams;

  const filters: AuditBrowserFilters = {
    userId: oneOf(search["user"]) ?? null,
    entityType: oneOf(search["entityType"]) ?? null,
    entityId: oneOf(search["entityId"]) ?? null,
    action: parseAction(oneOf(search["action"])),
    fromDate: oneOf(search["from"]) ?? null,
    toDate: oneOf(search["to"]) ?? null,
    query: oneOf(search["q"]) ?? null,
    page: Number(oneOf(search["page"]) ?? "1") || 1,
  };

  const snapshot = await loadAuditBrowser(prisma, filters);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <Link
          href="/"
          className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          ← Volver al tablero
        </Link>
        <div className="mt-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            REGISTRO DE ACTIVIDAD
          </h1>
                  </div>
      </header>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div>
          <h2 className="text-foreground text-base font-semibold">FILTROS</h2>
                  </div>
        <form action="/audit" method="GET" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Usuario">
            <select name="user" defaultValue={filters.userId ?? ""} className={inputClass}>
              <option value="">— cualquiera —</option>
              {snapshot.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de entidad">
            <select name="entityType" defaultValue={filters.entityType ?? ""} className={inputClass}>
              <option value="">— cualquiera —</option>
              {snapshot.entityTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Acción">
            <select name="action" defaultValue={filters.action ?? ""} className={inputClass}>
              <option value="">— cualquiera —</option>
              {[...VALID_ACTIONS].map((a) => (
                <option key={a} value={a}>
                  {actionLabelEs(a)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ID de entidad (exacto)">
            <input
              type="text"
              name="entityId"
              defaultValue={filters.entityId ?? ""}
              placeholder="UUID"
              className={inputClass}
            />
          </Field>
          <Field label="Fecha desde">
            <input
              type="date"
              name="from"
              defaultValue={filters.fromDate ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Fecha hasta">
            <input
              type="date"
              name="to"
              defaultValue={filters.toDate ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Búsqueda libre">
            <input
              type="search"
              name="q"
              defaultValue={filters.query ?? ""}
              placeholder="contexto / campo / valores"
              className={inputClass}
            />
          </Field>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="bg-foreground text-background rounded-md px-3 py-2 text-xs font-medium"
            >
              Aplicar
            </button>
            <Link
              href="/audit"
              className="border-foreground/20 text-foreground hover:bg-zinc-50 rounded-md border px-3 py-2 text-xs font-medium"
            >
              Limpiar
            </Link>
          </div>
        </form>
      </section>

      <section className="border-foreground/10 bg-card text-card-foreground rounded-2xl border p-6 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-foreground text-base font-semibold">
              EVENTOS {snapshot.total > 0 ? `(${snapshot.total} coinciden)` : ""}
            </h2>
                      </div>
          <span className="text-foreground/50 text-xs tabular-nums">
            Página {snapshot.page} de {snapshot.totalPages}
          </span>
        </div>

        {snapshot.rows.length === 0 ? (
          <p className="text-foreground/60 mt-3 text-sm">Ningún evento coincide con los filtros activos.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="text-foreground/80 w-full text-xs">
              <thead>
                <tr className="border-foreground/10 text-foreground/60 border-b text-left font-medium tracking-wide uppercase">
                  <th scope="col" className="py-2 pr-2">Cuándo</th>
                  <th scope="col" className="py-2 pr-2">Quién</th>
                  <th scope="col" className="py-2 pr-2">Acción</th>
                  <th scope="col" className="py-2 pr-2">Entidad</th>
                  <th scope="col" className="py-2 pr-2">Campo</th>
                  <th scope="col" className="py-2 pr-2">Cambio</th>
                  <th scope="col" className="py-2">Contexto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {snapshot.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-foreground/70 py-1.5 pr-2 whitespace-nowrap tabular-nums">
                      {new Date(r.timestamp).toLocaleString("es-GT")}
                    </td>
                    <td className="text-foreground py-1.5 pr-2">
                      {r.user?.fullName ?? "(desconocido)"}
                    </td>
                    <td className="py-1.5 pr-2">
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset",
                          actionClass(r.action),
                        )}
                      >
                        {actionLabelEs(r.action)}
                      </span>
                    </td>
                    <td className="text-foreground/70 py-1.5 pr-2 font-mono text-[10px]">
                      {r.entityType}
                      <span className="text-foreground/40"> · </span>
                      <span className="text-foreground/60">{r.entityId.slice(0, 8)}…</span>
                    </td>
                    <td className="text-foreground/70 py-1.5 pr-2 font-mono text-[10px]">
                      {r.fieldName ?? "—"}
                    </td>
                    <td className="text-foreground/70 py-1.5 pr-2 text-[10px]">
                      {r.fieldName != null && (r.oldValue != null || r.newValue != null) ? (
                        <span>
                          <span className="text-foreground/50">{truncate(r.oldValue, 30) ?? "(ninguno)"}</span>
                          <span className="text-foreground/40"> → </span>
                          <span className="text-foreground">{truncate(r.newValue, 30) ?? "(ninguno)"}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-foreground/70 py-1.5 max-w-md truncate" title={r.context ?? ""}>
                      {r.context ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {snapshot.totalPages > 1 ? (
          <Pagination current={snapshot.page} total={snapshot.totalPages} filters={filters} />
        ) : null}
      </section>
    </main>
  );
}

function Pagination({
  current,
  total,
  filters,
}: {
  current: number;
  total: number;
  filters: AuditBrowserFilters;
}) {
  function pageHref(p: number): string {
    const params = new URLSearchParams();
    if (filters.userId != null) params.set("user", filters.userId);
    if (filters.entityType != null) params.set("entityType", filters.entityType);
    if (filters.entityId != null) params.set("entityId", filters.entityId);
    if (filters.action != null) params.set("action", filters.action);
    if (filters.fromDate != null) params.set("from", filters.fromDate);
    if (filters.toDate != null) params.set("to", filters.toDate);
    if (filters.query != null) params.set("q", filters.query);
    params.set("page", p.toString());
    return `/audit?${params.toString()}`;
  }
  const prev = Math.max(1, current - 1);
  const next = Math.min(total, current + 1);
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-xs">
      <Link
        href={pageHref(prev)}
        className={cn(
          "border-foreground/20 text-foreground hover:bg-zinc-50 rounded-md border px-3 py-1.5",
          current === 1 && "pointer-events-none opacity-50",
        )}
        aria-disabled={current === 1}
      >
        ← Anterior
      </Link>
      <span className="text-foreground/60 tabular-nums">
        Página {current} de {total}
      </span>
      <Link
        href={pageHref(next)}
        className={cn(
          "border-foreground/20 text-foreground hover:bg-zinc-50 rounded-md border px-3 py-1.5",
          current === total && "pointer-events-none opacity-50",
        )}
        aria-disabled={current === total}
      >
        Siguiente →
      </Link>
    </div>
  );
}

function actionClass(a: AuditAction): string {
  switch (a) {
    case "CREATE":
    case "IMPORT":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "UPDATE":
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
    case "DELETE":
    case "VOID":
      return "bg-red-50 text-red-900 ring-red-200";
  }
}

function actionLabelEs(a: AuditAction): string {
  switch (a) {
    case "CREATE":
      return "CREAR";
    case "IMPORT":
      return "IMPORTAR";
    case "UPDATE":
      return "ACTUALIZAR";
    case "DELETE":
      return "ELIMINAR";
    case "VOID":
      return "ANULAR";
  }
}

const inputClass =
  "border-foreground/10 focus:ring-foreground/40 w-full rounded-md border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-foreground/60 text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function oneOf(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseAction(v: string | undefined): AuditAction | null {
  if (v == null || v === "") return null;
  return VALID_ACTIONS.has(v as AuditAction) ? (v as AuditAction) : null;
}

function truncate(s: string | null, max: number): string | null {
  if (s == null) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
