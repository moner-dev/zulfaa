# -*- coding: utf-8 -*-
"""Bring the APPROVED Salah scene engine into the site, byte for byte.

    python tools/salah_sync.py [path to the approved runtime checkpoint]

The scene is a locked visual master. It is developed and reviewed in the Salah laboratory
(Salah Section/salah-web-prototype, http://127.0.0.1:8081/preview/salah-scene/) and frozen in a checkpoint folder
with a MANIFEST.sha256. The website never edits the engine: this script copies the engine modules and the scene
assets from the checkpoint into assets/salah/ and proves every copy against the checkpoint's manifest.

    <checkpoint>/js/{timeline,renderer,shaders,water,birds}.js  ->  assets/salah/engine/   (birds.js: only checkpoints that have it)
    <checkpoint>/assets/*                                 ->  assets/salah/scene/

Everything else in assets/salah/ (prayer-times, places, day-model, the section controller, the styles) belongs to the
site and is NOT touched. Run with --check to verify without copying.
"""
import hashlib
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
# the engine the site runs: shader-async-v1 (birds v3 + Water v3, pixel-identical; the two programs are prepared without blocking the page -
# roadmap V-01, released 20 Sep 2026 together with the controller's conditional prewarming). Pass another checkpoint's path to go back:
#   ..._CANDIDATE_2026-09-19_birds-v3 (the previous release) | ..._birds-v2 (left-hand entries only) | ..._CANDIDATE_2026-09-19_birds-v1 (first birds) | ..._CANDIDATE_2026-09-19_water-v3 (no birds) | SALAH_WEB_RUNTIME_APPROVED_2026-09-19 (approved, Water v2)
DEFAULT = os.path.join(os.path.dirname(SITE), "Salah Section", "SALAH_WEB_RUNTIME_CANDIDATE_2026-09-19_shader-async-v1")
ENGINE = ("timeline.js", "renderer.js", "shaders.js", "water.js", "birds.js")

args = [a for a in sys.argv[1:] if not a.startswith("--")]
check_only = "--check" in sys.argv
src = os.path.abspath(args[0]) if args else DEFAULT
manifest = {}
for line in open(os.path.join(src, "MANIFEST.sha256"), encoding="utf-8"):
    digest, name = line.strip().split(" *./", 1)
    manifest[name] = digest

jobs = [("js/" + f, os.path.join("assets", "salah", "engine", f)) for f in ENGINE if "js/" + f in manifest]  # older checkpoints have no birds.js
jobs += [("assets/" + f, os.path.join("assets", "salah", "scene", f)) for f in sorted(os.listdir(os.path.join(src, "assets")))]
bad = 0
for rel, dst in jobs:
    full = os.path.join(SITE, dst)
    if not check_only:
        os.makedirs(os.path.dirname(full), exist_ok=True)
        shutil.copyfile(os.path.join(src, rel), full)
    ok = os.path.exists(full) and hashlib.sha256(open(full, "rb").read()).hexdigest() == manifest[rel]
    bad += not ok
    print("%-9s %s" % ("ok" if ok else "DIFFERENT", dst.replace(os.sep, "/")))
for f in ENGINE:  # a module left behind by a newer checkpoint is not imported by an older engine; say so, never delete
    if "js/" + f not in manifest and os.path.exists(os.path.join(SITE, "assets", "salah", "engine", f)):
        print("%-9s assets/salah/engine/%s (not part of this checkpoint; nothing imports it)" % ("unused", f))
print("%d file(s), %d not identical to the checkpoint %s" % (len(jobs), bad, os.path.basename(src)))
sys.exit(1 if bad else 0)
