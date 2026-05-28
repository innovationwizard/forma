/**
 * RvUnit status state-machine — Batch 15.
 *
 * Encodes the transitions documented in `prisma/schema.prisma` (per D9 +
 * `docs/CanonicalTaxonomy.md`):
 *
 *   AVAILABLE → SOFT_HOLD     (salesperson submits reservation)
 *   AVAILABLE → FROZEN        (salesperson submits freeze request)
 *   SOFT_HOLD → RESERVED      (admin confirms)
 *   SOFT_HOLD → AVAILABLE     (admin rejects)
 *   FROZEN    → AVAILABLE     (admin releases)
 *   FROZEN    → SOFT_HOLD     (salesperson submits reservation on frozen)
 *   RESERVED  → SOLD          (admin confirms)
 *   RESERVED  → AVAILABLE     (admin confirms desistimiento)
 *
 * `validateTransition()` is a pure function; the server action layer
 * gates BOTH on this AND on `can()`. Defense in depth.
 */

import type { RvUnitStatus } from "@prisma/client";

const ALLOWED: ReadonlyMap<RvUnitStatus, ReadonlySet<RvUnitStatus>> = new Map([
  ["AVAILABLE", new Set<RvUnitStatus>(["SOFT_HOLD", "FROZEN"])],
  ["SOFT_HOLD", new Set<RvUnitStatus>(["RESERVED", "AVAILABLE"])],
  ["FROZEN", new Set<RvUnitStatus>(["AVAILABLE", "SOFT_HOLD"])],
  ["RESERVED", new Set<RvUnitStatus>(["SOLD", "AVAILABLE"])],
  ["SOLD", new Set<RvUnitStatus>()], // terminal in v1; "scriptura" → out-of-scope
]);

export interface TransitionValidationResult {
  ok: boolean;
  /// Human-readable reason when ok=false. Surfaced to the UI as the
  /// rejection message; safe to display to users.
  message?: string;
}

export function validateTransition(
  from: RvUnitStatus,
  to: RvUnitStatus,
): TransitionValidationResult {
  if (from === to) {
    return { ok: false, message: `Status is already ${from}.` };
  }
  const allowed = ALLOWED.get(from);
  if (allowed == null) {
    return { ok: false, message: `Unknown source status: ${from}.` };
  }
  if (!allowed.has(to)) {
    return {
      ok: false,
      message: `Illegal transition: ${from} → ${to}. Allowed from ${from}: ${[...allowed].join(", ") || "(none)"}.`,
    };
  }
  return { ok: true };
}

/// List the legal next statuses from a given current status. Used by the UI
/// to show only valid buttons.
export function allowedNextStatuses(from: RvUnitStatus): RvUnitStatus[] {
  return [...(ALLOWED.get(from) ?? new Set<RvUnitStatus>())];
}
