"""
Morocco tech company collector.

Sources : Overture Maps places (free, open data), OpenStreetMap, Wikidata,
          an optional seed file (seed_websites.txt), and optionally Google
          Places (only if GOOGLE_PLACES_API_KEY is set).
Output  : ../data/morocco_tech_companies.csv  -> only tech companies that
          have a website or an email, with ready-to-use apply_email / apply_link.

Run:  pip install requests beautifulsoup4 duckdb
      python database/scripts/CompanyCollector.py

      Output is written to database/data/ relative to this file, whatever the
      current working directory is. An optional `seed_websites.txt` next to
      this script can add extra companies.
"""

import csv
import ipaddress
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from urllib.parse import urlencode, urljoin, urlparse, urldefrag
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
DATA_DIR = os.path.join(PROJECT_DIR, "database", "data")

# Generated dataset lives with the other data files; the optional seed file
# stays next to this script.
OUTPUT_FILE = os.path.join(DATA_DIR, "morocco_tech_companies.csv")
SEED_FILE = os.path.join(SCRIPT_DIR, "seed_websites.txt")

# --- Overture Maps places: free open data (CDLA Permissive 2.0), public S3
#     bucket, no account or key. Set OVERTURE_RELEASE to pin a release.
OVERTURE_FALLBACK_RELEASE = "2026-06-17.0"
OVERTURE_MIN_CONFIDENCE = 0.5
OVERTURE_HINTS = {
    "AI & Data Science": ("artificial_intelligence", "data_science",
                          "machine_learning", "analytics"),
    "Software Development": ("software", "app_development", "web_design",
                             "web_development", "mobile_app"),
    "Cybersecurity": ("cyber", "information_security"),
    "Digital Infrastructure": ("telecommunication", "internet_service",
                               "hosting", "data_center", "computer_network"),
    "Systems & Embedded": ("electronics_manufactur", "robot", "embedded", "iot"),
    "IT Consulting & Services": ("information_technology", "it_service",
                                 "it_consult", "computer_service",
                                 "technology_company", "computer_hardware"),
}
OVERTURE_EXCLUDE = ("store", "shop", "retail", "school", "university",
                    "college", "education", "training", "repair", "cafe",
                    "gaming", "game_")
TECH_NAME_RE = re.compile(
    r"soft|tech|digital|digit|cyber|cloud|informatique|numeri|systems|"
    r"telecom|robot|data", re.I)


PLACES_GRID = {"Casablanca": 4, "Rabat": 3, "Marrakech": 3, "Tangier": 3,
               "Fes": 2, "Agadir": 2}
PLACES_QUERIES = [
    "société informatique", "software company", "agence web",
    "développement logiciel", "développement application mobile",
    "cybersécurité", "ESN services informatiques", "intelligence artificielle",
    "hébergement web data center", "startup tech", "agence digitale",
    "intégrateur ERP", "solutions IT entreprise", "télécommunications",
]
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
WIKIDATA_URL = "https://query.wikidata.org/sparql"
USER_AGENT = "MoroccoTechIndex/1.0 (research project)"

ENRICHMENT_LIMIT = None    # None = enrich every company that has a website
WORKERS = 16
MAX_PAGES_PER_SITE = 6
PAGE_DELAY = 1.0           # seconds between pages on the same site
MIN_TECH_SCORE = 2         # distinct tech keywords needed when no OSM tech tag
SITE_TEXT_LIMIT = 8000
UNCLASSIFIED = "Unclassified"

CITIES = {
    "Casablanca": (33.48, -7.75, 33.68, -7.45),
    "Rabat": (33.90, -6.95, 34.08, -6.70),
    "Marrakech": (31.50, -8.10, 31.75, -7.85),
    "Tangier": (35.68, -5.95, 35.88, -5.70),
    "Fes": (33.95, -5.15, 34.10, -4.95),
    "Agadir": (30.30, -9.70, 30.55, -9.45),
    "Meknes": (33.80, -5.65, 34.00, -5.45),
    "Oujda": (34.60, -1.95, 34.75, -1.80),
    "Kenitra": (34.20, -6.70, 34.35, -6.45),
    "Tetouan": (35.52, -5.45, 35.68, -5.25),
    "El Jadida": (33.15, -8.00, 33.30, -7.90),
    "Safi": (32.20, -9.30, 32.40, -9.15),
    "Beni Mellal": (32.25, -6.45, 32.40, -6.25),
    "Nador": (35.10, -2.98, 35.25, -2.85),
    "Ouarzazate": (30.85, -6.98, 31.05, -6.80),
    "Laayoune": (27.05, -13.25, 27.20, -13.10),
    "Dakhla": (23.65, -15.98, 23.80, -15.85),
}

