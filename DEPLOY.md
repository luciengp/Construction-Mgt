# Deploying CMS

The backend (Supabase project `cms`, ref `mtfuqqaqfpnqwgspmzsb`) is already live.
Deployment means hosting the **Next.js frontend on Vercel** and pointing it at Supabase.

## Recommended: GitHub → Vercel (auto-deploys on every push)

### 1. Push the repo to GitHub
Create an **empty private** repo on github.com (no README), then from `~/Projects/cms`:

```bash
git remote add origin git@github.com:<you>/cms.git   # or the https URL
git push -u origin main
```

`.env.local` is git-ignored, so **no secrets are pushed** — they go into Vercel below.

### 2. Import into Vercel
- vercel.com → **Add New… → Project** → import the GitHub repo.
- Framework preset auto-detects **Next.js**. Leave build/output defaults.
- Before the first deploy, add the environment variables (next step).

### 3. Set environment variables in Vercel
Project → **Settings → Environment Variables**. Add these for **Production** (and Preview):

| Name | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://mtfuqqaqfpnqwgspmzsb.supabase.co` | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your `sb_publishable_…` key | public |
| `SUPABASE_SERVICE_ROLE_KEY` | your `sb_secret_…` key | **secret — server only** |
| `PIN_PEPPER` | a long random string (keep it stable) | **secret**; see caveat |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` | used for magic-link callbacks |

Get the two Supabase keys from the Supabase dashboard → Project Settings → API.

### 4. Point Supabase Auth at the production domain
Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://<your-app>.vercel.app`
- **Redirect URLs**: add `https://<your-app>.vercel.app/auth/callback`

Without this, email magic-link sign-in won't return to the app.

### 5. Deploy
Trigger the deploy (Vercel does it automatically on push). Every later `git push` to
`main` redeploys.

## Alternative: Vercel CLI (fastest one-off, no GitHub)
```bash
npm i -g vercel
cd ~/Projects/cms
vercel            # first run links/creates the project
# add env vars:
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add PIN_PEPPER production
vercel env add NEXT_PUBLIC_SITE_URL production
vercel --prod     # production deploy
```
Then do step 4 (Supabase Auth URLs) with the domain Vercel gives you.

## Before real users — important

- **PIN_PEPPER**: choose a strong value and **never change it** after go-live — the pepper
  is baked into every stored PIN hash, so rotating it invalidates all existing site-engineer
  PINs (they'd each need re-setting in Admin). The seeded demo PIN `428913` was hashed with
  the dev placeholder pepper, so after deploying with a real pepper, re-set PINs via
  **Admin → members**.
- **Service role key**: it bypasses row-level security. Keep it only in Vercel's secret env
  (never `NEXT_PUBLIC_*`, never committed). Rotate it in Supabase if it ever leaks.
- **Legal agreement**: `legal/Platform_NDA_IP_NonCircumvention_Agreement.md` is a template
  pending review by counsel — have it reviewed before onboarding real users (see README).
- **Custom domain** (optional): add it in Vercel → Settings → Domains, then update
  `NEXT_PUBLIC_SITE_URL` and the Supabase Auth URLs to the custom domain.

## Migrations & data
The schema, RLS, storage bucket, and the Samui Villa seed are already applied to the cloud
project — no migration step is needed at deploy time. For a fresh project later, apply
`supabase/migrations/*` and run `pnpm seed` (see README).
