"""Report coverage and optionally export Google Maps lookup links for manual review."""

import argparse
import csv
import math
from pathlib import Path
from urllib.parse import urlencode

from app.services.config import COORDINATES_CSV_PATH
from app.services.data import parse_coordinates


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--queue', type=Path, help='Write a separate CSV of unresolved companies and lookup links')
    args = parser.parse_args()
    with open(COORDINATES_CSV_PATH, encoding='utf-8-sig', newline='') as source:
        rows = list(csv.DictReader(source))
    unresolved = [(line, row) for line, row in enumerate(rows, start=2)
                  if parse_coordinates(row.get('coordonates')) is None]
    verified = len(rows) - len(unresolved)
    target = math.ceil(len(rows) * .7)
    coverage = 100 * verified / len(rows) if rows else 0
    print(f'{verified}/{len(rows)} coordinate rows ({coverage:.1f}%). '
          f'70% target: {target} rows ({max(0, target - verified)} still needed).')
    if args.queue:
        with args.queue.open('w', encoding='utf-8-sig', newline='') as dest:
            writer = csv.writer(dest)
            writer.writerow(['spreadsheet_row', 'company_name', 'city', 'google_maps_search'])
            for line, row in unresolved:
                query = ', '.join(filter(None, [row['company_name'], row['city'], 'Morocco']))
                url = 'https://www.google.com/maps/search/?' + urlencode({'api': 1, 'query': query})
                writer.writerow([line, row['company_name'], row['city'], url])


if __name__ == '__main__':
    main()
