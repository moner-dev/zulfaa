# -*- coding: utf-8 -*-
"""The Updates Oasis — /updates/, in all three languages.

THE PAGE IS A RENDERER AND NOTHING ELSE. Every word of release content comes
from tools/releases/*.json; every word of the page's own furniture comes from
tools/updates_strings.py. Adding a future update touches neither this file nor
the stylesheet.

THE SHAPE, and why it is this shape.

  1  The head        the emblem, the word Updates, one line saying what the
                     page is for.

  2  The spring      a full-bleed band in the site's own deep-teal material -
                     the same surface the landing page's showcase and the
                     footer are made of - carrying the newest release that a
                     person can ACTUALLY HAVE. Solid, dark, dated, with a gold
                     "Available now" pill. It exists, so it is made of
                     something.

  3  On the way      immediately beneath, on cream: the upcoming release as an
                     UNFILLED panel with a dashed rim, a plain outline pill,
                     and no date at all. It does not exist yet, so it is not
                     made of anything.

     The contrast between 2 and 3 is the message. A reader does not have to
     parse a word to know which of the two is on their phone: one is a solid
     dark slab with a date, the other is an empty outline without one. The
     pills and the wording then say it again in language.

  4  The journey     the archive. A gold thread down the reading edge with a
                     node at each release, newest first. Every release keeps a
                     permanent id, so a link shared today still resolves after
                     ten more updates. The newest stop is open; older ones are
                     collapsed and open in place.

  5  The footer note how versions work, and where to report something wrong.

NO SCRIPT. Nothing on this page needs JavaScript: the archive uses <details>,
and the area filter is a radio group the stylesheet reads. The site's guarantee
that every page is fully readable and navigable with scripting disabled holds
here too.
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chrome import S, LANGS, e, head, header, footer, up, num, nav_items  # noqa: E402
from updates_strings import U, AREA_ICON, ICON, AREA_ORDER, KIND_ORDER  # noqa: E402
import releases as R  # noqa: E402

PAGE = "updates/"


def depth(lang):
    """How far the page's file sits below the site root, which is what up()
    counts back over.

    English is /updates/ while Arabic and Dutch are /ar/updates/ and
    /nl/updates/, so the two generated language trees are one level deeper.
    Every other generated page here is Arabic-and-Dutch only and can hard-code
    2; this one is generated in all three languages and cannot.
    """
    return 1 if LANGS[lang]["base"] == "" else 2


# How many stops on the journey stand open. The newest release is the one a
# reader came for; everything behind it is an archive and collapses, so the
# page does not grow without bound as releases accumulate.
#
# Whatever this is, a release THE HERO LINKS TO is always open as well: "Read
# what changed" must land on the changes and not on a shut lid, and that has to
# be true without depending on a browser honouring a :target override.
OPEN_STOPS = 1


# ── small pieces ────────────────────────────────────────────────────────────
def icon(area):
    return ICON % AREA_ICON[area]


def internal(lang, page):
    """A site page, in this reader's language, from /updates/."""
    return up(depth(lang)) + LANGS[lang]["base"] + page


def page_link(lang, page):
    """A link to another page of this site, labelled the way the site's own
    navigation labels it - so the link reads "Privacy Policy" and not the name
    of the card's feature area."""
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


def version_line(rel, lang):
    u = U[lang]
    # The version name is the one fact a reader can check against their own
    # device, so it is never transliterated into Arabic-Indic digits: it must
    # match, character for character, what Profile shows them.
    v = "%s %s" % (u["version"], rel["versionName"])
    if rel.get("versionProvisional"):
        v += " (%s)" % u["proposed"]
    return v


def pill(lang, state):
    u = U[lang]
    if state == "released":
        return '<p class="pill-status is-available">%s</p>' % e(u["availableNow"])
    return '<p class="pill-status is-upcoming">%s</p>' % e(u["notReleasedYet"])


def headline_list(rel, lang, tone):
    """The three to five changes the hero shows. A reader who leaves after the
    hero should already know what is new."""
    by_id = {c["id"]: c for c in rel["changes"]}
    rows = "".join(
        '            <li><span class="hl-ico" aria-hidden="true">%s</span>'
        '<span class="hl-text">%s</span></li>\n'
        % (icon(by_id[h]["area"]), e(by_id[h]["title"][lang]))
        for h in rel["headline"] if h in by_id)
    return '          <ul class="headline %s">\n%s          </ul>\n' % (tone, rows)


