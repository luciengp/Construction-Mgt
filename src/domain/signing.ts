// Section 4.2 — submitting an inspection (sign).
//
// decideSubmit() is a pure decision function: given the active record (or
// null), the authenticated signer, and the validated submission, it returns
// exactly what the server must do. The server applies the decision inside a
// transaction; the client is never trusted with any of this.

import {
  Check,
  HiddenRelease,
  RecordSnapshot,
  Result,
  Role,
  Side,
  signingSide,
  worseResult,
} from "./types";

export interface Signer {
  /** From the authenticated session/membership — never the request body. */
  userId: string;
  role: Role;
}

export interface Submission {
  result: Result;
  checks: Check[];
  notes: string | null;
  area: string | null;
  photoCount: number;
  /** True when the releaser ticked the hidden-work release box. */
  releaseToCover: boolean;
}

export interface InspectionMeta {
  checklistLength: number;
  minPhotos: number;
  hidden: boolean;
}

export type ValidationError =
  | { code: "NO_RESULT" }
  | { code: "ROLE_CANNOT_SIGN"; role: Role }
  | { code: "CHECKLIST_INCOMPLETE"; expected: number; answered: number }
  | { code: "NOTE_REQUIRED_FOR_PASS_WITH_COMMENT" };

export type ValidationWarning = {
  code: "PHOTOS_BELOW_MINIMUM";
  required: number;
  provided: number;
};

export interface Validation {
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export function validateSubmission(
  signer: Signer,
  submission: Submission,
  meta: InspectionMeta
): Validation {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!submission.result) {
    errors.push({ code: "NO_RESULT" });
  }
  if (signingSide(signer.role) === null) {
    errors.push({ code: "ROLE_CANNOT_SIGN", role: signer.role });
  }

  const answered = submission.checks.filter(
    (c) => c.state === "pass" || c.state === "fail" || c.state === "na"
  ).length;
  if (
    submission.checks.length !== meta.checklistLength ||
    answered !== meta.checklistLength
  ) {
    errors.push({
      code: "CHECKLIST_INCOMPLETE",
      expected: meta.checklistLength,
      answered,
    });
  }

  if (
    submission.result === "PASS_WITH_COMMENT" &&
    !submission.notes?.trim()
  ) {
    errors.push({ code: "NOTE_REQUIRED_FOR_PASS_WITH_COMMENT" });
  }

  // Below-minimum photos warn but never block (Section 4.2).
  if (submission.photoCount < meta.minPhotos) {
    warnings.push({
      code: "PHOTOS_BELOW_MINIMUM",
      required: meta.minPhotos,
      provided: submission.photoCount,
    });
  }

  return { errors, warnings };
}

/** The fields of a new/updated record the server must persist. */
export interface RecordWrite {
  result: Result;
  signoff: "AWAITING_CM" | "AWAITING_CONTRACTOR" | "COMPLETE";
  contractorSignedBy: string | null;
  contractorSignedAt: string | null;
  cmSignedBy: string | null;
  cmSignedAt: string | null;
  checks: Check[];
  /** This-party answers stored on their own side; the other side preserved. */
  contractorChecks: Check[] | null;
  cmChecks: Check[] | null;
  notes: string | null;
  area: string | null;
  hiddenRelease: HiddenRelease;
}

export type SubmitDecision =
  | { kind: "create"; record: RecordWrite }
  | { kind: "countersign"; recordId: string; record: RecordWrite }
  | { kind: "self_edit"; recordId: string; record: RecordWrite }
  | {
      kind: "reinspect";
      supersedeRecordId: string;
      record: RecordWrite;
    }
  | { kind: "rejected"; reason: SubmitRejection };

export type SubmitRejection =
  | { code: "VALIDATION_FAILED"; errors: ValidationError[] }
  | { code: "SAME_USER_BOTH_SIGNATURES" };

function signatureFields(
  side: Side,
  userId: string,
  at: string
): Pick<
  RecordWrite,
  "contractorSignedBy" | "contractorSignedAt" | "cmSignedBy" | "cmSignedAt"
> {
  return side === "contractor"
    ? {
        contractorSignedBy: userId,
        contractorSignedAt: at,
        cmSignedBy: null,
        cmSignedAt: null,
      }
    : {
        contractorSignedBy: null,
        contractorSignedAt: null,
        cmSignedBy: userId,
        cmSignedAt: at,
      };
}

function freshRecord(
  side: Side,
  signer: Signer,
  submission: Submission,
  meta: InspectionMeta,
  now: string
): RecordWrite {
  return {
    result: submission.result,
    signoff: side === "contractor" ? "AWAITING_CM" : "AWAITING_CONTRACTOR",
    ...signatureFields(side, signer.userId, now),
    checks: submission.checks,
    contractorChecks: side === "contractor" ? submission.checks : null,
    cmChecks: side === "cm" ? submission.checks : null,
    notes: submission.notes,
    area: submission.area,
    hiddenRelease: computeHiddenRelease(
      meta.hidden,
      false,
      submission.result,
      submission.releaseToCover
    ),
  };
}

/**
 * Section 4.5 — the release-to-cover state of a hidden work.
 * RELEASED only when COMPLETE (both signed) AND PASS AND the release box
 * was ticked. A FAIL is an explicit DO_NOT_COVER; anything else is PENDING.
 */
