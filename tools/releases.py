# -*- coding: utf-8 -*-
"""The Updates Oasis release source: loading, validation and the release gate.

WHAT THIS IS. `tools/releases/` holds one JSON file per release plus an index.
Adding a future update is: write the file, add its id to the index, run
`build.py`. Nothing in the page's markup is touched. If a release ever needs
the page rebuilt, the content model has failed and should be fixed rather than
worked around - Docs/releases/UPDATES_OASIS_CONTENT_MODEL.md 7.

WHY FILES AND NOT A DATABASE. A release entry is written once and is then
effectively immutable, and it must be reviewable in a diff: the content has to
be impossible to change without the change being visible. That is a poor fit
for a database and an excellent fit for a reviewed file.

THE GATE - the one invariant this module exists to hold.

    distributed: true   is the ONLY thing that lets an entry be presented as a
                        release that people actually received.

An entry reaches the page at all only when `render_state()` gives it one of two
answers:

    'released'   distributed is true               -> the archive, a date, the
                                                      "available" hero
    'upcoming'   distributed is false AND status
                 is explicitly 'upcoming'          -> its own region, never a
                                                      publish date, always
                                                      "not released yet"

Anything else - an internal work phase, a QA serial, a build uploaded to Play
but never released to a track - returns None and renders NOWHERE. That is the
default, so a phase file dropped into this directory cannot become a public
release entry by omission; it has to be marked, deliberately, one of the two.

Deviation from the content model, recorded on purpose: the model puts `changes`
inside a per-language `ReleaseContent`, which would repeat each change's id,
area and kind three times. Here the structural facts live once on the change
and only the prose (`title`, `body`) is keyed by language. Same model, with the
"the three languages must agree about the structure" rule enforced by the shape
of the file instead of by a checker that can be forgotten.
"""
import json, os, re, sys

SCR = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(SCR, "releases")

LANGS3 = ("en", "ar", "nl")

# The nine areas of Docs/releases/UPDATES_OASIS_CONTENT_MODEL.md 4. The list is CLOSED on
# purpose: a new area is a deliberate edit to that document and to this line,
# not something an entry can invent - otherwise the archive's grouping degrades
# into a tag cloud within three releases.
AREAS = ("quran", "prayer", "ramadan", "umrah", "dhikr", "challenge", "profile", "app", "legal")

KINDS = ("new", "improved", "changed", "fixed", "removed")
NOTE_KINDS = ("behaviour", "privacy", "requirement")
STATUSES = ("released", "upcoming", "internal")
TRACKS = ("production", "open-testing", "closed-testing", "internal-testing")
PRECISIONS = ("day", "month", "unknown")

DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MONTH_RE = re.compile(r"^\d{4}-\d{2}$")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


class ReleaseError(Exception):
    pass


def render_state(rel):
    """'released', 'upcoming', or None for an entry that must not be rendered.

    Read this function before changing anything about how the page decides what
    to show. It is the whole gate.
    """
    if rel.get("distributed") is True:
        return "released"
    if rel.get("status") == "upcoming":
        return "upcoming"
    return None


def _langs(node, what, where):
    if not isinstance(node, dict):
        raise ReleaseError("%s: %s must be an object keyed by language" % (where, what))
    missing = [l for l in LANGS3 if not (node.get(l) or "").strip()]
    if missing:
        raise ReleaseError("%s: %s is missing %s - an entry with a missing language is "
                           "invalid and must not publish" % (where, what, "/".join(missing)))


