# Pulls the ar/en/nl legal + product text out of the MOBILE APP (read-only) and
# writes one content file the website generator consumes. The app is the single
# source of truth for wording; the site must never carry a separate translation.
#
# IT IS ALSO THE LEGAL RELEASE GATE for the website. A clause whose feature has
# not shipped is DROPPED here, so build.py cannot emit what it never receives.
# That is deliberate and it is the whole mechanism: this site is static GitHub
# Pages, where hidden text is published text and CSS is not a legal control.
#
#   python tools/extract_from_app.py                 -> content.json          (public)
#   ZULFAA_LEGAL_PREVIEW=1 python tools/extract_from_app.py
#                                                    -> content.preview.json  (owner)
import re, json, os

APP = os.path.join(os.environ.get("ZULFAA_APP_SRC", ""), "src", "App.tsx")
TERMS = os.path.join(os.environ.get("ZULFAA_APP_SRC", ""), "src", "legal", "terms.ts")
LEGAL = os.path.join(os.environ.get("ZULFAA_APP_SRC", ""), "src", "release", "legal.ts")
FLAGS = os.path.join(os.environ.get("ZULFAA_APP_SRC", ""), "src", "release", "nextRelease.ts")
if not os.path.isfile(APP):
    raise SystemExit(
        "Set ZULFAA_APP_SRC to the mobile app checkout, for example:\n"
        "  ZULFAA_APP_SRC='/path/to/Design modern Islamic app UI' python tools/extract_from_app.py")

PREVIEW = os.environ.get("ZULFAA_LEGAL_PREVIEW") == "1"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "content.preview.json" if PREVIEW else "content.json")

app = open(APP, encoding="utf-8").read()
terms_src = open(TERMS, encoding="utf-8").read()
legal_src = open(LEGAL, encoding="utf-8").read()
flags_src = open(FLAGS, encoding="utf-8").read()

# ── the legal release configuration, PARSED from the app ─────────────────────
# src/release/legal.ts maps each clause id to the release condition that makes
# it public; src/release/nextRelease.ts holds the flags. Both are read rather
# than mirrored, because a second copy of a legal gate is a second thing to
# forget when a feature ships.

def _flag(name, _depth=0):
    """Read a release flag, following ONE level of indirection.

    `darkTheme` is declared as `darkTheme: DARK_THEME_RELEASED` rather than a
    literal, deliberately: App.tsx guards the theme controls on the plain const
    so Rollup can fold it, and the record is built FROM that const so the two
    cannot drift. So a value here may be another identifier, and refusing to
    follow it would make this generator unable to read the very flag whose
    indirection exists for safety."""
    if _depth > 4:
        raise SystemExit("release flag %r is defined circularly" % name)
    m = (re.search(r"export const " + name + r"\s*(?::[^=]*)?=\s*(\w+)", flags_src)
         or re.search(r"\b" + name + r":\s*(\w+)", flags_src))
    if not m:
        raise SystemExit("could not read release flag %r from nextRelease.ts" % name)
    v = m.group(1)
    if v in ("true", "false"):
        return v == "true"
    return _flag(v, _depth + 1)

def _gate_map(const):
    """{clause id: release condition}, out of legal.ts"""
    m = re.search(r"export const " + const + r"[^=]*=\s*\{(.*?)^\}", legal_src, re.S | re.M)
    if not m:
        raise SystemExit("could not find %s in legal.ts" % const)
    body = re.sub(r"/\*.*?\*/", "", m.group(1), flags=re.S)
    return dict(re.findall(r'(\w+):\s*"(\w+)"', body))

UMRAH = _flag("umrahSavings")
RELEASE_MET = {
    "released": True,
    "darkTheme": _flag("darkTheme"),
    "umrahSavings": UMRAH,
    "ramadanPlanner": _flag("ramadanPlanner"),
}
PRIVACY_CLAUSE_RELEASE = _gate_map("PRIVACY_CLAUSE_RELEASE")
TERMS_CLAUSE_RELEASE = _gate_map("TERMS_CLAUSE_RELEASE")

def public(clause_id, gates):
    rel = gates.get(clause_id, "released")
    if rel not in RELEASE_MET:
        raise SystemExit("clause %r names an unknown release condition %r" % (clause_id, rel))
    return RELEASE_MET[rel]

