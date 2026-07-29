/**
 * Database tests against the real Supabase project: seed integrity in the DB
 * and the RLS negative proof (a user with no membership can read/write
 * nothing on a project).
 *
 * These need SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_* vars) in the
 * environment or .env.local — without it the suite is skipped so `pnpm test`
 * stays green in CI and on fresh clones.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(join(__dirname, "../../.env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* optional */
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anonKey && serviceKey);

describe.skipIf(!enabled)("database seed + RLS (needs SUPABASE_SERVICE_ROLE_KEY)", () => {
  let admin: SupabaseClient;
  let outsider: SupabaseClient;
  let outsiderUser: User;
  let projectId: string;

  beforeAll(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });

    const { data: project, error } = await admin
      .from("projects")
      .select("id")
      .eq("name", "Samui Villa")
      .single();
    if (error) throw error;
    projectId = project.id;

    // An authenticated user with NO membership anywhere.
    const email = `rls-outsider-${Date.now()}@example.test`;
    const password = `Str0ng!${Date.now()}`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    outsiderUser = created.data.user;

    outsider = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const signIn = await outsider.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
  });

  afterAll(async () => {
    if (outsiderUser) await admin.auth.admin.deleteUser(outsiderUser.id);
  });

  it("seeded structure matches the contract (counts + value)", async () => {
    const count = async (table: string) => {
      const { count: n, error } = await admin
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return n;
    };
    expect(await count("checklist_families")).toBe(23);
    expect(await count("milestones")).toBe(21);
    expect(await count("inspections")).toBe(78);
    expect(await count("checklist_items")).toBe(422);

    const { data: milestones } = await admin
      .from("milestones")
      .select("code, contract_value")
      .eq("project_id", projectId);
    const total = milestones!
      .filter((m) => m.code !== "RET")
      .reduce((s, m) => s + Number(m.contract_value), 0);
    expect(total).toBe(7_456_732);

    const { data: payments } = await admin
      .from("payments")
      .select("amount")
      .eq("project_id", projectId);
    const payTotal = payments!.reduce((s, p) => s + Number(p.amount), 0);
    expect(payTotal).toBe(7_456_732);
  });

  it("a user with no membership reads nothing on the project", async () => {
    for (const table of [
      "projects",
      "milestones",
      "inspections",
      "checklist_items",
      "inspection_records",
      "payments",
      "ncrs",
      "defects",
      "drafts",
      "photos",
      "memberships",
    ]) {
      const { data, error } = await outsider.from(table).select("*").limit(5);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("a user with no membership cannot write an inspection record", async () => {
    const { error } = await outsider.from("inspection_records").insert({
      project_id: projectId,
      inspection_code: "ITP-009",
      signoff: "AWAITING_CM",
    });
    expect(error).not.toBeNull();
  });

  it("global reference data is readable while signed in", async () => {
    const { data, error } = await outsider
      .from("checklist_families")
      .select("code");
    expect(error).toBeNull();
    expect(data).toHaveLength(23);

    const legal = await outsider
      .from("legal_documents")
      .select("slug, version")
      .eq("slug", "platform-terms");
    expect(legal.error).toBeNull();
    expect(legal.data).toHaveLength(1);
  });

  // Regression: an Owner/CM can read the whole roster via RLS (for Admin), so
  // "my memberships" MUST be filtered to user_id — otherwise the project picker
  // shows every teammate as if it were the Owner's own membership.
  it("the Owner's own-memberships query returns exactly their row, not the roster", async () => {
    const owner = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const signIn = await owner.auth.signInWithPassword({
      email: "owner@cms.test",
      password: "Passw0rd!",
    });
    // Skip gracefully if the demo owner isn't seeded in this environment.
    if (signIn.error) return;

    // Unfiltered (what the bug did): RLS lets the Owner see the full roster.
    const roster = await owner.from("memberships").select("id, role").eq("active", true);
    expect(roster.error).toBeNull();
    expect((roster.data ?? []).length).toBeGreaterThan(1);

    // Scoped like getMyMemberships(): exactly the Owner's own approved row.
    const mine = await owner
      .from("memberships")
      .select("id, role")
      .eq("user_id", signIn.data.user!.id)
      .eq("active", true)
      .eq("approved", true);
    expect(mine.error).toBeNull();
    expect(mine.data).toHaveLength(1);
    expect(mine.data![0].role).toBe("owner");
  });
});
