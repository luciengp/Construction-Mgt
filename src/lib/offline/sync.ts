import { getAll, remove, markError, type QueuedSubmission } from "./queue";

export interface FlushResult {
  flushed: number;
  remaining: number;
  failures: { id: string; error: string }[];
}

// Flush the queue by POSTing each submission to the sync endpoint. Applied in
// FIFO order. A permanent domain rejection (422) is dropped after recording
// the reason so it never blocks the queue forever; transient/network failures
// are kept for the next attempt.
export async function flushQueue(): Promise<FlushResult> {
  const items = await getAll();
  const failures: { id: string; error: string }[] = [];
  let flushed = 0;

  for (const item of items) {
    try {
      const res = await postSubmission(item);
      if (res.ok) {
        await remove(item.id);
        flushed++;
      } else if (res.permanent) {
        await markError(item.id, res.error);
        await remove(item.id); // domain rejected it; do not retry forever
        failures.push({ id: item.id, error: res.error });
      } else {
        await markError(item.id, res.error);
        failures.push({ id: item.id, error: res.error });
      }
    } catch (e) {
      // Network error — keep for the next online event.
      failures.push({ id: item.id, error: (e as Error).message });
      break;
    }
  }

  const remaining = (await getAll()).length;
  return { flushed, remaining, failures };
}

async function postSubmission(
  item: QueuedSubmission
): Promise<{ ok: boolean; permanent: boolean; error: string }> {
  const res = await fetch("/api/inspections/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectId: item.projectId,
      code: item.code,
      payload: item.payload,
    }),
  });
  if (res.ok) return { ok: true, permanent: false, error: "" };
  const data = await res.json().catch(() => ({ error: "Sync failed." }));
  // 422 = the domain rejected it (validation / same-signer); permanent.
  return { ok: false, permanent: res.status === 422, error: data.error ?? "Sync failed." };
}
