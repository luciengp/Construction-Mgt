import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./ResetForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-sm font-bold text-gold">
            CMS
          </div>
          <h1 className="text-xl font-semibold text-navy">Set a new password</h1>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          {user ? (
            <ResetForm />
          ) : (
            <p className="text-center text-sm text-slate-600">
              This reset link is invalid or has expired.{" "}
              <Link href="/login" className="font-medium text-navy underline">
                Back to sign in
              </Link>{" "}
              and request a new one.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
