import type { GateEvaluation } from "@/domain/gates";
import type { InspectionView } from "@/lib/data/dashboard";

export type StatusTone = "pass" | "warn" | "fail" | "neutral";

export interface StatusBadge {
  label: string;
  tone: StatusTone;
}

export const TONE_CLASSES: Record<StatusTone, string> = {
  pass: "bg-status-pass/12 text-status-pass",
  warn: "bg-status-warn/15 text-[#8a6100]",
  fail: "bg-status-fail/12 text-status-fail",
  neutral: "bg-slate-200 text-slate-600",
};

export const TONE_DOT: Record<StatusTone, string> = {
  pass: "bg-status-pass",
  warn: "bg-status-warn",
  fail: "bg-status-fail",
  neutral: "bg-slate-400",
};

export function gateBadge(gate: GateEvaluation): StatusBadge {
  switch (gate.status) {
    case "READY":
      return { label: "Ready for payment", tone: "pass" };
    case "BLOCKED":
      return { label: "Blocked", tone: "fail" };
    case "AWAITING_SIGNOFF":
      return { label: "Awaiting sign-off", tone: "warn" };
    case "IN_PROGRESS":
      return { label: "In progress", tone: "warn" };
    case "NOT_READY":
      return { label: "Not started", tone: "neutral" };
  }
}

export function inspectionBadge(i: InspectionView): StatusBadge {
  if (i.hasActiveFail) return { label: "Failed", tone: "fail" };
  if (i.countsAsPassed) {
    return i.result === "PASS_WITH_COMMENT"
      ? { label: "Pass (comment)", tone: "warn" }
      : { label: "Passed", tone: "pass" };
  }
  if (i.awaiting) {
    return {
      label:
        i.signoff === "AWAITING_CM" ? "Awaiting CM" : "Awaiting contractor",
      tone: "warn",
    };
  }
  return { label: "Outstanding", tone: "neutral" };
}