# Used to guess a city from website text when OSM gave none.
CITY_ALIASES = {
    "Casablanca": ["casablanca", "casa blanca"],
    "Rabat": ["rabat", "technopolis"],
    "Marrakech": ["marrakech", "marrakesh"],
    "Tangier": ["tanger", "tangier"],
    "Fes": ["fès", "fes "],
    "Agadir": ["agadir"],
    "Meknes": ["meknès", "meknes"],
    "Oujda": ["oujda"],
    "Kenitra": ["kénitra", "kenitra"],
    "Tetouan": ["tétouan", "tetouan"],
    "El Jadida": ["el jadida"],
    "Safi": [" safi "],
    "Beni Mellal": ["béni mellal", "beni mellal"],
    "Nador": ["nador"],
    "Ouarzazate": ["ouarzazate"],
    "Laayoune": ["laâyoune", "laayoune"],
    "Dakhla": ["dakhla"],
}

# Each group = one country-wide Overpass query. Only tech-ish tags/names;
# shops, universities, coworking spaces and research institutes are left out.
FILTER_GROUPS = [
    ['["office"~"^(it|computer|telecommunication)$",i]'],
    [
        '["craft"="electronics"]',
        '["industrial"~"^(electronics|telecommunication|software)$",i]',
        '["telecom"]',
        '["building"="data_center"]',
        '["man_made"="data_center"]',
    ],
    [
        '["office"~"^(company|consulting|yes)$"]'
        '["name"~"soft|tech|digital|digit|cyber|cloud|informatique|numeri|data|systems|telecom|robot",i]',
        '["office"~"^(company|consulting|yes)$"]'
        '["description"~"software|informatique|digital|logiciel",i]',
    ],
    [
        '["name"~"soft|tech|digital|cyber|cloud|informatique|numeri|systems|telecom|robot",i]'
        '["website"]'
    ],
]

WIKIDATA_QUERY = """
SELECT ?item ?itemLabel ?website ?desc WHERE {
  ?item wdt:P17 wd:Q1028;
        wdt:P856 ?website;
        wdt:P31/wdt:P279* wd:Q4830453.
  OPTIONAL { ?item schema:description ?desc FILTER(lang(?desc) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr". }
}
"""

CATEGORIES = {
    "AI & Data Science": [
        "artificial intelligence", "intelligence artificielle",
        "machine learning", "deep learning", "data science",
        "science des données", "data analytics", "big data",
        "computer vision", "vision par ordinateur", "nlp", "llm",
        "generative ai", "chatbot", "business intelligence",
    ],
    "Software Development": [
        "software", "logiciel", "développement web", "web development",
        "développement d'application", "application development",
        "développement mobile", "mobile app", "application mobile",
        "applications mobiles", "saas", "erp", "crm", "full stack",
        "fullstack", "devops", "agence web", "web agency",
        "agence digitale", "digital agency", "ingénierie logicielle",
        "software engineering", "programmation", "offshoring",
        "nearshoring", "ssii", "esn",
    ],
    "Cybersecurity": [
        "cybersécurité", "cybersecurity", "cyber security",
        "cyber-sécurité", "sécurité informatique", "pentest",
        "penetration testing", "information security",
        "sécurité des systèmes d'information",
    ],
    "Digital Infrastructure": [
        "cloud", "hébergement", "hosting", "data center", "datacenter",
        "infrastructure informatique", "réseaux informatiques",
        "network infrastructure", "telecom", "télécommunication",
        "infogérance", "managed services", "virtualisation",
        "kubernetes", "docker",
    ],
    "Systems & Embedded": [
        "systèmes embarqués", "embedded systems", "embedded",
        "firmware", "iot", "internet des objets", "internet of things",
        "robotique", "robotics", "électronique embarquée",
    ],
    "IT Consulting & Services": [
        "conseil informatique", "it consulting", "services informatiques",
        "it services", "transformation digitale", "digital transformation",
        "intégrateur", "systems integrator", "services numériques",
        "solutions informatiques", "informatique", "technologies de l'information",
        "nouvelles technologies",
    ],
}

# Names/descriptions matching this are never "companies to apply to".
EXCLUDE_RE = re.compile(
    r"\b(universit\w*|facult\w*|école|ecole|school|lycée|lycee|ministère|"
    r"ministere|ministry|madrasa|musée|museum|hôpital|hopital|hospital|"
    r"commune|préfecture|prefecture|mosquée|mosque)\b",
    re.I,
)

CAREER_TERMS = (
    "career", "careers", "jobs", "recruitment", "recrutement",
    "emploi", "emplois", "nous-rejoindre", "join-us",
    "work-with-us", "opportunities", "opportunites", "carriere", "carrieres",
)

CONTACT_TERMS = (
    "contact", "about", "a-propos", "nous-contacter", "contactez",
)

