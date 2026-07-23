import { describe, it, expect } from "vitest";
import seed from "../../supabase/seed/cms_domain_seed.json";

// The seed file is the contractual source of truth (Annexure II.1 + III).
// These tests pin its shape so a bad edit can never silently corrupt the
// domain data that everything else is seeded from.

const CONTRACT_VALUE_THB = 7_456_732;

describe("cms_domain_seed.json integrity", () => {
  it("has 23 checklist families", () => {
    expect(seed.families).toHaveLength(23);
  });

  it("has 21 milestones", () => {
    expect(seed.milestones).toHaveLength(21);
  });

  it("has 78 inspections", () => {
    expect(seed.inspections).toHaveLength(78);
  });

  it("has 422 checklist items in total", () => {
    const total = seed.inspections.reduce(
      (sum, i) => sum + i.checklist.length,
      0
    );
    expect(total).toBe(422);
  });

  it("milestone values excluding RET sum to the contract value (7,456,732 THB)", () => {
    const sum = seed.milestones
      .filter((m) => m.code !== "RET")
      .reduce((acc, m) => acc + m.value, 0);
    expect(sum).toBe(CONTRACT_VALUE_THB);
  });

  it("RET equals 10% retention of the contract value", () => {
    const ret = seed.milestones.find((m) => m.code === "RET");
    expect(ret?.value).toBe(Math.round(CONTRACT_VALUE_THB * 0.1));
  });

  it("every inspection references a known milestone and family", () => {
    const milestoneCodes = new Set(seed.milestones.map((m) => m.code));
    const familyCodes = new Set(seed.families.map((f) => f.code));
    for (const insp of seed.inspections) {
      expect(milestoneCodes, `milestone for ${insp.code}`).toContain(
        insp.milestone
      );
      expect(familyCodes, `family for ${insp.code}`).toContain(insp.family);
    }
  });

  it("inspection codes are unique", () => {
    const codes = seed.inspections.map((i) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("point types and hidden-work counts match the meta block", () => {
    const holdPoints = seed.inspections.filter((i) => i.type === "HOLD").length;
    const hidden = seed.inspections.filter((i) => i.hidden).length;
    expect(holdPoints).toBe(seed._meta.holdPoints);
    expect(hidden).toBe(seed._meta.hiddenWorks);
    const allowed = new Set(["HOLD", "WITNESS", "SURVEILLANCE", "RECORDS"]);
    for (const i of seed.inspections) {
      expect(allowed).toContain(i.type);
    }
  });
});
