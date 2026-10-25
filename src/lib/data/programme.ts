import { createClient } from "@/lib/supabase/server";
import { getLang, localize } from "@/lib/i18n/server";
import { findActiveRecord } from "@/domain/signing";
import type { Result } from "@/domain/types";

export interface ProgrammeElement {
  elementId: string;
  category: string;
  elementType: string | null;
  label: string | null;
  qty: number;
  contractorResult: string | null;
  contractorRemarks: string | null;
  cmResult: string | null;
  cmRemarks: string | null;
  plannedDate: string | null;
  actualDate: string | null;
  completionDate: string | null;
  cmCheckDate: string | null;
}

export interface ProgrammeRow {
  code: string;
  name: string;
  pointType: "HOLD" | "WITNESS" | "SURVEILLANCE" | "RECORDS";
  hidden: boolean;
  scheduleSeq: number;
  elements: ProgrammeElement[];
  // contractor-maintained
  plannedDate: string | null;
  actualDate: string | null;
  completionDate: string | null;
  // CM-maintained
  cmCheckDate: string | null;
  result: string | null;
  remarks: string | null;
  // read-only, derived from the formal sign-off record
  appResult: Result | null;
  appSignoff: string | null;
  appComplete: boolean;
}

export interface ProgrammeActivity {
  title: string;
  rows: ProgrammeRow[];
}

export interface ProgrammePhase {
  code: string;
  name: string;
  sequence: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  durationDays: number | null;
  activities: ProgrammeActivity[];
}

export interface ProgrammeData {
  projectName: string;
  phases: ProgrammePhase[];
}

export interface ProgressCount {
  done: number;
  total: number;
}
export interface ProgrammeProgress {
  inspections: ProgressCount;
  elements: ProgressCount;
  byCategory: { category: string; done: number; total: number }[];
  byPhase: { code: string; name: string; sequence: number; done: number; total: number }[];
}

const PASSED = (r: string | null | undefined) =>
  r === "PASS" || r === "PASS_WITH_COMMENT";

/** Lightweight rollup for the dashboard + programme summary. */
export async function getProgrammeProgress(
  projectId: string
): Promise<ProgrammeProgress | null> {
  const supabase = createClient();
  const [phasesRes, trackRes, elemRes, recordsRes] = await Promise.all([
    supabase
      .from("phases")
      .select("code, name, sequence")
      .eq("project_id", projectId)
      .order("sequence"),
    supabase
      .from("inspection_tracking")
      .select("phase_code, result")
      .eq("project_id", projectId),
    supabase
      .from("elements")
      .select("category, cm_result")
      .eq("project_id", projectId),
    supabase
      .from("inspection_records")
      .select("inspection_code, result, signoff, created_at")
      .eq("project_id", projectId),
  ]);
  if (phasesRes.error) return null;

  // an inspection counts as done when the CM tracker result is a pass, OR the
  // formal app sign-off is COMPLETE with a pass.
  type Rec = { signoff: string; createdAt: string; result: Result | null };
  const recByCode = new Map<string, { result: Result | null; signoff: string }>();
  const grouped = new Map<string, Rec[]>();
  for (const r of recordsRes.data ?? []) {
    if (!grouped.has(r.inspection_code)) grouped.set(r.inspection_code, []);
    grouped.get(r.inspection_code)!.push({
      signoff: r.signoff as string,
      createdAt: r.created_at as string,
      result: r.result as Result | null,
    });
  }
  grouped.forEach((rows, code) => {
    const a = findActiveRecord<Rec>(rows);
    if (a) recByCode.set(code, { result: a.result, signoff: a.signoff });
  });

  const track = trackRes.data ?? [];
  const phaseTotals = new Map<string, { done: number; total: number }>();
  let inspDone = 0;
  for (const t of track) {
    const appRec = recByCode.get((t as { inspection_code?: string }).inspection_code ?? "");
    const done =
      PASSED(t.result as string | null) ||
      (appRec?.signoff === "COMPLETE" && PASSED(appRec.result));
    if (done) inspDone++;
    const pc = phaseTotals.get(t.phase_code as string) ?? { done: 0, total: 0 };
    pc.total++;
    if (done) pc.done++;
    phaseTotals.set(t.phase_code as string, pc);
  }

  const elems = elemRes.data ?? [];
  const catTotals = new Map<string, { done: number; total: number }>();
  let elemDone = 0;
  for (const e of elems) {
    const done = PASSED(e.cm_result as string | null);
    if (done) elemDone++;
    const cc = catTotals.get(e.category as string) ?? { done: 0, total: 0 };
    cc.total++;
    if (done) cc.done++;
    catTotals.set(e.category as string, cc);
  }

  return {
    inspections: { done: inspDone, total: track.length },
    elements: { done: elemDone, total: elems.length },
    byCategory: Array.from(catTotals.entries()).map(([category, v]) => ({
      category,
      ...v,
    })),
    byPhase: (phasesRes.data ?? []).map((p) => ({
      code: p.code as string,
      name: p.name as string,
      sequence: p.sequence as number,
      ...(phaseTotals.get(p.code as string) ?? { done: 0, total: 0 }),
    })),
  };
}

