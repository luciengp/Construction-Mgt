// Pure, server-free types shared between the client (offline queue) and the
// server (submitCore). Kept separate so client bundles never reach the
// server-only code in submitCore.ts.

import type { CheckState, Result } from "@/domain/types";

export interface SubmitPayload {
  result: Result;
  checkStates: Record<string, CheckState>;
  /** Optional per-check note keyed by checklist seq. */
  checkNotes: Record<string, string>;
  notes: string | null;
  area: string | null;
  releaseToCover: boolean;
}

export interface SubmitOutcome {
  ok: boolean;
  error: string | null;
  warnings: string[];
}