def keep(sections, gates):
    """Drop every clause whose feature has not been released.

    Under ZULFAA_LEGAL_PREVIEW nothing is dropped, and the result goes to a
    separate file that build.py renders into an ignored directory."""
    if PREVIEW:
        return sections, []
    kept = [s for s in sections if public(s["id"], gates)]
    dropped = [s["id"] for s in sections if not public(s["id"], gates)]
    return kept, dropped

# The anchor is the privacy "last updated" line: unique per language, and it
# sits inside that language's dictionary block. It CHANGES whenever the policy
# is revised, so this map must be revised with it — a stale anchor raises below
# rather than silently extracting the wrong language.
ANCHOR = {
    "ar": 'privUpdated: "٢٧ أغسطس ٢٠٢٦"',
    "en": 'privUpdated: "27 August 2026"',
    "nl": 'privUpdated: "27 augustus 2026"',
}

def unesc(s):
    return (s.replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\"))

def dict_block(lang):
    """the slice of the dictionary that belongs to this language"""
    i = app.index(ANCHOR[lang])
    return app[max(0, i - 20000): i + 6000]

def one(blk, key):
    m = re.search(r'\b%s: "((?:[^"\\]|\\.)*)"' % key, blk, re.S)
    return unesc(m.group(1)) if m else None

def arr(blk, key):
    m = re.search(r'\b%s: \[(.*?)\]' % key, blk, re.S)
    if not m: return []
    return [unesc(x) for x in re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1))]

content = {}
dropped_report = {}

for lang in ("ar", "en", "nl"):
    blk = dict_block(lang)

    # ── privacy, straight from the app ────────────────────────────────────
    i = app.index("privSections: [", app.index(ANCHOR[lang]))
    pblk = app[i:app.index("\n      ],", i)]
    psec = [{"id": k, "title": unesc(t), "body": unesc(b)}
            for k, t, b in re.findall(r'\{ key: "([a-zA-Z]+)", title: "((?:[^"\\]|\\.)*)", body: "((?:[^"\\]|\\.)*)" \},', pblk, re.S)]
    # A magic number here broke on every policy edit and explained nothing. What
    # matters is that all three languages carry the SAME clauses in the same
    # order, which is checked once all three are in hand.
    assert len(psec) >= 18, ("too few privacy clauses", lang, len(psec))
    psec, pdrop = keep(psec, PRIVACY_CLAUSE_RELEASE)

    # ── terms ─────────────────────────────────────────────────────────────
    start = terms_src.index("\n  %s: {" % lang)
    end = terms_src.index("\n  },", start)
    tblk = terms_src[start:end]
    tsec = []
    for k, t, b in re.findall(r'\{ key: "([a-zA-Z]+)", title: "((?:[^"\\]|\\.)*)", body:\s*((?:"(?:[^"\\]|\\.)*"(?:\s*\+\s*(?:DEVELOPER|SUPPORT_EMAIL)\s*\+\s*)?)+)\s*\},', tblk, re.S):
        body = b
        body = re.sub(r'"\s*\+\s*DEVELOPER\s*\+\s*"', "MONER INTELLIGENCE SYSTEMS", body)
        body = re.sub(r'"\s*\+\s*SUPPORT_EMAIL\s*\+\s*"', "moner.intelligence@gmail.com", body)
        body = "".join(re.findall(r'"((?:[^"\\]|\\.)*)"', body))
        tsec.append({"id": k, "title": unesc(t), "body": re.sub(r"\s+", " ", unesc(body)).strip()})
    assert len(tsec) >= 21, ("too few terms clauses", lang, len(tsec))
    tsec, tdrop = keep(tsec, TERMS_CLAUSE_RELEASE)
    dropped_report[lang] = {"privacy": pdrop, "terms": tdrop}

    content[lang] = {
        "nav": {
            "privacy": None, "terms": None, "support": None,
        },
        "privacy": {
            "subtitle": one(blk, "privSubtitle"),
            "updated": one(blk, "privUpdated"),
            "updatedLabel": one(blk, "privUpdatedLabel"),
            "summary": one(blk, "privSummary"),
            "intro": one(blk, "privIntro"),
            "sections": psec,
        },
        "terms": {
            "subtitle": re.search(r'subtitle:\s*"((?:[^"\\]|\\.)*)"', tblk).group(1),
            "summary": re.search(r'summary:\s*"((?:[^"\\]|\\.)*)"', tblk).group(1),
            "intro": unesc(re.search(r'intro:\s*\n?\s*"((?:[^"\\]|\\.)*)"', tblk, re.S).group(1)),
            "updated": re.search(r'updated:\s*"((?:[^"\\]|\\.)*)"', tblk).group(1),
            "updatedLabel": re.search(r'updatedLabel:\s*"((?:[^"\\]|\\.)*)"', tblk).group(1),
            "sections": tsec,
        },
        "product": {
            "tagline": one(blk, "aboutTagline"),
            "about": one(blk, "aboutBody"),
            "features": arr(blk, "aboutFeatures"),
        },
        "support": {
            "faqTitle": one(blk, "helpFaqTitle"),
            "contactTitle": one(blk, "helpContactTitle"),
            "contactBody": one(blk, "helpContactBody"),
            "contactAction": one(blk, "helpContactAction"),
            "faq": [],
        },
        "deleteUi": {
            "privClearTitle": one(blk, "privClearTitle"),
            "privClearBody": one(blk, "privClearBody"),
            "privClearAction": one(blk, "privClearAction"),
            "privClearConfirm": one(blk, "privClearConfirm"),
            "delAccTitle": one(blk, "delAccTitle"),
            "delAccAction": one(blk, "delAccAction"),
            "delAccSheetIntro": one(blk, "delAccSheetIntro"),
            "delAccConfirm": one(blk, "delAccConfirm"),
            "delAccDone": one(blk, "delAccDone"),
            "delAccList": arr(blk, "delAccList"),
        },
    }

    # FAQ pairs
    m = re.search(r'\bfaq: \[(.*?)\n      \],', blk, re.S)
    if m:
        for q, a in re.findall(r'\{ q: "((?:[^"\\]|\\.)*)", a: "((?:[^"\\]|\\.)*)" \}', m.group(1), re.S):
            content[lang]["support"]["faq"].append({"q": unesc(q), "a": unesc(a)})

    # drawer labels for navigation
    dm = list(re.finditer(r'drawer: \{(.*?)\n      \}', app, re.S))
    idx = {"ar": 0, "en": 1, "nl": 2}[lang]
    d = dict(re.findall(r'(\w+): "((?:[^"\\]|\\.)*)"', dm[idx].group(1)))
    content[lang]["nav"] = {"privacy": unesc(d["privacy"]), "terms": unesc(d["terms"]), "support": unesc(d["help"])}

