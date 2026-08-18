"""
Dump the hosted Supabase tables to CSV, for committing alongside the code.

Why this exists: everything the app knows lives in one hosted Supabase project,
and the free tier has no point-in-time recovery. A mistaken DELETE or a bad merge
has no undo. These CSVs are the undo — the same insurance the scraped seed data
got when it moved into version control.

Fixed filenames rather than timestamped ones, so `git diff` shows what actually
changed between runs instead of a wall of new files.

Usage, from data-pipeline/:
    python backup_supabase.py                       # reads ../.env.local
    python backup_supabase.py <url> <service_key>   # or pass them explicitly

Restoring is a paste job, not a script: the CSVs go back through the Supabase
dashboard's table import, or psql \\copy against the connection string. Venue
positions round-trip through the `location` column, which is kept verbatim.
"""

import csv
import json
import os
import re
import struct
import sys
import urllib.parse
import urllib.request

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backup")

# photos is included though currently empty: if uploads ever start working, a
# backup that silently omits them would be worse than no backup.
TABLES = [
    "venues",
    "room_details",
    "submissions",
    "confirmations",
    "reviews",
    "location_cache",
    "photos",
]


def read_env():
    env_path = os.path.join(os.path.dirname(OUT_DIR), "..", ".env.local")
    values = {}
    try:
        with open(env_path) as f:
            for line in f:
                m = re.match(r"^([A-Z_]+)=(.*)$", line.strip())
                if m:
                    values[m.group(1)] = m.group(2)
    except FileNotFoundError:
        return None, None
    return values.get("SUPABASE_URL"), values.get("SUPABASE_SECRET_KEY")


def decode_point(wkb_hex):
    """Extended WKB point -> (lat, lng).

    PostgREST returns PostGIS geography as WKB hex, e.g.
    0101000020E6100000... : byte order, type with SRID flag, SRID, then two
    little-endian doubles (X = longitude, Y = latitude).
    """
    try:
        raw = bytes.fromhex(wkb_hex)
        if len(raw) < 25:
            return None, None
        lng, lat = struct.unpack_from("<dd", raw, 9)
        return round(lat, 8), round(lng, 8)
    except (ValueError, struct.error):
        return None, None


def fetch_all(url, key, table):
    """Page through the table; PostgREST caps a single response."""
    rows, offset, page = [], 0, 1000
    while True:
        q = urllib.parse.urlencode({"select": "*", "offset": offset, "limit": page})
        req = urllib.request.Request(
            f"{url}/rest/v1/{table}?{q}",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            batch = json.loads(r.read().decode())
        rows.extend(batch)
        if len(batch) < page:
            return rows
        offset += page


def main():
    if len(sys.argv) >= 3:
        url, key = sys.argv[1], sys.argv[2]
    else:
        url, key = read_env()

    if not url or not key:
        sys.exit("Need SUPABASE_URL and SUPABASE_SECRET_KEY (in ../.env.local or as arguments)")

    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0

    for table in TABLES:
        try:
            rows = fetch_all(url, key, table)
        except Exception as exc:
            print(f"  ! {table}: {exc}")
            continue

        # Readable coordinates alongside the verbatim geometry, so a human can
        # sanity-check the file without a WKB decoder.
        if table == "venues":
            for row in rows:
                if isinstance(row.get("location"), str):
                    lat, lng = decode_point(row["location"])
                    row["latitude"], row["longitude"] = lat, lng

        path = os.path.join(OUT_DIR, f"{table}.csv")

        if not rows:
            # Still write the file: an empty table is information, and a missing
            # file looks like a failed backup.
            open(path, "w").close()
            print(f"  {table:16} 0 rows (empty)")
            continue

        fieldnames = sorted({k for row in rows for k in row})
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in rows:
                writer.writerow({
                    k: json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v
                    for k, v in row.items()
                })

        total += len(rows)
        print(f"  {table:16} {len(rows)} rows")

    print(f"\nBacked up {total} rows to {OUT_DIR}")


if __name__ == "__main__":
    main()
