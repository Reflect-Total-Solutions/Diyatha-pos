'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import PricingTable, { type PricingActivityRow } from '@/components/admin/PricingTable';
import type { Activity } from '@/types/activity';
import type { Category } from '@/types/category';

type ListResponse<T> = {
  data?: T[];
  error?: string;
};

type SingleResponse<T> = {
  data?: T;
  error?: string;
};

export default function PricingPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name] as const)),
    [categories]
  );

  const rows = useMemo<PricingActivityRow[]>(() => {
    return [...activities]
      .sort((a, b) => a.display_order - b.display_order)
      .map((activity) => ({
        ...activity,
        category_name: categoryMap.get(activity.category_id ?? '') ?? '-',
      }));
  }, [activities, categoryMap]);

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
        setError(activitiesPayload.error ?? 'Unable to load pricing data');
        return;
      }

      setActivities(activitiesPayload.data ?? []);
      setCategories(categoriesPayload.data ?? []);
    } catch {
      setActivities([]);
      setCategories([]);
      setError('Unable to load pricing data');
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
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase 9</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Pricing Management</h1>
          <p className="mt-1 text-sm text-slate-600">
            Adjust local and foreign pricing per activity with inline save actions.
          </p>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="mt-4">
          <PricingTable
            rows={rows}
            isSaving={isLoading || isSaving}
            onSave={async (activityId, payload) => {
              setIsSaving(true);
              setError(null);

              try {
                const response = await fetch(`/api/activities/${activityId}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(payload),
                });

                const result = (await response.json()) as SingleResponse<Activity>;

                if (!response.ok || !result.data) {
                  return {
                    success: false,
                    error: result.error ?? 'Failed to save pricing',
                  };
                }

                setActivities((current) =>
                  current.map((activity) => (activity.id === activityId ? result.data! : activity))
                );

                return { success: true };
              } catch {
                return {
                  success: false,
                  error: 'Failed to save pricing',
                };
              } finally {
                setIsSaving(false);
              }
            }}
          />
        </div>
      </section>
    </main>
  );
}
