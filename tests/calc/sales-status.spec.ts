/**
 * RvUnit status state-machine tests — Batch 15.
 *
 * Exercises every transition from the schema's `RvUnitStatus` enum +
 * documented in CanonicalTaxonomy.md. The state machine is the spec —
 * if a transition isn't listed in `allowedNextStatuses(from)`, the action
 * server-side rejects with structured error.
 */

import { describe, expect, it } from "vitest";

import { allowedNextStatuses, validateTransition } from "../../src/lib/calc/sales-status";

describe("validateTransition — happy paths", () => {
  it("AVAILABLE → SOFT_HOLD (salesperson reservation submission)", () => {
    expect(validateTransition("AVAILABLE", "SOFT_HOLD").ok).toBe(true);
  });
  it("AVAILABLE → FROZEN (salesperson freeze)", () => {
    expect(validateTransition("AVAILABLE", "FROZEN").ok).toBe(true);
  });
  it("SOFT_HOLD → RESERVED (admin confirm)", () => {
    expect(validateTransition("SOFT_HOLD", "RESERVED").ok).toBe(true);
  });
  it("SOFT_HOLD → AVAILABLE (admin reject)", () => {
    expect(validateTransition("SOFT_HOLD", "AVAILABLE").ok).toBe(true);
  });
  it("FROZEN → AVAILABLE (admin release)", () => {
    expect(validateTransition("FROZEN", "AVAILABLE").ok).toBe(true);
  });
  it("FROZEN → SOFT_HOLD (reservation on frozen unit)", () => {
    expect(validateTransition("FROZEN", "SOFT_HOLD").ok).toBe(true);
  });
  it("RESERVED → SOLD (admin confirm sale)", () => {
    expect(validateTransition("RESERVED", "SOLD").ok).toBe(true);
  });
  it("RESERVED → AVAILABLE (admin confirm desistimiento)", () => {
    expect(validateTransition("RESERVED", "AVAILABLE").ok).toBe(true);
  });
});

describe("validateTransition — rejected paths", () => {
  it("rejects self-transition with explanatory message", () => {
    const r = validateTransition("AVAILABLE", "AVAILABLE");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("already AVAILABLE");
  });

  it("AVAILABLE → SOLD (must go through SOFT_HOLD + RESERVED)", () => {
    const r = validateTransition("AVAILABLE", "SOLD");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Illegal transition");
  });

  it("AVAILABLE → RESERVED (must go through SOFT_HOLD)", () => {
    expect(validateTransition("AVAILABLE", "RESERVED").ok).toBe(false);
  });

  it("SOLD → anywhere (terminal state in v1)", () => {
    expect(validateTransition("SOLD", "AVAILABLE").ok).toBe(false);
    expect(validateTransition("SOLD", "RESERVED").ok).toBe(false);
    expect(validateTransition("SOLD", "FROZEN").ok).toBe(false);
  });

  it("SOFT_HOLD → SOLD (must go through RESERVED)", () => {
    expect(validateTransition("SOFT_HOLD", "SOLD").ok).toBe(false);
  });

  it("FROZEN → RESERVED (must go through SOFT_HOLD first)", () => {
    expect(validateTransition("FROZEN", "RESERVED").ok).toBe(false);
  });
});

describe("allowedNextStatuses", () => {
  it("AVAILABLE → [SOFT_HOLD, FROZEN]", () => {
    expect(new Set(allowedNextStatuses("AVAILABLE"))).toEqual(
      new Set(["SOFT_HOLD", "FROZEN"]),
    );
  });
  it("SOLD → [] (terminal)", () => {
    expect(allowedNextStatuses("SOLD")).toEqual([]);
  });
  it("RESERVED → [SOLD, AVAILABLE]", () => {
    expect(new Set(allowedNextStatuses("RESERVED"))).toEqual(new Set(["SOLD", "AVAILABLE"]));
  });
});
