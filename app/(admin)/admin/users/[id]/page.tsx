'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import UserForm from '@/components/admin/UserForm';
import { Button } from '@/components/ui/button';
import type { User } from '@/types/user';

type SingleResponse<T> = {
  data?: T;
  error?: string;
};

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    if (!userId) {
      setErrorMessage('Invalid user ID');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as SingleResponse<User>;

      if (!response.ok || !payload.data) {
        setUser(null);
        setErrorMessage(payload.error ?? 'Unable to load user');
        return;
      }

      setUser(payload.data);
    } catch {
      setUser(null);
      setErrorMessage('Unable to load user');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-[980px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Loading user...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[980px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase 8</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">User Detail</h1>
            <p className="mt-1 text-sm text-slate-600">
              Update account details and permissions.
            </p>
          </div>

          <Link
            href="/admin/users"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Back to users
          </Link>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {notice ? (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </p>
        ) : null}

        {user ? (
          <div className="mt-5 space-y-4">
            <UserForm
              mode="edit"
              initialUser={user}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              submitLabel="Update User"
              onSubmit={async (values) => {
                if (!userId) {
                  return;
                }

                setIsSubmitting(true);
                setErrorMessage(null);
                setNotice(null);

                try {
                  const response = await fetch(`/api/admin/users/${userId}`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(values),
                  });

                  const payload = (await response.json()) as SingleResponse<User>;

                  if (!response.ok || !payload.data) {
                    setErrorMessage(payload.error ?? 'Failed to update user');
                    return;
                  }

                  setUser(payload.data);
                  setNotice('User updated successfully.');
                  router.refresh();
                } catch {
                  setErrorMessage('Failed to update user');
                } finally {
                  setIsSubmitting(false);
                }
              }}
            />

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h2 className="text-sm font-semibold text-amber-800">Danger Zone</h2>
              <p className="mt-1 text-sm text-amber-700">
                Deleting a user removes their authentication account and profile permanently.
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isDeleting}
                  onClick={async () => {
                    if (!userId) {
                      return;
                    }

                    const confirmed = window.confirm(
                      `Delete user ${user.email}? This action cannot be undone.`
                    );

                    if (!confirmed) {
                      return;
                    }

                    setIsDeleting(true);
                    setErrorMessage(null);

                    try {
                      const response = await fetch(`/api/admin/users/${userId}`, {
                        method: 'DELETE',
                      });

                      if (!response.ok) {
                        const payload = (await response.json().catch(() => ({}))) as { error?: string };
                        setErrorMessage(payload.error ?? 'Failed to delete user');
                        return;
                      }

                      router.push('/admin/users');
                      router.refresh();
                    } catch {
                      setErrorMessage('Failed to delete user');
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete User'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
