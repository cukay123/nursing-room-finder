/**
 * API route: act on a crowdsourced submission
 * POST /api/admin/approve-submission
 *   { submissionId, action: 'approve' | 'reject', payload?, targetVenueId? }
 *
 * `approve` without targetVenueId creates a new venue.
 * `approve` with targetVenueId merges the submission into an existing room —
 * for when someone is adding detail to a place already on the map rather than
 * reporting a new one. Without that, approving produced a duplicate pin metres
 * from the original.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type Amenities = Record<string, boolean | undefined>;

const AMENITY_KEYS = [
  'has_lock',
  'has_changing_table',
  'has_sink',
  'has_power_outlet',
  'stroller_friendly',
  'dad_friendly',
  'has_diaper_mat',
  'can_buy_diaper',
] as const;

export async function POST(req: NextRequest) {
  try {
    const {
      submissionId,
      action,
      payload: editedPayload,
      targetVenueId,
    } = await req.json();

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
      const { error } = await supabase
        .from('submissions')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', submissionId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Submission rejected' });
    }

    const { data: submission, error: fetchError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Use edited payload if provided, otherwise use original
    const payload = editedPayload || submission.payload;
    const amenities: Amenities = payload.amenities || {};

    if (targetVenueId) {
      return mergeIntoVenue({ submissionId, targetVenueId, payload, amenities });
    }

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

    const { error: detailsError } = await supabase.from('room_details').insert({
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

    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        venue_id: venue.id,
      })
      .eq('id', submissionId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Submission approved and venue created',
      venueId: venue.id,
      created: true,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Fold a submission into an existing room.
 *
 * The merge is deliberately additive, because the two sides are not equally
 * trustworthy in the same ways:
 *
 * - **Amenities only ever turn on.** An unticked box in the public form means
 *   "did not tick", not "verified absent" — the toggles all start off. Letting
 *   an untouched toggle clear a curated `true` would quietly delete information
 *   nobody intended to contradict.
 * - **Name, address and coordinates are never overwritten.** The existing row
 *   has been curated and geocoded; a submission's position is wherever the
 *   phone happened to be standing.
 * - **Floor level fills a blank, never replaces one.** If both exist and differ,
 *   the new value goes into the notes instead of destroying the old one — a mall
 *   can have two rooms on different levels.
 * - **Notes are appended, never replaced.**
 */
async function mergeIntoVenue({
  submissionId,
  targetVenueId,
  payload,
  amenities,
}: {
  submissionId: string;
  targetVenueId: string;
  payload: Record<string, unknown>;
  amenities: Amenities;
}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('id, name')
    .eq('id', targetVenueId)
    .single();

  if (venueError || !venue) {
    return NextResponse.json({ error: 'Target room not found' }, { status: 404 });
  }

  const { data: existing, error: detailsFetchError } = await supabase
    .from('room_details')
    .select('*')
    .eq('venue_id', targetVenueId)
    .maybeSingle();

  if (detailsFetchError) {
    console.error('Merge lookup failed:', detailsFetchError);
    return NextResponse.json({ error: detailsFetchError.message }, { status: 500 });
  }

  const submittedFloor =
    typeof payload.floorLevel === 'string' ? payload.floorLevel.trim() : '';
  const submittedNotes =
    typeof payload.notes === 'string' ? payload.notes.trim() : '';

  const existingFloor = (existing?.floor_level as string | null)?.trim() ?? '';
  const existingNotes = (existing?.notes as string | null)?.trim() ?? '';

  // A differing floor is new information, not a correction — keep both.
  const floorConflict =
    submittedFloor && existingFloor && submittedFloor !== existingFloor;

  const noteAdditions = [
    submittedNotes,
    floorConflict ? `Also reported at: ${submittedFloor}` : '',
  ].filter(Boolean);

  const mergedNotes = [existingNotes, ...noteAdditions].filter(Boolean).join(' · ');

  const merged: Record<string, unknown> = {
    venue_id: targetVenueId,
    floor_level: existingFloor || submittedFloor || null,
    notes: mergedNotes || null,
  };

  for (const key of AMENITY_KEYS) {
    // Additive: existing true stays true, submitted true turns it on.
    merged[key] = Boolean(existing?.[key]) || Boolean(amenities[key]);
  }

  const { error: upsertError } = await supabase
    .from('room_details')
    .upsert(merged, { onConflict: 'venue_id' });

  if (upsertError) {
    console.error('Merge failed:', upsertError);
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('submissions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      venue_id: targetVenueId,
    })
    .eq('id', submissionId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `Merged into ${venue.name}`,
    venueId: targetVenueId,
    merged: true,
  });
}
