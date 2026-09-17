# -*- coding: utf-8 -*-
"""The Updates Oasis — /updates/, in all three languages.

THE PAGE IS A RENDERER AND NOTHING ELSE. Every word of release content comes
from tools/releases/*.json; every word of the page's own furniture comes from
tools/updates_strings.py. Adding a future update touches neither this file nor
the stylesheet.

THE SHAPE - an editorial two-column composition, not a changelog.

    ┌──────────────┬──────────────────────────────────────────────┐
    │ Releases     │  UPDATE 1 · 1.1.0 · Upcoming                 │
    │              │  A headline.                                  │
    │ ● Update 1   │  One paragraph.              [what's inside]  │
    │   1.1.0      │                                               │
    │   Upcoming   │  Overview · Qur'an · Prayer · Ramadan · …     │
    │ ○ Launch     │                                               │
    │   1.0.0      │  ── Qur'an ──────────────────────────────     │
    │   Closed     │  A story headline.        1  key change       │
    │   testing    │  A short lead.            2  key change       │
    │              │  ▸ View all Qur'an changes (3)                │
    │              │  ── Prayer ──  (flipped)  …                   │
    └──────────────┴──────────────────────────────────────────────┘

LEFT, the release navigator: every release, newest first, on a thin journey
thread - a solid node for a release people received, a hollow one for a release
that is still to come. It navigates; it does not summarise. On a phone the same
markup folds into a one-line selector ("Update 1 · 1.1.0 ▾") because it is a
<details>: the stylesheet hides its summary above the breakpoint, and the small
script closes it below.

RIGHT, one release at a time. Every release is in the DOM with its permanent
id, so a link shared today resolves after ten more updates; which one is SHOWN
is decided by the URL fragment. With scripting off the stylesheet reads
:target for that, and with scripting on assets/updates.js does the same thing
explicitly and keeps the navigator's "current" mark and the section nav in
step. Nothing on the page depends on the script.

Each release is a story: a hero, a section nav for the areas it touched, and
one editorial section per area - headline, lead, the two or three changes that
matter most - with the complete list behind "View all … changes (n)". Large
areas alternate their composition; small ones pair up. Launch is told more
briefly, as history: it is the baseline, not the current story.
"""
import os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chrome import S, LANGS, e, head, header, footer, up, num, nav_items, asset  # noqa: E402
from lantern import host as lantern_host  # noqa: E402
from updates_strings import U, AREA_ICON, ICON, AREA_ORDER, KIND_ORDER  # noqa: E402
import releases as R  # noqa: E402

PAGE = "updates/"

# An area with this many changes, or with a picture, gets a full editorial
# section of its own. Smaller ones pair up in a split row.
LARGE_AREA = 3
# How many changes a section shows before "View all".
KEY_CHANGES = 3


def depth(lang):
    """How far the page's file sits below the site root, which is what up()
    counts back over. English is /updates/; Arabic and Dutch are one deeper."""
    return 1 if LANGS[lang]["base"] == "" else 2


# ── small pieces ────────────────────────────────────────────────────────────
def icon(area):
    return ICON % AREA_ICON[area]


def internal(lang, page):
    return up(depth(lang)) + LANGS[lang]["base"] + page


def page_link(lang, page):
    """A link to another page of this site, labelled the way the site's own
    navigation labels it."""
    label = dict(nav_items(lang)).get(page, page)
    return '<a href="%s">%s</a>' % (internal(lang, page), e(label))


def fmt_date(rel, lang):
    """A date is localised, not merely translated - and a date that is not known
    is said to be unknown, never approximated."""
    u = U[lang]
    on, prec = rel["publishedOn"], rel["datePrecision"]
    if prec == "unknown" or not on:
        return u["dateUnknown"]
    y, m = int(on[0:4]), int(on[5:7])
    parts = {"m": u["months"][m - 1], "y": num(y, lang)}
    if prec == "month":
        return u["dateMonth"] % parts
    parts["d"] = num(int(on[8:10]), lang)
    return u["dateDay"] % parts


def rel_label(rel, lang):
    """"Launch", or "Update 1". The Launch release has no number: it is the
    baseline, not an update to anything."""
    u = U[lang]
    if rel["updateNumber"] is None:
        return u["launch"]
    return u["update"] % num(rel["updateNumber"], lang)


