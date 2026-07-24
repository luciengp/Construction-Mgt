import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/domain/types";

export interface MemberRow {
  id: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  role: Role;
  active: boolean;
  hasPin: boolean;
}

// Owner/CM roster for a project. Reads memberships through the caller's RLS
// (the memberships_select policy exposes the full roster to owner/cm), then
// resolves emails with the service role since auth.users is not client-readable.
export async function getProjectMembers(
  projectId: string
): Promise<MemberRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("id, user_id, display_name, role, active, pin_hash")
    .eq("project_id", projectId)
    .order("role");
  if (error || !data) return [];

  const admin = createAdminClient();
  const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(
    (usersData?.users ?? []).map((u) => [u.id, u.email ?? null])
  );

  return data.map((m) => ({
    id: m.id,
    userId: m.user_id,
    email: emailById.get(m.user_id) ?? null,
    displayName: m.display_name,
    role: m.role as Role,
    active: m.active,
    hasPin: m.pin_hash !== null,
  }));
}
