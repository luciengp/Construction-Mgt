import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { getDashboard } from "@/lib/data/dashboard";
import { getServerDict } from "@/lib/i18n/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import { signOut } from "../actions";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";

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

  const dict = getServerDict();
  const roleLabel =
    dict.role[membership.role as keyof typeof dict.role] ?? membership.role;

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="sticky top-0 z-10 bg-navy px-4 py-3 text-white sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{data.projectName}</h1>
            <p className="text-xs text-white/60">
              {roleLabel}
              {membership.displayName ? ` · ${membership.displayName}` : ""}
            </p>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            <LanguageToggle />
            <Link href={`/projects/${params.projectId}/registers`} className="text-white/80 underline">
              {dict.nav.registers}
            </Link>
            <Link href={`/projects/${params.projectId}/payments`} className="text-white/80 underline">
              {dict.nav.payments}
            </Link>
            {membership.role === "owner" && (
              <Link href={`/projects/${params.projectId}/admin`} className="text-white/80 underline">
                {dict.nav.admin}
              </Link>
            )}
            <form action={signOut}>
              <button className="text-white/80 underline">{dict.common.signOut}</button>
            </form>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <Dashboard
          projectId={params.projectId}
          data={data}
          role={membership.role}
        />
      </div>
    </main>
  );
}
