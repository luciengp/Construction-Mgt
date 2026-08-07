"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { RegistersData } from "@/lib/data/registers";
import { useDict } from "@/lib/i18n/LanguageProvider";
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
  const dict = useDict();
  const [tab, setTab] = useState<Tab>("log");

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "log", label: dict.registers.tabLog, count: data.log.length },
    { key: "ncrs", label: dict.registers.tabNcrs, count: data.ncrs.length },
    { key: "defects", label: dict.registers.tabDefects, count: data.defects.length },
    { key: "photos", label: dict.registers.tabPhotos, count: data.photos.length },
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
        <Section empty={data.log.length === 0} emptyText={dict.registers.logEmpty}>
          {data.log.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-3">
              <Link
                href={`/projects/${projectId}/inspections/${e.inspectionCode}/report`}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-medium text-slate-800">
                  {e.inspectionCode} · {e.inspectionName}
                </p>
                <p className="text-xs text-slate-500">
                  {e.milestoneCode} · {e.signoff}
                  {" · "}
                  <span className={e.contractorSigned ? "text-status-pass" : "text-slate-400"}>
                    {dict.registers.contractor} {e.contractorSigned ? "✓" : "–"}
                  </span>
                  {"  "}
                  <span className={e.cmSigned ? "text-status-pass" : "text-slate-400"}>
                    {dict.registers.cm} {e.cmSigned ? "✓" : "–"}
                  </span>
                  {" · "}
                  {new Date(e.createdAt).toLocaleDateString()}
                </p>
              </Link>
              {e.result && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${RESULT_TONE[e.result] ?? "bg-slate-200 text-slate-600"}`}>
                  {e.result === "PASS_WITH_COMMENT" ? "PWC" : e.result}
                </span>
              )}
              <Link
                href={`/projects/${projectId}/inspections/${e.inspectionCode}/report`}
                className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-navy"
              >
                {dict.common.report}
              </Link>
              {canManage && (
                <ConfirmDelete
                  label={dict.registers.delete}
                  confirmLabel={dict.registers.confirmDelete}
                  onConfirm={() => deleteRecord(projectId, e.id)}
                />
              )}
            </div>
          ))}
        </Section>
      )}

      {tab === "ncrs" && (
        <Section empty={data.ncrs.length === 0} emptyText={dict.registers.ncrsEmpty}>
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
                <p className="mt-1 text-xs text-slate-400">{dict.registers.due} {n.dueDate}</p>
              )}
            </div>
          ))}
        </Section>
      )}

      {tab === "defects" && (
        <Section empty={data.defects.length === 0} emptyText={dict.registers.defectsEmpty}>
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
        <div className="space-y-5">
          {data.photos.length === 0 ? (
            <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
              {dict.registers.photosEmpty}
            </p>
          ) : (
            groupByInspection(data.photos).map((group) => (
              <div key={group.inspectionCode}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-navy">
                    {group.inspectionCode}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {group.milestoneCode} · {group.photos.length}{" "}
                      {group.photos.length === 1
                        ? dict.registers.photoCount
                        : dict.registers.photosCount}
                    </span>
                  </h3>
                  <Link
                    href={`/projects/${projectId}/inspections/${group.inspectionCode}/report`}
                    className="text-xs font-medium text-navy underline"
                  >
                    {dict.common.report}
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-3">
                  {group.photos.map((p) => (
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
                          {p.hidden && (
                            <p className="text-[10px] text-slate-400">hidden</p>
                          )}
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
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

type PhotoGroup = {
  inspectionCode: string;
  milestoneCode: string;
  photos: RegistersData["photos"];
};

// Arrange photos by their inspection check, preserving the newest-first order
// each group first appears in.
function groupByInspection(photos: RegistersData["photos"]): PhotoGroup[] {
  const groups = new Map<string, PhotoGroup>();
  for (const p of photos) {
    let g = groups.get(p.inspectionCode);
    if (!g) {
      g = {
        inspectionCode: p.inspectionCode,
        milestoneCode: p.milestoneCode,
        photos: [],
      };
      groups.set(p.inspectionCode, g);
    }
    g.photos.push(p);
  }
  return Array.from(groups.values());
}

// Two-click confirm so a destructive delete can't happen on a single tap.
function ConfirmDelete({
  label,
  confirmLabel = "Confirm delete",
  onConfirm,
  compact,
}: {
  label: string;
  confirmLabel?: string;
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
      {armed ? (compact ? "✓?" : confirmLabel) : label}
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
