"use client";

import { useEffect, useState, useCallback } from "react";

// Global connectivity + pending-queue indicator. Flushes queued inspection
// submissions whenever the browser regains connectivity, and shows a small
// floating badge so the user always knows whether their work is saved.
//
// The offline libraries are loaded lazily via runtime import() so this
// component's static graph stays trivial (it lives in the root layout, which
// wraps every route).
export function SyncManager() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { count } = await import("@/lib/offline/queue");
      setPending(await count());
    } catch {
      /* IndexedDB unavailable */
    }
  }, []);

  const flush = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const { flushQueue } = await import("@/lib/offline/sync");
      const res = await flushQueue();
      if (res.flushed > 0) {
        setJustSynced(res.flushed);
        setTimeout(() => setJustSynced(0), 4000);
      }
    } catch {
      /* keep queued for the next attempt */
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();

    const onOnline = () => {
      setOnline(true);
      flush();
    };
    const onOffline = () => setOnline(false);
    const onQueued = () => refresh();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("cms:queued", onQueued);
    const iv = setInterval(() => {
      refresh();
      if (navigator.onLine) flush();
    }, 20000);

    if (navigator.onLine) flush();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("cms:queued", onQueued);
      clearInterval(iv);
    };
  }, [flush, refresh]);

  if (online && pending === 0 && justSynced === 0) return null;

  let label: string;
  let tone: string;
  if (!online) {
    label = pending > 0 ? `Offline · ${pending} queued` : "Offline";
    tone = "bg-slate-800 text-white";
  } else if (syncing) {
    label = "Syncing…";
    tone = "bg-navy text-white";
  } else if (pending > 0) {
    label = `${pending} queued · will sync`;
    tone = "bg-status-warn text-[#3d2c00]";
  } else {
    label = `Synced ${justSynced}`;
    tone = "bg-status-pass text-white";
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <div className={`rounded-full px-4 py-2 text-xs font-semibold shadow-lg ${tone}`}>
        <span
          className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${
            online ? "bg-white/80" : "bg-white/50"
          }`}
        />
        {label}
      </div>
    </div>
  );
}
