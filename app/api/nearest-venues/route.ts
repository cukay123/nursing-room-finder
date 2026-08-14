/**
 * API route: Find nearest nursing rooms to user coordinates
 * GET /api/nearest-venues?lat=1.35&lng=103.82&radius=2000&filters=has_lock,stroller_friendly
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const radius = parseInt(searchParams.get('radius') || '2000');
    const filterStr = searchParams.get('filters') || '';

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'Missing or invalid lat/lng' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Call nearest_venues PostGIS function
    const { data, error } = await supabase.rpc('nearest_venues', {
      user_lat: lat,
      user_lng: lng,
      radius_meters: radius,
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    // Apply client-side filters if provided
    let results = data || [];

    if (filterStr) {
      const filters = filterStr.split(',');
      results = results.filter((v: any) => {
        return filters.every(f => {
          switch (f.trim()) {
            case 'has_lock':
              return v.has_lock;
            case 'has_changing_table':
              return v.has_changing_table;
            case 'has_sink':
              return v.has_sink;
            case 'has_power_outlet':
              return v.has_power_outlet;
            case 'stroller_friendly':
              return v.stroller_friendly;
            case 'dad_friendly':
              return v.dad_friendly;
            default:
              return true;
          }
        });
      });
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
