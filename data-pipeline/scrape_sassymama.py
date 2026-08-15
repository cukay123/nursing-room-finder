"""
Scraper for Sassy Mama's "Handy List Of Best Nursing Rooms In Singapore" guide.
The page structure is a series of <h2> headings ("1. 313@Somerset", "2. Anchorpoint...")
each followed by a paragraph containing "Location: ..." text, and then a paragraph/line
with the venue name in bold followed by its full street address and website.

Because this is a long-form article (not a clean table), the parsing here relies on
text patterns rather than rigid CSS structure. It's more fragile than the BMSG scraper —
if Sassy Mama tweaks their article layout, you'll likely need to adjust the regexes below.

Usage:
    pip install requests beautifulsoup4
    python scrape_sassymama.py
Output:
    sassymama_nursing_rooms.csv
"""

import csv
import re
import requests
from bs4 import BeautifulSoup

URL = "https://www.sassymamasg.com/singapore-nursing-room-ultimate-guide/"
OUTPUT_CSV = "sassymama_nursing_rooms.csv"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}

# Matches headings like "1. 313@Somerset" or "12. Changi Airport"
HEADING_RE = re.compile(r"^\s*\d+\.\s*(.+)$")

# Matches a Singapore postal address ending in "Singapore NNNNNN"
ADDRESS_RE = re.compile(r"([^,]+(?:,[^,]+)*?,\s*Singapore\s*\d{6})", re.IGNORECASE)


def main():
    resp = requests.get(URL, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    # The article body usually lives inside a <article> or main content div.
    # We fall back to the whole soup if we can't find a narrower container.
    article = soup.find("article") or soup

    rows = []
    headings = article.find_all(["h2"])
    print(f"Found {len(headings)} h2 headings")

    for h in headings:
        heading_text = h.get_text(strip=True)
        m = HEADING_RE.match(heading_text)
        if not m:
            continue  # not a numbered venue heading (e.g. could be an intro heading)

        name = m.group(1).strip()

        # Walk forward through sibling elements until the next h2, collecting text
        chunk_texts = []
        node = h.find_next_sibling()
        while node and node.name != "h2":
            chunk_texts.append(node.get_text(separator=" ", strip=True))
            node = node.find_next_sibling()
        chunk = " ".join(chunk_texts)

        # Extract "Location: ..." — usually ends at a line break or double space
        location_match = re.search(r"Location:\s*(.+?)(?:\.\s|\n|$)", chunk)
        location = location_match.group(1).strip() if location_match else ""

        # Extract address (text ending in "Singapore NNNNNN")
        address_match = ADDRESS_RE.search(chunk)
        address = address_match.group(1).strip() if address_match else ""

        # Everything else is treated as free-text amenities/notes —
        # strip out the location/address fragments we already extracted
        notes = chunk
        if location_match:
            notes = notes.replace(location_match.group(0), " ")
        if address_match:
            notes = notes.replace(address_match.group(0), " ")
        notes = re.sub(r"\s+", " ", notes).strip()[:500]  # cap length, collapse whitespace

        rows.append({
            "name": name,
            "location_level": location,
            "known_address": address,
            "amenities_notes": notes,
            "source": "SassyMama",
            "source_url": URL,
        })

    if not rows:
        print("No rows scraped — inspect soup.prettify() to check the current "
              "heading/paragraph structure, the site may have changed its layout.")
        return

    fieldnames = ["name", "location_level", "known_address",
                  "amenities_notes", "source", "source_url"]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Scraped {len(rows)} rows -> {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
