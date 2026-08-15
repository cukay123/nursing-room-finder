# Project Status — Nursing Room Finder

**Audited:** 14 August 2026 · **Last updated:** 15 August 2026
**Work period:** 3–4 August 2026 (two days)
**Status:** Production build passes. Several mechanical defects fixed (see [Known issues](#known-issues));
admin authentication is still missing, so this is **not yet safe to deploy publicly**.

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
Items marked **FIXED** were resolved on 15 August 2026; the fix is noted inline.

### 1. Admin is completely unauthenticated — **critical**

`app/admin/page.tsx`, `app/api/admin/submissions/route.ts`, `app/api/admin/approve-submission/route.ts`

There is no password, session check, or guard of any kind on the admin page or either admin API route.
Both routes run on `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely. Anyone who visits
`/admin` can approve, reject, and rewrite venue data. **This must be fixed before the app is exposed
publicly.**

### 2. The amenity filters do nothing — **FIXED**

`app/page.tsx:49`

The fetch effect depended on `[userLat, userLng, searchRadius]`, not `filters`. Toggling a checkbox
updated state but never triggered a refetch, and nothing filtered the results client-side either — the
entire filter panel was dead UI.

*Fixed:* `filters` added to the dependency array.

### 3. Two filters were also unimplemented server-side — **FIXED**

`app/api/nearest-venues/route.ts:61`

The filter `switch` had no `case` for `has_diaper_mat` or `can_buy_diaper`, so both fell through to
`default: return true` and were silently ignored. This was masked by issue #2 and would have surfaced
the moment that one was fixed.

*Fixed:* both cases added.

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

### 8. The production build failed — **FIXED**

`app/admin/page.tsx:28`, `components/Map.tsx:177`

`npm run build` failed type checking, which would have broken the deploy on every platform. Two
separate errors, the second hidden behind the first:

- `editData` was typed `Record<string, any>` but assigned into `payload`, which has a stricter shape.
- Two Leaflet handlers used `function() { this.setIcon(...) }`; `this` was implicitly `any`.

*Fixed:* `editData` typed as `Submission['payload']`; handlers converted to arrow functions closing
over `marker`. Build now passes — 11 static pages, 6 dynamic API routes.

### 9. The Dockerfile targeted an unsupported Node version — **FIXED**

`Dockerfile:2`

Base image was `node:18-alpine`, but Next 16.2.12 declares `engines: {"node": ">=20.9.0"}`. Any
Docker-based deploy would have failed.

*Fixed:* bumped to `node:22-alpine`.

### 10. `postal_code_cache` was publicly writable — **FIXED**

`supabase/migrations/003`, now `006_lock_down_anon_writes.sql`

It was the only table migration 001 never enabled RLS on, and 003 granted `anon` both `INSERT` and
`UPDATE`. Since `/api/postal-code-to-coords` serves the cache before falling back to OneMap, anyone
holding the public anon key could rewrite the coordinates that any postal code resolves to — pointing
searches wherever they liked.

*Fixed:* migration 006 revokes the anon grants and enables RLS with a read-only policy. The route now
writes through the service role, and the write is best-effort so a cache failure can't fail a lookup
that already resolved.

### 11. `room_details` accepted anonymous inserts — **FIXED**

`supabase/migrations/005`, now `006_lock_down_anon_writes.sql`

Migration 005 granted `anon` `INSERT` with a `with check (true)` policy. Nothing needed it:
`/api/submit-venue` writes only to `submissions`, and admin approval inserts `room_details` via the
service role.

*Fixed:* migration 006 revokes the grant and drops the policy.

### 12. The submissions queue is world-readable — **open, medium**

`supabase/migrations/001`, `005`

`submissions_select_all using (true)` plus an `anon` `SELECT` grant means anyone with the public anon
key can read every pending and rejected submission, including free-text notes. Restrict reads to the
service role unless there's a reason to expose the queue.

### 13. No rate limiting on submissions — **open, medium**

`app/api/submit-venue/route.ts`

Anonymous, unauthenticated, and unthrottled. Add rate limiting or a captcha before opening it to
public traffic.

> **Migration 006 has not yet been applied to a live database.** It was written but not executed —
> Docker was not running at the time. Verify with `supabase start && supabase db reset` before
> relying on it, and confirm postal code search still works afterwards.

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
| `README.md` | Main entry point. Still claims `npm run test`, functioning Docker Compose, and PWA support — none accurate. There is no `manifest.json` and no service worker; `public/` holds only the default Next SVGs. |
| `BUILD_SUMMARY.md` | Feature checklist. Marks verification and filters complete; they are not. |
| `NEXT_STEPS.md` | Launch checklist. Says "Next.js 15" (it is 16) and "ready to import". |
| `DEPLOYMENT.md` | Per-platform deploy guides (Render, Railway, Fly.io, Vercel). |
| `PRODUCTION_CHECKLIST.md` | Pre-launch checklist. Does not mention the missing admin auth. |
| `TESTING_GUIDE.md` | Manual test steps. |
| `LOCAL_SETUP.md` | Local Supabase setup. |
| `QUICK_START.md` / `QUICKSTART.md` | Two near-duplicate quick-start guides. |

Consolidating these into README + DEPLOYMENT + this file would remove most of the drift.

---

## Pre-deploy checklist

Must be settled before this is exposed to public traffic:

- [ ] **Authentication on `/admin` and both admin API routes** (issue #1). Nothing else on this list
      matters as much — both routes run on the service role key, which bypasses RLS entirely.
- [ ] **Apply migration 006 to a live database** and confirm postal code search still works
      (`supabase start && supabase db reset`).
- [ ] **Stand up production Supabase** — hosted project, `supabase db push`, then import the seed CSV.
      Note the importer needs `tsx`, not `ts-node` (issue #7).
- [ ] **Verify the dataset.** 38 of 85 venues have never been checked, and amenity booleans are
      unreliable for the 65 SassyMama rows. For this app the failure mode is a parent walking to a
      room that isn't there — weight this above any remaining feature work.
- [ ] **Restrict submission reads and add rate limiting** (issues #12, #13).
- [x] ~~Fix the production build~~ (issue #8)
- [x] ~~Fix the Dockerfile Node version~~ (issue #9)
- [x] ~~Close the anonymous write holes~~ (issues #10, #11)
- [x] ~~Make the amenity filters work~~ (issues #2, #3)

Worth doing, but not blocking:

1. **Get the pipeline and CSVs into version control** (see above); the seed data is currently
   unbacked and partly irreproducible.
2. **Either build `/api/confirm-venue` or remove the verification UI** (issue #4) so the interface
   stops promising something it does not do.
3. **Reconcile the docs with reality** — fix or delete the Docker Compose section, the test command,
   and the PWA claim in the README, and consolidate the nine markdown files.
4. **Settle the data rights question.** The dataset is scraped from BMSG and SassyMama and the repo is
   public. Attribution at minimum; permission ideally. Also check OneMap's API terms for production
   use. (OpenStreetMap tile attribution is already correct in `Map.tsx:48`.)
5. **Clean up lint.** `npx eslint app components lib scripts` reports 15 problems (6 errors) — unused
   imports, two `any` types, and a `Date.now()` call during render in `VenueCard.tsx:64` that can
   produce unstable output across re-renders. None block the build. Note `npm run lint` also scans
   `supabase/.temp/`, which floods the output with ~160 errors from a minified vendored file; scope
   the script to source directories or add an eslint ignore.
