"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signup, type SignupState } from "./actions";

const initial: SignupState = { error: null, success: false };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full rounded-xl bg-gold py-4 text-base font-semibold text-navy transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

export function SignupForm({
  agreementVersion,
  agreementBody,
}: {
  agreementVersion: string;
  agreementBody: string;
}) {
  const [state, formAction] = useFormState(signup, initial);

  if (state.success) {
    return (
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-navy">Account created</h2>
        <p className="mb-6 text-sm text-slate-600">
          Your acceptance of the Platform Terms (v{agreementVersion}) has been
          recorded. You can now sign in.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-xl bg-navy px-6 py-3 text-sm font-semibold text-white"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="agreementVersion" value={agreementVersion} />

      <div className="space-y-3">
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
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-navy focus:outline-none"
          />
        </label>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">
          Platform Terms (v{agreementVersion})
        </p>
        <div
          className="h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700"
          data-testid="agreement-scroll"
        >
          {agreementBody}
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="agreedToTerms"
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-400"
          />
          <span>
            I have read and agree to the Platform Terms (Confidentiality, IP and
            Non-Circumvention).
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            name="affiliateDeclaration"
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-400"
          />
          <span>
            I accept these terms for myself <strong>and for every company or
            entity I represent or am connected with (my Affiliates)</strong>, and
            I have authority to bind them.
          </span>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Affiliates / entities I am binding (optional)
          <input
            type="text"
            name="affiliatesDeclared"
            placeholder="e.g. Acme Construction Co., Ltd."
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:border-navy focus:outline-none"
          />
        </label>
      </div>

      {state.error && (
        <p className="rounded-lg bg-status-fail/10 px-3 py-2 text-sm text-status-fail">
          {state.error}
        </p>
      )}

      <SubmitButton disabled={false} />

      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-navy underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
