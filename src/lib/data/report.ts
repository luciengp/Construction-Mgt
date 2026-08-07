import { createClient } from "@/lib/supabase/server";
import { findActiveRecord } from "@/domain/signing";
import type { Check, Result } from "@/domain/types";

export interface ReportCheckRow {
  seq: number;
  text: string;
  /** Contractor's answer for this line, or null if they never signed. */
  contractor: { state: Check["state"]; note: string | null } | null;
  /** CM's answer for this line, or null if they never signed. */
  cm: { state: Check["state"]; note: string | null } | null;
}

export interface ReportPhoto {
  id: string;
  ref: string;
  hidden: boolean;
  createdAt: string;
  url: string | null;
}

export interface InspectionReport {
  projectId: string;
  projectName: string;
  code: string;
  name: string;
  milestoneCode: string;
  familyCode: string;
  hidden: boolean;
  minPhotos: number;
  /** Present only once a record exists. */
  result: Result | null;
  signoff: string | null;
  contractorSigned: boolean;
  cmSigned: boolean;
  notes: string | null;
  area: string | null;
  createdAt: string | null;
  rows: ReportCheckRow[];
  photos: ReportPhoto[];
}

export async function getInspectionReport(
  projectId: string,
  code: string
): Promise<InspectionReport | null> {
  const supabase = createClient();

  const { data: insp } = await supabase
    .from("inspections")
    .select("id, code, name, milestone_code, family_code, hidden, min_photos")
    .eq("project_id", projectId)
    .eq("code", code)
    .single();
  if (!insp) return null;

  const [projectRes, itemsRes, recordsRes, photosRes] = await Promise.all([
    supabase.from("projects").select("name").eq("id", projectId).single(),
    supabase
      .from("checklist_items")
      .select("seq, text")
      .eq("inspection_id", insp.id)
      .order("seq"),
    supabase
      .from("inspection_records")
      .select(
        "signoff, result, contractor_signed_by, cm_signed_by, notes, area, checks, contractor_checks, cm_checks, created_at"
      )
      .eq("project_id", projectId)
      .eq("inspection_code", code),
    supabase
      .from("photos")
      .select("id, ref, hidden, storage_path, created_at")
      .eq("project_id", projectId)
      .eq("inspection_code", code)
      .order("created_at", { ascending: true }),
  ]);

  const checklist = (itemsRes.data ?? []).map((i) => ({ seq: i.seq, text: i.text }));

  const recordsRaw = (recordsRes.data ?? []).map((r) => ({
    signoff: r.signoff as string,
    result: r.result as Result | null,
    contractorSignedBy: r.contractor_signed_by as string | null,
    cmSignedBy: r.cm_signed_by as string | null,
    notes: r.notes as string | null,
    area: r.area as string | null,
    checks: (r.checks as Check[] | null) ?? [],
    contractorChecks: (r.contractor_checks as Check[] | null) ?? null,
    cmChecks: (r.cm_checks as Check[] | null) ?? null,
    createdAt: r.created_at as string,
  }));
  const active = findActiveRecord(recordsRaw);

  const contractorChecks = active?.contractorChecks ?? null;
  const cmChecks = active?.cmChecks ?? null;

  const rows: ReportCheckRow[] = checklist.map((item, idx) => {
    const c = contractorChecks?.[idx] ?? null;
    const m = cmChecks?.[idx] ?? null;
    return {
      seq: item.seq,
      text: item.text,
      contractor: c ? { state: c.state, note: c.note ?? null } : null,
      cm: m ? { state: m.state, note: m.note ?? null } : null,
    };
  });

  const photoRows = photosRes.data ?? [];
  const signed = await Promise.all(
    photoRows.map((p) =>
      supabase.storage.from("photos").createSignedUrl(p.storage_path, 3600)
    )
  );
  const photos: ReportPhoto[] = photoRows.map((p, i) => ({
    id: p.id,
    ref: p.ref,
    hidden: p.hidden,
    createdAt: p.created_at,
    url: signed[i].data?.signedUrl ?? null,
  }));

  return {
    projectId,
    projectName: projectRes.data?.name ?? "",
    code: insp.code,
    name: insp.name,
    milestoneCode: insp.milestone_code,
    familyCode: insp.family_code,
    hidden: insp.hidden,
    minPhotos: insp.min_photos,
    result: active?.result ?? null,
    signoff: active?.signoff ?? null,
    contractorSigned: active?.contractorSignedBy != null,
    cmSigned: active?.cmSignedBy != null,
    notes: active?.notes ?? null,
    area: active?.area ?? null,
    createdAt: active?.createdAt ?? null,
    rows,
    photos,
  };
}
