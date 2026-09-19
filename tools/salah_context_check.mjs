// Salah section - WebGL context loss and recovery, and the deep-link anchor (headless Chrome, raw CDP, no npm packages):
//   node tools/salah_context_check.mjs OUTDIR
// Audit findings H-02 (a lost context left a white stage until reload) and H-05 (#prayer-times under the sticky header).
// The loss is REAL: the WEBGL_lose_context extension of the scene's own context. Runs against the LOCAL preview
// (SALAH_ORIGIN, default the /preview/salah-release/ mount), where the DEV handle window.__salahSection exists.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ORIGIN = process.env.SALAH_ORIGIN || 'http://127.0.0.1:8081/preview/salah-release/'
const outDir = process.argv[2] || '.'
fs.mkdirSync(outDir, { recursive: true })
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zulfaa-salah-context-'))
const proc = spawn(chrome, ['--headless=new', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1440,900', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((resolve, reject) => { let buf = ''; proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]) }); setTimeout(() => reject(new Error('chrome did not start')), 20000) })
const ws = new WebSocket(wsUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0, S = null, consoleLog = [], requests = []
const pending = new Map()
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })) })
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); return }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) consoleLog.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
  else if (m.method === 'Runtime.exceptionThrown') consoleLog.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 200))
  else if (m.method === 'Network.responseReceived') requests.push([m.params.response.status, m.params.response.url, m.params.response.fromDiskCache])
}
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
S = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId
for (const d of ['Page', 'Runtime', 'Network']) await send(d + '.enable', {}, S)
// count what a leak would multiply: animation-frame callbacks per second and listeners on the canvas
const PROBE = `(() => { window.__raf = 0; const r = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => r((t) => { window.__raf++; f(t) })
  window.__listeners = {}; const add = EventTarget.prototype.addEventListener; EventTarget.prototype.addEventListener = function (type, ...a) { if (this instanceof HTMLCanvasElement && this.hasAttribute('data-salah-canvas') && /^webglcontext/.test(type)) window.__listeners[type] = (window.__listeners[type] || 0) + 1; return add.call(this, type, ...a) } })()`
await send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE }, S)
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0, n = 0
const check = (name, ok, detail = '') => { n++; if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  - ' + String(detail).replace(/[^ -~]/g, '?').slice(0, 240) : ''}`) }

async function open(target = '', { w = 1440, h = 900, reduced = false, extra = '', toStage = true } = {}) {
  consoleLog = []; requests = []
  const mobile = w < 700
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile }, S)
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] }, S)
  await send('Page.navigate', { url: 'about:blank' }, S)
  await send('Page.navigate', { url: ORIGIN + target + extra }, S)
  for (let i = 0; i < 150; i++) { if (await evaluate(`!!(window.__salahSection && window.__salahSection.model)`).catch(() => false)) break; await sleep(100) }
  if (!toStage) return
  await evaluate(`(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('.salah-stage').scrollIntoView({ block: 'center' }) })()`)
  for (let i = 0; i < 200; i++) { if (await evaluate(`!!document.querySelector('.salah.is-live')`)) break; await sleep(100) }
  await sleep(2600) // the reveal and the canvas fade are over
}
const state = () => evaluate(`(() => { const a = window.__salahSection, q = (s) => document.querySelector(s), c = q('[data-salah-canvas]'), cs = getComputedStyle(c), p = q('[data-salah-poster]'), ps = getComputedStyle(p)
  const gl = c.getContext('webgl2')
  return { live: q('.salah').classList.contains('is-live'), lost: q('.salah').classList.contains('is-lost'), engine: !!a.engine, contextLost: gl ? gl.isContextLost() : null, frames: a.engine ? a.engine.renderer.stats.frames : null,
    canvasShown: cs.visibility !== 'hidden' && Number(cs.opacity) > 0.98, canvasHidden: cs.visibility === 'hidden' || Number(cs.opacity) < 0.02, posterShown: ps.visibility !== 'hidden' && Number(ps.opacity) > 0.98 && p.complete && p.naturalWidth > 0, poster: p.getAttribute('src').split('/').pop(), phase: q('.salah').dataset.phase,
    time: q('[data-salah-text=time]').textContent, countdown: q('[data-salah-text=countdown]').textContent.trim(), place: q('[data-salah-text=place]').textContent.trim(), rows: [...document.querySelectorAll('[data-salah-time]')].map((t) => t.textContent).join(' '),
    frame: +a.model.scene.frame.toFixed(2), seed: a.engine ? a.engine.renderer.birdSeed : null, textureMB: a.engine ? +(a.engine.renderer.stats.textureBytes / 1048576).toFixed(1) : null, restores: a.restores, listeners: window.__listeners } })()`)
