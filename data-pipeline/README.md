# Data pipeline

Produces the seed dataset of Singapore nursing rooms that `scripts/import-venues.ts`
loads into Supabase.

## The actual flow

```
scrape_bmsg.py         ──> bmsg_nursing_rooms.csv        (20 rows)
scrape_sassymama.py    ──> sassymama_nursing_rooms.csv   (75 rows)
                                    │
                    merge_sources.py│  (fuzzy name dedup, ratio >= 0.75)
                                    ▼
                        seed_nursing_rooms_merged.csv    (85 rows)
                                    │
                                    │  *** MANUAL CURATION — no script ***
                                    ▼
                        seed_nursing_rooms.csv           (85 rows)  <-- geocoding input
                                    │
                    geocode_onemap.py│  (OneMap Search API)
                                    ▼
                        geocoded_nursing_rooms.csv       (85 rows)  <-- importer input
```

## Read this before touching the data

**`seed_nursing_rooms.csv` is hand-curated and is the real source of truth.** It is
*not* the output of `merge_sources.py`, despite the similar name. Someone took the
merged file and cleaned it by hand: all 85 rows have a proper street address, and
the amenity notes are tidy semicolon lists (`Lockable cubicles; wash basin; power
points`) rather than scraped prose.

The auto-merged file only manages 52 of 85 addresses, because BMSG publishes no
addresses at all and 21 SassyMama rows scraped empty. **Regenerating
`seed_nursing_rooms.csv` from `merge_sources.py` would be a downgrade** — you would
lose 33 hand-added addresses. Treat the merged file as an input to curation, not a
replacement for it.

**`geocoded_nursing_rooms.csv` cannot be fully reproduced.** 47 of its 85 rows carry
`match_confidence=NOMINATIM`, from a Nominatim fallback pass that exists in no script
here. Re-running `geocode_onemap.py` will not reproduce them — it only calls OneMap.
Preserve existing coordinates rather than overwriting them wholesale.

## Known data limitations

- **21 of 75 SassyMama rows scraped completely empty** (heading found, no body). They
  survive in the curated seed only because addresses were added by hand.
- **Geocode confidence**: 19 `HIGH`, 19 `LOW_REVIEW`, 47 `NOMINATIM`. The
  `LOW_REVIEW` rows were flagged for manual checking that never happened.
- **`dad_friendly` matches nothing.** The importer's regex looks for dad/father/gender
  wording that does not appear in the curated notes for any of the 85 venues.
- The SassyMama scraper parses by text pattern, not CSS structure, and supplies most
  of the dataset. Expect it to break when the article is restyled.

## Running it

```bash
pip install requests beautifulsoup4

python scrape_bmsg.py          # -> bmsg_nursing_rooms.csv
python scrape_sassymama.py     # -> sassymama_nursing_rooms.csv
python merge_sources.py        # -> seed_nursing_rooms_merged.csv
# curate by hand into seed_nursing_rooms.csv
python geocode_onemap.py       # -> geocoded_nursing_rooms.csv
```

Then import (from the repo root, and note it needs `tsx`, not `ts-node`):

```bash
npx tsx scripts/import-venues.ts data-pipeline/geocoded_nursing_rooms.csv
```

## Repair history

`repair_sassymama.py` is a one-off fix, already applied. The original scrape used a
too-greedy `ADDRESS_RE` whose segment class excluded only commas, so it anchored at
the start of each chunk and swallowed whole paragraphs up to the postal code. That
put prose into `known_address` and left a duplicate address in `amenities_notes`.
The regex in `scrape_sassymama.py` is now bounded, so fresh scrapes are correct.

This corruption affected only the intermediate scraper output. It never reached
`seed_nursing_rooms.csv` (hand-curated) and therefore never reached the database.

## `duplicates/`

Browser-download copies kept for safety: `geocode_onemap (1).py` is byte-identical to
`geocode_onemap.py`, and the two `seed_nursing_rooms (N).csv` files are identical to
each other but differ from the curated seed. Safe to delete once you have confirmed
the canonical set.

## Coverage check against babyment.com

`babyment_scan.py` walks babyment.com's 38 area pages and records every venue it
lists. `babyment_prepare_submissions.py` takes the ones our map lacks, reads each
detail page for floor level and amenities, geocodes the published address, and
inserts them as **pending submissions** — not venues.

That distinction is deliberate. Nobody has verified these rooms on the ground, so
they go into the same review queue a parent's submission lands in, where each one
is approved, merged into an existing room, or rejected by hand.

```bash
python babyment_scan.py                                    # -> babyment.json
# diff against the live venue list, writing missing.json
python babyment_prepare_submissions.py "$SUPABASE_URL" "$SUPABASE_SECRET_KEY"
```

Both scripts pace themselves (roughly a second between requests) against babyment
and OneMap alike. The prepare step needs the dev server running, since it geocodes
through `/api/location-search`.

**Amenity mapping.** babyment reports "Other facilities" as free text plus explicit
yes/no for water dispensers and electrical points. Only what it states is recorded:
stroller access and dad-friendliness are never mentioned there, so they stay false
rather than guessed.

**Rights.** This roughly doubles the dataset from a third source. Settle attribution
with babyment as well as BMSG and SassyMama before relying on it publicly.

## Backups

`backup_supabase.py` dumps every table to CSV in `backup/`, for committing.

Everything the app knows lives in one hosted Supabase project, and the free tier
has no point-in-time recovery — a mistaken DELETE or a bad merge has no undo.
These CSVs are the undo.

```bash
cd data-pipeline && python backup_supabase.py     # reads ../.env.local
git add backup && git commit -m "Back up database"
```

Filenames are fixed rather than timestamped, so `git diff` shows what actually
changed between runs. Worth re-running before anything that edits data in bulk,
and after clearing a submission queue.

Two details that matter for restoring:

- **Venue positions round-trip.** PostgREST returns PostGIS geography as WKB hex;
  the `location` column is kept verbatim so it restores exactly, and decoded
  `latitude`/`longitude` columns are added so the file can be read by a human.
- **Removed rooms are included.** They are absent from the live map but still in
  the table, and a backup that dropped them would quietly lose the record of what
  was taken down and why.

Restoring is a paste job, not a script: the CSVs go back through the Supabase
dashboard's table import, or `psql \copy` against the connection string.
