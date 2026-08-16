/**
 * API route: read and write venue reviews
 *
 * GET  /api/reviews?venueId=...   list visible reviews, newest first
 * POST /api/reviews               { venueId, rating, comment? }
 *
 * Writes go through the service role: anon has no INSERT on reviews, so posting
 * can be validated and rate-limited here rather than trusted from the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { clientKey, rateLimit } from '@/lib/rate-limit';

const REVIEW_LIMIT = 3;
const REVIEW_WINDOW_MS = 60 * 60 * 1000;

const MAX_COMMENT_LENGTH = 1000;
const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  try {
    const venueId = req.nextUrl.searchParams.get('venueId');

    if (!venueId) {
      return NextResponse.json({ error: 'Missing venueId' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // The RLS policy already restricts this to visible rows; the filter is here
    // so the intent is readable without cross-referencing the migration.
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at')
      .eq('venue_id', venueId)
      .eq('status', 'visible')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      console.error('Review fetch failed:', error);
      return NextResponse.json({ error: 'Could not load reviews' }, { status: 500 });
    }

    return NextResponse.json({ reviews: data ?? [] });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { allowed, retryAfter } = rateLimit(
      `reviews:${clientKey(req)}`,
      REVIEW_LIMIT,
      REVIEW_WINDOW_MS
    );

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many reviews. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const { venueId, rating, comment } = await req.json();

    if (typeof venueId !== 'string' || !venueId) {
      return NextResponse.json({ error: 'Missing venueId' }, { status: 400 });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be a whole number from 1 to 5' },
        { status: 400 }
      );
    }

    const trimmed = typeof comment === 'string' ? comment.trim() : '';
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set — cannot record review');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    const { error } = await supabase.from('reviews').insert({
      venue_id: venueId,
      user_id: null,
      rating,
      comment: trimmed || null,
    });

    if (error) {
      console.error('Review insert failed:', error);
      const isBadVenue = error.code === '23503';
      return NextResponse.json(
        { error: isBadVenue ? 'Unknown venue' : 'Could not save your review' },
        { status: isBadVenue ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
