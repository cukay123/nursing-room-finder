/**
 * API route: reported problems with existing rooms
 *
 * GET   /api/admin/reports?includeResolved=true   open reports, newest first
 * PATCH /api/admin/reports  { reportId, resolved, note? }
 *
 * These are the negative confirmations written by the "No" button and Report
 * Issue on a venue card. Gated by proxy.ts along with the rest of /api/admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 100;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  try {
    const includeResolved = req.nextUrl.searchParams.get('includeResolved') === 'true';

    let query = adminClient()
      .from('confirmations')
      .select('id, venue_id, notes, created_at, resolved_at, resolution_note, venues(name, address)')
      .eq('still_there', false)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!includeResolved) {
      query = query.is('resolved_at', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Admin report fetch failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reports: data ?? [] });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { reportId, resolved, note } = await req.json();

    if (typeof reportId !== 'string' || !reportId) {
      return NextResponse.json({ error: 'Missing reportId' }, { status: 400 });
    }

    if (typeof resolved !== 'boolean') {
      return NextResponse.json(
        { error: 'resolved must be true or false' },
        { status: 400 }
      );
    }

    const { error } = await adminClient()
      .from('confirmations')
      .update({
        resolved_at: resolved ? new Date().toISOString() : null,
        resolution_note: resolved && typeof note === 'string' ? note.trim().slice(0, 500) || null : null,
      })
      .eq('id', reportId);

    if (error) {
      console.error('Admin report update failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
