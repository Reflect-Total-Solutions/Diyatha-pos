export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Port City Colombo
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          City of Wonder POS
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
          Foundation setup is active. Continue with authentication and dashboard
          implementation through the phase-driven plan in TODO.md.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a
            href="/dashboard"
            className="inline-flex min-h-touch items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            Open POS Dashboard
          </a>
          <a
            href="/admin"
            className="inline-flex min-h-touch items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Open Admin Panel
          </a>
        </div>
      </section>
    </main>
  );
}