export async function getProgramme(
  projectId: string
): Promise<ProgrammeData | null> {
  const supabase = createClient();
  const lang = getLang();

  const [projectRes, phasesRes, trackRes, inspRes, recordsRes, elemRes] =
    await Promise.all([
      supabase.from("projects").select("name").eq("id", projectId).single(),
      supabase
        .from("phases")
        .select("code, name, sequence, planned_start, planned_end, duration_days")
        .eq("project_id", projectId)
        .order("sequence"),
      supabase
        .from("inspection_tracking")
        .select(
          "inspection_code, phase_code, activity, schedule_seq, planned_date, actual_date, completion_date, cm_check_date, result, remarks"
        )
        .eq("project_id", projectId),
      supabase
        .from("inspections")
        .select("code, name, name_th, point_type, hidden")
        .eq("project_id", projectId),
      supabase
        .from("inspection_records")
        .select("inspection_code, result, signoff, created_at")
        .eq("project_id", projectId),
      supabase
        .from("elements")
        .select(
          "inspection_code, element_id, category, element_type, label, qty, contractor_result, contractor_remarks, cm_result, cm_remarks, planned_date, actual_date, completion_date, cm_check_date, sort_order"
        )
        .eq("project_id", projectId)
        .order("sort_order"),
    ]);

  if (projectRes.error || !projectRes.data) return null;

  // elements grouped by inspection code
  const elemByCode = new Map<string, ProgrammeElement[]>();
  for (const el of elemRes.data ?? []) {
    const e: ProgrammeElement = {
      elementId: el.element_id,
      category: el.category,
      elementType: el.element_type,
      label: el.label,
      qty: el.qty ?? 1,
      contractorResult: el.contractor_result,
      contractorRemarks: el.contractor_remarks,
      cmResult: el.cm_result,
      cmRemarks: el.cm_remarks,
      plannedDate: el.planned_date,
      actualDate: el.actual_date,
      completionDate: el.completion_date,
      cmCheckDate: el.cm_check_date,
    };
    if (!elemByCode.has(el.inspection_code)) elemByCode.set(el.inspection_code, []);
    elemByCode.get(el.inspection_code)!.push(e);
  }

  const inspByCode = new Map(
    (inspRes.data ?? []).map((i) => [i.code, i])
  );

  // latest active record per inspection code
  type Rec = { signoff: string; createdAt: string; result: Result | null };
  const recByCode = new Map<string, { result: Result | null; signoff: string }>();
  const grouped = new Map<string, Rec[]>();
  for (const r of recordsRes.data ?? []) {
    if (!grouped.has(r.inspection_code)) grouped.set(r.inspection_code, []);
    grouped.get(r.inspection_code)!.push({
      signoff: r.signoff as string,
      createdAt: r.created_at as string,
      result: r.result as Result | null,
    });
  }
  grouped.forEach((rows, code) => {
    const active = findActiveRecord<Rec>(rows);
    if (active) recByCode.set(code, { result: active.result, signoff: active.signoff });
  });

  const phases = (phasesRes.data ?? []).map((p) => ({
    code: p.code as string,
    name: p.name as string,
    sequence: p.sequence as number,
    plannedStart: p.planned_start as string | null,
    plannedEnd: p.planned_end as string | null,
    durationDays: p.duration_days as number | null,
  }));

  // index tracking rows by phase
  const rowsByPhase = new Map<string, ProgrammeRow[]>();
  for (const t of trackRes.data ?? []) {
    const insp = inspByCode.get(t.inspection_code);
    if (!insp) continue;
    const rec = recByCode.get(t.inspection_code);
    const row: ProgrammeRow = {
      code: t.inspection_code,
      name: localize(insp.name, insp.name_th, lang),
      pointType: insp.point_type,
      hidden: insp.hidden,
      scheduleSeq: (t.schedule_seq as number) ?? 0,
      elements: elemByCode.get(t.inspection_code) ?? [],
      plannedDate: t.planned_date,
      actualDate: t.actual_date,
      completionDate: t.completion_date,
      cmCheckDate: t.cm_check_date,
      result: t.result,
      remarks: t.remarks,
      appResult: rec?.result ?? null,
      appSignoff: rec?.signoff ?? null,
      appComplete: rec?.signoff === "COMPLETE",
    };
    const key = (t.phase_code as string) ?? "";
    if (!rowsByPhase.has(key)) rowsByPhase.set(key, []);
    rowsByPhase.get(key)!.push(row);
  }

  const phaseViews: ProgrammePhase[] = phases.map((p) => {
    const rows = (rowsByPhase.get(p.code) ?? []).sort(
      (a, b) => a.scheduleSeq - b.scheduleSeq
    );
    // group into activities, preserving first-seen order (we need the activity
    // label; pull it from the tracking rows via a parallel map)
    const actOrder: string[] = [];
    const actRows = new Map<string, ProgrammeRow[]>();
    const actByCode = new Map(
      (trackRes.data ?? []).map((t) => [t.inspection_code, (t.activity as string) ?? ""])
    );
    for (const r of rows) {
      const act = actByCode.get(r.code) ?? "";
      if (!actRows.has(act)) {
        actRows.set(act, []);
        actOrder.push(act);
      }
      actRows.get(act)!.push(r);
    }
    return {
      ...p,
      activities: actOrder.map((title) => ({ title, rows: actRows.get(title)! })),
    };
  });

  return { projectName: projectRes.data.name, phases: phaseViews };
}