def version_text(rel, lang):
    # Never transliterated: it must match, character for character, what the
    # reader's own device shows under Profile.
    v = rel["versionName"]
    if rel.get("versionProvisional"):
        v += " (%s)" % U[lang]["proposed"]
    return v


def status_short(rel, state, lang):
    u = U[lang]
    if state == "upcoming":
        return u["upcomingShort"]
    return u["trackShort"].get(rel.get("track"), u["availableNow"])


def status_long(rel, state, lang):
    u = U[lang]
    if state == "upcoming":
        return u["notReleasedYet"]
    return u["track"].get(rel.get("track"), u["availableNow"])


SENTENCE_END = re.compile(r"(?<=[.!?؟])\s+")


def first_sentence(text):
    """The one line a key change gets before "View all"."""
    return SENTENCE_END.split(text.strip(), 1)[0]


def area_nav_label(area, lang):
    """The short word the section nav uses for an area, where the full name
    would crowd it ("Across the app" -> "Experience")."""
    u = U[lang]
    return u.get("navAreas", {}).get(area) or u["areas"][area]


def key_changes(rel, cards):
    """The two or three changes a section shows. The release's own headline
    picks first; the rest fill by kind, new before fixed."""
    hl = rel.get("headline") or []
    picked = [c for c in cards if c["id"] in hl]
    for c in sorted(cards, key=lambda c: (KIND_ORDER[c["kind"]], cards.index(c))):
        if len(picked) >= KEY_CHANGES:
            break
        if c not in picked:
            picked.append(c)
    return picked[:KEY_CHANGES]


def lead_change(rel, cards, lang):
    """When an area has no curated story, one change stands in as its
    headline: a headline change if there is one, else the newest kind with
    the shortest title - a headline has to read as a headline."""
    hl = rel.get("headline") or []
    for c in cards:
        if c["id"] in hl:
            return c
    return min(cards, key=lambda c: (KIND_ORDER[c["kind"]], len(c["title"][lang])))


def media_for(rel, area=None):
    """The release's lead visual, or the first change picture in an area."""
    if area is None:
        return (rel.get("media") or [None])[0]
    for c in rel["changes"]:
        if c["area"] == area and c.get("media"):
            return c["media"]
    return None


def figure(m, lang, cls=""):
    """A picture only where it is the honest explanation. uiLang is not
    decoration: a screenshot of the Arabic app shown to a Dutch reader is
    captioned as such."""
    u, a = U[lang], up(depth(lang))
    cap = (m.get("caption") or {}).get(lang, "")
    if m["uiLang"] != lang:
        note = u["screenshotOf"] % u["langName"][m["uiLang"]]
        cap = (cap + " " + note).strip()
    return ('<figure class="device %s %s">\n'
            '  <img src="%s%s" width="%d" height="%d" alt="%s" loading="lazy" decoding="async" />\n'
            '%s</figure>\n'
            % (m["aspect"], cls, a, m["src"], m["w"], m["h"], e(m["alt"][lang]),
               '  <figcaption>%s</figcaption>\n' % e(cap) if cap else ""))


# ── the release navigator ───────────────────────────────────────────────────
CHEV = ('<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" '
        'aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>')


def release_nav(rels, lang):
    """One markup for two shapes. Above the breakpoint the stylesheet hides the
    summary and this is the sidebar; below it, it is a one-line selector that
    opens into the same list. With scripting off on a phone it simply stands
    open - two lines, no harm."""
    u = U[lang]
    first, first_state = rels[0]
    items = ""
    for i, (r, state) in enumerate(rels):
        items += (
            '            <li class="rn-item is-%s">\n'
            '              <a href="#r-%s"%s>\n'
            '                <span class="rn-node" aria-hidden="true"></span>\n'
            '                <span class="rn-label">%s</span>\n'
            '                <span class="rn-version">%s</span>\n'
            '                <span class="rn-status">%s</span>\n'
            '              </a>\n'
            '            </li>\n'
            % (state, r["id"], ' aria-current="true"' if i == 0 else "",
               e(rel_label(r, lang)), e(r["versionName"]), e(status_short(r, state, lang))))
    return f"""        <details class="release-nav" open>
          <summary aria-label="{e(u['pickRelease'])}">
            <span class="rn-current"><b data-rn-label>{e(rel_label(first, lang))}</b> <span aria-hidden="true">&middot;</span> <span data-rn-version>{e(first['versionName'])}</span></span>
            {CHEV}
          </summary>
          <nav aria-label="{e(u['releasesLabel'])}">
            <p class="rn-title">{e(u['releasesLabel'])}</p>
            <ol class="rn-list">
{items}            </ol>
          </nav>
        </details>
"""


