'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Category } from '@/types/category';

type ListResponse<T> = {
  data?: T[];
  error?: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filtered = useMemo(() => {
    return categories.filter((category) => {
      if (statusFilter === 'active' && !category.is_active) return false;
      if (statusFilter === 'inactive' && category.is_active) return false;
      return true;
    });
  }, [categories, statusFilter]);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/categories?include_inactive=true&limit=500', {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as ListResponse<Category>;

      if (!response.ok) {
        setCategories([]);
        setError(payload.error ?? 'Unable to load categories');
        return;
      }

      setCategories(payload.data ?? []);
    } catch {
      setCategories([]);
      setError('Unable to load categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase 9</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Category Management</h1>
          </div>

          <Link
            href="/admin/categories/new"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700"
          >
            New Category
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <Button type="button" variant="outline" onClick={() => void loadCategories()} disabled={isLoading}>
            Refresh
          </Button>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Name</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Description</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((category) => (
                <tr key={category.id}>
                  <td className="px-3 py-2 text-slate-800">{category.name}</td>
                  <td className="px-3 py-2 text-slate-700">{category.description || '-'}</td>
                  <td className="px-3 py-2 text-slate-800">{category.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/categories/${category.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={deletingId === category.id}
                        onClick={async () => {
                          const confirmed = window.confirm(`Delete ${category.name}?`);

                          if (!confirmed) return;

                          setDeletingId(category.id);
                          setError(null);

                          try {
                            const response = await fetch(`/api/categories/${category.id}`, {
                              method: 'DELETE',
                            });

                            if (!response.ok) {
                              const payload = (await response.json().catch(() => ({}))) as { error?: string };
                              setError(payload.error ?? 'Failed to delete category');
                              return;
                            }

                            await loadCategories();
                          } catch {
                            setError('Failed to delete category');
                          } finally {
                            setDeletingId(null);
                          }
                        }}
                      >
                        {deletingId === category.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                    No categories found.
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
