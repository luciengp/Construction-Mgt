import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginTabs } from "./LoginTabs";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/projects");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-sm font-bold text-gold">
            CMS
          </div>
          <h1 className="text-xl font-semibold text-navy">Sign in</h1>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <LoginTabs />
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          No account?{" "}
          <Link href="/signup" className="font-medium text-navy underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
