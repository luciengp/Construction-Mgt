"use client";

import { useState } from "react";
import { EmailForm } from "./EmailForm";
import { PinPad } from "./PinPad";

export function LoginTabs() {
  const [tab, setTab] = useState<"email" | "pin">("email");

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1">
        <button
          onClick={() => setTab("email")}
          className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
            tab === "email" ? "bg-white text-navy shadow-sm" : "text-slate-500"
          }`}
        >
          Email
        </button>
        <button
          onClick={() => setTab("pin")}
          className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
            tab === "pin" ? "bg-white text-navy shadow-sm" : "text-slate-500"
          }`}
        >
          Site PIN
        </button>
      </div>

      {tab === "email" ? (
        <EmailForm />
      ) : (
        <>
          <p className="mb-4 text-center text-sm text-slate-500">
            Enter your 6-digit site PIN
          </p>
          <PinPad />
        </>
      )}
    </div>
  );
}
