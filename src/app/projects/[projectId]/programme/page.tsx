import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { getProgramme, getProgrammeProgress } from "@/lib/data/programme";
import { getServerDict } from "@/lib/i18n/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import { signOut } from "../../actions";
import { ProgrammeTable } from "./ProgrammeTable";

export const dynamic = "force-dynamic";

export default async function ProgrammePage({
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

  const data = await getProgramme(params.projectId);
  if (!data) notFound();
  const progress = await getProgrammeProgress(params.projectId);

  const dict = getServerDict();
  const roleLabel =
    dict.role[membership.role as keyof typeof dict.role] ?? membership.role;
  const pct = (c: { done: number; total: number } | undefined) =>
    c && c.total ? Math.round((c.done / c.total) * 100) : 0;

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="sticky top-0 z-10 bg-navy px-4 py-3 text-white sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/projects" className="text-white/80">←</Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">{data.projectName}</h1>
              <p className="truncate text-xs text-white/60">
                {dict.programme.title} · {roleLabel}
                {membership.displayName ? ` · ${membership.displayName}` : ""}
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-xs">
            <LanguageToggle />
            <Link href={`/projects/${params.projectId}/overview`} className="text-white/80 underline">
              {dict.nav.overview}
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

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        {progress && (
          <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-navy">{dict.programme.progress}</p>
              <a
                href={`/projects/${params.projectId}/programme/export`}
                className="rounded-lg border border-navy/30 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5"
              >
                ↓ {dict.programme.exportExcel}
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={dict.programme.inspectionsDone} done={progress.inspections.done} total={progress.inspections.total} pct={pct(progress.inspections)} />
              <Stat label={dict.programme.elementsDone} done={progress.elements.done} total={progress.elements.total} pct={pct(progress.elements)} />
              {progress.byCategory
                .filter((c) => c.category === "Footing" || c.category === "Column")
                .map((c) => (
                  <Stat key={c.category} label={c.category + "s"} done={c.done} total={c.total} pct={pct(c)} />
                ))}
            </div>
          </div>
        )}
        <ProgrammeTable
          data={data}
          projectId={params.projectId}
          role={membership.role}
        />
      </div>
    </main>
  );
}

function Stat({
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
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-navy">
        {done}
        <span className="text-sm font-normal text-slate-400"> / {total}</span>
        <span className="ml-2 text-xs font-semibold text-status-pass">{pct}%</span>
      </p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-status-pass" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
