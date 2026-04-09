'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { User, UserRole } from '@/types/user';

type UserFormMode = 'create' | 'edit';

type UserFormValues = {
  email: string;
  display_name: string;
  role: UserRole;
  phone: string;
  is_active: boolean;
  password: string;
};

type UserFormSubmitValues = {
  email: string;
  display_name: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  password?: string;
};

type UserFormProps = {
  mode: UserFormMode;
  initialUser?: Partial<User>;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  submitLabel?: string;
  cancelHref?: string;
  onSubmit: (values: UserFormSubmitValues) => void | Promise<void>;
};

function getInitialValues(mode: UserFormMode, initialUser?: Partial<User>): UserFormValues {
  return {
    email: initialUser?.email ?? '',
    display_name: initialUser?.display_name ?? '',
    role: initialUser?.role ?? 'cashier',
    phone: initialUser?.phone ?? '',
    is_active: initialUser?.is_active ?? true,
    password: mode === 'create' ? '' : '********',
  };
}

export default function UserForm({
  mode,
  initialUser,
  isSubmitting = false,
  errorMessage,
  submitLabel,
  cancelHref = '/admin/users',
  onSubmit,
}: UserFormProps) {
  const [formValues, setFormValues] = useState<UserFormValues>(() =>
    getInitialValues(mode, initialUser)
  );

  useEffect(() => {
    setFormValues(getInitialValues(mode, initialUser));
  }, [initialUser, mode]);

  const label = submitLabel ?? (mode === 'create' ? 'Create User' : 'Save Changes');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      email: formValues.email,
      display_name: formValues.display_name,
      role: formValues.role,
      phone: formValues.phone.trim() || undefined,
      is_active: formValues.is_active,
      password: mode === 'create' ? formValues.password : undefined,
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="display_name">
            Display Name
          </label>
          <input
            id="display_name"
            type="text"
            required
            value={formValues.display_name}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                display_name: event.target.value,
              }))
            }
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-slate-500"
            placeholder="Cashier Name"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={formValues.email}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                email: event.target.value,
              }))
            }
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-slate-500"
            placeholder="cashier@example.com"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="role">
            Role
          </label>
          <select
            id="role"
            value={formValues.role}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                role: event.target.value as UserRole,
              }))
            }
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-slate-500"
          >
            <option value="cashier">Cashier</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="phone">
            Phone (optional)
          </label>
          <input
            id="phone"
            type="text"
            value={formValues.phone}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                phone: event.target.value,
              }))
            }
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-slate-500"
            placeholder="0771234567"
          />
        </div>

        {mode === 'create' ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={formValues.password}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-slate-500"
              placeholder="Minimum 8 characters"
            />
          </div>
        ) : null}
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={formValues.is_active}
          onChange={(event) =>
            setFormValues((current) => ({
              ...current,
              is_active: event.target.checked,
            }))
          }
          className="h-4 w-4 rounded border-slate-300"
        />
        Active account
      </label>

      {errorMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : label}
        </Button>

        <Link
          href={cancelHref}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
