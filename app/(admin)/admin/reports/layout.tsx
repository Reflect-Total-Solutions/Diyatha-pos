import Link from 'next/link';
import type { ReactNode } from 'react';

const reportLinks = [
  { href: '/admin/reports', label: 'Overview' },
  { href: '/admin/reports/daily', label: 'Daily' },
  { href: '/admin/reports/activity', label: 'Activity' },
  { href: '/admin/reports/cashier', label: 'Cashier' },
  { href: '/admin/reports/transactions', label: 'Transactions' },
  { href: '/admin/reports/shift', label: 'Shift' },
];

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase 7</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Reports</h1>
            <p className="mt-1 text-sm text-slate-600">
              Daily, activity, cashier, and transaction reporting with export support.
            </p>
          </div>

          {/* <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Back to POS
          </Link> */}
        </div>

        <nav className="mt-4 flex flex-wrap gap-2">
          {reportLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {children}
      </section>
    </main>
  );
}
