"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { submitInspection, saveDraft, type SubmitResult } from "./actions";
import { PhotoUploader } from "./PhotoUploader";
import { enqueue } from "@/lib/offline/queue";
import { SyncManager } from "@/components/SyncManager";
import type { SubmitPayload } from "@/lib/inspection/types";
import type { InspectionDetail } from "@/lib/data/inspection";
import type { CheckState, Result } from "@/domain/types";
import { useDict } from "@/lib/i18n/LanguageProvider";
import type { Dict } from "@/lib/i18n/dictionaries";

function payloadFromForm(form: HTMLFormElement): SubmitPayload {
  const fd = new FormData(form);
  const checkStates: Record<string, CheckState> = {};
  const checkNotes: Record<string, string> = {};
  Array.from(fd.entries()).forEach(([k, v]) => {
    if (k.startsWith("check_")) checkStates[k.slice(6)] = String(v) as CheckState;
    else if (k.startsWith("note_")) checkNotes[k.slice(5)] = String(v);
  });
  return {
    result: String(fd.get("result") ?? "") as Result,
    checkStates,
    checkNotes,
    notes: fd.get("notes")?.toString() ?? null,
    area: fd.get("area")?.toString() ?? null,
    releaseToCover: fd.get("releaseToCover") === "on",
  };
}

function primaryLabelFor(mode: string, d: Dict): string {
  switch (mode) {
    case "submit":
      return d.inspection.submit;
    case "countersign":
      return d.inspection.countersign;
    case "self_edit":
      return d.inspection.updateEntry;
    case "reinspect":
      return d.inspection.reinspect;
    default:
      return "";
  }
}

const CHECK_TONES: Record<CheckState, string> = {
  pass: "data-[on=true]:bg-status-pass data-[on=true]:text-white",
  fail: "data-[on=true]:bg-status-fail data-[on=true]:text-white",
  na: "data-[on=true]:bg-slate-500 data-[on=true]:text-white",
};

function PrimaryButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const dict = useDict();
  return (
    <button
      type="submit"
      data-primary="1"
      suppressHydrationWarning
      disabled={pending}
      className="w-full rounded-xl bg-navy py-4 text-base font-semibold text-white transition-colors hover:bg-navy-light disabled:opacity-40"
    >
      {pending ? `${dict.common.loading}` : label}
    </button>
  );
}

