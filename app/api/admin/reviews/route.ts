/**
 * API route: review moderation
 *
 * GET   /api/admin/reviews          list recent reviews, visible and hidden
 * PATCH /api/admin/reviews          { reviewId, status: 'visible' | 'hidden' }
 *
 * Gated by proxy.ts along with the rest of /api/admin.
 *
 * Hiding rather than deleting: a hidden review disappears from the public API
 * (the RLS policy only exposes `visible`) but survives, so a moderation mistake
 * is reversible and a pattern of abuse stays inspectable.
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

export async function GET() {
  try {
    const { data, error } = await adminClient()
      .from('reviews')
      .select('id, venue_id, rating, comment, status, created_at, venues(name)')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      console.error('Admin review fetch failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reviews: data ?? [] });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { reviewId, status } = await req.json();

    if (typeof reviewId !== 'string' || !reviewId) {
      return NextResponse.json({ error: 'Missing reviewId' }, { status: 400 });
    }

    if (status !== 'visible' && status !== 'hidden') {
      return NextResponse.json(
        { error: "status must be 'visible' or 'hidden'" },
        { status: 400 }
      );
    }

    const { error } = await adminClient()
      .from('reviews')
      .update({ status })
      .eq('id', reviewId);

    if (error) {
      console.error('Admin review update failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
