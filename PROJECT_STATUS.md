# Project Status — Nursing Room Finder

**Audited:** 14 August 2026
**Work period:** 3–4 August 2026 (two days), untouched since
**Status:** Working MVP with several unfinished features and one significant security gap. Not ready to deploy publicly.

> **This document supersedes the other status/checklist docs in this repo.** `BUILD_SUMMARY.md`,
> `NEXT_STEPS.md`, `PRODUCTION_CHECKLIST.md`, `TESTING_GUIDE.md`, and the README describe features
> as complete that are not (see [Known Issues](#known-issues)). Treat this file as the accurate picture.

---

## What it is

A crowdsourced map app for finding breastfeeding and nursing rooms in Singapore. Users search by GPS
or postal code, browse rooms on a map or list, filter by amenities, and submit new rooms; an admin
queue reviews and approves those submissions.

The project has two distinct halves:

1. **A Python data pipeline** — scraped and geocoded the 85-venue seed dataset. Lives one level up,
   in `~/Desktop/projectfun/`, **outside this git repository** (see [Not in version control](#not-in-version-control)).
2. **This Next.js app** — serves the data and handles crowdsourcing.

---

## Half 1: The data pipeline

Four standalone Python scripts, run manually in sequence. All live in the parent directory.

| Order | Script | Does | Output |
|---|---|---|---|
| 1 | `scrape_bmsg.py` | Scrapes breastfeeding.org.sg's table-based directory | `bmsg_nursing_rooms.csv` (20 rows) |
| 2 | `scrape_sassymama.py` | Regex-scrapes SassyMama's long-form article | `sassymama_nursing_rooms.csv` (75 rows) |
| 3 | `merge_sources.py` | Fuzzy-dedupes by name (`SequenceMatcher` ratio ≥ 0.75) | `seed_nursing_rooms_merged.csv` (85 rows) |
| 4 | `geocode_onemap.py` | OneMap Search API → address, postal code, lat/lng, confidence flag | `geocoded_nursing_rooms.csv` (85 rows) |

Dependencies: `requests`, `beautifulsoup4`. No requirements file exists.

### Dataset

**85 venues, all with coordinates.**

| Provenance | Count | | Geocode confidence | Count |
|---|---|---|---|---|
| SassyMama only | 65 | | `HIGH` | 19 |
| Both sources | 11 | | `LOW_REVIEW` | 19 |
| BMSG only | 9 | | `NOMINATIM` | 47 |

### Data quality caveats

- **The 47 `NOMINATIM` rows cannot be reproduced from the scripts in this project.**
  `geocode_onemap.py` contains no Nominatim code at all — that fallback pass was run ad hoc and never
  saved. Re-running the pipeline end to end will not regenerate `geocoded_nursing_rooms.csv`.
- **SassyMama's `known_address` and `amenities_notes` columns are effectively swapped.**
  `amenities_notes` holds address strings (`"313@Somerset , 313 Orchard Rd, Singapore 238895, www..."`)
  while `known_address` holds the `"Location: Levels B3..."` prose blob. Geocoding still mostly worked
  because an address appears at the end of the prose, but the keyword-based amenity parser in
  `scripts/import-venues.ts` is reading address text for 65 of 85 rows — so the amenity booleans on
  those venues are unreliable.
- **~38 of 85 rows were never spot-checked.** The `LOW_REVIEW` flag exists specifically so the
  geocoding can be diffed before being trusted (see the docstring in `geocode_onemap.py`); that review
  never happened, and the `NOMINATIM` rows carry no confidence signal at all.
- **Scraper fragility.** `scrape_sassymama.py` parses by text pattern rather than CSS structure — its
  own docstring notes it will break if the article layout changes. It supplies 76% of the dataset.
- **Duplicate files.** `geocode_onemap (1).py` is byte-identical to `geocode_onemap.py`.
  `seed_nursing_rooms (1).csv` and `(2).csv` are identical to each other and differ from
  `seed_nursing_rooms.csv`. These are browser-download artifacts and can be deleted.

---

## Half 2: The application

### Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind 4 · Leaflet + OpenStreetMap ·
Supabase (PostgreSQL 16 + PostGIS) · Lucide icons. Roughly 2,700 lines across 21 source files.

### Layout

```
app/
  page.tsx                  Map + list toggle, filter panel, add-venue modal
  admin/page.tsx            Submission review queue with inline editing
  api/
    nearest-venues/         PostGIS RPC proxy + amenity filtering
    postal-code-to-coords/  OneMap lookup, cached in postal_code_cache
    reverse-geocode/        lat/lng → postal code (currently unused by any component)
    submit-venue/           Anonymous submission intake
    admin/submissions/      Pending queue (service role)
    admin/approve-submission/  Approve → creates venue + room_details (service role)
components/
  Map.tsx                   Leaflet, dynamically imported (ssr: false)
  LocationSearch.tsx        GPS button + postal code input
  VenueCard.tsx             Amenities, directions, verification buttons
  AddVenueModal.tsx         Crowdsourcing form
lib/supabase.ts             Browser client + shared types
scripts/import-venues.ts    CSV → Supabase importer
supabase/migrations/        5 SQL migrations
```

### Database

Six tables: `venues`, `room_details`, `submissions`, `confirmations`, `photos`, `postal_code_cache`.

The core query is the PostGIS function `nearest_venues(lat, lng, radius)` — `ST_DWithin` for the radius
filter, `ST_Distance` for ordering, backed by a GiST index on `venues.location`. Migration 004 redefines
it to add the two diaper amenities.

Migrations 002, 003, and 005 are all permission patches that progressively loosen RLS so anonymous
users can submit without authentication. The original `submissions_insert_auth` policy
(`auth.uid() = submitted_by`) was dropped in 005 and replaced with `submitted_by is null`.

### Environment

`.env.local` currently points at `http://localhost:54321` — the local Supabase dev stack, which is not
running. Required variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_ONEMAP_API_URL`.

Secrets are correctly gitignored (`.env*` in `.gitignore`; `.temp` and `.branches` in
`supabase/.gitignore`, which covers `supabase/.temp/start-secrets/`). Nothing sensitive is hardcoded
in source.

---

## Known issues

Ordered by severity. Each is a real defect verified against the code, not a to-do.

### 1. Admin is completely unauthenticated — **critical**

`app/admin/page.tsx`, `app/api/admin/submissions/route.ts`, `app/api/admin/approve-submission/route.ts`

There is no password, session check, or guard of any kind on the admin page or either admin API route.
Both routes run on `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely. Anyone who visits
`/admin` can approve, reject, and rewrite venue data. **This must be fixed before the app is exposed
publicly.**

### 2. The amenity filters do nothing — **high**

`app/page.tsx:47`

The fetch effect depends on `[userLat, userLng, searchRadius]`, not `filters`. Toggling a checkbox
updates state but never triggers a refetch, and nothing filters the results client-side either. The
entire filter panel is dead UI. Fix: add `filters` to the dependency array (or add an explicit Apply
button).

### 3. Two filters are also unimplemented server-side — **medium**

`app/api/nearest-venues/route.ts:46`

The filter `switch` has no `case` for `has_diaper_mat` or `can_buy_diaper`, so both fall through to
`default: return true` and are silently ignored. This bug is currently masked by issue #2 and will
surface the moment that one is fixed.

### 4. Room verification is a stub — **medium**

`components/VenueCard.tsx:37`

The thumbs up/down buttons are wired to a `// TODO: Call /api/confirm-venue`. That endpoint does not
exist. Consequently the `confirmations` table is permanently empty, and the "last verified X days ago"
indicator — which reads `last_confirmed_at` from that table via `nearest_venues` — will never show
anything.

### 5. `docker-compose up` cannot work as documented — **medium**

`docker-compose.yml`, `README.md`

The compose file starts a bare `postgis/postgis:16-3.4` container, but the app talks to the *Supabase
API* (PostgREST on `:54321`, plus `supabase.rpc()` calls) — which is not in the compose file at all.
The migrations would also fail against that image, since `001_initial_schema.sql` references
`auth.users`, a Supabase-only table. Either add the Supabase services to compose, or drop the
"Option 1: Docker Compose (Easiest)" section from the README.

The `Dockerfile` itself is sound — multi-stage, `output: 'standalone'`, non-root user.

### 6. `npm run test` does not exist — **low**

`README.md`, `package.json`

The README documents a test command. There is no `test` script and no test framework installed. There
are no automated tests in the project.

### 7. The import script cannot be run as documented — **low**

`scripts/import-venues.ts:4`

The header comment says `npx ts-node scripts/import-venues.ts`. `ts-node` is not in the dependencies,
and the script is ESM-only (`import.meta.url`), so it would need `tsx` rather than `ts-node`.

---

## Not in version control

**The entire Python data pipeline and all CSV data live in the parent directory
(`~/Desktop/projectfun/`), which is not a git repository.** That includes all four scrapers and
`geocoded_nursing_rooms.csv` — the file that cannot be regenerated (see data quality caveats above).

Those files exist in exactly one place, on one disk, with no history. Moving them into this repo under
a `data-pipeline/` directory, or initialising a repository at the `projectfun/` level, would be worth
doing.

---

## Documentation inventory

Nine markdown files with substantial overlap, including both `QUICK_START.md` and `QUICKSTART.md` as
separate files:

| File | Notes |
|---|---|
| `README.md` | Main entry point. Claims working filters, `npm run test`, and functioning Docker Compose — none accurate. |
| `BUILD_SUMMARY.md` | Feature checklist. Marks verification and filters complete; they are not. |
| `NEXT_STEPS.md` | Launch checklist. Says "Next.js 15" (it is 16) and "ready to import". |
| `DEPLOYMENT.md` | Per-platform deploy guides (Render, Railway, Fly.io, Vercel). |
| `PRODUCTION_CHECKLIST.md` | Pre-launch checklist. Does not mention the missing admin auth. |
| `TESTING_GUIDE.md` | Manual test steps. |
| `LOCAL_SETUP.md` | Local Supabase setup. |
| `QUICK_START.md` / `QUICKSTART.md` | Two near-duplicate quick-start guides. |

Consolidating these into README + DEPLOYMENT + this file would remove most of the drift.

---

## Suggested next steps

1. **Add authentication to `/admin` and both admin API routes** (issue #1). Blocks any public deploy.
2. **Fix the filter refetch** (issue #2) — a one-line change to a dependency array — then add the two
   missing filter cases (issue #3).
3. **Get the pipeline and CSVs into version control** (see above); the seed data is currently
   unbacked and partly irreproducible.
4. **Either build `/api/confirm-venue` or remove the verification UI** (issue #4) so the interface
   stops promising something it does not do.
5. **Reconcile the docs with reality** — fix or delete the Docker Compose section and the test command
   in the README, and consolidate the nine markdown files.
6. **Re-verify the 38 unchecked geocoded rows**, and re-derive amenity booleans for the 65 SassyMama
   venues once the swapped-column issue is corrected.
