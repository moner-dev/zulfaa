# Salah section (homepage) - integration notes

Status: part of the website source since the release commit of 19 September 2026 (branch `release/salah-section`, built on
`origin/main` 539cc43). Developed before that in the separate worktree `zulfaa-site-salah` (`feat/salah-section`), which
stays as the approved reference. Local previews (DEV LAB gateway): `http://127.0.0.1:8081/preview/salah-release/` (this
tree) and `http://127.0.0.1:8081/preview/salah-site/` (the reference); the scene laboratory is
`http://127.0.0.1:8081/preview/salah-scene/`.

## What is published, and how it is versioned

- `assets/salah/` is the SOURCE: the site's own modules and styles, the posters, and byte copies of the frozen engine
  (`engine/`, `scene/`, see "The scene is locked").
- The pages never reference it. `tools/salah_runtime.py` copies it to `assets/salah-<V>/`, V = a hash of every file's path
  and content, and `tools/salah.py` points the stylesheet, the entry module, the poster and `data-assets` at that folder.
  Every URL inside is relative, so one version's modules, textures and presets share one immutable prefix: a browser can
  never pair a new entry module with a cached older engine (GitHub Pages caches each file for ten minutes and the engine
  cannot carry `?v=` hashes of its own). Same source -> same folder -> byte-identical pages.
- A release that changes the runtime keeps the PREVIOUS folder for one release (a page cached in those ten minutes still
  names it): add its name to `tools/salah_runtime_keep.txt`, and let the release after that run
  `python tools/salah_runtime.py --prune`.
- DEV tools (`salah-dev.js`: pretend clock, pretend places, fast day) load only when the page runs on `127.0.0.1` or
  `localhost` AND the address has `?salah-dev`; on any other host no address switches them on, `?t=` / `?city=` do
  nothing, and the page keeps no `window.__salahSection` handle. `tools/salah_release_check.mjs --rehearse` proves it by
  opening `https://zulfaa.nl/` in a browser whose requests to that host are answered from the local tree (every other
  host blocked); `--live` runs the same checks against the real site without contacting analytics or contact services.

## Two layers, one model

```
prayer-times.js   pure astronomy: date + lat/lon + UTC offset + config -> six times (minutes after local midnight)
places.js/.json   where: time zone -> approximate city (no permission) | chosen city (localStorage) | precise (explicit gesture, not wired)
day-model.js      THE shared model: modelAt({place, instant}) -> times, current/next prayer, countdown, visual state,
                  day-line position AND the scene frame. The interface and the scene both read this, nothing else.
salah-section.js  controller: paints the HTML interface once a second; loads and drives the WebGL scene on its own clock
salah.css         the glass component system (one family, six tints via [data-phase])
salah-dev.js      DEV tools, loaded only with ?salah-dev
engine/ scene/    the approved WebGL runtime and its assets - COPIES, never edited here (see "The scene is locked")
poster/           six stills: placeholder while the scene loads, and the fallback without WebGL2 / without JavaScript
```

- The WebGL canvas contains no text. Every word is HTML, from `tools/salah_strings.py` (en / nl / ar), delivered to the
  script as a JSON block in the page - there are no user-facing strings in the JavaScript.
