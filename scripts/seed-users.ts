/**
 * Seed demo users + memberships for the Samui Villa project. Idempotent.
 *
 *   pnpm seed:users
 *
 * Creates (or reuses) three auth users and their memberships:
 *   owner@cms.test        / Passw0rd!   → owner
 *   cm@cms.test           / Passw0rd!   → cm
 *   engineer@cms.test     / PIN 428913  → contractor (site engineer)
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and PIN_PEPPER in the environment.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hashPin } from "../src/lib/auth/pin";

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* optional */
  }
}

const DEMO = [
  { email: "owner@cms.test", password: "Passw0rd!", role: "owner", name: "Project Owner", pin: null },
  { email: "cm@cms.test", password: "Passw0rd!", role: "cm", name: "Construction Manager", pin: null },
  { email: "engineer@cms.test", password: "Passw0rd!", role: "contractor", name: "Site Engineer", pin: "428913" },
] as const;

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase env.");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: project, error: projErr } = await db
    .from("projects")
    .select("id, org_id")
    .eq("name", "Samui Villa")
    .single();
  if (projErr) throw projErr;

  // List existing users once (admin API has no getByEmail).
  const { data: existing } = await db.auth.admin.listUsers({ perPage: 1000 });
  const byEmail = new Map(existing!.users.map((u) => [u.email, u.id]));

  for (const u of DEMO) {
    let userId = byEmail.get(u.email);
    if (!userId) {
      const created = await db.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (created.error) throw created.error;
      userId = created.data.user.id;
      console.log(`✓ created ${u.email}`);
    } else {
      console.log(`• ${u.email} already exists`);
    }

    const membership = {
      user_id: userId,
      org_id: project.org_id,
      project_id: project.id,
      role: u.role,
      display_name: u.name,
      pin_hash: u.pin ? hashPin(u.pin) : null,
      active: true,
    };
    const { error } = await db
      .from("memberships")
      .upsert(membership, { onConflict: "user_id,project_id" });
    if (error) throw error;
    console.log(`  ↳ membership: ${u.role}${u.pin ? ` (PIN ${u.pin})` : ""}`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
