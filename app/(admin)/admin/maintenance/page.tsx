'use client';

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

export default function MaintenancePage() {
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
        setError(payload.error ?? 'Unable to load maintenance data');
        return;
      }

      setData(payload.data);
    } catch {
      setData(null);
      setError('Unable to load maintenance data');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase 10</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Maintenance Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Runtime status, system counts, and recent platform errors.
            </p>
          </div>

          <Button type="button" variant="outline" onClick={() => void loadData()} disabled={isLoading}>
            Refresh
          </Button>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Users</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{data?.counts.users ?? '-'}</p>
            <p className="text-xs text-slate-500">Active users: {data?.counts.active_users ?? '-'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Catalog</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {data ? data.counts.activities + data.counts.categories : '-'}
            </p>
            <p className="text-xs text-slate-500">Activities + categories</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Transactions Today</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{data?.counts.todays_transactions ?? '-'}</p>
            <p className="text-xs text-slate-500">Pending prints: {data?.counts.pending_prints ?? '-'}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-900">Printer Status</h2>
            <p className="mt-2 text-sm text-slate-700">
              Status: <span className="font-medium">{data?.printer.online ? 'Online' : 'Offline'}</span>
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Address: {data?.printer.ip ? `${data.printer.ip}:${data.printer.port}` : 'Unavailable'}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Response Time: {data?.printer.response_time ?? '-'} ms
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Last refreshed: {data?.refreshed_at ? new Date(data.refreshed_at).toLocaleString() : '-'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Errors</h2>
            <div className="mt-3 space-y-2">
              {(data?.recent_errors ?? []).map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-medium text-slate-800">{item.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              ))}

              {!isLoading && (data?.recent_errors ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No recent errors.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
