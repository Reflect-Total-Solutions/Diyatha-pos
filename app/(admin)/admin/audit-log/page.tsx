'use client';

import { useEffect, useMemo, useState } from 'react';

import AuditLog, { type AuditLogRow } from '@/components/admin/AuditLog';

type ListResponse<T> = {
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  error?: string;
};

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '50');

    if (action.trim()) params.set('action', action.trim());
    if (entityType.trim()) params.set('entity_type', entityType.trim());
    if (userId.trim()) params.set('user_id', userId.trim());
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    return params.toString();
  }, [action, entityType, from, page, to, userId]);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/admin/audit-log?${query}`, {
          method: 'GET',
          cache: 'no-store',
        });

        const payload = (await response.json()) as ListResponse<AuditLogRow>;

        if (!response.ok) {
          if (!active) return;
          setRows([]);
          setTotal(0);
          setTotalPages(0);
          setError(payload.error ?? 'Unable to load audit logs');
          return;
        }

        if (!active) return;

        setRows(payload.data ?? []);
        setTotal(payload.total ?? 0);
        setTotalPages(payload.totalPages ?? 0);
      } catch {
        if (!active) return;

        setRows([]);
        setTotal(0);
        setTotalPages(0);
        setError('Unable to load audit logs');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [query]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <AuditLog
        rows={rows}
        isLoading={isLoading}
        error={error}
        total={total}
        page={page}
        totalPages={totalPages}
        onPrevious={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => Math.min(Math.max(totalPages, 1), current + 1))}
        filters={
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-6">
            <input
              type="text"
              value={action}
              onChange={(event) => {
                setPage(1);
                setAction(event.target.value);
              }}
              placeholder="Action"
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
            />
            <input
              type="text"
              value={entityType}
              onChange={(event) => {
                setPage(1);
                setEntityType(event.target.value);
              }}
              placeholder="Entity type"
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
            />
            <input
              type="text"
              value={userId}
              onChange={(event) => {
                setPage(1);
                setUserId(event.target.value);
              }}
              placeholder="User ID"
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
            />
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setPage(1);
                setFrom(event.target.value);
              }}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
            />
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setPage(1);
                setTo(event.target.value);
              }}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setAction('');
                setEntityType('');
                setUserId('');
                setFrom('');
                setTo('');
              }}
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Clear
            </button>
          </div>
        }
      />
    </main>
  );
}
