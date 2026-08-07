import { createClient } from "@/lib/supabase/server";
import { getLang, localize } from "@/lib/i18n/server";
import {
  evaluateGate,
  activeRecord,
  type GateEvaluation,
  type RecordForGate,
} from "@/domain/gates";
import type { HiddenRelease, Result, Signoff } from "@/domain/types";

export interface InspectionView {
  code: string;
  name: string;
  familyCode: string;
  pointType: "HOLD" | "WITNESS" | "SURVEILLANCE" | "RECORDS";
  hidden: boolean;
  minPhotos: number;
  // Active-record-derived status:
  result: Result | null;
  signoff: Signoff | null;
  hiddenRelease: HiddenRelease;
  countsAsPassed: boolean;
  hasActiveFail: boolean;
  awaiting: boolean;
  hasDraft: boolean;
}

export interface MilestoneView {
  code: string;
  description: string;
  sequence: number;
  contractValue: number;
  payer: string | null;
  gate: GateEvaluation;
  openNcrCount: number;
  openCatADefectCount: number;
  inspections: InspectionView[];
}

export interface DashboardKpis {
  passed: number;
  failedOrNcr: number;
  awaitingSignoff: number;
  hiddenToRelease: number;
  milestonesComplete: number;
  milestonesTotal: number;
}

export interface DashboardData {
  projectName: string;
  milestones: MilestoneView[];
  kpis: DashboardKpis;
}