# ── the hero panels ─────────────────────────────────────────────────────────
def spring(rel, lang):
    """Region 2 - the latest release that people actually have, on the band."""
    u, a = U[lang], up(depth(lang))
    date = fmt_date(rel, lang)
    if rel.get("datePending"):
        date += " · " + u["datePending"]
    return f"""    <section class="spring" aria-labelledby="latest-title">
      <div class="shell">
        <p class="spring-eyebrow">{e(u['latestTitle'])}</p>
        {pill(lang, 'released')}
        <h2 id="latest-title">{e(rel['title'][lang])}</h2>
        <p class="spring-meta">{e(rel_label(rel, lang))} <span aria-hidden="true">&middot;</span> {e(version_line(rel, lang))} <span aria-hidden="true">&middot;</span> {e(date)}</p>
        <p class="spring-summary">{e(rel['summary'][lang])}</p>
{headline_list(rel, lang, 'on-band')}
        <p class="spring-more"><a href="#r-{rel['id']}">{e(u['readMore'])}</a></p>
      </div>
      <span class="spring-node" aria-hidden="true"></span>
    </section>

"""


def ontheway(rel, lang):
    """Region 3 - the upcoming release. Unfilled, undated, and said in words."""
    u = U[lang]
    return f"""        <section class="ontheway" aria-labelledby="upcoming-title">
          <p class="ontheway-eyebrow">{e(u['onTheWayTitle'])}</p>
          {pill(lang, 'upcoming')}
          <h2 id="upcoming-title">{e(rel['title'][lang])}</h2>
          <p class="ontheway-meta">{e(rel_label(rel, lang))} <span aria-hidden="true">&middot;</span> {e(version_line(rel, lang))} <span aria-hidden="true">&middot;</span> {e(u['dateUnknown'])}</p>
          <p class="ontheway-summary">{e(rel['summary'][lang])}</p>
          <p class="ontheway-note">{e(u['notReleasedNote'])}</p>
{headline_list(rel, lang, 'on-cream')}
          <p class="ontheway-more"><a href="#r-{rel['id']}">{e(u['readMore'])}</a></p>
        </section>

"""


# ── a release, in full ──────────────────────────────────────────────────────
def change_card(rel, ch, lang):
    u = U[lang]
    body = e(ch["body"][lang])
    link = ""
    if ch.get("page"):
        link = ('\n                  <p class="change-link">%s</p>'
                % page_link(lang, ch["page"]))
    return (
        '                <article class="change k-%s" id="c-%s-%s">\n'
        '                  <p class="change-kind">%s</p>\n'
        '                  <h6>%s</h6>\n'
        '                  <p>%s</p>%s\n'
        '                </article>\n'
        % (ch["kind"], rel["id"], ch["id"], e(u["kinds"][ch["kind"]]),
           e(ch["title"][lang]), body, link))


def area_groups(rel, lang):
    """The What changed cards, grouped by area.

    A release does not have to touch every area, and most do not: only the
    areas this release actually changed appear, in the fixed order of
    AREA_ORDER, so a reader meets the same vocabulary in the same sequence
    every time.
    """
    u = U[lang]
    out = []
    for area in AREA_ORDER:
        cards = [c for c in rel["changes"] if c["area"] == area]
        if not cards:
            continue
        cards.sort(key=lambda c: (KIND_ORDER[c["kind"]], rel["changes"].index(c)))
        out.append(
            '              <section class="area-group g-%s" aria-labelledby="g-%s-%s">\n'
            '                <h5 id="g-%s-%s"><span class="g-ico" aria-hidden="true">%s</span>%s</h5>\n'
            '                <div class="area-cards">\n%s                </div>\n'
            '              </section>\n'
            % (area, rel["id"], area, rel["id"], area, icon(area), e(u["areas"][area]),
               "".join(change_card(rel, c, lang) for c in cards)))
    return "".join(out)


