import { describe, it, expect } from "vitest";
import seed from "../../supabase/seed/cms_domain_seed.json";
import {
  buildPaymentPlan,
  DEFAULT_SPLIT,
  RETENTION_GATE,
} from "../../src/domain/paymentPlan";

const milestones = seed.milestones.map((m, i) => ({
  code: m.code,
  value: m.value,
  sequence: i + 1,
}));

describe("buildPaymentPlan (Section 4.4)", () => {
  const plan = buildPaymentPlan(milestones);

  it("creates three instalments per value-bearing milestone, none for RET or zero-value", () => {
    const valueBearing = milestones.filter(
      (m) => m.code !== RETENTION_GATE && m.value > 0
    );
    expect(plan).toHaveLength(valueBearing.length * 3);
    expect(plan.some((p) => p.milestone_code === "RET")).toBe(false);
    expect(plan.some((p) => p.milestone_code === "PC")).toBe(false);
  });

  it("instalments of each milestone sum exactly to its value (no rounding loss)", () => {
    for (const m of milestones.filter((m) => m.value > 0 && m.code !== "RET")) {
      const total = plan
        .filter((p) => p.milestone_code === m.code)
        .reduce((s, p) => s + p.amount, 0);
      expect(total, m.code).toBe(m.value);
    }
  });

  it("total plan equals the contract value", () => {
    const total = plan.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(7_456_732);
  });

  it("commencement is gated by the previous milestone, completion by its own", () => {
    // M1.1 is the first value-bearing milestone; PC precedes it.
    const m11c = plan.find(
      (p) => p.milestone_code === "M1.1" && p.type === "COMMENCEMENT"
    );
    expect(m11c?.controlling_gate).toBe("PC");

    // M2.1 commencement is gated by M1.6 (the previous gate in sequence).
    const m21c = plan.find(
      (p) => p.milestone_code === "M2.1" && p.type === "COMMENCEMENT"
    );
    expect(m21c?.controlling_gate).toBe("M1.6");

    for (const p of plan.filter((p) => p.type === "COMPLETION")) {
      expect(p.controlling_gate).toBe(p.milestone_code);
    }
  });

  it("all retention instalments are gated by RET and sum to the RET milestone value ± rounding", () => {
    const retTotal = plan
      .filter((p) => p.type === "RETENTION")
      .reduce((s, p) => s + p.amount, 0);
    for (const p of plan.filter((p) => p.type === "RETENTION")) {
      expect(p.controlling_gate).toBe(RETENTION_GATE);
    }
    const retMilestone = milestones.find((m) => m.code === "RET")!;
    // Remainder-based rounding keeps the drift within 1 THB per milestone.
    expect(Math.abs(retTotal - retMilestone.value)).toBeLessThanOrEqual(
      milestones.length
    );
  });

  it("uses the configurable split", () => {
    const custom = buildPaymentPlan(
      [
        { code: "PC", value: 0, sequence: 1 },
        { code: "A", value: 1000, sequence: 2 },
      ],
      { commencement: 0.3, completion: 0.6, retention: 0.1 }
    );
    expect(custom).toEqual([
      {
        milestone_code: "A",
        type: "COMMENCEMENT",
        amount: 300,
        controlling_gate: "PC",
      },
      {
        milestone_code: "A",
        type: "COMPLETION",
        amount: 600,
        controlling_gate: "A",
      },
      {
        milestone_code: "A",
        type: "RETENTION",
        amount: 100,
        controlling_gate: "RET",
      },
    ]);
  });

  it("default split is 50/40/10", () => {
    expect(DEFAULT_SPLIT).toEqual({
      commencement: 0.5,
      completion: 0.4,
      retention: 0.1,
    });
  });
});
