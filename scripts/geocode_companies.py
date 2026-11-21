"""Prepare, geocode, and merge manually approved company locations."""

import argparse
import csv
import json
import os
import sys
import tempfile
import time
import unicodedata
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'database' / 'data'
IDENTITY = ('source_url', 'company_name', 'city')
FIELDS = [*IDENTITY, 'original_address', 'query', 'google_maps_search', 'multiple_addresses',
          'status', 'candidate_address', 'candidate_type', 'confidence', 'review_note',
          'latitude', 'longitude', 'approved']


def read(path):
    with path.open(encoding='utf-8-sig', newline='') as file:
        reader = csv.DictReader(file)
        return reader.fieldnames or [], list(reader)


def write(path, fields, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8-sig', newline='', dir=path.parent, delete=False) as file:
        temp = Path(file.name)
        try:
            writer = csv.DictWriter(file, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)
        except BaseException:
            temp.unlink(missing_ok=True)
            raise
    temp.replace(path)


def identity(row):
    return tuple(row[field] for field in IDENTITY)


def prepare(source, review):
    fields, rows = read(source)
    if 'idk' not in fields or not set(IDENTITY).issubset(fields):
        raise ValueError('Expected source_url, company_name, city, and idk in the address CSV.')
    if review.exists():
        raise ValueError('Review CSV already exists; choose a new path to avoid overwriting reviewed rows.')
    result = []
    for row in rows:
        address = row['idk'].strip()
        missing = address.casefold() in {'', 'idk', 'introuvable'}
        parts = [p.strip() for p in address.split(' / ') if p.strip()] if not missing else []
        # A slash can separate offices or just words in the address. Never auto-approve either case.
        for part in parts or ['']:
            query = ', '.join(filter(None, [part, row['city'], 'Morocco']))
            lookup = ', '.join(filter(None, [row['company_name'], query]))
            result.append({**{field: row[field] for field in IDENTITY}, 'original_address': address,
                           'query': query if part else '', 'multiple_addresses': 'yes' if len(parts) > 1 else '',
                           'google_maps_search': 'https://www.google.com/maps/search/?' + urlencode({'api': 1, 'query': lookup}),
                           'status': 'pending' if part else 'missing_address'})
    write(review, FIELDS, result)
    addressed = sum(row['idk'].strip().casefold() not in {'', 'idk', 'introuvable'} for row in rows)
    print(f'{addressed}/{len(rows)} companies have addresses. Prepared {len(result)} review rows in {review}.')


def valid_point(lat, lon):
    return 20.5 <= lat <= 36.5 and -18.5 <= lon <= -.5


def normalized(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', (value or '').casefold()) if c.isalnum())


def candidate(row, results):
    if not results:
        return {'status': 'no_match', 'review_note': 'No results; use the manual lookup link.'}
    result = results[0]
    kind = result.get('result_type', '')
    rank = result.get('rank') or {}
    confidence = rank.get('confidence', 0)
    lat, lon = result.get('lat'), result.get('lon')
    notes = []
    if result.get('country_code', '').lower() != 'ma' or not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)) or not valid_point(lat, lon):
        return {'status': 'no_match', 'review_note': 'Result is outside the directory region or has invalid coordinates.'}
    if kind != 'building' or confidence < .85:
        notes.append('Not a high-confidence building match')
    places = [normalized(result.get(k)) for k in ('city', 'town', 'municipality', 'village')]
    if normalized(row['city']) not in places:
        notes.append('City differs or is missing')
    if row['multiple_addresses'] == 'yes':
        notes.append('Multiple address parts; verify the office for this directory city')
    return {'status': 'needs_review' if notes else 'candidate', 'candidate_address': result.get('formatted', ''),
            'candidate_type': kind, 'confidence': confidence, 'review_note': '; '.join(notes),
            'latitude': lat, 'longitude': lon}


def geocode(review, limit, delay):
    key = os.environ.get('GEOAPIFY_API_KEY')
    if not key:
        raise ValueError('Set GEOAPIFY_API_KEY in the environment on a machine with access to api.geoapify.com.')
    fields, rows = read(review)
    processed = 0
    for row in rows:
        if processed >= limit:
            break
        if row['status'] != 'pending' or row['approved'].strip():
            continue
        url = 'https://api.geoapify.com/v1/geocode/search?' + urlencode({
            'text': row['query'], 'filter': 'countrycode:ma', 'limit': 3, 'format': 'json', 'apiKey': key,
        })
        try:
            with urlopen(url, timeout=20) as response:
                results = json.load(response)['results']
        except HTTPError as error:
            # Do not print request URLs (they include a key), or mark transient failures final.
            raise ValueError(f'Provider returned HTTP {error.code}. Fixed rows were saved; pending rows can be retried.') from None
        except (URLError, TimeoutError, ValueError, KeyError):
            raise ValueError('Could not read the provider response. Saved work is intact; retry pending rows later.') from None
        row.update(candidate(row, results))
        write(review, fields, rows)
        processed += 1
        if processed < limit:
            time.sleep(delay)
    print(f'Processed {processed} address queries. Inspect the review CSV; no pins were published.')


def apply(review, directory, output):
    _, reviews = read(review)
    fields, rows = read(directory)
    keys = {identity(row) for row in rows}
    if len(keys) != len(rows):
        raise ValueError('Directory company identifiers are not unique; no files written.')
    approved = {}
    for row in reviews:
        if row['approved'].strip().lower() != 'yes':
            continue
        key = identity(row)
        if key not in keys or key in approved:
            raise ValueError(f'Unmatched or multiple approved rows for {row["company_name"]}; no files written.')
        try:
            lat, lon = float(row['latitude']), float(row['longitude'])
        except ValueError:
            raise ValueError(f'Invalid approved coordinates for {row["company_name"]}.') from None
        if not valid_point(lat, lon):
            raise ValueError(f'Approved coordinates are outside the directory region for {row["company_name"]}.')
        approved[key] = f'{lat:.7f}, {lon:.7f}'
    if not approved:
        raise ValueError('No approved rows. Set approved=yes only after verifying a location.')
    if 'coordonates' not in fields:
        fields.append('coordonates')
    for row in rows:
        row['coordonates'] = approved.get(identity(row), row.get('coordonates', ''))
    write(output, fields, rows)
    print(f'Merged {len(approved)}/{len(rows)} approved companies into {output}. Row order preserved.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    prep = commands.add_parser('prepare')
    prep.add_argument('--input', type=Path, default=DATA / 'output.csv')
    prep.add_argument('--review', type=Path, required=True)
    lookup = commands.add_parser('geocode')
    lookup.add_argument('--review', type=Path, required=True)
    lookup.add_argument('--limit', type=int, default=25)
    lookup.add_argument('--delay', type=float, default=1)
    merge = commands.add_parser('apply')
    merge.add_argument('--review', type=Path, required=True)
    merge.add_argument('--directory', type=Path, default=DATA / 'morocco_tech_companies_clean.csv')
    merge.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == 'prepare':
            prepare(args.input, args.review)
        elif args.command == 'geocode':
            if args.limit < 1 or not 0.2 <= args.delay <= 60:
                parser.error('Use --limit >= 1 and --delay between 0.2 and 60 seconds.')
            geocode(args.review, args.limit, args.delay)
        else:
            apply(args.review, args.directory, args.output)
    except (OSError, ValueError, KeyError) as error:
        print(f'Error: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
