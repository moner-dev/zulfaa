// Behaviour + performance checks of the homepage Salah section in headless Chrome (raw CDP):   node tools/salah_behaviour_check.mjs
//   city override + reload persistence, keyboard access, off-screen rendering, frame pacing with / without the overlay,
//   the cost of the once-a-second interface update, and what the section downloads.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ORIGIN = process.env.SALAH_ORIGIN || 'http://127.0.0.1:8081/preview/salah-site/' // the local preview mount to test (another mount of the same origin may be named)
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zulfaa-salah-beh-'))
const proc = spawn(chrome, ['--headless=new', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1440,900', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((resolve, reject) => { let buf = ''; proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]) }); setTimeout(() => reject(new Error('chrome did not start')), 20000) })
const ws = new WebSocket(wsUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0
const pending = new Map()
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result) } }
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })) })
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true })
for (const d of ['Page', 'Runtime']) await send(d + '.enable', {}, S)
// counts every Geolocation call from the first line of page script on: the section must never ask on its own
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__geoCalls = 0; for (const k of ['getCurrentPosition', 'watchPosition']) { const o = Geolocation.prototype[k]; Geolocation.prototype[k] = function (...a) { window.__geoCalls++; return o.apply(this, a) } }` }, S)
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const open = async (target) => {
  await send('Page.navigate', { url: 'about:blank' }, S)
  await send('Page.navigate', { url: ORIGIN + target }, S)
  for (let i = 0; i < 150; i++) { if (await evaluate(`!!(window.__salahSection && window.__salahSection.model)`)) return; await sleep(100) }
  throw new Error('section did not start')
}
const toSection = async () => { await evaluate(`(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('.salah-stage').scrollIntoView({ block: 'center' }) })()`); for (let i = 0; i < 150; i++) { if (await evaluate(`!!window.__salahSection.engine`)) break; await sleep(100) } await sleep(2400) }
const key = (k, code, text) => send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text, windowsVirtualKeyCode: k === 'Tab' ? 9 : k === 'Enter' ? 13 : 27 }, S).then(() => send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code }, S))
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  - ' + detail : ''}`) }

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, S)
// ---- location: zero-permission default, city override, persistence, back to the time zone
await open('')
const first = await evaluate(`({ name: __salahSection.place.name.en, source: __salahSection.place.source, tz: Intl.DateTimeFormat().resolvedOptions().timeZone })`)
check('default place comes from the time zone, no permission asked', first.source.startsWith('timezone'), `${first.name} from ${first.tz}`)
check('the Geolocation API was never called', await evaluate(`window.__geoCalls`) === 0, 'calls: ' + await evaluate(`window.__geoCalls`))
await toSection()
await evaluate(`document.querySelector('[data-salah-open="places"]').click()`)
await evaluate(`(() => { const i = document.querySelector('[data-salah-search]'); i.value = 'beir'; i.dispatchEvent(new Event('input', { bubbles: true })) })()`)
const hits = await evaluate(`[...document.querySelectorAll('[data-city]')].map((b) => b.dataset.city)`)
check('city search filters the list', hits.length === 1 && hits[0] === 'beirut', hits.join(','))
await evaluate(`document.querySelector('[data-city="beirut"]').click()`)
check('choosing a city updates the focus', await evaluate(`document.querySelector('[data-salah-text="place"]').textContent`) === 'Beirut')
await open('')
const again = await evaluate(`({ name: __salahSection.place.name.en, source: __salahSection.place.source, stored: localStorage.getItem('zulfaa-salah-place') })`)
check('the chosen city survives a reload', again.name === 'Beirut' && again.source === 'chosen', again.stored)
await open('nl/')
check('...and is shared by the other languages of the site', await evaluate(`__salahSection.place.name.nl`) === 'Beiroet')
await evaluate(`document.querySelector('[data-salah-timezone]').click()`)
check('"use my time zone" clears the choice', await evaluate(`localStorage.getItem('zulfaa-salah-place') === null && __salahSection.place.source.startsWith('timezone')`))