export interface ElementPhoto {
  id: string;
  ref: string;
  url: string | null;
  createdAt: string;
}
export interface ElementDetail {
  projectId: string;
  elementId: string;
  category: string;
  elementType: string | null;
  label: string | null;
  qty: number;
  inspectionCode: string;
  inspectionName: string;
  milestoneCode: string;
  familyCode: string;
  contractorResult: string | null;
  contractorRemarks: string | null;
  cmResult: string | null;
  cmRemarks: string | null;
  plannedDate: string | null;
  actualDate: string | null;
  completionDate: string | null;
  cmCheckDate: string | null;
  photos: ElementPhoto[];
}

export async function getElement(
  projectId: string,
  elementId: string
): Promise<ElementDetail | null> {
  const supabase = createClient();
  const lang = getLang();
  const { data: el } = await supabase
    .from("elements")
    .select(
      "element_id, inspection_code, category, element_type, label, qty, contractor_result, contractor_remarks, cm_result, cm_remarks, planned_date, actual_date, completion_date, cm_check_date"
    )
    .eq("project_id", projectId)
    .eq("element_id", elementId)
    .maybeSingle();
  if (!el) return null;

  const { data: insp } = await supabase
    .from("inspections")
    .select("name, name_th, milestone_code, family_code")
    .eq("project_id", projectId)
    .eq("code", el.inspection_code)
    .maybeSingle();

  const { data: photoRows } = await supabase
    .from("photos")
    .select("id, ref, storage_path, created_at")
    .eq("project_id", projectId)
    .eq("element_id", elementId)
    .order("created_at", { ascending: true });

  const signed = await Promise.all(
    (photoRows ?? []).map((p) =>
      supabase.storage.from("photos").createSignedUrl(p.storage_path, 3600)
    )
  );
  const photos: ElementPhoto[] = (photoRows ?? []).map((p, i) => ({
    id: p.id,
    ref: p.ref,
    url: signed[i].data?.signedUrl ?? null,
    createdAt: p.created_at,
  }));

  return {
    projectId,
    elementId: el.element_id,
    category: el.category,
    elementType: el.element_type,
    label: el.label,
    qty: el.qty ?? 1,
    inspectionCode: el.inspection_code,
    inspectionName: insp ? localize(insp.name, insp.name_th, lang) : el.inspection_code,
    milestoneCode: insp?.milestone_code ?? "",
    familyCode: insp?.family_code ?? "",
    contractorResult: el.contractor_result,
    contractorRemarks: el.contractor_remarks,
    cmResult: el.cm_result,
    cmRemarks: el.cm_remarks,
    plannedDate: el.planned_date,
    actualDate: el.actual_date,
    completionDate: el.completion_date,
    cmCheckDate: el.cm_check_date,
    photos,
  };
}
