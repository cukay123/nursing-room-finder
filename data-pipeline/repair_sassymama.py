"""
One-off repair for sassymama_nursing_rooms.csv.

The original scrape was run with a too-greedy ADDRESS_RE (see the comment in
scrape_sassymama.py). The consequences, per row:

    location_level   got the real descriptive prose ("Levels B3, 1 and 5 Expect
                     changing stations, nursing cubicles with armchairs...")
    known_address    got a paragraph of prose ending in the postal code
    amenities_notes  got what was left over — usually "<name>, <address>, <website>"

So the amenity keyword parser downstream has been reading address strings, and
the geocoder has been fed prose blobs. This script re-derives the three columns
from the text already present, so the fix does not depend on re-scraping a site
that may have changed since.

Run from data-pipeline/:
    python repair_sassymama.py

Rewrites sassymama_nursing_rooms.csv in place. The pre-repair version is in git
history if you need to diff against it.
"""

import csv
import re

CSV_PATH = "sassymama_nursing_rooms.csv"

# Same bounded pattern now used by the scraper.
ADDRESS_RE = re.compile(
    r"((?:[^,.]{1,60},\s*){0,3}[^,.]{1,60},\s*Singapore\s*\d{6})", re.IGNORECASE
)

# Leading floor/level descriptor, stopping where prose starts. Best-effort:
# floor_level is display-only, so an occasional overrun is tolerable.
FLOOR_RE = re.compile(
    r"^\s*((?:Levels?|Basements?|B\d|L\d|#[\w\-]+|Ground\s+floor|Mezzanine)\b.*?)"
    r"(?=\s+(?:Expect|There|The|This|These|A|An|Head|You|Nursing|Mums|Parents|It|"
    r"Located|With|Inside|Next|Available|Both|Two|Three|Four|Five|Do|If|Note|Plus|Also)\b|$)",
    re.IGNORECASE,
)

FLOOR_MAX_LEN = 60


def repair(row):
    """Re-derive the three damaged columns from whatever text the row holds."""
    prose = row.get("location_level", "").strip()

    # Search each field separately rather than concatenating them. The address
    # usually appears in both, and a joined haystack lets the segment class run
    # across the boundary and capture the address twice.
    address = ""
    for field in ("amenities_notes", "known_address"):
        match = ADDRESS_RE.search(row.get(field, ""))
        if match:
            address = match.group(1).strip(" ,")
            break

    floor = ""
    floor_match = FLOOR_RE.match(prose)
    if floor_match:
        floor = floor_match.group(1).strip(" ,;")[:FLOOR_MAX_LEN]

    return {
        **row,
        "location_level": floor,
        "known_address": address,
        # The descriptive prose is what the amenity parser actually needs.
        "amenities_notes": prose,
    }


def main():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    repaired = [repair(r) for r in rows]

    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(repaired)

    with_address = sum(1 for r in repaired if r["known_address"])
    with_floor = sum(1 for r in repaired if r["location_level"])
    with_notes = sum(1 for r in repaired if r["amenities_notes"])
    empty = sum(1 for r in repaired if not any(
        r[k] for k in ("location_level", "known_address", "amenities_notes")
    ))

    print(f"Repaired {len(repaired)} rows -> {CSV_PATH}")
    print(f"  with address : {with_address}")
    print(f"  with floor   : {with_floor}")
    print(f"  with notes   : {with_notes}")
    print(f"  entirely empty (scrape found heading but no body): {empty}")


if __name__ == "__main__":
    main()
