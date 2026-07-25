import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { getProjectMembers } from "@/lib/data/members";
import { AddMemberForm } from "./AddMemberForm";
import { MemberRowItem } from "./MemberRow";

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

  const members = await getProjectMembers(params.projectId);

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="sticky top-0 z-10 bg-navy px-4 py-3 text-white sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link href={`/projects/${params.projectId}`} className="text-white/80">←</Link>
          <h1 className="text-sm font-semibold">Admin · Members</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-4 sm:px-6">
        <AddMemberForm projectId={params.projectId} />

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
      </div>
    </main>
  );
}
