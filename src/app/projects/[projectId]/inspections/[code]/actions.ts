"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  performInspectionSubmit,
  type SubmitPayload,
} from "@/lib/inspection/submitCore";
import type { CheckState } from "@/domain/types";
import type { Result } from "@/domain/types";

export interface SubmitResult {
  error: string | null;
  warnings: string[];
}

function payloadFromForm(formData: FormData): SubmitPayload {
  const checkStates: Record<string, CheckState> = {};
  const checkNotes: Record<string, string> = {};
  Array.from(formData.entries()).forEach(([k, v]) => {
    if (k.startsWith("check_")) {
      checkStates[k.slice("check_".length)] = String(v) as CheckState;
    } else if (k.startsWith("note_")) {
      checkNotes[k.slice("note_".length)] = String(v);
    }
  });
  return {
    result: String(formData.get("result") ?? "") as Result,
    checkStates,
    checkNotes,
    notes: formData.get("notes")?.toString() ?? null,
    area: formData.get("area")?.toString() ?? null,
    releaseToCover: formData.get("releaseToCover") === "on",
  };
}

export async function submitInspection(
  projectId: string,
  code: string,
  _prev: SubmitResult,
  formData: FormData
): Promise<SubmitResult> {
  const outcome = await performInspectionSubmit(
    projectId,
    code,
    payloadFromForm(formData)
  );
  if (!outcome.ok) {
    return { error: outcome.error, warnings: outcome.warnings };
  }
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?submitted=${code}`);
}

export async function saveDraft(
  projectId: string,
  code: string,
  _prev: { saved: boolean },
  formData: FormData
): Promise<{ saved: boolean }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: insp } = await supabase
    .from("inspections")
    .select("id")
    .eq("project_id", projectId)
    .eq("code", code)
    .single();
  if (!insp) return { saved: false };

  const { data: items } = await supabase
    .from("checklist_items")
    .select("seq, text")
    .eq("inspection_id", insp.id)
    .order("seq");
  const payload = payloadFromForm(formData);
  const checks = (items ?? []).map((i) => {
    const note = (payload.checkNotes[String(i.seq)] ?? "").trim();
    return {
      text: i.text,
      state: payload.checkStates[String(i.seq)] ?? "na",
      ...(note ? { note } : {}),
    };
  });

  await supabase.from("drafts").upsert(
    {
      project_id: projectId,
      inspection_code: code,
      saved_by: user.id,
      saved_at: new Date().toISOString(),
      payload: { checks, notes: payload.notes, area: payload.area },
    },
    { onConflict: "project_id,inspection_code" }
  );
  revalidatePath(`/projects/${projectId}`);
  return { saved: true };
}
