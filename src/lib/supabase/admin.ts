import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. SERVER ONLY. Never import this into a
// client component or expose the key to the browser. Used for the sign-up
// transaction, PIN login, and admin member management.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required for auth/admin actions."
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
