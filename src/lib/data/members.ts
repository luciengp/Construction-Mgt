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

export interface PendingUser {
  userId: string;
  email: string;
  createdAt: string;
}

// Users who have signed up but have no membership on ANY project. This is what
// the Admin sees as "new users awaiting assignment" — the natural pool of
// people who created an account and are waiting to be added to a project.
// Uses the service role because auth.users is not client-readable.
export async function getUsersAwaitingAssignment(): Promise<PendingUser[]> {
  const admin = createAdminClient();
  const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const users = usersData?.users ?? [];
  if (users.length === 0) return [];

  // Anyone with ANY membership row (active, inactive, or pending-approval) is
  // already accounted for — this list is only truly orphaned accounts.
  const { data: memberships } = await admin
    .from("memberships")
    .select("user_id");
  const assigned = new Set((memberships ?? []).map((m) => m.user_id));

  return users
    .filter((u) => u.email && !assigned.has(u.id))
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 30)
    .map((u) => ({
      userId: u.id,
      email: u.email!,
      createdAt: u.created_at ?? "",
    }));
}

export interface PendingRequest {
  membershipId: string;
  userId: string;
  email: string | null;
  role: Role;
  createdAt: string;
}

// Self-service sign-ups that chose THIS project + a side but await Owner
// approval (active but not yet approved). The Owner approves or rejects them.
export async function getPendingRequests(
  projectId: string
): Promise<PendingRequest[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("memberships")
    .select("id, user_id, role, created_at")
    .eq("project_id", projectId)
    .eq("approved", false)
    .order("created_at", { ascending: false });
  if (error || !data || data.length === 0) return [];

  const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(
    (usersData?.users ?? []).map((u) => [u.id, u.email ?? null])
  );

  return data.map((m) => ({
    membershipId: m.id,
    userId: m.user_id,
    email: emailById.get(m.user_id) ?? null,
    role: m.role as Role,
    createdAt: m.created_at,
  }));
}

export interface ProjectSettings {
  name: string;
  contractor: string | null;
  constructionManager: string | null;
  signupOpen: boolean;
}

export async function getProjectSettings(
  projectId: string
): Promise<ProjectSettings | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("projects")
    .select("name, contractor, construction_manager, signup_open")
    .eq("id", projectId)
    .single();
  if (!data) return null;
  return {
    name: data.name,
    contractor: data.contractor,
    constructionManager: data.construction_manager,
    signupOpen: data.signup_open,
  };
}

// Open projects (name + party names) for the pre-auth sign-up team picker.
export interface OpenSignupProject {
  id: string;
  name: string;
  contractor: string | null;
  constructionManager: string | null;
}

export async function getOpenSignupProjects(): Promise<OpenSignupProject[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("projects_open_signup")
    .select("id, name, contractor, construction_manager");
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    contractor: p.contractor,
    constructionManager: p.construction_manager,
  }));
}
