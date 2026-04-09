'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import ImageUpload from '@/components/admin/ImageUpload';
import { Button } from '@/components/ui/button';
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

export default function CreateActivityPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [localPrice, setLocalPrice] = useState('500');
  const [foreignPrice, setForeignPrice] = useState('750');
  const [imageUrl, setImageUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      setIsLoading(true);

      try {
        const response = await fetch('/api/categories?include_inactive=true&limit=500', {
          method: 'GET',
          cache: 'no-store',
        });

        const payload = (await response.json()) as ListResponse<Category>;

        if (!response.ok) {
          if (!active) return;
          setError(payload.error ?? 'Unable to load categories');
          setCategories([]);
          return;
        }

        if (!active) return;
        setCategories(payload.data ?? []);
      } catch {
        if (!active) return;
        setCategories([]);
        setError('Unable to load categories');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[980px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase 9</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Create Activity</h1>
          </div>
          <Link
            href="/admin/activities"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Back
          </Link>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <form
          className="mt-5 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setIsSubmitting(true);
            setError(null);

            try {
              const response = await fetch('/api/activities', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name,
                  description: description.trim() || undefined,
                  category_id: categoryId || undefined,
                  local_price: Number(localPrice),
                  foreign_price: Number(foreignPrice),
                  image_url: imageUrl.trim() || undefined,
                  display_order: Number(displayOrder),
                  is_active: isActive,
                }),
              });

              const payload = (await response.json()) as SingleResponse<Activity>;

              if (!response.ok || !payload.data) {
                setError(payload.error ?? 'Failed to create activity');
                return;
              }

              router.push(`/admin/activities/${payload.data.id}`);
              router.refresh();
            } catch {
              setError('Failed to create activity');
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
              <select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                disabled={isLoading}
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Local Price</label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={localPrice}
                onChange={(event) => setLocalPrice(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Foreign Price</label>
              <input
                type="number"
                step="0.01"
                min={0}
                required
                value={foreignPrice}
                onChange={(event) => setForeignPrice(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Display Order</label>
              <input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(event) => setDisplayOrder(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Image</label>
              <ImageUpload
                value={imageUrl}
                onChange={(url) => setImageUrl(url)}
              />
            </div>
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

          <div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Activity'}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