GUESS_PATHS = {
    "careers": ["careers", "carrieres", "recrutement", "jobs"],
    "contact": ["contact", "contactez-nous", "nous-contacter"],
}

HIRING_LOCALS = {
    "jobs", "job", "careers", "career", "recruitment", "recrutement",
    "rh", "hr", "emploi", "emplois", "talent", "talents", "hiring",
    "recrute", "candidature", "candidatures", "stage", "stages",
}

GENERIC_LOCALS = {
    "contact", "info", "hello", "support", "office", "admin", "business",
    "commercial", "sales", "bonjour", "direction", "secretariat",
}

JUNK_EMAIL_DOMAINS = {
    "sentry.io", "wixpress.com", "example.com", "domain.com", "email.com",
    "yourdomain.com", "sentry-next.wixpress.com", "sentry.wixpress.com",
}

EMAIL_REGEX = re.compile(
    r"(?i)\b[a-z0-9.!#$%&'*+/=?^_`{|}~-]+"
    r"@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
    r"(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\b"
)

# Columns written to the CSV.
OUTPUT_FIELDS = [
    "company_name",
    "city",
    "specialties",
    "description",
    "website",
    "apply_email",
    "phone",
    "apply_link",
    "apply_via",
    "careers_url",
    "contact_url",
    "all_emails",
    "source",
    "source_url",
    "verification_status",
    "last_checked_at",
]

LIST_FIELDS = {"public_emails", "specialties", "tag_categories", "query_hint"}


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def clean(value):
    if value is None:
        return ""

    return re.sub(r"\s+", " ", str(value)).strip()


def make_session():
    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
    })
    return session


def new_record(**values):
    record = {
        "company_name": "",
        "city": "",
        "address": "",
        "latitude": "",
        "longitude": "",
        "description": "",
        "website": "",
        "careers_url": "",
        "contact_url": "",
        "public_emails": [],
        "specialties": [UNCLASSIFIED],
        "source": "",
        "source_url": "",
        "verification_status": "unverified",
        "last_checked_at": "",
        "tag_categories": [],
        "query_hint": [],
        "phone": "",
        "site_text": "",
        "seed_description": "",
    }
    record.update(values)
    record["seed_description"] = record["description"]
    return record


def normalize_url(url):
    if not url:
        return ""

    url = url.strip()

    if not url:
        return ""

    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url

    parsed = urlparse(url)

    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return ""

    if parsed.username or parsed.password:
        return ""

    host = parsed.hostname.lower().rstrip(".")

    if host == "localhost" or host.endswith((".localhost", ".local")):
        return ""

    try:
        address = ipaddress.ip_address(host)

        if not address.is_global:
            return ""
    except ValueError:
        pass

    return parsed._replace(fragment="").geturl().rstrip("/")


def normalize_email(email):
    email = email.strip().strip(".,;:()[]<>").lower()

    if len(email) > 254 or ".." in email:
        return ""

    if not EMAIL_REGEX.fullmatch(email):
        return ""

    if email.endswith((".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif")):
        return ""

    domain = email.split("@", 1)[1]

    if domain in JUNK_EMAIL_DOMAINS or domain.endswith(".sentry.io"):
        return ""

    return email


def decode_cfemail(hexstring):
    """Decode Cloudflare's email obfuscation (data-cfemail)."""
    try:
        key = int(hexstring[:2], 16)

        return "".join(
            chr(int(hexstring[i:i + 2], 16) ^ key)
            for i in range(2, len(hexstring), 2)
        )
    except ValueError:
        return ""


