# Roadmap

## MVP non-goals (explicitly deferred)

These are out of scope for the MVP by design — the MVP focuses on the
inspection → gate → payment spine being correct.

- **Billing / Stripe** — multi-org subscription billing for the SaaS itself
- **Native iOS/Android** — PWA first; later a thin native wrapper (Capacitor) if
  app-store presence or better camera/offline APIs are needed
- **Push notifications** — "countersignature needed", "hidden work awaiting release"
- **PDF exports** — inspection certificates, payment certificates, NCR register
- **E-signature integration** (DocuSign etc.) — in-app dual sign-off is the MVP mechanism
- **Gantt / programme charts**
- **i18n beyond English** — Thai is the obvious first addition
- **AI features** — photo QA (does the photo actually show rebar spacing?), checklist
  suggestion, defect triage

## Path to commercialisation

1. **Harden the single-project experience** — the Samui villa runs on it end-to-end for
   one full payment cycle.
2. **Offline hardening** — background sync API, conflict handling when two parties edit
   offline, photo-upload resumption on flaky signal.
3. **Multi-org onboarding** — self-serve org creation, project templates (the seed file
   becomes one template among many), invite flows.
4. **Billing** — Stripe subscriptions per org, project-count/seat tiers.
5. **Native wrapper** — Capacitor build reusing the PWA, app-store listings.
6. **Reporting** — PDF payment certificates and registers (these are what banks and
   lawyers ask for).
7. **Template marketplace** — ITP libraries per building type / jurisdiction.
