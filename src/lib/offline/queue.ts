// Offline submission queue backed by IndexedDB. When the inspection form is
// submitted with no connectivity, the submission is stored here and flushed by
// the SyncManager when the browser comes back online. This is the single
// biggest improvement over the prototype, which lost work when signal dropped.
//
// Photos are uploaded separately (online) — this queue carries the sign-off
// itself, which is what must never be lost.

import type { SubmitPayload } from "@/lib/inspection/types";

const DB_NAME = "cms-offline";
const STORE = "submissions";
const VERSION = 1;

export interface QueuedSubmission {
  id: string;
  projectId: string;
  code: string;
  payload: SubmitPayload;
  queuedAt: number;
  lastError?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export async function enqueue(
  item: Omit<QueuedSubmission, "id" | "queuedAt">
): Promise<QueuedSubmission> {
  const full: QueuedSubmission = {
    ...item,
    id: `${item.code}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    queuedAt: Date.now(),
  };
  await tx("readwrite", (s) => s.put(full));
  return full;
}

export async function getAll(): Promise<QueuedSubmission[]> {
  const all = await tx<QueuedSubmission[]>("readonly", (s) => s.getAll());
  return all.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function remove(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export async function count(): Promise<number> {
  return tx<number>("readonly", (s) => s.count());
}

export async function markError(id: string, message: string): Promise<void> {
  const item = await tx<QueuedSubmission | undefined>("readonly", (s) => s.get(id));
  if (item) {
    item.lastError = message;
    await tx("readwrite", (s) => s.put(item));
  }
}
