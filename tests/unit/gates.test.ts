import { describe, it, expect } from "vitest";
import {
  evaluateGate,
  inspectionCountsAsPassed,
  type GateInput,
  type RecordForGate,
} from "../../src/domain/gates";
import { canRelease, nextPaymentStatuses } from "../../src/domain/payments";
import {
  ncrForFail,
  defectForPassWithComment,
} from "../../src/domain/registers";

const completePass = (createdAt: string): RecordForGate => ({
  result: "PASS",
  signoff: "COMPLETE",
  createdAt,
});

function gateInput(overrides: Partial<GateInput> = {}): GateInput {
  return {
    inspections: [],
    openNcrCount: 0,
    openCategoryADefectCount: 0,
    documentationConfirmed: true,
    ...overrides,
  };
}

describe("inspectionCountsAsPassed (4.3)", () => {
  it("PASS + COMPLETE counts", () => {
    expect(inspectionCountsAsPassed([completePass("t1")])).toBe(true);
  });

  it("AWAITING_CM does NOT count — a single signature is never a pass", () => {
    expect(
      inspectionCountsAsPassed([
        { result: "PASS", signoff: "AWAITING_CM", createdAt: "t1" },
      ])
    ).toBe(false);
  });

  it("a re-inspected pass counts once: superseded old pass + new active record decides", () => {
    // Old pass superseded; new record still awaiting → does not count.
    const records: RecordForGate[] = [
      { result: "PASS", signoff: "SUPERSEDED", createdAt: "t1" },
      { result: "PASS", signoff: "AWAITING_CM", createdAt: "t2" },
    ];
    expect(inspectionCountsAsPassed(records)).toBe(false);

    // New record completes → counts exactly once via the single active record.
    const done: RecordForGate[] = [
      { result: "PASS", signoff: "SUPERSEDED", createdAt: "t1" },
      completePass("t2"),
    ];
    expect(inspectionCountsAsPassed(done)).toBe(true);

    const gate = evaluateGate(
      gateInput({ inspections: [{ code: "ITP-009", records: done }] })
    );
    expect(gate.passedCount).toBe(1); // never 2 — the superseded pass is invisible
    expect(gate.status).toBe("READY");
  });

  it("a re-inspection that FAILS revokes the previously passed state", () => {
    const records: RecordForGate[] = [
      { result: "PASS", signoff: "SUPERSEDED", createdAt: "t1" },
      { result: "FAIL", signoff: "COMPLETE", createdAt: "t2" },
    ];
    expect(inspectionCountsAsPassed(records)).toBe(false);
    const gate = evaluateGate(
      gateInput({ inspections: [{ code: "ITP-009", records }] })
    );
    expect(gate.status).toBe("BLOCKED");
  });

  it("PASS_WITH_COMMENT counts as passed (its consequence is a Cat-B defect, which does not block)", () => {
    expect(
      inspectionCountsAsPassed([
        { result: "PASS_WITH_COMMENT", signoff: "COMPLETE", createdAt: "t1" },
      ])
    ).toBe(true);
  });
});

describe("evaluateGate (4.3)", () => {
  it("BLOCKED by an active FAIL", () => {
    const gate = evaluateGate(
      gateInput({
        inspections: [
          {
            code: "ITP-010",
            records: [
              { result: "FAIL", signoff: "COMPLETE", createdAt: "t1" },
            ],
          },
        ],
      })
    );
    expect(gate.status).toBe("BLOCKED");
    expect(gate.blockReasons[0]).toContain("ITP-010");
  });

  it("BLOCKED by an open NCR even when all inspections passed", () => {
    const gate = evaluateGate(
      gateInput({
        inspections: [{ code: "A", records: [completePass("t1")] }],
        openNcrCount: 1,
      })
    );
    expect(gate.status).toBe("BLOCKED");
  });

  it("BLOCKED by an open Category-A defect", () => {
    const gate = evaluateGate(
      gateInput({
        inspections: [{ code: "A", records: [completePass("t1")] }],
        openCategoryADefectCount: 2,
      })
    );
    expect(gate.status).toBe("BLOCKED");
  });

  it("READY only when every inspection passed and documentation confirmed", () => {
    const all = gateInput({
      inspections: [
        { code: "A", records: [completePass("t1")] },
        { code: "B", records: [completePass("t1")] },
      ],
    });
    expect(evaluateGate(all).status).toBe("READY");

    expect(
      evaluateGate({ ...all, documentationConfirmed: false }).status
    ).not.toBe("READY");
  });

  it("AWAITING_SIGNOFF when a record waits for its countersignature — the gate does not advance", () => {
    const gate = evaluateGate(
      gateInput({
        inspections: [
          { code: "A", records: [completePass("t1")] },
          {
            code: "B",
            records: [
              { result: "PASS", signoff: "AWAITING_CM", createdAt: "t1" },
            ],
          },
        ],
      })
    );
    expect(gate.status).toBe("AWAITING_SIGNOFF");
    expect(gate.passedCount).toBe(1);
  });

  it("NOT_READY with no records, IN_PROGRESS with partial passes", () => {
    expect(
      evaluateGate(
        gateInput({ inspections: [{ code: "A", records: [] }] })
      ).status
    ).toBe("NOT_READY");

    expect(
      evaluateGate(
        gateInput({
          inspections: [
            { code: "A", records: [completePass("t1")] },
            { code: "B", records: [] },
          ],
        })
      ).status
    ).toBe("IN_PROGRESS");
  });
});

