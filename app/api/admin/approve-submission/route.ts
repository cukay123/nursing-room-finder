/**
 * API route: Approve a submission and create venue
 * POST /api/admin/approve-submission
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { submissionId, action, payload: editedPayload } = await req.json();

    if (!submissionId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Missing submissionId or invalid action' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (action === 'reject') {
      // Just mark as rejected
      const { error } = await supabase
        .from('submissions')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', submissionId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Submission rejected' });
    }

    // APPROVE: Get submission and create venue
    const { data: submission, error: fetchError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Use edited payload if provided, otherwise use original
    const payload = editedPayload || submission.payload;

    // Create venue
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .insert({
        name: payload.name,
        type: payload.type || 'Nursing Room',
        address: payload.address || null,
        postal_code: payload.postalCode || null,
        location: `POINT(${payload.longitude} ${payload.latitude})`,
        source: payload.source || 'USER_SUBMITTED',
      })
      .select()
      .single();

    if (venueError) {
      console.error('Venue creation error:', venueError);
      return NextResponse.json(
        { error: `Failed to create venue: ${venueError.message}` },
        { status: 500 }
      );
    }

    // Create room details
    const amenities = payload.amenities || {};
    const { error: detailsError } = await supabase
      .from('room_details')
      .insert({
        venue_id: venue.id,
        floor_level: payload.floorLevel || null,
        has_lock: amenities.has_lock || false,
        has_changing_table: amenities.has_changing_table || false,
        has_sink: amenities.has_sink || false,
        has_power_outlet: amenities.has_power_outlet || false,
        stroller_friendly: amenities.stroller_friendly || false,
        dad_friendly: amenities.dad_friendly || false,
        has_diaper_mat: amenities.has_diaper_mat || false,
        can_buy_diaper: amenities.can_buy_diaper || false,
        notes: payload.notes || null,
      });

    if (detailsError) {
      console.error('Room details creation error:', detailsError);
      return NextResponse.json(
        { error: `Failed to create room details: ${detailsError.message}` },
        { status: 500 }
      );
    }

    // Mark submission as approved
    const { error: updateError } = await supabase
      .from('submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', submissionId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Submission approved and venue created',
      venueId: venue.id,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
