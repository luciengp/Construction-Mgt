import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { getDashboard } from "@/lib/data/dashboard";
import { getProgrammeProgress } from "@/lib/data/programme";
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
  const progress = await getProgrammeProgress(params.projectId);
  const ipct =
    progress && progress.inspections.total
      ? Math.round((progress.inspections.done / progress.inspections.total) * 100)
      : 0;
  const epct =
    progress && progress.elements.total
      ? Math.round((progress.elements.done / progress.elements.total) * 100)
      : 0;

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
            <Link href={`/projects/${params.projectId}/programme`} className="text-white/80 underline">
              {dict.nav.programme}
            </Link>
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
        {progress && (progress.inspections.total > 0) && (
          <Link
            href={`/projects/${params.projectId}/programme`}
            className="mb-4 flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="text-sm font-semibold text-navy">{dict.nav.programme}</span>
            <ProgressPill label={dict.programme.inspectionsDone} done={progress.inspections.done} total={progress.inspections.total} pct={ipct} />
            <ProgressPill label={dict.programme.elementsDone} done={progress.elements.done} total={progress.elements.total} pct={epct} />
            <span className="ml-auto text-xs text-navy underline">{dict.nav.programme} →</span>
          </Link>
        )}
        <Dashboard
          projectId={params.projectId}
          data={data}
          role={membership.role}
        />
      </div>
    </main>
  );
}

function ProgressPill({
  label,
  done,
  total,
  pct,
}: {
  label: string;
  done: number;
  total: number;
  pct: number;
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-sm font-bold text-navy">{done}/{total}</span>
        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
          <span className="block h-full rounded-full bg-status-pass" style={{ width: `${pct}%` }} />
        </span>
        <span className="text-xs font-semibold text-status-pass">{pct}%</span>
      </span>
    </span>
  );
}