// ---- DEV places are ephemeral: a testing address shows a city, stores nothing, and never touches a real choice
await open('?salah-dev=quiet&city=beirut')
await sleep(400)
check('DEV ?city= shows the city without storing it', await evaluate(`__salahSection.place.name.en === 'Beirut' && localStorage.getItem('zulfaa-salah-place') === null`), await evaluate(`__salahSection.place.source`))
await open('')
check('...so the next normal visit is back on the time zone', await evaluate(`__salahSection.place.source.startsWith('timezone')`))
await toSection()
await evaluate(`document.querySelector('[data-salah-open="places"]').click()`)
await evaluate(`document.querySelector('[data-city="london"]').click()`)
await open('?salah-dev=quiet&city=beirut')
await sleep(400)
check('DEV ?city= does not overwrite a city the visitor really chose', await evaluate(`__salahSection.place.name.en === 'Beirut' && JSON.parse(localStorage.getItem('zulfaa-salah-place')).id === 'london'`))
await open('')
check('...and the real choice is still there afterwards', await evaluate(`__salahSection.place.name.en === 'London' && __salahSection.place.source === 'chosen'`))
await evaluate(`localStorage.removeItem('zulfaa-salah-place')`)

// ---- small phone: the site's scroll dock steps aside while a panel is open, and the chips stay on one row
await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 2, mobile: true }, S)
await open('nl/')
await toSection()
check('phone: the schedule stays closed on arrival', await evaluate(`document.querySelector('#salah-times').hidden && document.querySelector('[data-salah-open="times"]').getAttribute('aria-expanded') === 'false'`))
const dock = () => evaluate(`(() => { const d = document.querySelector('.dock'); return d ? getComputedStyle(d).visibility : 'missing' })()`)
const before = await dock()
await evaluate(`document.querySelector('[data-salah-open="times"]').click()`); await sleep(400)
const during = await dock()
const oneRow = await evaluate(`(() => { const c = [...document.querySelectorAll('.salah-chip')]; const cut = c.some((b) => { const t = b.querySelector('span:not(.vh)'); return t.scrollWidth > t.clientWidth }); return c[0].offsetTop === c[1].offsetTop && !cut })()`)
await evaluate(`document.querySelector('[data-salah-close]').click()`); await sleep(400)
check('phone: the scroll dock hides while a panel is open and returns after', before === 'visible' && during === 'hidden' && await dock() === 'visible', `${before} > ${during} > ${await dock()}`)
check('phone, Dutch, panel open: both chips on one row, nothing cut', oneRow)
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, S)

// ---- today's times rest OPEN on desktop: there on arrival without taking focus or moving the page, close / reopen, nothing stored
await open('')
const arrival = await evaluate(`({ open: !document.querySelector('#salah-times').hidden, expanded: document.querySelector('[data-salah-open="times"]').getAttribute('aria-expanded'), rows: [...document.querySelectorAll('#salah-times [data-salah-time]')].map((e) => e.textContent).join(' '),
  focusStolen: document.querySelector('.salah').contains(document.activeElement), scrollY: Math.round(scrollY), stored: Object.keys(localStorage).filter((k) => k.includes('salah')).join(',') })`)
check('desktop: today\'s times are open on arrival, all six filled in', arrival.open && arrival.expanded === 'true' && /^(\d\d:\d\d ?){6}$/.test(arrival.rows), arrival.rows)
check('...without taking focus, scrolling the page or storing anything', !arrival.focusStolen && arrival.scrollY === 0 && arrival.stored === '', JSON.stringify(arrival))
await toSection()
await evaluate(`document.querySelector('.salah-head h2').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`)
check('a click elsewhere on the page does not dismiss the resting schedule', await evaluate(`!document.querySelector('#salah-times').hidden`))
await evaluate(`document.querySelector('[data-salah-open="places"]').click()`); await sleep(200)
await key('Escape', 'Escape'); await sleep(200)
check('the city picker replaces it, and Escape brings the schedule back with focus on the location chip', await evaluate(`document.querySelector('#salah-places').hidden && !document.querySelector('#salah-times').hidden && document.activeElement === document.querySelector('[data-salah-open="places"]')`))
await evaluate(`document.querySelector('#salah-times [data-salah-close]').click()`); await sleep(200)
check('the close button closes it and focus returns to the chip', await evaluate(`document.querySelector('#salah-times').hidden && document.activeElement === document.querySelector('[data-salah-open="times"]') && document.querySelector('[data-salah-open="times"]').getAttribute('aria-expanded') === 'false'`))
await evaluate(`document.querySelector('[data-salah-open="places"]').click()`); await sleep(200)
await key('Escape', 'Escape'); await sleep(200)
check('once closed by the visitor it stays closed (the picker no longer brings it back)', await evaluate(`document.querySelector('#salah-times').hidden && document.querySelector('#salah-places').hidden`))

