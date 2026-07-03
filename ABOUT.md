# About

## What it is

A budget tracker for the **Santa Elena** real-estate project (legal entity *Condominio Antigua Panorama, S.A.*, Antigua Guatemala). Pilot for FORMA's holding-wide data normalization initiative.

## What it does

- Replaces the analyst's spreadsheet upkeep for the project's monthly P&L.
- Imports bank statements, classifies each transaction, and reconciles plan vs. real per house (Casas 1–11).
- Tracks revenue per unit (sale + delivery schedule), executed budget vs. plan by category, IVA / ISR obligations, 36-month forecast, and ROI figures.
- Surfaces source-data anomalies as first-class records instead of silently dropping or rewriting them.

## How it does it

- **Next.js 16** (App Router) + **Tailwind 4** for the UI; **Prisma 6** + **Supabase** (Postgres + Auth + RLS) for persistence.
- **Centralized RBAC matrix** routes every read and mutation through a single typed gate (CEO / Analyst / Legal).
- **Medallion data layout**: bronze (verbatim xlsx + verbatim bank statements) → silver (normalized, classified, reconciled) → gold (computed dashboards).
- **Parser invariant (D31)**: never fails loudly, never fails silently. Every input cell is captured; data-quality issues become `DataQualityFlag` rows surfaced in `/anomalias` with provenance.
- **Audit invariant (D8)**: every mutation writes an `AuditLog` row in the same transaction.
- **Soft-delete invariant (D21)**: records are never physically dropped.

## More

- [SDD_FORMA_SANTA_ELENA.md](SDD_FORMA_SANTA_ELENA.md) — product spec
- [PLAN.md](PLAN.md) — batched implementation plan
- [PROGRESS.md](PROGRESS.md) — live tracker
- [_THE_RULES.MD](_THE_RULES.MD) — operating contract (read first)