describe("payment gating (4.4)", () => {
  const readyAll = {
    gateStatus: {
      PC: "READY",
      "M1.1": "READY",
      RET: "READY",
    } as const,
    completionCertifiedAt: "2027-06-05T00:00:00.000Z",
    retentionDelayDays: 30,
    now: "2027-07-10T00:00:00.000Z",
  };

  it("commencement releases on the PREVIOUS milestone's gate", () => {
    const p = { type: "COMMENCEMENT", controlling_gate: "PC" } as const;
    expect(canRelease(p, { ...readyAll })).toBe(true);
    expect(
      canRelease(p, {
        ...readyAll,
        gateStatus: { ...readyAll.gateStatus, PC: "IN_PROGRESS" },
      })
    ).toBe(false);
  });

  it("completion releases on its OWN gate", () => {
    const p = { type: "COMPLETION", controlling_gate: "M1.1" } as const;
    expect(canRelease(p, { ...readyAll })).toBe(true);
    expect(
      canRelease(p, {
        ...readyAll,
        gateStatus: { ...readyAll.gateStatus, "M1.1": "BLOCKED" },
      })
    ).toBe(false);
  });

  it("retention needs certificate + delay elapsed + RET gate ready", () => {
    const p = { type: "RETENTION", controlling_gate: "RET" } as const;
    expect(canRelease(p, readyAll)).toBe(true);

    expect(
      canRelease(p, { ...readyAll, completionCertifiedAt: null })
    ).toBe(false);

    // Only 10 days after the certificate — the 30-day clock hasn't run.
    expect(
      canRelease(p, { ...readyAll, now: "2027-06-15T00:00:00.000Z" })
    ).toBe(false);

    expect(
      canRelease(p, {
        ...readyAll,
        gateStatus: { ...readyAll.gateStatus, RET: "IN_PROGRESS" },
      })
    ).toBe(false);
  });

  it("the UI can never mark released while the gate is not READY", () => {
    expect(nextPaymentStatuses("HOLD", false)).toEqual([]);
    expect(nextPaymentStatuses("HOLD", true)).toEqual(["RELEASE"]);
    // A regressed gate pulls a released payment back to HOLD.
    expect(nextPaymentStatuses("RELEASE", false)).toEqual(["HOLD"]);
    expect(nextPaymentStatuses("CERTIFIED", false)).toEqual(["PAID"]);
    expect(nextPaymentStatuses("PAID", true)).toEqual([]);
  });
});

describe("automatic registers (4.6)", () => {
  it("a FAIL raises an NCR once per record, description = failed items", () => {
    const ncr = ncrForFail({
      result: "FAIL",
      existingNcrId: null,
      checks: [
        { text: "Cover maintained", state: "fail" },
        { text: "Steel clean", state: "pass" },
        { text: "Formwork rigid", state: "fail" },
      ],
      milestoneCode: "M1.2",
      inspectionCode: "ITP-009",
      nextSeq: 1,
      today: "2026-07-23",
      dueDays: 14,
    });
    expect(ncr).not.toBeNull();
    expect(ncr!.description).toContain("Cover maintained");
    expect(ncr!.description).toContain("Formwork rigid");
    expect(ncr!.description).not.toContain("Steel clean");
    expect(ncr!.dueDate).toBe("2026-08-06");
    expect(ncr!.status).toBe("OPEN");
  });

  it("no second NCR for the same record", () => {
    expect(
      ncrForFail({
        result: "FAIL",
        existingNcrId: "ncr-1",
        checks: [],
        milestoneCode: "M1.2",
        inspectionCode: "ITP-009",
        nextSeq: 2,
        today: "2026-07-23",
        dueDays: 14,
      })
    ).toBeNull();
  });

  it("no NCR for a pass", () => {
    expect(
      ncrForFail({
        result: "PASS",
        existingNcrId: null,
        checks: [],
        milestoneCode: "M1.2",
        inspectionCode: "ITP-009",
        nextSeq: 1,
        today: "2026-07-23",
        dueDays: 14,
      })
    ).toBeNull();
  });

  it("PASS_WITH_COMMENT on completion raises a Category-B defect with the note", () => {
    const defect = defectForPassWithComment({
      result: "PASS_WITH_COMMENT",
      becameComplete: true,
      notes: "hairline crack at column base",
      milestoneCode: "M1.4",
      nextSeq: 3,
    });
    expect(defect).toEqual({
      seq: 3,
      milestoneCode: "M1.4",
      description: "hairline crack at column base",
      category: "B",
      status: "OPEN",
    });

    expect(
      defectForPassWithComment({
        result: "PASS_WITH_COMMENT",
        becameComplete: false,
        notes: "n",
        milestoneCode: "M1.4",
        nextSeq: 3,
      })
    ).toBeNull();
  });
});
