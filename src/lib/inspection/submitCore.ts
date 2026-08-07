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
import type { Check, Result, RecordSnapshot } from "@/domain/types";
import type { SubmitPayload, SubmitOutcome } from "./types";

// The payload is transport-agnostic: it comes either from the form (online)
// or from the offline queue (JSON) when connectivity returns. Only the answer
// states travel; checklist text is always re-read from the DB (trusted).
export type { SubmitPayload, SubmitOutcome };

export async function performInspectionSubmit(
  projectId: string,
  code: string,
  payload: SubmitPayload
): Promise<SubmitOutcome> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in.", warnings: [] };

  const membership = await getMembershipForProject(projectId);
  if (!membership) return { ok: false, error: "No access to this project.", warnings: [] };

  const { data: insp } = await supabase
    .from("inspections")
    .select("id, milestone_code, hidden, min_photos")
    .eq("project_id", projectId)
    .eq("code", code)
    .single();
  if (!insp) return { ok: false, error: "Inspection not found.", warnings: [] };

  const [{ data: items }, { data: records }, { count: photoCount }] = await Promise.all([
    supabase.from("checklist_items").select("seq, text").eq("inspection_id", insp.id).order("seq"),
    supabase
      .from("inspection_records")
      .select("id, result, signoff, contractor_signed_by, contractor_signed_at, cm_signed_by, cm_signed_at, area, notes, hidden_release, checks, contractor_checks, cm_checks, ncr_id, created_at")
      .eq("project_id", projectId)
      .eq("inspection_code", code),
    supabase.from("photos").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("inspection_code", code),
  ]);

  const checklist = (items ?? []).map((i) => ({ seq: i.seq, text: i.text }));
  const checks: Check[] = checklist.map((item) => {
    const note = (payload.checkNotes?.[String(item.seq)] ?? "").trim();
    return {
      text: item.text,
      state: payload.checkStates[String(item.seq)] ?? "na",
      ...(note ? { note } : {}),
    };
  });

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
    contractorChecks: (r.contractor_checks as Check[] | null) ?? null,
    cmChecks: (r.cm_checks as Check[] | null) ?? null,
    ncrId: r.ncr_id,
    createdAt: r.created_at,
  }));
  const active = findActiveRecord(recordsRaw);

  const submission: Submission = {
    result: payload.result,
    checks,
    notes: payload.notes,
    area: payload.area,
    photoCount: photoCount ?? 0,
    releaseToCover: payload.releaseToCover,
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
      return { ok: false, error: "You cannot provide both signatures on the same record.", warnings: [] };
    }
    return { ok: false, error: describeErrors(reason.errors), warnings: [] };
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
    contractor_checks: w.contractorChecks,
    cm_checks: w.cmChecks,
  };

  let recordId: string;
  if (decision.kind === "create") {
    const { data, error } = await supabase
      .from("inspection_records")
      .insert({ project_id: projectId, inspection_code: code, ...rowValues })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: writeError(error), warnings: [] };
    recordId = data.id;
  } else if (decision.kind === "reinspect") {
    const sup = await supabase
      .from("inspection_records")
      .update({ signoff: "SUPERSEDED", superseded_at: now })
      .eq("id", decision.supersedeRecordId);
    if (sup.error) return { ok: false, error: writeError(sup.error), warnings: [] };
    const { data, error } = await supabase
      .from("inspection_records")
      .insert({ project_id: projectId, inspection_code: code, ...rowValues })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: writeError(error), warnings: [] };
    recordId = data.id;
  } else {
    const { error } = await supabase
      .from("inspection_records")
      .update(rowValues)
      .eq("id", decision.recordId);
    if (error) return { ok: false, error: writeError(error), warnings: [] };
    recordId = decision.recordId;
  }

  await supabase.from("drafts").delete().eq("project_id", projectId).eq("inspection_code", code);

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

  return { ok: true, error: null, warnings: [] };
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

function describeErrors(errors: { code: string }[]): string {
  const map: Record<string, string> = {
    NO_RESULT: "Choose a result.",
    ROLE_CANNOT_SIGN: "Your role cannot sign this inspection.",
    CHECKLIST_INCOMPLETE: "Answer every checklist item (pass / fail / na).",
    NOTE_REQUIRED_FOR_PASS_WITH_COMMENT: "A note is required for pass-with-comment.",
  };
  return errors.map((e) => map[e.code] ?? e.code).join(" ");
}

function writeError(error: { message?: string } | null): string {
  return error?.message ?? "Could not save. Please try again.";
}