export function computeHiddenRelease(
  hidden: boolean,
  complete: boolean,
  result: Result | null,
  releaseTicked: boolean
): HiddenRelease {
  if (!hidden) return "n/a";
  if (result === "FAIL") return "DO_NOT_COVER";
  if (complete && result === "PASS" && releaseTicked) return "RELEASED";
  return "PENDING";
}

export function decideSubmit(
  activeRecord: RecordSnapshot | null,
  signer: Signer,
  submission: Submission,
  meta: InspectionMeta,
  now: string
): SubmitDecision {
  const validation = validateSubmission(signer, submission, meta);
  if (validation.errors.length > 0) {
    return {
      kind: "rejected",
      reason: { code: "VALIDATION_FAILED", errors: validation.errors },
    };
  }

  const side = signingSide(signer.role)!;

  // No active record → a brand new submission with this signature.
  if (activeRecord === null || activeRecord.signoff === "SUPERSEDED") {
    return {
      kind: "create",
      record: freshRecord(side, signer, submission, meta, now),
    };
  }

  // Active record is COMPLETE → re-inspection: supersede it, start fresh.
  if (activeRecord.signoff === "COMPLETE") {
    return {
      kind: "reinspect",
      supersedeRecordId: activeRecord.id,
      record: freshRecord(side, signer, submission, meta, now),
    };
  }

  const mySignedBy =
    side === "contractor"
      ? activeRecord.contractorSignedBy
      : activeRecord.cmSignedBy;
  const otherSignedBy =
    side === "contractor"
      ? activeRecord.cmSignedBy
      : activeRecord.contractorSignedBy;
  const otherSignedAt =
    side === "contractor"
      ? activeRecord.cmSignedAt
      : activeRecord.contractorSignedAt;

  if (mySignedBy !== null) {
    // Self-edit: overwrite this party's own answers, refresh their
    // timestamp, stay awaiting the other party.
    const sig = signatureFields(side, signer.userId, now);
    return {
      kind: "self_edit",
      recordId: activeRecord.id,
      record: {
        result: submission.result,
        signoff: activeRecord.signoff as "AWAITING_CM" | "AWAITING_CONTRACTOR",
        contractorSignedBy:
          side === "contractor"
            ? sig.contractorSignedBy
            : activeRecord.contractorSignedBy,
        contractorSignedAt:
          side === "contractor"
            ? sig.contractorSignedAt
            : activeRecord.contractorSignedAt,
        cmSignedBy: side === "cm" ? sig.cmSignedBy : activeRecord.cmSignedBy,
        cmSignedAt: side === "cm" ? sig.cmSignedAt : activeRecord.cmSignedAt,
        checks: submission.checks,
        contractorChecks:
          side === "contractor"
            ? submission.checks
            : (activeRecord.contractorChecks ?? null),
        cmChecks:
          side === "cm" ? submission.checks : (activeRecord.cmChecks ?? null),
        notes: submission.notes,
        area: submission.area,
        hiddenRelease: computeHiddenRelease(
          meta.hidden,
          false,
          submission.result,
          submission.releaseToCover
        ),
      },
    };
  }

  // Countersignature. Section 4.1: one person can never produce both
  // signatures on the same record.
  if (otherSignedBy === signer.userId) {
    return {
      kind: "rejected",
      reason: { code: "SAME_USER_BOTH_SIGNATURES" },
    };
  }

  // A countersigner may only downgrade the result, never silently upgrade.
  const finalResult: Result = activeRecord.result
    ? worseResult(activeRecord.result, submission.result)
    : submission.result;

  const complete = otherSignedBy !== null; // now both sides signed
  const sig = signatureFields(side, signer.userId, now);
  return {
    kind: "countersign",
    recordId: activeRecord.id,
    record: {
      result: finalResult,
      signoff: complete
        ? "COMPLETE"
        : side === "contractor"
          ? "AWAITING_CM"
          : "AWAITING_CONTRACTOR",
      contractorSignedBy:
        side === "contractor"
          ? sig.contractorSignedBy
          : activeRecord.contractorSignedBy,
      contractorSignedAt:
        side === "contractor"
          ? sig.contractorSignedAt
          : (otherSignedAt as string),
      cmSignedBy: side === "cm" ? sig.cmSignedBy : activeRecord.cmSignedBy,
      cmSignedAt: side === "cm" ? sig.cmSignedAt : activeRecord.cmSignedAt,
      checks: submission.checks,
      contractorChecks:
        side === "contractor"
          ? submission.checks
          : (activeRecord.contractorChecks ?? null),
      cmChecks:
        side === "cm" ? submission.checks : (activeRecord.cmChecks ?? null),
      notes: submission.notes ?? activeRecord.notes,
      area: submission.area ?? activeRecord.area,
      hiddenRelease: computeHiddenRelease(
        meta.hidden,
        complete,
        finalResult,
        submission.releaseToCover
      ),
    },
  };
}

/**
 * Section 4.2 — find the active record: the most recent one whose signoff
 * is not SUPERSEDED. `records` may be in any order; createdAt ISO strings
 * decide recency.
 */
export function findActiveRecord<
  T extends { signoff: string; createdAt: string },
>(records: T[]): T | null {
  const candidates = records
    .filter((r) => r.signoff !== "SUPERSEDED")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return candidates[0] ?? null;
}