function counts<T>(rows: T[], key: (r: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export async function getDashboard(
  projectId: string
): Promise<DashboardData | null> {
  const supabase = createClient();
  const lang = getLang();

  const [projectRes, milestonesRes, inspectionsRes, recordsRes, ncrsRes, defectsRes, draftsRes] =
    await Promise.all([
      supabase.from("projects").select("name").eq("id", projectId).single(),
      supabase
        .from("milestones")
        .select("code, description, description_th, sequence, contract_value, payer")
        .eq("project_id", projectId)
        .order("sequence"),
      supabase
        .from("inspections")
        .select("code, name, name_th, milestone_code, family_code, point_type, hidden, min_photos")
        .eq("project_id", projectId),
      supabase
        .from("inspection_records")
        .select("inspection_code, result, signoff, hidden_release, created_at")
        .eq("project_id", projectId),
      supabase
        .from("ncrs")
        .select("milestone_code")
        .eq("project_id", projectId)
        .eq("status", "OPEN"),
      supabase
        .from("defects")
        .select("milestone_code, category")
        .eq("project_id", projectId)
        .eq("status", "OPEN"),
      supabase.from("drafts").select("inspection_code").eq("project_id", projectId),
    ]);

  if (projectRes.error || !projectRes.data) return null;

  const milestones = milestonesRes.data ?? [];
  const inspections = inspectionsRes.data ?? [];
  const records = recordsRes.data ?? [];
  const ncrByMilestone = counts(ncrsRes.data ?? [], (r) => r.milestone_code);
  const catADefectByMilestone = counts(
    (defectsRes.data ?? []).filter((d) => d.category === "A"),
    (r) => r.milestone_code
  );
  const draftCodes = new Set((draftsRes.data ?? []).map((d) => d.inspection_code));

  // Group records by inspection code.
  const recordsByInspection = new Map<string, RecordForGate[]>();
  const rawByInspection = new Map<
    string,
    { result: Result | null; signoff: Signoff; hiddenRelease: HiddenRelease; createdAt: string }[]
  >();
  for (const r of records) {
    const forGate: RecordForGate = {
      result: r.result as Result | null,
      signoff: r.signoff as Signoff,
      createdAt: r.created_at,
    };
    if (!recordsByInspection.has(r.inspection_code))
      recordsByInspection.set(r.inspection_code, []);
    recordsByInspection.get(r.inspection_code)!.push(forGate);

    if (!rawByInspection.has(r.inspection_code))
      rawByInspection.set(r.inspection_code, []);
    rawByInspection.get(r.inspection_code)!.push({
      result: r.result as Result | null,
      signoff: r.signoff as Signoff,
      hiddenRelease: r.hidden_release as HiddenRelease,
      createdAt: r.created_at,
    });
  }

  const inspectionsByMilestone = new Map<string, typeof inspections>();
  for (const insp of inspections) {
    if (!inspectionsByMilestone.has(insp.milestone_code))
      inspectionsByMilestone.set(insp.milestone_code, []);
    inspectionsByMilestone.get(insp.milestone_code)!.push(insp);
  }

  const milestoneViews: MilestoneView[] = milestones.map((m) => {
    const insps = inspectionsByMilestone.get(m.code) ?? [];
    const openNcrCount = ncrByMilestone.get(m.code) ?? 0;
    const openCatADefectCount = catADefectByMilestone.get(m.code) ?? 0;

    const inspectionViews: InspectionView[] = insps.map((insp) => {
      const recs = recordsByInspection.get(insp.code) ?? [];
      const raws = rawByInspection.get(insp.code) ?? [];
      const active =
        [...raws]
          .filter((r) => r.signoff !== "SUPERSEDED")
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
      const gateActive = activeRecord(recs);
      const countsAsPassed =
        gateActive !== null &&
        gateActive.signoff === "COMPLETE" &&
        (gateActive.result === "PASS" ||
          gateActive.result === "PASS_WITH_COMMENT");
      return {
        code: insp.code,
        name: localize(insp.name, insp.name_th, lang),
        familyCode: insp.family_code,
        pointType: insp.point_type,
        hidden: insp.hidden,
        minPhotos: insp.min_photos,
        result: active?.result ?? null,
        signoff: active?.signoff ?? null,
        hiddenRelease: active?.hiddenRelease ?? (insp.hidden ? "PENDING" : "n/a"),
        countsAsPassed,
        hasActiveFail: gateActive?.result === "FAIL",
        awaiting:
          active?.signoff === "AWAITING_CM" ||
          active?.signoff === "AWAITING_CONTRACTOR",
        hasDraft: draftCodes.has(insp.code),
      };
    });

    // Documentation confirmed when every RECORDS-type inspection has passed.
    const recordsInspections = inspectionViews.filter(
      (i) => i.pointType === "RECORDS"
    );
    const documentationConfirmed = recordsInspections.every(
      (i) => i.countsAsPassed
    );

    const gate = evaluateGate({
      inspections: insps.map((insp) => ({
        code: insp.code,
        records: recordsByInspection.get(insp.code) ?? [],
      })),
      openNcrCount,
      openCategoryADefectCount: openCatADefectCount,
      documentationConfirmed,
    });

    return {
      code: m.code,
      description: localize(m.description, m.description_th, lang),
      sequence: m.sequence,
      contractValue: Number(m.contract_value),
      payer: m.payer,
      gate,
      openNcrCount,
      openCatADefectCount,
      inspections: inspectionViews,
    };
  });

  const allInspections = milestoneViews.flatMap((m) => m.inspections);
  const kpis: DashboardKpis = {
    passed: allInspections.filter((i) => i.countsAsPassed).length,
    failedOrNcr:
      allInspections.filter((i) => i.hasActiveFail).length +
      milestoneViews.reduce((s, m) => s + m.openNcrCount, 0),
    awaitingSignoff: allInspections.filter((i) => i.awaiting).length,
    hiddenToRelease: allInspections.filter(
      (i) => i.hidden && i.hiddenRelease !== "RELEASED" && i.hiddenRelease !== "n/a"
    ).length,
    milestonesComplete: milestoneViews.filter((m) => m.gate.status === "READY")
      .length,
    milestonesTotal: milestoneViews.length,
  };

  return {
    projectName: projectRes.data.name,
    milestones: milestoneViews,
    kpis,
  };
}
