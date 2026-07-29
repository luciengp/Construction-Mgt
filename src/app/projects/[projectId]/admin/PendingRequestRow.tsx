"use client";

import { useTransition } from "react";
import type { PendingRequest } from "@/lib/data/members";
import { approveRequest, rejectRequest } from "./actions";

const ROLE_LABEL: Record<string, string> = {
  contractor: "Contractor",
  cm: "Construction Manager",
  owner: "Owner",
  viewer: "Viewer",
};

export function PendingRequestRow({
  projectId,
  request,
}: {
  projectId: string;
  request: PendingRequest;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">
          {request.email ?? request.userId.slice(0, 8)}
        </p>
        <p className="text-xs text-slate-500">
          Requested <strong>{ROLE_LABEL[request.role] ?? request.role}</strong>{" "}
          · {new Date(request.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(() =>
              rejectRequest(projectId, request.membershipId)
            )
          }
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(() =>
              approveRequest(projectId, request.membershipId, request.role)
            )
          }
          className="rounded-lg bg-status-pass px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? "…" : "Approve"}
        </button>
      </div>
    </div>
  );
}
