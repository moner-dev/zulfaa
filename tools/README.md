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
procedure is `Docs/operations/LEGAL_RELEASE_WORKFLOW.md` in the app repository.

> **The English pages are never touched in preview mode.** They are the
> approved, Play-facing originals; rewriting them while showing you a preview is
> exactly the accident this mechanism exists to prevent. Preview English in the
> app instead: `npm run dev`, then `/?legal=preview`.

## The Updates Oasis — `/updates/`

The one page generated in all three languages. Every word of release content is
in `releases/<id>.json`; every word of the page's own furniture is in
`updates_strings.py`; `updates.py` only renders. The content model it
implements is `Docs/releases/UPDATES_OASIS_CONTENT_MODEL.md` in the app repository, and
its evidence gate is `Docs/releases/APP_UPDATE_HISTORY.md` there: **nothing goes
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

**A deep link** is `/updates/#r-<id>`; a section is `#r-<id>-<area>` and a
single change `#c-<id>-<change id>`. Ids are permanent. Every release is in
the page; the URL fragment decides which one is SHOWN - the stylesheet reads
`:target` (and `:has()` for a link into a section) with scripting off, and
`assets/updates.js` sets `.is-selected` with it on. The newest release shows
when there is no fragment.

**The writing rule.** Say what changed, why the user will notice it, then
stop. A change's `body` is one short paragraph - one to three sentences,
roughly 25-55 words in English - with no internal mechanics, no audit
reasoning and no edge cases a normal reader does not need. The title carries
the headline; the body does not repeat it. Behaviour that matters (what is
never switched on for you, what stays an estimate) is kept; justification is
cut. All three languages are written to the same length.

**Curated stories.** A release may carry `stories: [{area, title, lead}]` -
the headline and lead an area's section opens with. An area without one opens
with its most important change instead, so a story is never required. The
two or three changes a section shows are the release's `headline` entries for
that area first, then the newest kind; the rest sit behind "View all".

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
home.py               the landing page (the carousel and preview come from showcase.py)
showcase.py           the homepage screenshot carousel + preview, all three languages
showcase_art.py       masters (../assets/masters/screenshots) -> assets/showcase/<screen>-<lang>-<theme>[-640].webp
article_art.py        an article's `screen` inside the empty phone (../assets/masters/device) -> assets/articles/, per language and theme
pages.py              privacy, terms, support, delete-data
build.py              writes everything; run this one
shots.json            the carousel's screens, in order (English caption + alt; ar/nl captions in chrome.CAPS)
maintenance.json      THE maintenance window: enabled, startsAt, endsAt (UTC), routes, status
maintenance.py        /maintenance/ in en, ar, nl + the gate line; build.py runs it last
maintenance_art.py    the 503 sticker -> assets/maintenance-{562,842,1122}.webp
notfound.py           404.html: the English page + Arabic/Dutch pages in <template>s, chosen by URL
forbidden.py          /403/ in en, ar, nl
error_pages_check.mjs headless-Chrome check of what visitors get on 404, 403 and maintenance
releases/             the Updates Oasis source: index.json + one file per release
releases.py           loads and validates it; the release gate lives here
updates.py            the /updates/ page, all three languages
updates_strings.py    that page's headings, labels, area names and icons
```

## The homepage carousel

The screenshots are the app's own, per language AND theme. The organised
originals and their manifest (screen, language, theme, SHA-256) live outside
this repository, which is the deployment:

    ../assets/masters/screenshots/{AR,En,NL}/{Dark,Light}/<screen>-<lang>-<theme>.png|jpg
    ../assets/masters/screenshots/screenshot-manifest.csv

To change what the carousel shows:

1. edit `shots.json` (order, English caption and alt) and `chrome.CAPS` (Arabic
   and Dutch captions, same order) - a screen belongs there only when all six
   of its masters exist;
2. `python tools/showcase_art.py` - writes the six variants' web files; it
   stops and names any missing master rather than substituting one;
3. the normal build (`build.py`, `quick_access.py --write-en`, `write_en.py`,
   `build.py`); `write_en.py` gives the English page the same markup.

A page shows only its own language. The theme is the site's (`data-site-theme`,
set by the theme boot and the lantern): the markup carries the light files and
both themes' URLs, an inline line under the slides picks dark before a lazy
slide can load, and `assets/carousel.js` follows the lantern and hands the
preview the current theme's full-size file. `tools/showcase.py` has the details.

The older `assets/showcase/*.webp` files (941x1672 Store images) are no longer
in the carousel; three are still used by the journal articles. None were deleted.

## Maintenance

Edit `maintenance.json`, then run `python tools/build.py` (or just
`python tools/maintenance.py`). Times are UTC with a `Z`; the page shows them in
the visitor's own time zone.

* `enabled: false` (default) — `/maintenance/` exists for review; no page points
  at it and no page changes.
* `enabled: true` — the pages in `routes` get a one-line head script that, between
  `startsAt` and `endsAt` by the visitor's clock, replaces them with the
  maintenance page in their language (`?from=` keeps where they were going).
  After `endsAt` it does nothing, so an overrun needs a new `endsAt` pushed.
  Set it back to `false` and rebuild to remove the lines.
* `privacy/`, `terms/` and `delete-data/` can never be listed — the loader refuses.

**This is not an HTTP 503.** zulfaa.nl points straight at GitHub Pages, which only
answers 200 or 404; the maintenance page is served as 200 with `noindex`, and
visitors without JavaScript see the ordinary pages. A real 503 needs a CDN or
proxy in front of Pages — a hosting change, not made here.

`?from=` is accepted only for a route that exists in all three languages
(`data-routes`, written by the build); Try again goes to that route in the
page's own language, and the language links carry it into theirs. Anything
else falls back to that language's home.

## Error pages: what is designed and what is actually served

| | Page | Served with that status? |
|---|---|---|
| 404 | `404.html`, one file | **yes** — GitHub Pages answers every unknown URL with it and status 404, at the address asked for |
| 403 | `/403/`, `/ar/403/`, `/nl/403/` | no — ordinary pages (200). Pages never answers 403; nothing routes a visitor here yet |
| 503 | `/maintenance/` + the gate above | no — 200 with `noindex`; a real 503 needs a CDN or proxy |

**The 404's language comes from the URL, not a redirect.** `/ar/…` gets the whole
page in Arabic, right to left; `/nl/…` in Dutch; anything else in English. The
file carries the English page and, in inert `<template>`s, the Arabic and Dutch
pages built by the same `header()`/`main_open()`/`footer()` calls; a head script
picks the language and an inline script swaps the page in before `nav.js` runs,
so there is only ever one header, drawer, lantern, footer and dock.
`tools/notfound.py` has the details. **Without JavaScript every unknown URL gets
the English page**, and the title is English to anything that runs no script.

The 404 sticker says PAGE NOT FOUND in English inside the supplied artwork
(`assets/masters/404.png`); it is kept as supplied until a text-free master exists.

Locally, the DEV LAB front door serves `404.html` with status 404 for a missing
page (never for a missing asset) the way Pages does. Check all of it with

    node tools/error_pages_check.mjs [--gate-root <a copy built with maintenance on>]

## If you add a language

Add it to `LANGS` and `DEIXIS` in `ui_strings.py`, add its block to `S`, add a
block to `DD`, extend `CAPS` in `chrome.py`, and teach
`extract_from_app.py` where that language sits in the app's dictionaries. The
templates need no change.