export function InspectionForm({ detail }: { detail: InspectionDetail }) {
  const dict = useDict();
  const checkOptions: { value: CheckState; label: string; tone: string }[] = [
    { value: "pass", label: dict.inspection.pass, tone: CHECK_TONES.pass },
    { value: "fail", label: dict.inspection.fail, tone: CHECK_TONES.fail },
    { value: "na", label: dict.inspection.na, tone: CHECK_TONES.na },
  ];
  const prefill = detail.draft ?? detail.activeRecord ?? null;
  // Prefill this party's own answers/notes: prefer a draft, else this side's
  // previously stored checks, else the effective checks.
  const myPrefill =
    detail.draft?.checks ?? detail.myChecks ?? detail.activeRecord?.checks ?? null;
  const initialChecks: Record<number, CheckState> = {};
  const initialNotes: Record<number, string> = {};
  detail.checklist.forEach((item, idx) => {
    initialChecks[item.seq] = myPrefill?.[idx]?.state ?? "na";
    initialNotes[item.seq] = myPrefill?.[idx]?.note ?? "";
  });

  const [checks, setChecks] = useState<Record<number, CheckState>>(initialChecks);
  const [checkNotes, setCheckNotes] =
    useState<Record<number, string>>(initialNotes);
  const [result, setResult] = useState<Result | "">(
    (detail.activeRecord?.result as Result) ?? ""
  );
  const [notes, setNotes] = useState(prefill?.notes ?? "");
  const [area, setArea] = useState(prefill?.area ?? "");
  const [photoCount, setPhotoCount] = useState(detail.photoCount);

  const [state, formAction] = useFormState<SubmitResult, FormData>(
    submitInspection.bind(null, detail.projectId, detail.code),
    { error: null, warnings: [] }
  );
  const [draftState, draftAction] = useFormState<{ saved: boolean }, FormData>(
    saveDraft.bind(null, detail.projectId, detail.code),
    { saved: false }
  );

  const [queued, setQueued] = useState(false);

  const readOnly = detail.formMode === "read_only";
  const primaryLabel = primaryLabelFor(detail.formMode, dict);
  const belowMin = photoCount < detail.minPhotos;

  // Offline intercept: when the primary submit fires with no connectivity,
  // queue it in IndexedDB instead of losing it. Save-draft and photo buttons
  // are untouched.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null;
    if (submitter?.dataset.primary !== "1") return; // draft / other
    if (typeof navigator !== "undefined" && navigator.onLine) return; // online → server action
    e.preventDefault();
    const payload = payloadFromForm(e.currentTarget);
    await enqueue({ projectId: detail.projectId, code: detail.code, payload });
    window.dispatchEvent(new Event("cms:queued"));
    setQueued(true);
  }

  if (queued) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-status-warn/20 text-xl">
          ⏳
        </div>
        <h2 className="mb-1 text-lg font-semibold text-navy">{dict.inspection.savedOffline}</h2>
        <p className="mb-5 text-sm text-slate-600">{dict.inspection.savedOfflineBody}</p>
        <Link
          href={`/projects/${detail.projectId}`}
          className="inline-block rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white"
        >
          {dict.inspection.backToDashboard}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-5">
      <SyncManager />
      {/* Banners */}
      {detail.awaitingMyCountersignature && (
        <Banner tone="warn">{dict.inspection.bannerCountersign}</Banner>
      )}
      {detail.iAlreadySigned && (
        <Banner tone="neutral">{dict.inspection.bannerAlreadySigned}</Banner>
      )}
      {detail.formMode === "reinspect" && (
        <Banner tone="neutral">{dict.inspection.bannerReinspect}</Banner>
      )}
      {detail.draft && <Banner tone="warn">{dict.inspection.bannerDraft}</Banner>}

      {/* Identity */}
      <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
        <p className="text-slate-500">
          {dict.inspection.signingAs}{" "}
          <span className="font-semibold text-navy">
            {detail.role === "contractor"
              ? dict.inspection.contractor
              : dict.inspection.cmSide}
          </span>
        </p>
        {detail.tests && (
          <p className="mt-1 text-xs text-slate-400">{dict.inspection.tests}: {detail.tests}</p>
        )}
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {detail.checklist.map((item) => {
          const otherNote = detail.otherChecks?.[
            detail.checklist.indexOf(item)
          ]?.note;
          return (
            <div key={item.seq} className="rounded-xl bg-white p-3 shadow-sm">
              <p className="mb-2 text-sm text-slate-700">{item.text}</p>
              <input type="hidden" name={`check_${item.seq}`} value={checks[item.seq]} />
              <div className="grid grid-cols-3 gap-1.5">
                {checkOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={readOnly}
                    data-on={checks[item.seq] === opt.value}
                    onClick={() =>
                      setChecks((c) => ({ ...c, [item.seq]: opt.value }))
                    }
                    className={`rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 ${opt.tone}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {otherNote && (
                <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                  <span className="font-semibold text-slate-500">
                    {detail.role === "contractor"
                      ? dict.inspection.cmNote
                      : dict.inspection.contractorNote}
                  </span>{" "}
                  {otherNote}
                </p>
              )}
              <input
                type="text"
                name={`note_${item.seq}`}
                value={checkNotes[item.seq] ?? ""}
                onChange={(e) =>
                  setCheckNotes((n) => ({ ...n, [item.seq]: e.target.value }))
                }
                disabled={readOnly}
                placeholder={dict.inspection.noteOptional}
                className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-navy focus:outline-none"
              />
            </div>
          );
        })}
      </div>

      {/* Area */}
      <label className="block text-sm font-medium text-slate-700">
        {dict.inspection.areaLabel}
        <input
          type="text"
          name="area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          disabled={readOnly}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-navy focus:outline-none"
        />
      </label>

      {/* Photos */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">
            {dict.inspection.photos}{" "}
            {detail.hidden && <span className="text-navy">{dict.inspection.hiddenWork}</span>}
          </p>
          <span
            className={`text-xs font-semibold ${belowMin ? "text-status-warn" : "text-status-pass"}`}
          >
            {photoCount} / {dict.inspection.minPhotos} {detail.minPhotos}
          </span>
        </div>
        <PhotoUploader
          projectId={detail.projectId}
          inspectionCode={detail.code}
          milestoneCode={detail.milestoneCode}
          familyCode={detail.familyCode}
          hidden={detail.hidden}
          startSeq={photoCount}
          onUploaded={() => setPhotoCount((n) => n + 1)}
        />
        {belowMin && (
          <p className="mt-2 text-xs text-status-warn">{dict.inspection.belowMin}</p>
        )}
      </div>

      {/* Result */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-medium text-slate-700">{dict.inspection.result}</p>
        <div className="grid grid-cols-1 gap-2">
          {(["PASS", "PASS_WITH_COMMENT", "FAIL"] as Result[]).map((r) => (
            <label
              key={r}
              className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-sm ${
                result === r ? "border-navy bg-navy/5" : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="result"
                value={r}
                checked={result === r}
                onChange={() => setResult(r)}
                disabled={readOnly}
                className="h-4 w-4"
              />
              {r === "PASS"
                ? dict.inspection.pass
                : r === "PASS_WITH_COMMENT"
                  ? dict.inspection.passWithComment
                  : dict.inspection.fail}
            </label>
          ))}
        </div>

        {(result === "PASS_WITH_COMMENT" || result === "FAIL") && (
          <label className="mt-3 block text-sm font-medium text-slate-700">
            {result === "PASS_WITH_COMMENT"
              ? dict.inspection.commentRequired
              : dict.inspection.notes}
            <textarea
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-navy focus:outline-none"
            />
          </label>
        )}
        {result !== "PASS_WITH_COMMENT" && result !== "FAIL" && (
          <input type="hidden" name="notes" value={notes} />
        )}
      </div>

      {/* Hidden-work release */}
      {detail.hidden && (
        <label className="flex items-start gap-3 rounded-xl bg-white p-4 text-sm text-slate-700 shadow-sm">
          <input
            type="checkbox"
            name="releaseToCover"
            disabled={readOnly}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span>
            <strong>{dict.inspection.releaseTitle}</strong> {dict.inspection.releaseBody}
          </span>
        </label>
      )}

      {state.error && <Banner tone="fail">{state.error}</Banner>}
      {draftState.saved && <Banner tone="pass">{dict.inspection.draftSaved}</Banner>}

      {!readOnly && (
        <div className="space-y-2">
          <PrimaryButton label={primaryLabel} />
          <button
            type="submit"
            formAction={draftAction}
            className="w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-600"
          >
            {dict.inspection.saveDraft}
          </button>
        </div>
      )}
    </form>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "pass" | "warn" | "fail" | "neutral";
  children: React.ReactNode;
}) {
  const cls = {
    pass: "bg-status-pass/10 text-status-pass",
    warn: "bg-status-warn/15 text-[#8a6100]",
    fail: "bg-status-fail/10 text-status-fail",
    neutral: "bg-slate-100 text-slate-600",
  }[tone];
  return <p className={`rounded-xl px-3 py-2.5 text-sm ${cls}`}>{children}</p>;
}
