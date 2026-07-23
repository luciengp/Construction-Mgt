"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin, isValidPinFormat } from "@/lib/auth/pin";

export interface AuthActionState {
  error: string | null;
}

// Email + password sign-in (Owner / CM / Viewer).
export async function loginWithPassword(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Invalid email or password." };
  redirect("/projects");
}

// Magic-link sign-in — emails a one-time link back to /auth/callback.
export async function loginWithMagicLink(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required." };

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${originFromEnv()}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { error: null };
}

// 6-digit PIN sign-in for the contractor's site engineer. The PIN resolves,
// server-side, to a real membership → a real audited identity. We then mint a
// session for that user without exposing any password to the client.
export async function loginWithPin(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const pin = String(formData.get("pin") ?? "");
  if (!isValidPinFormat(pin)) {
    return { error: "Enter your 6-digit PIN." };
  }

  const admin = createAdminClient();
  const pinHash = hashPin(pin);

  const { data: matches, error } = await admin
    .from("memberships")
    .select("user_id")
    .eq("pin_hash", pinHash)
    .eq("active", true);
  if (error) return { error: "Sign-in failed. Please try again." };
  if (!matches || matches.length === 0) {
    return { error: "PIN not recognised." };
  }
  if (matches.length > 1) {
    // Same PIN across multiple projects — fall back to email sign-in.
    return { error: "This PIN is ambiguous; please sign in with email." };
  }

  const userId = matches[0].user_id;
  const { data: userRes, error: userErr } =
    await admin.auth.admin.getUserById(userId);
  if (userErr || !userRes.user?.email) {
    return { error: "Sign-in failed. Please contact your manager." };
  }

  // Mint a one-time token for this user and exchange it for a session cookie.
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userRes.user.email,
  });
  const tokenHash = link.data.properties?.hashed_token;
  if (link.error || !tokenHash) {
    return { error: "Sign-in failed. Please try again." };
  }

  const supabase = createClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (verifyErr) return { error: "Sign-in failed. Please try again." };

  redirect("/projects");
}

function originFromEnv(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}
