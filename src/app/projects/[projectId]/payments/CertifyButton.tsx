"use client";

import { useFormState, useFormStatus } from "react-dom";
import { certifyPayment, type CertifyState } from "./actions";

const initial: CertifyState = { error: null };

function Btn({ releasable }: { releasable: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!releasable || pending}
      className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
    >
      {pending ? "Certifying…" : releasable ? "Certify release" : "Gate not ready"}
    </button>
  );
}

export function CertifyButton({
  projectId,
  milestoneCode,
  type,
  releasable,
}: {
  projectId: string;
  milestoneCode: string;
  type: string;
  releasable: boolean;
}) {
  const [state, action] = useFormState(
    certifyPayment.bind(null, projectId, milestoneCode, type),
    initial
  );
  return (
    <form action={action}>
      <Btn releasable={releasable} />
      {state.error && (
        <p className="mt-1 text-xs text-status-fail">{state.error}</p>
      )}
    </form>
  );
}
