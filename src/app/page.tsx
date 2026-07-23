export default function Home() {
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
        <button
          className="w-full rounded-xl bg-gold py-4 text-base font-semibold text-navy transition-colors hover:bg-gold-light"
          disabled
        >
          Sign in — coming in milestone 4
        </button>
        <p className="mt-6 text-xs text-white/40">
          Scaffold build · quality gates · dual sign-off
        </p>
      </div>
    </main>
  );
}
