/**
 * API route: record whether a nursing room is still there and accurate
 * POST /api/confirm-venue  { venueId, stillThere, notes? }
 *
 * Writes through the service role: anon has no INSERT on confirmations, and the
 * original RLS policy requires auth.uid() = user_id, which anonymous reporters
 * cannot satisfy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { clientKey, rateLimit } from '@/lib/rate-limit';

// Higher than submissions: confirming rooms is the cheap, useful action we want
// people doing, and each one is a single row.
const CONFIRM_LIMIT = 20;
const CONFIRM_WINDOW_MS = 10 * 60 * 1000;

const MAX_NOTES_LENGTH = 500;

export async function POST(req: NextRequest) {
  try {
    const { allowed, retryAfter } = rateLimit(
      `confirm-venue:${clientKey(req)}`,
      CONFIRM_LIMIT,
      CONFIRM_WINDOW_MS
    );

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many reports. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const { venueId, stillThere, notes } = await req.json();

    if (typeof venueId !== 'string' || !venueId) {
      return NextResponse.json({ error: 'Missing venueId' }, { status: 400 });
    }

    if (typeof stillThere !== 'boolean') {
      return NextResponse.json(
        { error: 'stillThere must be true or false' },
        { status: 400 }
      );
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set — cannot record confirmation');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    const { error } = await supabase.from('confirmations').insert({
      venue_id: venueId,
      user_id: null, // anonymous
      still_there: stillThere,
      notes: typeof notes === 'string' ? notes.trim().slice(0, MAX_NOTES_LENGTH) || null : null,
    });

    if (error) {
      console.error('Confirmation insert failed:', error);
      // A bad venueId trips the foreign key; that is the caller's fault, not ours.
      const isBadVenue = error.code === '23503';
      return NextResponse.json(
        { error: isBadVenue ? 'Unknown venue' : 'Could not record your report' },
        { status: isBadVenue ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
