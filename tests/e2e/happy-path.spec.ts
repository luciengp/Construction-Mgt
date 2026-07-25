import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHmac } from "node:crypto";

// End-to-end happy path (acceptance criteria):
//   contractor logs in by PIN → fills ITP-007 → submits → AWAITING CM, does NOT
//   count toward the M1.1 gate → CM logs in → countersigns → COMPLETE and the
//   gate advances by one.
//
// The test resets ITP-007's records first so it is repeatable, and uses the
// seeded demo users (owner@/cm@/engineer@cms.test, engineer PIN 428913).

const PROJECT = "Samui Villa";
const INSPECTION = "ITP-007";
const MILESTONE = "M1.1";
const PIN = "428913";

function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, "../../.env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    /* env may already be present */
  }
}

let admin: SupabaseClient;
let projectId: string;

test.beforeAll(async () => {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  test.skip(!url || !key, "needs SUPABASE_SERVICE_ROLE_KEY");
  admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: project } = await admin
    .from("projects")
    .select("id")
    .eq("name", PROJECT)
    .single();
  projectId = project!.id;

  // Ensure the engineer PIN matches (in case the pepper changed).
  const pepper = process.env.PIN_PEPPER;
  if (pepper) {
    const pinHash = createHmac("sha256", pepper).update(PIN).digest("hex");
    await admin
      .from("memberships")
      .update({ pin_hash: pinHash })
      .eq("project_id", projectId)
      .eq("role", "contractor");
  }

  // Reset the target inspection so the run is repeatable.
  await admin
    .from("inspection_records")
    .delete()
    .eq("project_id", projectId)
    .eq("inspection_code", INSPECTION);
  await admin
    .from("drafts")
    .delete()
    .eq("project_id", projectId)
    .eq("inspection_code", INSPECTION);
});

async function passedCount(): Promise<number> {
  // Count via the same rule the domain uses: active COMPLETE + passing result.
  const { data } = await admin
    .from("inspection_records")
    .select("inspection_code, result, signoff, created_at")
    .eq("project_id", projectId);
  const byCode = new Map<string, { result: string | null; signoff: string; createdAt: string }[]>();
  for (const r of data ?? []) {
    if (!byCode.has(r.inspection_code)) byCode.set(r.inspection_code, []);
    byCode.get(r.inspection_code)!.push({ result: r.result, signoff: r.signoff, createdAt: r.created_at });
  }
  // Only count inspections belonging to MILESTONE.
  const { data: insps } = await admin
    .from("inspections")
    .select("code")
    .eq("project_id", projectId)
    .eq("milestone_code", MILESTONE);
  let n = 0;
  for (const i of insps ?? []) {
    const recs = (byCode.get(i.code) ?? [])
      .filter((r) => r.signoff !== "SUPERSEDED")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const active = recs[0];
    if (active && active.signoff === "COMPLETE" && (active.result === "PASS" || active.result === "PASS_WITH_COMMENT")) n++;
  }
  return n;
}

test("contractor PIN submit → AWAITING CM → CM countersign → gate advances", async ({ page }) => {
  const before = await passedCount();

  // 1. Contractor signs in by PIN.
  await page.goto("/login");
  await page.getByRole("button", { name: "Site PIN" }).click();
  for (const digit of PIN) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/projects/);

  // 2. Open ITP-007, answer every item Pass, result Pass, submit.
  await page.goto(`/projects/${projectId}/inspections/${INSPECTION}`);
  await expect(page.getByText("Signing as")).toContainText("Contractor");
  for (const btn of await page.getByRole("button", { name: "Pass", exact: true }).all()) {
    await btn.click();
  }
  await page.getByRole("radio", { name: "Pass", exact: true }).check();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.waitForURL(`**/projects/${projectId}?submitted=${INSPECTION}`);

  // 3. Still AWAITING CM → the gate has NOT advanced.
  expect(await passedCount()).toBe(before);
  {
    const { data } = await admin
      .from("inspection_records")
      .select("result, signoff")
      .eq("project_id", projectId)
      .eq("inspection_code", INSPECTION)
      .single();
    expect(data?.signoff).toBe("AWAITING_CM");
    expect(data?.result).toBe("PASS");
  }

  // 4. Sign out, sign in as CM by email.
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  await page.getByLabel("Email").fill("cm@cms.test");
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/projects/);

  // 5. Countersign.
  await page.goto(`/projects/${projectId}/inspections/${INSPECTION}`);
  await expect(page.getByText("The other party has signed")).toBeVisible();
  await page.getByRole("radio", { name: "Pass", exact: true }).check();
  await page.getByRole("button", { name: "Countersign", exact: true }).click();
  await page.waitForURL(`**/projects/${projectId}?submitted=${INSPECTION}`);

  // 6. COMPLETE and the gate advanced by exactly one.
  {
    const { data } = await admin
      .from("inspection_records")
      .select("result, signoff, contractor_signed_by, cm_signed_by")
      .eq("project_id", projectId)
      .eq("inspection_code", INSPECTION)
      .single();
    expect(data?.signoff).toBe("COMPLETE");
    expect(data?.result).toBe("PASS");
    expect(data?.contractor_signed_by).not.toBeNull();
    expect(data?.cm_signed_by).not.toBeNull();
    expect(data?.contractor_signed_by).not.toBe(data?.cm_signed_by);
  }
  expect(await passedCount()).toBe(before + 1);
});