def worth_block(rel, lang):
    """Region 3 of the content model. Rendered differently and more prominently
    than a change card: a reader must not have to infer, from a list of
    improvements, that something about their data or the app's behaviour is now
    different."""
    notes = rel.get("worthKnowing") or []
    if not notes:
        return ""
    u = U[lang]
    rows = ""
    for n in notes:
        link = ""
        if n.get("page"):
            link = ('\n                  <p class="note-link">%s</p>'
                    % page_link(lang, n["page"]))
        rows += ('                <article class="note n-%s">\n'
                 '                  <p class="note-kind">%s</p>\n'
                 '                  <h5>%s</h5>\n'
                 '                  <p>%s</p>%s\n'
                 '                </article>\n'
                 % (n["kind"], e(u["notes"][n["kind"]]), e(n["title"][lang]),
                    e(n["body"][lang]), link))
    return ('              <section class="worth" aria-labelledby="w-%s">\n'
            '                <h4 id="w-%s">%s</h4>\n%s'
            '              </section>\n'
            % (rel["id"], rel["id"], e(u["worthTitle"]), rows))


def pending_block(rel, lang):
    """What is deliberately not written yet.

    An empty section on a release is how a gap stays visible instead of looking
    like a finished list. Only an upcoming release can carry one - a shipped
    release is a record, not a plan - and the validator holds that.
    """
    items = rel.get("pending") or []
    if not items:
        return ""
    u = U[lang]
    rows = "".join(
        '                <article class="pending-item p-%s">\n'
        '                  <h5><span class="g-ico" aria-hidden="true">%s</span>%s</h5>\n'
        '                  <p>%s</p>\n'
        '                </article>\n'
        % (p["area"], icon(p["area"]), e(p["title"][lang]), e(p["body"][lang]))
        for p in items)
    return ('              <section class="pending" aria-labelledby="p-%s">\n'
            '                <h4 id="p-%s">%s</h4>\n'
            '                <p class="pending-note">%s</p>\n%s'
            '              </section>\n'
            % (rel["id"], rel["id"], e(u["pendingTitle"]), e(u["pendingNote"]), rows))


def media_block(rel, lang):
    """A picture only where it is the honest explanation.

    uiLang is not decoration: a screenshot of the English app shown to an Arabic
    reader is captioned as such, so the reader knows what they are looking at
    rather than wondering why the app looks different from theirs.
    """
    shots = rel.get("media") or []
    if not shots:
        return ""
    u, a = U[lang], up(depth(lang))
    figs = ""
    for m in shots:
        cap = (m.get("caption") or {}).get(lang, "")
        if m["uiLang"] != lang:
            note = u["screenshotOf"] % u["langName"][m["uiLang"]]
            cap = (cap + " " + note).strip() if note not in cap else cap
        figs += ('                <figure class="shot-fig %s">\n'
                 '                  <img src="%s%s" width="%d" height="%d" alt="%s"\n'
                 '                       loading="lazy" decoding="async" />\n'
                 '                  <figcaption>%s</figcaption>\n'
                 '                </figure>\n'
                 % (m["aspect"], a, m["src"], m["w"], m["h"], e(m["alt"][lang]), e(cap)))
    return ('              <section class="highlights" aria-labelledby="h-%s">\n'
            '                <h4 id="h-%s">%s</h4>\n'
            '                <div class="shot-row">\n%s                </div>\n'
            '              </section>\n'
            % (rel["id"], rel["id"], e(u["highlightsTitle"]), figs))


CHEV = ('<svg class="stop-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" '
        'aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>')


