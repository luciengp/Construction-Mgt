import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { getElement } from "@/lib/data/programme";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ElementReport } from "./ElementReport";

export const dynamic = "force-dynamic";

export default async function ElementPage({
  params,
}: {
  params: { projectId: string; elementId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getMembershipForProject(params.projectId);
  if (!membership) notFound();

  const el = await getElement(params.projectId, decodeURIComponent(params.elementId));
  if (!el) notFound();

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="sticky top-0 z-10 bg-navy px-4 py-3 text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href={`/projects/${params.projectId}/programme`} className="text-white/80">←</Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">
              {el.elementId}
              {el.elementType ? ` · ${el.elementType}` : ""}
            </h1>
            <p className="truncate text-xs text-white/60">
              {el.category}
              {el.label ? ` · ${el.label}` : ""} · {el.inspectionCode} {el.inspectionName}
            </p>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-4 sm:px-6">
        <ElementReport element={el} role={membership.role} />
      </div>
    </main>
  );
}
