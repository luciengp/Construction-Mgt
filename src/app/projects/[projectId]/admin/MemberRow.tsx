"use client";

import { useState, useTransition } from "react";
import type { MemberRow as Member } from "@/lib/data/members";
import type { Role } from "@/domain/types";
import { setMemberActive, setMemberRole, setMemberPin } from "./actions";

const ROLES: { value: Role; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "cm", label: "CM" },
  { value: "contractor", label: "Contractor" },
  { value: "viewer", label: "Viewer" },
];

export function MemberRowItem({
  projectId,
  member,
  isSelf,
}: {
  projectId: string;
  member: Member;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  return (
    <div className={`p-3 ${member.active ? "" : "opacity-50"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">
            {member.displayName || member.email || member.userId.slice(0, 8)}
          </p>
          <p className="truncate text-xs text-slate-500">
            {member.email}
            {member.hasPin ? " · PIN set" : ""}
            {isSelf ? " · you" : ""}
          </p>
        </div>
        <select
          value={member.role}
          disabled={pending || isSelf}
          onChange={(e) =>
            startTransition(() =>
              setMemberRole(projectId, member.id, e.target.value as Role)
            )
          }
          className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowPin((s) => !s)}
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600"
        >
          {member.hasPin ? "Change PIN" : "Set PIN"}
        </button>
        {member.hasPin && (
          <form
            action={async (fd) => {
              fd.set("membershipId", member.id);
              fd.set("clear", "1");
              const r = await setMemberPin(projectId, { error: null, ok: null }, fd);
              setPinMsg(r.ok ?? r.error);
            }}
          >
            <button className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600">
              Clear PIN
            </button>
          </form>
        )}
        {!isSelf && (
          <button
            disabled={pending}
            onClick={() =>
              startTransition(() =>
                setMemberActive(projectId, member.id, !member.active)
              )
            }
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600"
          >
            {member.active ? "Deactivate" : "Reactivate"}
          </button>
        )}
      </div>

      {showPin && (
        <form
          action={async (fd) => {
            fd.set("membershipId", member.id);
            const r = await setMemberPin(projectId, { error: null, ok: null }, fd);
            setPinMsg(r.ok ?? r.error);
            if (r.ok) {
              setShowPin(false);
              setPin("");
            }
          }}
          className="mt-2 flex gap-2"
        >
          <input
            name="pin"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            pattern="\d{6}"
            placeholder="6-digit PIN"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white">
            Save
          </button>
        </form>
      )}
      {pinMsg && <p className="mt-1 text-xs text-slate-500">{pinMsg}</p>}
    </div>
  );
}
