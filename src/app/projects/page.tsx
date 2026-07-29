import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyMemberships } from "@/lib/auth/membership";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  cm: "Construction Manager",
  contractor: "Contractor",
  viewer: "Viewer",
};

export default async function ProjectsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const memberships = await getMyMemberships();

  // Single project → skip the picker entirely.
  if (memberships.length === 1) {
    redirect(`/projects/${memberships[0].projectId}`);
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-navy">Your projects</h1>
          <form action={signOut}>
            <button className="text-sm font-medium text-slate-500 underline">
              Sign out
            </button>
          </form>
        </div>

        {memberships.length === 0 ? (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-base font-semibold text-navy">
              You&apos;re signed in — one step to go
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              Your account is created, but nobody has added you to a project yet.
              Give this email to the project&apos;s Owner or Construction Manager
              and ask them to add you:
            </p>
            <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <code className="truncate text-sm font-medium text-navy">
                {user.email}
              </code>
            </div>
            <p className="text-xs text-slate-500">
              Once they add you, refresh this page and your project will appear
              here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {memberships.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/projects/${m.projectId}`}
                  className="flex items-center justify-between rounded-xl bg-white p-5 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <div>
                    <p className="font-semibold text-navy">{m.projectName}</p>
                    <p className="text-sm text-slate-500">
                      {ROLE_LABEL[m.role] ?? m.role}
                    </p>
                  </div>
                  <span className="text-gold">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
