"use client";

import { useState, useTransition } from "react";
import type { RegistersData } from "@/lib/data/registers";
import { deleteRecord, deletePhoto } from "./actions";

type Tab = "log" | "ncrs" | "defects" | "photos";

const RESULT_TONE: Record<string, string> = {
  PASS: "bg-status-pass/12 text-status-pass",
  PASS_WITH_COMMENT: "bg-status-warn/15 text-[#8a6100]",
  FAIL: "bg-status-fail/12 text-status-fail",
};

export function RegistersTabs({
  data,
  projectId,
  canManage,
}: {
  data: RegistersData;
  projectId: string;
  canManage: boolean;
}) {
  const [tab, setTab] = useState<Tab>("log");

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "log", label: "Log", count: data.log.length },
    { key: "ncrs", label: "NCRs", count: data.ncrs.length },
    { key: "defects", label: "Defects", count: data.defects.length },
    { key: "photos", label: "Photos", count: data.photos.length },
  ];

  return (
    <div>
      <div className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-slate-200 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
              tab === t.key ? "bg-white text-navy shadow-sm" : "text-slate-500"
            }`}
          >
            {t.label}
            <span className="ml-1 text-[10px] text-slate-400">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "log" && (
        <Section empty={data.log.length === 0} emptyText="No inspection records yet.">
          {data.log.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {e.inspectionCode} · {e.inspectionName}
                </p>
                <p className="text-xs text-slate-500">
                  {e.milestoneCode} · {e.signoff}
                  {" · "}
                  {e.contractorSigned ? "C✓" : "C–"} {e.cmSigned ? "CM✓" : "CM–"}
                  {" · "}
                  {new Date(e.createdAt).toLocaleDateString()}
                </p>
              </div>
              {e.result && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${RESULT_TONE[e.result] ?? "bg-slate-200 text-slate-600"}`}>
                  {e.result === "PASS_WITH_COMMENT" ? "PWC" : e.result}
                </span>
              )}
              {canManage && (
                <ConfirmDelete
                  label="Delete"
                  onConfirm={() => deleteRecord(projectId, e.id)}
                />
              )}
            </div>
          ))}
        </Section>
      )}

      {tab === "ncrs" && (
        <Section empty={data.ncrs.length === 0} emptyText="No NCRs raised. 🎉">
          {data.ncrs.map((n) => (
            <div key={n.seq} className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  NCR-{String(n.seq).padStart(3, "0")} · {n.milestoneCode}
                  {n.inspectionCode ? ` · ${n.inspectionCode}` : ""}
                </p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${n.status === "OPEN" ? "bg-status-fail/12 text-status-fail" : "bg-status-pass/12 text-status-pass"}`}>
                  {n.status}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{n.description}</p>
              {n.dueDate && (
                <p className="mt-1 text-xs text-slate-400">Due {n.dueDate}</p>
              )}
            </div>
          ))}
        </Section>
      )}

      {tab === "defects" && (
        <Section empty={data.defects.length === 0} emptyText="No defects logged.">
          {data.defects.map((d) => (
            <div key={d.seq} className="flex items-start gap-3 p-3">
              <span className="mt-0.5 shrink-0 rounded bg-navy/10 px-1.5 py-0.5 text-[10px] font-bold text-navy">
                {d.category}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">
                  DEF-{String(d.seq).padStart(3, "0")} · {d.milestoneCode}
                </p>
                <p className="text-xs text-slate-600">{d.description}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.status === "OPEN" ? "bg-status-warn/15 text-[#8a6100]" : "bg-status-pass/12 text-status-pass"}`}>
                {d.status}
              </span>
            </div>
          ))}
        </Section>
      )}

      {tab === "photos" && (
        <div>
          {data.photos.length === 0 ? (
            <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
              No photos uploaded yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-3">
              {data.photos.map((p) => (
                <div
                  key={p.id}
                  className="group relative overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <a
                    href={p.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    title={`${p.ref} — open full size`}
                  >
                    {p.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.url}
                        alt={p.ref}
                        loading="lazy"
                        className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-slate-100 text-xs text-slate-400">
                        unavailable
                      </div>
                    )}
                    <div className="p-2">
                      <p className="truncate text-[11px] font-medium text-slate-700">{p.ref}</p>
                      <p className="text-[10px] text-slate-400">
                        {p.inspectionCode}
                        {p.hidden ? " · hidden" : ""}
                      </p>
                    </div>
                  </a>
                  {canManage && (
                    <div className="absolute right-1.5 top-1.5">
                      <ConfirmDelete
                        label="✕"
                        compact
                        onConfirm={() => deletePhoto(projectId, p.id)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Two-click confirm so a destructive delete can't happen on a single tap.
function ConfirmDelete({
  label,
  onConfirm,
  compact,
}: {
  label: string;
  onConfirm: () => void | Promise<void>;
  compact?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const base = compact
    ? "rounded-md px-1.5 py-0.5 text-[11px] font-bold shadow"
    : "shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          setTimeout(() => setArmed(false), 4000);
          return;
        }
        startTransition(() => {
          void onConfirm();
        });
      }}
      className={`${base} ${
        armed
          ? "border-status-fail bg-status-fail text-white"
          : compact
            ? "bg-white/90 text-status-fail"
            : "border-status-fail/40 text-status-fail"
      }`}
    >
      {armed ? (compact ? "✓?" : "Confirm delete") : label}
    </button>
  );
}

function Section({
  empty,
  emptyText,
  children,
}: {
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (empty)
    return (
      <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
        {emptyText}
      </p>
    );
  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm">
      {children}
    </div>
  );
}
