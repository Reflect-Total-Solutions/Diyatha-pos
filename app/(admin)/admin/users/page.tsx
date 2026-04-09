'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { User, UserRole } from '@/types/user';

type ListResponse<T> = {
  data?: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  error?: string;
};

function buildListQuery(options: {
  page: number;
  limit: number;
  query?: string;
  role?: UserRole;
  isActive?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set('page', String(options.page));
  params.set('limit', String(options.limit));

  if (options.query) {
    params.set('q', options.query);
  }

  if (options.role) {
    params.set('role', options.role);
  }

  if (options.isActive !== undefined) {
    params.set('is_active', String(options.isActive));
  }

  return params.toString();
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filters = useMemo(() => {
    return {
      page,
      limit,
      query: search || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter,
      isActive:
        statusFilter === 'active'
          ? true
          : statusFilter === 'inactive'
            ? false
            : undefined,
    };
  }, [limit, page, roleFilter, search, statusFilter]);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users?${buildListQuery(filters)}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = (await response.json()) as ListResponse<User>;

      if (!response.ok) {
        setUsers([]);
        setError(payload.error ?? 'Unable to load users');
        return;
      }

      setUsers(payload.data ?? []);
      setTotal(payload.total ?? 0);
      setPage(payload.page ?? filters.page);
      setLimit(payload.limit ?? filters.limit);
      setTotalPages(payload.totalPages ?? 0);
    } catch {
      setUsers([]);
      setError('Unable to load users');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phase 8</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">User Management</h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage admin and cashier accounts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/reports"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Reports
            </Link>
            <Link
              href="/admin/users/new"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              Create User
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-5">
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name or email"
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-slate-500 lg:col-span-2"
          />

          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as 'all' | UserRole);
              setPage(1);
            }}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-slate-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="cashier">Cashier</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as 'all' | 'active' | 'inactive');
              setPage(1);
            }}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-slate-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPage(1);
              setSearch(searchInput.trim());
            }}
            disabled={isLoading}
          >
            Search
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
                <th className="px-3 py-2 text-left font-medium text-slate-600">Name</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Email</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Role</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Created</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-2 text-slate-800">{user.display_name}</td>
                  <td className="px-3 py-2 text-slate-800">{user.email}</td>
                  <td className="px-3 py-2 text-slate-800 capitalize">{user.role}</td>
                  <td className="px-3 py-2 text-slate-800">{user.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2 text-slate-800">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}

              {!isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
          <p>
            {isLoading
              ? 'Loading users...'
              : `Showing page ${page} of ${totalPages || 1}. Total users: ${total}`}
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              disabled={isLoading || page >= Math.max(totalPages, 1)}
              onClick={() => setPage((current) => Math.min(Math.max(totalPages, 1), current + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
