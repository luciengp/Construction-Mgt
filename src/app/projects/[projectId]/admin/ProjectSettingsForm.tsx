"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveProjectSettings, type AdminState } from "./actions";
import type { ProjectSettings } from "@/lib/data/members";

const initial: AdminState = { error: null, ok: null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
    >
      {pending ? "Saving…" : "Save settings"}
    </button>
  );
}

export function ProjectSettingsForm({
  projectId,
  settings,
}: {
  projectId: string;
  settings: ProjectSettings;
}) {
  const [state, action] = useFormState(
    saveProjectSettings.bind(null, projectId),
    initial
  );
  return (
    <form
      action={action}
      className="space-y-3 rounded-xl bg-white p-4 shadow-sm"
    >
      <p className="text-sm font-semibold text-navy">Project settings</p>
      <label className="block text-sm font-medium text-slate-700">
        Contractor company
        <input
          name="contractor"
          type="text"
          defaultValue={settings.contractor ?? ""}
          placeholder="e.g. Acme Construction Co., Ltd."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy focus:outline-none"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Construction Manager
        <input
          name="constructionManager"
          type="text"
          defaultValue={settings.constructionManager ?? ""}
          placeholder="e.g. Smith Project Management"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy focus:outline-none"
        />
      </label>
      <label className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <input
          type="checkbox"
          name="signupOpen"
          defaultChecked={settings.signupOpen}
          className="mt-0.5 h-5 w-5 shrink-0"
        />
        <span>
          <strong>Open this project for sign-ups.</strong> New users can then
          choose the Contractor or CM team on the sign-up screen and request to
          join — you approve each request below. Turn this off once your team is
          complete.
        </span>
      </label>
      <div className="flex items-center gap-3">
        <Submit />
        {state.ok && <span className="text-xs text-status-pass">{state.ok}</span>}
        {state.error && (
          <span className="text-xs text-status-fail">{state.error}</span>
        )}
      </div>
    </form>
  );
}