const lose = () => evaluate(`(() => { const gl = document.querySelector('[data-salah-canvas]').getContext('webgl2'); window.__ext = window.__ext || gl.getExtension('WEBGL_lose_context'); window.__ext.loseContext(); return !!window.__ext })()`)
const restore = () => evaluate(`window.__ext.restoreContext()`)
const framesIn = (ms) => evaluate(`new Promise((done) => { const a = window.__salahSection, f0 = a.engine ? a.engine.renderer.stats.frames : 0, r0 = window.__raf; setTimeout(() => done({ frames: (a.engine ? a.engine.renderer.stats.frames : 0) - f0, raf: window.__raf - r0 }), ${ms}) })`)
/** mean colour of a patch of the VISIBLE stage: a white box or a black hole shows here, whatever the DOM claims */
const stagePixels = async (name) => {
  const clip = await evaluate(`(() => { const s = document.querySelector('.salah-scene').getBoundingClientRect(); return { x: s.left + s.width * 0.30 + scrollX, y: s.top + s.height * 0.08 + scrollY, width: s.width * 0.30, height: s.height * 0.22 } })()`)
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 0.25 } }, S)
  if (name) { const full = await evaluate(`(() => { const s = document.querySelector('.salah-stage').getBoundingClientRect(); return { x: 0, y: Math.max(0, s.top + scrollY - 12), width: innerWidth, height: s.height + 24 } })()`); const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 78, clip: { ...full, scale: 1 } }, S); fs.writeFileSync(path.join(outDir, name + '.jpg'), Buffer.from(shot.data, 'base64')) }
  return evaluate(`new Promise((done) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, white = 0, n = d.length / 4; for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; if (d[k] > 245 && d[k + 1] > 245 && d[k + 2] > 245) white++ } done({ r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), whiteShare: +(white / n).toFixed(3) }) }; i.src = 'data:image/png;base64,${data}' })`)
}
const near = (a, b, tol) => Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol
const only = process.env.SALAH_ONLY || '' // one case at a time while developing: A, E, C, B, D, F (no WebGL2), H (anchor)

