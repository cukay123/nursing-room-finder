/**
 * API route: existing rooms a submission might be about
 *
 * GET /api/admin/submission-matches                     all pending submissions
 * GET /api/admin/submission-matches?submissionId=...    just one
 *
 * Most submissions for a place already on the map are not new rooms — they are
 * someone adding detail to one that exists. Approving those blindly creates a
 * duplicate pin a few metres from the original, so the admin needs to see the
 * candidates before deciding.
 *
 * The bulk form exists because the per-submission form does not scale: the queue
 * can hold fifty-plus entries, and one request each meant fifty parallel calls on
 * page load, every one re-reading the whole venue table. Bulk reads the venues
 * once and scores in memory.
 *
 * Gated by proxy.ts along with the rest of /api/admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Generous enough to catch a large mall where the submitter stood at a different
// entrance than the recorded centroid.
const MATCH_RADIUS_METRES = 600;
const MAX_MATCHES = 5;

type Venue = {
  id: string;
  name: string;
  address: string | null;
  location_lat: number;
  location_lng: number;
  floor_level: string | null;
};

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

  const total =
    [...bx.values()].reduce((s, n) => s + n, 0) +
    [...by.values()].reduce((s, n) => s + n, 0);

  return total === 0 ? 0 : (2 * shared) / total;
}

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}

function scoreMatches(
  payload: { name?: string; latitude?: number; longitude?: number },
  venues: Venue[]
) {
  const submittedName = String(payload?.name ?? '');
  const lat = Number(payload?.latitude);
  const lng = Number(payload?.longitude);
  const hasPosition = Number.isFinite(lat) && Number.isFinite(lng);

  return venues
    .map(venue => {
      const distance = hasPosition
        ? haversineMetres(lat, lng, venue.location_lat, venue.location_lng)
        : null;

      return {
        id: venue.id,
        name: venue.name,
        address: venue.address,
        floor_level: venue.floor_level,
        distance_meters:
          distance !== null && distance <= MATCH_RADIUS_METRES
            ? Math.round(distance)
            : null,
        name_similarity: Number(nameSimilarity(submittedName, venue.name).toFixed(2)),
      };
    })
    // Either it is close by, or the name genuinely looks alike. Proximity alone is
    // not enough: a submission made away from the room carries coordinates nowhere
    // near it, and an exact-text prefilter would miss "Millenia walk" against
    // "Millennia Walk".
    .filter(m => m.distance_meters !== null || m.name_similarity >= 0.4)
    // Closest first, but let a strong name match outrank raw proximity — in a mall
    // cluster the nearest pin is often the neighbouring unit.
    .sort(
      (a, b) =>
        b.name_similarity - a.name_similarity ||
        (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity)
    )
    .slice(0, MAX_MATCHES);
}

// Singapore's bounds, so one call returns every live venue with coordinates.
const ALL_SG = { lat: 1.3521, lng: 103.8198, radius: 50000 };

/**
 * Read every live venue with usable coordinates.
 *
 * Goes through the nearest_venues RPC rather than selecting `location` directly:
 * PostgREST returns PostGIS geography as WKB hex ("0101000020E6100000..."), not
 * GeoJSON, so a plain select would need a WKB parser here. The RPC already
 * projects lat/lng, already excludes removed rooms, and is the same query the map
 * depends on.
 */
async function loadVenues(
  supabase: ReturnType<typeof adminClient>
): Promise<{ venues: Venue[]; error: string | null }> {
  const { data, error } = await supabase.rpc('nearest_venues', {
    user_lat: ALL_SG.lat,
    user_lng: ALL_SG.lng,
    radius_meters: ALL_SG.radius,
  });

  if (error) return { venues: [], error: error.message };

  const venues = (data ?? [])
    .map((v: {
      id: string;
      name: string;
      address: string | null;
      latitude: number;
      longitude: number;
      floor_level: string | null;
    }) => ({
      id: v.id,
      name: v.name,
      address: v.address,
      location_lat: Number(v.latitude),
      location_lng: Number(v.longitude),
      floor_level: v.floor_level,
    }))
    .filter((v: Venue) => Number.isFinite(v.location_lat) && Number.isFinite(v.location_lng));

  return { venues, error: null };
}

export async function GET(req: NextRequest) {
  try {
    const submissionId = req.nextUrl.searchParams.get('submissionId');
    const supabase = adminClient();

    // One read of the venue table, reused for every submission scored below.
    const { venues, error: venueError } = await loadVenues(supabase);

    if (venueError) {
      console.error('Match lookup failed:', venueError);
      return NextResponse.json({ error: venueError }, { status: 500 });
    }

    if (submissionId) {
      const { data: submission, error } = await supabase
        .from('submissions')
        .select('id, payload')
        .eq('id', submissionId)
        .single();

      if (error || !submission) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      }

      return NextResponse.json({
        matches: scoreMatches(submission.payload ?? {}, venues),
      });
    }

    const { data: pending, error: pendingError } = await supabase
      .from('submissions')
      .select('id, payload')
      .eq('status', 'pending');

    if (pendingError) {
      console.error('Pending lookup failed:', pendingError);
      return NextResponse.json({ error: pendingError.message }, { status: 500 });
    }

    const matchesBySubmission = Object.fromEntries(
      (pending ?? []).map(s => [s.id, scoreMatches(s.payload ?? {}, venues)])
    );

    return NextResponse.json({ matchesBySubmission });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
