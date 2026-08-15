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
