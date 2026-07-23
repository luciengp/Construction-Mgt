import { describe, it, expect } from "vitest";
import {
  decideSubmit,
  findActiveRecord,
  computeHiddenRelease,
  validateSubmission,
  type Signer,
  type Submission,
  type InspectionMeta,
} from "../../src/domain/signing";
import type { RecordSnapshot } from "../../src/domain/types";

const NOW = "2026-07-23T10:00:00.000Z";
const LATER = "2026-07-23T12:00:00.000Z";

const contractor: Signer = { userId: "u-contractor", role: "contractor" };
const cm: Signer = { userId: "u-cm", role: "cm" };
const owner: Signer = { userId: "u-owner", role: "owner" };
const viewer: Signer = { userId: "u-viewer", role: "viewer" };

const meta: InspectionMeta = { checklistLength: 3, minPhotos: 5, hidden: false };
const hiddenMeta: InspectionMeta = { checklistLength: 3, minPhotos: 15, hidden: true };

const checks = (state: "pass" | "fail" | "na" = "pass") => [
  { text: "a", state },
  { text: "b", state },
  { text: "c", state },
];

function submission(overrides: Partial<Submission> = {}): Submission {
  return {
    result: "PASS",
    checks: checks(),
    notes: null,
    area: "Zone A",
    photoCount: 10,
    releaseToCover: false,
    ...overrides,
  };
}

function record(overrides: Partial<RecordSnapshot> = {}): RecordSnapshot {
  return {
    id: "rec-1",
    result: "PASS",
    signoff: "AWAITING_CM",
    contractorSignedBy: "u-contractor",
    contractorSignedAt: NOW,
    cmSignedBy: null,
    cmSignedAt: null,
    area: "Zone A",
    notes: null,
    hiddenRelease: "n/a",
    checks: checks(),
    ncrId: null,
    ...overrides,
  };
}

describe("validateSubmission (4.2)", () => {
  it("viewer cannot sign", () => {
    const v = validateSubmission(viewer, submission(), meta);
    expect(v.errors).toContainEqual({ code: "ROLE_CANNOT_SIGN", role: "viewer" });
  });

  it("every checklist item must be answered", () => {
    const v = validateSubmission(
      contractor,
      submission({ checks: checks().slice(0, 2) }),
      meta
    );
    expect(v.errors).toContainEqual({
      code: "CHECKLIST_INCOMPLETE",
      expected: 3,
      answered: 2,
    });
  });

  it("PASS_WITH_COMMENT requires a non-empty note", () => {
    const v = validateSubmission(
      contractor,
      submission({ result: "PASS_WITH_COMMENT", notes: "  " }),
      meta
    );
    expect(v.errors).toContainEqual({
      code: "NOTE_REQUIRED_FOR_PASS_WITH_COMMENT",
    });
    const ok = validateSubmission(
      contractor,
      submission({ result: "PASS_WITH_COMMENT", notes: "minor chip in tile" }),
      meta
    );
    expect(ok.errors).toHaveLength(0);
  });

  it("photos below minimum warn but do not block", () => {
    const v = validateSubmission(
      contractor,
      submission({ photoCount: 2 }),
      meta
    );
    expect(v.errors).toHaveLength(0);
    expect(v.warnings).toContainEqual({
      code: "PHOTOS_BELOW_MINIMUM",
      required: 5,
      provided: 2,
    });
  });
});

