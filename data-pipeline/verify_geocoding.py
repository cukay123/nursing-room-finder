"""
Cross-check the coordinates in geocoded_nursing_rooms.csv against a fresh OneMap
lookup, and produce a shortlist of venues that need human eyes.

This is deliberately NON-DESTRUCTIVE. It never writes geocoded_nursing_rooms.csv —
47 of those 85 rows came from a Nominatim pass that exists in no script here and
cannot be regenerated, so overwriting them would lose data permanently. Output goes
to a separate review file.

Usage (from data-pipeline/):
    pip install requests
    python verify_geocoding.py

Output:
    geocode_review.csv — one row per venue, worst-first

Verdicts:
    CONFIRMED         OneMap agrees within 150 m. Good.
    DRIFT             150 m - 1 km apart. Probably the same building, worth a glance.
    CONFLICT          More than 1 km apart. One of the two is wrong.
    NO_ONEMAP_MATCH   OneMap found nothing. Existing coordinate is unverifiable here.
"""

import csv
import math
import time

import requests

ONEMAP_SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search"
GEOCODED_CSV = "geocoded_nursing_rooms.csv"
OUTPUT_CSV = "geocode_review.csv"
REQUEST_DELAY_SECONDS = 1.0  # OneMap returns 429 well before 0.3s spacing
MAX_RETRIES = 4

CONFIRMED_METRES = 150
DRIFT_METRES = 1000


def haversine_metres(lat1, lon1, lat2, lon2):
    radius = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


class LookupError_(Exception):
    """OneMap could not be reached — distinct from OneMap having no match."""


def onemap_lookup(query):
    """Return (lat, lng, matched_address) for the top hit, or None for no match.

    Raises LookupError_ if the API never answered. A rate-limited request is not
    evidence that a venue is missing, so the two cases must not be conflated.
    """
    if not query.strip():
        return None

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(
                ONEMAP_SEARCH_URL,
                params={
                    "searchVal": query,
                    "returnGeom": "Y",
                    "getAddrDetails": "Y",
                    "pageNum": 1,
                },
                timeout=15,
            )
            if resp.status_code == 429:
                backoff = 2 ** attempt
                print(f"    rate limited, backing off {backoff}s...")
                time.sleep(backoff)
                continue
            resp.raise_for_status()
            results = resp.json().get("results") or []
        except (requests.RequestException, ValueError) as exc:
            if attempt == MAX_RETRIES - 1:
                raise LookupError_(str(exc)) from exc
            time.sleep(2 ** attempt)
            continue

        if not results:
            return None

        top = results[0]
        try:
            return float(top["LATITUDE"]), float(top["LONGITUDE"]), top.get("ADDRESS", "")
        except (KeyError, TypeError, ValueError):
            return None

    raise LookupError_(f"rate limited after {MAX_RETRIES} attempts")


def classify(distance, lookup_failed=False):
    if lookup_failed:
        return "LOOKUP_ERROR"
    if distance is None:
        return "NO_ONEMAP_MATCH"
    if distance <= CONFIRMED_METRES:
        return "CONFIRMED"
    if distance <= DRIFT_METRES:
        return "DRIFT"
    return "CONFLICT"


def main():
    with open(GEOCODED_CSV, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    print(f"Cross-checking {len(rows)} venues against OneMap...\n")
    reviewed = []

    for i, row in enumerate(rows, 1):
        name = row["name"]

        # Prefer the curated street address; fall back to the venue name.
        query = row.get("known_address", "").strip() or name
        lookup_failed = False
        try:
            hit = onemap_lookup(query)
            if hit is None and query != name:
                hit = onemap_lookup(name)
        except LookupError_ as exc:
            print(f"  ! {name[:34]}: {exc}")
            hit, lookup_failed = None, True

        try:
            old_lat = float(row["latitude"])
            old_lng = float(row["longitude"])
        except (TypeError, ValueError):
            old_lat = old_lng = None

        distance = None
        new_lat = new_lng = matched = ""

        if hit and old_lat is not None:
            new_lat, new_lng, matched = hit
            distance = haversine_metres(old_lat, old_lng, new_lat, new_lng)

        verdict = classify(distance, lookup_failed)
        reviewed.append({
            "name": name,
            "verdict": verdict,
            "distance_m": f"{distance:.0f}" if distance is not None else "",
            "existing_confidence": row.get("match_confidence", ""),
            "existing_lat": row.get("latitude", ""),
            "existing_lng": row.get("longitude", ""),
            "onemap_lat": new_lat,
            "onemap_lng": new_lng,
            "known_address": row.get("known_address", ""),
            "onemap_address": matched,
        })

        print(f"  [{i:>2}/{len(rows)}] {name[:34]:36} {verdict}"
              + (f" ({distance:.0f} m)" if distance is not None else ""))
        time.sleep(REQUEST_DELAY_SECONDS)

    order = {"CONFLICT": 0, "NO_ONEMAP_MATCH": 1, "LOOKUP_ERROR": 2,
             "DRIFT": 3, "CONFIRMED": 4}
    reviewed.sort(key=lambda r: (order[r["verdict"]], -float(r["distance_m"] or 0)))

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(reviewed[0].keys()))
        writer.writeheader()
        writer.writerows(reviewed)

    print(f"\nWrote {OUTPUT_CSV}\n")
    counts = {}
    for r in reviewed:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1
    for verdict in ("CONFIRMED", "DRIFT", "CONFLICT", "NO_ONEMAP_MATCH",
                    "LOOKUP_ERROR"):
        print(f"  {verdict:18} {counts.get(verdict, 0)}")

    needs_eyes = sum(counts.get(v, 0) for v in ("CONFLICT", "NO_ONEMAP_MATCH", "DRIFT"))
    print(f"\n{needs_eyes} venues need manual review (top of {OUTPUT_CSV}).")


if __name__ == "__main__":
    main()
