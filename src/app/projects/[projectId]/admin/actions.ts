"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembershipForProject } from "@/lib/auth/membership";
import { hashPin, isValidPinFormat } from "@/lib/auth/pin";
import type { Role } from "@/domain/types";

export interface AdminState {
  error: string | null;
  ok: string | null;
}

const ROLES: Role[] = ["owner", "cm", "contractor", "viewer"];

type OwnerGuard =
  | { ok: false; error: string }
  | { ok: true; userId: string };

async function requireOwner(projectId: string): Promise<OwnerGuard> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const membership = await getMembershipForProject(projectId);
  if (!membership || membership.role !== "owner") {
    return { ok: false, error: "Only the Owner can manage members." };
  }
  return { ok: true, userId: user.id };
}

// Approve a self-service sign-up request (pending membership) for this project.
export async function approveRequest(
  projectId: string,
  membershipId: string,
  role: Role
): Promise<void> {
  const guard = await requireOwner(projectId);
  if (!guard.ok) return;
  if (!ROLES.includes(role)) return;
  const admin = createAdminClient();
  await admin
    .from("memberships")
    .update({ approved: true, active: true, role })
    .eq("id", membershipId)
    .eq("project_id", projectId);
  revalidatePath(`/projects/${projectId}/admin`);
}

// Reject (delete) a pending sign-up request.
export async function rejectRequest(
  projectId: string,
  membershipId: string
): Promise<void> {
  const guard = await requireOwner(projectId);
  if (!guard.ok) return;
  const admin = createAdminClient();
  await admin
    .from("memberships")
    .delete()
    .eq("id", membershipId)
    .eq("project_id", projectId)
    .eq("approved", false);
  revalidatePath(`/projects/${projectId}/admin`);
}

// Project settings the Owner controls: the two party names and whether the
// project is open for self-service sign-ups.
export async function saveProjectSettings(
  projectId: string,
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const guard = await requireOwner(projectId);
  if (!guard.ok) return { error: guard.error, ok: null };
  const admin = createAdminClient();
  const { error } = await admin
    .from("projects")
    .update({
      contractor: String(formData.get("contractor") ?? "").trim() || null,
      construction_manager:
        String(formData.get("constructionManager") ?? "").trim() || null,
      signup_open: formData.get("signupOpen") === "on",
    })
    .eq("id", projectId);
  if (error) return { error: error.message, ok: null };
  revalidatePath(`/projects/${projectId}/admin`);
  return { error: null, ok: "Settings saved." };
}

// One-click assignment of an already-signed-up user (from the "awaiting
// assignment" pool) to this project with the chosen role.
export async function assignPendingUser(
  projectId: string,
  userId: string,
  role: Role
): Promise<void> {
  const guard = await requireOwner(projectId);
  if (!guard.ok) return;
  if (!ROLES.includes(role)) return;

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("org_id")
    .eq("id", projectId)
    .single();
  if (!project) return;

  await admin.from("memberships").upsert(
    {
      user_id: userId,
      org_id: project.org_id,
      project_id: projectId,
      role,
      active: true,
    },
    { onConflict: "user_id,project_id" }
  );
  revalidatePath(`/projects/${projectId}/admin`);
}

// Add a member. Email members get an auth account (invited by email if no
// password); PIN members (site engineers) get an account + a hashed PIN.
export async function addMember(
  projectId: string,
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const guard = await requireOwner(projectId);
  if (!guard.ok) return { error: guard.error, ok: null };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "") as Role;
  const pin = String(formData.get("pin") ?? "").trim();

  if (!ROLES.includes(role)) return { error: "Choose a valid role.", ok: null };
  if (!email) return { error: "Email is required.", ok: null };
  if (pin && !isValidPinFormat(pin)) {
    return { error: "A PIN must be exactly 6 digits.", ok: null };
  }

  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("org_id")
    .eq("id", projectId)
    .single();
  if (!project) return { error: "Project not found.", ok: null };

  // Find or create the auth user.
  const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let userId = usersData?.users.find((u) => u.email === email)?.id;
  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      return { error: created.error?.message ?? "Could not create user.", ok: null };
    }
    userId = created.data.user.id;
  }

  const { error } = await admin.from("memberships").upsert(
    {
      user_id: userId,
      org_id: project.org_id,
      project_id: projectId,
      role,
      display_name: displayName,
      pin_hash: pin ? hashPin(pin) : null,
      active: true,
    },
    { onConflict: "user_id,project_id" }
  );
  if (error) return { error: error.message, ok: null };

  revalidatePath(`/projects/${projectId}/admin`);
  return { error: null, ok: `${email} added as ${role}.` };
}

export async function setMemberActive(
  projectId: string,
  membershipId: string,
  active: boolean
): Promise<void> {
  const guard = await requireOwner(projectId);
  if (!guard.ok) return;
  const admin = createAdminClient();
  await admin
    .from("memberships")
    .update({ active })
    .eq("id", membershipId)
    .eq("project_id", projectId);
  revalidatePath(`/projects/${projectId}/admin`);
}

export async function setMemberRole(
  projectId: string,
  membershipId: string,
  role: Role
): Promise<void> {
  const guard = await requireOwner(projectId);
  if (!guard.ok) return;
  if (!ROLES.includes(role)) return;
  const admin = createAdminClient();
  await admin
    .from("memberships")
    .update({ role })
    .eq("id", membershipId)
    .eq("project_id", projectId);
  revalidatePath(`/projects/${projectId}/admin`);
}

export async function setMemberPin(
  projectId: string,
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const guard = await requireOwner(projectId);
  if (!guard.ok) return { error: guard.error, ok: null };

  const membershipId = String(formData.get("membershipId") ?? "");
  const pin = String(formData.get("pin") ?? "").trim();
  const clear = formData.get("clear") === "1";

  if (!clear && !isValidPinFormat(pin)) {
    return { error: "A PIN must be exactly 6 digits.", ok: null };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("memberships")
    .update({ pin_hash: clear ? null : hashPin(pin) })
    .eq("id", membershipId)
    .eq("project_id", projectId);
  if (error) return { error: error.message, ok: null };

  revalidatePath(`/projects/${projectId}/admin`);
  return { error: null, ok: clear ? "PIN cleared." : "PIN set." };
}
