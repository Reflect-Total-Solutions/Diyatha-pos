'use client';

import { useEffect, useState } from 'react';
import { 
  Users, 
  Activity, 
  FolderTree, 
  LineChart, 
  Printer, 
  AlertCircle,
  RefreshCcw,
  CheckCircle2
} from 'lucide-react';

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
    <div className="max-w-[1200px]">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between px-1">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            System overview, statistics, and operational health status
          </p>
        </div>

        <Button 
          type="button" 
          variant="outline" 
          onClick={() => void loadData()} 
          disabled={isLoading}
          className="h-10 px-4 font-medium shadow-sm bg-white hover:bg-slate-50 transition-colors"
        >
          <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin opacity-50' : 'text-slate-500'}`} strokeWidth={2.5}/>
          {isLoading ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50/50 p-4 text-sm font-medium text-red-800 flex items-center shadow-sm">
          <AlertCircle className="w-5 h-5 mr-3 text-red-500 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* Users Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Users</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">{data?.counts.users ?? '—'}</p>
              <p className="mt-1 text-sm text-slate-500 flex items-center gap-1.5">
                Active: <span className="font-semibold text-slate-700">{data?.counts.active_users ?? '—'}</span>
              </p>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
              <Users className="w-5 h-5" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Activities Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Activities</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 group-hover:text-emerald-600 transition-colors">{data?.counts.activities ?? '—'}</p>
              <p className="mt-1 text-sm text-slate-500 flex items-center gap-1.5">
                Active: <span className="font-semibold text-slate-700">{data?.counts.active_activities ?? '—'}</span>
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
              <Activity className="w-5 h-5" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Categories Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Categories</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 group-hover:text-amber-600 transition-colors">{data?.counts.categories ?? '—'}</p>
              <p className="mt-1 text-sm text-slate-500">Total items</p>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 group-hover:text-amber-700 transition-colors">
              <FolderTree className="w-5 h-5" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Transactions Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Today&apos;s Sales</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 group-hover:text-violet-600 transition-colors">{data?.counts.todays_transactions ?? '—'}</p>
              <p className="mt-1 text-sm text-slate-500 flex items-center gap-1.5">
                Pending: <span className="font-semibold text-slate-700">{data?.counts.pending_prints ?? '—'}</span>
              </p>
            </div>
            <div className="p-2.5 bg-violet-50 text-violet-600 rounded-xl group-hover:bg-violet-100 group-hover:text-violet-700 transition-colors">
              <LineChart className="w-5 h-5" strokeWidth={2.5} />
            </div>
          </div>
        </div>
      </div>

      {/* Printer & Errors Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 lg:gap-8">
        {/* Printer Status Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
                <Printer className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <h2 className="text-base font-bold text-slate-900">Receipt Printer</h2>
            </div>
            <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Browser Managed
            </div>
          </div>
          
          <div className="p-6 flex-1 bg-slate-50/50 rounded-b-2xl flex flex-col justify-center">
            <p className="text-sm font-medium text-slate-600 mb-2 leading-relaxed">
              Ticket receipts are now managed directly by your browser.
            </p>
            <p className="text-xs text-slate-500">
              When tickets are generated, browser print previews will format and cut them automatically using your OS printer settings.
            </p>
          </div>
        </div>

        {/* Recent Errors Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl">
                <AlertCircle className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <h2 className="text-base font-bold text-slate-900">System Alerts</h2>
            </div>
            <div className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
              {data?.recent_errors.length ?? 0}
            </div>
          </div>

          <div className="p-6 flex-1 rounded-b-2xl">
            {data?.recent_errors && data.recent_errors.length > 0 ? (
              <div className="space-y-3">
                {data.recent_errors.slice(0, 4).map((err) => (
                  <div key={err.id} className="flex gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-relaxed">{err.message}</p>
                      <p className="mt-1.5 text-xs text-slate-500 font-medium">
                        {new Date(err.created_at).toLocaleString('en-LK', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center py-6 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <p className="text-sm font-semibold tracking-tight text-slate-900 mb-1">All systems nominal</p>
                <p className="text-xs font-medium text-slate-500">No recent errors detected</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center sm:text-right">
        {data?.refreshed_at && (
          <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
            Last updated • {new Date(data.refreshed_at).toLocaleTimeString('en-LK')}
          </p>
        )}
      </div>
    </div>
  );
}