def stop(rel, lang, state, is_open):
    """One stop on the journey. Its id is permanent: it is the address a link
    shared today resolves against, and it must still resolve in ten releases'
    time."""
    u = U[lang]
    date = fmt_date(rel, lang)
    if state == "released" and rel.get("datePending"):
        date += " · " + u["datePending"]
    areas = [a for a in AREA_ORDER if any(c["area"] == a for c in rel["changes"])]
    marks = "".join('<span class="mark" aria-hidden="true">%s</span>' % icon(a) for a in areas)
    return f"""          <li class="stop is-{state}">
            <details id="r-{rel['id']}" class="release"{' open' if is_open else ''}>
              <summary>
                <span class="stop-dot" aria-hidden="true"></span>
                <span class="stop-head">
                  <span class="stop-line">
                    <span class="stop-label">{e(rel_label(rel, lang))}</span>
                    <span class="stop-status">{e(u['availableNow'] if state == 'released' else u['notReleasedYet'])}</span>
                  </span>
                  <h3>{e(rel['title'][lang])}</h3>
                  <span class="stop-meta">{e(version_line(rel, lang))} <span aria-hidden="true">&middot;</span> {e(date)}</span>
                  <span class="stop-summary">{e(rel['summary'][lang])}</span>
                  <span class="stop-marks">{marks}</span>
                </span>
                {CHEV}
              </summary>
              <div class="stop-body">
                <section class="changes" aria-labelledby="ch-{rel['id']}">
                  <h4 id="ch-{rel['id']}">{e(u['changesTitle'])}</h4>
                  <p class="filter-empty">{e(u['filterNone'])}</p>
{area_groups(rel, lang)}                </section>
{worth_block(rel, lang)}{media_block(rel, lang)}{pending_block(rel, lang)}              </div>
            </details>
          </li>
"""


# ── the area filter ─────────────────────────────────────────────────────────
def filter_bar(rels, lang):
    """"Show me everything that ever changed in the Qur'an" - the one question a
    normal changelog cannot answer, and the reason the archive is worth keeping.

    Ten radio buttons and a stylesheet, no script: the page works the same with
    scripting disabled. Only the areas the archive actually contains get a chip;
    an area no release has ever touched would be a dead control.
    """
    u = U[lang]
    present = [a for a in AREA_ORDER
               if any(c["area"] == a for r in rels for c in r["changes"])]
    inputs = '          <input class="filter-input" type="radio" name="area" id="fa-all" checked />\n'
    inputs += "".join('          <input class="filter-input" type="radio" name="area" id="fa-%s" />\n' % a
                      for a in present)
    chips = ('            <label class="chip" for="fa-all">%s</label>\n' % e(u["filterAll"]))
    chips += "".join(
        '            <label class="chip" for="fa-%s"><span class="chip-ico" aria-hidden="true">%s</span>%s</label>\n'
        % (a, icon(a), e(u["areas"][a])) for a in present)
    return (inputs +
            '          <div class="filter-bar" role="group" aria-label="%s">\n%s          </div>\n'
            % (e(u["filterLabel"]), chips))


# ── the page ────────────────────────────────────────────────────────────────
def build_updates(lang):
    u, a = U[lang], up(depth(lang))
    rels = R.rendered(R.load())

    latest_released = next((r for r, s in rels if s == "released"), None)
    upcoming = next((r for r, s in rels if s == "upcoming"), None)

    hero = spring(latest_released, lang) if latest_released else ""
    coming = ontheway(upcoming, lang) if upcoming else ""
    linked = {r["id"] for r in (latest_released, upcoming) if r}
    stops = "".join(stop(r, lang, s, i < OPEN_STOPS or r["id"] in linked)
                    for i, (r, s) in enumerate(rels))

    return (head(lang, PAGE, depth(lang), u["title"], u["desc"]) + header(lang, PAGE, depth(lang)) + f"""    <main>
      <div class="shell">
        <section class="oasis-head" aria-labelledby="oasis-title">
          <img src="{a}assets/emblem-256.webp" alt="" width="256" height="256" />
          <p class="oasis-eyebrow">{e(u['eyebrow'])}</p>
          <h1 id="oasis-title">{e(u['h1'])}</h1>
          <p class="oasis-lede">{e(u['lede'])}</p>
        </section>
      </div>

{hero}      <div class="shell">
{coming}        <section class="journey" aria-labelledby="journey-title">
          <h2 class="section-title" id="journey-title">{e(u['journeyTitle'])}</h2>
          <p class="section-note">{e(u['journeyNote'])}</p>

{filter_bar([r for r, _ in rels], lang)}
          <ol class="stops">
{stops}          </ol>
        </section>

        <section class="how-versions" aria-labelledby="how-title">
          <h2 class="section-title" id="how-title">{e(u['footTitle'])}</h2>
          <p class="section-note">{e(u['footNote'])}</p>
          <p class="section-note">{e(u['footReport'])} <a href="{internal(lang, 'support/')}">{e(u['supportLink'])}</a></p>
        </section>
      </div>
    </main>
""" + footer(lang, PAGE, depth(lang)))
