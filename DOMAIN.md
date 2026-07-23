# Domain rules — source of truth

> **Status: stub.** The full restatement lands with build milestone 3, when the rules are
> implemented in `src/domain/` with unit tests. Until then the authoritative text is
> Section 4 of the build spec.

## The spine

1. The contractor requests an **inspection**, never a payment.
2. An inspection is a **PASS** only when it has a record with `result = PASS`,
   `signoff = COMPLETE` (both the Contractor side and the CM side signed), and the record
   has not been superseded.
3. A **milestone (Quality Gate)** is ready for payment only when every inspection under it
   counts as passed, documentation is confirmed, and nothing blocks it (no active FAIL, no
   open NCR, no open Category-A defect).
4. Payments (50% commencement / 40% completion / 10% retention, configurable) are gated:
   commencement by the **previous** milestone's gate, completion by its **own** gate,
   retention by completion certificate + retention re-inspection + delay.

## Invariants that must never be weakened

- Dual sign-off: one person can never produce both signatures on a record.
- Signer identity and role come from the authenticated session, never the request body.
- A countersigner may only **downgrade** a result (PASS > PASS_WITH_COMMENT > FAIL), never
  silently upgrade it.
- Re-inspection supersedes the old record; a gate can never double-count an inspection.
- Hidden works read RELEASED only when COMPLETE + PASS + release explicitly ticked.
- A FAIL raises an NCR (once per record); an open NCR blocks the gate.
- All of the above are enforced server-side by pure functions in `src/domain/`.
