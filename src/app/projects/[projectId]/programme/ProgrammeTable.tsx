"use client";

import { useState, useTransition } from "react";
import { useDict } from "@/lib/i18n/LanguageProvider";
import { saveContractorTracking, saveCmTracking } from "./actions";
import type { ProgrammeData, ProgrammeRow } from "@/lib/data/programme";
import type { Role } from "@/domain/types";

type Editable = {
  planned: string;
  actual: string;
  completion: string;
  cmCheck: string;
  result: string;
  remarks: string;
};

const PT_KEY: Record<string, "hold" | "witness" | "surveillance" | "records"> = {
  HOLD: "hold",
  WITNESS: "witness",
  SURVEILLANCE: "surveillance",
  RECORDS: "records",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmt(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  if (!y) return d;
  return `${day} ${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

export function ProgrammeTable({
  data,
  projectId,
  role,
}: {
  data: ProgrammeData;
  projectId: string;
  role: Role;
}) {
  const dict = useDict();
  const canC = role === "contractor" || role === "owner";
  const canM = role === "cm" || role === "owner";

  const [state, setState] = useState<Record<string, Editable>>(() => {
    const m: Record<string, Editable> = {};
    for (const p of data.phases)
      for (const a of p.activities)
        for (const r of a.rows)
          m[r.code] = {
            planned: r.plannedDate ?? "",
            actual: r.actualDate ?? "",
            completion: r.completionDate ?? "",
            cmCheck: r.cmCheckDate ?? "",
            result: r.result ?? "",
            remarks: r.remarks ?? "",
          };
    return m;
  });
  const [pending, startTransition] = useTransition();
  const [savedCode, setSavedCode] = useState<string | null>(null);

  const set = (code: string, patch: Partial<Editable>) =>
    setState((s) => ({ ...s, [code]: { ...s[code], ...patch } }));

  function saveC(code: string) {
    const s = state[code];
    startTransition(async () => {
      await saveContractorTracking(projectId, code, s.planned, s.actual, s.completion);
      setSavedCode(code);
      setTimeout(() => setSavedCode((c) => (c === code ? null : c)), 1500);
    });
  }
  function saveM(code: string) {
    const s = state[code];
    startTransition(async () => {
      await saveCmTracking(projectId, code, s.cmCheck, s.result || null, s.remarks);
      setSavedCode(code);
      setTimeout(() => setSavedCode((c) => (c === code ? null : c)), 1500);
    });
  }

  const RESULT_OPTS: { v: string; label: string; tone: string }[] = [
    { v: "PASS", label: dict.programme.resultPass, tone: "text-status-pass" },
    { v: "PASS_WITH_COMMENT", label: dict.programme.resultPwc, tone: "text-[#8a6100]" },
    { v: "FAIL", label: dict.programme.resultFail, tone: "text-status-fail" },
    { v: "NA", label: dict.programme.resultNa, tone: "text-slate-500" },
  ];

  function appChip(r: ProgrammeRow) {
    if (r.appComplete && r.appResult) {
      const tone =
        r.appResult === "FAIL"
          ? "bg-status-fail/12 text-status-fail"
          : r.appResult === "PASS_WITH_COMMENT"
            ? "bg-status-warn/15 text-[#8a6100]"
            : "bg-status-pass/12 text-status-pass";
      const lbl =
        r.appResult === "PASS_WITH_COMMENT" ? "PWC" : r.appResult;
      return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{lbl}</span>;
    }
    if (r.appSignoff) {
      return (
        <span className="rounded-full bg-status-warn/15 px-2 py-0.5 text-[10px] font-semibold text-[#8a6100]">
          {dict.status.awaiting}
        </span>
      );
    }
    return <span className="text-[10px] text-slate-400">{dict.programme.notSigned}</span>;
  }

  const CONF = "bg-[#FFF9E6]"; // contractor input tint
  const CMF = "bg-[#E8F1FB]"; // CM input tint
  const dateCls = "w-[110px] rounded border border-slate-200 px-1 py-0.5 text-xs disabled:bg-transparent disabled:border-transparent disabled:text-slate-500";

  return (
    <div>
      <p className="mb-2 text-sm text-slate-600">{dict.programme.intro}</p>
      {!canC && !canM && (
        <p className="mb-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
          {dict.programme.readOnlyNote}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="sticky top-0 z-[1]">
            <tr className="text-[11px] uppercase tracking-wide text-white">
              <th className="bg-navy px-3 py-2 text-left">{dict.programme.inspection}</th>
              <th className="bg-navy px-2 py-2">{dict.programme.type}</th>
              <th className="bg-[#E8A33D] px-2 py-2" colSpan={3}>{dict.programme.contractorCols}</th>
              <th className="bg-[#2E75B6] px-2 py-2" colSpan={3}>{dict.programme.cmCols}</th>
              <th className="bg-navy px-2 py-2">{dict.programme.appSignoff}</th>
            </tr>
            <tr className="text-[10px] font-semibold text-slate-500">
              <th className="bg-slate-50 px-3 py-1 text-left"></th>
              <th className="bg-slate-50 px-2 py-1"></th>
              <th className="bg-[#FFF9E6] px-2 py-1">{dict.programme.plannedInsp}</th>
              <th className="bg-[#FFF9E6] px-2 py-1">{dict.programme.actualInsp}</th>
              <th className="bg-[#FFF9E6] px-2 py-1">{dict.programme.completion}</th>
              <th className="bg-[#E8F1FB] px-2 py-1">{dict.programme.cmCheckDate}</th>
              <th className="bg-[#E8F1FB] px-2 py-1">{dict.programme.result}</th>
              <th className="bg-[#E8F1FB] px-2 py-1">{dict.programme.remarks}</th>
              <th className="bg-slate-50 px-2 py-1"></th>
            </tr>
          </thead>
          <tbody>
            {data.phases.map((p) => {
              const rows = p.activities.flatMap((a) => a.rows);
              const done = rows.filter(
                (r) => r.appComplete && (r.appResult === "PASS" || r.appResult === "PASS_WITH_COMMENT")
              ).length;
              return (
                <PhaseGroup key={p.code}>
                  <tr>
                    <td colSpan={9} className="bg-navy px-3 py-1.5 text-left text-xs font-semibold text-white">
                      {p.code} · {p.name}
                      {p.plannedStart && (
                        <span className="font-normal text-white/70">
                          {"   "}· {fmt(p.plannedStart)} → {fmt(p.plannedEnd)} · {done}/{rows.length} ✓
                        </span>
                      )}
                    </td>
                  </tr>
                  {p.activities.map((a) => (
                    <PhaseGroup key={a.title}>
                      <tr>
                        <td colSpan={9} className="bg-[#DDE6F2] px-3 py-1 text-left text-xs font-semibold text-navy">
                          {a.title}
                        </td>
                      </tr>
                      {a.rows.map((r) => {
                        const e = state[r.code];
                        const hold = r.pointType === "HOLD";
                        const rowTint = r.hidden
                          ? "bg-[#FFF8EC]"
                          : hold
                            ? "bg-[#FDECEC]"
                            : "";
                        return (
                          <tr key={r.code} className={`border-t border-slate-100 ${rowTint}`}>
                            <td className="px-3 py-1.5 align-top">
                              <div className="text-xs font-medium text-slate-800">{r.name}</div>
                              <div className="text-[10px] text-slate-400">
                                {r.code}
                                {savedCode === r.code && (
                                  <span className="ml-2 text-status-pass">{dict.programme.saved}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-center align-top">
                              <span className="text-[10px] font-medium text-slate-500">
                                {dict.programme[PT_KEY[r.pointType]]}
                              </span>
                              {r.hidden && (
                                <div className="text-[9px] font-semibold uppercase text-[#8a6100]">
                                  {dict.programme.hidden}
                                </div>
                              )}
                            </td>
                            {/* contractor */}
                            <td className={`px-1 py-1.5 text-center align-top ${CONF}`}>
                              <input type="date" className={dateCls} disabled={!canC} value={e.planned}
                                onChange={(ev) => set(r.code, { planned: ev.target.value })}
                                onBlur={() => canC && saveC(r.code)} />
                            </td>
                            <td className={`px-1 py-1.5 text-center align-top ${CONF}`}>
                              <input type="date" className={dateCls} disabled={!canC} value={e.actual}
                                onChange={(ev) => set(r.code, { actual: ev.target.value })}
                                onBlur={() => canC && saveC(r.code)} />
                            </td>
                            <td className={`px-1 py-1.5 text-center align-top ${CONF}`}>
                              <input type="date" className={dateCls} disabled={!canC} value={e.completion}
                                onChange={(ev) => set(r.code, { completion: ev.target.value })}
                                onBlur={() => canC && saveC(r.code)} />
                            </td>
                            {/* CM */}
                            <td className={`px-1 py-1.5 text-center align-top ${CMF}`}>
                              <input type="date" className={dateCls} disabled={!canM} value={e.cmCheck}
                                onChange={(ev) => set(r.code, { cmCheck: ev.target.value })}
                                onBlur={() => canM && saveM(r.code)} />
                            </td>
                            <td className={`px-1 py-1.5 text-center align-top ${CMF}`}>
                              <select className={`${dateCls} w-[120px]`} disabled={!canM} value={e.result}
                                onChange={(ev) => { set(r.code, { result: ev.target.value }); }}
                                onBlur={() => canM && saveM(r.code)}>
                                <option value=""></option>
                                {RESULT_OPTS.map((o) => (
                                  <option key={o.v} value={o.v}>{o.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className={`px-1 py-1.5 align-top ${CMF}`}>
                              <input type="text" className={`${dateCls} w-[150px] text-left`} disabled={!canM} value={e.remarks}
                                onChange={(ev) => set(r.code, { remarks: ev.target.value })}
                                onBlur={() => canM && saveM(r.code)} placeholder="…" />
                            </td>
                            <td className="px-2 py-1.5 text-center align-top">{appChip(r)}</td>
                          </tr>
                        );
                      })}
                    </PhaseGroup>
                  ))}
                </PhaseGroup>
              );
            })}
          </tbody>
        </table>
      </div>
      {pending && (
        <p className="mt-2 text-xs text-slate-400">{dict.programme.saving}</p>
      )}
    </div>
  );
}

// Fragment wrapper so we can key grouped <tr> sets.
function PhaseGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
