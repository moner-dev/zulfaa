// ZULFAA homepage - the Salah section. Wires three independent parts and owns none of their logic:
//
//     places.js  ->  day-model.js (prayer-times.js inside)  ->  { scene frame | prayer focus }
//                                                                  |                |
//                                                   engine/ (WebGL, locked)     the HTML overlay below
//
// The overlay updates once a second and only writes to the DOM when a text actually changes; it never asks the scene
// to draw. The scene draws on its own clock: every display frame while something moves, 30 fps when idle, nothing at
// all while the section is off-screen or the tab is hidden. All words come from the JSON the generator embedded.
import { loadPlaces, currentPlace, chooseCity, clearChoice, previewCity, allCities, placeName, placeLabel } from './places.js'
import { modelAt, sunriseFrame } from './day-model.js'
import { DEFAULT_CONFIG } from './prayer-times.js'

const section = document.querySelector('[data-salah]')
if (section) start(section).catch((error) => console.error('[salah]', error))

async function start(root) {
  const $ = (sel) => root.querySelector(sel)
  const words = JSON.parse($('[data-salah-words]').textContent)
  const lang = root.dataset.lang, base = root.dataset.assets
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const canvas = $('[data-salah-canvas]'), stage = $('.salah-stage')
  const framingName = () => (stage.clientWidth >= 1024 ? 'desktop' : stage.clientWidth >= 640 ? 'tablet' : 'mobile')
  const params = new URLSearchParams(location.search)

  const app = {
    place: null, config: { ...DEFAULT_CONFIG }, riseFrame: 25.34, //  refined from the approved sun path once the engine loads
    sim: null, //        DEV: minutes after midnight the place's clock pretends to show (eased in `simShown`)
    simShown: null, reveal: null, model: null, engine: null, visible: false, scale: 1, slow: 0,
    listeners: new Set(),
  }

  // ------------------------------------------------------------------ the model (shared by both layers)
  const modelFor = (minutesBehind = 0) => {
    const sim = app.simShown != null ? app.simShown - minutesBehind : null
    if (sim != null) return modelAt({ place: app.place, simMinutes: ((sim % 1440) + 1440) % 1440, config: app.config, riseFrame: app.riseFrame })
    return modelAt({ place: app.place, instant: new Date(Date.now() - minutesBehind * 60000), config: app.config, riseFrame: app.riseFrame })
  }

  // ------------------------------------------------------------------ layer 2: the interface
  const text = {}
  root.querySelectorAll('[data-salah-text]').forEach((el) => (text[el.dataset.salahText] = el))
  const setText = (key, value) => { if (text[key] && text[key].textContent !== value) text[key].textContent = value }
  const hhmm = (minutes) => {
    const m = ((Math.round(minutes) % 1440) + 1440) % 1440 // 24-hour clock, Latin digits in every language: one place to change later
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  }
  const fill = (pattern, values) => pattern.replace(/\{(\w+)\}/g, (_, k) => values[k])
  const countdown = (m) => {
    if (m.status === 'now') { const since = Math.floor(m.clock.minutes - m.focus.at); return since < 1 ? words.since_now : fill(words.since_m, { m: since }) }
    const left = Math.ceil(m.nextPrayer.inMinutes)
    if (left < 1) return words.in_soon
    return left >= 60 ? fill(words.in_hm, { h: Math.floor(left / 60), m: left % 60 }) : fill(words.in_m, { m: left })
  }
  const marker = $('[data-salah-marker]')
  let announced = ''

  function paintUi(m) {
    root.dataset.phase = m.visualState
    root.dataset.status = m.status
    // smart panel position: two fixed anchors, chosen by ONE fact of the shared model. While the sun is low on the right
    // (its disc, the sunset glow, the glitter path on the lake) the side panel rests further in; otherwise at the right edge.
    const anchor = m.scene.sunLowRight ? 'inner' : 'edge'
    if (root.dataset.panelAnchor !== anchor) root.dataset.panelAnchor = anchor
    const status = m.status === 'now' ? words.now : m.nextPrayer.tomorrow ? `${words.next} \u00b7 ${words.tomorrow}` : words.next
    setText('status', status)
    setText('name', words.names[m.focus.id])
    setText('time', hhmm(m.focus.at))
    setText('countdown', countdown(m))
    setText('place', placeName(app.place, lang))
    setText('timesTitle', fill(words.timesTitle, { place: placeLabel(app.place, lang) }))
    setText('methodNote', m.adjusted.includes('fajr') || m.adjusted.includes('isha') ? `${words.methodNote} ${words.adjustedNote}` : words.methodNote)
    setText('placeSource', app.place.source === 'chosen' ? words.placeChosen : words.placeApprox)
    root.querySelectorAll('[data-salah-time]').forEach((el) => { const v = hhmm(m.times[el.dataset.salahTime]); if (el.textContent !== v) el.textContent = v })
    const pos = m.dayLine.position.toFixed(4)
    if (marker.style.getPropertyValue('--at') !== pos) marker.style.setProperty('--at', pos)
    marker.classList.toggle('is-night', m.dayLine.night)
    root.querySelectorAll('[data-point]').forEach((el) => {
      const id = el.dataset.point
      el.classList.toggle('is-past', m.times[id] <= m.clock.minutes)
      el.classList.toggle('is-focus', id === m.focus.id)
    })
    root.querySelectorAll('[data-row]').forEach((el) => el.classList.toggle('is-focus', el.dataset.row === m.focus.id))
    // screen readers hear a change of prayer, never the ticking minutes
    const key = `${m.status}:${m.focus.id}`
    if (key !== announced) { announced = key; setText('announce', fill(words.announce, { status, name: words.names[m.focus.id], time: hhmm(m.focus.at), countdown: countdown(m) })) }
    if (!app.engine) poster(m.visualState)
    const framing = framingName()
    if (stage.dataset.framing !== framing) stage.dataset.framing = framing
  }

  const posterImg = $('[data-salah-poster]')
  function poster(state) {
    const src = `${base}poster/${state}.webp`
    if (!posterImg.getAttribute('src').endsWith(`${state}.webp`)) posterImg.src = src
  }

  function tickUi() {
    app.model = modelFor()
    paintUi(app.model)
    app.listeners.forEach((fn) => fn(app.model))
  }

  // ---- panels: today's times and the city picker (never both, Escape closes, focus returns).
  // Where there is room (tablet and desktop) today's times are part of the RESTING presentation: open on arrival without
  // taking focus or scrolling the page, not dismissed by a click elsewhere, and back in place after the city picker closes -
  // until the visitor closes them. Nothing is stored: the next page load starts from the same default. On a phone the
  // schedule stays behind its chip, exactly as before.
  // Room = the tablet layout (the panel sits BELOW the picture, 40-64rem) or a desktop stage from 80rem up. In between, the
  // overlay layout on a small stage would bury the scene under two glass surfaces, so the schedule waits behind its chip.
  const roomy = window.matchMedia('(min-width: 40rem) and (max-width: 63.99rem), (min-width: 80rem)')
  let restTimes = roomy.matches
  const panels = { times: $('[data-salah-panel="times"]'), places: $('[data-salah-panel="places"]') }
  const openers = { times: $('[data-salah-open="times"]'), places: $('[data-salah-open="places"]') }
  let openPanel = null
  function show(name, { focus = true } = {}) {
    const was = openPanel
    if (name === null && was === 'times') restTimes = false //        the visitor closed the schedule: respect it
    if (name === 'times' && focus) restTimes = roomy.matches //       ...and opened it again
    const back = name === null && was === 'places' && restTimes //    the picker closes -> the schedule returns
    if (back) name = 'times'
    for (const [k, el] of Object.entries(panels)) {
      const on = k === name
      el.hidden = !on
      openers[k].setAttribute('aria-expanded', String(on))
    }
    setText('timesToggle', name === 'times' ? words.hideTimes : words.todaysTimes)
    openPanel = name
    root.classList.toggle('has-panel', !!name)
    if (!focus) return
    if (name === 'places') { renderCities(''); const input = $('[data-salah-search]'); input.value = ''; input.focus() } else if (name === 'times' && !back) panels.times.querySelector('button').focus()
    else if (was) openers[was].focus()
  }
  root.addEventListener('click', (e) => { if (e.target.closest('[data-salah-open], [data-salah-close]')) app.touched = true }, true)
  for (const k of Object.keys(openers)) openers[k].addEventListener('click', () => show(openPanel === k ? null : k))
  root.querySelectorAll('[data-salah-close]').forEach((b) => b.addEventListener('click', () => show(null)))
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openPanel) { e.stopPropagation(); show(null) } })
  document.addEventListener('pointerdown', (e) => {
    if (!openPanel || (openPanel === 'times' && restTimes)) return //  the resting schedule is not a popover
    if (panels[openPanel].contains(e.target) || Object.values(openers).some((o) => o.contains(e.target))) return // the chips answer for themselves
    show(null)
  })

  const cityList = $('[data-salah-cities]')
  const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f\u064b-\u0652]/g, '').toLowerCase() // accents and Arabic vowel marks
  function renderCities(query) {
    const q = fold(query.trim())
    const hits = allCities().filter((c) => !q || [c.name[lang], c.name.en, c.country[lang], c.country.en].some((v) => fold(v).includes(q)))
    cityList.replaceChildren(...(hits.length ? hits.map((c) => {
      const li = document.createElement('li'), b = document.createElement('button')
      b.type = 'button'; b.className = 'salah-city'; b.dataset.city = c.id
      if (app.place.id === c.id) b.setAttribute('aria-current', 'true')
      const n = document.createElement('span'); n.textContent = c.name[lang] || c.name.en
      const k = document.createElement('span'); k.className = 'salah-city-country'; k.textContent = c.country[lang] || c.country.en
      b.append(n, k); li.append(b)
      return li
    }) : [Object.assign(document.createElement('li'), { className: 'salah-fine', textContent: words.noCity })]))
  }
  $('[data-salah-search]').addEventListener('input', (e) => renderCities(e.target.value))
  cityList.addEventListener('click', (e) => { const b = e.target.closest('[data-city]'); if (b) setPlace(chooseCity(b.dataset.city)) })
  $('[data-salah-timezone]').addEventListener('click', () => setPlace(clearChoice()))
  function setPlace(place) { app.place = place; if (openPanel === 'places') show(null); tickUi(); app.dirty = true } // only the picker closes; resting times stay

  // ------------------------------------------------------------------ layer 1: the scene (loaded only when it is nearly on screen)

  async function loadEngine() {
    if (app.engine || app.engineFailed) return
    app.engineFailed = true // until proven otherwise: the poster stays, the interface keeps working
    const [{ SalahRenderer }, timeline] = await Promise.all([import('./engine/renderer.js'), import('./engine/timeline.js')])
    const renderer = new SalahRenderer(canvas) // throws without WebGL2 -> poster fallback
    await renderer.load(`${base}scene/`)
    const anchors = timeline.loadAnchors(renderer.presets)
    app.riseFrame = sunriseFrame(anchors)
    app.engine = { renderer, timeline, anchors }
    app.engineFailed = false
    if (!reducedMotion.matches && app.sim == null) app.reveal = { start: performance.now(), ms: 1800, behind: 38 } // settle into the true moment once
    root.classList.add('is-live')
  }

  function draw(now) {
    const { renderer, timeline, anchors } = app.engine
    const name = framingName(), f = renderer.scene.framings[name]
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.min(2560, Math.max(320, Math.round(stage.clientWidth * dpr * app.scale)))
    const h = Math.round((w * (f.rect[3] - f.rect[1])) / (f.rect[2] - f.rect[0]))
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
    let behind = 0
    if (app.reveal) {
      const k = Math.min(1, (now - app.reveal.start) / app.reveal.ms)
      behind = app.reveal.behind * (1 - k) ** 3
      if (k >= 1) app.reveal = null
    }
    const frame = modelFor(behind).scene.frame
    const sceneTime = reducedMotion.matches ? 0 : now / 1000 // reduced motion: the right moment of the day, a still lake
    renderer.render(timeline.state(anchors, frame), { rect: [f.rect[0], f.rect[1], f.rect[2] - f.rect[0], f.rect[3] - f.rect[1]], tree: f.show_tree ? 1 : 0 }, sceneTime)
  }

  let last = 0, lastDraw = 0
  function loop(now) {
    requestAnimationFrame(loop)
    const dt = Math.min(0.1, (now - last) / 1000 || 0)
    last = now
    let moving = !!app.reveal || !!app.dirty
    if (app.sim != null) { // DEV: ease toward the requested time so dragging the slider sweeps the day without a jump
      if (app.simShown == null) app.simShown = app.sim
      const d = ((((app.sim - app.simShown) % 1440) + 2160) % 1440) - 720
      if (Math.abs(d) > 0.02) { app.simShown += app.playing ? d : d * (1 - Math.exp(-dt * 9)); moving = true } else app.simShown = app.sim
    } else app.simShown = null
    if (!app.engine || !app.visible || document.hidden) return
    const idleGap = reducedMotion.matches ? 20000 : 31
    if (!moving && now - lastDraw < idleGap) return
    if (moving && dt > 0) { // governor: a device that cannot hold the frame rate renders fewer pixels, the layout never changes
      app.slow = dt > 0.028 ? app.slow + 1 : Math.max(0, app.slow - 2)
      if (app.slow > 30 && app.scale > 0.5) { app.scale = Math.max(0.5, app.scale * 0.8); app.slow = 0 }
    }
    lastDraw = now
    app.dirty = false
    draw(now)
    if (moving && app.sim != null) tickUi() // DEV sweep: keep the interface in step with the scene
  }

  // ------------------------------------------------------------------ go
  await loadPlaces(`${base}places.json`)
  app.place = currentPlace()
  $('[data-salah-ui]').hidden = false
  tickUi()
  if (restTimes) {
    show('times', { focus: false })
    // ...but only when the WHOLE schedule fits: on a short stage (or with a longer translation) the panel would arrive cut off
    // and scrolling, so there it waits behind its chip instead. Checked again once the web fonts have settled the line breaks.
    const fits = () => panels.times.scrollHeight <= panels.times.clientHeight + 1
    const arrival = () => { if (openPanel === 'times' && restTimes && !fits()) show(null, { focus: false }) }
    arrival()
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!app.touched) arrival() })
  }
  setInterval(() => { if (!document.hidden) tickUi() }, 1000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tickUi() })
  new IntersectionObserver(([e]) => { if (e.isIntersecting) loadEngine().catch((error) => console.warn('[salah] scene unavailable, keeping the poster:', error.message)) }, { rootMargin: '700px 0px' }).observe(stage)
  new IntersectionObserver(([e]) => { app.visible = e.isIntersecting; root.classList.toggle('is-onscreen', e.isIntersecting) }, { threshold: 0.05 }).observe(stage)
  new ResizeObserver(() => { tickUi(); app.dirty = true }).observe(stage)
  requestAnimationFrame(loop)

  // DEV tools (a pretend clock, pretend places, the day played fast): only on a developer's own machine. On the published
  // site no address can switch them on, and the page keeps no handle to its state.
  const local = location.hostname === '127.0.0.1' || location.hostname === 'localhost'
  if (local && params.has('salah-dev')) import('./salah-dev.js').then((dev) => dev.mount(root, app, { tickUi, setPlace, previewCity, currentPlace, allCities, hhmm }))
  if (local) window.__salahSection = app
}
