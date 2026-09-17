# -*- coding: utf-8 -*-
"""The maintenance page (/maintenance/, /ar/maintenance/, /nl/maintenance/) and
the switch that can send visitors to it.

ONE SOURCE. tools/maintenance.json is the only place a maintenance window is
written down:

    enabled    false | true - the site-wide gate (below). The page itself
               exists either way, so it can be reviewed before it is needed.
    startsAt   when the window opens     ISO 8601 WITH an offset, e.g.
    endsAt     when it is expected to end  "2026-09-18T09:00:00Z" (UTC)
    routes     page keys the gate covers: "" is the home page, "articles/"
               covers the index and every article, "support/" the support page
    status     an optional one-line note per language; "" shows nothing

Times are UTC by convention and must carry their offset - a bare
"2026-09-18T09:00" is refused, because a time without a zone means a
different moment in every visitor's browser. The page shows the end time in
the VISITOR'S own time zone (Intl, in assets/maintenance.js); with scripting
off it falls back to the UTC time written here.

The build copies `endsAt` into the page as a data attribute; the countdown
logic exists once, in assets/maintenance.js. Change the window by editing the
JSON and running `python tools/build.py` - never by editing the HTML.

WHAT THIS HOST CAN AND CANNOT DO. zulfaa.nl resolves straight to GitHub Pages
(185.199.108-111.153, `Server: GitHub.com`) with no CDN or proxy in front. Pages
answers 200 for a file that exists and 404 for one that does not; it cannot be
told to answer 503, send Retry-After, or route by a flag. So:

  * /maintenance/ is served as HTTP 200. It says "maintenance" to people; to a
    crawler it says `noindex` and nothing else. It is not a true 503.
  * the gate is a one-line script in the <head> of the covered pages, emitted
    by the build ONLY while `enabled` is true. Between startsAt and endsAt, by
    the visitor's clock, it replaces the page with the maintenance page in the
    same language and remembers where the visitor was going. Outside the window
    it does nothing, so an overrun needs a new endsAt pushed, and a finished
    window needs no push at all. With scripting off the gate cannot run and the
    ordinary page shows - which is the honest failure for a static site.
  * a real 503 needs something in front of Pages (a CDN rule or a proxy). That
    is a hosting change, and it is deliberately not made here.

NEVER GATED: privacy/, terms/, delete-data/. Google Play requires the privacy
policy URL to answer at all times, and a data-deletion request must never be
blocked by an outage page. The loader refuses a config that lists them.

NOT INDEXED. Like the 404, the page is a status and not a document:
`noindex, follow`, no canonical, absent from the sitemap.

THE SHELL IS THE SITE'S OWN. Top Bar, header, lantern and footer come from
chrome.py exactly as on the 404 and every other page, so this is one more page
of the same website and never a second design. The one thing the full
navigation could do wrong - offer a page the gate is sending back here - is
handled in assets/maintenance.js, not by leaving the links out: while the
window is actually open, every link to a covered route (`data-covered`, written
by the build from `routes`) loses its href and is marked unavailable, and when
the window ends they are given back. The legal pages are never covered, so
they stay live throughout; the language links point at the maintenance page in
the other language and stay live too. Gate off, or scripting off: every link is
an ordinary link, which is the truth then.
"""
import json, os, re, sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

CONFIG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "maintenance.json")
NEVER_GATED = ("privacy/", "terms/", "delete-data/")

