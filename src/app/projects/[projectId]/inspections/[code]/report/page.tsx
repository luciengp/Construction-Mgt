import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { getInspectionReport } from "@/lib/data/report";
import { getServerDict } from "@/lib/i18n/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import type { Check } from "@/domain/types";

export const dynamic = "force-dynamic";

const RESULT_TONE: Record<string, string> = {
  PASS: "bg-status-pass/12 text-status-pass",
  PASS_WITH_COMMENT: "bg-status-warn/15 text-[#8a6100]",
  FAIL: "bg-status-fail/12 text-status-fail",
};

const STATE_TONE: Record<Check["state"], string> = {
  pass: "bg-status-pass/12 text-status-pass",
  fail: "bg-status-fail/12 text-status-fail",
  na: "bg-slate-200 text-slate-500",
};

function StateCell({
  answer,
  labels,
}: {
  answer: { state: Check["state"]; note: string | null } | null;
  labels: Record<Check["state"], string>;
}) {
  if (!answer) {
    return <span className="text-xs text-slate-300">—</span>;
  }
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATE_TONE[answer.state]}`}
    >
      {labels[answer.state]}
    </span>
  );
}

function NoteCell({
  answer,
}: {
  answer: { state: Check["state"]; note: string | null } | null;
}) {
  if (!answer?.note) {
    return <span className="text-xs text-slate-300">—</span>;
  }
  return (
    <p className="text-[11px] leading-snug text-slate-600">{answer.note}</p>
  );
}

export default async function ReportPage({
  params,
}: {
  params: { projectId: string; code: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMembershipForProject(params.projectId);
  if (!membership) notFound();

  const report = await getInspectionReport(params.projectId, params.code);
  if (!report) notFound();

  const dict = getServerDict();
  const stateLabels: Record<Check["state"], string> = {
    pass: dict.inspection.pass,
    fail: dict.inspection.fail,
    na: dict.inspection.na,
  };

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="sticky top-0 z-10 bg-navy px-4 py-3 text-white sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Link href={`/projects/${params.projectId}/registers`} className="text-white/80">
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">
              {report.code} · {report.name}
            </h1>
            <p className="truncate text-xs text-white/60">
              {report.milestoneCode} · {report.projectName}
            </p>
          </div>
          <LanguageToggle />
          {report.result && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${RESULT_TONE[report.result] ?? "bg-white/20"}`}
            >
              {report.result === "PASS_WITH_COMMENT" ? "PWC" : report.result}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-5 px-4 pt-4 sm:px-6">
        {/* Status summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={dict.report.signoff} value={report.signoff ?? dict.report.notStarted} />
          <Stat
            label={dict.report.contractor}
            value={report.contractorSigned ? dict.report.signed : dict.report.outstanding}
            tone={report.contractorSigned ? "pass" : "warn"}
          />
          <Stat
            label={dict.report.cm}
            value={report.cmSigned ? dict.report.signed : dict.report.outstanding}
            tone={report.cmSigned ? "pass" : "warn"}
          />
          <Stat label={dict.report.photos} value={String(report.photos.length)} />
        </div>

        {report.area && (
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-500">{dict.report.area}:</span> {report.area}
          </p>
        )}

        {/* Contractor vs CM table */}
        <section className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-navy">{dict.report.checklistTitle}</h2>
          </div>
          {report.rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              {dict.report.noChecklist}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2 font-semibold">{dict.report.colCheck}</th>
                    <th className="w-20 px-3 py-2 text-center font-semibold text-status-pass">
                      {dict.report.colContractor}
                    </th>
                    <th className="w-48 px-3 py-2 font-semibold">{dict.report.colContractorComment}</th>
                    <th className="w-20 px-3 py-2 text-center font-semibold text-navy">{dict.report.colCm}</th>
                    <th className="w-48 px-3 py-2 font-semibold">{dict.report.colCmComment}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {report.rows.map((row) => (
                    <tr key={row.seq} className="align-top">
                      <td className="px-4 py-3 text-slate-700">{row.text}</td>
                      <td className="px-3 py-3 text-center">
                        <StateCell answer={row.contractor} labels={stateLabels} />
                      </td>
                      <td className="border-l border-slate-50 px-3 py-3">
                        <NoteCell answer={row.contractor} />
                      </td>
                      <td className="border-l border-slate-50 px-3 py-3 text-center">
                        <StateCell answer={row.cm} labels={stateLabels} />
                      </td>
                      <td className="border-l border-slate-50 px-3 py-3">
                        <NoteCell answer={row.cm} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {report.notes && (
            <div className="border-t border-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {dict.report.resultNotes}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{report.notes}</p>
            </div>
          )}
        </section>

        {/* Photos for this inspection check */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-navy">
            {dict.report.photos}{" "}
            {report.hidden && <span className="text-navy/70">({dict.report.hiddenWork})</span>}
          </h2>
          {report.photos.length === 0 ? (
            <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
              {dict.report.noPhotos}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:gap-3">
              {report.photos.map((p) => (
                <a
                  key={p.id}
                  href={p.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  title={`${p.ref} — open full size`}
                  className="group overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
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
                    {p.hidden && <p className="text-[10px] text-slate-400">{dict.report.hidden}</p>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pass" | "warn";
}) {
  const valueCls =
    tone === "pass"
      ? "text-status-pass"
      : tone === "warn"
        ? "text-[#8a6100]"
        : "text-navy";
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${valueCls}`}>{value}</p>
    </div>
  );
}
