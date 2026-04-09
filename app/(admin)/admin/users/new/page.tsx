'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import UserForm from '@/components/admin/UserForm';
import type { User } from '@/types/user';

type SingleResponse<T> = {
  data?: T;
  error?: string;
};

export default function CreateUserPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[980px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase 8</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Create User</h1>
            <p className="mt-1 text-sm text-slate-600">
              Add a new admin or cashier account.
            </p>
          </div>

          <Link
            href="/admin/users"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Back to users
          </Link>
        </div>

        <div className="mt-5">
          <UserForm
            mode="create"
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            onSubmit={async (values) => {
              setIsSubmitting(true);
              setErrorMessage(null);

              try {
                const response = await fetch('/api/admin/users', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(values),
                });

                const payload = (await response.json()) as SingleResponse<User>;

                if (!response.ok || !payload.data) {
                  setErrorMessage(payload.error ?? 'Failed to create user');
                  return;
                }

                router.push(`/admin/users/${payload.data.id}`);
                router.refresh();
              } catch {
                setErrorMessage('Failed to create user');
              } finally {
                setIsSubmitting(false);
              }
            }}
          />
        </div>
      </section>
    </main>
  );
}
