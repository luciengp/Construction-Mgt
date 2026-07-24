import { NextResponse, type NextRequest } from "next/server";
import {
  performInspectionSubmit,
  type SubmitPayload,
} from "@/lib/inspection/submitCore";

// Endpoint the offline queue flushes to when connectivity returns. Auth is the
// user's session cookie (the same identity that queued it). The domain module
// re-derives the active-record state, so a queued submission applied later is
// interpreted correctly (e.g. becomes a countersign/re-inspection if the world
// moved on) — never blindly replayed.
export async function POST(request: NextRequest) {
  let body: {
    projectId?: string;
    code?: string;
    payload?: SubmitPayload;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON." }, { status: 400 });
  }

  if (!body.projectId || !body.code || !body.payload) {
    return NextResponse.json(
      { ok: false, error: "Missing fields." },
      { status: 400 }
    );
  }

  const outcome = await performInspectionSubmit(
    body.projectId,
    body.code,
    body.payload
  );
  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 422 });
}
