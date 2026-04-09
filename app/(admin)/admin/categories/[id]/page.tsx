'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Category } from '@/types/category';

type SingleResponse<T> = {
  data?: T;
  error?: string;
};

export default function CategoryDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const categoryId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadCategory() {
      if (!categoryId) {
        setError('Invalid category ID');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/categories/${categoryId}`, {
          method: 'GET',
          cache: 'no-store',
        });

        const payload = (await response.json()) as SingleResponse<Category>;

        if (!response.ok || !payload.data) {
          if (!active) return;
          setCategory(null);
          setError(payload.error ?? 'Unable to load category');
          return;
        }

        if (!active) return;

        setCategory(payload.data);
        setName(payload.data.name);
        setDescription(payload.data.description ?? '');
        setIsActive(payload.data.is_active);
      } catch {
        if (!active) return;
        setCategory(null);
        setError('Unable to load category');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadCategory();

    return () => {
      active = false;
    };
  }, [categoryId]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[800px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Edit Category</h1>
          <Link
            href="/admin/categories"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Back
          </Link>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {!isLoading && category ? (
          <form
            className="mt-5 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();

              if (!categoryId) return;

              setIsSubmitting(true);
              setError(null);

              try {
                const response = await fetch(`/api/categories/${categoryId}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    name,
                    description: description.trim() || '',
                    is_active: isActive,
                  }),
                });

                const payload = (await response.json()) as SingleResponse<Category>;

                if (!response.ok || !payload.data) {
                  setError(payload.error ?? 'Failed to update category');
                  return;
                }

                setCategory(payload.data);
                router.refresh();
              } catch {
                setError('Failed to update category');
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Active
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={async () => {
                  if (!categoryId || !category) return;

                  const confirmed = window.confirm(`Delete ${category.name}?`);

                  if (!confirmed) return;

                  setIsDeleting(true);
                  setError(null);

                  try {
                    const response = await fetch(`/api/categories/${categoryId}`, {
                      method: 'DELETE',
                    });

                    if (!response.ok) {
                      const payload = (await response.json().catch(() => ({}))) as { error?: string };
                      setError(payload.error ?? 'Failed to delete category');
                      return;
                    }

                    router.push('/admin/categories');
                    router.refresh();
                  } catch {
                    setError('Failed to delete category');
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Category'}
              </Button>
            </div>
          </form>
        ) : null}
      </section>
    </main>
  );
}