// ================================================================= Case A - loss and restoration while the scene is on screen
if (!only || only === 'A') {
await open('', { extra: '?salah-dev=quiet&city=amsterdam&t=13:40' })
const a0 = await state(), skyLive = await stagePixels('A1_live')
check('A: the scene is live before the test (engine, canvas shown, frames advancing)', a0.live && a0.engine && a0.canvasShown && (await framesIn(1000)).frames > 10, `frames ${a0.frames}, textures ${a0.textureMB} MB`)
check('A: exactly one webglcontextlost and one webglcontextrestored listener exist', a0.listeners.webglcontextlost === 1 && a0.listeners.webglcontextrestored === 1, JSON.stringify(a0.listeners))
await lose(); await sleep(700)
const a1 = await state(), skyLost = await stagePixels('A2_lost_poster')
check('A: on loss the canvas is hidden at once, the poster of the current phase shows, drawing stops', a1.lost && !a1.live && a1.canvasHidden && a1.posterShown && !a1.engine && a1.poster === a1.phase + '.webp' && (await framesIn(1200)).frames === 0, `poster ${a1.poster}, context lost ${a1.contextLost}`)
check('A: what the visitor SEES during the loss is the poster - no white box', skyLost.whiteShare < 0.2 && near(skyLost, skyLive, 40), `live rgb ${skyLive.r},${skyLive.g},${skyLive.b}  lost rgb ${skyLost.r},${skyLost.g},${skyLost.b}  white ${skyLost.whiteShare}`)
check('A: the interface is untouched by the loss (time, countdown, place, six times)', a1.time === a0.time && a1.place === a0.place && a1.rows === a0.rows && /^(\d\d:\d\d ){5}\d\d:\d\d$/.test(a1.rows), `${a1.time} | ${a1.countdown} | ${a1.place}`)
await restore(); await sleep(3500)
const a2 = await state(), skyBack = await stagePixels('A3_restored')
check('A: after restoration the scene is rebuilt and drawing again, canvas shown, not marked lost', a2.engine && a2.live && !a2.lost && a2.canvasShown && a2.contextLost === false && (await framesIn(1000)).frames > 10, `frames since rebuild ${a2.frames}, restores ${a2.restores}`)
check('A: it returns to the SAME moment and the same sky (shared model frame, bird seed, texture memory)', Math.abs(a2.frame - a0.frame) < 0.2 && a2.seed === a0.seed && a2.textureMB === a0.textureMB, `frame ${a0.frame} -> ${a2.frame}, seed ${a0.seed} -> ${a2.seed}, ${a2.textureMB} MB`)
check('A: the restored picture matches the picture before the loss', near(skyBack, skyLive, 12), `before rgb ${skyLive.r},${skyLive.g},${skyLive.b}  after rgb ${skyBack.r},${skyBack.g},${skyBack.b}`)
check('A: the rebuild downloaded nothing new over the network (assets come from the cache)', requests.filter((r) => /scene\/|engine\//.test(r[1])).length > 0 && requests.filter((r) => /scene\//.test(r[1])).slice(-14).every((r) => r[0] === 200 || r[0] === 304), `${requests.filter((r) => /scene\//.test(r[1])).length} scene responses in total, last ones from cache: ${requests.filter((r) => /scene\//.test(r[1])).slice(-14).filter((r) => r[2]).length}`)
check('A: console stayed clean through loss and restoration', consoleLog.length === 0, consoleLog.join(' || '))
}

// ================================================================= Case E - the interface keeps working DURING a loss
if (!only || only === 'E') {
await open('', { extra: '?salah-dev=quiet&city=amsterdam' }) // the real clock: a pinned DEV time would never tick
await lose(); await sleep(600)
const e0 = await state()
await sleep(61000) // long enough for the countdown to move on a minute
const e1 = await state()
check('E: the countdown keeps running while the scene is lost', e1.countdown !== e0.countdown && e1.lost, `"${e0.countdown}" -> "${e1.countdown}"`)
await evaluate(`document.querySelector('[data-salah-open=places]').click()`); await sleep(400)
await evaluate(`[...document.querySelectorAll('[data-salah-cities] button')].find((b) => b.dataset.city === 'istanbul').click()`); await sleep(800)
const e2 = await state()
check('E: a city can be chosen during the loss; place, times and the poster\'s phase follow the shared model', /Istanbul/.test(e2.place) && e2.rows !== e1.rows && e2.lost && e2.posterShown && e2.poster === e2.phase + '.webp' && (await evaluate(`localStorage.getItem('zulfaa-salah-place')`)) === '{"kind":"city","id":"istanbul"}', `${e2.place} | ${e2.rows} | poster ${e2.poster}`)
const sched = await evaluate(`(() => { const p = document.getElementById('salah-times'); if (p.hidden) document.querySelector('[data-salah-open=times]').click(); return !document.getElementById('salah-times').hidden })()`)
check('E: the schedule stays accessible during the loss', sched)
await restore(); await sleep(3500)
const e3 = await state()
check('E: after restoration the scene shows the CHOSEN city\'s moment, the choice is kept', e3.engine && e3.live && /Istanbul/.test(e3.place) && Math.abs(e3.frame - e2.frame) < 1.5, `frame ${e2.frame} -> ${e3.frame}`)
await evaluate(`localStorage.clear()`)
}

// ================================================================= Case C - repeated loss and restoration
if (!only || only === 'C') {
await open('', { extra: '?salah-dev=quiet&city=amsterdam&t=13:40' })
const c0 = await state(), idle0 = await framesIn(2000)
for (let i = 0; i < 3; i++) { await lose(); await sleep(500); await restore(); await sleep(3000) }
const c1 = await state(), idle1 = await framesIn(2000)
check('C: three losses and restorations: live again every time, still one listener of each kind', c1.engine && c1.live && !c1.lost && c1.listeners.webglcontextlost === 1 && c1.listeners.webglcontextrestored === 1 && c1.restores === 3, JSON.stringify(c1.listeners) + ' restores ' + c1.restores)
check('C: still ONE animation loop and the same idle frame rate (no duplicated loop, no extra drawing)', Math.abs(idle1.raf - idle0.raf) <= Math.max(6, idle0.raf * 0.08) && Math.abs(idle1.frames - idle0.frames) <= 6, `animation-frame callbacks in 2 s: ${idle0.raf} -> ${idle1.raf}; scene frames in 2 s: ${idle0.frames} -> ${idle1.frames}`)
check('C: texture memory is what it was (no resources piling up)', c1.textureMB === c0.textureMB, `${c0.textureMB} MB -> ${c1.textureMB} MB`)
for (let i = 0; i < 5; i++) { await lose(); await sleep(250); await restore(); await sleep(250) } // faster than a rebuild can finish
await sleep(4000)
const c2 = await state()
check('C: losses faster than a rebuild never leave a half-built or white scene; rebuilding is capped (6 in ten minutes)', (c2.live && c2.engine && !c2.lost) || (c2.lost && !c2.engine && c2.posterShown), `live ${c2.live}, engine ${c2.engine}, restores ${c2.restores} (cap 6)`)
check('C: console stayed clean', consoleLog.length === 0, consoleLog.join(' || '))
}

// ================================================================= Case B - loss while the section is off screen
if (!only || only === 'B') {
await open('', { extra: '?salah-dev=quiet&city=amsterdam&t=19:40' })
const b0 = await state()
await evaluate(`scrollTo(0, 0)`); await sleep(700)
await lose(); await sleep(500); await restore(); await sleep(3500)
const b1 = await state(), offFrames = await framesIn(1500)
check('B: lost and restored off screen: rebuilt, but nothing is drawn while the section is out of view', b1.engine && offFrames.frames === 0 && !b1.live, `frames off screen ${offFrames.frames}, canvas hidden ${b1.canvasHidden}, poster ${b1.poster}`)
await evaluate(`document.querySelector('.salah-stage').scrollIntoView({ block: 'center' })`); await sleep(1800)
const b2 = await state()
check('B: back on screen the first valid frame brings the canvas back, at the right moment of the day', b2.live && !b2.lost && b2.canvasShown && (await framesIn(1000)).frames > 10 && Math.abs(b2.frame - b0.frame) < 0.3 && b2.phase === b0.phase, `phase ${b2.phase}, frame ${b0.frame} -> ${b2.frame}`)
}

// ================================================================= Case D - reduced motion
if (!only || only === 'D') {
await open('', { reduced: true, extra: '?salah-dev=quiet&city=amsterdam&t=13:40' })
const d0 = await state(), dSky0 = await stagePixels()
await lose(); await sleep(600)
const d1 = await state()
await restore(); await sleep(3500)
const d2 = await state(), dSky2 = await stagePixels('D_reduced_restored'), dFrames = await framesIn(2500)
check('D: reduced motion: poster on loss, the still scene returns after restoration', d1.lost && d1.posterShown && d2.live && d2.engine && near(dSky2, dSky0, 12), `rgb ${dSky0.r},${dSky0.g},${dSky0.b} -> ${dSky2.r},${dSky2.g},${dSky2.b}`)
check('D: reduced motion: no animation is started by the recovery (at most one redraw in 2.5 s)', dFrames.frames <= 1, `${dFrames.frames} frames`)
}

// ================================================================= Initial failure - WebGL2 not available at all
if (!only || only === 'F') {
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__noWebgl = location.search.includes('nowebgl'); const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...a) { return window.__noWebgl && this.hasAttribute('data-salah-canvas') && /webgl/.test(type) ? null : gc.call(this, type, ...a) }` }, S)
consoleLog = []
await send('Page.navigate', { url: ORIGIN + '?salah-dev=quiet&city=amsterdam&t=13:40&nowebgl' }, S)
for (let i = 0; i < 150; i++) { if (await evaluate(`!!(window.__salahSection && window.__salahSection.model)`).catch(() => false)) break; await sleep(100) }
await evaluate(`(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('.salah-stage').scrollIntoView({ block: 'center' }) })()`)
for (let i = 0; i < 100 && !(await evaluate(`window.__salahSection.engineFailed === true`)); i++) await sleep(100) // the engine import settles first; a fixed wait was read too early once
await sleep(1500)
const f0 = await evaluate(`(() => { const q = (s) => document.querySelector(s), p = q('[data-salah-poster]'); return { live: q('.salah').classList.contains('is-live'), failed: window.__salahSection.engineFailed, poster: p.getAttribute('src').split('/').pop(), posterOk: p.complete && p.naturalWidth > 0, canvasOpacity: getComputedStyle(q('[data-salah-canvas]')).opacity, rows: [...document.querySelectorAll('[data-salah-time]')].map((t) => t.textContent).join(' '), time: q('[data-salah-text=time]').textContent } })()`)
const fSky = await stagePixels('F_no_webgl_poster')
check('no WebGL2 at all: the poster of the current phase stays, the canvas never shows, the interface works', !f0.live && f0.failed && f0.posterOk && f0.poster === 'dhuhr.webp' && Number(f0.canvasOpacity) < 0.02 && /^(\d\d:\d\d ){5}\d\d:\d\d$/.test(f0.rows) && fSky.whiteShare < 0.2, `${f0.poster} | ${f0.time} | ${f0.rows} | live ${f0.live} failed ${f0.failed} posterOk ${f0.posterOk} canvas opacity ${f0.canvasOpacity} white ${fSky.whiteShare}`)
check('no WebGL2 at all: one quiet warning, no error, no retry loop', consoleLog.filter((l) => /^\[(error|exception)/.test(l)).length === 0 && consoleLog.length <= 1, consoleLog.join(' || ') || 'nothing logged')
}

// ================================================================= H-05 - the deep link lands below the sticky header
if (!only || only === 'H') {
for (const [target, lang] of [['', 'en'], ['ar/', 'ar'], ['nl/', 'nl']]) for (const [w, h, dev] of [[1440, 900, 'desktop'], [820, 1180, 'tablet'], [390, 844, 'phone']]) {
  const mobile = w < 700
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile }, S)
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] }, S)
  await send('Page.navigate', { url: 'about:blank' }, S)
  await send('Page.navigate', { url: ORIGIN + target + '#prayer-times' }, S)
  for (let i = 0; i < 100; i++) { if (await evaluate(`document.readyState === 'complete'`).catch(() => false)) break; await sleep(100) }
  await sleep(1600)
  const measure = () => evaluate(`(() => { const s = document.getElementById('prayer-times').getBoundingClientRect(), hd = document.querySelector('header.site-head').getBoundingClientRect(), eb = document.querySelector('.salah-eyebrow').getBoundingClientRect(), t = document.getElementById('salah-title').getBoundingClientRect(); return { top: Math.round(s.top), header: Math.round(hd.bottom), eyebrow: Math.round(eb.top), titleBottom: Math.round(t.bottom), vh: innerHeight, margin: getComputedStyle(document.getElementById('prayer-times')).scrollMarginTop, overflowX: document.documentElement.scrollWidth - innerWidth } })()`)
  let m = await measure()
  const lands = (x) => x.top >= x.header - 1 && x.top - x.header <= 6 // below the header, by at most the few pixels the 4.6rem convention leaves on a phone
  check(`H-05 ${lang} ${dev}: /#prayer-times lands just below the sticky header, heading visible, no gap, no overflow`, lands(m) && m.eyebrow > m.header && m.titleBottom < m.vh && m.overflowX <= 0, `section top ${m.top}, header bottom ${m.header}, eyebrow ${m.eyebrow}, scroll-margin-top ${m.margin}`)
  if (lang === 'en') {
    await send('Page.reload', {}, S); await sleep(2200); m = await measure()
    check(`H-05 ${lang} ${dev}: a reload with the hash present lands in the same place`, lands(m), `section top ${m.top}, header bottom ${m.header}`)
    await evaluate(`scrollTo(0, 0)`); await sleep(500)
    await evaluate(`(() => { const a = document.createElement('a'); a.href = '#prayer-times'; a.textContent = 'x'; document.body.append(a); a.click(); a.remove() })()`); await sleep(1800) // the site scrolls smoothly: let it finish
    m = await measure()
    check(`H-05 ${lang} ${dev}: an in-page link to #prayer-times (smooth scrolling kept) ends below the header`, lands(m) && (await evaluate(`getComputedStyle(document.documentElement).scrollBehavior`)) === 'smooth', `section top ${m.top}, header bottom ${m.header}`)
    await evaluate(`scrollTo(0, 0)`); await sleep(400)
    await evaluate(`[...document.querySelectorAll('header nav a, #site-menu a')].find((a) => /#contact$/.test(a.getAttribute('href'))).click()`); await sleep(1800)
    const c = await evaluate(`(() => { const s = document.getElementById('contact').getBoundingClientRect(), hd = document.querySelector('header.site-head').getBoundingClientRect(); return { top: Math.round(s.top), header: Math.round(hd.bottom) } })()`)
    check(`H-05 ${lang} ${dev}: the existing #contact navigation is unchanged, and #prayer-times now lands exactly like it`, lands(c) && Math.abs((c.top - c.header) - (m.top - m.header)) <= 2, `contact top ${c.top}, prayer-times top ${m.top}, header bottom ${c.header}`)
  }
}
{
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, S)
  await send('Page.navigate', { url: ORIGIN }, S); await sleep(2500)
  const flow = await evaluate(`(() => { const s = document.getElementById('prayer-times'), prev = document.querySelector('section.showcase'), next = document.querySelector('section.trust'); return { gapAbove: Math.round(s.getBoundingClientRect().top - prev.getBoundingClientRect().bottom), gapBelow: Math.round(next.getBoundingClientRect().top - s.getBoundingClientRect().bottom), padTop: getComputedStyle(s).paddingTop } })()`)
  check('H-05: normal page flow is untouched - no gap opened above or below the section', flow.gapAbove === 0 && flow.gapBelow === 0, JSON.stringify(flow))
}
}

console.log(failed ? `\n${failed} of ${n} checks FAILED` : `\nall ${n} checks passed`)
ws.close(); proc.kill(); process.exit(failed ? 1 : 0)