# ── a release ───────────────────────────────────────────────────────────────
def hero(rel, state, lang):
    u = U[lang]
    rid = rel["id"]
    eyebrow = "%s <span aria-hidden=\"true\">&middot;</span> %s" % (
        e(rel_label(rel, lang)), e(version_text(rel, lang)))
    if state == "upcoming":
        meta = "%s <span aria-hidden=\"true\">&middot;</span> %s" % (
            e(u["dateUnknown"]), e(u["notReleasedNote"]))
    else:
        date = fmt_date(rel, lang)
        if rel.get("datePending"):
            date += " · " + u["datePending"]
        meta = "%s <span aria-hidden=\"true\">&middot;</span> %s" % (e(date), e(u["testersOnly"])
                                                                    if rel.get("track") != "production"
                                                                    else e(date))
    m = media_for(rel)
    if m:
        side = figure(m, lang, "hero-device")
    else:
        by_id = {c["id"]: c for c in rel["changes"]}
        rows = "".join(
            '              <li><span class="ico" aria-hidden="true">%s</span><span>%s</span></li>\n'
            % (icon(by_id[h]["area"]), e(by_id[h]["title"][lang]))
            for h in rel.get("headline") or [] if h in by_id)
        side = ('<div class="hero-inside">\n'
                '            <p class="hero-inside-title">%s</p>\n'
                '            <ul class="hero-inside-list">\n%s            </ul>\n'
                '          </div>\n' % (e(u["inThisUpdate"]), rows))
    return f"""          <header class="rel-hero">
            <div class="rel-hero-text">
              <p class="rel-eyebrow">{eyebrow} <span aria-hidden="true">&middot;</span> <span class="rel-status is-{state}">{e(status_long(rel, state, lang))}</span></p>
              <h2 id="t-{rid}">{e(rel['title'][lang])}</h2>
              <p class="rel-lead">{e(rel['summary'][lang])}</p>
              <p class="rel-meta">{meta}</p>
            </div>
            <div class="rel-hero-side">
          {side}        </div>
          </header>
"""


# The khatim - the eight-pointed star the site's ground is tiled with
# (assets/star.svg, the same two-square construction) - drawn once, in gold,
# as the bar's identity mark. One mark, not decoration.
KHATIM = ('<svg class="sec-mark" viewBox="6 6 52 52" fill="none" stroke="currentColor" '
          'stroke-width="2.2" stroke-linejoin="round" aria-hidden="true">'
          '<path d="M54.63 32 48 38.63 48 48 38.63 48 32 54.63 25.37 48 16 48 16 38.63 9.37 32 '
          '16 25.37 16 16 25.37 16 32 9.37 38.63 16 48 16 48 25.37Z"/><circle cx="32" cy="32" r="4"/></svg>')


def section_nav(rel, lang, areas):
    u = U[lang]
    rid = rel["id"]
    links = '              <a href="#r-%s">%s</a>\n' % (rid, e(u["overview"]))
    links += "".join('              <a href="#r-%s-%s">%s</a>\n' % (rid, a, e(area_nav_label(a, lang)))
                     for a in areas)
    return ('          <nav class="sec-nav" aria-label="%s">\n'
            '            %s\n'
            '            <div class="sec-links">\n%s            </div>\n'
            '          </nav>\n' % (e(u["sectionsLabel"]), KHATIM, links))


