"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateMyPassword, type AuthActionState } from "@/app/login/actions";

const initial: AuthActionState = { error: null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-navy py-4 text-base font-semibold text-white transition-colors hover:bg-navy-light disabled:opacity-40"
    >
      {pending ? "Saving…" : "Set new password"}
    </button>
  );
}

export function ResetForm() {
  const [state, action] = useFormState(updateMyPassword, initial);
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        New password
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-navy focus:outline-none"
        />
      </label>
      {state.error && (
        <p className="rounded-lg bg-status-fail/10 px-3 py-2 text-sm text-status-fail">
          {state.error}
        </p>
      )}
      <Submit />
    </form>
  );
}