- Prayer times are anchors, never switches. `day-model.js` maps the real day piecewise-linearly onto the approved scene
  timeline (Fajr -> frame 12, Dhuhr 112, Asr 190, Maghrib 256, Isha 356, next Fajr 456; sunrise at the frame where the
  scene's own sun crosses the horizon). At each prayer time the scene is exactly the approved phase; in between it moves
  continuously (largest step measured: 0.46 frames per 30 s).
- Six VISUAL states (fajr, sunrise, dhuhr, asr, maghrib, isha) tint the glass. Sunrise is a milestone: it is never
  "next prayer", never labelled as Salah, drawn as a diamond on the day line and in italics in the schedule.
- Status: `NOW` for the first 20 minutes of a prayer (`NOW_WINDOW_MINUTES`), otherwise `NEXT PRAYER`, with
  `TOMORROW` after Isha. Midnight needs no special case: three days of times live on one minute axis.

## Prayer calculation (default, and how to change it)

`DEFAULT_CONFIG` in `prayer-times.js`: method `MWL` (Fajr 18 deg, Isha 17 deg), Asr factor 1 (standard; 2 = Hanafi),
high-latitude rule `angle-based`, no per-prayer offsets. Other built-in methods: ISNA, EGYPT, MAKKAH, KARACHI, TURKEY.
The layer is replaceable: anything that returns the same six numbers can stand in for `computeTimes`. Times are computed
in the PLACE's time zone (IANA, via `Intl`), not the browser's. Verified against published tables for Makkah and
Amsterdam, 19 September 2026. A per-country default method and a user-facing method setting are NOT built yet.

## Location

1. Default: the browser's time zone, no prompt, nothing sent anywhere (`places.js` `placeForTimeZone`):
   a. the first city of that zone in `places.json` (47 cities, 42 zones, names in three languages); else
   b. the zone's own reference place from the IANA time zone database - `zones.json` (418 zones + 131 legacy aliases,
      generated by `tools/salah_zones.py` from the vendored `tools/tzdb/`; Chrome reports India as `Asia/Calcutta`, Nepal as
      `Asia/Katmandu`...). It is fetched only when (a) found nothing, 8 KB compressed. The label is the zone's locality
      in English plus the country name from `Intl.DisplayNames`; else
   c. UNKNOWN (UTC, a fixed offset, no zone at all, an id newer than the table): **no times are shown**. The glass asks
      for a city (`data-place="unknown"`: no clock, no day line, no schedule), the existing picker does the rest, and the
      picture follows the visitor's own clock through a nominal day that is never displayed or used for a prayer time.
   Coordinates are never derived from a UTC offset (audit finding H-01: that produced errors of 1 to 3.5 hours).
   A guess is labelled as one: "Today near {place}" and "Approximate location, from your time zone"; a chosen city reads
   "Today in {place}". LIMIT: a zone is not a city. In wide zones the guess can be tens of minutes from the visitor's own
   town (measured on 19 Sep: Kolkata against the Delhi guess 45 min, Chengdu against Shanghai 70 min, Houston against
   Chicago 30-48 min, Kazan against Moscow 46 min) - hence the label and the city list. Beyond about 62 degrees latitude
   some dates have no ordinary twilight or sunrise; that is a property of the calculation, recorded separately.
   To update the zone data: replace `tools/tzdb/{zone.tab,backward,version}`, run `python tools/salah_zones.py`, then
   `node tools/salah_zones_test.mjs` (50 checks: every zone id the JavaScript engine knows, every alias, hostile input,
   odd offsets, DST, persistence) and `node tools/salah_zones_browser_check.mjs OUT` (69 checks with Chrome's real time
   zone override, three languages, three sizes).
2. "Change city": stored as `{kind:'city', id}` under localStorage key `zulfaa-salah-place`, shared by all three languages.
3. Precise: `requestPrecise()` exists in `places.js` (rounds to 0.01 deg) and is deliberately wired to NO control.
   The section never calls the Geolocation API (checked by `salah_behaviour_check.mjs`).

## When the scene cannot draw (fallback and recovery)