def full_list(rel, cards, area, lang, all_shown=False):
    """The complete list for one area, behind a disclosure. A refined vertical
    list: a quiet kind word, a title, the body. No boxes."""
    u = U[lang]
    cards = sorted(cards, key=lambda c: (KIND_ORDER[c["kind"]], rel["changes"].index(c)))
    rows = ""
    for c in cards:
        link = ('\n                  <p class="fl-link">%s</p>' % page_link(lang, c["page"])) if c.get("page") else ""
        rows += ('                <li class="k-%s" id="c-%s-%s">\n'
                 '                  <span class="fl-kind">%s</span>\n'
                 '                  <div class="fl-body"><b>%s</b><p>%s</p>%s</div>\n'
                 '                </li>\n'
                 % (c["kind"], rel["id"], c["id"], e(u["kinds"][c["kind"]]),
                    e(c["title"][lang]), e(c["body"][lang]), link))
    if all_shown:
        label = u["readInFull"]
    else:
        tpl = u.get("viewAllArea", {}).get(area) or u["viewAll"]
        label = tpl % {"area": u["areas"][area], "n": num(len(cards), lang)}
    return ('            <details class="story-all">\n'
            '              <summary><span class="sa-open">%s</span><span class="sa-close">%s</span>%s</summary>\n'
            '              <ol class="full-list">\n%s              </ol>\n'
            '            </details>\n'
            % (e(label), e(u["hideAll"]), CHEV, rows))


def story(rel, area, lang, flip, small=False):
    """One editorial section for one area."""
    u = U[lang]
    rid = rel["id"]
    cards = [c for c in rel["changes"] if c["area"] == area]
    st = next((s for s in rel.get("stories") or [] if s["area"] == area), None)
    keys = key_changes(rel, cards)
    lead_card = None if st else lead_change(rel, cards, lang)
    title = st["title"][lang] if st else lead_card["title"][lang]
    lead = st["lead"][lang] if st else lead_card["body"][lang]
    # what the headline already says is not said again as a key change
    shown = [c for c in keys if c is not lead_card and c["title"][lang] != title] or keys
    visible = set(c["id"] for c in shown) | ({lead_card["id"]} if lead_card else set())
    all_shown = all(c["id"] in visible for c in cards)
    m = media_for(rel, area)
    if m:
        side = figure(m, lang, "story-device")
    else:
        # the key changes ARE the visual side: a large, numbered, quiet list
        rows = "".join(
            '                <li><b>%s</b><span>%s</span></li>\n'
            % (e(c["title"][lang]), e(first_sentence(c["body"][lang]))) for c in shown)
        side = '<ol class="keys">\n%s              </ol>\n' % rows
    cls = "story" + (" small" if small else "") + (" flip" if flip else "")
    return f"""          <section class="{cls}" id="r-{rid}-{area}" aria-labelledby="h-{rid}-{area}">
            <div class="story-text">
              <p class="story-area"><span class="ico" aria-hidden="true">{icon(area)}</span>{e(u['areas'][area])}</p>
              <h3 id="h-{rid}-{area}">{e(title)}</h3>
              <p class="story-lead">{e(lead)}</p>
            </div>
            <div class="story-side">
              {side}            </div>
{full_list(rel, cards, area, lang, all_shown)}          </section>
"""


def stories(rel, lang, areas):
    """Large areas alternate composition; small ones pair up in a split row,
    so the page has a rhythm rather than one repeated component."""
    out, pending_small, flip = [], [], False
    counts = {a: sum(1 for c in rel["changes"] if c["area"] == a) for a in areas}

    def flush_small():
        if not pending_small:
            return
        if len(pending_small) == 1:
            out.append(story(rel, pending_small[0], lang, False, small=True))
        else:
            out.append('          <div class="story-split">\n'
                       + "".join(story(rel, a, lang, False, small=True) for a in pending_small)
                       + '          </div>\n')
        pending_small.clear()

    for a in areas:
        large = counts[a] >= LARGE_AREA or media_for(rel, a) is not None
        if large:
            flush_small()
            out.append(story(rel, a, lang, flip))
            flip = not flip
        else:
            pending_small.append(a)
            if len(pending_small) == 2:
                flush_small()
    flush_small()
    return "".join(out)


def compact_list(rel, lang, areas):
    """Launch is history, not the current story: one refined list of what it
    contained, grouped lightly by area, and nothing to unfold."""
    u = U[lang]
    groups = ""
    for a in areas:
        cards = [c for c in rel["changes"] if c["area"] == a]
        rows = "".join('                <li><b>%s</b><span>%s</span></li>\n'
                       % (e(c["title"][lang]), e(c["body"][lang])) for c in cards)
        groups += ('            <div class="held-group" id="r-%s-%s">\n'
                   '              <p class="story-area"><span class="ico" aria-hidden="true">%s</span>%s</p>\n'
                   '              <ul class="held">\n%s              </ul>\n'
                   '            </div>\n' % (rel["id"], a, icon(a), e(u["areas"][a]), rows))
    return ('          <section class="compact" aria-labelledby="hc-%s">\n'
            '            <h3 id="hc-%s">%s</h3>\n%s          </section>\n'
            % (rel["id"], rel["id"], e(u["whatItHeld"]), groups))


