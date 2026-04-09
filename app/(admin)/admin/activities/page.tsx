'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Activity } from '@/types/activity';
import type { Category } from '@/types/category';

type ListResponse<T> = {
  data?: T[];
  total?: number;
  error?: string;
};

export default function AdminActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name] as const)),
    [categories]
  );

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      if (statusFilter === 'active' && !activity.is_active) return false;
      if (statusFilter === 'inactive' && activity.is_active) return false;
      if (categoryFilter !== 'all' && activity.category_id !== categoryFilter) return false;
      return true;
    });
  }, [activities, categoryFilter, statusFilter]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [activitiesResponse, categoriesResponse] = await Promise.all([
        fetch('/api/activities?include_inactive=true&limit=500', {
          method: 'GET',
          cache: 'no-store',
        }),
        fetch('/api/categories?include_inactive=true&limit=500', {
          method: 'GET',
          cache: 'no-store',
        }),
      ]);

      const activitiesPayload = (await activitiesResponse.json()) as ListResponse<Activity>;
      const categoriesPayload = (await categoriesResponse.json()) as ListResponse<Category>;

      if (!activitiesResponse.ok) {
        setActivities([]);
        setCategories([]);
        setError(activitiesPayload.error ?? 'Unable to load activities');
        return;
      }

      setActivities((activitiesPayload.data ?? []).sort((a, b) => a.display_order - b.display_order));
      setCategories(categoriesPayload.data ?? []);
    } catch {
      setActivities([]);
      setCategories([]);
      setError('Unable to load activities');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase 9</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Activity Management</h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage activity catalog, availability, and ordering.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/categories"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Categories
            </Link>
            <Link
              href="/admin/activities/new"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700"
            >
              New Activity
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <Button type="button" variant="outline" onClick={() => void loadData()} disabled={isLoading}>
            Refresh
          </Button>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Icon</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Name</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Category</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Local</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Foreign</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredActivities.map((activity) => (
                <tr key={activity.id}>
                  <td className="px-3 py-2 text-slate-800">
                    <div className="h-10 w-10 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                      {activity.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={activity.image_url}
                          alt={activity.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    <p className="font-medium">{activity.name}</p>
                    <p className="text-xs text-slate-500">Order: {activity.display_order}</p>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{categoryMap.get(activity.category_id ?? '') ?? '-'}</td>
                  <td className="px-3 py-2 text-right text-slate-800">{activity.local_price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-slate-800">{activity.foreign_price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-slate-800">{activity.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/activities/${activity.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={deletingId === activity.id}
                        onClick={async () => {
                          const confirmed = window.confirm(`Delete ${activity.name}?`);

                          if (!confirmed) {
                            return;
                          }

                          setDeletingId(activity.id);

                          try {
                            const response = await fetch(`/api/activities/${activity.id}`, {
                              method: 'DELETE',
                            });

                            if (!response.ok) {
                              const payload = (await response.json().catch(() => ({}))) as { error?: string };
                              setError(payload.error ?? 'Failed to delete activity');
                              return;
                            }

                            await loadData();
                          } catch {
                            setError('Failed to delete activity');
                          } finally {
                            setDeletingId(null);
                          }
                        }}
                      >
                        {deletingId === activity.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoading && filteredActivities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No activities found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
