import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  computePrincipalPayment,
  creditFacilityState,
  projectBalanceTrajectory,
} from "../../src/lib/calc/credit-facility";

const sanFacility = {
  id: "facility-1",
  lenderName: "Banco G&T Continental, S. A.",
  initialCapUsd: new Prisma.Decimal("7000000"),
  currentCapUsd: new Prisma.Decimal("7000000"),
  annualRate: new Prisma.Decimal("0.0725"),
  ltcCeiling: new Prisma.Decimal("0.90"),
};

describe("computePrincipalPayment (revolvente híbrido per author's note 2)", () => {
  it("pays the lesser of EBITDA and balance when both positive", () => {
    expect(
      computePrincipalPayment({ monthlyEbitdaUsd: "50000", outstandingBalanceUsd: "100000" }),
    ).toBe("50000.00");
    expect(
      computePrincipalPayment({ monthlyEbitdaUsd: "100000", outstandingBalanceUsd: "30000" }),
    ).toBe("30000.00");
  });

  it("pays zero when EBITDA ≤ 0 (the 'híbrido' rule per the workbook author's note 2)", () => {
    expect(
      computePrincipalPayment({ monthlyEbitdaUsd: "-1000", outstandingBalanceUsd: "100000" }),
    ).toBe("0");
    expect(
      computePrincipalPayment({ monthlyEbitdaUsd: "0", outstandingBalanceUsd: "100000" }),
    ).toBe("0");
  });

  it("pays zero when balance ≤ 0 (loan already paid off)", () => {
    expect(
      computePrincipalPayment({ monthlyEbitdaUsd: "50000", outstandingBalanceUsd: "0" }),
    ).toBe("0");
  });
});

describe("creditFacilityState", () => {
  it("returns zero balance + zero interest when nothing drawn (SE current snapshot per Ppto Inversion!ED80 = 0)", () => {
    const s = creditFacilityState(sanFacility, {
      latestMonthlyEbitdaUsd: "100000",
      outstandingBalanceUsd: "0",
      latestAppraisal: null,
    });
    expect(s.currentBalanceUsd).toBe("0");
    expect(s.monthlyInterestUsd).toBe("0");
    expect(s.monthlyPrincipalPaymentUsd).toBe("0");
    expect(s.inStressZone).toBe(false);
  });

  it("computes monthly interest = balance × annual/12", () => {
    const s = creditFacilityState(sanFacility, {
      latestMonthlyEbitdaUsd: "0",
      outstandingBalanceUsd: "1000000",
      latestAppraisal: null,
    });
    // 1,000,000 × (0.0725 / 12) = 6,041.67
    expect(Number(s.monthlyInterestUsd)).toBeCloseTo(6041.67, 2);
  });

  it("flags stress zone when LTC > ltcCeiling (Q-LTC-CEILING signal, NOT alarm)", () => {
    const s = creditFacilityState(sanFacility, {
      latestMonthlyEbitdaUsd: "0",
      outstandingBalanceUsd: "5000000",
      latestAppraisal: {
        facilityId: "facility-1",
        appraisedValueUsd: new Prisma.Decimal("5000000"), // LTC = 100% > 90% ceiling
        cycleNumber: 1,
        appraisalDate: new Date("2026-05-01"),
      },
    });
    expect(s.inStressZone).toBe(true);
    expect(Number(s.currentLtc)).toBeCloseTo(1.0, 4);
  });
});

describe("projectBalanceTrajectory", () => {
  it("amortizes balance over months proportional to EBITDA (revolvente híbrido)", () => {
    const trajectory = projectBalanceTrajectory({
      startingBalanceUsd: "100000",
      monthly: [
        {
          monthNumber: 1,
          monthDate: new Date("2026-01-01"),
          ebitda: new Prisma.Decimal("30000"),
          ebitdaConIva: new Prisma.Decimal("33600"),
          totalCostSinIva: new Prisma.Decimal("0"),
          ivaOnCosts: new Prisma.Decimal("0"),
          totalRevenueSinIva: new Prisma.Decimal("30000"),
          creditBalance: new Prisma.Decimal("0"),
          interestPayment: new Prisma.Decimal("0"),
          principalPayment: new Prisma.Decimal("0"),
        },
        {
          monthNumber: 2,
          monthDate: new Date("2026-02-01"),
          ebitda: new Prisma.Decimal("-5000"), // negative EBITDA → no principal payment
          ebitdaConIva: new Prisma.Decimal("0"),
          totalCostSinIva: new Prisma.Decimal("0"),
          ivaOnCosts: new Prisma.Decimal("0"),
          totalRevenueSinIva: new Prisma.Decimal("0"),
          creditBalance: new Prisma.Decimal("0"),
          interestPayment: new Prisma.Decimal("0"),
          principalPayment: new Prisma.Decimal("0"),
        },
        {
          monthNumber: 3,
          monthDate: new Date("2026-03-01"),
          ebitda: new Prisma.Decimal("80000"),
          ebitdaConIva: new Prisma.Decimal("0"),
          totalCostSinIva: new Prisma.Decimal("0"),
          ivaOnCosts: new Prisma.Decimal("0"),
          totalRevenueSinIva: new Prisma.Decimal("0"),
          creditBalance: new Prisma.Decimal("0"),
          interestPayment: new Prisma.Decimal("0"),
          principalPayment: new Prisma.Decimal("0"),
        },
      ],
    });
    expect(trajectory).toHaveLength(3);
    expect(Number(trajectory[0]!.balanceUsd)).toBeCloseTo(70000, 2); // 100k − 30k
    expect(Number(trajectory[1]!.balanceUsd)).toBeCloseTo(70000, 2); // unchanged (negative EBITDA)
    expect(Number(trajectory[2]!.balanceUsd)).toBeCloseTo(0, 2); // 70k paid down (min(80k, 70k))
  });
});