def worth_block(rel, lang):
    """Behaviour and privacy, said plainly and on their own: a reader must not
    have to infer from a list of improvements that something about their data
    is now different."""
    notes = rel.get("worthKnowing") or []
    if not notes:
        return ""
    u = U[lang]
    rows = ""
    for n in notes:
        link = ('\n                <p class="note-link">%s</p>' % page_link(lang, n["page"])) if n.get("page") else ""
        rows += ('              <div class="note n-%s">\n'
                 '                <p class="note-kind">%s</p>\n'
                 '                <h4>%s</h4>\n'
                 '                <p>%s</p>%s\n'
                 '              </div>\n'
                 % (n["kind"], e(u["notes"][n["kind"]]), e(n["title"][lang]), e(n["body"][lang]), link))
    return ('          <section class="worth" id="r-%s-worth" aria-labelledby="w-%s">\n'
            '            <h3 id="w-%s">%s</h3>\n'
            '            <div class="worth-list">\n%s            </div>\n'
            '          </section>\n' % (rel["id"], rel["id"], rel["id"], e(u["worthTitle"]), rows))


def pending_block(rel, lang):
    """What is deliberately not written yet, kept visible so the list never
    looks finished. When the content arrives it becomes ordinary changes in
    the same file and the item is deleted; the page needs no change."""
    items = rel.get("pending") or []
    if not items:
        return ""
    u = U[lang]
    rows = "".join(
        '              <div class="pending-item">\n'
        '                <h4><span class="ico" aria-hidden="true">%s</span>%s</h4>\n'
        '                <p>%s</p>\n'
        '              </div>\n'
        % (icon(p["area"]), e(p["title"][lang]), e(p["body"][lang])) for p in items)
    return ('          <section class="pending" aria-labelledby="p-%s">\n'
            '            <h3 id="p-%s">%s</h3>\n'
            '            <p class="pending-note">%s</p>\n'
            '            <div class="pending-list">\n%s            </div>\n'
            '          </section>\n'
            % (rel["id"], rel["id"], e(u["pendingTitle"]), e(u["pendingNote"]), rows))


def release(rel, state, lang):
    areas = [a for a in AREA_ORDER if any(c["area"] == a for c in rel["changes"])]
    compact = rel["updateNumber"] is None
    body = compact_list(rel, lang, areas) if compact else stories(rel, lang, areas)
    return f"""        <article class="release is-{state}{' is-compact' if compact else ''}" id="r-{rel['id']}" aria-labelledby="t-{rel['id']}">
{hero(rel, state, lang)}{'' if compact else section_nav(rel, lang, areas)}          <div class="rel-body">
{body}{worth_block(rel, lang)}{pending_block(rel, lang)}          </div>
        </article>
"""


# ── the page ────────────────────────────────────────────────────────────────
def build_updates(lang):
    u, a = U[lang], up(depth(lang))
    rels = R.rendered(R.load())
    articles = "".join(release(r, s, lang) for r, s in rels)
    return (head(lang, PAGE, depth(lang), u["title"], u["desc"]) + header(lang, PAGE, depth(lang)) + f"""    <main class="oasis">
      <div class="oasis-shell">
{lantern_host(lang, a)}        <header class="oasis-head">
          <p class="oasis-eyebrow">{e(u['eyebrow'])}</p>
          <h1>{e(u['h1'])}</h1>
          <p class="oasis-lede">{e(u['lede'])}</p>
        </header>

        <div class="oasis-grid">
{release_nav(rels, lang)}
          <div class="stage">
{articles}          </div>
        </div>

        <section class="how-versions" aria-labelledby="how-title">
          <h2 id="how-title">{e(u['footTitle'])}</h2>
          <p>{e(u['footNote'])}</p>
          <p>{e(u['footReport'])} <a href="{internal(lang, 'support/')}">{e(u['supportLink'])}</a></p>
        </section>
      </div>
    </main>
    <script src="{a}{asset("assets/updates.js")}" defer></script>
""" + footer(lang, PAGE, depth(lang)))
