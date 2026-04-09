'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Activity, CreateActivityRequest, UpdateActivityRequest } from '@/types/activity';
import type { Category } from '@/types/category';

type PaginatedApiResponse<T> = {
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  error?: string;
};

type SingleItemApiResponse<T> = {
  data?: T;
  error?: string;
};

type MutationResult = {
  success: boolean;
  error?: string;
};

export type UseActivitiesOptions = {
  categoryId?: string;
  includeInactive?: boolean;
  page?: number;
  limit?: number;
  autoFetch?: boolean;
};

function buildListUrl(path: string, options: UseActivitiesOptions): string {
  const params = new URLSearchParams();

  params.set('page', String(options.page ?? 1));
  params.set('limit', String(options.limit ?? 20));

  if (options.categoryId) {
    params.set('category_id', options.categoryId);
  }

  if (options.includeInactive) {
    params.set('include_inactive', 'true');
  }

  return `${path}?${params.toString()}`;
}

export function useActivities(options: UseActivitiesOptions = {}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(options.autoFetch !== false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(options.page ?? 1);
  const [limit, setLimit] = useState(options.limit ?? 20);
  const [totalPages, setTotalPages] = useState(0);

  const loadActivities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(buildListUrl('/api/activities', options), {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as PaginatedApiResponse<Activity>;

      if (!response.ok) {
        setActivities([]);
        setError(payload.error ?? 'Unable to load activities');
        return;
      }

      setActivities(payload.data ?? []);
      setTotal(payload.total ?? 0);
      setPage(payload.page ?? 1);
      setLimit(payload.limit ?? 20);
      setTotalPages(payload.totalPages ?? 0);
    } catch {
      setActivities([]);
      setError('Unable to load activities');
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch(buildListUrl('/api/categories', options), {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as PaginatedApiResponse<Category>;

      if (!response.ok) {
        setCategories([]);
        return;
      }

      setCategories(payload.data ?? []);
    } catch {
      setCategories([]);
    }
  }, [options]);

  useEffect(() => {
    if (options.autoFetch === false) {
      return;
    }

    void Promise.all([loadActivities(), loadCategories()]);
  }, [loadActivities, loadCategories, options.autoFetch]);

  const createActivity = useCallback(async (input: CreateActivityRequest): Promise<MutationResult> => {
    setIsMutating(true);

    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const payload = (await response.json()) as SingleItemApiResponse<Activity>;

      if (!response.ok) {
        return {
          success: false,
          error: payload.error ?? 'Failed to create activity',
        };
      }

      await loadActivities();
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Failed to create activity',
      };
    } finally {
      setIsMutating(false);
    }
  }, [loadActivities]);

  const updateActivity = useCallback(async (id: string, input: UpdateActivityRequest): Promise<MutationResult> => {
    setIsMutating(true);

    try {
      const response = await fetch(`/api/activities/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const payload = (await response.json()) as SingleItemApiResponse<Activity>;

      if (!response.ok) {
        return {
          success: false,
          error: payload.error ?? 'Failed to update activity',
        };
      }

      await loadActivities();
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Failed to update activity',
      };
    } finally {
      setIsMutating(false);
    }
  }, [loadActivities]);

  const deleteActivity = useCallback(async (id: string): Promise<MutationResult> => {
    setIsMutating(true);

    try {
      const response = await fetch(`/api/activities/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = (await response.json()) as SingleItemApiResponse<Activity>;

        return {
          success: false,
          error: payload.error ?? 'Failed to delete activity',
        };
      }

      await loadActivities();
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Failed to delete activity',
      };
    } finally {
      setIsMutating(false);
    }
  }, [loadActivities]);

  const refetch = useCallback(async () => {
    await Promise.all([loadActivities(), loadCategories()]);
  }, [loadActivities, loadCategories]);

  const categoryMap = useMemo(() => {
    const entries = categories.map((category) => [category.id, category] as const);
    return new Map(entries);
  }, [categories]);

  return {
    activities,
    categories,
    categoryMap,
    isLoading,
    isMutating,
    error,
    total,
    page,
    limit,
    totalPages,
    refetch,
    createActivity,
    updateActivity,
    deleteActivity,
  };
}
