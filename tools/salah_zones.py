# -*- coding: utf-8 -*-
"""Every IANA time zone -> its reference place, for the Salah section's zero-permission first guess.

    python tools/salah_zones.py            write assets/salah/zones.json from tools/tzdb/
    python tools/salah_zones.py --check    exit 1 unless the file on disk is what the source files produce

WHY. The section's first guess at "where is this visitor" is the browser's time zone. places.json holds 47 hand-picked
cities (42 zones) with names in three languages; every other zone used to get a made-up place (latitude 30 N, longitude
from the UTC offset) under the visitor's own city name - prayer times wrong by hours (audit finding H-01). A time zone's
UTC offset says nothing about latitude, and in summer not even the longitude.

SOURCE. The IANA Time Zone Database itself (https://www.iana.org/time-zones), vendored unchanged in tools/tzdb/ with its
`version` file:
  zone.tab   one line per zone: country code, ISO 6709 coordinates of the zone's reference locality, zone id
  backward   "Link TARGET ALIAS" lines: the legacy names browsers still report (Chrome says Asia/Calcutta, Asia/Katmandu,
             Asia/Saigon, Europe/Kiev ...)
Nothing is invented here: a zone that zone.tab does not place (UTC, GMT, Etc/GMT+5 ...) stays unplaced, and the page then
asks the visitor to choose a city instead of showing times.

TO UPDATE: replace the three files in tools/tzdb/ from a newer tzdata release, run this script, run
`node tools/salah_zones_test.mjs`, rebuild.

HONESTY. A zone is not a city. Its reference locality is normally the zone's most populous city; a visitor elsewhere in
a wide zone (India, China, Brazil, central North America) can be an hour of solar time away from it. The interface says
"approximate" and offers the city list; tools/SALAH_SECTION.md lists the limits.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
TZDB = os.path.join(HERE, "tzdb")
OUT = os.path.join(SITE, "assets", "salah", "zones.json")


def iso6709(text):
    """+DDMM+DDDMM or +DDMMSS+DDDMMSS -> (lat, lon) in degrees, two decimals."""
    m = re.fullmatch(r"([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?", text)
    if not m:
        raise ValueError("not ISO 6709: %r" % text)
    lat = int(m.group(2)) + int(m.group(3)) / 60 + int(m.group(4) or 0) / 3600
    lon = int(m.group(6)) + int(m.group(7)) / 60 + int(m.group(8) or 0) / 3600
    return round(-lat if m.group(1) == "-" else lat, 2), round(-lon if m.group(5) == "-" else lon, 2)


def rows(name):
    for line in open(os.path.join(TZDB, name), encoding="utf-8"):
        line = line.rstrip("\n")
        if line and not line.startswith("#"):
            yield line.split("\t")


def build():
    zones = {}
    for cols in rows("zone.tab"):
        cc, coords, zone = cols[0], cols[1], cols[2]
        lat, lon = iso6709(coords)
        zones[zone] = [cc, lat, lon]
    links = {}
    for line in open(os.path.join(TZDB, "backward"), encoding="utf-8"):
        parts = line.split("#", 1)[0].split()
        if len(parts) >= 3 and parts[0] == "Link":
            links[parts[2]] = parts[1]

    def resolve(alias):
        seen = set()
        while alias in links and alias not in zones and alias not in seen:
            seen.add(alias)
            alias = links[alias]
        return alias if alias in zones else None

    # an alias is only kept when it is not itself a placed zone (Europe/Amsterdam links to Europe/Brussels in `backward`,
    # but zone.tab places Amsterdam in Amsterdam - the direct entry must win) and when its target is placed
    kept = {a: resolve(a) for a in sorted(links) if a not in zones and resolve(a)}
    version = open(os.path.join(TZDB, "version"), encoding="utf-8").read().strip()
    return {"source": "IANA tzdb %s: zone.tab + backward" % version, "zones": dict(sorted(zones.items())), "links": kept}


def dumps(data):
    # one zone per line: a reviewable diff when tzdb moves, and still small (the file compresses to about 7 KB)
    z = ",\n".join('  %s: %s' % (json.dumps(k), json.dumps(v, separators=(",", ":"))) for k, v in data["zones"].items())
    l = ",\n".join('  %s: %s' % (json.dumps(k), json.dumps(v)) for k, v in data["links"].items())
    return '{\n "source": %s,\n "zones": {\n%s\n },\n "links": {\n%s\n }\n}\n' % (json.dumps(data["source"]), z, l)


if __name__ == "__main__":
    text = dumps(build())
    if "--check" in sys.argv:
        same = os.path.exists(OUT) and open(OUT, encoding="utf-8", newline="").read() == text
        print("%s assets/salah/zones.json" % ("ok       " if same else "OUT OF DATE"))
        sys.exit(0 if same else 1)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    data = json.loads(text)
    print("%s: %d zones, %d aliases, %d bytes" % (data["source"], len(data["zones"]), len(data["links"]), len(text.encode("utf-8"))))
