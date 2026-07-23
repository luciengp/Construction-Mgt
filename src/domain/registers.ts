// Section 4.6 — automatic register entries.

import { Check, Result } from "./types";

export interface NcrDraft {
  seq: number;
  milestoneCode: string;
  inspectionCode: string;
  description: string;
  dueDate: string; // ISO date
  status: "OPEN";
}

/**
 * A FAIL raises an NCR — once per record (the server passes the record's
 * existing ncrId; if present, nothing new is raised). The description is
 * the failed checklist items.
 */
export function ncrForFail(args: {
  result: Result;
  existingNcrId: string | null;
  checks: Check[];
  milestoneCode: string;
  inspectionCode: string;
  nextSeq: number;
  today: string; // ISO date
  dueDays: number;
}): NcrDraft | null {
  if (args.result !== "FAIL" || args.existingNcrId !== null) return null;

  const failedItems = args.checks
    .filter((c) => c.state === "fail")
    .map((c) => c.text);
  const description =
    failedItems.length > 0
      ? `Failed checklist items:\n- ${failedItems.join("\n- ")}`
      : "Inspection failed.";

  return {
    seq: args.nextSeq,
    milestoneCode: args.milestoneCode,
    inspectionCode: args.inspectionCode,
    description,
    dueDate: addDaysDate(args.today, args.dueDays),
    status: "OPEN",
  };
}

export interface DefectDraft {
  seq: number;
  milestoneCode: string;
  description: string;
  category: "B";
  status: "OPEN";
}

/**
 * A PASS_WITH_COMMENT on completion raises a Category-B defect with the
 * note as its description. Only when the record just became COMPLETE.
 */
export function defectForPassWithComment(args: {
  result: Result;
  becameComplete: boolean;
  notes: string | null;
  milestoneCode: string;
  nextSeq: number;
}): DefectDraft | null {
  if (args.result !== "PASS_WITH_COMMENT" || !args.becameComplete) return null;
  return {
    seq: args.nextSeq,
    milestoneCode: args.milestoneCode,
    description: args.notes?.trim() || "Pass with comment (no note recorded)",
    category: "B",
    status: "OPEN",
  };
}

function addDaysDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
