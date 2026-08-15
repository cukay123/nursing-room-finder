"""
Merges bmsg_nursing_rooms.csv and sassymama_nursing_rooms.csv into a single
seed file (matching the schema geocode_onemap.py expects), and de-duplicates
venues that appear in both sources (e.g. "Paragon" / "Paragon Shopping Centre").

Usage:
    python merge_sources.py
Output:
    seed_nursing_rooms_merged.csv
"""

import csv
from difflib import SequenceMatcher

BMSG_CSV = "bmsg_nursing_rooms.csv"
SASSYMAMA_CSV = "sassymama_nursing_rooms.csv"
OUTPUT_CSV = "seed_nursing_rooms_merged.csv"

DEDUP_THRESHOLD = 0.75  # how similar two names need to be to count as "same place"


def normalize(name):
    return name.lower().replace("shopping centre", "").replace("shopping mall", "").strip()


def similar(a, b):
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()


def load_csv(path, source_label):
    try:
        with open(path, newline="", encoding="utf-8") as f:
            return list(csv.DictReader(f))
    except FileNotFoundError:
        print(f"! {path} not found — run the {source_label} scraper first. Skipping.")
        return []


def main():
    bmsg_rows = load_csv(BMSG_CSV, "BMSG")
    sassymama_rows = load_csv(SASSYMAMA_CSV, "Sassy Mama")

    merged = []

    # Sassy Mama rows go in first since they usually have known_address already
    for row in sassymama_rows:
        merged.append({
            "name": row.get("name", ""),
            "type": "Nursing Room",  # Sassy Mama doesn't distinguish pod/family room
            "location_level": row.get("location_level", ""),
            "amenities_notes": row.get("amenities_notes", ""),
            "known_address": row.get("known_address", ""),
            "source": "SassyMama",
        })

    # BMSG rows: merge into an existing similar entry if found, else add new
    for row in bmsg_rows:
        name = row.get("name", "")
        match = None
        for existing in merged:
            if similar(name, existing["name"]) >= DEDUP_THRESHOLD:
                match = existing
                break

        if match:
            match["source"] = f"{match['source']}+BMSG"
            # Prefer BMSG's type classification (Nursing Room / Pod / Family Room)
            if row.get("type"):
                match["type"] = row["type"]
            # Append BMSG notes/feedback if not already captured
            extra_notes = row.get("amenities_notes", "")
            if extra_notes and extra_notes not in match["amenities_notes"]:
                match["amenities_notes"] = f"{match['amenities_notes']}; {extra_notes}".strip("; ")
        else:
            merged.append({
                "name": name,
                "type": row.get("type", "Nursing Room"),
                "location_level": row.get("location_level", ""),
                "amenities_notes": row.get("amenities_notes", ""),
                "known_address": "",  # BMSG rarely has full addresses
                "source": "BMSG",
            })

    fieldnames = ["name", "type", "location_level", "amenities_notes", "known_address", "source"]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(merged)

    print(f"Merged {len(sassymama_rows)} SassyMama + {len(bmsg_rows)} BMSG rows "
          f"-> {len(merged)} unique venues in {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
