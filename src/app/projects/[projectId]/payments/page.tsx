import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMembershipForProject } from "@/lib/auth/membership";
import { getPayments, type PaymentRow } from "@/lib/data/payments";
import { CertifyButton } from "./CertifyButton";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  COMMENCEMENT: "Commencement (50%)",
  COMPLETION: "Completion (40%)",
  RETENTION: "Retention (10%)",
};

function statusChip(p: PaymentRow) {
  if (p.status === "PAID") return { label: "Paid", cls: "bg-status-pass/12 text-status-pass" };
  if (p.status === "CERTIFIED") return { label: "Certified", cls: "bg-status-pass/12 text-status-pass" };
  if (p.releasable) return { label: "Ready to release", cls: "bg-status-pass/12 text-status-pass" };
  return { label: "Hold", cls: "bg-status-fail/12 text-status-fail" };
}

export default async function PaymentsPage({
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
  const data = await getPayments(params.projectId);
  if (!data) notFound();

  const isOwner = membership.role === "owner";

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="sticky top-0 z-10 bg-navy px-4 py-3 text-white sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link href={`/projects/${params.projectId}`} className="text-white/80">←</Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">Payments</h1>
            <p className="truncate text-xs text-white/60">{data.projectName}</p>
          </div>
          <Link href={`/projects/${params.projectId}/registers`} className="text-xs text-white/80 underline">
            Registers
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 px-4 pt-4 sm:px-6">
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <Tot label="On hold" value={data.totals.hold} tone="text-status-fail" />
          <Tot label="Ready to release" value={data.totals.releasable} tone="text-status-pass" />
          <Tot label="Certified" value={data.totals.certified} tone="text-navy" />
          <Tot label="Paid" value={data.totals.paid} tone="text-slate-700" />
        </section>

        {!isOwner && (
          <p className="rounded-xl bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
            Only the Owner can certify releases. Statuses below are read-only for
            your role.
          </p>
        )}

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
          {data.milestones.map((m) => (
            <div key={m.milestoneCode} className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="border-b border-slate-100 p-3">
                <p className="font-semibold text-navy">
                  {m.milestoneCode} · {m.description}
                </p>
              </div>
              <ul className="divide-y divide-slate-100">
                {m.instalments.map((p) => {
                  const chip = statusChip(p);
                  return (
                    <li key={p.type} className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {TYPE_LABEL[p.type]}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.amount.toLocaleString()} THB · gate {p.controllingGate} (
                            {p.controllingGateStatus})
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${chip.cls}`}>
                          {chip.label}
                        </span>
                      </div>
                      {isOwner && p.status !== "CERTIFIED" && p.status !== "PAID" && (
                        <div className="mt-2">
                          <CertifyButton
                            projectId={params.projectId}
                            milestoneCode={p.milestoneCode}
                            type={p.type}
                            releasable={p.releasable}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function Tot({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <p className={`text-lg font-bold ${tone}`}>{value.toLocaleString()} ฿</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