describe("decideSubmit (4.2 state machine)", () => {
  it("no active record → create, contractor signature → AWAITING_CM", () => {
    const d = decideSubmit(null, contractor, submission(), meta, NOW);
    expect(d.kind).toBe("create");
    if (d.kind !== "create") return;
    expect(d.record.signoff).toBe("AWAITING_CM");
    expect(d.record.contractorSignedBy).toBe("u-contractor");
    expect(d.record.cmSignedBy).toBeNull();
  });

  it("no active record → CM signature → AWAITING_CONTRACTOR", () => {
    const d = decideSubmit(null, cm, submission(), meta, NOW);
    if (d.kind !== "create") throw new Error(d.kind);
    expect(d.record.signoff).toBe("AWAITING_CONTRACTOR");
    expect(d.record.cmSignedBy).toBe("u-cm");
  });

  it("owner signs the CM side", () => {
    const d = decideSubmit(record(), owner, submission(), meta, LATER);
    if (d.kind !== "countersign") throw new Error(d.kind);
    expect(d.record.signoff).toBe("COMPLETE");
    expect(d.record.cmSignedBy).toBe("u-owner");
    expect(d.record.contractorSignedBy).toBe("u-contractor");
  });

  it("countersign completes the record when both sides have signed", () => {
    const d = decideSubmit(record(), cm, submission(), meta, LATER);
    if (d.kind !== "countersign") throw new Error(d.kind);
    expect(d.recordId).toBe("rec-1");
    expect(d.record.signoff).toBe("COMPLETE");
    expect(d.record.cmSignedAt).toBe(LATER);
    expect(d.record.contractorSignedAt).toBe(NOW);
  });

  it("countersigner may downgrade the result (contractor PASS + CM FAIL → FAIL)", () => {
    const d = decideSubmit(
      record({ result: "PASS" }),
      cm,
      submission({ result: "FAIL", checks: checks("fail") }),
      meta,
      LATER
    );
    if (d.kind !== "countersign") throw new Error(d.kind);
    expect(d.record.result).toBe("FAIL");
    expect(d.record.signoff).toBe("COMPLETE");
  });

  it("countersigner can never silently upgrade (existing FAIL + PASS → FAIL)", () => {
    const d = decideSubmit(
      record({ result: "FAIL", signoff: "AWAITING_CM" }),
      cm,
      submission({ result: "PASS" }),
      meta,
      LATER
    );
    if (d.kind !== "countersign") throw new Error(d.kind);
    expect(d.record.result).toBe("FAIL");
  });

  it("PASS_WITH_COMMENT outranks FAIL downward (PWC + FAIL → FAIL; PASS + PWC → PWC)", () => {
    const a = decideSubmit(
      record({ result: "PASS_WITH_COMMENT" }),
      cm,
      submission({ result: "FAIL", checks: checks("fail") }),
      meta,
      LATER
    );
    if (a.kind !== "countersign") throw new Error(a.kind);
    expect(a.record.result).toBe("FAIL");

    const b = decideSubmit(
      record({ result: "PASS" }),
      cm,
      submission({ result: "PASS_WITH_COMMENT", notes: "hairline crack" }),
      meta,
      LATER
    );
    if (b.kind !== "countersign") throw new Error(b.kind);
    expect(b.record.result).toBe("PASS_WITH_COMMENT");
  });

  it("one person can never produce both signatures (4.1)", () => {
    // The contractor's own record, then the same USER somehow acting on the
    // CM side (e.g. role changed between requests).
    const d = decideSubmit(
      record({ contractorSignedBy: "u-x" }),
      { userId: "u-x", role: "cm" },
      submission(),
      meta,
      LATER
    );
    expect(d).toEqual({
      kind: "rejected",
      reason: { code: "SAME_USER_BOTH_SIGNATURES" },
    });
  });

  it("same party again before completion → self-edit, stays awaiting the other", () => {
    const d = decideSubmit(
      record(),
      { userId: "u-contractor-2", role: "contractor" },
      submission({ result: "PASS_WITH_COMMENT", notes: "revised" }),
      meta,
      LATER
    );
    if (d.kind !== "self_edit") throw new Error(d.kind);
    expect(d.record.signoff).toBe("AWAITING_CM");
    expect(d.record.contractorSignedBy).toBe("u-contractor-2");
    expect(d.record.contractorSignedAt).toBe(LATER);
    expect(d.record.result).toBe("PASS_WITH_COMMENT");
    expect(d.record.cmSignedBy).toBeNull();
  });

  it("active record COMPLETE → re-inspection supersedes and creates fresh", () => {
    const complete = record({
      signoff: "COMPLETE",
      cmSignedBy: "u-cm",
      cmSignedAt: LATER,
    });
    const d = decideSubmit(complete, contractor, submission(), meta, LATER);
    if (d.kind !== "reinspect") throw new Error(d.kind);
    expect(d.supersedeRecordId).toBe("rec-1");
    expect(d.record.signoff).toBe("AWAITING_CM");
    expect(d.record.cmSignedBy).toBeNull();
  });

  it("validation failure rejects before any state change", () => {
    const d = decideSubmit(null, viewer, submission(), meta, NOW);
    expect(d.kind).toBe("rejected");
  });
});

describe("findActiveRecord", () => {
  it("returns the most recent non-superseded record", () => {
    const active = findActiveRecord([
      { signoff: "SUPERSEDED", createdAt: "2026-01-03" },
      { signoff: "COMPLETE", createdAt: "2026-01-02" },
      { signoff: "SUPERSEDED", createdAt: "2026-01-01" },
    ]);
    expect(active?.createdAt).toBe("2026-01-02");
  });

  it("returns null when everything is superseded", () => {
    expect(
      findActiveRecord([{ signoff: "SUPERSEDED", createdAt: "2026-01-01" }])
    ).toBeNull();
  });
});

describe("computeHiddenRelease (4.5)", () => {
  it("non-hidden work is n/a", () => {
    expect(computeHiddenRelease(false, true, "PASS", true)).toBe("n/a");
  });

  it("RELEASED only when COMPLETE + PASS + release ticked", () => {
    expect(computeHiddenRelease(true, true, "PASS", true)).toBe("RELEASED");
    expect(computeHiddenRelease(true, false, "PASS", true)).toBe("PENDING");
    expect(computeHiddenRelease(true, true, "PASS", false)).toBe("PENDING");
    expect(computeHiddenRelease(true, true, "PASS_WITH_COMMENT", true)).toBe(
      "PENDING"
    );
  });

  it("FAIL is an explicit DO_NOT_COVER", () => {
    expect(computeHiddenRelease(true, true, "FAIL", false)).toBe(
      "DO_NOT_COVER"
    );
    expect(computeHiddenRelease(true, false, "FAIL", true)).toBe(
      "DO_NOT_COVER"
    );
  });

  it("a hidden-work submission via decideSubmit cannot read RELEASED before completion", () => {
    const d = decideSubmit(
      null,
      contractor,
      submission({ releaseToCover: true }),
      hiddenMeta,
      NOW
    );
    if (d.kind !== "create") throw new Error(d.kind);
    expect(d.record.hiddenRelease).toBe("PENDING");

    const counter = decideSubmit(
      record({ hiddenRelease: "PENDING" }),
      cm,
      submission({ releaseToCover: true }),
      hiddenMeta,
      LATER
    );
    if (counter.kind !== "countersign") throw new Error(counter.kind);
    expect(counter.record.hiddenRelease).toBe("RELEASED");
  });
});
