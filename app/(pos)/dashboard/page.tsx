import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Phase 2
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">POS Dashboard</h1>
        <p className="mt-3 text-sm text-slate-600">
          Authentication is now active. Phase 6 dashboard widgets will be implemented next.
        </p>
        <div className="mt-6">
          <Link
            href="/logout"
            className="inline-flex min-h-touch items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Sign out
          </Link>
        </div>
      </div>
    </main>
  );
}
