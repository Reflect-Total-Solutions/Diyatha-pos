'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { User } from '@/types/user';

type AuthSession = {
  access_token: string;
  expires_at: number;
};

type MeResponse = {
  data?: {
    user: User;
    session: AuthSession | null;
  };
  error?: string;
};

type LoginParams = {
  email: string;
  password: string;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        setUser(null);
        setSession(null);
        setError(null);
        return;
      }

      const payload = (await response.json()) as MeResponse;
      setUser(payload.data?.user ?? null);
      setSession(payload.data?.session ?? null);
      setError(null);
    } catch {
      setError('Unable to load session details.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async ({ email, password }: LoginParams) => {
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as {
        data?: {
          user: User;
          session: AuthSession | null;
        };
        error?: string;
      };

      if (!response.ok || !payload.data?.user) {
        setError(payload.error ?? 'Invalid credentials');
        return false;
      }

      setUser(payload.data.user);
      setSession(payload.data.session ?? null);
      return true;
    } catch {
      setError('Login failed. Please try again.');
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? 'Logout failed');
        return false;
      }

      setUser(null);
      setSession(null);
      return true;
    } catch {
      setError('Logout failed. Please try again.');
      return false;
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    error,
    refresh,
    login,
    logout,
  };
}
