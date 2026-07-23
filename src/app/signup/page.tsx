import Link from "next/link";
import { getCurrentTerms } from "@/lib/legal";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const terms = await getCurrentTerms();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-sm font-bold text-gold"
          >
            CMS
          </Link>
          <h1 className="text-xl font-semibold text-navy">Create your account</h1>
        </div>

        {terms ? (
          <SignupForm agreementVersion={terms.version} agreementBody={terms.bodyMd} />
        ) : (
          <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
            The Platform Terms could not be loaded. Sign-up is disabled until the
            agreement is available (run <code>pnpm seed</code>).
          </p>
        )}
      </div>
    </main>
  );
}
