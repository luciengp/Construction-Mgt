import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { getRegisters } from "@/lib/data/registers";
import { getServerDict } from "@/lib/i18n/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import { RegistersTabs } from "./RegistersTabs";

export const dynamic = "force-dynamic";

export default async function RegistersPage({
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
  const data = await getRegisters(params.projectId);
  if (!data) notFound();

  const dict = getServerDict();

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="sticky top-0 z-10 bg-navy px-4 py-3 text-white sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Link href={`/projects/${params.projectId}`} className="text-white/80">←</Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">{dict.registers.title}</h1>
            <p className="truncate text-xs text-white/60">{data.projectName}</p>
          </div>
          <LanguageToggle />
          <Link href={`/projects/${params.projectId}/payments`} className="text-xs text-white/80 underline">
            {dict.nav.payments}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <RegistersTabs
          data={data}
          projectId={params.projectId}
          canManage={membership.role === "owner"}
        />
      </div>
    </main>
  );
}
