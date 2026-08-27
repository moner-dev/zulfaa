# Site generator — the `ar/` and `nl/` subtrees

The site is fifteen pages: five in each of English, Arabic and Dutch. Hand-kept,
fifteen copies of a privacy policy drift. These scripts keep them from drifting.

**The generated HTML is committed.** GitHub Pages serves plain static files and
never runs any of this — the tools are a maintenance aid, not a build step.

## What is generated and what is not

| | Source | Generated? |
| --- | --- | --- |
| `/`, `/privacy/`, `/terms/`, `/delete-data/`, `/support/` | hand-written | **No** — these are the approved, Play-facing English originals |
| `/ar/…`, `/nl/…` | `content.json` + `ui_strings.py` + `dd_strings.py` | Yes |

The English pages are touched by `build.py` for one thing only: inserting the
language switcher and the `hreflang` alternates, both idempotent.

## Where the words come from

**Legal text is never authored here.** The Arabic and Dutch privacy clauses and
terms are the *mobile app's own strings*, lifted out of `src/App.tsx` and
`src/legal/terms.ts` by `extract_from_app.py` into `content.json`. The app and
the website are one legal baseline; a separate website translation would be a
second one, and the two would disagree the first time either changed.

The only edits applied to a clause are the deixis swaps in `ui_strings.DEIXIS`
— plain substring replacements that move the reader from inside the app to the
website ("the button at the bottom of this page" → "…of the Privacy page inside
the app"). Nothing else about a clause is altered, which is checkable: strip the
tags from a generated page and each clause equals its `content.json` entry with
those substitutions applied.

`ui_strings.py` and `dd_strings.py` hold navigation, headings and marketing
copy only.

## Running it

```bash
# 1. re-read the app's text (only needed when the app's legal text changes)
ZULFAA_APP_SRC='/path/to/Design modern Islamic app UI' python tools/extract_from_app.py

# 2. regenerate the ar/ and nl/ pages
python tools/build.py
```

Both are deterministic: running them twice leaves the tree byte-identical.

## Files

```
extract_from_app.py   reads the app, writes content.json   (read-only on the app)
content.json          ar/en/nl legal + product text, extracted
ui_strings.py         chrome, marketing copy, the deixis rules
dd_strings.py         the data-deletion page, ar + nl
chrome.py             head, header, footer, switcher, clause renderer
home.py               the landing page, carousel and lightbox
pages.py              privacy, terms, support, delete-data
build.py              writes everything; run this one
shots.json            the screenshot manifest (file names, sizes)
```

## If you add a language

Add it to `LANGS` and `DEIXIS` in `ui_strings.py`, add its block to `S`, add a
block to `DD`, extend `CAPS` in `chrome.py`, and teach
`extract_from_app.py` where that language sits in the app's dictionaries. The
templates need no change.
