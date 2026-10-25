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

// Contractor columns: planned inspection date and planned completion date.
export async function saveContractorTracking(
  projectId: string,
  code: string,
  plannedDate: string | null,
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

// Contractor's element fields: result, remarks + planned/actual/completion dates.
export async function saveElementContractor(
  projectId: string,
  elementId: string,
  result: string | null,
  remarks: string | null,
  plannedDate: string | null,
  actualDate: string | null,
  completionDate: string | null
): Promise<TrackingResult> {
  const guard = await requireRole(projectId, ["contractor", "owner"]);
  if (!guard.ok) return { ok: false, error: guard.error };
  const r = clean(result);
  if (r !== null && !RESULTS.includes(r)) return { ok: false, error: "Invalid result." };
  const supabase = createClient();
  const { error } = await supabase
    .from("elements")
    .update({
      contractor_result: r,
      contractor_remarks: clean(remarks),
      contractor_by: guard.userId,
      contractor_at: new Date().toISOString(),
      planned_date: clean(plannedDate),
      actual_date: clean(actualDate),
      completion_date: clean(completionDate),
    })
    .eq("project_id", projectId)
    .eq("element_id", elementId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}/programme`);
  revalidatePath(`/projects/${projectId}/elements/${elementId}`);
  return { ok: true, error: null };
}

// CM's element fields: result, remarks + CM check date.
export async function saveElementCm(
  projectId: string,
  elementId: string,
  result: string | null,
  remarks: string | null,
  cmCheckDate: string | null
): Promise<TrackingResult> {
  const guard = await requireRole(projectId, ["cm", "owner"]);
  if (!guard.ok) return { ok: false, error: guard.error };
  const r = clean(result);
  if (r !== null && !RESULTS.includes(r)) return { ok: false, error: "Invalid result." };
  const supabase = createClient();
  const { error } = await supabase
    .from("elements")
    .update({
      cm_result: r,
      cm_remarks: clean(remarks),
      cm_by: guard.userId,
      cm_at: new Date().toISOString(),
      cm_check_date: clean(cmCheckDate),
    })
    .eq("project_id", projectId)
    .eq("element_id", elementId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}/programme`);
  revalidatePath(`/projects/${projectId}/elements/${elementId}`);
  return { ok: true, error: null };
}

// CM columns: actual inspection date, result, remarks.
export async function saveCmTracking(
  projectId: string,
  code: string,
  actualDate: string | null,
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
      actual_date: clean(actualDate),
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
