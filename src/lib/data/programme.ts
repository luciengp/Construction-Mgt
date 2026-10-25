import { createClient } from "@/lib/supabase/server";
import { getLang, localize } from "@/lib/i18n/server";
import { findActiveRecord } from "@/domain/signing";
import type { Result } from "@/domain/types";

export interface ProgrammeRow {
  code: string;
  name: string;
  pointType: "HOLD" | "WITNESS" | "SURVEILLANCE" | "RECORDS";
  hidden: boolean;
  scheduleSeq: number;
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

export async function getProgramme(
  projectId: string
): Promise<ProgrammeData | null> {
  const supabase = createClient();
  const lang = getLang();

  const [projectRes, phasesRes, trackRes, inspRes, recordsRes] =
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
    ]);

  if (projectRes.error || !projectRes.data) return null;

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
