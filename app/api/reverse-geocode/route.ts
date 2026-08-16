/**
 * API route: Reverse geocode coordinates to postal code
 * GET /api/reverse-geocode?lat=1.3521&lng=103.8198
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const lat = req.nextUrl.searchParams.get('lat');
    const lng = req.nextUrl.searchParams.get('lng');

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Missing lat or lng' },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    // Try OneMap reverse geocoding
    try {
      const response = await fetch('https://www.onemap.gov.sg/api/common/revgeocode', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const params = new URLSearchParams({
        location: `${latitude},${longitude}`,
      });

      const revGeoUrl = `https://www.onemap.gov.sg/api/common/revgeocode?${params.toString()}`;
      const revGeoResponse = await fetch(revGeoUrl);

      if (revGeoResponse.ok) {
        const data = await revGeoResponse.json();
        const postalCode = data.results?.[0]?.POSTAL_CODE || '';

        // Cache the result
        if (postalCode) {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // Table renamed in migration 012: the cache always held free-text
          // queries, not only postal codes. .select() dropped because reading
          // the row back is unnecessary and needs a permission anon lacks.
          const { error: cacheError } = await supabase
            .from('location_cache')
            .upsert({
              query: postalCode.toLowerCase(),
              latitude,
              longitude,
              resolved_at: new Date().toISOString(),
            });

          if (cacheError) {
            console.error('Location cache write failed:', cacheError);
          }
        }

        return NextResponse.json({
          postal_code: postalCode,
          latitude,
          longitude,
        });
      }
    } catch (err) {
      console.error('OneMap reverse geocode error:', err);
    }

    // If OneMap fails, return coordinates without postal code
    return NextResponse.json({
      postal_code: '',
      latitude,
      longitude,
    });
  } catch (err) {
    console.error('Reverse geocode error:', err);
    return NextResponse.json(
      { error: 'Failed to reverse geocode' },
      { status: 500 }
    );
  }
}
