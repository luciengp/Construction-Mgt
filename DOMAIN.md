# Domain rules — source of truth

These rules are the product. They live as pure, framework-free TypeScript in `src/domain/`
(no React, no Supabase imports) and are exercised by the unit tests in `tests/unit/`. The
server (Next.js server actions / edge functions) calls them; **the client is never trusted
with any of it.** This document restates Section 4 of the build spec as the authoritative
reference — if code and this document disagree, that is a bug in one of them.

## Modules

| File | Responsibility |
| --- | --- |
| `types.ts` | Roles, sides, results, result ranking, hidden-release state |
| `signing.ts` | Submit/sign state machine (4.1, 4.2, 4.5) |
| `gates.ts` | Quality-gate status per milestone (4.3) |
| `paymentPlan.ts` | The 50/40/10 instalment plan and its controlling gates (4.4) |
| `payments.ts` | Whether an instalment may be released (4.4) |
| `registers.ts` | Automatic NCR / defect entries (4.6) |

## 4.1 Identity and roles

- The signer's `userId` and `role` come from the authenticated session/membership, **never**
  the request body.
- `owner` → signs the **CM side**, certifies payments, views all. `cm` → signs the CM side.
  `contractor` → signs the **contractor side**. `viewer` → read-only (`signingSide` returns
  `null`, so a submission is rejected with `ROLE_CANNOT_SIGN`).
- **One person can never produce both signatures on the same record.** If the user attempting
  to countersign already holds the other side's signature, the submit is rejected with
  `SAME_USER_BOTH_SIGNATURES`. (Owner and CM both sign the CM side, so no single user holds
  both sides legitimately.)

## 4.2 Submitting an inspection (`decideSubmit`)

Validation first (`validateSubmission`): a result is required; the role must be allowed to
sign; **every** checklist item must be answered pass/fail/na; `PASS_WITH_COMMENT` requires a
non-empty note (enforced server-side). Photos below `min_photos` **warn but never block**.

Then, against the **active record** (the most recent whose signoff is not `SUPERSEDED`):

- **No active record** → `create`. Signoff becomes `AWAITING_CM` (contractor signed) or
  `AWAITING_CONTRACTOR` (CM side signed).
- **Active record, other party has not signed** → `countersign`. If both sides are now
  signed → `COMPLETE`. A countersigner may **only downgrade** the result — the stored result
  becomes `worseResult(existing, incoming)` by rank `PASS(3) > PASS_WITH_COMMENT(2) >
  FAIL(1)` — never a silent upgrade.
- **Active record, this party already signed, not yet complete** → `self_edit`: overwrite
  this party's own answers/result/notes, refresh their timestamp, stay awaiting the other.
- **Active record is COMPLETE** → `reinspect`: mark the old record `SUPERSEDED` (kept for
  history) and create a brand-new record with this signature.

On any successful submit the server deletes the draft for that inspection.

## 4.3 Quality-gate status (`evaluateGate`)

- An inspection **counts as passed** only when its active record is `COMPLETE` with a passing
  result. Because re-inspection supersedes, a milestone can **never double-count** an
  inspection (proven in `gates.test.ts`: a superseded pass plus a new active record yields
  `passedCount = 1`).
- `PASS_WITH_COMMENT` counts as passed. Its consequence is a Category-B defect (4.6), which
  does **not** block the gate; treating it as not-passed would deadlock every gate it touches.
  Only Category-A defects block.
- A milestone is **BLOCKED** if any inspection has an active `FAIL`, or there is an open NCR
  against it, or an open Category-A defect.
- A milestone is **READY** only when every inspection under it counts as passed, documentation
  is confirmed, and nothing blocks it. Otherwise: `AWAITING_SIGNOFF` (a record awaits its
  countersignature), `IN_PROGRESS` (some activity, nothing blocking), or `NOT_READY` (nothing
  submitted).

## 4.4 Payments (`buildPaymentPlan`, `canRelease`)

- Each value-bearing milestone splits 50% commencement / 40% completion / 10% retention
  (configurable per project). Retention takes the rounding remainder so the three instalments
  always sum exactly to the milestone value.
- **Commencement** is gated by the **previous** milestone's gate (paying in advance; the
  protection is that everything before is complete).
- **Completion** is gated by the milestone's **own** gate.
- **Retention** releases only after a completion certificate exists, the configured delay
  (default 30 days) has elapsed, **and** the `RET` gate (retention re-inspection) is READY.
- The UI can never mark a payment released while its controlling gate is not READY
  (`canRelease` returns false; `nextPaymentStatuses` offers no HOLD→RELEASE transition). A
  regressed gate pulls a released-but-uncertified payment back to HOLD.

## 4.5 Hidden works (`computeHiddenRelease`)

Inspections flagged `hidden` are the "do not cover" list with higher photographic minimums.
The release-to-cover state reads `RELEASED` **only** when the record is `COMPLETE` (both
signed) **and** the result is `PASS` **and** the releaser ticked the release box. A `FAIL` is
an explicit `DO_NOT_COVER`; anything else in between is `PENDING`. Non-hidden works are `n/a`.

## 4.6 Automatic register entries (`ncrForFail`, `defectForPassWithComment`)

- A `FAIL` raises an NCR **once per record** (skipped when the record already has an
  `ncrId`): numbered, dated, description = the failed checklist items, due date = today +
  configurable days, status `OPEN`. An open NCR blocks the gate.
- A `PASS_WITH_COMMENT` that **becomes COMPLETE** raises a Category-B defect with the note as
  its description.

## Acceptance criteria → where they're proven

| Criterion | Proof |
| --- | --- |
| Sign-up blocked until both boxes ticked; acceptance row written; re-prompt on version bump | `legal-and-pin.test.ts`; live sign-up wrote `agreement_acceptances` (version/IP/UA) |
| Contractor PIN submit → AWAITING CM, does not count toward the gate | `happy-path.spec.ts`; `gates.test.ts` |
| CM countersign → COMPLETE, gate advances by one | `happy-path.spec.ts` (asserts before/after gate count) |
| Contractor PASS countersigned FAIL → FAIL + NCR, gate blocked | `signing.test.ts` (downgrade); live FAIL → NCR-001 → M1.2 BLOCKED |
| Re-inspection supersedes; gate counts it once | `gates.test.ts` ("re-inspected pass counts once") |
| Hidden work not RELEASED until COMPLETE + PASS + release ticked | `signing.test.ts`; live ITP-009 stayed PENDING until complete |
| Offline submission queues and auto-syncs on reconnect | verified live: queued in IndexedDB → synced to DB |
| No-membership user reads/writes nothing (RLS) | `rls-and-seed.test.ts` (live outsider user) |
| All Section 4 rules unit-tested; one Playwright happy-path green | 73 unit + 2 e2e passing |

## 4.7 Drafts

Save-draft stores answers + notes + area (not photos), keyed to the inspection. No result or
role required; it never counts toward a gate; anyone with submit rights on the project can
resume it; submitting the inspection clears it. (Enforced at the persistence layer;
milestone 6.)
