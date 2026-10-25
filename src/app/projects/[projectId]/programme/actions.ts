"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import type { Role } from "@/domain/types";

export interface TrackingResult {
  ok: boolean;
  error: string | null;
}

async function requireRole(
  projectId: string,
  roles: Role[]
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const membership = await getMembershipForProject(projectId);
  if (!membership || !roles.includes(membership.role)) {
    return { ok: false, error: "You cannot edit these fields." };
  }
  return { ok: true, userId: user.id };
}

const clean = (v: string | null | undefined): string | null => {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
};

// Contractor columns: planned / actual / completion inspection dates.
export async function saveContractorTracking(
  projectId: string,
  code: string,
  plannedDate: string | null,
  actualDate: string | null,
  completionDate: string | null
): Promise<TrackingResult> {
  const guard = await requireRole(projectId, ["contractor", "owner"]);
  if (!guard.ok) return { ok: false, error: guard.error };
  const supabase = createClient();
  const { error } = await supabase.from("inspection_tracking").upsert(
    {
      project_id: projectId,
      inspection_code: code,
      planned_date: clean(plannedDate),
      actual_date: clean(actualDate),
      completion_date: clean(completionDate),
      updated_by: guard.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,inspection_code" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}/programme`);
  return { ok: true, error: null };
}

const RESULTS = ["PASS", "FAIL", "PASS_WITH_COMMENT", "NA"];

// A single element's pass/fail + remark, for one party.
export async function saveElement(
  projectId: string,
  elementId: string,
  party: "contractor" | "cm",
  result: string | null,
  remarks: string | null
): Promise<TrackingResult> {
  const roles: Role[] =
    party === "contractor" ? ["contractor", "owner"] : ["cm", "owner"];
  const guard = await requireRole(projectId, roles);
  if (!guard.ok) return { ok: false, error: guard.error };
  const r = clean(result);
  if (r !== null && !RESULTS.includes(r)) {
    return { ok: false, error: "Invalid result." };
  }
  const now = new Date().toISOString();
  const patch =
    party === "contractor"
      ? {
          contractor_result: r,
          contractor_remarks: clean(remarks),
          contractor_by: guard.userId,
          contractor_at: now,
        }
      : {
          cm_result: r,
          cm_remarks: clean(remarks),
          cm_by: guard.userId,
          cm_at: now,
        };
  const supabase = createClient();
  const { error } = await supabase
    .from("elements")
    .update(patch)
    .eq("project_id", projectId)
    .eq("element_id", elementId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}/programme`);
  return { ok: true, error: null };
}

// CM columns: check date, result, remarks.
export async function saveCmTracking(
  projectId: string,
  code: string,
  cmCheckDate: string | null,
  result: string | null,
  remarks: string | null
): Promise<TrackingResult> {
  const guard = await requireRole(projectId, ["cm", "owner"]);
  if (!guard.ok) return { ok: false, error: guard.error };
  const r = clean(result);
  if (r !== null && !RESULTS.includes(r)) {
    return { ok: false, error: "Invalid result." };
  }
  const supabase = createClient();
  const { error } = await supabase.from("inspection_tracking").upsert(
    {
      project_id: projectId,
      inspection_code: code,
      cm_check_date: clean(cmCheckDate),
      result: r,
      remarks: clean(remarks),
      updated_by: guard.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id,inspection_code" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}/programme`);
  return { ok: true, error: null };
}
