# Pulls the ar/en/nl legal + product text out of the MOBILE APP (read-only) and
# writes one content file the website generator consumes. The app is the single
# source of truth for wording; the site must never carry a separate translation.
import re, json, os

APP = os.path.join(os.environ.get("ZULFAA_APP_SRC", ""), "src", "App.tsx")
TERMS = os.path.join(os.environ.get("ZULFAA_APP_SRC", ""), "src", "legal", "terms.ts")
if not os.path.isfile(APP):
    raise SystemExit(
        "Set ZULFAA_APP_SRC to the mobile app checkout, for example:\n"
        "  ZULFAA_APP_SRC='/path/to/Design modern Islamic app UI' python tools/extract_from_app.py")

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "content.json")

app = open(APP, encoding="utf-8").read()
terms_src = open(TERMS, encoding="utf-8").read()

ANCHOR = {
    "ar": 'privUpdated: "\u0662\u0667 \u0623\u063a\u0633\u0637\u0633 \u0662\u0660\u0662\u0666"',
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

for lang in ("ar", "en", "nl"):
    blk = dict_block(lang)

    # ── privacy: 18 clauses, straight from the app ────────────────────────
    i = app.index("privSections: [", app.index(ANCHOR[lang]))
    pblk = app[i:app.index("\n      ],", i)]
    psec = [{"id": k, "title": unesc(t), "body": unesc(b)}
            for k, t, b in re.findall(r'\{ key: "([a-zA-Z]+)", title: "((?:[^"\\]|\\.)*)", body: "((?:[^"\\]|\\.)*)" \},', pblk, re.S)]
    assert len(psec) == 18, (lang, len(psec))

    # ── terms: 21 clauses ─────────────────────────────────────────────────
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
    assert len(tsec) == 21, (lang, len(tsec))

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

json.dump(content, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print("extracted ->", OUT)
for lang in ("ar", "en", "nl"):
    c = content[lang]
    print("  %s  privacy %d clauses | terms %d clauses | faq %d | delAccList %d | features %d"
          % (lang, len(c["privacy"]["sections"]), len(c["terms"]["sections"]),
             len(c["support"]["faq"]), len(c["deleteUi"]["delAccList"]), len(c["product"]["features"])))
    assert all(c["privacy"][k] for k in ("subtitle", "updated", "summary", "intro")), lang
    assert all(c["terms"][k] for k in ("subtitle", "summary", "intro", "updated")), lang
    assert c["product"]["about"] and c["support"]["contactBody"], lang
