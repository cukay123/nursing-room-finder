"""One-off coverage check: which venues babyment lists that our database lacks."""

import html
import json
import re
import time
import urllib.parse
import urllib.request

AREAS = [
    "Ang Mo Kio", "Bedok", "Bidadari", "Bishan", "Bukit Batok", "Bukit Merah",
    "Bukit Panjang", "Bukit Timah", "Canberra", "CBD", "Choa Chu Kang", "Clementi",
    "Eunos", "Geylang", "Holland", "Hougang", "Joo Chiat", "Jurong East",
    "Jurong West", "Kallang", "Katong", "Macpherson", "Marine Parade", "Pasir Ris",
    "Potong Pasir", "Punggol", "Queenstown", "Sembawang", "Sengkang", "Serangoon",
    "Simei", "Tampines", "Telok Blangah", "Thomson", "Tiong Bahru", "Toa Payoh",
    "Woodlands", "Yishun",
]

BASE = "https://www.babyment.com/nursing-room/nursing-room-area.php?area="
UA = "Mozilla/5.0 (compatible; nursing-room-finder coverage check)"

# <a href="nursing-room.php?nursingroom_id=11" title="Details of Nursing Room at Bedok Mall">
LINK = re.compile(
    r'nursing-room\.php\?nursingroom_id=(\d+)"\s+title="Details of Nursing Room at ([^"]+)"'
)

found = {}

for area in AREAS:
    url = BASE + urllib.parse.quote(area)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            page = r.read().decode("utf-8", "ignore")
    except Exception as exc:
        print(f"  ! {area}: {exc}")
        continue

    hits = LINK.findall(page)
    for vid, name in hits:
        found[vid] = {"id": vid, "name": html.unescape(name).strip(), "area": area}

    print(f"  {area:16} {len(hits)} venue(s)")
    time.sleep(1.2)  # be polite

with open("/private/tmp/claude-501/-Users-anjasjefrianto-Desktop-projectfun/b5826731-59b7-4858-884c-8ebad11389bf/scratchpad/babyment.json", "w") as f:
    json.dump(list(found.values()), f, indent=2)

print(f"\nTotal distinct venues on babyment: {len(found)}")
