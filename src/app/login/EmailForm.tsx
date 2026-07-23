"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginWithPassword, type AuthActionState } from "./actions";

const initial: AuthActionState = { error: null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-navy py-4 text-base font-semibold text-white transition-colors hover:bg-navy-light disabled:opacity-40"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function EmailForm() {
  const [state, formAction] = useFormState(loginWithPassword, initial);
  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-navy focus:outline-none"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Password
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
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
