'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

type MaintenancePayload = {
  counts: {
    users: number;
    active_users: number;
    activities: number;
    active_activities: number;
    categories: number;
    todays_transactions: number;
    pending_prints: number;
  };
  printer: {
    online: boolean;
    ip: string | null;
    port: number | null;
    response_time: number | null;
  };
  recent_errors: Array<{ id: string; message: string; created_at: string }>;
  refreshed_at: string;
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<MaintenancePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/maintenance', {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as { data?: MaintenancePayload; error?: string };

      if (!response.ok || !payload.data) {
        setData(null);
        setError(payload.error ?? 'Unable to load admin dashboard');
        return;
      }

      setData(payload.data);
    } catch {
      setData(null);
      setError('Unable to load admin dashboard');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase 10</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Operations snapshot, maintenance status, and quick admin navigation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/logout"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Sign Out
            </Link>
            <Button type="button" variant="outline" onClick={() => void loadData()} disabled={isLoading}>
              Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/users" className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
            <p className="text-sm font-semibold text-slate-900">Users</p>
            <p className="mt-1 text-xs text-slate-600">Manage admin and cashier accounts</p>
          </Link>
          <Link href="/admin/activities" className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
            <p className="text-sm font-semibold text-slate-900">Activities</p>
            <p className="mt-1 text-xs text-slate-600">Create and update activity catalog</p>
          </Link>
          <Link href="/admin/categories" className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
            <p className="text-sm font-semibold text-slate-900">Categories</p>
            <p className="mt-1 text-xs text-slate-600">Maintain category taxonomy</p>
          </Link>
          <Link href="/admin/pricing" className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
            <p className="text-sm font-semibold text-slate-900">Pricing</p>
            <p className="mt-1 text-xs text-slate-600">Adjust local and foreign prices</p>
          </Link>
          <Link href="/admin/reports" className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
            <p className="text-sm font-semibold text-slate-900">Reports</p>
            <p className="mt-1 text-xs text-slate-600">Daily, activity, cashier, and transactions</p>
          </Link>
          <Link href="/admin/audit-log" className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
            <p className="text-sm font-semibold text-slate-900">Audit Log</p>
            <p className="mt-1 text-xs text-slate-600">Security and operation history</p>
          </Link>
          <Link href="/admin/maintenance" className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
            <p className="text-sm font-semibold text-slate-900">Maintenance</p>
            <p className="mt-1 text-xs text-slate-600">Health checks and recent errors</p>
          </Link>
          <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
            <p className="text-sm font-semibold text-slate-900">POS Dashboard</p>
            <p className="mt-1 text-xs text-slate-600">Return to cashier operations</p>
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Users</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{data?.counts.users ?? '-'}</p>
            <p className="text-xs text-slate-500">Active: {data?.counts.active_users ?? '-'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Activities</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{data?.counts.activities ?? '-'}</p>
            <p className="text-xs text-slate-500">Active: {data?.counts.active_activities ?? '-'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Transactions Today</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{data?.counts.todays_transactions ?? '-'}</p>
            <p className="text-xs text-slate-500">Pending prints: {data?.counts.pending_prints ?? '-'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Printer</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {data?.printer.online ? 'Online' : 'Offline'}
            </p>
            <p className="text-xs text-slate-500">
              {data?.printer.ip ? `${data.printer.ip}:${data.printer.port}` : 'No target found'}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
