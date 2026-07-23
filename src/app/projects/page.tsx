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
          <div className="rounded-xl bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
            You are signed in as{" "}
            <span className="font-medium">{user.email}</span> but have no active
            project membership yet. Ask an Owner or Construction Manager to add
            you to a project.
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
