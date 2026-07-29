# CMS — project conventions

## What this is

Multi-tenant construction management SaaS: contractors request **inspections**, not
payments; dual-signed passing inspections open payment **Quality Gates**. See `DOMAIN.md`
(rules source of truth) and `README.md` (setup).

## Hard rules

- **Domain logic lives in `src/domain/` only** — pure TypeScript, no framework imports, no
  Supabase imports. Server actions call it; the client never enforces domain rules.
- **Never weaken dual sign-off** or any invariant listed in `DOMAIN.md`.
- `supabase/seed/cms_domain_seed.json` is contractual data — never edit it; the integrity
  test (`tests/unit/seed-integrity.test.ts`) pins its shape.
- All DB access goes through RLS keyed on `memberships`; never trust role/identity from the
  request body.

## Stack & tooling

- Next.js 14 App Router (pinned — do not upgrade to 15), TypeScript, Tailwind.
- Package manager: **pnpm** (`~/.local/bin/pnpm` if corepack isn't enabled).
- Tests: `pnpm test` (Vitest), `pnpm e2e` (Playwright, boots dev server itself).
- Supabase dev project: `cms`, ref `mtfuqqaqfpnqwgspmzsb`, region ap-southeast-1.
- Migrations via Supabase MCP `apply_migration` (named snake_case), mirrored into
  `supabase/migrations/`.

## Visual language

Navy `#1F3864` (primary), gold `#BF9000` (accent), status green/amber/red — all defined in
`tailwind.config.ts` as `navy`, `gold`, `status.pass/warn/fail`. Apple-Swiss clean,
mobile-first, big tap targets, one primary action per screen.

## Build order

Spec milestones 1–9; after each: commit, keep everything runnable. Currently completed:
milestones 1 (scaffold), 2 (schema + RLS + storage + seed; cloud DB seeded with the
"Samui Villa" project under org "Everyone Ventures"), 3 (src/domain/ pure Section 4 logic,
73 passing unit tests), and 4 (auth: email + PIN login, sign-up legal gate 4bis, project
picker, route protection), 5 (read-only dashboard), and 6 (inspection form + server
actions calling the domain module: submit/countersign/self-edit/re-inspection/draft,
photo upload to Storage, auto-NCR/defect). Env keys (service role + PIN_PEPPER) are set
and demo users seeded (owner@/cm@/engineer@cms.test), and 8 (payments view with
domain-gated release + owner certify, registers: inspection log / NCRs / defects /
photo gallery with signed URLs), 9 part 1 (admin: member/PIN management), and 7 (offline
IndexedDB queue + sync indicator; submitCore.ts shared by the server action and
/api/inspections/submit; SyncManager in Dashboard + InspectionForm), and 9 (admin +
Playwright happy-path e2e). **All 9 build milestones complete.** 73 unit + 2 e2e tests pass.

Post-MVP additions: responsive layout (fills laptop, mobile-first); self-service team
sign-up — Owner sets Contractor/CM company names + "open for sign-ups" in Admin → Project
settings; new users pick a team on sign-up (creates a PENDING membership, approved=false);
RLS helpers require `active AND approved`, so pending grants zero access until the Owner
approves in Admin → "Requests to join". Orphaned sign-ups (no team) show in Admin too.

Dev-server caveat: Next 14.2.35 dev webpack can throw "reading 'call'" after heavy HMR
churn — `rm -rf .next && pnpm dev` fixes it; production build/start is unaffected.
