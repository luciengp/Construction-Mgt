// Pure domain logic: build the instalment plan for a project's milestones.
// Section 4.4 — each value-bearing milestone splits into
// commencement / completion / retention (default 50/40/10, configurable).
//
// Gating:
//   COMMENCEMENT — controlled by the PREVIOUS milestone's gate (paying in
//                  advance; the protection is everything before is complete)
//   COMPLETION   — controlled by the milestone's OWN gate
//   RETENTION    — accumulates under the RET gate (completion certificate +
//                  retention re-inspection + delay)
//
// No framework imports allowed in src/domain/.

export interface MilestoneSeed {
  code: string;
  value: number;
  sequence: number;
}

export interface PaymentSplit {
  commencement: number;
  completion: number;
  retention: number;
}

export const DEFAULT_SPLIT: PaymentSplit = {
  commencement: 0.5,
  completion: 0.4,
  retention: 0.1,
};

export interface PlannedPayment {
  milestone_code: string;
  type: "COMMENCEMENT" | "COMPLETION" | "RETENTION";
  amount: number;
  controlling_gate: string;
}

export const RETENTION_GATE = "RET";

/**
 * Milestones must be given in gate order (by sequence). The RET row and
 * zero-value milestones produce no instalments, but every milestone —
 * including zero-value ones like PC — participates as a controlling gate
 * for the next milestone's commencement.
 */
export function buildPaymentPlan(
  milestones: MilestoneSeed[],
  split: PaymentSplit = DEFAULT_SPLIT
): PlannedPayment[] {
  const ordered = [...milestones].sort((a, b) => a.sequence - b.sequence);
  const plan: PlannedPayment[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const m = ordered[i];
    if (m.code === RETENTION_GATE || m.value <= 0) continue;

    const commencement = Math.round(m.value * split.commencement);
    const completion = Math.round(m.value * split.completion);
    // Retention takes the remainder so the three instalments always sum
    // exactly to the milestone value despite rounding.
    const retention = m.value - commencement - completion;

    const previousGate = i > 0 ? ordered[i - 1].code : m.code;

    plan.push(
      {
        milestone_code: m.code,
        type: "COMMENCEMENT",
        amount: commencement,
        controlling_gate: previousGate,
      },
      {
        milestone_code: m.code,
        type: "COMPLETION",
        amount: completion,
        controlling_gate: m.code,
      },
      {
        milestone_code: m.code,
        type: "RETENTION",
        amount: retention,
        controlling_gate: RETENTION_GATE,
      }
    );
  }

  return plan;
}
