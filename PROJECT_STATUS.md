# Project Status — Nursing Room Finder

**Audited:** 14 August 2026 · **Last updated:** 16 August 2026
**Work period:** 3–4 August 2026 (two days)
**Status:** Production build passes. Admin surface authenticated, anonymous write and read holes
closed, submissions rate-limited, pipeline under version control, dataset cross-checked (74 of 85
coordinates corroborated). **Remaining before launch: set `ADMIN_PASSWORD`, stand up production
Supabase, review 11 flagged venues, and settle data rights.**

> **This document supersedes the other status/checklist docs in this repo.** `BUILD_SUMMARY.md`,
> `NEXT_STEPS.md`, `PRODUCTION_CHECKLIST.md`, `TESTING_GUIDE.md`, and the README describe features
> as complete that are not (see [Known Issues](#known-issues)). Treat this file as the accurate picture.

---

## What it is

A crowdsourced map app for finding breastfeeding and nursing rooms in Singapore. Users search by GPS
or postal code, browse rooms on a map or list, filter by amenities, and submit new rooms; an admin
queue reviews and approves those submissions.

The project has two distinct halves:

1. **A Python data pipeline** — scraped and geocoded the 85-venue seed dataset. Now lives in
   `data-pipeline/`, under version control. See `data-pipeline/README.md` for the full flow.
2. **This Next.js app** — serves the data and handles crowdsourcing.

---

## Half 1: The data pipeline

Standalone Python scripts in `data-pipeline/`, run manually in sequence.

| Order | Script | Does | Output |
|---|---|---|---|
| 1 | `scrape_bmsg.py` | Scrapes breastfeeding.org.sg's table-based directory | `bmsg_nursing_rooms.csv` (20 rows) |
| 2 | `scrape_sassymama.py` | Regex-scrapes SassyMama's long-form article | `sassymama_nursing_rooms.csv` (75 rows) |
| 3 | `merge_sources.py` | Fuzzy-dedupes by name (`SequenceMatcher` ratio ≥ 0.75) | `seed_nursing_rooms_merged.csv` (85 rows) |
| — | *manual curation, no script* | Hand-adds addresses and tidies amenity notes | `seed_nursing_rooms.csv` (85 rows) |
| 4 | `geocode_onemap.py` | OneMap Search API → address, postal code, lat/lng, confidence flag | `geocoded_nursing_rooms.csv` (85 rows) |

Plus two maintenance scripts: `repair_sassymama.py` (one-off, already applied) and
`verify_geocoding.py` (non-destructive cross-check, re-runnable).

**The manual curation step is the one to know about.** `seed_nursing_rooms.csv` is *not* the output of
`merge_sources.py` despite the name — it is hand-curated, has all 85 addresses where the auto-merge
manages only 52, and it is what actually feeds geocoding. Regenerating it from the merge would lose 33
hand-added addresses.

Dependencies: `requests`, `beautifulsoup4`. No requirements file exists.

### Dataset

**85 venues, all with coordinates.**

| Provenance | Count | | Geocode confidence | Count |
|---|---|---|---|---|
| SassyMama only | 65 | | `HIGH` | 19 |
| Both sources | 11 | | `LOW_REVIEW` | 19 |
| BMSG only | 9 | | `NOMINATIM` | 47 |

### Verification status

`verify_geocoding.py` cross-checked all 85 coordinates against a fresh OneMap lookup on
16 August 2026. Results, worst-first, are in `data-pipeline/geocode_review.csv`:

| Verdict | Count | Meaning |
|---|---|---|
| `CONFIRMED` | 74 | OneMap agrees within 150 m |
| `DRIFT` | 9 | 150 m – 1 km apart; mostly large sites where that is inside the footprint |
| `CONFLICT` | 1 | Changi Airport — 1,246 m; OneMap matched "aircraft flyover", a poor match |
| `NO_ONEMAP_MATCH` | 1 | Millennia Walk |

**11 venues need human eyes**, not the ~38 originally estimated from the confidence labels. The
`DRIFT` set is Sentosa, Marina Bay Sands, Jurong East Bus Interchange, Singapore Zoo, Institute of
Mental Health, Harbourfront Centre, Marina Square, Ng Teng Fong Hospital, and Jurong Point — all
sprawling sites where the building centroid and the nursing room genuinely differ. For those, the
useful correction is a floor/wing note rather than a new coordinate.

### Data quality caveats

- **The 47 `NOMINATIM` rows cannot be reproduced from the scripts in this project.**
  `geocode_onemap.py` contains no Nominatim code at all — that fallback pass was run ad hoc and never
  saved. Re-running the pipeline end to end will not regenerate `geocoded_nursing_rooms.csv`. Anything
  that touches this file must preserve existing coordinates rather than overwrite them.
- **21 of 75 SassyMama rows scraped completely empty** — heading found, no body. They carry data in
  the curated seed only because addresses were added by hand.
- **`dad_friendly` and `has_diaper_mat` are false for all 85 venues, and correctly so.** The source
  notes contain no diaper-mat wording at all, and the only venue mentioning gender says "small area
  inside female restroom" — which is the *opposite* of dad-friendly. This is absent data, not a parser
  bug. Both filters will return nothing until the underlying data improves.
- **Scraper fragility.** `scrape_sassymama.py` parses by text pattern rather than CSS structure — its
  own docstring notes it will break if the article layout changes. It supplies 76% of the dataset.
- **Duplicate files** are parked in `data-pipeline/duplicates/` rather than deleted. Safe to remove
  once the canonical set is confirmed.

> **Correction (16 Aug 2026).** An earlier version of this document stated that the amenity booleans
> were unreliable for 65 of 85 rows because the parser was reading address text. That was wrong. The
> column corruption was real but confined to the *intermediate* scraper output; `seed_nursing_rooms.csv`
> is hand-curated and clean, so the corruption never reached `geocoded_nursing_rooms.csv` or the
> database. The scraper bug is fixed regardless, since it would have affected any future re-scrape.

---

## Half 2: The application

### Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind 4 · Leaflet + OpenStreetMap ·
Supabase (PostgreSQL 16 + PostGIS) · Lucide icons. Roughly 2,700 lines across 21 source files.

### Layout

```
proxy.ts                    Auth gate for /admin and /api/admin (Next 16's renamed Middleware)
app/
  page.tsx                  Map + list toggle, filter panel, add-venue modal
  admin/page.tsx            Submission review queue with inline editing
  admin/login/page.tsx      Password form
  api/
    nearest-venues/         PostGIS RPC proxy + amenity filtering
    location-search/        OneMap lookup by place name or postal code, cached
    reverse-geocode/        lat/lng → postal code (currently unused by any component)
    submit-venue/           Anonymous submission intake
    admin/submissions/      Pending queue (service role)
    admin/approve-submission/  Approve → creates venue + room_details (service role)
    admin/login, admin/logout  Session cookie mint / clear
components/
  Map.tsx                   Leaflet, dynamically imported (ssr: false)
  LocationSearch.tsx        GPS button + postal code input
  VenueCard.tsx             Amenities, directions, verification buttons
  AddVenueModal.tsx         Crowdsourcing form
lib/supabase.ts             Browser client + shared types
lib/admin-auth.ts           HMAC session tokens (Web Crypto, Edge-compatible)
lib/rate-limit.ts           Fixed-window per-IP limiter
scripts/import-venues.ts    CSV → Supabase importer
data-pipeline/              Scrapers, CSVs, geocode verification
supabase/migrations/        7 SQL migrations
```

### Database

Seven tables: `venues`, `room_details`, `submissions`, `confirmations`, `photos`, `reviews`,
`location_cache`.

The core query is the PostGIS function `nearest_venues(lat, lng, radius)` — `ST_DWithin` for the radius
filter, `ST_Distance` for ordering, backed by a GiST index on `venues.location`. Migration 004 redefines
it to add the two diaper amenities.

Migrations 002, 003, and 005 progressively loosened RLS so anonymous users could submit without
authentication. Migrations 006 and 007 tighten that back up: anon keeps INSERT on `submissions` (the
crowdsourcing form needs it) but loses every other write, and loses read access to the queue.

### Environment

`.env.local` currently points at `http://localhost:54321` — the local Supabase dev stack, which is not
running. Required variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_ONEMAP_API_URL`, and `ADMIN_PASSWORD` (required — the
admin surface returns 503 without it).

Secrets are correctly gitignored (`.env*` in `.gitignore`; `.temp` and `.branches` in
`supabase/.gitignore`, which covers `supabase/.temp/start-secrets/`). Nothing sensitive is hardcoded
in source.

---

## Known issues

Ordered by severity. Each is a real defect verified against the code, not a to-do.
Items marked **FIXED** were resolved on 15 August 2026; the fix is noted inline.

### 1. Admin was completely unauthenticated — **FIXED**

`proxy.ts`, `lib/admin-auth.ts`, `app/api/admin/login/route.ts`, `app/admin/login/page.tsx`

There was no password, session check, or guard of any kind on the admin page or either admin API
route, both of which run on `SUPABASE_SERVICE_ROLE_KEY` and bypass RLS entirely. Anyone who visited
`/admin` could approve, reject, and rewrite venue data.

*Fixed:* `proxy.ts` (Next 16's renamed Middleware) gates `/admin/:path*` and `/api/admin/:path*`.
The operator sets `ADMIN_PASSWORD`; a successful login mints an HMAC-signed, httpOnly session cookie
carrying a 12-hour expiry. No server-side session store, so it deploys anywhere.

Two properties worth keeping if this is ever rewritten:

- **It fails closed.** No `ADMIN_PASSWORD` means 503 for the entire admin surface, including the login
  route and any previously valid cookie. An unset variable must never mean "no gate".
- **The API routes are gated, not just the page.** The routes are the part that matters; protecting
  only the UI would leave the data open to any direct request.

Verified: unauthenticated API 401, page 307 to login, wrong password 401, correct password 200 and
subsequent access 200, forged cookie 401, and 503 across the board when the password is unset.

**This is single-operator protection, not user accounts.** When real admin identities are needed,
swap in Supabase Auth with an allowlist — `isAuthorized` and the proxy matcher are the only call sites.

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

### 4. Room verification was a stub — **FIXED**

`app/api/confirm-venue/route.ts`, `components/VenueCard.tsx`,
`supabase/migrations/008_confirmations_only_count_positive.sql`

The thumbs up/down buttons pointed at a `// TODO`, so the `confirmations` table stayed empty and
"verified X days ago" could never appear. "Report Issue" and "Write Review" had no click handler at all.

*Fixed:*

- `/api/confirm-venue` records a confirmation through the service role (anon has no INSERT, and the
  original policy demands `auth.uid() = user_id`, which anonymous reporters cannot satisfy).
  Rate-limited to 20 per 10 minutes.
- Yes/No now post, with success and error feedback shown in the card.
- "Report Issue" opens a note box and files a negative confirmation with the text.
- **"Write Review" was briefly removed, then built properly** — see below.

Migration 008 was needed first: `last_confirmed_at` was `max(created_at)` over *all* confirmations,
ignoring `still_there`. Once the buttons started writing rows, reporting a room as gone would have
made the card announce "✅ Verified today" — the opposite of what the reporter said. It now counts
only positive confirmations, and exposes `negative_reports` separately.

### 3a. Search only accepted postal codes — **FIXED**

`app/api/location-search/route.ts`, `components/LocationSearch.tsx`,
`supabase/migrations/012_rename_postal_cache.sql`

The search box was labelled "Search by postal code" and few people know the postal code of a mall.
The endpoint had never actually been postal-code-only — it passed free text to OneMap's search API,
which matches building names and streets just as well — but nothing in the UI said so, and the route,
the query parameter and the cache table were all named after the assumption rather than the behaviour.

*Fixed:* renamed the route to `/api/location-search` with a `q` parameter, relabelled the input
("Search by place or postal code", placeholder "e.g. Bedok Mall, Orchard Road, or 238872"), and
renamed `postal_code_cache` to `location_cache` in migration 012 — a misleading schema name is what
made `seed_nursing_rooms.csv` so easy to misread.

Also added retry with backoff. OneMap rate-limits readily, and without it a burst of searches returned
"lookup failed" for places that exist perfectly well — the same trap that produced 47 false misses in
the geocoding cross-check. Cache keys are lowercased so "bedok mall" and "Bedok Mall" share an entry.

Verified in the browser: typing "Jem" moves the map to Jurong East and lists JEM (0m), Ng Teng Fong
Hospital (381m) and Jurong East Bus Interchange (384m).

### 4-0. Reported problems had nowhere to go — **FIXED**

`supabase/migrations/010_resolvable_reports.sql`, `app/api/admin/reports/route.ts`,
`components/admin/ReportsPanel.tsx`, `components/admin/ReviewsPanel.tsx`, `app/admin/page.tsx`

The "No" button and Report Issue wrote negative confirmations to the database, and the admin portal
had no view of them — so a room could be reported as gone indefinitely with nobody able to see it.
`/api/admin/reviews` had the same defect: the endpoint existed with no UI reaching it.

*Fixed:* the admin dashboard now has three tabs — New rooms, Reported issues, Reviews. Migration 010
adds `resolved_at` and `resolution_note` to `confirmations`, so a handled report can be cleared
without deleting it; a room repeatedly reported as gone stays visible as a pattern even after each
report is closed.

Handling a report is a **decision, not an acknowledgement** (migration 011). Two outcomes:

- **Keep on map** — checked, the room is fine and the report was mistaken. Closes the report.
- **Remove from map** — the room is genuinely gone. Sets `venues.removed_at`, which `nearest_venues`
  now filters on, and closes every open report against that room since they all concerned the same
  thing. Requires a second click to confirm.

Removal is a **soft delete**. A hard delete would cascade through `room_details`, `confirmations`,
`photos` and `reviews` — destroying the very reports that justified the decision, and making a
mistaken removal unrecoverable. Rooms also reopen after refurbishment, so "Put back on map" restores
one in a click.

Verified: a public report reaches the admin list; Remove drops the venue count from 85 to 84 on the
public API; Restore returns it to 85; Keep closes the report with a recorded reason and leaves the map
untouched; an unrecognised action is rejected with 400.

### 4a. Reviews — **BUILT**

`supabase/migrations/009_add_reviews.sql`, `app/api/reviews/route.ts`,
`app/api/admin/reviews/route.ts`, `components/StarRating.tsx`, `components/VenueCard.tsx`

A `reviews` table with a 1–5 star rating and an optional comment, kept deliberately separate from
`confirmations`: those answer "is this room still here", reviews answer "what was it like". Mixing
them would let a one-star review suppress the freshness signal, or a confirmation inflate a rating.

- **Writes go through `/api/reviews` on the service role.** Anon has no INSERT grant, so rating
  bounds, comment length and rate limiting (3 per hour) are enforced server-side rather than trusted
  from the browser.
- **Reviews publish immediately**, because a moderation queue nobody empties makes a feature feel
  dead. An admin can hide abuse afterwards via `PATCH /api/admin/reviews`, gated by `proxy.ts`.
- **Hidden, not deleted.** The RLS policy exposes only `status = 'visible'`, so a hidden review
  vanishes publicly but survives — a moderation mistake is reversible and a pattern of abuse stays
  inspectable.
- Migration 009 also adds `avg_rating` and `review_count` to `nearest_venues`, as scalar subqueries
  rather than another join: joining reviews alongside confirmations would multiply rows and corrupt
  both aggregates.

Verified: post, list, invalid ratings (9 and 2.5) rejected with 400, unknown venue 404, rate limit
429, admin list 401 when unauthenticated, and hide/unhide correctly removing and restoring the review
from the public API.

### 4b. The map snapped back to the user's location — **FIXED**

`app/page.tsx`, `components/Map.tsx`

`Map.tsx` called `setView` whenever the coordinates changed, and `watchPosition` updated them every
few seconds, so panning away was impossible — the view was yanked back constantly. The user marker had
the mirror-image bug: created once and then never moved.

*Fixed:* the map recentres only on an explicit `recenterAt` bump (location button, postal code
search); background GPS just moves the marker. GPS updates under 100 m are ignored entirely, so a
jittery signal no longer refetches the venue list while standing still.

### 4c. `dad_friendly` shown on every venue as "Women Only" — **FIXED**

`components/VenueCard.tsx`, `app/page.tsx`

The flag is false for all 85 venues because the source data never mentions it — so the card rendered
"Women Only" on every room, asserting as fact something nobody had checked, and the filter could only
ever return an empty map.

*Fixed:* removed from both the card and the filter panel. The column and API field remain, so it can
return when there is real data behind it.

### 5a. The Docker image itself — **VERIFIED WORKING**

`Dockerfile`

Built and run end to end on 16 August 2026. The image compiles, starts, serves the map with all 85
venues, enforces the admin gate, and accepts the admin password — all from the container. 280 MB,
multi-stage, non-root user, Next standalone output.

Worth knowing: no `NEXT_PUBLIC_*` values are baked into the client bundle, because the browser never
talks to Supabase directly — only types are imported from `lib/supabase.ts`, and every database call
goes through a server-side API route. So the image carries no secrets and the same build artefact can
be promoted between environments; all four variables are supplied at run time.

This is the deployable path. Use it for Render, Railway, or Fly.io.

### 5b. `docker-compose up` cannot work as documented — **medium**

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

### 10. `postal_code_cache` (now `location_cache`) was publicly writable — **FIXED**

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

### 12. The submissions queue was world-readable — **FIXED**

`supabase/migrations/007_restrict_submission_reads.sql`

`submissions_select_all using (true)` plus an `anon` `SELECT` grant meant anyone with the public anon
key could read every pending and rejected submission, including the free-text notes people type into
the add-a-room form.

*Fixed:* migration 007 revokes the anon grant and drops the public policy. Admin reads already go
through the service role. A narrower policy is left in place for the `authenticated` role
(`submitted_by = auth.uid()`) so that adding user accounts later cannot silently re-expose the queue.

Note this required one code change: `/api/submit-venue` used `.insert(...).select()`, and reading the
row back needs the SELECT permission that was just revoked, so submissions began failing with
Postgres `42501`. The `.select()` is removed — the client only reads that response on failure.

### 13. No rate limiting on submissions — **FIXED**

`lib/rate-limit.ts`, `app/api/submit-venue/route.ts`

Anonymous, unauthenticated, and unthrottled.

*Fixed:* fixed-window limiter, 5 submissions per 10 minutes per client, returning 429 with
`Retry-After`.

Two caveats stated plainly, because the limiter is deliberately simple:

- **State is per-process.** Several instances means several allowances, and a restart resets the
  window. Adequate against casual spam; a shared store (Postgres, Upstash) is wanted for more.
- **The client key is `x-forwarded-for`, which is spoofable** unless a trusted proxy sets it. In local
  dev the header is absent, so every caller shares one bucket.

> **Migration 006 has not yet been applied to a live database.** It was written but not executed —
> Docker was not running at the time. Verify with `supabase start && supabase db reset` before
> relying on it, and confirm postal code search still works afterwards.

---

## Version control — resolved

The Python pipeline and all CSV data previously lived in `~/Desktop/projectfun/`, outside any git
repository — one disk, no history, including the `geocoded_nursing_rooms.csv` that cannot be
regenerated. Everything now lives in `data-pipeline/` and is committed.

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

- [ ] **Set `ADMIN_PASSWORD` in the production environment.** The admin surface returns 503 until you
      do — deliberately, so a missing variable can never mean an open door.
- [ ] **Manually review the 11 flagged venues** in `data-pipeline/geocode_review.csv`, starting with
      Changi Airport (`CONFLICT`) and Millennia Walk (`NO_ONEMAP_MATCH`).
- [ ] **Stand up production Supabase** — hosted project, `supabase db push`, then import the seed CSV.
      Note the importer needs `tsx`, not `ts-node` (issue #7).
- [ ] **Settle data rights** with BMSG and SassyMama; the repo is public.
- [ ] **Decide what to do about `dad_friendly` and `has_diaper_mat`** — both are correctly false for
      every venue because the source data says nothing about them. Consider hiding those two
      checkboxes until the data supports them, rather than shipping filters that always return zero.
- [x] ~~Fix the production build~~ (issue #8)
- [x] ~~Fix the Dockerfile Node version~~ (issue #9)
- [x] ~~Close the anonymous write holes~~ (issues #10, #11)
- [x] ~~Make the amenity filters work~~ (issues #2, #3)
- [x] ~~Apply migration 006 to a live database~~ — verified 15 Aug: all six migrations apply from
      scratch, anon writes rejected with 401, reads unaffected, postal code lookup still works
- [x] ~~Get the pipeline and CSVs into version control~~
- [x] ~~Populate the diaper amenity columns in the importer~~ — `can_buy_diaper` now flags 6 venues
- [x] ~~Cross-check the geocoding~~ — 74 of 85 confirmed within 150 m
- [x] ~~Authenticate the admin surface~~ (issue #1)
- [x] ~~Restrict submission reads~~ (issue #12)
- [x] ~~Rate-limit submissions~~ (issue #13)

Worth doing, but not blocking:

1. **Either build `/api/confirm-venue` or remove the verification UI** (issue #4) so the interface
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
