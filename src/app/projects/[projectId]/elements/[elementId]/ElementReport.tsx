"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDict } from "@/lib/i18n/LanguageProvider";
import { PhotoUploader } from "../../inspections/[code]/PhotoUploader";
import { saveElementContractor, saveElementCm } from "../../programme/actions";
import type { ElementDetail } from "@/lib/data/programme";
import type { Role } from "@/domain/types";

const RESULTS: { v: string; key: "resultPass" | "resultFail" | "resultPwc" | "resultNa" }[] = [
  { v: "PASS", key: "resultPass" },
  { v: "PASS_WITH_COMMENT", key: "resultPwc" },
  { v: "FAIL", key: "resultFail" },
  { v: "NA", key: "resultNa" },
];

export function ElementReport({
  element,
  role,
}: {
  element: ElementDetail;
  role: Role;
}) {
  const dict = useDict();
  const router = useRouter();
  const canC = role === "contractor" || role === "owner";
  const canM = role === "cm" || role === "owner";
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [cRes, setCRes] = useState(element.contractorResult ?? "");
  const [cRem, setCRem] = useState(element.contractorRemarks ?? "");
  const [planned, setPlanned] = useState(element.plannedDate ?? "");
  const [actual, setActual] = useState(element.actualDate ?? "");
  const [completion, setCompletion] = useState(element.completionDate ?? "");
  const [mRes, setMRes] = useState(element.cmResult ?? "");
  const [mRem, setMRem] = useState(element.cmRemarks ?? "");
  const [cmCheck, setCmCheck] = useState(element.cmCheckDate ?? "");
  const [photoCount, setPhotoCount] = useState(element.photos.length);

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  function saveC() {
    startTransition(async () => {
      await saveElementContractor(element.projectId, element.elementId, cRes || null, cRem, planned, actual, completion);
      flash();
    });
  }
  function saveM() {
    startTransition(async () => {
      await saveElementCm(element.projectId, element.elementId, mRes || null, mRem, cmCheck);
      flash();
    });
  }

  const inp = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-navy focus:outline-none disabled:bg-slate-50 disabled:text-slate-500";
  const resultSelect = (value: string, on: (v: string) => void, save: () => void, disabled: boolean) => (
    <select className={inp} value={value} disabled={disabled} onChange={(e) => on(e.target.value)} onBlur={save}>
      <option value=""></option>
      {RESULTS.map((o) => (
        <option key={o.v} value={o.v}>{dict.programme[o.key]}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-4">
      {/* Contractor card */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-status-pass">{dict.programme.contractor}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-600">{dict.programme.plannedInsp}
            <input type="date" className={inp} value={planned} disabled={!canC} onChange={(e) => setPlanned(e.target.value)} onBlur={saveC} />
          </label>
          <label className="text-xs font-medium text-slate-600">{dict.programme.completion}
            <input type="date" className={inp} value={completion} disabled={!canC} onChange={(e) => setCompletion(e.target.value)} onBlur={saveC} />
          </label>
          <label className="text-xs font-medium text-slate-600">{dict.programme.actualInsp}
            <input type="date" className={inp} value={actual} disabled={!canC} onChange={(e) => setActual(e.target.value)} onBlur={saveC} />
          </label>
          <label className="text-xs font-medium text-slate-600">{dict.programme.result}
            {resultSelect(cRes, setCRes, saveC, !canC)}
          </label>
          <label className="col-span-2 text-xs font-medium text-slate-600">{dict.programme.remark}
            <input type="text" className={inp} value={cRem} disabled={!canC} onChange={(e) => setCRem(e.target.value)} onBlur={saveC} placeholder="…" />
          </label>
        </div>
      </section>

      {/* CM card */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-navy">{dict.programme.cm}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-600">{dict.programme.cmCheckDate}
            <input type="date" className={inp} value={cmCheck} disabled={!canM} onChange={(e) => setCmCheck(e.target.value)} onBlur={saveM} />
          </label>
          <label className="text-xs font-medium text-slate-600">{dict.programme.result}
            {resultSelect(mRes, setMRes, saveM, !canM)}
          </label>
          <label className="col-span-2 text-xs font-medium text-slate-600">{dict.programme.remark}
            <input type="text" className={inp} value={mRem} disabled={!canM} onChange={(e) => setMRem(e.target.value)} onBlur={saveM} placeholder="…" />
          </label>
        </div>
      </section>

      {/* Photos */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy">{dict.report.photos}</h2>
          <span className="text-xs text-slate-400">{photoCount}</span>
        </div>
        {element.photos.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {element.photos.map((p) => (
              <a key={p.id} href={p.url ?? "#"} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg bg-slate-100">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt={p.ref} loading="lazy" className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-[10px] text-slate-400">—</div>
                )}
              </a>
            ))}
          </div>
        )}
        {(canC || canM) && (
          <PhotoUploader
            projectId={element.projectId}
            inspectionCode={element.inspectionCode}
            milestoneCode={element.milestoneCode}
            familyCode={element.familyCode}
            hidden={false}
            startSeq={photoCount}
            elementId={element.elementId}
            onUploaded={() => {
              setPhotoCount((n) => n + 1);
              router.refresh();
            }}
          />
        )}
      </section>

      {(pending || saved) && (
        <p className="text-center text-xs text-slate-400">
          {pending ? dict.programme.saving : dict.programme.saved}
        </p>
      )}
    </div>
  );
}
