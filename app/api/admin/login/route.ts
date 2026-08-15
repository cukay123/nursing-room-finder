/**
 * API route: exchange the admin password for a session cookie
 * POST /api/admin/login  { password }
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSessionToken,
  verifyPassword,
} from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  try {
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
      return NextResponse.json(
        { error: 'Admin access is not configured' },
        { status: 503 }
      );
    }

    const { password: submitted } = await req.json();

    if (typeof submitted !== 'string' || !(await verifyPassword(submitted, password))) {
      // Deliberately vague, and no distinction between "empty" and "wrong".
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set(SESSION_COOKIE, await createSessionToken(password), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    });

    return response;
  } catch (err) {
    console.error('Admin login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
