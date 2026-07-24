import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { getDashboard } from "@/lib/data/dashboard";
import { signOut } from "../actions";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  cm: "Construction Manager",
  contractor: "Contractor",
  viewer: "Viewer",
};

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

  const data = await getDashboard(params.projectId);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="sticky top-0 z-10 bg-navy px-4 py-3 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{data.projectName}</h1>
            <p className="text-xs text-white/60">
              {ROLE_LABEL[membership.role] ?? membership.role}
              {membership.displayName ? ` · ${membership.displayName}` : ""}
            </p>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            <Link href={`/projects/${params.projectId}/registers`} className="text-white/80 underline">
              Registers
            </Link>
            <Link href={`/projects/${params.projectId}/payments`} className="text-white/80 underline">
              Payments
            </Link>
            <form action={signOut}>
              <button className="text-white/80 underline">Sign out</button>
            </form>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-4">
        <Dashboard
          projectId={params.projectId}
          data={data}
          role={membership.role}
        />
      </div>
    </main>
  );
}
