"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembershipForProject } from "@/lib/auth/membership";
import {
  decideSubmit,
  findActiveRecord,
  type Submission,
  type InspectionMeta,
  type Signer,
} from "@/domain/signing";
import { ncrForFail, defectForPassWithComment } from "@/domain/registers";
import type { Check, CheckState, Result, RecordSnapshot } from "@/domain/types";

export interface SubmitResult {
  error: string | null;
  warnings: string[];
}

function parseChecks(formData: FormData, checklist: { seq: number; text: string }[]): Check[] {
  // State comes from the form; text comes from the DB (trusted).
  return checklist.map((item) => ({
    text: item.text,
    state: (String(formData.get(`check_${item.seq}`) ?? "na") as CheckState),
  }));
}

export async function submitInspection(
  projectId: string,
  code: string,
  _prev: SubmitResult,
  formData: FormData
): Promise<SubmitResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMembershipForProject(projectId);
  if (!membership) return { error: "No access to this project.", warnings: [] };

  // Load authoritative inspection meta + checklist + records.
  const { data: insp } = await supabase
    .from("inspections")
    .select("id, milestone_code, hidden, min_photos")
    .eq("project_id", projectId)
    .eq("code", code)
    .single();
  if (!insp) return { error: "Inspection not found.", warnings: [] };

  const [{ data: items }, { data: records }, { count: photoCount }] = await Promise.all([
    supabase.from("checklist_items").select("seq, text").eq("inspection_id", insp.id).order("seq"),
    supabase
      .from("inspection_records")
      .select("id, result, signoff, contractor_signed_by, contractor_signed_at, cm_signed_by, cm_signed_at, area, notes, hidden_release, checks, ncr_id, created_at")
      .eq("project_id", projectId)
      .eq("inspection_code", code),
    supabase.from("photos").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("inspection_code", code),
  ]);

  const checklist = (items ?? []).map((i) => ({ seq: i.seq, text: i.text }));
  const recordsRaw: (RecordSnapshot & { createdAt: string })[] = (records ?? []).map((r) => ({
    id: r.id,
    result: r.result as Result | null,
    signoff: r.signoff,
    contractorSignedBy: r.contractor_signed_by,
    contractorSignedAt: r.contractor_signed_at,
    cmSignedBy: r.cm_signed_by,
    cmSignedAt: r.cm_signed_at,
    area: r.area,
    notes: r.notes,
    hiddenRelease: r.hidden_release,
    checks: (r.checks as Check[]) ?? [],
    ncrId: r.ncr_id,
    createdAt: r.created_at,
  }));
  const active = findActiveRecord(recordsRaw);

  const submission: Submission = {
    result: String(formData.get("result") ?? "") as Result,
    checks: parseChecks(formData, checklist),
    notes: (formData.get("notes") as string | null)?.toString() ?? null,
    area: (formData.get("area") as string | null)?.toString() ?? null,
    photoCount: photoCount ?? 0,
    releaseToCover: formData.get("releaseToCover") === "on",
  };
  const signer: Signer = { userId: user.id, role: membership.role };
  const meta: InspectionMeta = {
    checklistLength: checklist.length,
    minPhotos: insp.min_photos,
    hidden: insp.hidden,
  };
  const now = new Date().toISOString();

  const decision = decideSubmit(active, signer, submission, meta, now);

  if (decision.kind === "rejected") {
    const reason = decision.reason;
    if (reason.code === "SAME_USER_BOTH_SIGNATURES") {
      return {
        error: "You cannot provide both signatures on the same record.",
        warnings: [],
      };
    }
    return {
      error: describeErrors(reason.errors),
      warnings: [],
    };
  }

  const w = decision.record;
  const rowValues = {
    result: w.result,
    signoff: w.signoff,
    contractor_signed_by: w.contractorSignedBy,
    contractor_signed_at: w.contractorSignedAt,
    cm_signed_by: w.cmSignedBy,
    cm_signed_at: w.cmSignedAt,
    area: w.area,
    notes: w.notes,
    hidden_release: w.hiddenRelease,
    checks: w.checks,
  };

  let recordId: string;
  if (decision.kind === "create") {
    const { data, error } = await supabase
      .from("inspection_records")
      .insert({ project_id: projectId, inspection_code: code, ...rowValues })
      .select("id")
      .single();
    if (error || !data) return { error: writeError(error), warnings: [] };
    recordId = data.id;
  } else if (decision.kind === "reinspect") {
    const sup = await supabase
      .from("inspection_records")
      .update({ signoff: "SUPERSEDED", superseded_at: now })
      .eq("id", decision.supersedeRecordId);
    if (sup.error) return { error: writeError(sup.error), warnings: [] };
    const { data, error } = await supabase
      .from("inspection_records")
      .insert({ project_id: projectId, inspection_code: code, ...rowValues })
      .select("id")
      .single();
    if (error || !data) return { error: writeError(error), warnings: [] };
    recordId = data.id;
  } else {
    // countersign or self_edit
    const { error } = await supabase
      .from("inspection_records")
      .update(rowValues)
      .eq("id", decision.recordId);
    if (error) return { error: writeError(error), warnings: [] };
    recordId = decision.recordId;
  }

  // Clear the draft (Section 4.2 / 4.7).
  await supabase.from("drafts").delete().eq("project_id", projectId).eq("inspection_code", code);

  // Automatic register entries (Section 4.6) — system actions, run with the
  // service role since a contractor lacks write access to ncrs/defects.
  await runRegisterAutomation({
    projectId,
    recordId,
    milestoneCode: insp.milestone_code,
    inspectionCode: code,
    result: w.result,
    signoff: w.signoff,
    checks: w.checks,
    notes: w.notes,
    existingNcrId: active?.ncrId ?? null,
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}?submitted=${code}`);
}

async function runRegisterAutomation(args: {
  projectId: string;
  recordId: string;
  milestoneCode: string;
  inspectionCode: string;
  result: Result;
  signoff: string;
  checks: Check[];
  notes: string | null;
  existingNcrId: string | null;
}) {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const ncr = ncrForFail({
    result: args.result,
    existingNcrId: args.existingNcrId,
    checks: args.checks,
    milestoneCode: args.milestoneCode,
    inspectionCode: args.inspectionCode,
    nextSeq: await nextSeq(admin, "ncrs", args.projectId),
    today,
    dueDays: 14,
  });
  if (ncr) {
    const { data } = await admin
      .from("ncrs")
      .insert({
        project_id: args.projectId,
        seq: ncr.seq,
        milestone_code: ncr.milestoneCode,
        inspection_code: ncr.inspectionCode,
        description: ncr.description,
        due_date: ncr.dueDate,
        status: ncr.status,
      })
      .select("id")
      .single();
    if (data) {
      await admin.from("inspection_records").update({ ncr_id: data.id }).eq("id", args.recordId);
    }
  }

  const defect = defectForPassWithComment({
    result: args.result,
    becameComplete: args.signoff === "COMPLETE",
    notes: args.notes,
    milestoneCode: args.milestoneCode,
    nextSeq: await nextSeq(admin, "defects", args.projectId),
  });
  if (defect) {
    await admin.from("defects").insert({
      project_id: args.projectId,
      seq: defect.seq,
      milestone_code: defect.milestoneCode,
      description: defect.description,
      category: defect.category,
      status: defect.status,
    });
  }
}

async function nextSeq(
  admin: ReturnType<typeof createAdminClient>,
  table: "ncrs" | "defects",
  projectId: string
): Promise<number> {
  const { data } = await admin
    .from(table)
    .select("seq")
    .eq("project_id", projectId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.seq ?? 0) + 1;
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
  const checks = parseChecks(formData, (items ?? []).map((i) => ({ seq: i.seq, text: i.text })));

  await supabase.from("drafts").upsert(
    {
      project_id: projectId,
      inspection_code: code,
      saved_by: user.id,
      saved_at: new Date().toISOString(),
      payload: {
        checks,
        notes: formData.get("notes")?.toString() ?? null,
        area: formData.get("area")?.toString() ?? null,
      },
    },
    { onConflict: "project_id,inspection_code" }
  );
  revalidatePath(`/projects/${projectId}`);
  return { saved: true };
}

function describeErrors(errors: { code: string }[]): string {
  const map: Record<string, string> = {
    NO_RESULT: "Choose a result.",
    ROLE_CANNOT_SIGN: "Your role cannot sign this inspection.",
    CHECKLIST_INCOMPLETE: "Answer every checklist item (pass / fail / n/a).",
    NOTE_REQUIRED_FOR_PASS_WITH_COMMENT: "A note is required for pass-with-comment.",
  };
  return errors.map((e) => map[e.code] ?? e.code).join(" ");
}

function writeError(error: { message?: string } | null): string {
  return error?.message ?? "Could not save. Please try again.";
}
