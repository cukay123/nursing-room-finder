/**
 * API route: reported problems with existing rooms
 *
 * GET   /api/admin/reports?includeResolved=true
 * PATCH /api/admin/reports  { reportId, action: 'keep' | 'remove' | 'restore', reason? }
 *
 * These are the negative confirmations written by the "No" button and Report
 * Issue on a venue card. Gated by proxy.ts along with the rest of /api/admin.
 *
 * Handling a report is a decision, not just an acknowledgement:
 *
 *   keep    — checked it, the room is fine. Closes the report, map unchanged.
 *   remove  — the room is genuinely gone. Takes it off the map and closes every
 *             open report against it, since they were all about the same thing.
 *   restore — puts a removed room back.
 *
 * Removal is a soft delete (venues.removed_at). See migration 011 for why.
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
      .select(
        'id, venue_id, notes, created_at, resolved_at, resolution_note, ' +
          'venues(name, address, removed_at)'
      )
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
    const { reportId, action, reason } = await req.json();

    if (typeof reportId !== 'string' || !reportId) {
      return NextResponse.json({ error: 'Missing reportId' }, { status: 400 });
    }

    if (!['keep', 'remove', 'restore'].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'keep', 'remove' or 'restore'" },
        { status: 400 }
      );
    }

    const supabase = adminClient();

    const { data: report, error: fetchError } = await supabase
      .from('confirmations')
      .select('id, venue_id')
      .eq('id', reportId)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const trimmedReason =
      typeof reason === 'string' ? reason.trim().slice(0, 500) || null : null;

    if (action === 'restore') {
      const { error } = await supabase
        .from('venues')
        .update({ removed_at: null, removed_reason: null })
        .eq('id', report.venue_id);

      if (error) {
        console.error('Venue restore failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, restored: true });
    }

    if (action === 'remove') {
      const { error: removeError } = await supabase
        .from('venues')
        .update({ removed_at: new Date().toISOString(), removed_reason: trimmedReason })
        .eq('id', report.venue_id);

      if (removeError) {
        console.error('Venue removal failed:', removeError);
        return NextResponse.json({ error: removeError.message }, { status: 500 });
      }

      // Every open report on this room was about the same problem, so close them
      // all rather than leaving duplicates behind for a room that is now gone.
      const { error: closeError } = await supabase
        .from('confirmations')
        .update({
          resolved_at: new Date().toISOString(),
          resolution_note: trimmedReason
            ? `Removed from map: ${trimmedReason}`
            : 'Removed from map',
        })
        .eq('venue_id', report.venue_id)
        .eq('still_there', false)
        .is('resolved_at', null);

      if (closeError) {
        console.error('Closing reports after removal failed:', closeError);
        return NextResponse.json({ error: closeError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, removed: true });
    }

    // keep
    const { error } = await supabase
      .from('confirmations')
      .update({
        resolved_at: new Date().toISOString(),
        resolution_note: trimmedReason
          ? `Kept on map: ${trimmedReason}`
          : 'Checked — room is still accurate',
      })
      .eq('id', reportId);

    if (error) {
      console.error('Admin report update failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, kept: true });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
