import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/domain/types";

export interface Membership {
  id: string;
  orgId: string;
  projectId: string;
  projectName: string;
  role: Role;
  displayName: string | null;
}

/**
 * Resolve the signed-in user's active memberships. Reads through RLS with the
 * user's own session, so it can only ever return their own rows.
 */
export async function getMyMemberships(): Promise<Membership[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("memberships")
    .select("id, org_id, project_id, role, display_name, projects(name)")
    .eq("active", true);
  if (error || !data) return [];

  return data.map((m) => ({
    id: m.id,
    orgId: m.org_id,
    projectId: m.project_id,
    role: m.role as Role,
    displayName: m.display_name,
    projectName:
      (m.projects as unknown as { name: string } | null)?.name ?? "Project",
  }));
}

export async function getMembershipForProject(
  projectId: string
): Promise<Membership | null> {
  const memberships = await getMyMemberships();
  return memberships.find((m) => m.projectId === projectId) ?? null;
}
