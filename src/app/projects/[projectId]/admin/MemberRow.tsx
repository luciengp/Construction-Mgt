"use client";

import { useState, useTransition } from "react";
import type { MemberRow as Member } from "@/lib/data/members";
import type { Role } from "@/domain/types";
import {
  setMemberActive,
  setMemberRole,
  setMemberPin,
  updateMemberEmail,
  setMemberPassword,
  deleteMember,
} from "./actions";

const ROLES: { value: Role; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "cm", label: "CM" },
  { value: "contractor", label: "Contractor" },
  { value: "viewer", label: "Viewer" },
];

type Panel = "pin" | "email" | "password" | null;

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
  const [panel, setPanel] = useState<Panel>(null);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = (p: Panel) => {
    setMsg(null);
    setPanel((cur) => (cur === p ? null : p));
  };

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
        <Chip onClick={() => toggle("email")}>Edit email</Chip>
        <Chip onClick={() => toggle("password")}>Set password</Chip>
        <Chip onClick={() => toggle("pin")}>
          {member.hasPin ? "Change PIN" : "Set PIN"}
        </Chip>
        {member.hasPin && (
          <form
            action={async (fd) => {
              fd.set("membershipId", member.id);
              fd.set("clear", "1");
              const r = await setMemberPin(projectId, { error: null, ok: null }, fd);
              setMsg(r.ok ?? r.error);
            }}
          >
            <Chip>Clear PIN</Chip>
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
        {!isSelf && (
          <button
            disabled={pending}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                setTimeout(() => setConfirmDelete(false), 4000);
                return;
              }
              startTransition(() => deleteMember(projectId, member.id));
            }}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
              confirmDelete
                ? "border-status-fail bg-status-fail text-white"
                : "border-status-fail/40 text-status-fail"
            }`}
          >
            {confirmDelete ? "Click again to confirm" : "Remove"}
          </button>
        )}
      </div>

      {panel === "email" && (
        <form
          action={async (fd) => {
            fd.set("membershipId", member.id);
            const r = await updateMemberEmail(projectId, { error: null, ok: null }, fd);
            setMsg(r.ok ?? r.error);
            if (r.ok) setPanel(null);
          }}
          className="mt-2 flex gap-2"
        >
          <input
            name="email"
            type="email"
            defaultValue={member.email ?? ""}
            placeholder="new@email.com"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white">
            Save
          </button>
        </form>
      )}

      {panel === "password" && (
        <form
          action={async (fd) => {
            fd.set("membershipId", member.id);
            const r = await setMemberPassword(projectId, { error: null, ok: null }, fd);
            setMsg(r.ok ?? r.error);
            if (r.ok) setPanel(null);
          }}
          className="mt-2 flex gap-2"
        >
          <input
            name="password"
            type="text"
            minLength={8}
            placeholder="New password (min 8 chars)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white">
            Save
          </button>
        </form>
      )}

      {panel === "pin" && (
        <form
          action={async (fd) => {
            fd.set("membershipId", member.id);
            const r = await setMemberPin(projectId, { error: null, ok: null }, fd);
            setMsg(r.ok ?? r.error);
            if (r.ok) {
              setPanel(null);
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

      {msg && <p className="mt-1 text-xs text-slate-500">{msg}</p>}
    </div>
  );
}

function Chip({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600"
    >
      {children}
    </button>
  );
}
