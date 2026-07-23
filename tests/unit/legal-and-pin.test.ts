import { describe, it, expect, beforeAll } from "vitest";
import {
  validateLegalConsent,
  needsReacceptance,
  compareVersions,
} from "../../src/domain/legalGate";
import { hashPin, verifyPin, isValidPinFormat } from "../../src/lib/auth/pin";

describe("legal sign-up gate (4bis)", () => {
  const base = {
    agreedToTerms: true,
    affiliateDeclaration: true,
    affiliatesDeclared: "Acme Co Ltd",
    agreementVersion: "1.0",
  };

  it("passes only when both boxes are ticked and a version is present", () => {
    expect(validateLegalConsent(base).ok).toBe(true);
  });

  it("blocks when the terms box is unticked", () => {
    const r = validateLegalConsent({ ...base, agreedToTerms: false });
    expect(r.ok).toBe(false);
    expect(r.errors).toContainEqual({ code: "TERMS_NOT_ACCEPTED" });
  });

  it("blocks when the affiliate declaration is unticked", () => {
    const r = validateLegalConsent({ ...base, affiliateDeclaration: false });
    expect(r.ok).toBe(false);
    expect(r.errors).toContainEqual({
      code: "AFFILIATE_DECLARATION_NOT_ACCEPTED",
    });
  });

  it("an empty affiliates field is allowed (a sole individual binds only themselves)", () => {
    expect(
      validateLegalConsent({ ...base, affiliatesDeclared: "" }).ok
    ).toBe(true);
  });

  it("requires a version", () => {
    const r = validateLegalConsent({ ...base, agreementVersion: "" });
    expect(r.errors).toContainEqual({ code: "NO_AGREEMENT_VERSION" });
  });
});

describe("re-acceptance on version change (4bis)", () => {
  it("re-prompts when the current version is newer than last accepted", () => {
    expect(needsReacceptance("1.1", "1.0")).toBe(true);
    expect(needsReacceptance("2.0", "1.9")).toBe(true);
    expect(needsReacceptance("1.10", "1.9")).toBe(true);
  });

  it("does not re-prompt when already on the current (or newer) version", () => {
    expect(needsReacceptance("1.0", "1.0")).toBe(false);
    expect(needsReacceptance("1.0", "1.1")).toBe(false);
  });

  it("re-prompts a user who has never accepted", () => {
    expect(needsReacceptance("1.0", null)).toBe(true);
  });

  it("compareVersions orders dotted numeric versions", () => {
    expect(compareVersions("1.2", "1.10")).toBeLessThan(0);
    expect(compareVersions("2.0", "1.99")).toBeGreaterThan(0);
    expect(compareVersions("1.0", "1.0")).toBe(0);
  });
});

describe("PIN hashing", () => {
  beforeAll(() => {
    process.env.PIN_PEPPER = "test-pepper-value";
  });

  it("accepts exactly six digits", () => {
    expect(isValidPinFormat("123456")).toBe(true);
    expect(isValidPinFormat("12345")).toBe(false);
    expect(isValidPinFormat("1234567")).toBe(false);
    expect(isValidPinFormat("12a456")).toBe(false);
  });

  it("hash is deterministic and verifies", () => {
    const h = hashPin("428913");
    expect(hashPin("428913")).toBe(h);
    expect(verifyPin("428913", h)).toBe(true);
    expect(verifyPin("428914", h)).toBe(false);
  });

  it("the pepper changes the hash (offline brute-force needs the secret)", () => {
    const h1 = hashPin("100200");
    process.env.PIN_PEPPER = "a-different-pepper";
    const h2 = hashPin("100200");
    expect(h1).not.toBe(h2);
    process.env.PIN_PEPPER = "test-pepper-value";
  });

  it("rejects malformed PINs on verify without throwing", () => {
    expect(verifyPin("abc", "deadbeef")).toBe(false);
  });
});
