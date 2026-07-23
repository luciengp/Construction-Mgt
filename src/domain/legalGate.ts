// Section 4bis — the sign-up legal gate, as pure logic so the server can
// enforce it independently of any UI. Account creation is blocked until BOTH
// checkboxes are ticked; this decides that, and returns the acceptance record
// the server must persist in the same transaction as user creation.

export interface LegalConsentInput {
  /** "I have read and agree to the Platform Terms." */
  agreedToTerms: boolean;
  /** "I accept for myself and every Affiliate I represent / can bind." */
  affiliateDeclaration: boolean;
  /** Free-text naming the affiliates/entities being bound. */
  affiliatesDeclared: string;
  /** The version the sign-up screen rendered and the user is accepting. */
  agreementVersion: string;
}

export type LegalConsentError =
  | { code: "TERMS_NOT_ACCEPTED" }
  | { code: "AFFILIATE_DECLARATION_NOT_ACCEPTED" }
  | { code: "NO_AGREEMENT_VERSION" };

export interface LegalConsentResult {
  ok: boolean;
  errors: LegalConsentError[];
}

export function validateLegalConsent(
  input: LegalConsentInput
): LegalConsentResult {
  const errors: LegalConsentError[] = [];
  if (!input.agreedToTerms) errors.push({ code: "TERMS_NOT_ACCEPTED" });
  if (!input.affiliateDeclaration)
    errors.push({ code: "AFFILIATE_DECLARATION_NOT_ACCEPTED" });
  if (!input.agreementVersion?.trim())
    errors.push({ code: "NO_AGREEMENT_VERSION" });
  return { ok: errors.length === 0, errors };
}

/**
 * Section 4bis — a returning user must re-accept when the current published
 * version is newer than the one they last accepted. String versions are
 * compared as dotted numeric tuples ("1.10" > "1.9").
 */
export function needsReacceptance(
  currentVersion: string,
  lastAcceptedVersion: string | null
): boolean {
  if (!lastAcceptedVersion) return true;
  return compareVersions(currentVersion, lastAcceptedVersion) > 0;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}