# ── the words ──────────────────────────────────────────────────────────────
# Beside the page that uses them, as the 404, the lantern and the scroll dock
# keep theirs.
COPY = {
    "en": {
        "title": "Under maintenance — ZULFAA",
        "eyebrow": "Scheduled maintenance",
        "h1": "We’ll be back shortly",
        "body": "ZULFAA is undergoing a little maintenance. We’re preparing things carefully and will be back soon.",
        "intro": "Expected return in",
        "units": ["Days", "Hours", "Minutes", "Seconds"],
        "when": "Expected back",
        "done": "Maintenance should be complete. You can try again now.",
        "home": "Return home",
        "retry": "Try again",
    },
    "ar": {
        "title": "قيد الصيانة — ZULFAA",
        "eyebrow": "صيانة مجدولة",
        "h1": "سنعود قريبًا",
        "body": "تجري حاليًا بعض أعمال الصيانة في زُلْفَى. نرتّب الأمور بعناية وسنعود قريبًا بإذن الله.",
        "intro": "الوقت المتوقع للعودة",
        "units": ["أيام", "ساعات", "دقائق", "ثوانٍ"],
        "when": "الموعد المتوقع",
        "done": "يُفترض أن الصيانة قد اكتملت. يمكنك إعادة المحاولة الآن.",
        "home": "العودة إلى الرئيسية",
        "retry": "إعادة المحاولة",
    },
    "nl": {
        "title": "Onderhoud — ZULFAA",
        "eyebrow": "Gepland onderhoud",
        "h1": "We zijn zo terug",
        "body": "ZULFAA is momenteel even in onderhoud. We werken alles zorgvuldig bij en zijn binnenkort weer beschikbaar.",
        "intro": "Verwachte terugkeer over",
        "units": ["Dagen", "Uren", "Minuten", "Seconden"],
        "when": "Verwacht terug",
        "done": "Het onderhoud zou nu klaar moeten zijn. U kunt het opnieuw proberen.",
        "home": "Terug naar home",
        "retry": "Opnieuw proberen",
    },
}

# The UTC fallback for scripting-off, in each language's own date order. The
# script replaces it with the visitor's local time as soon as it runs.
MONTHS = {
    "en": ["January", "February", "March", "April", "May", "June", "July",
           "August", "September", "October", "November", "December"],
    "nl": ["januari", "februari", "maart", "april", "mei", "juni", "juli",
           "augustus", "september", "oktober", "november", "december"],
    "ar": ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو",
           "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
}
AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"


def _instant(cfg, key):
    raw = cfg.get(key)
    assert isinstance(raw, str) and raw, "maintenance.json: %s is required" % key
    t = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    assert t.tzinfo is not None, (
        "maintenance.json: %s = %r has no offset; write it in UTC, e.g. 2026-09-18T09:00:00Z" % (key, raw))
    return t.astimezone(timezone.utc)


def load():
    """The window, validated. Every consumer reads it through here."""
    with open(CONFIG, encoding="utf-8") as fh:
        cfg = json.load(fh)
    start, end = _instant(cfg, "startsAt"), _instant(cfg, "endsAt")
    assert end > start, "maintenance.json: endsAt must be after startsAt"
    routes = cfg.get("routes", [])
    assert isinstance(routes, list), "maintenance.json: routes must be a list"
    for r in routes:
        assert r not in NEVER_GATED, (
            "maintenance.json: %r can never be gated - Play needs the legal pages reachable" % r)
    status = cfg.get("status") or {}
    return {
        "enabled": cfg.get("enabled") is True,
        "start": start,
        "end": end,
        "routes": routes,
        "status": {l: (status.get(l) or "").strip() for l in ("en", "ar", "nl")},
    }


def _iso(t):
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def _utc_text(lang, t):
    day, month, year, hm = t.day, MONTHS[lang][t.month - 1], t.year, t.strftime("%H:%M")
    if lang in ("en", "nl"):
        s = "%d %s %d, %s UTC" % (day, month, year, hm)
    else:
        s = "%d %s %d، %s UTC" % (day, month, year, hm)
        s = "".join(AR_DIGITS[int(c)] if c.isdigit() else c for c in s)
    return s


def _covered(page, routes):
    return any(page == r if r == "" else page.startswith(r) for r in routes)


def gate(cfg, lang, page, depth):
    """The head line that sends a covered page to the maintenance page, or ""
    when the gate is off or the page is not covered."""
    if not cfg["enabled"] or not _covered(page, cfg["routes"]):
        return ""
    from chrome import LANGS, up
    target = up(depth) + LANGS[lang]["base"] + "maintenance/"
    start = int(cfg["start"].timestamp() * 1000)
    end = int(cfg["end"].timestamp() * 1000)
    return ('    <script data-maintenance-gate>(function(){try{var n=Date.now();'
            'if(n>=%d&&n<%d)location.replace("%s?from="+encodeURIComponent('
            'location.pathname+location.search+location.hash))}catch(e){}})();</script>\n'
            % (start, end, target))


