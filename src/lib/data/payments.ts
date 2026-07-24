import { createClient } from "@/lib/supabase/server";
import { getDashboard } from "@/lib/data/dashboard";
import { canRelease } from "@/domain/payments";
import type { GateStatus } from "@/domain/gates";
import type { PlannedPayment } from "@/domain/paymentPlan";

export interface PaymentRow {
  milestoneCode: string;
  type: "COMMENCEMENT" | "COMPLETION" | "RETENTION";
  amount: number;
  controllingGate: string;
  status: "HOLD" | "RELEASE" | "CERTIFIED" | "PAID";
  /** Domain says the controlling gate is READY and (for retention) the delay elapsed. */
  releasable: boolean;
  controllingGateStatus: GateStatus | "UNKNOWN";
}

export interface MilestonePayments {
  milestoneCode: string;
  description: string;
  instalments: PaymentRow[];
}

export interface PaymentsData {
  projectName: string;
  milestones: MilestonePayments[];
  totals: { hold: number; releasable: number; certified: number; paid: number };
  completionCertified: boolean;
}

// The completion certificate is issued when ITP-075 (Practical Completion) is
// a counted pass. Used to start the retention clock.
const COMPLETION_CERT_INSPECTION = "ITP-075";

export async function getPayments(projectId: string): Promise<PaymentsData | null> {
  const supabase = createClient();
  const dashboard = await getDashboard(projectId);
  if (!dashboard) return null;

  const gateStatus: Record<string, GateStatus> = {};
  const milestoneDesc: Record<string, string> = {};
  for (const m of dashboard.milestones) {
    gateStatus[m.code] = m.gate.status;
    milestoneDesc[m.code] = m.description;
  }

  const [{ data: paymentsRaw }, { data: project }, { data: certRecord }] =
    await Promise.all([
      supabase
        .from("payments")
        .select("milestone_code, type, amount, controlling_gate, status")
        .eq("project_id", projectId),
      supabase.from("projects").select("settings").eq("id", projectId).single(),
      supabase
        .from("inspection_records")
        .select("cm_signed_at, result, signoff")
        .eq("project_id", projectId)
        .eq("inspection_code", COMPLETION_CERT_INSPECTION)
        .eq("signoff", "COMPLETE")
        .in("result", ["PASS", "PASS_WITH_COMMENT"])
        .order("cm_signed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const settings = (project?.settings as { retention_delay_days?: number }) ?? {};
  const retentionDelayDays = settings.retention_delay_days ?? 30;
  const completionCertifiedAt = certRecord?.cm_signed_at ?? null;
  const now = new Date().toISOString();

  const byMilestone = new Map<string, PaymentRow[]>();
  const totals = { hold: 0, releasable: 0, certified: 0, paid: 0 };

  for (const p of paymentsRaw ?? []) {
    const planned: Pick<PlannedPayment, "type" | "controlling_gate"> = {
      type: p.type,
      controlling_gate: p.controlling_gate,
    };
    const releasable = canRelease(planned, {
      gateStatus,
      completionCertifiedAt,
      retentionDelayDays,
      now,
    });
    const row: PaymentRow = {
      milestoneCode: p.milestone_code,
      type: p.type,
      amount: Number(p.amount),
      controllingGate: p.controlling_gate,
      status: p.status,
      releasable,
      controllingGateStatus: gateStatus[p.controlling_gate] ?? "UNKNOWN",
    };
    if (!byMilestone.has(p.milestone_code)) byMilestone.set(p.milestone_code, []);
    byMilestone.get(p.milestone_code)!.push(row);

    if (p.status === "PAID") totals.paid += row.amount;
    else if (p.status === "CERTIFIED") totals.certified += row.amount;
    else if (releasable) totals.releasable += row.amount;
    else totals.hold += row.amount;
  }

  const order = ["COMMENCEMENT", "COMPLETION", "RETENTION"];
  const milestones: MilestonePayments[] = dashboard.milestones
    .filter((m) => byMilestone.has(m.code))
    .map((m) => ({
      milestoneCode: m.code,
      description: m.description,
      instalments: (byMilestone.get(m.code) ?? []).sort(
        (a, b) => order.indexOf(a.type) - order.indexOf(b.type)
      ),
    }));

  return {
    projectName: dashboard.projectName,
    milestones,
    totals,
    completionCertified: completionCertifiedAt !== null,
  };
}
