"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// Uploads to the private `photos` bucket at
// <project_id>/<family>/<milestone>/<ref>-<filename> and records a photos row.
// The ref follows P-<milestone>-<itp-number>-<seq> (Section 6).
export function PhotoUploader({
  projectId,
  inspectionCode,
  milestoneCode,
  familyCode,
  hidden,
  startSeq,
  onUploaded,
}: {
  projectId: string;
  inspectionCode: string;
  milestoneCode: string;
  familyCode: string;
  hidden: boolean;
  startSeq: number;
  onUploaded: () => void;
}) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const seqRef = useRef(startSeq);

  const itpNumber = inspectionCode.replace(/[^0-9]/g, "");

  async function handleFiles(files: FileList) {
    setBusy(true);
    setError(null);
    for (const file of Array.from(files)) {
      seqRef.current += 1;
      const seq = String(seqRef.current).padStart(3, "0");
      const ref = `P-${milestoneCode}-${itpNumber}-${seq}`;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${projectId}/${familyCode}/${milestoneCode}/${ref}-${safeName}`;

      const up = await supabase.storage.from("photos").upload(path, file, {
        upsert: false,
      });
      if (up.error) {
        setError(up.error.message);
        continue;
      }
      const ins = await supabase.from("photos").insert({
        project_id: projectId,
        inspection_code: inspectionCode,
        milestone_code: milestoneCode,
        family_code: familyCode,
        ref,
        storage_path: path,
        hidden,
      });
      if (ins.error) {
        setError(ins.error.message);
        continue;
      }
      setDone((d) => [...d, ref]);
      onUploaded();
    }
    setBusy(false);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full rounded-lg border-2 border-dashed border-slate-300 py-4 text-sm font-medium text-slate-500 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "＋ Add photos"}
      </button>
      {done.length > 0 && (
        <p className="mt-2 text-xs text-status-pass">
          Uploaded: {done.join(", ")}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-status-fail">{error}</p>}
    </div>
  );
}