def validate(rel, seen_ids):
    """Docs/releases/UPDATES_OASIS_CONTENT_MODEL.md 7.1, plus the status rules.

    Every one of these is mechanically checkable and every one of them maps to a
    rule in that document. A release that fails any of them stops the build:
    a half-written entry must never reach the site.
    """
    rid = rel.get("id")
    w = "release %s" % rid

    # 1 - the id is unique, permanent and URL-safe: it is the fragment a shared
    #     link resolves against, and a link made today must resolve in ten
    #     releases' time.
    if not isinstance(rid, str) or not ID_RE.match(rid):
        raise ReleaseError("%s: id must be lowercase, URL-safe and non-empty" % w)
    if rid in seen_ids:
        raise ReleaseError("%s: id is used twice - ids are permanent and never reused" % w)
    seen_ids.add(rid)

    # status / distributed, and the consistency between them
    st = rel.get("status")
    if st not in STATUSES:
        raise ReleaseError("%s: status must be one of %s" % (w, ", ".join(STATUSES)))
    if not isinstance(rel.get("distributed"), bool):
        raise ReleaseError("%s: distributed must be true or false" % w)
    if st == "released" and rel["distributed"] is not True:
        raise ReleaseError("%s: status 'released' requires distributed true - a build a "
                           "person could not receive is not a release" % w)
    if st == "upcoming" and rel["distributed"] is not False:
        raise ReleaseError("%s: status 'upcoming' requires distributed false" % w)

    state = render_state(rel)
    if state is None:
        return  # an internal entry: kept as record, rendered nowhere, not checked further

    if not isinstance(rel.get("versionName"), str) or not rel["versionName"]:
        raise ReleaseError("%s: versionName is required - it is the one fact a reader can "
                           "check against their own device" % w)

    # 6 - the date and its precision agree, or there is no date at all
    on, prec = rel.get("publishedOn"), rel.get("datePrecision")
    if prec not in PRECISIONS:
        raise ReleaseError("%s: datePrecision must be one of %s" % (w, ", ".join(PRECISIONS)))
    ok = ((prec == "day" and isinstance(on, str) and DAY_RE.match(on))
          or (prec == "month" and isinstance(on, str) and MONTH_RE.match(on))
          or (prec == "unknown" and on is None))
    if not ok:
        raise ReleaseError("%s: publishedOn %r does not match datePrecision %r. A date that "
                           "is not known is marked unknown, never approximated" % (w, on, prec))
    if state == "upcoming" and on is not None:
        raise ReleaseError("%s: an upcoming release cannot carry a publish date" % w)

    if state == "released":
        if rel.get("track") not in TRACKS:
            raise ReleaseError("%s: a released entry must name the track it went to" % w)

    # 7 - evidence. Internal only, never rendered, but never empty either.
    ev = rel.get("evidence")
    if not isinstance(ev, list) or not ev:
        raise ReleaseError("%s: evidence must be a non-empty list. Nothing appears on the "
                           "page that is not proven in Docs/releases/APP_UPDATE_HISTORY.md" % w)

    # 3 - all three languages, everywhere prose appears
    _langs(rel.get("title"), "title", w)
    _langs(rel.get("summary"), "summary", w)

    ids = set()
    for ch in rel.get("changes") or []:
        cid = ch.get("id")
        if not isinstance(cid, str) or not ID_RE.match(cid):
            raise ReleaseError("%s: a change has a bad id %r" % (w, cid))
        if cid in ids:
            raise ReleaseError("%s: change id %r appears twice" % (w, cid))
        ids.add(cid)
        # 8 - the area is one of the nine
        if ch.get("area") not in AREAS:
            raise ReleaseError("%s/%s: area %r is not one of the nine in the content model"
                               % (w, cid, ch.get("area")))
        if ch.get("kind") not in KINDS:
            raise ReleaseError("%s/%s: kind must be one of %s" % (w, cid, ", ".join(KINDS)))
        _langs(ch.get("title"), "title", "%s/%s" % (w, cid))
        _langs(ch.get("body"), "body", "%s/%s" % (w, cid))
        if ch.get("media"):
            _media(ch["media"], "%s/%s" % (w, cid))

    # 4 - the hero shows 3 to 5 changes, and every one of them exists
    hl = rel.get("headline") or []
    if not 3 <= len(hl) <= 5:
        raise ReleaseError("%s: headline must name 3 to 5 changes, not %d. A reader who "
                           "leaves after the hero should already know what is new"
                           % (w, len(hl)))
    for h in hl:
        if h not in ids:
            raise ReleaseError("%s: headline names %r, which is not a change in this release"
                               % (w, h))

    for note in rel.get("worthKnowing") or []:
        nw = "%s/%s" % (w, note.get("id"))
        if note.get("kind") not in NOTE_KINDS:
            raise ReleaseError("%s: note kind must be one of %s" % (nw, ", ".join(NOTE_KINDS)))
        _langs(note.get("title"), "title", nw)
        _langs(note.get("body"), "body", nw)

    for p in rel.get("pending") or []:
        pw = "%s/%s" % (w, p.get("id"))
        if p.get("area") not in AREAS:
            raise ReleaseError("%s: area %r is not one of the nine" % (pw, p.get("area")))
        _langs(p.get("title"), "title", pw)
        _langs(p.get("body"), "body", pw)
    if rel.get("pending") and state != "upcoming":
        raise ReleaseError("%s: only an upcoming release can have pending items - a shipped "
                           "release is a record, not a plan" % w)

    # 5 - every image has alt text in all three languages
    for m in rel.get("media") or []:
        _media(m, w)

    # stories - optional curated headline and lead for an area's section. An
    # area with no story still renders: its most important change stands in.
    areas_present = {c["area"] for c in rel.get("changes") or []}
    seen_story = set()
    for st in rel.get("stories") or []:
        sw = "%s/story %s" % (w, st.get("area"))
        if st.get("area") not in AREAS:
            raise ReleaseError("%s: area is not one of the nine" % sw)
        if st["area"] not in areas_present:
            raise ReleaseError("%s: a story for an area this release did not touch" % sw)
        if st["area"] in seen_story:
            raise ReleaseError("%s: two stories for one area" % sw)
        seen_story.add(st["area"])
        _langs(st.get("title"), "title", sw)
        _langs(st.get("lead"), "lead", sw)


