"use client";

import { useFormState, useFormStatus } from "react-dom";
import { addMember, type AdminState } from "./actions";

const initial: AdminState = { error: null, ok: null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-navy py-3 text-sm font-semibold text-white disabled:opacity-40"
    >
      {pending ? "Adding…" : "Add member"}
    </button>
  );
}

export function AddMemberForm({ projectId }: { projectId: string }) {
  const [state, action] = useFormState(addMember.bind(null, projectId), initial);
  return (
    <form action={action} className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-navy">Add a member</p>
      <input
        name="email"
        type="email"
        required
        placeholder="email@example.com"
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy focus:outline-none"
      />
      <input
        name="displayName"
        type="text"
        placeholder="Display name (optional)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-3">
        <select
          name="role"
          defaultValue="contractor"
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy focus:outline-none"
        >
          <option value="owner">Owner</option>
          <option value="cm">Construction Manager</option>
          <option value="contractor">Contractor</option>
          <option value="viewer">Viewer</option>
        </select>
        <input
          name="pin"
          inputMode="numeric"
          pattern="\d{6}"
          placeholder="6-digit PIN (optional)"
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy focus:outline-none"
        />
      </div>
      <p className="text-xs text-slate-400">
        A PIN lets a site engineer sign in without email. Email members receive
        a magic-link/password sign-in.
      </p>
      {state.error && <p className="text-xs text-status-fail">{state.error}</p>}
      {state.ok && <p className="text-xs text-status-pass">{state.ok}</p>}
      <Submit />
    </form>
  );
}
