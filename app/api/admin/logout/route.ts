/**
 * API route: clear the admin session
 * POST /api/admin/logout
 */

import { NextResponse } from 'next/server';

import { SESSION_COOKIE } from '@/lib/admin-auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
