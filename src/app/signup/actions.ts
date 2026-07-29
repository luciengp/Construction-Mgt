"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateLegalConsent } from "@/domain/legalGate";

export interface SignupState {
  error: string | null;
  success: boolean;
  requestedTeam: string | null;
}

const SIGNUP_ROLES = new Set(["contractor", "cm", "viewer"]);

// Section 4bis — account creation is blocked server-side until both boxes are
// ticked, and the acceptance row is written together with the user. Supabase
// hosted Auth can't share one SQL transaction with GoTrue, so we approximate
// atomicity: create the user, write the acceptance, and if that write fails,
// delete the just-created user so no account exists without a recorded
// acceptance.
export async function signup(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const agreementVersion = String(formData.get("agreementVersion") ?? "");
  const consent = validateLegalConsent({
    agreedToTerms: formData.get("agreedToTerms") === "on",
    affiliateDeclaration: formData.get("affiliateDeclaration") === "on",
    affiliatesDeclared: String(formData.get("affiliatesDeclared") ?? ""),
    agreementVersion,
  });

  // Optional team pick: "<projectId>:<role>" from the sign-up dropdown.
  const teamPick = String(formData.get("team") ?? "").trim();

  if (!email || !password) {
    return { error: "Email and password are required.", success: false, requestedTeam: null };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", success: false, requestedTeam: null };
  }
  if (!consent.ok) {
    return {
      error:
        "You must tick both boxes: agree to the Platform Terms and the Affiliate declaration.",
      success: false,
      requestedTeam: null,
    };
  }

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    return {
      error: created.error?.message ?? "Could not create the account.",
      success: false,
      requestedTeam: null,
    };
  }
  const userId = created.data.user.id;

  const hdrs = headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim() ??
    hdrs.get("x-real-ip") ??
    null;
  const userAgent = hdrs.get("user-agent");

  const { error: acceptErr } = await admin.from("agreement_acceptances").insert({
    user_id: userId,
    agreement_version: agreementVersion,
    ip_address: ip,
    user_agent: userAgent,
    affiliates_declared: String(formData.get("affiliatesDeclared") ?? "").trim(),
    method: "clickwrap",
  });

  if (acceptErr) {
    // Roll back: no account may exist without a recorded acceptance.
    await admin.auth.admin.deleteUser(userId);
    return {
      error: "Could not record your acceptance. Please try again.",
      success: false,
      requestedTeam: null,
    };
  }

  // Optional: record a pending (unapproved) membership for the chosen team, but
  // only against a project that is genuinely open for sign-ups and a role the
  // user is allowed to self-select. The Owner must approve before it grants
  // any access.
  let requestedTeam: string | null = null;
  const [projectId, role] = teamPick.split(":");
  if (projectId && role && SIGNUP_ROLES.has(role)) {
    const { data: open } = await admin
      .from("projects_open_signup")
      .select("id, name, contractor, construction_manager")
      .eq("id", projectId)
      .maybeSingle();
    if (open) {
      const { data: proj } = await admin
        .from("projects")
        .select("org_id")
        .eq("id", projectId)
        .single();
      if (proj) {
        await admin.from("memberships").upsert(
          {
            user_id: userId,
            org_id: proj.org_id,
            project_id: projectId,
            role,
            active: true,
            approved: false,
          },
          { onConflict: "user_id,project_id" }
        );
        const party =
          role === "contractor"
            ? open.contractor
            : role === "cm"
              ? open.construction_manager
              : null;
        requestedTeam = `${open.name}${party ? ` — ${party}` : ""}`;
      }
    }
  }

  return { error: null, success: true, requestedTeam };
}
