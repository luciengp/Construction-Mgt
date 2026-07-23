"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { loginWithPin, type AuthActionState } from "./actions";

const initial: AuthActionState = { error: null };

function Submit({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!ready || pending}
      className="w-full rounded-xl bg-gold py-4 text-base font-semibold text-navy transition-colors hover:bg-gold-light disabled:opacity-40"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function PinPad() {
  const [pin, setPin] = useState("");
  const [state, formAction] = useFormState(loginWithPin, initial);

  const push = (d: string) => setPin((p) => (p.length < 6 ? p + d : p));
  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="pin" value={pin} />

      <div className="flex justify-center gap-2" aria-label="PIN entry">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 ${
              i < pin.length ? "border-navy bg-navy" : "border-slate-300"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => push(d)}
            className="rounded-xl bg-white py-5 text-2xl font-semibold text-navy shadow-sm active:bg-slate-100"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={back}
          className="rounded-xl py-5 text-lg font-medium text-slate-500 active:bg-slate-100"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={() => push("0")}
          className="rounded-xl bg-white py-5 text-2xl font-semibold text-navy shadow-sm active:bg-slate-100"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => setPin("")}
          className="rounded-xl py-5 text-sm font-medium text-slate-500 active:bg-slate-100"
        >
          Clear
        </button>
      </div>

      {state.error && (
        <p className="rounded-lg bg-status-fail/10 px-3 py-2 text-center text-sm text-status-fail">
          {state.error}
        </p>
      )}

      <Submit ready={pin.length === 6} />
    </form>
  );
}
