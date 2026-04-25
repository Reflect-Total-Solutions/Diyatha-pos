'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import ImageUpload from '@/components/admin/ImageUpload';
import { Button } from '@/components/ui/button';
import type { Activity } from '@/types/activity';
import type { Category } from '@/types/category';
import type { User } from '@/types/user';

type SingleResponse<T> = {
  data?: T;
  error?: string;
};

type ListResponse<T> = {
  data?: T[];
  error?: string;
};

export default function ActivityDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const activityId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [activity, setActivity] = useState<Activity | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [localPrice, setLocalPrice] = useState('0');
  const [foreignPrice, setForeignPrice] = useState('0');
  const [imageUrl, setImageUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!activityId) {
        setError('Invalid activity ID');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [activityResponse, categoriesResponse, vendorsResponse] = await Promise.all([
          fetch(`/api/activities/${activityId}`, {
            method: 'GET',
            cache: 'no-store',
          }),
          fetch('/api/categories?include_inactive=true&limit=500', {
            method: 'GET',
            cache: 'no-store',
          }),
          fetch('/api/admin/users?role=vendor&limit=500', {
            method: 'GET',
            cache: 'no-store',
          }),
        ]);

        const activityPayload = (await activityResponse.json()) as SingleResponse<Activity>;
        const categoriesPayload = (await categoriesResponse.json()) as ListResponse<Category>;
          const vendorsPayload = (await vendorsResponse.json()) as ListResponse<User>;

        if (!activityResponse.ok || !activityPayload.data) {
          if (!active) return;
          setError(activityPayload.error ?? 'Unable to load activity');
          setActivity(null);
          return;
        }

        if (!active) return;

        setActivity(activityPayload.data);
        setCategories(categoriesPayload.data ?? []);
          setVendors(vendorsPayload.data ?? []);
          setVendorId(activityPayload.data.vendor_id ?? '');
        setName(activityPayload.data.name);
        setDescription(activityPayload.data.description ?? '');
        setCategoryId(activityPayload.data.category_id ?? '');
        setLocalPrice(String(activityPayload.data.local_price));
        setForeignPrice(String(activityPayload.data.foreign_price));
        setImageUrl(activityPayload.data.image_url ?? '');
        setDisplayOrder(String(activityPayload.data.display_order));
        setIsActive(activityPayload.data.is_active);
      } catch {
        if (!active) return;
        setError('Unable to load activity');
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [activityId]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[980px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase 9</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Edit Activity</h1>
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

        {!isLoading && activity ? (
          <form
            className="mt-5 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();

              if (!activityId) {
                return;
              }

              setIsSubmitting(true);
              setError(null);

              try {
                const response = await fetch(`/api/activities/${activityId}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    name,
                    description: description.trim() || '',
                    category_id: categoryId || null,
                    vendor_id: vendorId || null,
                    local_price: Number(localPrice),
                    foreign_price: Number(foreignPrice),
                    image_url: imageUrl.trim() || null,
                    display_order: Number(displayOrder),
                    is_active: isActive,
                  }),
                });

                const payload = (await response.json()) as SingleResponse<Activity>;

                if (!response.ok || !payload.data) {
                  setError(payload.error ?? 'Failed to update activity');
                  return;
                }

                setActivity(payload.data);
                router.refresh();
              } catch {
                setError('Failed to update activity');
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
                <label className="mb-1 block text-sm font-medium text-slate-700">Vendor</label>
                <select
                  value={vendorId}
                  onChange={(event) => setVendorId(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option value="">No vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.display_name} ({vendor.email})
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

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={async () => {
                  if (!activityId || !activity) return;

                  const confirmed = window.confirm(`Delete ${activity.name}?`);

                  if (!confirmed) {
                    return;
                  }

                  setIsDeleting(true);
                  setError(null);

                  try {
                    const response = await fetch(`/api/activities/${activityId}`, {
                      method: 'DELETE',
                    });

                    if (!response.ok) {
                      const payload = (await response.json().catch(() => ({}))) as { error?: string };
                      setError(payload.error ?? 'Failed to delete activity');
                      return;
                    }

                    router.push('/admin/activities');
                    router.refresh();
                  } catch {
                    setError('Failed to delete activity');
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Activity'}
              </Button>
            </div>
          </form>
        ) : null}
      </section>
    </main>
  );
}



