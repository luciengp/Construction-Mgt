import { createClient } from "@/lib/supabase/server";

export interface LogEntry {
  id: string;
  inspectionCode: string;
  inspectionName: string;
  milestoneCode: string;
  result: string | null;
  signoff: string;
  contractorSigned: boolean;
  cmSigned: boolean;
  createdAt: string;
}

export interface NcrEntry {
  seq: number;
  milestoneCode: string;
  inspectionCode: string | null;
  description: string;
  dueDate: string | null;
  status: string;
}

export interface DefectEntry {
  seq: number;
  milestoneCode: string;
  description: string;
  category: string;
  status: string;
}

export interface PhotoEntry {
  id: string;
  ref: string;
  inspectionCode: string;
  milestoneCode: string;
  familyCode: string;
  hidden: boolean;
  createdAt: string;
  url: string | null;
}

export interface RegistersData {
  projectName: string;
  log: LogEntry[];
  ncrs: NcrEntry[];
  defects: DefectEntry[];
  photos: PhotoEntry[];
}

export async function getRegisters(projectId: string): Promise<RegistersData | null> {
  const supabase = createClient();

  const [projectRes, inspectionsRes, recordsRes, ncrsRes, defectsRes, photosRes] =
    await Promise.all([
      supabase.from("projects").select("name").eq("id", projectId).single(),
      supabase.from("inspections").select("code, name").eq("project_id", projectId),
      supabase
        .from("inspection_records")
        .select("id, inspection_code, result, signoff, contractor_signed_by, cm_signed_by, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      supabase
        .from("ncrs")
        .select("seq, milestone_code, inspection_code, description, due_date, status")
        .eq("project_id", projectId)
        .order("seq"),
      supabase
        .from("defects")
        .select("seq, milestone_code, description, category, status")
        .eq("project_id", projectId)
        .order("seq"),
      supabase
        .from("photos")
        .select("id, ref, inspection_code, milestone_code, family_code, hidden, storage_path, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  if (projectRes.error || !projectRes.data) return null;

  const nameByCode = new Map(
    (inspectionsRes.data ?? []).map((i) => [i.code, i.name])
  );
  const milestoneByInspection = new Map<string, string>();
  // Records don't carry milestone; look it up per inspection via a second map.
  const inspMilestone = await supabase
    .from("inspections")
    .select("code, milestone_code")
    .eq("project_id", projectId);
  for (const i of inspMilestone.data ?? [])
    milestoneByInspection.set(i.code, i.milestone_code);

  const log: LogEntry[] = (recordsRes.data ?? []).map((r) => ({
    id: r.id,
    inspectionCode: r.inspection_code,
    inspectionName: nameByCode.get(r.inspection_code) ?? "",
    milestoneCode: milestoneByInspection.get(r.inspection_code) ?? "",
    result: r.result,
    signoff: r.signoff,
    contractorSigned: r.contractor_signed_by !== null,
    cmSigned: r.cm_signed_by !== null,
    createdAt: r.created_at,
  }));

  // Signed URLs for the private photo bucket (1 hour).
  const photoRows = photosRes.data ?? [];
  const signed = await Promise.all(
    photoRows.map((p) =>
      supabase.storage.from("photos").createSignedUrl(p.storage_path, 3600)
    )
  );
  const photos: PhotoEntry[] = photoRows.map((p, i) => ({
    id: p.id,
    ref: p.ref,
    inspectionCode: p.inspection_code,
    milestoneCode: p.milestone_code,
    familyCode: p.family_code,
    hidden: p.hidden,
    createdAt: p.created_at,
    url: signed[i].data?.signedUrl ?? null,
  }));

  return {
    projectName: projectRes.data.name,
    log,
    ncrs: (ncrsRes.data ?? []).map((n) => ({
      seq: n.seq,
      milestoneCode: n.milestone_code,
      inspectionCode: n.inspection_code,
      description: n.description,
      dueDate: n.due_date,
      status: n.status,
    })),
    defects: (defectsRes.data ?? []).map((d) => ({
      seq: d.seq,
      milestoneCode: d.milestone_code,
      description: d.description,
      category: d.category,
      status: d.status,
    })),
    photos,
  };
}
