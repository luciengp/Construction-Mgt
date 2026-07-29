"use client";

import { useState, useTransition } from "react";
import type { PendingUser } from "@/lib/data/members";
import type { Role } from "@/domain/types";
import { assignPendingUser } from "./actions";

const ROLES: { value: Role; label: string }[] = [
  { value: "contractor", label: "Contractor" },
  { value: "cm", label: "CM" },
  { value: "owner", label: "Owner" },
  { value: "viewer", label: "Viewer" },
];

export function PendingUserRow({
  projectId,
  user,
}: {
  projectId: string;
  user: PendingUser;
}) {
  const [role, setRole] = useState<Role>("contractor");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{user.email}</p>
        <p className="text-xs text-slate-500">
          Signed up{" "}
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={role}
          disabled={pending}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(() => assignPendingUser(projectId, user.userId, role))
          }
          className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add to project"}
        </button>
      </div>
    </div>
  );
}
