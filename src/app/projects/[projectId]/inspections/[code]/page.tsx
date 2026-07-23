import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { getInspectionDetail } from "@/lib/data/inspection";
import { InspectionForm } from "./InspectionForm";

export const dynamic = "force-dynamic";

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

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="sticky top-0 z-10 bg-navy px-4 py-3 text-white">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link href={`/projects/${params.projectId}`} className="text-white/80">
            ←
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">
              {detail.code} · {detail.milestoneCode}
            </h1>
            <p className="truncate text-xs text-white/60">{detail.name}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-4">
        <InspectionForm detail={detail} />
      </div>
    </main>
  );
}
