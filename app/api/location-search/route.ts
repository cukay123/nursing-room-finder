/**
 * API route: turn a place name or postal code into coordinates
 *
 * GET /api/location-search?q=Bedok%20Mall
 * GET /api/location-search?q=238872
 *
 * OneMap's search endpoint matches building names, streets and postal codes
 * alike, so this accepts any of them. It was previously named
 * postal-code-to-coords, which described an assumption rather than the
 * behaviour, and led the UI to advertise postal codes only.
 *
 * Results are cached in location_cache. Writes go through the service role;
 * migration 006 revoked anon write access after the table turned out to be
 * publicly writable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ONEMAP_API = 'https://www.onemap.gov.sg/api/common/elastic/search';

// OneMap rate-limits readily. Without a retry a burst of searches returns
// "lookup failed" for places that exist perfectly well.
const MAX_ATTEMPTS = 3;

async function searchOneMap(query: string) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const response = await fetch(
      `${ONEMAP_API}?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y`,
      { headers: { 'User-Agent': 'nursing-room-finder' } }
    );

    if (response.status === 429 && attempt < MAX_ATTEMPTS - 1) {
      await new Promise(resolve => setTimeout(resolve, 300 * 2 ** attempt));
      continue;
    }

    if (!response.ok) {
      throw new Error(`OneMap returned ${response.status}`);
    }

    return response.json();
  }

  throw new Error('OneMap rate limited');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // `postal_code` accepted so an older cached client keeps working.
    const query = (searchParams.get('q') ?? searchParams.get('postal_code'))?.trim();

    if (!query) {
      return NextResponse.json(
        { error: 'Enter a place name or postal code' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Cache is keyed on the normalised query so "bedok mall" and "Bedok Mall"
    // share an entry.
    const cacheKey = query.toLowerCase();

    const { data: cached } = await supabase
      .from('location_cache')
      .select('latitude, longitude')
      .eq('query', cacheKey)
      .single();

    if (cached) {
      return NextResponse.json({
        latitude: cached.latitude,
        longitude: cached.longitude,
        cached: true,
      });
    }

    let result;
    try {
      result = await searchOneMap(query);
    } catch (err) {
      console.error('OneMap lookup failed:', err);
      return NextResponse.json(
        { error: 'Search is busy right now. Please try again in a moment.' },
        { status: 503 }
      );
    }

    const top = result.results?.[0];

    if (!top?.LATITUDE || !top?.LONGITUDE) {
      return NextResponse.json(
        { error: `No match for "${query}". Try a building name, street, or 6-digit postal code.` },
        { status: 404 }
      );
    }

    const latitude = parseFloat(top.LATITUDE);
    const longitude = parseFloat(top.LONGITUDE);

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
      const { error: cacheError } = await admin
        .from('location_cache')
        .upsert({ query: cacheKey, latitude, longitude }, { onConflict: 'query' });

      if (cacheError) {
        console.error('Location cache write failed:', cacheError);
      }
    } else {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set — skipping location cache write');
    }

    return NextResponse.json({
      latitude,
      longitude,
      matchedAddress: top.ADDRESS ?? null,
      cached: false,
    });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
