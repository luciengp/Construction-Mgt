import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { getInspectionDetail } from "@/lib/data/inspection";
import { getServerDict } from "@/lib/i18n/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import { InspectionForm } from "./InspectionForm";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  return y ? `${day} ${MONTHS[m - 1]} ${y}` : d;
}

export default async function InspectionPage({
  params,
}: {
  params: { projectId: string; code: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMembershipForProject(params.projectId);
  if (!membership) notFound();

  const detail = await getInspectionDetail(
    params.projectId,
    params.code,
    membership.role,
    user.id
  );
  if (!detail) notFound();

  const dict = getServerDict();
  const { data: track } = await supabase
    .from("inspection_tracking")
    .select("planned_date, actual_date, completion_date, cm_check_date, result, remarks")
    .eq("project_id", params.projectId)
    .eq("inspection_code", params.code)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="sticky top-0 z-10 bg-navy px-4 py-3 text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href={`/projects/${params.projectId}`} className="text-white/80">
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">
              {detail.code} · {detail.milestoneCode}
            </h1>
            <p className="truncate text-xs text-white/60">{detail.name}</p>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4 sm:px-6">
        {track && (
          <div className="rounded-xl bg-white p-4 text-sm shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold text-navy">{dict.programme.title}</p>
              <Link
                href={`/projects/${params.projectId}/programme`}
                className="text-xs text-navy underline"
              >
                {dict.programme.title} →
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              <div><dt className="text-slate-400">{dict.programme.plannedInsp}</dt><dd className="text-slate-700">{fmtDate(track.planned_date)}</dd></div>
              <div><dt className="text-slate-400">{dict.programme.actualInsp}</dt><dd className="text-slate-700">{fmtDate(track.actual_date)}</dd></div>
              <div><dt className="text-slate-400">{dict.programme.completion}</dt><dd className="text-slate-700">{fmtDate(track.completion_date)}</dd></div>
              <div><dt className="text-slate-400">{dict.programme.cmCheckDate}</dt><dd className="text-slate-700">{fmtDate(track.cm_check_date)}</dd></div>
              <div><dt className="text-slate-400">{dict.programme.result}</dt><dd className="text-slate-700">{track.result ?? "—"}</dd></div>
              {track.remarks && (
                <div className="col-span-2 sm:col-span-3"><dt className="text-slate-400">{dict.programme.remarks}</dt><dd className="text-slate-700">{track.remarks}</dd></div>
              )}
            </dl>
          </div>
        )}
        <InspectionForm detail={detail} />
      </div>
    </main>
  );
}