The poster of the current phase always lies under the canvas; the canvas only covers it while the section is `is-live`.
- No WebGL2, or the engine fails to load: the poster stays, one quiet `console.warn`, nothing retries, the interface works.
- The WebGL context is LOST (GPU reset, driver update, a laptop waking, a phone reclaiming memory): `salah-section.js` hides
  the dead canvas at once (`is-lost`: no fade - a lost canvas paints white with the browser's broken icon), shows the poster
  of the current phase and stops drawing. The interface is plain HTML on the shared model and never notices.
- The context is RESTORED: every GPU resource is rebuilt through the engine's own path (`buildEngine`), with the same bird
  seed and no replayed reveal, and the canvas returns only after a valid frame of the CURRENT moment - when the section
  is on screen. Two listeners, registered once; at most six rebuilds in ten minutes; a failed rebuild keeps the poster.
  The locked engine is not involved: this is controller code. `node tools/salah_context_check.mjs OUT` (44 checks) loses
  the real context with `WEBGL_lose_context`: on screen, off screen, three times in a row, faster than a rebuild, under
  reduced motion, during a city change, and with no WebGL2 at all - and it looks at the pixels, not only at the DOM.
- `#prayer-times` carries the site's own `scroll-margin-top: 4.6rem` (as `#contact`), so a deep link lands below the
  sticky header (same suite: three languages, three sizes, reload, in-page link with smooth scrolling).

## The scene is locked

`engine/` and `scene/` are byte-for-byte copies of a frozen runtime checkpoint. Never edit them here.

- CURRENT (released 20 Sep 2026 with the conditional prewarming below): `Salah Section/SALAH_WEB_RUNTIME_CANDIDATE_2026-09-19_shader-async-v1`
  - roadmap V-01. Only `engine/renderer.js` differs from birds-v3, and only in how the two programs are prepared; 13
  deterministic captures are byte-identical. With `KHR_parallel_shader_compile` (Chrome, Edge) the programs are started at the
  beginning of `load()` and asked about only when the browser reports them complete: a cold visit no longer freezes the page
  (Salah longest task 2235 -> 81 ms, worst input delay 2193 -> 35 ms). Firefox has no such extension and is unchanged.
  TRADE-OFF: Chrome caches a program only when its link is waited for, so with this engine every Chromium visit waits ~1.5 s
  with the poster before the scene comes alive (birds-v3: a ~2.2 s freeze once, alive on arrival afterwards). The engine's
  `prepare()`, called early by the controller (see "Rendering lifecycle": PREWARM), removes that wait for a visitor who takes
  about 1.8 s or more to arrive. Record: the checkpoint's `CANDIDATE.md`;
  evidence: `Salah Section/V01_2026-09-19_shader-async/`. The controller (`salah-section.js`) is unchanged: it already awaits
  `load()` behind a build token and checks `isContextLost()`, which is all the new path needs. To go back to production's engine:
  `python tools/salah_sync.py "../Salah Section/SALAH_WEB_RUNTIME_CANDIDATE_2026-09-19_birds-v3"`, then rebuild.
- PREVIOUS (released 19 Sep 2026): `Salah Section/SALAH_WEB_RUNTIME_CANDIDATE_2026-09-19_birds-v3` - birds from
  BOTH sides, a lower band, sooner. Half of the flights enter at the right edge of the framing; from late Asr to sunset
  the right-hand sky is the sun's and those flights give way to left-hand twins. The schedule panel and the city picker
  are frosted glass above the canvas (`blur(18px)`): a bird behind them is erased completely (checked with full-size test
  birds at 1440 and 1920), so they hide a bird as the mosque does; at 1920 the band (plate rows 56-219, soft floor 222)
  passes above the resting panel anyway. Desktop 1920, a bird clearly in view within 20 s: Fajr 84 %, Dhuhr 91 %, Asr
  81 %, Maghrib 58 % (v2: 68 / 79 / 69 / 51 %); Isha and reduced motion: none. GPU timer at 1920: 3.35 ms birds off,
  3.35-3.38 ms on (worst case: two flights on opposite sides). Only `engine/birds.js` and four lines of
  `engine/shaders.js` differ from v2. Review shots: `...|birds=89` (a right-hand flight of four), `...|birds=37` (left-hand).
- PREVIOUS birds candidate (left-hand entries only): `Salah Section/SALAH_WEB_RUNTIME_CANDIDATE_2026-09-19_birds-v2` - the birds
  refined after the owner found v1 too far, too faint and too rare: +20 % wingspan, darker silhouettes, flights of
  usually 2-3 birds (1-4), a 45 s slot with most slots flying, so by day a visitor sees a bird within 40 s in 84-91 %
  of cases (Maghrib 69 %, Isha never); same rules, same cost (GPU timer at 1920: 3.35 ms off, 3.35-3.36 ms on).
  Only `engine/birds.js` and `engine/shaders.js` differ from v1. Review shots: `...|birds=122` (a four-bird flight).
- PREVIOUS birds candidate: `Salah Section/SALAH_WEB_RUNTIME_CANDIDATE_2026-09-19_birds-v1` - distant
  birds on top of Water Pass v3: one new engine module (`engine/birds.js`), bird uniforms in `renderer.js`, `withBirds()`
  in `shaders.js`; no new asset; the site's own code is unchanged. A few far-away birds by day (in view 13-36 % of the
  time, never more than a handful), none at Isha, none under reduced motion (scene time 0 = no birds), always left of
  the schedule panel and away from the sun and the moon. Details and measurements: the lab README, "Distant birds".
  Review shots with a known flight in the air: `node tools/salah_check.mjs OUT "name|?salah-dev=quiet&t=13:40|1920x1080|birds=172"`.
