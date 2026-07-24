"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { getPayments } from "@/lib/data/payments";

export interface CertifyState {
  error: string | null;
}

// Owner-only. Certifies a releasable instalment. The domain gate is
// re-checked server-side so a payment can never be certified while its
// controlling gate is not READY, regardless of what the client sends.
export async function certifyPayment(
  projectId: string,
  milestoneCode: string,
  type: string,
  _prev: CertifyState,
  _formData: FormData
): Promise<CertifyState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const membership = await getMembershipForProject(projectId);
  if (!membership || membership.role !== "owner") {
    return { error: "Only the Owner can certify payments." };
  }

  const payments = await getPayments(projectId);
  const instalment = payments?.milestones
    .find((m) => m.milestoneCode === milestoneCode)
    ?.instalments.find((i) => i.type === type);

  if (!instalment) return { error: "Instalment not found." };
  if (!instalment.releasable) {
    return {
      error: "The controlling gate is not READY — this cannot be released yet.",
    };
  }

  const { error } = await supabase
    .from("payments")
    .update({ status: "CERTIFIED", certified_by: user.id, certified_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("milestone_code", milestoneCode)
    .eq("type", type);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}/payments`);
  return { error: null };
}
