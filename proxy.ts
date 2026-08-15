/**
 * Gate for the admin surface.
 *
 * Covers both the page at /admin and the API routes under /api/admin, because the
 * routes are the part that actually matters: they run on SUPABASE_SERVICE_ROLE_KEY,
 * which bypasses RLS entirely. Protecting only the page would leave the data wide
 * open to anyone issuing a direct request.
 *
 * Note this is Proxy, not Middleware — renamed in Next 16, same functionality.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { SESSION_COOKIE, verifySessionToken } from '@/lib/admin-auth';

// Reachable without a session, or there would be no way to obtain one.
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/api/admin/login', '/api/admin/logout'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const password = process.env.ADMIN_PASSWORD;
  const isApiRoute = pathname.startsWith('/api/');

  // Fail closed. An unset password must never mean "no gate" — that is exactly
  // the state this whole change exists to fix.
  if (!password) {
    console.error('ADMIN_PASSWORD is not set — refusing all access to the admin surface');
    return isApiRoute
      ? NextResponse.json({ error: 'Admin access is not configured' }, { status: 503 })
      : new NextResponse(
          'Admin access is not configured. Set ADMIN_PASSWORD and restart.',
          { status: 503, headers: { 'content-type': 'text/plain' } }
        );
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, password)) {
    return NextResponse.next();
  }

  if (isApiRoute) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/admin/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
