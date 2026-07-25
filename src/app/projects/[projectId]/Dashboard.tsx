"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { DashboardData, MilestoneView, InspectionView } from "@/lib/data/dashboard";
import {
  gateBadge,
  inspectionBadge,
  TONE_CLASSES,
  TONE_DOT,
} from "@/lib/status";
import { SyncManager } from "@/components/SyncManager";

type Filter =
  | "all"
  | "failed"
  | "awaiting"
  | "outstanding"
  | "hidden"
  | "hold";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "failed", label: "Failed" },
  { key: "awaiting", label: "Awaiting sign-off" },
  { key: "outstanding", label: "Outstanding" },
  { key: "hidden", label: "Hidden works" },
  { key: "hold", label: "Hold points" },
];

function matches(i: InspectionView, f: Filter): boolean {
  switch (f) {
    case "all":
      return true;
    case "failed":
      return i.hasActiveFail;
    case "awaiting":
      return i.awaiting;
    case "outstanding":
      return !i.countsAsPassed && !i.hasActiveFail;
    case "hidden":
      return i.hidden;
    case "hold":
      return i.pointType === "HOLD";
  }
}

function Kpi({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs leading-tight text-slate-500">{label}</p>
    </div>
  );
}

export function Dashboard({
  projectId,
  data,
  role,
}: {
  projectId: string;
  data: DashboardData;
  role: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const canSign = role === "owner" || role === "cm" || role === "contractor";

  const filtered = useMemo(() => {
    return data.milestones
      .map((m) => ({
        milestone: m,
        insps:
          filter === "all" ? m.inspections : m.inspections.filter((i) => matches(i, filter)),
      }))
      .filter((g) => filter === "all" || g.insps.length > 0);
  }, [data.milestones, filter]);

  return (
    <div className="space-y-5">
      <SyncManager />
      <section className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
        <Kpi value={data.kpis.passed} label="Inspections passed" tone="text-status-pass" />
        <Kpi value={data.kpis.failedOrNcr} label="Failed / NCR open" tone="text-status-fail" />
        <Kpi value={data.kpis.awaitingSignoff} label="Awaiting sign-off" tone="text-[#8a6100]" />
        <Kpi value={data.kpis.hiddenToRelease} label="Hidden works to release" tone="text-navy" />
        <Kpi
          value={`${data.kpis.milestonesComplete}/${data.kpis.milestonesTotal}`}
          label="Gates ready"
          tone="text-navy"
        />
        <Kpi value={data.milestones.reduce((s,m)=>s+m.inspections.length,0)} label="Total inspections" tone="text-slate-700" />
      </section>

      <section className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 whitespace-nowrap sm:flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-navy text-white"
                  : "bg-white text-slate-600 shadow-sm"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
        {filtered.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm lg:col-span-2">
            Nothing matches this filter.
          </p>
        )}
        {filtered.map(({ milestone, insps }) => (
          <MilestoneGate
            key={milestone.code}
            projectId={projectId}
            milestone={milestone}
            inspections={insps}
            canSign={canSign}
            defaultOpen={filter !== "all"}
          />
        ))}
      </section>
    </div>
  );
}

function MilestoneGate({
  projectId,
  milestone,
  inspections,
  canSign,
  defaultOpen,
}: {
  projectId: string;
  milestone: MilestoneView;
  inspections: InspectionView[];
  canSign: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const badge = gateBadge(milestone.gate);

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[badge.tone]}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-navy">
            {milestone.code} · {milestone.description}
          </p>
          <p className="text-xs text-slate-500">
            {milestone.gate.passedCount}/{milestone.gate.totalCount} passed
            {milestone.contractValue > 0 &&
              ` · ${milestone.contractValue.toLocaleString()} THB`}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[badge.tone]}`}
        >
          {badge.label}
        </span>
      </button>

      {milestone.gate.blockReasons.length > 0 && (
        <p className="mx-4 mb-2 rounded-lg bg-status-fail/10 px-3 py-2 text-xs text-status-fail">
          {milestone.gate.blockReasons.join(" · ")}
        </p>
      )}

      {open && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {inspections.map((i) => {
            const ib = inspectionBadge(i);
            return (
              <li key={i.code}>
                <Link
                  href={
                    canSign
                      ? `/projects/${projectId}/inspections/${i.code}`
                      : "#"
                  }
                  className={`flex items-center gap-3 px-4 py-3 ${
                    canSign ? "hover:bg-slate-50" : "cursor-default"
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT[ib.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {i.code} · {i.name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-400">{i.pointType}</span>
                      {i.hidden && (
                        <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-navy">
                          Hidden
                        </span>
                      )}
                      {i.hasDraft && (
                        <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#8a6100]">
                          Draft
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[ib.tone]}`}
                  >
                    {ib.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
