# -*- coding: utf-8 -*-
"""The Salah section's published runtime: one content-addressed folder, so a visitor can never run a mixed version.

WHY. chrome.asset() puts a content hash on what the HTML names (`x.css?v=...`). The Salah section loads far more than the
HTML names: its entry module imports other modules, which import the scene engine, which fetches textures, masks, a LUT
and two JSON files - none of which can carry a `?v=` of their own (the engine is a locked byte copy of a frozen
checkpoint, and an import map cannot be relied on after the hero's module script has started loading). GitHub Pages
caches every file for ten minutes, so after an update a returning browser could pair the NEW entry module with the
PREVIOUS engine, or the new engine with the previous presets.

HOW. `assets/salah/` stays the source (edited, synced by salah_sync.py, proved against the checkpoint). The build copies
it to `assets/salah-<V>/`, where V is a hash of every source file's path and content, and the pages reference only that
folder. Inside it all URLs are relative, so every module and asset of one version lives under one immutable prefix:
new markup asks for a prefix no cache has ever seen. Same source, same V, same bytes - rebuilding changes nothing.

OLD FOLDERS. For ten minutes after a deploy a cached page may still name the previous folder, so the previous folder is
kept for ONE release and removed by the release after it:  python tools/salah_runtime.py --prune  keeps the current
folder and every folder named in tools/salah_runtime_keep.txt (one name per line), and removes the rest.

    python tools/salah_runtime.py            build / verify the current folder, print its name
    python tools/salah_runtime.py --check    exit 1 unless the current folder exists and is byte-identical to the source
    python tools/salah_runtime.py --prune    remove runtime folders that are neither current nor kept
"""
import hashlib
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
SOURCE = os.path.join(SITE, "assets", "salah")
PREFIX = "salah-"
KEEP_FILE = os.path.join(HERE, "salah_runtime_keep.txt")


def _files():
    out = []
    for base, _, names in os.walk(SOURCE):
        for n in names:
            full = os.path.join(base, n)
            out.append((os.path.relpath(full, SOURCE).replace(os.sep, "/"), full))
    return sorted(out)


def version():
    h = hashlib.sha256()
    for rel, full in _files():
        h.update(rel.encode("utf-8") + b"\0" + hashlib.sha256(open(full, "rb").read()).digest())
    return h.hexdigest()[:10]


def folder():
    """`assets/salah-<V>/` for the current source (site-relative, forward slashes, trailing slash)."""
    return "assets/%s%s/" % (PREFIX, version())


def identical(target):
    want = dict(_files())
    have = {}
    for base, _, names in os.walk(target):
        for n in names:
            full = os.path.join(base, n)
            have[os.path.relpath(full, target).replace(os.sep, "/")] = full
    if set(want) != set(have):
        return False
    return all(open(want[r], "rb").read() == open(have[r], "rb").read() for r in want)


def build():
    """Make sure the current folder exists and equals the source. Returns its site-relative name."""
    rel = folder()
    target = os.path.join(SITE, *rel.strip("/").split("/"))
    if not (os.path.isdir(target) and identical(target)):
        if os.path.isdir(target):
            shutil.rmtree(target)  # same name = same hash: only a damaged copy can get here
        shutil.copytree(SOURCE, target)
    return rel


def others():
    cur = folder().strip("/").split("/")[-1]
    root = os.path.join(SITE, "assets")
    return sorted(d for d in os.listdir(root) if d.startswith(PREFIX) and d != cur and os.path.isdir(os.path.join(root, d)))


if __name__ == "__main__":
    if "--check" in sys.argv:
        rel = folder()
        ok = os.path.isdir(os.path.join(SITE, rel)) and identical(os.path.join(SITE, rel))
        print("%s %s" % ("ok       " if ok else "MISSING OR DIFFERENT", rel))
        sys.exit(0 if ok else 1)
    rel = build()
    print(rel)
    if "--prune" in sys.argv:
        keep = set()
        if os.path.exists(KEEP_FILE):
            keep = {l.strip() for l in open(KEEP_FILE, encoding="utf-8") if l.strip() and not l.startswith("#")}
        for d in others():
            if d in keep:
                print("kept     assets/%s/" % d)
            else:
                shutil.rmtree(os.path.join(SITE, "assets", d))
                print("removed  assets/%s/" % d)
    else:
        for d in others():
            print("older    assets/%s/  (see --prune)" % d)
