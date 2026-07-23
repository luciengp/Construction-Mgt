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

Arrive in build milestone 2 (`supabase/migrations/` + an idempotent per-project seed script).

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
