/**
 * API route: existing rooms a submission might be about
 *
 * GET /api/admin/submission-matches?submissionId=...
 *
 * Most submissions for a place already on the map are not new rooms — they are
 * someone adding detail to one that exists. Approving those blindly creates a
 * duplicate pin a few metres from the original, so the admin needs to see the
 * candidates before deciding.
 *
 * Gated by proxy.ts along with the rest of /api/admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Generous enough to catch a large mall where the submitter stood at a different
// entrance than the recorded centroid.
const MATCH_RADIUS_METRES = 600;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Strip punctuation and common mall words so "JEM" matches "Jem Shopping Mall". */
function normalise(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(shopping|centre|center|mall|the|at|plaza)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dice coefficient over character bigrams: cheap, and forgiving of typos. */
function nameSimilarity(a: string, b: string) {
  const x = normalise(a);
  const y = normalise(b);
  if (!x || !y) return 0;
  if (x === y) return 1;

  const bigrams = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
  };

  const bx = bigrams(x);
  const by = bigrams(y);
  let shared = 0;

  for (const [g, count] of bx) {
    const other = by.get(g);
    if (other) shared += Math.min(count, other);
  }

  const total = [...bx.values()].reduce((s, n) => s + n, 0) +
    [...by.values()].reduce((s, n) => s + n, 0);

  return total === 0 ? 0 : (2 * shared) / total;
}

export async function GET(req: NextRequest) {
  try {
    const submissionId = req.nextUrl.searchParams.get('submissionId');

    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 });
    }

    const supabase = adminClient();

    const { data: submission, error: fetchError } = await supabase
      .from('submissions')
      .select('id, payload')
      .eq('id', submissionId)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const payload = submission.payload ?? {};
    const lat = Number(payload.latitude);
    const lng = Number(payload.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ matches: [] });
    }

    // Reuse the geo query the map already relies on.
    const { data: nearby, error: rpcError } = await supabase.rpc('nearest_venues', {
      user_lat: lat,
      user_lng: lng,
      radius_meters: MATCH_RADIUS_METRES,
    });

    if (rpcError) {
      console.error('Match lookup failed:', rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    const submittedName = String(payload.name ?? '');

    // Proximity alone is not enough. A submission made away from the room — or
    // before GPS resolved, which falls back to the middle of Singapore — carries
    // coordinates nowhere near the place it describes.
    //
    // An ilike prefilter does not rescue it either: "Millenia walk" never matches
    // "Millennia Walk". So score every room by name similarity instead. At this
    // dataset's size (under a hundred rooms) that is a trivial scan; past a few
    // thousand it would want a trigram index.
    const { data: allVenues } = await supabase
      .from('venues')
      .select('id, name, address')
      .is('removed_at', null);

    const nearbyById = new Map<string, { distance_meters: number; floor_level: string }>(
      (nearby ?? []).map((v: { id: string; distance_meters: number; floor_level: string }) => [
        v.id,
        { distance_meters: v.distance_meters, floor_level: v.floor_level },
      ])
    );

    const combined = (allVenues ?? []).map(
      (v: { id: string; name: string; address: string }) => {
        const near = nearbyById.get(v.id);
        return {
          ...v,
          floor_level: near?.floor_level ?? null,
          distance_meters: near?.distance_meters ?? null,
        };
      }
    );

    const matches = combined
      .map((venue: { id: string; name: string; address: string; floor_level: string | null; distance_meters: number | null }) => ({
        id: venue.id,
        name: venue.name,
        address: venue.address,
        floor_level: venue.floor_level,
        distance_meters:
          venue.distance_meters === null ? null : Math.round(venue.distance_meters),
        name_similarity: Number(nameSimilarity(submittedName, venue.name).toFixed(2)),
      }))
      // Drop weak coincidences: either it is close by, or the name genuinely looks alike.
      .filter(
        (m: { distance_meters: number | null; name_similarity: number }) =>
          m.distance_meters !== null || m.name_similarity >= 0.4
      )
      // Closest first, but let a strong name match outrank raw proximity — in a
      // mall cluster the nearest pin is often the neighbouring unit.
      .sort(
        (a: { name_similarity: number; distance_meters: number | null },
         b: { name_similarity: number; distance_meters: number | null }) =>
          b.name_similarity - a.name_similarity ||
          (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity)
      )
      .slice(0, 5);

    return NextResponse.json({ matches });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