def get_json(session, url, data=None, attempts=3, post_timeout=330):
    for attempt in range(attempts):
        try:
            if data is None:
                response = session.get(url, timeout=120)
            else:
                response = session.post(
                    url,
                    data=data,
                    timeout=post_timeout,
                    headers={
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                )

            if response.status_code in {429, 502, 503, 504}:
                retry_after = response.headers.get("Retry-After", "20")

                try:
                    delay = int(retry_after)
                except ValueError:
                    delay = 20

                time.sleep(min(max(delay, 5), 120))
                continue

            response.raise_for_status()
            return response.json()

        except (requests.RequestException, ValueError) as exc:
            if attempt == attempts - 1:
                print(f"Request failed: {exc}")
                return None

            time.sleep(3 * (attempt + 1))

    return None


# ----------------------------------------------------------------------------
# Tech classification
# ----------------------------------------------------------------------------

def _keyword_pattern(keyword):
    tail = r"(?!\w)" if len(keyword) <= 4 else ""

    return re.compile(r"(?<!\w)" + re.escape(keyword) + tail)


CATEGORY_PATTERNS = {
    category: [_keyword_pattern(keyword) for keyword in keywords]
    for category, keywords in CATEGORIES.items()
}


def keyword_hits(text):
    """Returns {category: number of distinct keywords matched}."""
    text = text.lower().replace("’", "'")
    hits = {}

    for category, patterns in CATEGORY_PATTERNS.items():
        count = sum(1 for pattern in patterns if pattern.search(text))

        if count:
            hits[category] = count

    return hits


def tag_categories(tags):
    """Categories implied directly by OSM tags (strong tech signal)."""
    categories = set()

    office = tags.get("office", "").lower()

    if office in {"it", "computer"}:
        categories.add("Software Development")

    if office == "telecommunication" or "telecom" in tags:
        categories.add("Digital Infrastructure")

    if tags.get("building") == "data_center" or tags.get("man_made") == "data_center":
        categories.add("Digital Infrastructure")

    if tags.get("craft", "").lower() == "electronics":
        categories.add("Systems & Embedded")

    if tags.get("industrial", "").lower() in {"electronics", "telecommunication", "software"}:
        categories.add("Systems & Embedded")

    return sorted(categories)


def assess(record):
    text = " ".join([
        record["company_name"],
        record["description"],
        record["site_text"],
    ])

    hits = keyword_hits(text)
    score = sum(hits.values())

    if record.get("query_hint"):
        score += 1  # Google ranked it for a tech search

    categories = set(hits) | set(record["tag_categories"])

    record["specialties"] = (
        sorted(categories, key=lambda c: (-hits.get(c, 0), c))
        or [UNCLASSIFIED]
    )
    record["tech"] = bool(record["tag_categories"]) or score >= MIN_TECH_SCORE


def guess_city(record):
    if record["city"] and record["city"] != "Other":
        return

    text = f" {record['site_text'].lower()} "
    best, best_count = "", 0

    for city, aliases in CITY_ALIASES.items():
        count = sum(text.count(alias) for alias in aliases)

        if count > best_count:
            best, best_count = city, count

    if best:
        record["city"] = best


# ----------------------------------------------------------------------------
# Source 1: OpenStreetMap (whole country)
# ----------------------------------------------------------------------------

def make_country_query(filters):
    body = "".join(f"nwr{f}(area.ma);" for f in filters)

    return (
        "[out:json][timeout:300];"
        'area["ISO3166-1"="MA"][admin_level=2]->.ma;'
        f"({body});out center tags;"
    )


def coordinates(element):
    if "lat" in element and "lon" in element:
        return element["lat"], element["lon"]

    center = element.get("center", {})

    return center.get("lat", ""), center.get("lon", "")


def nearest_city(lat, lon, tags):
    if tags.get("addr:city"):
        return clean(tags["addr:city"])

    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        return ""

    best, best_distance = "", 1e9

    for city, (south, west, north, east) in CITIES.items():
        distance = (
            (lat - (south + north) / 2) ** 2
            + (lon - (west + east) / 2) ** 2
        ) ** 0.5

        if distance < best_distance:
            best, best_distance = city, distance

    return best if best_distance < 0.5 else ""


def website_from_tags(tags):
    for key in ("contact:website", "website", "url"):
        url = normalize_url(tags.get(key, ""))

        if url:
            return url

    return ""


def extract_address(tags):
    parts = []

    street = tags.get("addr:street", "")
    number = tags.get("addr:housenumber", "")

    if street:
        parts.append(f"{number} {street}".strip())

    for key in ("addr:suburb", "addr:postcode"):
        if tags.get(key):
            parts.append(tags[key])

    return ", ".join(parts)


def extract_osm_record(element):
    tags = element.get("tags", {})
    name = clean(tags.get("name") or tags.get("brand"))

    if not name:
        return None

    latitude, longitude = coordinates(element)

    description = clean(
        tags.get("description")
        or tags.get("short_description")
        or tags.get("brand:description")
    )

    emails = set()

    for key in ("email", "contact:email"):
        for value in re.split(r"[;,]", tags.get(key, "")):
            email = normalize_email(value)

            if email:
                emails.add(email)

    return new_record(
        company_name=name,
        city=nearest_city(latitude, longitude, tags),
        address=extract_address(tags),
        latitude=latitude,
        longitude=longitude,
        description=description,
        website=website_from_tags(tags),
        public_emails=sorted(emails),
        source="OpenStreetMap",
        source_url=(
            f"https://www.openstreetmap.org/{element['type']}/{element['id']}"
        ),
        tag_categories=tag_categories(tags),
    )


def collect_osm(session):
    records = []

    for index, filters in enumerate(FILTER_GROUPS, 1):
        print(f"\nOverpass group {index}/{len(FILTER_GROUPS)}...")

        data = get_json(
            session,
            OVERPASS_URL,
            data={"data": make_country_query(filters)},
        )

        if not data:
            print("  Group failed; continuing.")
            time.sleep(15)
            continue

        found = 0

        for element in data.get("elements", []):
            record = extract_osm_record(element)

            if record:
                records.append(record)
                found += 1

        print(f"  Found {found} candidate records.")
        time.sleep(15)  # be kind to the public Overpass server

    return records


# ----------------------------------------------------------------------------
# Source: Overture Maps places (free, no key)
# ----------------------------------------------------------------------------

def latest_overture_release(session):
    pinned = os.environ.get("OVERTURE_RELEASE")

    if pinned:
        return pinned

    try:
        data = session.get(
            "https://stac.overturemaps.org/catalog.json", timeout=30
        ).json()

        if data.get("latest"):
            return data["latest"]

        found = []

        for link in data.get("links", []):
            match = re.search(r"\d{4}-\d{2}-\d{2}\.\d+", link.get("href", ""))

            if match and link.get("rel") == "child":
                found.append(match.group(0))

        if found:
            return sorted(found)[-1]
    except (requests.RequestException, ValueError):
        pass

    return OVERTURE_FALLBACK_RELEASE


def overture_categories(text):
    """Map Overture category text to our categories; [] if not tech."""
    if any(word in text for word in OVERTURE_EXCLUDE):
        return []

    return sorted(
        category
        for category, hints in OVERTURE_HINTS.items()
        if any(hint in text for hint in hints)
    )


def collect_overture(session):
    try:
        import duckdb
    except ImportError:
        print("\nduckdb not installed (pip install duckdb) - skipping Overture.")
        return []

    release = latest_overture_release(session)
    print(f"\nQuerying Overture Maps places (release {release})...")
    print("  This reads a lot of data from S3 and can take several minutes.")

    path = (f"s3://overturemaps-us-west-2/release/{release}/"
            "theme=places/type=place/*")

    try:
        con = duckdb.connect()
        con.execute("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")

        columns = {
            row[0] for row in con.execute(
                f"DESCRIBE SELECT * FROM read_parquet('{path}', "
                "hive_partitioning=1)"
            ).fetchall()
        }

        wanted = [c for c in (
            "websites", "emails", "phones", "addresses", "confidence",
            "categories", "taxonomy", "basic_category",
        ) if c in columns]

        cursor = con.execute(f"""
            SELECT id, names.primary AS name, bbox.xmin AS lon,
                   bbox.ymin AS lat, {", ".join(wanted)}
            FROM read_parquet('{path}', hive_partitioning=1)
            WHERE bbox.xmin BETWEEN -17.2 AND -0.9
              AND bbox.ymin BETWEEN 20.7 AND 36.0
        """)

        names = [d[0] for d in cursor.description]
        rows = cursor.fetchall()
    except Exception as exc:
        print(f"  Overture query failed: {exc}")
        print("  If the release was not found, set OVERTURE_RELEASE to a "
              "current one (see docs.overturemaps.org) and rerun.")
        return []

    print(f"  Scanned {len(rows)} places in the Morocco area.")

    records = []

    for values in rows:
        row = dict(zip(names, values))
        name = clean(row.get("name"))

        if not name:
            continue

        addresses = row.get("addresses") or []
        address = addresses[0] if addresses else {}

        if (address or {}).get("country") not in ("MA", "EH"):
            continue

        confidence = row.get("confidence")

        if confidence is not None and confidence < OVERTURE_MIN_CONFIDENCE:
            continue

        text = " ".join(
            str(row[c]).lower() for c in ("categories", "taxonomy", "basic_category")
            if row.get(c)
        )

        cats = overture_categories(text)

        if not cats and not TECH_NAME_RE.search(name):
            continue

        website = ""

        for site in row.get("websites") or []:
            website = normalize_url(site)

            if website:
                break

        emails = sorted({
            e for e in (normalize_email(x) for x in row.get("emails") or []) if e
        })

        if not website and not emails:
            continue

        phones = row.get("phones") or []
        lat, lon = row.get("lat", ""), row.get("lon", "")

        records.append(new_record(
            company_name=name,
            city=clean((address or {}).get("locality"))
                 or nearest_city(lat, lon, {}),
            address=clean((address or {}).get("freeform")),
            latitude=lat,
            longitude=lon,
            website=website,
            public_emails=emails,
            phone=clean(phones[0]) if phones else "",
            source="Overture Maps",
            source_url=f"overture:{row['id']}",
            tag_categories=cats,
        ))

    print(f"  Kept {len(records)} tech candidates with a website or email.")
    return records




# ----------------------------------------------------------------------------
# Source 2: Wikidata
# ----------------------------------------------------------------------------

def collect_wikidata(session):
    print("\nQuerying Wikidata...")

    url = WIKIDATA_URL + "?" + urlencode(
        {"query": WIKIDATA_QUERY, "format": "json"}
    )

    data = get_json(session, url)

    if not data:
        print("  Wikidata query failed; continuing without it.")
        return []

    records = []

    for row in data.get("results", {}).get("bindings", []):
        name = clean(row.get("itemLabel", {}).get("value"))
        website = normalize_url(row.get("website", {}).get("value", ""))

        if not name or re.fullmatch(r"Q\d+", name) or not website:
            continue

        records.append(new_record(
            company_name=name,
            description=clean(row.get("desc", {}).get("value")),
            website=website,
            source="Wikidata",
            source_url=row["item"]["value"],
        ))

    print(f"  Found {len(records)} candidate records.")
    return records


# ----------------------------------------------------------------------------
# Source 3: your own seed list
# ----------------------------------------------------------------------------

def collect_seeds():
    """seed_websites.txt: one company per line.
    Either `https://example.ma` or `Company Name | https://example.ma`.
    Lines starting with # are ignored."""
    if not os.path.exists(SEED_FILE):
        print(f"\nNo {SEED_FILE} found (optional) - skipping seeds.")
        return []

    records = []

    with open(SEED_FILE, encoding="utf-8") as file:
        for line in file:
            line = line.strip()

            if not line or line.startswith("#"):
                continue

            if "|" in line:
                name, _, site = line.partition("|")
            else:
                name, site = "", line

            website = normalize_url(site.strip())

            if not website:
                continue

            name = clean(name) or website_key(website)

            records.append(new_record(
                company_name=name,
                website=website,
                source="Seed list",
                source_url=website,
                # Seeds are what you chose, so trust them as tech.
                tag_categories=["IT Consulting & Services"],
            ))

    print(f"\nLoaded {len(records)} companies from {SEED_FILE}.")
    return records


# ----------------------------------------------------------------------------
# Deduplication
# ----------------------------------------------------------------------------

def website_key(url):
    parsed = urlparse(normalize_url(url))

    return (parsed.hostname or "").lower().removeprefix("www.")


def deduplicate(records):
    result = {}
    name_city_index = {}

    for record in records:
        website = website_key(record["website"])

        if website:
            key = ("website", website)
        else:
            key = ("osm", record["source_url"])

            name_key = (
                record["company_name"].casefold(),
                record["city"].casefold(),
            )

            if name_key in name_city_index:
                key = name_city_index[name_key]
            else:
                name_city_index[name_key] = key

        if key not in result:
            result[key] = record
            continue

        existing = result[key]

        for field, value in record.items():
            if field in LIST_FIELDS:
                existing[field] = sorted(set(existing[field]) | set(value))
            elif field == "source":
                if value and value not in existing[field]:
                    existing[field] = f"{existing[field]}; {value}"
            elif not existing.get(field) and value:
                existing[field] = value

    return list(result.values())


# ----------------------------------------------------------------------------
# Website enrichment (robots.txt respected, same-site links only)
# ----------------------------------------------------------------------------

REDIRECT_CODES = (301, 302, 303, 307, 308)


def same_domain(url, original):
    first = (urlparse(url).hostname or "").lower().removeprefix("www.")
    second = (urlparse(original).hostname or "").lower().removeprefix("www.")

    return bool(first and second and first == second)


def resolve_origin(session, website):
    """Follow redirects with HEAD (even to another domain, e.g. ucd.ma ->
    ucd.ac.ma) to find where the site really lives, before any robots check
    or page fetch. Every hop must pass normalize_url."""
    url = website

    for _ in range(5):
        try:
            response = session.head(url, allow_redirects=False, timeout=10)
        except requests.RequestException:
            return url

        if response.status_code in REDIRECT_CODES:
            location = response.headers.get("Location")
            target = normalize_url(urljoin(url, location)) if location else ""

            if not target:
                return url

            url = target
            continue

        break

    parsed = urlparse(url)

    # Keep only the origin; deep links (e.g. /restaurations) are not the site.
    return f"{parsed.scheme}://{parsed.netloc}"


def fetch_follow(session, url, max_hops=4, **kwargs):
    """GET with manual redirects, staying on the same domain.
    Returns (response, final_url) or (None, None)."""
    url = normalize_url(url)

    for _ in range(max_hops + 1):
        if not url:
            return None, None

        response = session.get(url, allow_redirects=False, **kwargs)

        if response.status_code in REDIRECT_CODES:
            location = response.headers.get("Location")

            if not location:
                return None, None

            target = normalize_url(urljoin(url, location))

            if not target or not same_domain(target, url):
                return None, None

            url = target
            continue

        return response, url

    return None, None


def fetch_robots(session, website):
    parsed = urlparse(website)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

    for attempt in range(2):
        try:
            response, _ = fetch_follow(session, robots_url, timeout=10)
        except requests.RequestException:
            response = None

        if response is None:
            time.sleep(2)
            continue

        if response.status_code == 200:
            return response.text.splitlines()

        # No robots.txt (4xx) means nothing is disallowed.
        if 400 <= response.status_code < 500:
            return []

        time.sleep(2)  # 5xx: retry once, then skip the site

    return None


def extract_page(html, page_url):
    soup = BeautifulSoup(html, "html.parser")

    emails = set()

    # Cloudflare-obfuscated emails
    for tag in soup.select("[data-cfemail]"):
        email = normalize_email(decode_cfemail(tag.get("data-cfemail", "")))

        if email:
            emails.add(email)

    for link in soup.find_all("a", href=True):
        if "email-protection#" in link["href"]:
            hexstring = link["href"].split("#", 1)[1]
            email = normalize_email(decode_cfemail(hexstring))

            if email:
                emails.add(email)

    for element in soup(["script", "style", "noscript", "svg"]):
        element.decompose()

    text = soup.get_text(" ", strip=True)

    for match in EMAIL_REGEX.findall(text):
        email = normalize_email(match)

        if email:
            emails.add(email)

    for link in soup.select('a[href^="mailto:"]'):
        value = link["href"].split(":", 1)[-1].split("?", 1)[0]

        for part in value.split(","):
            email = normalize_email(part)

            if email:
                emails.add(email)

    careers = []
    contacts = []

    for link in soup.find_all("a", href=True):
        href = link["href"].strip()

        if href.lower().startswith(("mailto:", "tel:", "javascript:")):
            continue

        target = urldefrag(urljoin(page_url, href))[0]
        target = normalize_url(target)

        if not target or not same_domain(target, page_url):
            continue

        label = clean(link.get_text(" ", strip=True))
        search_text = f"{label} {urlparse(target).path}".lower()

        if any(term in search_text for term in CAREER_TERMS):
            careers.append(target)

        if any(term in search_text for term in CONTACT_TERMS):
            contacts.append(target)

    meta = soup.find(
        "meta",
        attrs={"name": re.compile("^description$", re.I)},
    )

    description = clean(meta.get("content", "")) if meta else ""

    if not description:
        paragraph = soup.find("p")

        if paragraph:
            description = clean(paragraph.get_text(" ", strip=True))

    title = clean(soup.title.get_text(" ", strip=True)) if soup.title else ""

    return {
        "emails": sorted(emails),
        "careers": list(dict.fromkeys(careers)),
        "contacts": list(dict.fromkeys(contacts)),
        "description": description[:1500],
        "text": clean(f"{title} {description} {text}")[:3000],
    }


def enrich(record, session):
    website = normalize_url(record["website"])

    if not website:
        return

    website = resolve_origin(session, website)
    record["website"] = website

    robots_lines = fetch_robots(session, website)

    if robots_lines is None:
        record["verification_status"] = "robots_unavailable"
        record["last_checked_at"] = now()
        return

    robots = RobotFileParser()

    if robots_lines:
        robots.parse(robots_lines)
    else:
        robots.allow_all = True

    pending = [website]
    visited = set()
    guesses = {}
    emails = set(record["public_emails"])
    reached = False

    while pending and len(visited) < MAX_PAGES_PER_SITE:
        url = pending.pop(0)

        if url in visited:
            continue

        if not robots.can_fetch(USER_AGENT, url):
            continue

        visited.add(url)

        try:
            response, final_url = fetch_follow(
                session,
                url,
                timeout=12,
                headers={"Accept": "text/html"},
            )

            if response is None or response.status_code != 200:
                continue

            if len(response.content) > 2_000_000:
                continue

            content_type = response.headers.get("Content-Type", "").lower()

            if "text/html" not in content_type:
                continue

            reached = True

            page = extract_page(response.text, final_url)
            emails.update(page["emails"])

            record["site_text"] = (
                f"{record['site_text']} {page['text']}"
            )[:SITE_TEXT_LIMIT]

            if not record["description"] and page["description"]:
                record["description"] = page["description"]

            if not record["careers_url"] and page["careers"]:
                record["careers_url"] = page["careers"][0]

            if not record["contact_url"] and page["contacts"]:
                record["contact_url"] = page["contacts"][0]

            # A guessed path that really exists counts as found.
            kind = guesses.get(url)

            if kind == "careers" and not record["careers_url"]:
                record["careers_url"] = final_url

            if kind == "contact" and not record["contact_url"]:
                record["contact_url"] = final_url

            for target in page["careers"] + page["contacts"]:
                if target not in visited and target not in pending:
                    pending.append(target)

            # Homepage had no useful links: try the usual paths.
            if len(visited) == 1 and not page["careers"] and not page["contacts"]:
                parsed = urlparse(final_url)
                base = f"{parsed.scheme}://{parsed.netloc}"

                for kind, paths in GUESS_PATHS.items():
                    for path in paths:
                        guess = f"{base}/{path}"
                        guesses[guess] = kind
                        pending.append(guess)

            time.sleep(PAGE_DELAY)

        except requests.RequestException:
            continue

    record["public_emails"] = sorted(emails)

    guess_city(record)

    record["verification_status"] = (
        "website_reachable" if reached else "unverified"
    )
    record["last_checked_at"] = now()


def enrich_all(candidates):
    def safe_enrich(record):
        try:
            enrich(record, make_session())
        except Exception as exc:
            print(f"  Failed to enrich {record['company_name']}: {exc}")

    pool = ThreadPoolExecutor(max_workers=WORKERS)
    futures = [pool.submit(safe_enrich, record) for record in candidates]

    try:
        for done, _ in enumerate(as_completed(futures), 1):
            if done % 25 == 0 or done == len(futures):
                print(f"  Enriched {done}/{len(futures)}")
    except KeyboardInterrupt:
        pool.shutdown(wait=False, cancel_futures=True)
        raise

    pool.shutdown()


# ----------------------------------------------------------------------------
# Output: tech-only, apply-ready rows
# ----------------------------------------------------------------------------

def set_apply_fields(record):
    domain = website_key(record["website"])

    def rank(email):
        local, host = email.split("@", 1)
        local = local.split("+", 1)[0]

        return (
            0 if local in HIRING_LOCALS else 1 if local in GENERIC_LOCALS else 2,
            0 if domain and host.endswith(domain) else 1,
            email,
        )

    emails = sorted(record["public_emails"], key=rank)

    record["apply_email"] = emails[0] if emails else ""
    record["all_emails"] = "; ".join(emails)

    if record["careers_url"]:
        record["apply_link"], via = record["careers_url"], "careers page"
    elif record["contact_url"]:
        record["apply_link"], via = record["contact_url"], "contact page"
    elif record["website"]:
        record["apply_link"], via = record["website"], "website"
    else:
        record["apply_link"], via = "", ""

    if record["apply_email"]:
        via = f"{via} + email" if via else "email"

    record["apply_via"] = via


def build_rows(records, strict):
    rows = []

    for record in records:
        assess(record)
        set_apply_fields(record)

        if strict:
            label = f"{record['company_name']} {record['seed_description']}"

            if EXCLUDE_RE.search(label):
                continue

            if not record["tech"]:
                continue

            if not (record["website"] or record["apply_email"]):
                continue

        rows.append(record)

    rows.sort(
        key=lambda r: (
            bool(r["apply_email"]),
            bool(r["careers_url"]),
            bool(r["contact_url"]),
            bool(r["description"]),
            bool(r["city"]),
        ),
        reverse=True,
    )

    return rows


def serialize_record(record):
    result = {}

    for field in OUTPUT_FIELDS:
        value = record.get(field, "")

        if isinstance(value, list):
            value = "; ".join(value)

        result[field] = value

    return result


def export_csv(rows):
    os.makedirs(DATA_DIR, exist_ok=True)
    temporary = OUTPUT_FILE + ".tmp"

    with open(temporary, "w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()

        for row in rows:
            writer.writerow(serialize_record(row))

    os.replace(temporary, OUTPUT_FILE)

    print(f"CSV saved: {os.path.abspath(OUTPUT_FILE)} ({len(rows)} rows)")


def print_summary(all_records, rows):
    print("\n========== SUMMARY ==========")
    print(f"Collected candidates: {len(all_records)}")
    print(f"Kept (tech + website/email): {len(rows)}")
    print(f"  with apply email: {sum(bool(r['apply_email']) for r in rows)}")
    print(f"  with careers page: {sum(bool(r['careers_url']) for r in rows)}")
    print(f"  with contact page: {sum(bool(r['contact_url']) for r in rows)}")

    by_source = {}

    for row in rows:
        by_source[row["source"]] = by_source.get(row["source"], 0) + 1

    for source, count in sorted(by_source.items()):
        print(f"  from {source}: {count}")

    print("=============================")


def main():
    session = make_session()
    records = []

    try:
        records.extend(collect_overture(session))
        records.extend(collect_google_places(session))
        records.extend(collect_osm(session))
        records.extend(collect_wikidata(session))
        records.extend(collect_seeds())

        records[:] = deduplicate(records)
        print(f"\nUnique candidate companies: {len(records)}")

        # Unfiltered checkpoint so nothing is lost if enrichment is interrupted.
        export_csv(build_rows(records, strict=False))

        candidates = [r for r in records if r["website"]]

        if ENRICHMENT_LIMIT:
            candidates = candidates[:ENRICHMENT_LIMIT]

        print(f"Enriching {len(candidates)} websites with {WORKERS} workers...")
        enrich_all(candidates)

    except KeyboardInterrupt:
        print("\nInterrupted; saving what we have so far...")

    finally:
        rows = build_rows(records, strict=True)
        export_csv(rows)
        print_summary(records, rows)


if __name__ == "__main__":
    main()