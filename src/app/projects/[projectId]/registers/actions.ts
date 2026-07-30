"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembershipForProject } from "@/lib/auth/membership";

async function requireOwner(projectId: string): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const membership = await getMembershipForProject(projectId);
  return membership?.role === "owner";
}

// Owner deletes a single inspection record. If that record raised an NCR, the
// NCR is cleared too (deleting the FAIL removes the reason it exists), which
// also unblocks the gate. Deleting the active record reverts the gate state.
export async function deleteRecord(
  projectId: string,
  recordId: string
): Promise<void> {
  if (!(await requireOwner(projectId))) return;
  const admin = createAdminClient();

  const { data: record } = await admin
    .from("inspection_records")
    .select("ncr_id")
    .eq("id", recordId)
    .eq("project_id", projectId)
    .maybeSingle();

  await admin
    .from("inspection_records")
    .delete()
    .eq("id", recordId)
    .eq("project_id", projectId);

  if (record?.ncr_id) {
    await admin
      .from("ncrs")
      .delete()
      .eq("id", record.ncr_id)
      .eq("project_id", projectId);
  }

  revalidatePath(`/projects/${projectId}/registers`);
  revalidatePath(`/projects/${projectId}`);
}

// Owner resets an inspection: deletes ALL its records so it returns to
// "Not started", and clears any NCRs those records raised. Photos are kept
// (they are evidence); delete them separately.
export async function resetInspection(
  projectId: string,
  inspectionCode: string
): Promise<void> {
  if (!(await requireOwner(projectId))) return;
  const admin = createAdminClient();

  await admin
    .from("inspection_records")
    .delete()
    .eq("project_id", projectId)
    .eq("inspection_code", inspectionCode);

  // Clear NCRs raised by this inspection.
  await admin
    .from("ncrs")
    .delete()
    .eq("project_id", projectId)
    .eq("inspection_code", inspectionCode);

  revalidatePath(`/projects/${projectId}/registers`);
  revalidatePath(`/projects/${projectId}`);
}

// Owner deletes a photo: removes the storage object and the row.
export async function deletePhoto(
  projectId: string,
  photoId: string
): Promise<void> {
  if (!(await requireOwner(projectId))) return;
  const admin = createAdminClient();
  const { data: photo } = await admin
    .from("photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (photo?.storage_path) {
    await admin.storage.from("photos").remove([photo.storage_path]);
  }
  await admin.from("photos").delete().eq("id", photoId).eq("project_id", projectId);
  revalidatePath(`/projects/${projectId}/registers`);
}
