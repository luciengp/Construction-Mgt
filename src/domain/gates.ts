// Section 4.3 — quality gate status per milestone.

import { RecordSnapshot } from "./types";

export interface RecordForGate
  extends Pick<RecordSnapshot, "result" | "signoff"> {
  createdAt: string;
}

export interface InspectionForGate {
  code: string;
  records: RecordForGate[];
}

/**
 * An inspection counts as passed only when its ACTIVE record (most recent,
 * not superseded) is COMPLETE with a passing result. Because re-inspection
 * supersedes the old record, a milestone can never double-count an
 * inspection.
 *
 * PASS_WITH_COMMENT counts as passed: per Section 4.6 its consequence is a
 * Category-B defect, which explicitly does not block the gate (only
 * Category-A does). Treating it as not-passed would deadlock every gate it
 * touches. Documented in DOMAIN.md.
 */
export function inspectionCountsAsPassed(records: RecordForGate[]): boolean {
  const active = activeRecord(records);
  return (
    active !== null &&
    active.signoff === "COMPLETE" &&
    (active.result === "PASS" || active.result === "PASS_WITH_COMMENT")
  );
}

export function activeRecord(records: RecordForGate[]): RecordForGate | null {
  const candidates = records
    .filter((r) => r.signoff !== "SUPERSEDED")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return candidates[0] ?? null;
}

export function inspectionHasActiveFail(records: RecordForGate[]): boolean {
  const active = activeRecord(records);
  return active !== null && active.result === "FAIL";
}

export type GateStatus =
  | "READY" // ready for payment
  | "BLOCKED" // active FAIL, open NCR, or open Category-A defect
  | "AWAITING_SIGNOFF" // at least one record waiting for its countersignature
  | "IN_PROGRESS" // some inspections passed or submitted, none blocking
  | "NOT_READY"; // nothing submitted yet

export interface GateInput {
  inspections: InspectionForGate[];
  openNcrCount: number;
  openCategoryADefectCount: number;
  /** Documentation confirmed for the milestone (RECORDS-type evidence). */
  documentationConfirmed: boolean;
}

export interface GateEvaluation {
  status: GateStatus;
  passedCount: number;
  totalCount: number;
  failedCodes: string[];
  awaitingCodes: string[];
  blockReasons: string[];
}

export function evaluateGate(input: GateInput): GateEvaluation {
  const total = input.inspections.length;
  let passed = 0;
  const failedCodes: string[] = [];
  const awaitingCodes: string[] = [];
  let anyRecords = false;

  for (const insp of input.inspections) {
    const active = activeRecord(insp.records);
    if (active !== null) anyRecords = true;
    if (inspectionCountsAsPassed(insp.records)) passed++;
    if (inspectionHasActiveFail(insp.records)) failedCodes.push(insp.code);
    if (
      active !== null &&
      (active.signoff === "AWAITING_CM" ||
        active.signoff === "AWAITING_CONTRACTOR")
    ) {
      awaitingCodes.push(insp.code);
    }
  }

  const blockReasons: string[] = [];
  if (failedCodes.length > 0)
    blockReasons.push(`Active FAIL: ${failedCodes.join(", ")}`);
  if (input.openNcrCount > 0)
    blockReasons.push(`${input.openNcrCount} open NCR(s)`);
  if (input.openCategoryADefectCount > 0)
    blockReasons.push(
      `${input.openCategoryADefectCount} open Category-A defect(s)`
    );

  let status: GateStatus;
  if (blockReasons.length > 0) {
    status = "BLOCKED";
  } else if (passed === total && total > 0 && input.documentationConfirmed) {
    status = "READY";
  } else if (awaitingCodes.length > 0) {
    status = "AWAITING_SIGNOFF";
  } else if (anyRecords) {
    status = "IN_PROGRESS";
  } else {
    status = "NOT_READY";
  }

  return {
    status,
    passedCount: passed,
    totalCount: total,
    failedCodes,
    awaitingCodes,
    blockReasons,
  };
}
