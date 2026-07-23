import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  // A signed-in user goes straight to their projects.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/projects");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy px-6 text-white">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gold text-2xl font-bold text-navy">
          CMS
        </div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          Construction Management System
        </h1>
        <p className="mb-10 text-sm text-white/70">
          The contractor doesn&apos;t request payment — the contractor requests
          an inspection.
        </p>
        <Link
          href="/login"
          className="block w-full rounded-xl bg-gold py-4 text-base font-semibold text-navy transition-colors hover:bg-gold-light"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="mt-3 block w-full rounded-xl border border-white/20 py-4 text-base font-semibold text-white transition-colors hover:bg-white/5"
        >
          Create an account
        </Link>
        <p className="mt-6 text-xs text-white/40">
          Quality gates · dual sign-off · milestone payments
        </p>
      </div>
    </main>
  );
}
