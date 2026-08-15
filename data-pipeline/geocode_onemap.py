"""
Enrich nursing room seed data with exact address, postal code, and lat/lng
using Singapore's OneMap Search API (free, no API key needed for this endpoint).

Usage:
    pip install requests
    python geocode_onemap.py

Input:  seed_nursing_rooms.csv  (name, type, location_level, amenities_notes, known_address, source)
Output: geocoded_nursing_rooms.csv  (adds: onemap_address, postal_code, latitude, longitude,
                                      building_match, match_confidence)

Strategy:
- If we already have a known_address, search using that (most accurate — OneMap
  is very good at matching a real street address to a postal code).
- If we don't, search using just the name (mall/building name). This is fuzzier,
  so we flag it for manual review rather than trusting it blindly.
- We do NOT overwrite your original columns — this produces a new enriched file
  so you can diff / spot-check before merging into your "final" dataset.
"""

import csv
import time
import requests
from difflib import SequenceMatcher

ONEMAP_SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search"
INPUT_CSV = "seed_nursing_rooms.csv"
OUTPUT_CSV = "geocoded_nursing_rooms.csv"
REQUEST_DELAY_SECONDS = 0.3  # be polite to the free public API


def onemap_search(query, page=1):
    """Call OneMap's search endpoint. Returns list of result dicts (may be empty)."""
    params = {
        "searchVal": query,
        "returnGeom": "Y",
        "getAddrDetails": "Y",
        "pageNum": page,
    }
    try:
        resp = requests.get(ONEMAP_SEARCH_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return data.get("results", [])
    except (requests.RequestException, ValueError) as e:
        print(f"  ! OneMap request failed for '{query}': {e}")
        return []


def similarity(a, b):
    """Rough string similarity 0-1, used to sanity-check that the top OneMap
    result actually corresponds to the place we searched for."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def geocode_row(name, known_address):
    """
    Try known_address first (more reliable), fall back to name-only search.
    Returns a dict of enrichment fields.
    """
    query = known_address if known_address.strip() else name
    results = onemap_search(query)

    if not results:
        # Fallback: if we searched an address and got nothing, try the bare name
        if known_address.strip():
            results = onemap_search(name)

    if not results:
        return {
            "onemap_address": "",
            "postal_code": "",
            "latitude": "",
            "longitude": "",
            "building_match": "",
            "match_confidence": "NO_MATCH",
        }

    top = results[0]
    building = top.get("BUILDING", "")
    confidence = similarity(name, building) if building else 0

    return {
        "onemap_address": top.get("ADDRESS", ""),
        "postal_code": top.get("POSTAL", ""),
        "latitude": top.get("LATITUDE", ""),
        "longitude": top.get("LONGITUDE", ""),
        "building_match": building,
        "match_confidence": "HIGH" if confidence > 0.6 else "LOW_REVIEW",
    }


def main():
    with open(INPUT_CSV, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    fieldnames = list(rows[0].keys()) + [
        "onemap_address",
        "postal_code",
        "latitude",
        "longitude",
        "building_match",
        "match_confidence",
    ]

    enriched = []
    for i, row in enumerate(rows, 1):
        name = row["name"]
        known_address = row.get("known_address", "") or ""
        print(f"[{i}/{len(rows)}] Geocoding: {name}")

        enrichment = geocode_row(name, known_address)
        row.update(enrichment)
        enriched.append(row)

        time.sleep(REQUEST_DELAY_SECONDS)

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(enriched)

    no_match = sum(1 for r in enriched if r["match_confidence"] == "NO_MATCH")
    low_review = sum(1 for r in enriched if r["match_confidence"] == "LOW_REVIEW")
    print(f"\nDone. Wrote {len(enriched)} rows to {OUTPUT_CSV}")
    print(f"  {no_match} rows had no OneMap match at all (need manual lookup)")
    print(f"  {low_review} rows matched but with low name-similarity (spot-check these)")


if __name__ == "__main__":
    main()
