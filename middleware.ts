import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ACCESS_TOKEN_COOKIE_NAMES = [
  'pc_access_token',
  'access_token',
  'sb-access-token',
  'sb:token',
] as const;

function getAccessToken(request: NextRequest): string | null {
  for (const cookieName of ACCESS_TOKEN_COOKIE_NAMES) {
    const token = request.cookies.get(cookieName)?.value;
    if (token) return token;
  }

  return null;
}

function decodeJwtRole(token: string | null): string | null {
  if (!token) return null;

  const segments = token.split('.');
  if (segments.length !== 3) return null;

  try {
    const base64Payload = segments[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64Payload.length % 4)) % 4);
    const decodedPayload = atob(base64Payload + padding);
    const payload = JSON.parse(decodedPayload) as {
      app_metadata?: { role?: string };
      user_metadata?: { role?: string };
    };

    return payload.app_metadata?.role ?? payload.user_metadata?.role ?? null;
  } catch {
    return null;
  }
}

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!needsAuth(pathname)) {
    return NextResponse.next();
  }

  const token = getAccessToken(request);

  if (!token) {
    if (isApiRequest(pathname)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (needsAdmin(pathname) && decodeJwtRole(token) !== 'admin') {
    if (isApiRequest(pathname)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