- PREVIOUS candidate (no birds): `Salah Section/SALAH_WEB_RUNTIME_CANDIDATE_2026-09-19_water-v3` - Water Pass v3, a motion
  refinement of the lake; only `js/shaders.js` differs from the approved runtime. To go back to it:
  `python tools/salah_sync.py "../Salah Section/SALAH_WEB_RUNTIME_CANDIDATE_2026-09-19_water-v3"`.
- APPROVED: `Salah Section/SALAH_WEB_RUNTIME_APPROVED_2026-09-19` (Water Pass v2). To go back to it:
  `python tools/salah_sync.py "../Salah Section/SALAH_WEB_RUNTIME_APPROVED_2026-09-19"`.

    python tools/salah_sync.py            copy from the checkpoint (each file verified against its MANIFEST.sha256)
    python tools/salah_sync.py --check    prove the copies are still identical

Scene work happens in the lab (`Salah Section/salah-web-prototype`), gets approved, gets a new checkpoint, and only then
is synced.

## Build

    python tools/build.py && python tools/write_en.py && python tools/build.py

`tools/salah.py` renders the marked region (`<!-- salah:start -->` ... `<!-- salah:end -->`); `home.py` places it after the
showcase for ar / nl, `write_en.py` injects it into the hand-written English `index.html`. `ENABLED = False` in
`salah.py` removes the section from all three pages on the next build.

## Layout

Below 80rem the stage is `min(100% - 2rem, 100rem)`. From 80rem up it is a framed canvas:
`min(100% - 2rem, var(--salah-stage-share), var(--salah-stage-max))` with `92vw` and `110rem` (set on `.salah`, two numbers
to tune). Only the frame changes size; the projection stays 1916:821, the source textures stay as they are, and the canvas
follows the CSS size (device pixel ratio up to 2, 2560 px ceiling, resolution governor). On desktop the focus glass is
`clamp(19rem, 21.5%, 21rem)`. The two chips always share one row: the times chip never shrinks, the city chip ends in an
ellipsis when a name is long. Below 80rem, while a panel is open and the stage is on screen, the site's scroll dock steps
aside (`body:has(.salah.has-panel.is-onscreen) .dock` in `salah.css`, the dock's own pattern for the drawer and the contact
form); from 80rem up the framed stage never reaches the dock's corner.

Today's times REST OPEN on arrival where there is room: the tablet layout (40-64rem, the panel sits below the picture) and
a desktop stage from 80rem up - and only if the whole schedule fits without scrolling (measured at start and again when
the web fonts are ready; in practice from about 1366 px wide in English and Arabic, 1440 px in Dutch). Phones and the
64-80rem band keep it behind its chip. Opening this way takes no focus, does not scroll the page and stores nothing. A
resting schedule is not dismissed by a click elsewhere and returns after the city picker closes, until the visitor closes
it (close button, chip or Escape); the next page load starts from the default again. All of it is `show()` and
`restTimes` in `salah-section.js`.

Smart panel position (overlay layout, 64rem and up): the side panel - today's times and the city picker alike - has two
physical resting places, the right EDGE and an INNER anchor whose right side stops at 71.5 % of the stage. One fact of the
shared model chooses: `scene.sunLowRight`, true while the timeline frame is inside `SUN_LOW_RIGHT = [181, 300]` in
`day-model.js` - from the moment the sun's disc enters the top of the picture shortly before Asr, through the sunset behind
the right-hand peak (78-87 % across), until the afterglow has gone and the moon begins to appear. So: edge at Fajr, Dhuhr
and Isha, inner at Asr and Maghrib, exactly two relocations a day, each a 1.1 s glide of `right` (none under reduced
motion, none on arrival). Arabic uses the same physical anchors: the picture is not mirrored. The tablet and phone
layouts keep the panel below the picture, so nothing moves there.

## Rendering lifecycle

The engine starts in two steps (roadmap V-01, option D, released 20 Sep 2026):

