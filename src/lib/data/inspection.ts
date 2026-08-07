import { createClient } from "@/lib/supabase/server";
import { getLang, localize } from "@/lib/i18n/server";
import { findActiveRecord } from "@/domain/signing";
import { signingSide, type Role, type Check, type Result, type Signoff, type HiddenRelease } from "@/domain/types";

export type FormMode =
  | "submit" // no active record → first signature
  | "countersign" // other party signed, my side hasn't
  | "self_edit" // I already signed, not yet complete
  | "reinspect" // active record COMPLETE → re-inspection
  | "read_only"; // viewer, or nothing to do

export interface ChecklistItem {
  seq: number;
  text: string;
}

export interface ActiveRecordView {
  id: string;
  result: Result | null;
  signoff: Signoff;
  contractorSignedBy: string | null;
  cmSignedBy: string | null;
  notes: string | null;
  area: string | null;
  hiddenRelease: HiddenRelease;
  checks: Check[];
  createdAt: string;
}

export interface InspectionDetail {
  projectId: string;
  code: string;
  name: string;
  milestoneCode: string;
  familyCode: string;
  pointType: string;
  hidden: boolean;
  minPhotos: number;
  tests: string | null;
  drawingRef: string | null;
  checklist: ChecklistItem[];
  role: Role;
  userId: string;
  activeRecord: ActiveRecordView | null;
  formMode: FormMode;
  /** The other party already signed and awaits my countersignature. */
  awaitingMyCountersignature: boolean;
  /** I have already signed this active record (self-edit available). */
  iAlreadySigned: boolean;
  draft: { checks: Check[]; notes: string | null; area: string | null } | null;
  /** The signing party's own previously stored checks (for prefill). */
  myChecks: Check[] | null;
  /** The other party's stored checks (shown inline as read-only context). */
  otherChecks: Check[] | null;
  photoCount: number;
}

export async function getInspectionDetail(
  projectId: string,
  code: string,
  role: Role,
  userId: string
): Promise<InspectionDetail | null> {
  const supabase = createClient();

  const lang = getLang();
  const { data: insp, error } = await supabase
    .from("inspections")
    .select("code, name, name_th, milestone_code, family_code, point_type, hidden, min_photos, tests, tests_th, drawing_ref, id")
    .eq("project_id", projectId)
    .eq("code", code)
    .single();
  if (error || !insp) return null;

  const [itemsRes, recordsRes, draftRes, photosRes] = await Promise.all([
    supabase
      .from("checklist_items")
      .select("seq, text, text_th")
      .eq("inspection_id", insp.id)
      .order("seq"),
    supabase
      .from("inspection_records")
      .select("id, result, signoff, contractor_signed_by, cm_signed_by, notes, area, hidden_release, checks, contractor_checks, cm_checks, created_at")
      .eq("project_id", projectId)
      .eq("inspection_code", code),
    supabase
      .from("drafts")
      .select("payload")
      .eq("project_id", projectId)
      .eq("inspection_code", code)
      .maybeSingle(),
    supabase
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("inspection_code", code),
  ]);

  const checklist = (itemsRes.data ?? []).map((i) => ({
    seq: i.seq,
    text: localize(i.text, i.text_th, lang),
  }));

  const recordsRaw = (recordsRes.data ?? []).map((r) => ({
    id: r.id,
    result: r.result as Result | null,
    signoff: r.signoff as Signoff,
    contractorSignedBy: r.contractor_signed_by,
    cmSignedBy: r.cm_signed_by,
    notes: r.notes,
    area: r.area,
    hiddenRelease: r.hidden_release as HiddenRelease,
    checks: (r.checks as Check[]) ?? [],
    contractorChecks: (r.contractor_checks as Check[] | null) ?? null,
    cmChecks: (r.cm_checks as Check[] | null) ?? null,
    createdAt: r.created_at,
  }));

  const active = findActiveRecord(recordsRaw);
  const side = signingSide(role);

  let formMode: FormMode = "submit";
  let awaitingMyCountersignature = false;
  let iAlreadySigned = false;

  if (side === null) {
    formMode = "read_only";
  } else if (!active) {
    formMode = "submit";
  } else if (active.signoff === "COMPLETE") {
    formMode = "reinspect";
  } else {
    const mySignedBy =
      side === "contractor" ? active.contractorSignedBy : active.cmSignedBy;
    const otherSignedBy =
      side === "contractor" ? active.cmSignedBy : active.contractorSignedBy;
    if (mySignedBy !== null) {
      formMode = "self_edit";
      iAlreadySigned = true;
    } else if (otherSignedBy !== null) {
      formMode = "countersign";
      awaitingMyCountersignature = true;
    } else {
      formMode = "submit";
    }
  }

  const draftPayload = draftRes.data?.payload as
    | { checks?: Check[]; notes?: string | null; area?: string | null }
    | undefined;

  const myChecks =
    side === "contractor"
      ? (active?.contractorChecks ?? null)
      : side === "cm"
        ? (active?.cmChecks ?? null)
        : null;
  const otherChecks =
    side === "contractor"
      ? (active?.cmChecks ?? null)
      : side === "cm"
        ? (active?.contractorChecks ?? null)
        : null;

  return {
    projectId,
    code: insp.code,
    name: localize(insp.name, insp.name_th, lang),
    milestoneCode: insp.milestone_code,
    familyCode: insp.family_code,
    pointType: insp.point_type,
    hidden: insp.hidden,
    minPhotos: insp.min_photos,
    tests: localize(insp.tests, insp.tests_th, lang),
    drawingRef: insp.drawing_ref,
    checklist,
    role,
    userId,
    activeRecord: active,
    formMode,
    awaitingMyCountersignature,
    iAlreadySigned,
    draft: draftPayload
      ? {
          checks: draftPayload.checks ?? [],
          notes: draftPayload.notes ?? null,
          area: draftPayload.area ?? null,
        }
      : null,
    myChecks,
    otherChecks,
    photoCount: photosRes.count ?? 0,
  };
}
