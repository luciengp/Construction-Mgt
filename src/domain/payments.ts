// Section 4.4 — payment gating. The instalment plan itself is built by
// paymentPlan.ts; this module decides whether an instalment may be
// released, given the current gate evaluations.

import { GateStatus } from "./gates";
import { PlannedPayment, RETENTION_GATE } from "./paymentPlan";

export type PaymentStatus = "HOLD" | "RELEASE" | "CERTIFIED" | "PAID";

export interface PaymentGateContext {
  /** Gate status per milestone code (including PC and RET). */
  gateStatus: Record<string, GateStatus>;
  /** ISO date the completion certificate was signed, if it has been. */
  completionCertifiedAt: string | null;
  /** Configurable retention delay (default 30 days). */
  retentionDelayDays: number;
  /** "now" as an ISO timestamp, injected for testability. */
  now: string;
}

/**
 * May this instalment move from HOLD to RELEASE?
 *
 * - COMMENCEMENT: controlling gate is the PREVIOUS milestone — release when
 *   that gate is READY.
 * - COMPLETION: controlling gate is its OWN milestone.
 * - RETENTION: only after the completion certificate exists, the configured
 *   delay has elapsed, and the RET gate (retention re-inspection) is READY.
 *
 * The UI must never mark a payment released while this returns false.
 */
export function canRelease(
  payment: Pick<PlannedPayment, "type" | "controlling_gate">,
  ctx: PaymentGateContext
): boolean {
  if (payment.type === "RETENTION") {
    if (!ctx.completionCertifiedAt) return false;
    const releasableFrom = addDays(
      ctx.completionCertifiedAt,
      ctx.retentionDelayDays
    );
    if (ctx.now < releasableFrom) return false;
    return ctx.gateStatus[RETENTION_GATE] === "READY";
  }
  return ctx.gateStatus[payment.controlling_gate] === "READY";
}

/** Legal status transitions. Certification is the owner's act. */
export function nextPaymentStatuses(
  current: PaymentStatus,
  releasable: boolean
): PaymentStatus[] {
  switch (current) {
    case "HOLD":
      return releasable ? ["RELEASE"] : [];
    case "RELEASE":
      // A gate can regress (e.g. re-inspection fails) → back to HOLD.
      return releasable ? ["CERTIFIED"] : ["HOLD"];
    case "CERTIFIED":
      return ["PAID"];
    case "PAID":
      return [];
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}
