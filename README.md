# CMS — Construction Management System

Multi-tenant SaaS for owners of construction projects to control **quality and payments**.

> **The contractor does not request payment — the contractor requests an inspection.**
> Passing the inspection is what unlocks the payment milestone. Every payment milestone is a
> **Quality Gate**: it opens only when every inspection under it has passed, both parties have
> signed it, and there is no open non-conformance.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS, shipped as an installable PWA
- **Supabase** — Postgres + Row-Level Security, Auth, Storage (photos)
- **Vitest** (domain-rule unit tests) + **Playwright** (e2e)
- Hosting target: Vercel + Supabase managed

### Stack notes / deviations

- **Service worker is hand-rolled** (`public/sw.js`) rather than via `next-pwa`, which is
  effectively unmaintained for the App Router. The worker does app-shell caching only; the
  offline submission queue (IndexedDB) is a separate layer added in build milestone 7.
- **pnpm** is the package manager. If `corepack enable` needs sudo on your machine, install
  it per-user instead: `npm install -g pnpm@9 --prefix="$HOME/.local"` and add
  `~/.local/bin` to your `PATH`.

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in your Supabase project values
pnpm dev
```

### Environment variables (`.env.local`)

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page — use the `sb_publishable_...` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page — secret key. Server/scripts only, never shipped to the client. Needed for `pnpm seed` and the DB test suite. |

The dev Supabase project is `cms` (ref `mtfuqqaqfpnqwgspmzsb`, region `ap-southeast-1`).

## Tests

```bash
pnpm test        # Vitest unit tests (domain rules + seed integrity)
pnpm e2e         # Playwright (starts the dev server itself)
```

The seed file `supabase/seed/cms_domain_seed.json` is the contractual source of truth:
23 trade families, 21 milestones (Quality Gates), 78 inspections, 422 checklist items.
Contract values excluding the `RET` retention row sum to **7,456,732 THB** — asserted in
`tests/unit/seed-integrity.test.ts`.

## Migrations & seeding

Migrations live in `supabase/migrations/` (schema → RLS → storage → hardening) and are
applied to the cloud project. RLS is keyed on **active memberships**: without one you can
read and write nothing on a project (proven by `tests/db/rls-and-seed.test.ts`). The photo
bucket is private with paths `<project_id>/<family>/<milestone>/…` so storage policies
enforce tenancy from the path.

Seeding is idempotent — run it as often as you like:

```bash
pnpm seed                                            # families + legal document
pnpm seed -- --project "Samui Villa" --org "Everyone Ventures"   # + full ITP structure
```

It upserts on natural keys, replaces checklist items per inspection, generates the
48 payment instalments (50/40/10 with remainder-safe rounding), and never touches
existing inspection records. The DB test suite (`tests/db/`) runs only when
`SUPABASE_SERVICE_ROLE_KEY` is set; otherwise it skips so CI stays green.

## Auth (milestone 4)

- **Email + password / magic-link** for Owner, CM and Viewer (`/login`).
- **6-digit PIN** for the contractor's site engineer: the PIN is HMAC-hashed with a
  server-only pepper (`PIN_PEPPER`) and resolves, server-side, to a real membership and an
  audited identity — no anonymous access. The keypad is at `/login` → "Site PIN".
- **Sign-up legal gate (4bis)** at `/signup`: the current Platform Terms render in a
  scrollable panel with two un-pre-ticked checkboxes (terms + affiliate declaration) and an
  affiliates field. Account creation is blocked **server-side** (`validateLegalConsent`) until
  both are ticked; the `agreement_acceptances` row (version, timestamp, IP, user-agent,
  declared affiliates) is written with the user, and the account is rolled back if that write
  fails. Returning users are re-prompted when the version changes (`needsReacceptance`).
- Routes under `/projects` require a session (enforced in middleware); the **project picker**
  lists the user's active memberships and auto-skips to the project when there's only one.

**To enable the live flow** set `SUPABASE_SERVICE_ROLE_KEY` (and a stable `PIN_PEPPER`) in
`.env.local`. Sign-up, PIN login, and admin member management use the service-role client
server-side. Supabase hosted Auth can't share a single SQL transaction with account creation,
so atomicity of the acceptance record is approximated by create-then-rollback; noted in
`src/app/signup/actions.ts`.

### Demo users

`pnpm seed:users` creates three accounts on the Samui Villa project (idempotent):

| Login | Credential | Role |
| --- | --- | --- |
| `owner@cms.test` | `Passw0rd!` | owner |
| `cm@cms.test` | `Passw0rd!` | cm |
| `engineer@cms.test` | Site PIN `428913` | contractor |

## Offline queue (milestone 7)

The inspection form works with no signal. When the primary action is submitted offline, the
sign-off is stored in **IndexedDB** (`src/lib/offline/queue.ts`) and the user sees a "Saved
offline" confirmation instead of losing their work. A floating **sync indicator**
(`SyncManager`) flushes the queue to `POST /api/inspections/submit` the moment connectivity
returns; the server re-derives the active-record state through the domain module, so a queued
submission applied later is interpreted correctly (it can become a countersign or
re-inspection if the world moved on) rather than blindly replayed. Photos upload online; the
sign-off itself is what the queue protects.

> **Dev-server note:** Next.js **14.2.35's dev server** has a webpack bug that can throw
> `Cannot read properties of undefined (reading 'call')` after many rapid HMR edits touching
> the client graph. A clean restart fixes it: `rm -rf .next && pnpm dev`. It does **not**
> affect `pnpm build` / `pnpm start` (production), which is where the offline flow was
> verified end-to-end.

## Domain rules

`DOMAIN.md` is the source of truth for the inspection → gate → payment rules. They live as
pure, framework-free logic in `src/domain/` (build milestone 3) and are the product — the UI
is a thin shell over them.

## Legal

Sign-up is gated by the Platform Access, Confidentiality, IP and Non-Circumvention Agreement
(`legal/Platform_NDA_IP_NonCircumvention_Agreement.md`), accepted via double-checkbox
clickwrap and recorded per version in `agreement_acceptances`.

> **Note:** the agreement is a professional draft template pending review by qualified
> counsel. The non-competition and non-circumvention clauses' enforceability depends on the
> governing-law jurisdiction (Thailand assumed).

## Repo layout

```
src/app/            Next.js App Router screens
src/components/     Shared UI
src/domain/         Pure domain rules (milestone 3) — no framework imports allowed
src/lib/supabase/   Browser/server/middleware Supabase clients
supabase/seed/      cms_domain_seed.json (source of truth)
legal/              Platform agreement (versioned into legal_documents at seed time)
tests/unit/         Vitest
tests/e2e/          Playwright
```
