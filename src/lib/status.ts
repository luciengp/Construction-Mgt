import type { GateEvaluation } from "@/domain/gates";
import type { InspectionView } from "@/lib/data/dashboard";
import type { Dict } from "@/lib/i18n/dictionaries";

export type StatusTone = "pass" | "warn" | "fail" | "neutral";

/** Key into dict.status, used to render a translated label. */
export type StatusKey = keyof Dict["status"];

export interface StatusBadge {
  /** English fallback label. */
  label: string;
  /** Translation key; render dict.status[key] when a dictionary is available. */
  key: StatusKey;
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
      return { label: "Ready for payment", key: "ready", tone: "pass" };
    case "BLOCKED":
      return { label: "Blocked", key: "blocked", tone: "fail" };
    case "AWAITING_SIGNOFF":
      return { label: "Awaiting sign-off", key: "awaiting", tone: "warn" };
    case "IN_PROGRESS":
      return { label: "In progress", key: "inProgress", tone: "warn" };
    case "NOT_READY":
      return { label: "Not started", key: "notStarted", tone: "neutral" };
  }
}

export function inspectionBadge(i: InspectionView): StatusBadge {
  if (i.hasActiveFail) return { label: "Failed", key: "failed", tone: "fail" };
  if (i.countsAsPassed) {
    return i.result === "PASS_WITH_COMMENT"
      ? { label: "Pass (comment)", key: "passComment", tone: "warn" }
      : { label: "Passed", key: "passed", tone: "pass" };
  }
  if (i.awaiting) {
    return i.signoff === "AWAITING_CM"
      ? { label: "Awaiting CM", key: "awaitingCm", tone: "warn" }
      : { label: "Awaiting contractor", key: "awaitingContractor", tone: "warn" };
  }
  return { label: "Outstanding", key: "outstanding", tone: "neutral" };
}
