import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import {
  getProjectMembers,
  getUsersAwaitingAssignment,
  getPendingRequests,
  getProjectSettings,
} from "@/lib/data/members";
import { AddMemberForm } from "./AddMemberForm";
import { MemberRowItem } from "./MemberRow";
import { PendingUserRow } from "./PendingUserRow";
import { PendingRequestRow } from "./PendingRequestRow";
import { ProjectSettingsForm } from "./ProjectSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  params,
}: {
  params: { projectId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMembershipForProject(params.projectId);
  if (!membership) notFound();
  if (membership.role !== "owner") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
          Admin is available to the Owner only.{" "}
          <Link href={`/projects/${params.projectId}`} className="text-navy underline">
            Back to dashboard
          </Link>
        </p>
      </main>
    );
  }

  const [members, pending, requests, settings] = await Promise.all([
    getProjectMembers(params.projectId),
    getUsersAwaitingAssignment(),
    getPendingRequests(params.projectId),
    getProjectSettings(params.projectId),
  ]);

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="sticky top-0 z-10 bg-navy px-4 py-3 text-white sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link href={`/projects/${params.projectId}`} className="text-white/80">←</Link>
          <h1 className="text-sm font-semibold">Admin</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4 sm:px-6">
        {settings && (
          <ProjectSettingsForm projectId={params.projectId} settings={settings} />
        )}

        {requests.length > 0 && (
          <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-2 ring-gold/40">
            <div className="border-b border-slate-100 bg-gold/10 px-4 py-2.5">
              <p className="text-sm font-semibold text-navy">
                Requests to join ({requests.length})
              </p>
              <p className="text-xs text-slate-500">
                People who signed up and chose a team. Approve to grant access.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {requests.map((r) => (
                <PendingRequestRow
                  key={r.membershipId}
                  projectId={params.projectId}
                  request={r}
                />
              ))}
            </div>
          </section>
        )}

        <AddMemberForm projectId={params.projectId} />

        {pending.length > 0 && (
          <section className="overflow-hidden rounded-xl bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-gold/10 px-4 py-2.5">
              <p className="text-sm font-semibold text-navy">
                New sign-ups awaiting assignment ({pending.length})
              </p>
              <p className="text-xs text-slate-500">
                People who created accounts but have no project yet. Pick a role
                and add them here.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {pending.map((u) => (
                <PendingUserRow
                  key={u.userId}
                  projectId={params.projectId}
                  user={u}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Members on this project
          </p>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm">
            {members.map((m) => (
              <MemberRowItem
                key={m.id}
                projectId={params.projectId}
                member={m}
                isSelf={m.userId === user.id}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