def _media(m, where):
    if not m.get("src"):
        raise ReleaseError("%s: a media reference has no src" % where)
    # An entry with a missing alt is invalid. A picture that a screen reader
    # cannot describe is not an explanation, it is decoration.
    _langs(m.get("alt"), "media alt (%s)" % m.get("src"), where)
    if m.get("uiLang") not in LANGS3:
        raise ReleaseError("%s: media %s must say which language's UI it shows - a screenshot "
                           "of the Arabic app shown to a Dutch reader needs a caption saying "
                           "what they are looking at" % (where, m.get("src")))


def load():
    """Every release in index order (newest first), validated. Raises on any
    problem: a half-written entry stops the build rather than reaching the site."""
    idx = json.load(open(os.path.join(DIR, "index.json"), encoding="utf-8"))
    seen = set()
    out = []
    for rid in idx["releases"]:
        path = os.path.join(DIR, rid + ".json")
        if not os.path.exists(path):
            raise ReleaseError("index.json names %r but %s does not exist" % (rid, path))
        rel = json.load(open(path, encoding="utf-8"))
        if rel.get("id") != rid:
            raise ReleaseError("%s carries id %r" % (path, rel.get("id")))
        validate(rel, seen)
        out.append(rel)
    return out


def rendered(releases):
    """The entries the page may show, in index order, each with its state."""
    return [(r, render_state(r)) for r in releases if render_state(r)]


if __name__ == "__main__":
    try:
        rels = load()
    except ReleaseError as exc:
        print("release source INVALID: %s" % exc)
        sys.exit(1)
    for r in rels:
        state = render_state(r) or "not rendered"
        print("  %-8s %-10s %-12s %2d changes  %s"
              % (r["id"], r["versionName"], state, len(r.get("changes") or []),
                 r["title"]["en"]))
    print("%d release file(s), %d rendered" % (len(rels), len(rendered(rels))))