# ── parity: the three languages must carry the SAME clauses in the SAME order ─
# This is what the per-language counts were standing in for. A clause added to
# en and forgotten in nl produced three pages that disagreed about what the
# policy says, which is the drift this generator exists to prevent.
for doc in ("privacy", "terms"):
    ids = {lang: [c["id"] for c in content[lang][doc]["sections"]] for lang in ("ar", "en", "nl")}
    if not (ids["ar"] == ids["en"] == ids["nl"]):
        missing = {a: sorted(set(ids[b]) - set(ids[a]))
                   for a in ids for b in ids if set(ids[b]) - set(ids[a])}
        raise SystemExit("%s clauses differ between languages; missing per language: %r" % (doc, missing))
    print("  %-8s %d clauses, identical in ar/en/nl" % (doc, len(ids["en"])))

json.dump(content, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print("extracted ->", OUT)
print("  MODE:", "NEXT-RELEASE PREVIEW (owner only)" if PREVIEW else "PUBLIC (current release)")
if not PREVIEW:
    drops = dropped_report["en"]
    print("  omitted, not yet released — privacy: %s | terms: %s"
          % (drops["privacy"] or "none", drops["terms"] or "none"))
for lang in ("ar", "en", "nl"):
    c = content[lang]
    print("  %s  privacy %d clauses | terms %d clauses | faq %d | delAccList %d | features %d"
          % (lang, len(c["privacy"]["sections"]), len(c["terms"]["sections"]),
             len(c["support"]["faq"]), len(c["deleteUi"]["delAccList"]), len(c["product"]["features"])))
    assert all(c["privacy"][k] for k in ("subtitle", "updated", "summary", "intro")), lang
    assert all(c["terms"][k] for k in ("subtitle", "summary", "intro", "updated")), lang
    assert c["product"]["about"] and c["support"]["contactBody"], lang
