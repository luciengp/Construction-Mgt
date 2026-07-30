"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  loginWithPassword,
  requestPasswordReset,
  type AuthActionState,
} from "./actions";

const initial: AuthActionState = { error: null };

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-navy py-4 text-base font-semibold text-white transition-colors hover:bg-navy-light disabled:opacity-40"
    >
      {pending ? busy : label}
    </button>
  );
}

export function EmailForm() {
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [state, formAction] = useFormState(loginWithPassword, initial);
  const [resetState, resetAction] = useFormState(requestPasswordReset, initial);
  const [sent, setSent] = useState(false);

  if (mode === "reset") {
    return (
      <div>
        {sent ? (
          <p className="rounded-lg bg-status-pass/10 px-3 py-3 text-sm text-status-pass">
            If an account exists for that email, a password-reset link is on its
            way. Check your inbox.
          </p>
        ) : (
          <form
            action={async (fd) => {
              await resetAction(fd);
              setSent(true);
            }}
            className="space-y-4"
          >
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
            {resetState.error && (
              <p className="rounded-lg bg-status-fail/10 px-3 py-2 text-sm text-status-fail">
                {resetState.error}
              </p>
            )}
            <Submit label="Send reset link" busy="Sending…" />
          </form>
        )}
        <button
          onClick={() => {
            setMode("signin");
            setSent(false);
          }}
          className="mt-4 w-full text-center text-sm font-medium text-navy underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

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
      <Submit label="Sign in" busy="Signing in…" />
      <button
        type="button"
        onClick={() => setMode("reset")}
        className="w-full text-center text-sm font-medium text-slate-500 underline"
      >
        Forgot password?
      </button>
    </form>
  );
}
