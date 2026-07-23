import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { signOut } from "../actions";

export const dynamic = "force-dynamic";

// Placeholder project home. The full dashboard (KPI cards, gates, filters)
// arrives in build milestone 5.
export default async function ProjectHome({
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

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-navy">
              {membership.projectName}
            </h1>
            <p className="text-sm text-slate-500">Signed in as {membership.role}</p>
          </div>
          <form action={signOut}>
            <button className="text-sm font-medium text-slate-500 underline">
              Sign out
            </button>
          </form>
        </div>
        <div className="rounded-xl bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
          Dashboard coming in milestone 5 — quality gates, KPI cards and the
          inspection list will render here.
        </div>
      </div>
    </main>
  );
}
