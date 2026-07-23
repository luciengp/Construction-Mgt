// 6-digit PIN handling for the contractor's site engineer.
//
// A PIN is low-entropy (10^6). We never store it in the clear and never let
// it be brute-forced offline from a DB leak: the stored value is an HMAC of
// the PIN keyed by a server-only pepper (PIN_PEPPER env). Without the pepper
// the hash cannot be reversed even with the whole memberships table.
//
// The PIN still resolves to a real membership → a real audited identity;
// there is no anonymous access.

import { createHmac, timingSafeEqual } from "node:crypto";

export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

function pepper(): string {
  const p = process.env.PIN_PEPPER;
  if (!p) {
    throw new Error(
      "PIN_PEPPER is not set — required to hash/verify site-engineer PINs."
    );
  }
  return p;
}

export function hashPin(pin: string): string {
  if (!isValidPinFormat(pin)) {
    throw new Error("PIN must be exactly 6 digits.");
  }
  return createHmac("sha256", pepper()).update(pin).digest("hex");
}

export function verifyPin(pin: string, storedHash: string): boolean {
  if (!isValidPinFormat(pin)) return false;
  const computed = hashPin(pin);
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
