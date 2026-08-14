# ⚡ Quick Start: Nursing Room Finder

## What's Built (MVP)

✅ Next.js scaffold with TypeScript + Tailwind  
✅ Supabase schema (venues, room_details, submissions, confirmations, photos)  
✅ PostGIS geospatial queries (nearest_venues function)  
✅ CSV import script (parses seed data, handles missing coords)  
✅ Map view (Leaflet + OpenStreetMap)  
✅ Location search (GPS + postal code)  
✅ Venue detail card (amenities, confirmations, filters)  
✅ List view toggle  

## What You Need to Do

### Step 1: Supabase Setup with Docker (5 min)
```bash
cd nursing-room-finder

# Start Supabase locally (requires Docker)
supabase start

# Deploy migrations to local database
supabase db push
```

After `supabase start` completes, copy the anon key and URL from the output, or run:
```bash
supabase status
```

### Step 2: Local Setup (5 min)
```bash
# Copy env template (uses localhost:54321 by default)
cp .env.local.example .env.local

# Install dependencies
npm install
```

### Step 3: Import Seed Data (5 min)
```bash
npx ts-node scripts/import-venues.ts /Users/anjasjefrianto/Desktop/projectfun/geocoded_nursing_rooms.csv
```

Verify: Access Supabase Studio at http://localhost:54323 and check that venues table has ~85 rows.

### Step 4: Run Locally
```bash
npm run dev
```

Open http://localhost:3000  
- Click "Use My Location" or enter postal code "238872"
- Should see map with pins + venue cards

## Ready to Demo! ✅

✅ Map coordinates are now returned from the database  
✅ All pins display at correct locations  
✅ No critical blockers remaining

## Next (Phase 2)

- [ ] **Submit new venue** — Drop pin, fill form, upload photo → submissions table (pending admin approval)
- [ ] **Edit/report flow** — Flag incorrect venue info
- [ ] **Admin dashboard** — Review + approve submissions (currently use Supabase editor)
- [ ] **Auth UI** — Magic link signup/login (schema ready, UI missing)
- [ ] **Photo gallery** — Display user photos per venue
- [ ] **Confirmations UI** — Show "verified X days ago" + user count

## Key Files to Understand

| File | Purpose |
|------|---------|
| `app/page.tsx` | Map + list UI, location search |
| `components/Map.tsx` | Leaflet map (client-side dynamic) |
| `components/LocationSearch.tsx` | GPS + postal code inputs |
| `components/VenueCard.tsx` | Venue detail popup |
| `app/api/nearest-venues/route.ts` | Geo-query endpoint |
| `app/api/postal-code-to-coords/route.ts` | OneMap lookup + cache |
| `lib/supabase.ts` | Supabase client + types |
| `scripts/import-venues.ts` | CSV → DB importer |
| `supabase/migrations/001_initial_schema.sql` | Database schema + RLS |

## Testing the Flow

1. **Location search**:
   - GPS: "Use My Location" (request browser permission)
   - Postal code: Enter "238872" (Takashimaya) → resolves to coords

2. **Map view**:
   - Should show ~85 pins within 2km of your location (if data imported)
   - Click pin → venue detail card appears (bottom-right)

3. **List view**:
   - Toggle "List" icon (top-right)
   - Tap a venue → switches to map + selects that pin

4. **Filters**:
   - Check "has_lock" or others → re-query (currently frontend-filtered; future = backend)

5. **Empty state**:
   - Expand search radius button if no results

## Deployment (Future)

**Frontend**: `vercel deploy` (connects to this repo)  
**Backend**: Supabase already hosted  

## Gotchas

- **Leaflet CSS**: Required for map to render. Check browser console if map is blank.
- **Dynamic import**: `Map.tsx` uses `dynamic()` with `ssr: false` to avoid server-side Leaflet errors.
- **Postal code cache**: Results cached in `postal_code_cache` table. Clear if you want fresh lookups.
- **Venue coordinates**: Imported from seed CSV. If lat/lng are blank, venue is skipped.

---

**Status**: MVP complete, map coordinate display needs 1-line fix (see Critical TODO above).

Questions? Check `README.md` for deeper docs.
