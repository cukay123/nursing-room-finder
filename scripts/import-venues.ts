/**
 * Import venue data from geocoded_nursing_rooms.csv into Supabase
 *
 * Usage: npx ts-node scripts/import-venues.ts /path/to/geocoded_nursing_rooms.csv
 *
 * Assumptions:
 * - .env.local is populated with SUPABASE_URL and SUPABASE_ANON_KEY
 * - CSV columns: name, type, location_level, amenities_notes, known_address, source,
 *                onemap_address, postal_code, latitude, longitude, building_match, match_confidence
 * - Rows with missing latitude/longitude are skipped
 * - amenities_notes are parsed to infer room_details (lockable, changing table, sink, power, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import csv from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface CSVRow {
  name: string;
  type: string;
  location_level: string;
  amenities_notes: string;
  known_address: string;
  source: string;
  onemap_address: string;
  postal_code: string;
  latitude: string;
  longitude: string;
  building_match: string;
  match_confidence: string;
}

interface VenueInsert {
  name: string;
  type: string;
  address: string;
  postal_code: string;
  location: string; // GeoJSON Point as string
  building_match_confidence: string;
  source: string;
}

interface RoomDetailsInsert {
  venue_id: string;
  floor_level: string;
  has_lock: boolean;
  has_changing_table: boolean;
  has_sink: boolean;
  has_power_outlet: boolean;
  stroller_friendly: boolean;
  dad_friendly: boolean;
  notes: string;
}

// Parse amenities_notes to extract boolean flags
function parseAmenities(notes: string): Partial<RoomDetailsInsert> {
  if (!notes) return {};

  const lower = notes.toLowerCase();

  return {
    has_lock: /lockable|locked|lock/.test(lower),
    has_changing_table: /changing\s*table|changing\s*station|diaper/.test(lower),
    has_sink: /sink|wash|basin/.test(lower),
    has_power_outlet: /power|outlet|electrical|socket/.test(lower),
    stroller_friendly: /stroller|pram|fit.*stroller|space.*stroller|accommodate.*stroller/.test(lower),
    dad_friendly: /dad|father|gender|not.*female|male.*welcome|all.*gender/.test(lower),
  };
}

async function importVenues() {
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.error('❌ Usage: npx ts-node scripts/import-venues.ts /path/to/geocoded_nursing_rooms.csv');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ File not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`📖 Reading from: ${csvPath}`);

  const venues: VenueInsert[] = [];
  const roomDetails: Map<number, RoomDetailsInsert> = new Map();
  let skipped = 0;
  let rowCount = 0;

  // Parse CSV
  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row: CSVRow) => {
        rowCount++;

        // Skip rows with missing coordinates
        const lat = parseFloat(row.latitude);
        const lng = parseFloat(row.longitude);

        if (isNaN(lat) || isNaN(lng)) {
          skipped++;
          return;
        }

        // Build venue insert
        const venue: VenueInsert = {
          name: row.name.trim(),
          type: row.type.trim() || 'Nursing Room',
          address: (row.onemap_address || row.known_address || '').trim(),
          postal_code: row.postal_code.trim(),
          // PostGIS: send as "POINT(lng lat)" WKT format for geography type
          location: `POINT(${lng} ${lat})`,
          building_match_confidence: row.match_confidence?.trim() || 'MANUAL',
          source: row.source?.trim() || 'SEED',
        };

        venues.push(venue);

        // Parse amenities for room_details
        const amenities = parseAmenities(row.amenities_notes);
        roomDetails.set(venues.length - 1, {
          venue_id: '', // will be filled after insert
          floor_level: row.location_level?.trim() || '',
          has_lock: amenities.has_lock || false,
          has_changing_table: amenities.has_changing_table || false,
          has_sink: amenities.has_sink || false,
          has_power_outlet: amenities.has_power_outlet || false,
          stroller_friendly: amenities.stroller_friendly || false,
          dad_friendly: amenities.dad_friendly || false,
          notes: row.amenities_notes?.trim() || '',
        });
      })
      .on('end', async () => {
        console.log(`\n📊 CSV parsed: ${rowCount} rows, ${venues.length} valid, ${skipped} skipped\n`);

        if (venues.length === 0) {
          console.log('⚠️  No valid venues to import.');
          resolve();
          return;
        }

        // Insert venues in batches
        console.log('🔄 Inserting venues into Supabase...');

        try {
          const { data: insertedVenues, error: venueError } = await supabase
            .from('venues')
            .insert(venues)
            .select('id');

          if (venueError) {
            console.error('❌ Error inserting venues:', venueError);
            reject(venueError);
            return;
          }

          console.log(`✓ Inserted ${insertedVenues?.length || 0} venues`);

          // Insert room_details, linking by order
          if (insertedVenues && insertedVenues.length > 0) {
            console.log('🔄 Inserting room details...');

            const roomDetailsToInsert = insertedVenues
              .map((v, idx) => {
                const details = roomDetails.get(idx);
                if (details) {
                  return { ...details, venue_id: v.id };
                }
                return null;
              })
              .filter(Boolean) as RoomDetailsInsert[];

            const { error: detailsError } = await supabase
              .from('room_details')
              .insert(roomDetailsToInsert);

            if (detailsError) {
              console.error('❌ Error inserting room details:', detailsError);
              reject(detailsError);
              return;
            }

            console.log(`✓ Inserted ${roomDetailsToInsert.length} room detail records`);
          }

          console.log('\n✅ Import complete!');
          resolve();
        } catch (err) {
          reject(err);
        }
      })
      .on('error', reject);
  });
}

importVenues().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
