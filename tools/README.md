# Site generator — the `ar/` and `nl/` subtrees

The site is eighteen pages: six in each of English, Arabic and Dutch. Hand-kept,
fifteen copies of a privacy policy drift. These scripts keep them from drifting.

**The generated HTML is committed.** GitHub Pages serves plain static files and
never runs any of this — the tools are a maintenance aid, not a build step.

## What is generated and what is not

| | Source | Generated? |
| --- | --- | --- |
| `/`, `/privacy/`, `/terms/`, `/delete-data/`, `/support/` | hand-written | **No** — these are the approved, Play-facing English originals |
| `/ar/…`, `/nl/…` | `content.json` + `ui_strings.py` + `dd_strings.py` | Yes |
| `/updates/`, `/ar/updates/`, `/nl/updates/` | `releases/*.json` + `updates_strings.py` | **Yes, all three** — see below |

The English pages are touched by `build.py` for three things only, each
idempotent: re-rendering their `<header>` (menu button, primary links, language
menu) from the links the page already contains, adding the one-line `js`
class script in `<head>` plus `assets/nav.js` before `</body>`, and inserting
the `hreflang` alternates. Nothing below the header is read or written.

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

## Legal release gating — read this before touching content.json

**This generator is the website's legal release gate.** A Privacy or Terms
clause whose feature has not shipped is **dropped here**, so `build.py` cannot
emit what it never receives.

That is deliberate. GitHub Pages serves whatever bytes are committed, so a
clause hidden with CSS is a clause that is published. Omission is the only
control that means anything on a static site.

The map lives in the APP, at `src/release/legal.ts`, and the flags in
`src/release/nextRelease.ts`. Both are *parsed* by `extract_from_app.py` rather
than mirrored here — a second copy of a legal gate is a second thing to forget
when a feature ships.

| Mode | Command | Output | Committed? |
|---|---|---|---|
| **Public** | `python tools/extract_from_app.py` | `content.json`, then `ar/` + `nl/` | yes — this is the site |
| **Owner preview** | `ZULFAA_LEGAL_PREVIEW=1 …` | `content.preview.json`, then `.preview/` | **no — both gitignored** |

The extractor prints what it omitted on every public run. The full owner
procedure is `Docs/LEGAL_RELEASE_WORKFLOW.md` in the app repository.

> **The English pages are never touched in preview mode.** They are the
> approved, Play-facing originals; rewriting them while showing you a preview is
> exactly the accident this mechanism exists to prevent. Preview English in the
> app instead: `npm run dev`, then `/?legal=preview`.

## The Updates Oasis — `/updates/`

The one page generated in all three languages. Every word of release content is
in `releases/<id>.json`; every word of the page's own furniture is in
`updates_strings.py`; `updates.py` only renders. The content model it
implements is `Docs/UPDATES_OASIS_CONTENT_MODEL.md` in the app repository, and
its evidence gate is `Docs/APP_UPDATE_HISTORY_WORKING.md` there: **nothing goes
into a release file that is not proven in that history.**

**Adding a release:** write `releases/<id>.json`, put its id at the top of
`releases/index.json`, run `build.py`. Nothing else. If a release ever needs the
markup or the stylesheet changed, the model has failed and should be fixed.

**The gate** (`releases.render_state`):

| `distributed` | `status` | On the page |
|---|---|---|
| `true` | `released` | an available release: filled pill, a date, the archive |
| `false` | `upcoming` | "not released yet": outline pill, **no date**, never in the hero band |
| `false` | `internal` (or anything else) | **nothing** — kept as record, rendered nowhere |

`status: released` with `distributed: false`, or `upcoming` with `true`, is a
validation error, as is an upcoming entry with a publish date. So an internal QA
phase cannot become a public release entry by omission: it has to be marked,
deliberately, one of the two.

**Validation** runs on every build and stops it on any failure: unique permanent
id, all three languages everywhere prose appears, 3–5 headline changes that
exist, alt text in three languages on every image, a date whose precision
matches (`YYYY-MM-DD` = day, `YYYY-MM` = month, `null` = unknown), non-empty
evidence, and every area one of the nine. `python tools/releases.py` runs it on
its own and lists what the page will show.

**Content still to come** goes in an upcoming release's `pending` list — the
Qur'an audit is the first — and renders as a dashed "Still being written"
block, so the gap is visible instead of the list looking finished. When the
content arrives it becomes ordinary `changes` entries in the same file and the
pending item is deleted. The page needs no change for that.

**A deep link** is `/updates/#r-<id>`, and each card is `#c-<id>-<change id>`.
Ids are permanent. The newest release, and any release the hero links to, is
rendered open; older ones collapse, and a link into a collapsed one opens it
(`:target` in the stylesheet).

## Running it

```bash
# 1. re-read the app's text (only needed when the app's legal text changes)
ZULFAA_APP_SRC='/path/to/Design modern Islamic app UI' python tools/extract_from_app.py

# 2. regenerate the ar/ and nl/ pages
python tools/build.py

# 3. GENERATING IS NOT PUBLISHING. This repository is the deployment.
git status            # the generated files are modified, not committed
git add -A && git commit -m "..." && git push
git log origin/main -1        # confirm the push landed
# then load https://zulfaa.nl/privacy/ and read it
```

Step 3 is written out because it was once skipped: the pages were regenerated,
reported as updated, and the live site served the previous text for the rest of
the day.

Both are deterministic: running them twice leaves the tree byte-identical.

## Files

```
extract_from_app.py   reads the app, writes content.json   (read-only on the app)
content.json          ar/en/nl legal + product text, extracted
ui_strings.py         chrome, marketing copy, the deixis rules
dd_strings.py         the data-deletion page, ar + nl
chrome.py             head, header (menu button + language menu), footer, clause renderer
responsive_check.mjs  headless-Chrome check: overflow, menu/dropdown, screenshots (--nojs, --states)
home.py               the landing page, carousel and lightbox
pages.py              privacy, terms, support, delete-data
build.py              writes everything; run this one
shots.json            the screenshot manifest (file names, sizes)
releases/             the Updates Oasis source: index.json + one file per release
releases.py           loads and validates it; the release gate lives here
updates.py            the /updates/ page, all three languages
updates_strings.py    that page's headings, labels, area names and icons
```

## If you add a language

Add it to `LANGS` and `DEIXIS` in `ui_strings.py`, add its block to `S`, add a
block to `DD`, extend `CAPS` in `chrome.py`, and teach
`extract_from_app.py` where that language sits in the app's dictionaries. The
templates need no change.