// ---- keyboard: reopen today's times with Enter, close with Escape, focus returns to the chip
await evaluate(`document.querySelector('[data-salah-open="times"]').focus()`)
await key('Enter', 'Enter', '\r')
await sleep(200)
check('Enter reopens today\'s times and moves focus into it', await evaluate(`!document.querySelector('#salah-times').hidden && document.querySelector('#salah-times').contains(document.activeElement)`))
await key('Escape', 'Escape')
await sleep(200)
check('Escape closes it and returns focus to the chip', await evaluate(`document.querySelector('#salah-times').hidden && document.activeElement === document.querySelector('[data-salah-open="times"]')`))
check('the focus group and the day line have accessible names', await evaluate(`!!document.querySelector('.salah-focus[aria-labelledby]') && !!document.querySelector('.salah-line[aria-label]') && document.querySelector('[data-salah-text="announce"]').textContent.length > 10`))
await open('')
check('a reload starts from the default again: open (the closing was not stored)', await evaluate(`!document.querySelector('#salah-times').hidden`))
await toSection()
const dockWide = await evaluate(`getComputedStyle(document.querySelector('.dock')).visibility`)
check('desktop: the scroll dock stays available while the schedule rests open', dockWide === 'visible', dockWide)

// ---- smart panel position: edge by day, inner while the sun is low on the right; one smooth glide, same physical side in Arabic
await open('?salah-dev=quiet&city=amsterdam&t=13:40')
await toSection()
const panelAt = () => evaluate(`(() => { const p = document.querySelector('#salah-times'), s = document.querySelector('.salah-stage').getBoundingClientRect(), r = p.getBoundingClientRect(); return { anchor: document.querySelector('.salah').dataset.panelAnchor, rightEdge: +((r.right - s.left) / s.width).toFixed(4), bottom: Math.round(s.bottom - r.bottom) } })()`)
const noon = await panelAt()
check('Dhuhr: the schedule rests at the right edge', noon.anchor === 'edge' && noon.rightEdge > 0.96, JSON.stringify(noon))
await evaluate(`(() => { __salahSection.sim = 19 * 60 + 40; __salahSection.dirty = true })()`)
const glide = []
for (let i = 0; i < 34; i++) { glide.push((await panelAt()).rightEdge); await sleep(100) }
const dusk = await panelAt()
const moves = glide.filter((v, i) => i && Math.abs(v - glide[i - 1]) > 0.002).length, back = glide.some((v, i) => i && v > glide[i - 1] + 0.002)
check('sweeping to Maghrib: it glides to the inner anchor - many small steps, one direction, no jump back', dusk.anchor === 'inner' && Math.abs(dusk.rightEdge - 0.715) < 0.004 && moves >= 5 && !back && dusk.bottom === noon.bottom, `${moves} steps, ends at ${(dusk.rightEdge * 100).toFixed(1)} % of the stage`)
const sunClear = await evaluate(`(() => { const s = document.querySelector('.salah-stage').getBoundingClientRect(), r = document.querySelector('#salah-times').getBoundingClientRect(); return (s.left + 0.822 * s.width) - r.right })()`)
check('the Maghrib sun column (82 % across) is clear of the panel', sunClear > 100, `${Math.round(sunClear)} px of open picture between them`)
await evaluate(`document.querySelector('[data-salah-open="places"]').click()`); await sleep(1300)
const picker = await evaluate(`(() => { const s = document.querySelector('.salah-stage').getBoundingClientRect(), r = document.querySelector('#salah-places').getBoundingClientRect(); return +((r.right - s.left) / s.width).toFixed(3) })()`)
check('the city picker uses the same anchor', Math.abs(picker - 0.715) < 0.004, String(picker))
await key('Escape', 'Escape'); await sleep(200)
await evaluate(`(() => { __salahSection.sim = 22 * 60 + 30; __salahSection.dirty = true })()`); await sleep(3600)
check('Isha: back at the right edge, leaving the moon alone', (await panelAt()).anchor === 'edge' && (await panelAt()).rightEdge > 0.96)
await open('ar/?salah-dev=quiet&city=amsterdam&t=19:40')
await toSection()
const rtl = await panelAt()
check('Arabic: same physical anchor (the picture is not mirrored)', rtl.anchor === 'inner' && Math.abs(rtl.rightEdge - 0.715) < 0.004, JSON.stringify(rtl))
await open('')
await toSection()

// ---- rendering lifecycle: frames while visible, none off-screen; the interface keeps updating either way
const frames = () => evaluate(`__salahSection.engine.renderer.stats.frames`)
let f0 = await frames(); await sleep(2000); let f1 = await frames()
check('visible and idle: renders at the capped idle rate', f1 - f0 > 40 && f1 - f0 < 75, `${((f1 - f0) / 2).toFixed(0)} frames per second`)
await evaluate(`window.scrollTo(0, 0)`); await sleep(600)
f0 = await frames(); await sleep(2000); f1 = await frames()
check('scrolled away: the scene stops rendering', f1 - f0 === 0, `${f1 - f0} frames in 2 s`)
const c0 = await evaluate(`document.querySelector('[data-salah-text="countdown"]').textContent`)
check('...while the interface still has a countdown', c0.trim().length > 3, c0)

