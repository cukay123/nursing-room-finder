/**
 * API route: Submit a new nursing room for crowdsourcing
 * POST /api/submit-venue
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { clientKey, rateLimit } from '@/lib/rate-limit';

// Generous enough that a parent adding the few rooms they know will never notice,
// tight enough that a script cannot fill the moderation queue unattended.
const SUBMIT_LIMIT = 5;
const SUBMIT_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { allowed, retryAfter } = rateLimit(
      `submit-venue:${clientKey(req)}`,
      SUBMIT_LIMIT,
      SUBMIT_WINDOW_MS
    );

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const body = await req.json();

    const {
      name,
      postalCode,
      floorLevel,
      latitude,
      longitude,
      hasLock,
      hasChangingTable,
      hasSink,
      hasPowerOutlet,
      strollerFriendly,
      dadFriendly,
      hasDiaperMat,
      canBuyDiaper,
      notes,
      locationSource,
    } = body;

    // The map's fallback centre. Submissions used to arrive carrying it whenever
    // GPS had not resolved, which pinned rooms to the middle of the island. The
    // client now geocodes the building name instead; this rejects anything still
    // sending the default, so a stale client fails loudly rather than silently.
    const DEFAULT_LAT = 1.3521;
    const DEFAULT_LNG = 103.8198;

    if (latitude === DEFAULT_LAT && longitude === DEFAULT_LNG) {
      return NextResponse.json(
        {
          error:
            'Could not determine where this room is. Turn on location and submit while you are there, or use the full building name.',
        },
        { status: 400 }
      );
    }

    if (!name || !latitude || !longitude) {
      const missing = [];
      if (!name) missing.push('Building Name');
      if (!latitude) missing.push('Latitude');
      if (!longitude) missing.push('Longitude');
      return NextResponse.json(
        { error: `Missing: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Create submission record.
    // No .select() here: migration 007 revoked anon SELECT on submissions, and
    // reading the row back would need it. The client only reads this response on
    // failure, so there is nothing to return.
    const { error } = await supabase
      .from('submissions')
      .insert({
        submitted_by: null, // Anonymous for now
        status: 'pending',
        payload: {
          name,
          postalCode,
          floorLevel,
          type: 'Nursing Room',
          latitude,
          longitude,
          amenities: {
            has_lock: hasLock,
            has_changing_table: hasChangingTable,
            has_sink: hasSink,
            has_power_outlet: hasPowerOutlet,
            stroller_friendly: strollerFriendly,
            dad_friendly: dadFriendly,
            has_diaper_mat: hasDiaperMat,
            can_buy_diaper: canBuyDiaper,
          },
          notes,
          source: 'USER_SUBMITTED',
          // 'gps' means the submitter was standing there; 'geocoded' means the
          // position came from looking up the name they typed. Worth surfacing
          // to whoever reviews it.
          locationSource: locationSource === 'gps' ? 'gps' : 'geocoded',
        },
      });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Venue submitted successfully',
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