GATE_RE = re.compile(r"    <script data-maintenance-gate>.*?</script>\n")
BOOT_RE = re.compile(r'    <script>\(function\(\)\{try\{var t=localStorage\.getItem\("zulfaa-site-theme"\).*?</script>\n')
SKIP = {"404.html"}
LANG_DIRS = {"ar", "nl"}


def _pages(site):
    """(relative path, lang, page key, depth) for every public page."""
    for dirpath, dirs, files in os.walk(site):
        rel_dir = os.path.relpath(dirpath, site).replace("\\", "/")
        parts = [] if rel_dir == "." else rel_dir.split("/")
        if parts and (parts[0].startswith(".") or parts[0] in ("tools", "assets", "p")):
            dirs[:] = []
            continue
        if "index.html" not in files:
            continue
        lang = parts[0] if parts and parts[0] in LANG_DIRS else "en"
        key = parts[1:] if lang != "en" else parts
        if key[:1] == ["maintenance"]:
            continue
        page = "".join(p + "/" for p in key)
        yield ("/".join(parts + ["index.html"]), lang, page, len(parts))


def apply(site=None, write=None):
    """Writes the three maintenance pages, then puts the gate line into - or
    takes it out of - every covered page's <head>, right after the theme boot.

    Called by build.py after everything else has been written. Idempotent: with
    the gate off it only removes lines a previous build added, so a site that
    never enabled it is left byte-identical."""
    from chrome import SITE, LANGS, write as chrome_write
    site = site or SITE
    write = write or chrome_write
    cfg = load()
    written = [write(os.path.join(LANGS[l]["base"], "maintenance", "index.html").replace("\\", "/"), build(l))
               for l in ("en", "ar", "nl")]
    for rel, lang, page, depth in _pages(site):
        full = os.path.join(site, rel)
        with open(full, encoding="utf-8", newline="") as fh:
            t = fh.read()
        new = GATE_RE.sub("", t)
        line = gate(cfg, lang, page, depth)
        if line:
            m = BOOT_RE.search(new)
            assert m, "no theme boot line to anchor the maintenance gate in " + rel
            new = new[:m.end()] + line + new[m.end():]
        if new != t:
            with open(full, "w", encoding="utf-8", newline="") as fh:
                fh.write(new)
            written.append(rel + "  (maintenance gate %s)" % ("on" if line else "removed"))
    return written


def covered_paths(cfg):
    """Site-root paths of every page the gate covers, in every language, for
    the page script: "=/ar/" is that exact page, "/articles/" everything under
    it. Empty while the gate is off, so the script has nothing to withhold."""
    if not cfg["enabled"]:
        return ""
    from chrome import LANGS
    out = []
    for l in ("en", "ar", "nl"):
        for r in cfg["routes"]:
            p = "/" + LANGS[l]["base"] + r
            out.append("=" + p if r == "" else p)
    return " ".join(out)


def localized_routes(site=None):
    """Root paths ("/", "/privacy/", "/articles/prayer-times/") of every page
    that exists in ALL THREE languages, maintenance excluded.

    assets/maintenance.js accepts a `from` destination only if it is one of
    these (in any language), and it is what makes a language switch exact: the
    same route exists on the other side by construction. Read from the tree
    build.py has just written, so a new page is covered without a list to keep."""
    from chrome import SITE
    by_lang = {}
    for _rel, lang, page, _depth in _pages(site or SITE):
        by_lang.setdefault(lang, set()).add(page)
    common = set.intersection(*(by_lang.get(l, set()) for l in ("en", "ar", "nl")))
    return " ".join(sorted("/" + p for p in common))


