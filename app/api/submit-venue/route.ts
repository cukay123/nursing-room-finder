/**
 * API route: Submit a new nursing room for crowdsourcing
 * POST /api/submit-venue
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
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
    } = body;

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

    // Create submission record
    const { data, error } = await supabase
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
        },
      })
      .select();

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
      data,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
