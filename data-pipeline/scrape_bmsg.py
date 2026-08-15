"""
Scraper for BMSG's Nursing Room Directory (breastfeeding.org.sg).
The page structure is a series of <table> elements, one per category
(Shopping Centres, Public Places, Places of Worship, etc.), each with
columns: No. | Name | Nursing Room or Pod? | What's Available | Location/Level | Parent Feedback

Usage:
    pip install requests beautifulsoup4
    python scrape_bmsg.py
Output:
    bmsg_nursing_rooms.csv
"""

import csv
import re
import requests
from bs4 import BeautifulSoup

URL = "https://breastfeeding.org.sg/nursing-room-directory/"
OUTPUT_CSV = "bmsg_nursing_rooms.csv"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}


def clean_text(el):
    """Get text from a cell, collapsing whitespace, and join multi-line
    amenity lists with a semicolon instead of newlines."""
    if el is None:
        return ""
    text = el.get_text(separator="|", strip=True)
    # Split on the pipe we just inserted, drop empties, rejoin cleanly
    parts = [p.strip() for p in text.split("|") if p.strip()]
    return "; ".join(parts)


def find_category_for_table(table):
    """Walk backwards through preceding siblings to find the nearest
    bold/heading text (e.g. 'SHOPPING CENTRES') that labels this table."""
    node = table.find_previous(["p", "h2", "h3", "strong"])
    tries = 0
    while node and tries < 6:
        text = node.get_text(strip=True)
        if text and text.isupper() and len(text) > 3:
            return text
        node = node.find_previous(["p", "h2", "h3", "strong"])
        tries += 1
    return "UNKNOWN"


def scrape():
    resp = requests.get(URL, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    rows_out = []
    tables = soup.find_all("table")
    print(f"Found {len(tables)} table(s) on the page")

    for table in tables:
        category = find_category_for_table(table)
        trs = table.find_all("tr")
        if not trs:
            continue

        # First row is usually the header — detect it by checking for 'Name'
        header_cells = [clean_text(c) for c in trs[0].find_all(["th", "td"])]
        has_header = any("name" in h.lower() for h in header_cells)
        data_rows = trs[1:] if has_header else trs

        for tr in data_rows:
            cells = tr.find_all("td")
            if len(cells) < 3:
                continue  # skip malformed/empty rows

            # Columns: No. | Name | Type | Amenities | Location/Level | Feedback
            # Be defensive about column count varying
            values = [clean_text(c) for c in cells]
            # Drop the leading "No." index column if it's just a number
            if values and re.fullmatch(r"\d+", values[0]):
                values = values[1:]

            if not values or not values[0]:
                continue

            name = values[0]
            room_type = values[1] if len(values) > 1 else ""
            amenities = values[2] if len(values) > 2 else ""
            location = values[3] if len(values) > 3 else ""
            feedback = values[4] if len(values) > 4 else ""

            rows_out.append({
                "category": category,
                "name": name,
                "type": room_type,
                "amenities_notes": amenities,
                "location_level": location,
                "parent_feedback": feedback,
                "source": "BMSG",
                "source_url": URL,
            })

    return rows_out


def main():
    rows = scrape()
    if not rows:
        print("No rows scraped — the page structure may have changed. "
              "Try printing `soup.prettify()` for a sample table to inspect it.")
        return

    fieldnames = ["category", "name", "type", "amenities_notes",
                  "location_level", "parent_feedback", "source", "source_url"]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Scraped {len(rows)} rows -> {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
