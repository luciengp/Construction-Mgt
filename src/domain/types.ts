// Shared domain types. Pure TypeScript — no framework or Supabase imports
// anywhere in src/domain/.

export type Role = "owner" | "cm" | "contractor" | "viewer";

/** The two signature sides of a record. Owner signs the CM side. */
export type Side = "contractor" | "cm";

export type Result = "PASS" | "PASS_WITH_COMMENT" | "FAIL";

export type Signoff =
  | "DRAFT"
  | "AWAITING_CM"
  | "AWAITING_CONTRACTOR"
  | "COMPLETE"
  | "SUPERSEDED";

export type HiddenRelease = "n/a" | "PENDING" | "RELEASED" | "DO_NOT_COVER";

export type CheckState = "pass" | "fail" | "na";

export interface Check {
  text: string;
  state: CheckState;
  /** Optional per-check note from the signing party. */
  note?: string;
}

/** Result ranking per Section 4.2 — a countersigner may only downgrade. */
export const RESULT_RANK: Record<Result, number> = {
  PASS: 3,
  PASS_WITH_COMMENT: 2,
  FAIL: 1,
};

export function worseResult(a: Result, b: Result): Result {
  return RESULT_RANK[a] <= RESULT_RANK[b] ? a : b;
}

/** Which signature side a role produces. Viewers sign nothing. */
export function signingSide(role: Role): Side | null {
  switch (role) {
    case "owner":
    case "cm":
      return "cm";
    case "contractor":
      return "contractor";
    case "viewer":
      return null;
  }
}

/** Snapshot of an inspection_records row as the domain sees it. */
export interface RecordSnapshot {
  id: string;
  result: Result | null;
  signoff: Signoff;
  contractorSignedBy: string | null;
  contractorSignedAt: string | null;
  cmSignedBy: string | null;
  cmSignedAt: string | null;
  area: string | null;
  notes: string | null;
  hiddenRelease: HiddenRelease;
  checks: Check[];
  /** Each party's own answers, preserved so both can be shown side by side. */
  contractorChecks?: Check[] | null;
  cmChecks?: Check[] | null;
  ncrId: string | null;
}