def build(lang):
    from chrome import LANGS, JS_CLASS, THEME_BOOT, asset, e, up, header, footer, main_open

    cfg = load()
    c = COPY[lang]
    depth = 1 if lang == "en" else 2
    a = up(depth)
    home = (a + LANGS[lang]["base"]) or "./"
    status = cfg["status"][lang]
    end_iso = _iso(cfg["end"])
    # While the gate covers this language's home page, "Return home" would only
    # bounce back here; the page hides it for exactly the gated window.
    home_gated = "true" if cfg["enabled"] and _covered("", cfg["routes"]) else "false"

    cells = "\n".join(
        '                <li class="mt-cell"><span class="mt-num" data-unit="%s">--</span>'
        '<span class="mt-unit">%s</span></li>' % (k, e(u))
        for k, u in zip(("d", "h", "m", "s"), c["units"]))

    status_html = ('            <p class="mt-status">%s</p>\n' % e(status)) if status else ""

    # The site's own chrome, as on the 404. page="maintenance/" makes every
    # language menu - Top Bar, header, footer - offer THIS page in the other
    # languages, and marks no nav item as current, which is the truth here.
    chrome = header(lang, "maintenance/", depth)
    # footer() closes the document; the countdown script goes in just before.
    closing = footer(lang, "maintenance/", depth).replace(
        "  </body>",
        '    <script src="%s%s" defer></script>\n  </body>' % (a, asset("assets/maintenance.js")), 1)

    return f"""<!doctype html>
<html lang="{lang}" dir="{LANGS[lang]['dir']}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{e(c['title'])}</title>
    <meta name="description" content="{e(c['body'])}" />
    <meta name="robots" content="noindex, follow" />
    <link rel="icon" type="image/png" href="{a}assets/favicon-64.png" />
    <link rel="apple-touch-icon" href="{a}assets/apple-touch-icon.png" />
    <link rel="stylesheet" href="{a}{asset("assets/zulfaa.css")}" />
    <link rel="stylesheet" href="{a}{asset("assets/maintenance.css")}" />
{JS_CLASS}
{THEME_BOOT}
    <meta name="theme-color" content="#fef9f0" />
  </head>
  <body>
{chrome}{main_open(lang, depth)}        <section class="mt" aria-labelledby="mt-title">
          <div class="mt-art" aria-hidden="true">
            <img
              src="{a}assets/maintenance-842.webp"
              srcset="{a}assets/maintenance-562.webp 562w, {a}assets/maintenance-842.webp 842w, {a}assets/maintenance-1122.webp 1122w"
              sizes="(min-width: 56.25rem) min(38vw, 26rem), (min-width: 30rem) 17rem, min(64vw, 14rem)"
              width="1122"
              height="1402"
              alt=""
              decoding="async"
              fetchpriority="high"
            />
          </div>
          <div class="mt-copy">
            <p class="mt-eyebrow">{e(c['eyebrow'])}</p>
            <h1 class="mt-title" id="mt-title">{e(c['h1'])}</h1>
            <p class="mt-body">{e(c['body'])}</p>
{status_html}            <div class="mt-count" data-starts="{_iso(cfg['start'])}" data-ends="{end_iso}" data-home-gated="{home_gated}" data-covered="{covered_paths(cfg)}" data-routes="{localized_routes()}" data-lang="{lang}">
              <p class="mt-intro" id="mt-intro">{e(c['intro'])}</p>
              <p class="mt-done" hidden>{e(c['done'])}</p>
              <ol class="mt-cells" aria-labelledby="mt-intro">
{cells}
              </ol>
              <p class="mt-when">{e(c['when'])}: <time datetime="{end_iso}">{e(_utc_text(lang, cfg['end']))}</time></p>
            </div>
            <p class="vh" aria-live="polite" data-mt-live></p>
            <div class="mt-actions">
              <a class="btn primary" href="{home}" data-mt-home>{e(c['home'])}</a>
              <a class="btn" href="{home}" data-mt-retry>{e(c['retry'])}</a>
            </div>
          </div>
        </section>
      </div>
    </main>

{closing}"""


if __name__ == "__main__":
    # The maintenance step on its own: `python tools/maintenance.py`. build.py
    # runs the same thing as its last step.
    for w in apply():
        print("  " + w)
