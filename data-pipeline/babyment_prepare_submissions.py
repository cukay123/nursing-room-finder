"""
Prepare the venues babyment lists but our map lacks, as PENDING SUBMISSIONS.

Deliberately not inserted as venues: they go into the same review queue a parent's
submission lands in, so each one is approved, merged into an existing room, or
rejected by hand. Nobody has verified these on the ground.
"""

import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request

S = "/private/tmp/claude-501/-Users-anjasjefrianto-Desktop-projectfun/b5826731-59b7-4858-884c-8ebad11389bf/scratchpad"
URL, SEC = sys.argv[1], sys.argv[2]
UA = "Mozilla/5.0 (compatible; nursing-room-finder)"
DETAIL = "https://www.babyment.com/nursing-room/nursing-room.php?nursingroom_id="

H = {"apikey": SEC, "Authorization": f"Bearer {SEC}", "Content-Type": "application/json",
     "Prefer": "return=representation"}


def fetch(url, headers=None, timeout=30):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")


def parse_detail(page):
    body = re.sub(r"(?is)<(script|style).*?</\1>", " ", page)
    fields = {}
    for row in re.findall(r"(?is)<tr[^>]*>(.*?)</tr>", body):
        cells = [
            html.unescape(re.sub(r"(?is)<[^>]+>", " ", c)).strip()
            for c in re.findall(r"(?is)<t[dh][^>]*>(.*?)</t[dh]>", row)
        ]
        cells = [re.sub(r"\s+", " ", c) for c in cells if c.strip()]
        # Rows are label/value pairs, sometimes two pairs per row.
        for i in range(0, len(cells) - 1, 2):
            label = cells[i].rstrip(":").strip().lower()
            if label:
                fields[label] = cells[i + 1]
    return fields


def amenities_from(fields):
    facilities = fields.get("other facilities", "").lower()
    electrical = fields.get("electrical point", "").strip().lower()

    return {
        "has_lock": "lock" in facilities,
        "has_sink": "sink" in facilities,
        "has_changing_table": ("changing station" in facilities
                               or "changing table" in facilities
                               or "diaper chang" in facilities),
        "has_power_outlet": electrical.startswith("yes"),
        # babyment does not report these, so they stay false rather than guessed.
        "stroller_friendly": False,
        "dad_friendly": False,
        "has_diaper_mat": "changing mat" in facilities or "diaper mat" in facilities,
        "can_buy_diaper": "vending" in facilities or "diaper dispenser" in facilities,
    }


def geocode(query):
    q = urllib.parse.quote(query)
    try:
        data = json.loads(fetch(f"http://localhost:3100/api/location-search?q={q}"))
    except Exception:
        return None
    if "latitude" not in data:
        return None
    return data


def insert(body):
    req = urllib.request.Request(f"{URL}/rest/v1/submissions", method="POST",
                                 data=json.dumps(body).encode(), headers=H)
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode())


missing = json.load(open(f"{S}/missing.json"))
# IKEA at Alexandra duplicates the IKEA we already hold; HarbourFront Centre was
# deliberately removed after two reports. Neither belongs in a "missing" import.
SKIP = {"IKEA at Alexandra", "Harbourfront Centre"}
missing = [m for m in missing if m["name"] not in SKIP]

prepared, failed = 0, []

for i, venue in enumerate(missing, 1):
    name = venue["name"]
    try:
        fields = parse_detail(fetch(DETAIL + venue["id"]))
    except Exception as exc:
        failed.append((name, f"detail fetch: {exc}"))
        continue

    address = fields.get("nursing room address", "").strip()
    floor = fields.get("nursing room location", "").strip()
    hours = fields.get("opening hours", "").strip()
    contact = fields.get("contact number", "").strip()
    hot = fields.get("hot water dispenser", "").strip()
    cold = fields.get("cold water dispenser", "").strip()

    time.sleep(1.2)

    # Prefer the published address: far more precise than a mall name alone.
    geo = geocode(address) if address else None
    if not geo:
        geo = geocode(f"{name} Singapore")
    time.sleep(1.4)

    if not geo:
        failed.append((name, "could not geocode"))
        continue

    postal = ""
    m = re.search(r"\b(\d{6})\b", address)
    if m:
        postal = m.group(1)

    notes = [f"Imported from babyment.com ({venue['area']}) for review — not yet verified on site."]
    if hours:
        notes.append(f"Hours: {hours}")
    if contact:
        notes.append(f"Contact: {contact}")
    water = []
    if hot.lower().startswith("yes"):
        water.append("hot")
    if cold.lower().startswith("yes"):
        water.append("cold")
    if water:
        notes.append(f"Water dispenser: {' and '.join(water)}")
    if fields.get("other facilities"):
        notes.append(f"Listed facilities: {fields['other facilities']}")

    insert({
        "submitted_by": None,
        "status": "pending",
        "payload": {
            "name": name,
            "type": "Nursing Room",
            "address": address or None,
            "postalCode": postal,
            "floorLevel": floor,
            "latitude": geo["latitude"],
            "longitude": geo["longitude"],
            "amenities": amenities_from(fields),
            "notes": " · ".join(notes),
            "source": "USER_SUBMITTED",
            "locationSource": "geocoded",
            "geocodedAddress": geo.get("matchedAddress"),
        },
    })

    prepared += 1
    print(f"  [{i}/{len(missing)}] {name}")

print(f"\nPrepared {prepared} submissions for review.")
if failed:
    print(f"Could not prepare {len(failed)}:")
    for n, why in failed:
        print(f"  - {n}: {why}")
