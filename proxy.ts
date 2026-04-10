import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/middleware';

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function needsAuth(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/transactions') ||
    pathname.startsWith('/api/print') ||
    pathname.startsWith('/api/reports')
  );
}

function needsAdmin(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
}

export default async function proxy(request: NextRequest) {
  const { response: supabaseResponse, user, userRole } = await createClient(request);
  const { pathname } = request.nextUrl;

  if (!needsAuth(pathname)) {
    return supabaseResponse;
  }

  if (!user) {
    if (isApiRequest(pathname)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = userRole ?? user.app_metadata?.role ?? user.user_metadata?.role;

  if (needsAdmin(pathname) && role !== 'admin') {
    if (isApiRequest(pathname)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
