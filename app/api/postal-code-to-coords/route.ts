/**
 * API route: Resolve Singapore postal code to lat/lng
 * Uses OneMap API with caching to avoid repeated lookups
 *
 * GET /api/postal-code-to-coords?postal_code=238872
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ONEMAP_API = 'https://www.onemap.gov.sg/api/common/elastic/search';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postalCode = searchParams.get('postal_code')?.trim();

    if (!postalCode) {
      return NextResponse.json(
        { error: 'Missing postal_code parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Check cache first
    const { data: cached } = await supabase
      .from('postal_code_cache')
      .select('latitude, longitude')
      .eq('postal_code', postalCode)
      .single();

    if (cached) {
      return NextResponse.json({
        latitude: cached.latitude,
        longitude: cached.longitude,
        cached: true,
      });
    }

    // Query OneMap
    const response = await fetch(
      `${ONEMAP_API}?searchVal=${encodeURIComponent(postalCode)}&returnGeom=Y&getAddrDetails=Y`,
      { headers: { 'User-Agent': 'nursing-room-finder' } }
    );

    if (!response.ok) {
      console.error(`OneMap API error: ${response.status}`);
      return NextResponse.json({ error: 'OneMap lookup failed' }, { status: 503 });
    }

    const result = await response.json();
    const result0 = result.results?.[0];

    if (!result0?.LATITUDE || !result0?.LONGITUDE) {
      return NextResponse.json(
        { error: `Postal code not found: ${postalCode}` },
        { status: 404 }
      );
    }

    const latitude = parseFloat(result0.LATITUDE);
    const longitude = parseFloat(result0.LONGITUDE);

    // Cache it
    await supabase
      .from('postal_code_cache')
      .upsert(
        { postal_code: postalCode, latitude, longitude },
        { onConflict: 'postal_code' }
      )
      .throwOnError();

    return NextResponse.json({ latitude, longitude, cached: false });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