// ---- cost of the overlay: frame pacing with and without it, and the once-a-second interface update
await evaluate(`document.querySelector('.salah-stage').scrollIntoView({ block: 'center' })`); await sleep(800)
const pace = (label) => evaluate(`new Promise((done) => { const a = __salahSection; a.dirtyHold = setInterval(() => (a.dirty = true), 4); const t = []; let last = performance.now(), n = 0;
  const f = (now) => { t.push(now - last); last = now; if (++n < 180) requestAnimationFrame(f); else { clearInterval(a.dirtyHold); t.sort((x, y) => x - y); done({ label: ${JSON.stringify(label)}, median: +t[90].toFixed(2), p95: +t[171].toFixed(2), cpuPerFrame: +a.engine.renderer.stats.cpuMs.toFixed(2), gpuPerFrame: a.engine.renderer.stats.gpuMs == null ? null : +a.engine.renderer.stats.gpuMs.toFixed(2), canvas: a.engine.renderer.canvas.width + "x" + a.engine.renderer.canvas.height }) } }; requestAnimationFrame(f) })`)
const withUi = await pace('scene + glass overlay')
await evaluate(`document.querySelector('.salah-ui').style.display = 'none'`)
const without = await pace('scene only')
await evaluate(`document.querySelector('.salah-ui').style.display = ''`)
console.log('     frame pacing, every frame forced to render (ms):', JSON.stringify(withUi), JSON.stringify(without))
check('the overlay does not change frame pacing', withUi.median <= without.median * 1.15 + 0.5)
const tick = await evaluate(`import('${ORIGIN}assets/salah/day-model.js').then(async (M) => { const a = __salahSection; const t = performance.now(); for (let i = 0; i < 200; i++) M.modelAt({ place: a.place, riseFrame: a.riseFrame }); return (performance.now() - t) / 200 })`)
check('one interface update (three days of prayer times + model) is cheap', tick < 2, `${tick.toFixed(3)} ms, once a second`)

check('still no Geolocation call after every interaction', await evaluate(`window.__geoCalls`) === 0)

// ---- what the section downloads
const res = await evaluate(`performance.getEntriesByType('resource').filter((e) => e.name.includes('/assets/salah/')).map((e) => [e.name.split('/assets/salah/')[1].split('?')[0], e.encodedBodySize || e.transferSize || 0])`)
const kb = (f) => Math.round(res.filter(([n]) => f(n)).reduce((t, [, b]) => t + b, 0) / 1024)
console.log(`     downloads: ${res.length} files, ${kb(() => true)} KB total = scene assets ${kb((n) => n.startsWith('scene/'))} KB + engine ${kb((n) => n.startsWith('engine/'))} KB + section code and styles ${kb((n) => /^(salah|day|prayer|places)/.test(n) && !n.endsWith('.json'))} KB + places ${kb((n) => n === 'places.json')} KB + poster ${kb((n) => n.startsWith('poster/'))} KB`)
console.log(`     texture memory ${Math.round(await evaluate('__salahSection.engine.renderer.stats.textureBytes') / 1048576)} MB`)

// ---- reduced motion: no catch-up reveal, a still lake, the right moment of the day and almost no redraws
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, S)
await open('')
await evaluate(`(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('.salah-stage').scrollIntoView({ block: 'center' }) })()`)
let sawReveal = false
for (let i = 0; i < 80; i++) { sawReveal = sawReveal || await evaluate(`!!__salahSection.reveal`); if (i > 30 && await evaluate(`!!__salahSection.engine`)) break; await sleep(100) }
check('reduced motion: the scroll reveal never runs', !sawReveal && await evaluate(`!!__salahSection.engine`))
f0 = await frames(); await sleep(3000); f1 = await frames()
check('reduced motion: the scene is a still picture (at most one redraw in 3 s)', f1 - f0 <= 1, `${f1 - f0} frames`)
check('reduced motion: the countdown still updates', (await evaluate(`document.querySelector('[data-salah-text="countdown"]').textContent`)).trim().length > 3)
check('no Geolocation call in this page either', await evaluate(`window.__geoCalls`) === 0)
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed')
ws.close(); proc.kill(); process.exit(failed ? 1 : 0)
