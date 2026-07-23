/**
 * Idempotent seed script.
 *
 *   pnpm seed                     # global reference data (families, legal doc)
 *   pnpm seed -- --project "Samui Villa" --org "Everyone Ventures"
 *                                 # + create/refresh a project's ITP structure
 *
 * Requires env (e.g. in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (dashboard → project settings → API keys)
 *
 * Safe to run repeatedly: families/milestones/inspections/payments are
 * upserted on their natural keys, checklist items are replaced per
 * inspection, and existing inspection_records are never touched.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaymentPlan, DEFAULT_SPLIT } from "../src/domain/paymentPlan";

const AGREEMENT_SLUG = "platform-terms";
const AGREEMENT_VERSION = "1.0";

interface Seed {
  families: { code: string; name: string }[];
  milestones: {
    code: string;
    desc: string;
    value: number;
    payer: string;
    start: string;
    end: string;
  }[];
  inspections: {
    code: string;
    milestone: string;
    name: string;
    family: string;
    drawing: string;
    boq: string;
    type: string;
    hidden: boolean;
    tests: string;
    minPhotos: number;
    responsible: string;
    checklist: string[];
  }[];
  _meta: { contractValueTHB: number };
}

// Minimal .env.local loader so the script works without extra deps.
function loadEnvLocal() {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  } catch {
    // .env.local is optional; env may come from the shell.
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function parseSeedDate(s: string): string | null {
  if (!s) return null;
  const d = new Date(s); // e.g. "20 Jul 2026"
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service role key from the Supabase dashboard)."
    );
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const root = join(__dirname, "..");
  const seed: Seed = JSON.parse(
    readFileSync(join(root, "supabase/seed/cms_domain_seed.json"), "utf8")
  );

  // 1. Checklist families (global reference data)
  {
    const { error } = await db
      .from("checklist_families")
      .upsert(seed.families, { onConflict: "code" });
    if (error) throw error;
    console.log(`✓ ${seed.families.length} checklist families`);
  }

  // 2. Legal document (versioned; insert-if-missing so history is immutable)
  {
    const body = readFileSync(
      join(root, "legal/Platform_NDA_IP_NonCircumvention_Agreement.md"),
      "utf8"
    );
    const { error } = await db.from("legal_documents").upsert(
      {
        slug: AGREEMENT_SLUG,
        version: AGREEMENT_VERSION,
        body_md: body,
      },
      { onConflict: "slug,version", ignoreDuplicates: true }
    );
    if (error) throw error;
    console.log(`✓ legal document ${AGREEMENT_SLUG} v${AGREEMENT_VERSION}`);
  }

  // 3. Optional: create/refresh a project with the full ITP structure
  const projectName = arg("project");
  if (!projectName) {
    console.log("Done (no --project given; skipped project structure).");
    return;
  }
  const orgName = arg("org") ?? projectName;

  // Org + project by name (idempotent lookups)
  let { data: org } = await db
    .from("orgs")
    .select("id")
    .eq("name", orgName)
    .maybeSingle();
  if (!org) {
    const res = await db
      .from("orgs")
      .insert({ name: orgName })
      .select("id")
      .single();
    if (res.error) throw res.error;
    org = res.data;
  }

  let { data: project } = await db
    .from("projects")
    .select("id")
    .eq("org_id", org.id)
    .eq("name", projectName)
    .maybeSingle();
  if (!project) {
    const res = await db
      .from("projects")
      .insert({
        org_id: org.id,
        name: projectName,
        contract_currency: "THB",
        contract_value: seed._meta.contractValueTHB,
      })
      .select("id")
      .single();
    if (res.error) throw res.error;
    project = res.data;
  }
  const projectId = project.id;
  console.log(`✓ project "${projectName}" (${projectId})`);

  // Milestones
  {
    const rows = seed.milestones.map((m, i) => ({
      project_id: projectId,
      code: m.code,
      description: m.desc,
      sequence: i + 1,
      payer: m.payer,
      planned_start: parseSeedDate(m.start),
      planned_end: parseSeedDate(m.end),
      contract_value: m.value,
    }));
    const { error } = await db
      .from("milestones")
      .upsert(rows, { onConflict: "project_id,code" });
    if (error) throw error;
    console.log(`✓ ${rows.length} milestones`);
  }

  // Inspections + checklist items
  {
    const rows = seed.inspections.map((i) => ({
      project_id: projectId,
      code: i.code,
      milestone_code: i.milestone,
      name: i.name,
      family_code: i.family,
      drawing_ref: i.drawing,
      boq_ref: i.boq,
      point_type: i.type,
      hidden: i.hidden,
      tests: i.tests,
      min_photos: i.minPhotos,
      responsible: i.responsible,
    }));
    const { data: inserted, error } = await db
      .from("inspections")
      .upsert(rows, { onConflict: "project_id,code" })
      .select("id, code");
    if (error) throw error;

    const idByCode = new Map(inserted!.map((r) => [r.code, r.id]));
    let itemCount = 0;
    for (const insp of seed.inspections) {
      const inspectionId = idByCode.get(insp.code)!;
      const items = insp.checklist.map((text, idx) => ({
        inspection_id: inspectionId,
        seq: idx + 1,
        text,
      }));
      const del = await db
        .from("checklist_items")
        .delete()
        .eq("inspection_id", inspectionId);
      if (del.error) throw del.error;
      const ins = await db.from("checklist_items").insert(items);
      if (ins.error) throw ins.error;
      itemCount += items.length;
    }
    console.log(`✓ ${rows.length} inspections, ${itemCount} checklist items`);
  }

  // Payments (Section 4.4 instalment plan)
  {
    const plan = buildPaymentPlan(
      seed.milestones.map((m, i) => ({
        code: m.code,
        value: m.value,
        sequence: i + 1,
      })),
      DEFAULT_SPLIT
    );
    const rows = plan.map((p) => ({ project_id: projectId, ...p }));
    const { error } = await db
      .from("payments")
      .upsert(rows, { onConflict: "project_id,milestone_code,type" });
    if (error) throw error;
    console.log(`✓ ${rows.length} payment instalments`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
