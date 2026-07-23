"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitInspection, saveDraft, type SubmitResult } from "./actions";
import { PhotoUploader } from "./PhotoUploader";
import type { InspectionDetail } from "@/lib/data/inspection";
import type { CheckState, Result } from "@/domain/types";

const PRIMARY_LABEL: Record<string, string> = {
  submit: "Submit",
  countersign: "Countersign",
  self_edit: "Update my entry",
  reinspect: "Submit re-inspection",
  read_only: "",
};

const CHECK_OPTIONS: { value: CheckState; label: string; tone: string }[] = [
  { value: "pass", label: "Pass", tone: "data-[on=true]:bg-status-pass data-[on=true]:text-white" },
  { value: "fail", label: "Fail", tone: "data-[on=true]:bg-status-fail data-[on=true]:text-white" },
  { value: "na", label: "N/A", tone: "data-[on=true]:bg-slate-500 data-[on=true]:text-white" },
];

function PrimaryButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-navy py-4 text-base font-semibold text-white transition-colors hover:bg-navy-light disabled:opacity-40"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function InspectionForm({ detail }: { detail: InspectionDetail }) {
  const prefill = detail.draft ?? detail.activeRecord ?? null;
  const initialChecks: Record<number, CheckState> = {};
  detail.checklist.forEach((item, idx) => {
    initialChecks[item.seq] = prefill?.checks?.[idx]?.state ?? "na";
  });

  const [checks, setChecks] = useState<Record<number, CheckState>>(initialChecks);
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

  const readOnly = detail.formMode === "read_only";
  const primaryLabel = PRIMARY_LABEL[detail.formMode];
  const belowMin = photoCount < detail.minPhotos;

  return (
    <form action={formAction} className="space-y-5">
      {/* Banners */}
      {detail.awaitingMyCountersignature && (
        <Banner tone="warn">
          The other party has signed. Review and <strong>countersign</strong> —
          you may only confirm or downgrade the result.
        </Banner>
      )}
      {detail.iAlreadySigned && (
        <Banner tone="neutral">
          You have already signed this record; it is awaiting the other party.
          Saving again updates your entry.
        </Banner>
      )}
      {detail.formMode === "reinspect" && (
        <Banner tone="neutral">
          This inspection is complete. Submitting starts a{" "}
          <strong>re-inspection</strong>; the previous record is kept as history.
        </Banner>
      )}
      {detail.draft && (
        <Banner tone="warn">A saved draft is in progress. It was loaded below.</Banner>
      )}

      {/* Identity */}
      <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
        <p className="text-slate-500">
          Signing as{" "}
          <span className="font-semibold text-navy">
            {detail.role === "contractor" ? "Contractor" : "Construction Manager (CM side)"}
          </span>
        </p>
        {detail.tests && (
          <p className="mt-1 text-xs text-slate-400">Tests: {detail.tests}</p>
        )}
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {detail.checklist.map((item) => (
          <div key={item.seq} className="rounded-xl bg-white p-3 shadow-sm">
            <p className="mb-2 text-sm text-slate-700">{item.text}</p>
            <input type="hidden" name={`check_${item.seq}`} value={checks[item.seq]} />
            <div className="grid grid-cols-3 gap-1.5">
              {CHECK_OPTIONS.map((opt) => (
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
          </div>
        ))}
      </div>

      {/* Area */}
      <label className="block text-sm font-medium text-slate-700">
        Area / location
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
            Photos {detail.hidden && <span className="text-navy">(hidden work)</span>}
          </p>
          <span
            className={`text-xs font-semibold ${belowMin ? "text-status-warn" : "text-status-pass"}`}
          >
            {photoCount} / min {detail.minPhotos}
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
          <p className="mt-2 text-xs text-status-warn">
            Below the photographic minimum — you can still submit, but this is
            recorded.
          </p>
        )}
      </div>

      {/* Result */}
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-medium text-slate-700">Result</p>
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
              {r === "PASS" ? "Pass" : r === "PASS_WITH_COMMENT" ? "Pass with comment" : "Fail"}
            </label>
          ))}
        </div>

        {(result === "PASS_WITH_COMMENT" || result === "FAIL") && (
          <label className="mt-3 block text-sm font-medium text-slate-700">
            {result === "PASS_WITH_COMMENT" ? "Comment (required)" : "Notes"}
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
            <strong>Release to cover.</strong> Only reads RELEASED when the record
            is complete (both signed), the result is a pass, and this box is
            ticked.
          </span>
        </label>
      )}

      {state.error && <Banner tone="fail">{state.error}</Banner>}
      {draftState.saved && <Banner tone="pass">Draft saved.</Banner>}

      {!readOnly && (
        <div className="space-y-2">
          <PrimaryButton label={primaryLabel} />
          <button
            type="submit"
            formAction={draftAction}
            className="w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-600"
          >
            Save draft
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