1. PREWARM - the stage comes within **1800 px** of the viewport, or the address names `#prayer-times` (on load or by a
   `hashchange`): the engine modules are imported, the WebGL context is created and the two shader programs are started
   (engine `prepare()`); they compile in the background. Nothing else - no scene asset, no texture, no drawing, no loop
   work. Asked for once per renderer; going in and out of the distance starts nothing again. A visitor who stays in the
   first screen or so never starts any of it. Why: a browser that compiles without blocking (Chrome, Edge) keeps no
   compiled program for the next visit, so EVERY visit compiles for ~1.6 s; 1800 px is what an unhurried, unbroken scroll
   (~1100 px/s, measured on this page) covers in that time. Without `KHR_parallel_shader_compile` (Firefox) the step
   creates the context and compiles nothing: the blocking compile stays in step 2, where it always was.
2. LOAD - within **700 px**, as before: scene assets, textures, the wait for the programs (none left after an unhurried
   approach), the first frame. The early renderer is handed over and used once (`prepared` in `salah-section.js`).

Context loss: a loss drops the early renderer; if the scene was never wanted yet, a restoration only starts the programs
again (it counts against the same limit of six rebuilds in ten minutes). Measurements and limits:
`Salah Section/V01_2026-09-19_conditional-prewarm/RESULT.md`.

Visible: every display frame while
something moves, 30 fps when idle (the water). Off-screen or hidden tab: no rendering at all. Reduced motion: no reveal,
a still lake, one redraw every 20 s. The countdown runs on a 1 s timer, independent of WebGL. A governor lowers the
canvas resolution (never the layout) when a device cannot hold the frame rate. Scroll reveal: a 1.8 s catch-up from
38 minutes earlier, once; never a replay of the day.

## DEV

`?salah-dev` (panel) or `?salah-dev=quiet` (URL-driven, no panel), with `&t=HH:MM`, `&city=<id>`, `&method=ISNA`, `&asr=2`.
DEV places are ephemeral (`previewCity()` in `places.js`): neither `&city=` nor the panel's city select stores anything or
clears a city the visitor really chose. Only the user-facing picker writes to localStorage.
Benchmarks only, local hosts only (dead under any other hostname, checked by `salah_prewarm_check` case P):
`?salah-prewarm=off` (no early start = the Async V1 behaviour) and `?salah-prewarm=eager` (programs at once).

## Checks

    node tools/salah_model_test.mjs          32 checks of the timing model and the panel-position window (no browser)
    node tools/salah_behaviour_check.mjs     41 browser checks: location, persistence, DEV places, phone dock + chips, resting schedule, keyboard, off-screen, reduced motion, cost
    node tools/salah_check.mjs OUT SHOT...   review screenshots + the model for each
    python tools/salah_contrast.py SHOT...   measured text contrast of the glass
    node tools/salah_perf.mjs [label]        median GPU time of the scene at 1920 (Maghrib, Dhuhr) and on a phone-sized canvas
    node tools/salah_compile_check.mjs OUT   49 browser checks of the non-blocking shader preparation (V-01): path in use, order of the questions, a cold compile,
                                             pending state (poster, working interface), scroll away / tab switch during it, reduced motion, context loss
                                             before / during / at the end of it and repeatedly, no extension, a broken shader on both paths, the 20 s limit, prepare()
    node tools/salah_prewarm_check.mjs OUT   browser checks of the conditional prewarming (V-01 option D): nothing at the top, programs only inside 1800 px,
                                             idempotent, hand-over without a second compile, the first frame is the moment of ARRIVAL, #prayer-times and
                                             hashchange, reduced motion, context loss around the early start, background tab, no extension, no WebGL2,
                                             phone viewport, the DEV switches dead under the production hostname
    node tools/salah_release_check.mjs OUT --rehearse | --live    the published page as a visitor gets it (see above)
    python tools/salah_runtime.py --check    the versioned runtime folder exists and equals the source

The browser tools test `/preview/salah-site/` by default; name another mount with `SALAH_ORIGIN=http://127.0.0.1:8081/preview/salah-release/`.

## Known limits (first integrated version)

- The source folder `assets/salah/` is published next to the versioned copy (GitHub Pages serves the whole repository);
  nothing references it. It costs 2 MB of repository size per copy, not visitor bandwidth.
- No real phone or tablet has run it yet; headless Chrome on the development laptop only.
- Not connected to Admin, analytics, accounts, notifications or any server - by design.
