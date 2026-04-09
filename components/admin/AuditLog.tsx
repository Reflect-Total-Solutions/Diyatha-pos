import type { ReactNode } from 'react';

export type AuditLogRow = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  user_id: string | null;
  user_name: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type AuditLogProps = {
  rows: AuditLogRow[];
  isLoading: boolean;
  error?: string | null;
  total: number;
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  filters: ReactNode;
};

export default function AuditLog({
  rows,
  isLoading,
  error,
  total,
  page,
  totalPages,
  onPrevious,
  onNext,
  filters,
}: AuditLogProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-600">
          Security and operational actions across the system.
        </p>
      </div>

      <div className="mt-4">{filters}</div>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Time</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">User</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Action</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Entity</th>
              <th className="px-3 py-2 text-left font-medium text-slate-600">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-slate-800">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-slate-800">{row.user_name}</td>
                <td className="px-3 py-2 text-slate-800">{row.action}</td>
                <td className="px-3 py-2 text-slate-800">
                  {row.entity_type ?? '-'}
                  {row.entity_id ? ` (${row.entity_id.slice(0, 8)}...)` : ''}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {row.metadata ? (
                    <pre className="max-w-[420px] overflow-auto whitespace-pre-wrap text-xs text-slate-600">
                      {JSON.stringify(row.metadata)}
                    </pre>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}

            {!isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No audit records found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
        <p>
          {isLoading
            ? 'Loading audit logs...'
            : `Showing page ${page} of ${totalPages || 1}. Total records: ${total}`}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
            disabled={isLoading || page <= 1}
            onClick={onPrevious}
          >
            Previous
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            disabled={isLoading || page >= Math.max(totalPages, 1)}
            onClick={onNext}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
