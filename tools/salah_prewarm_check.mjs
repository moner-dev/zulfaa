// Salah section - conditional prewarming (roadmap V-01, option D), headless Chrome, raw CDP, no npm packages:
//   node tools/salah_prewarm_check.mjs OUTDIR
// The controller starts the engine in TWO steps: PREWARM (1800 px away, or the address names #prayer-times): engine modules,
// WebGL context, the two shader programs - nothing else; LOAD (700 px away, as always): scene assets, textures, drawing.
// Everything is observed from outside the page (a probe counts contexts, programs, textures, draws, loops, listeners and the
// files requested); ?hold keeps the programs "not complete yet" so the pending state is reproducible. Local preview, DEV
// handle needed; the last case serves the same tree under the production hostname to prove the DEV switches are dead there.
// Genuine background tabs: no --disable-background-timer-throttling, no --disable-renderer-backgrounding.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ORIGIN = process.env.SALAH_ORIGIN || 'http://127.0.0.1:8081/preview/salah-release/'
const SITE = 'https://zulfaa.nl/'
const outDir = process.argv[2] || '.'
fs.mkdirSync(outDir, { recursive: true })
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zulfaa-salah-prewarm-'))
const proc = spawn(chrome, ['--headless=new', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1440,900', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((resolve, reject) => { let buf = ''; proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]) }); setTimeout(() => reject(new Error('chrome did not start')), 20000) })
const ws = new WebSocket(wsUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0, S = null, consoleLog = [], files = [], asProduction = false
const pending = new Map()
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })) })
ws.onmessage = async (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); return }
  if (m.sessionId !== S) return
  if (m.method === 'Fetch.requestPaused') { const { requestId, request } = m.params, u = new URL(request.url)
    const salah = u.pathname.match(/\/salah-[0-9a-f]+\/(.*)$/); if (salah) files.push(salah[1])
    try {
      if (u.protocol === 'data:' || u.protocol === 'blob:' || u.origin === new URL(ORIGIN).origin) return void (await send('Fetch.continueRequest', { requestId }, S))
      if (asProduction && u.origin + '/' === SITE) { let p = u.pathname.slice(1); if (p === '' || p.endsWith('/')) p += 'index.html'; const r = await fetch(ORIGIN + p), body = Buffer.from(await r.arrayBuffer())
        return void (await send('Fetch.fulfillRequest', { requestId, responseCode: r.status, responseHeaders: [{ name: 'content-type', value: r.headers.get('content-type') || 'application/octet-stream' }], body: body.toString('base64') }, S)) }
      await send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }, S) // analytics, fonts, anything else: never contacted
    } catch {} }
  else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) consoleLog.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
  else if (m.method === 'Runtime.exceptionThrown') consoleLog.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 200))
}
const first = (await send('Target.getTargets')).targetInfos.find((t) => t.type === 'page')
const A = first.targetId
S = (await send('Target.attachToTarget', { targetId: A, flatten: true })).sessionId
for (const d of ['Page', 'Runtime']) await send(d + '.enable', {}, S)
await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, S)
const { targetId: B } = await send('Target.createTarget', { url: 'about:blank', newWindow: false }) // a second tab in the same window: activating it really hides tab A
await send('Target.activateTarget', { targetId: A })

const PROBE = `(() => { const q = new URLSearchParams(location.search), salah = (gl) => !!(gl.canvas && gl.canvas.hasAttribute && gl.canvas.hasAttribute('data-salah-canvas'))
  const P = window.__pw = { contexts: 0, programs: 0, textures: 0, draws: 0, raf: 0, loops: {}, listeners: {}, long: [], rejections: 0, hold: q.has('hold'), complete: false }
  addEventListener('unhandledrejection', () => P.rejections++)
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) P.long.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask' }) } catch (e) {}
  const r = window.requestAnimationFrame.bind(window); let lastT = -1
  window.requestAnimationFrame = (f) => r((t) => { if (t !== lastT) { lastT = t; P.raf++ } P.loops[f.name || 'anonymous'] = (P.loops[f.name || 'anonymous'] || 0) + 1; f(t) })
  const add = EventTarget.prototype.addEventListener; EventTarget.prototype.addEventListener = function (type, ...a) { if (this instanceof HTMLCanvasElement && this.hasAttribute('data-salah-canvas') && /^webglcontext/.test(type)) P.listeners[type] = (P.listeners[type] || 0) + 1; return add.call(this, type, ...a) }
  const G = WebGL2RenderingContext.prototype
  const count = (name, key) => { const o = G[name]; G[name] = function (...a) { if (salah(this)) P[key]++; return o.apply(this, a) } }
  count('texImage2D', 'textures'); count('drawArrays', 'draws')
  const made = []; const cp = G.createProgram; G.createProgram = function () { const p = cp.call(this); if (salah(this)) { P.programs++; made.push([this, p]) } return p }
  const gx = G.getExtension; G.getExtension = function (n) { if (n === 'KHR_parallel_shader_compile' && q.has('noparallel') && salah(this)) return null; return gx.call(this, n) }
  P.allComplete = () => made.length > 0 && made.every(([gl, p]) => gl.isContextLost() || gp.call(gl, p, 0x91B1)) // asked by the TEST: during the early start the engine itself asks nothing
  const gp = G.getProgramParameter; G.getProgramParameter = function (p, name) { if (salah(this) && name === 0x91B1) { const real = gp.call(this, p, name); if (real) P.complete = true; return P.hold ? false : real } return gp.call(this, p, name) }
  const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...a) { if (this.hasAttribute('data-salah-canvas') && q.has('nowebgl2')) return null; const had = this.__ctx; const gl = gc.call(this, type, ...a); if (gl && type === 'webgl2' && this.hasAttribute('data-salah-canvas') && !had) { this.__ctx = true; P.contexts++ } return gl }
})()`
await send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE }, S)
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0, n = 0
const check = (name, ok, detail = '') => { n++; if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  - ' + String(detail).replace(/[^ -~]/g, '?').slice(0, 260) : ''}`) }

async function open(flags = '', { reduced = false, pinned = true, hash = '', base = ORIGIN, dev = true, w = 1440, h = 900 } = {}) {
  consoleLog = []; files = []
  const query = [dev ? 'salah-dev=quiet&city=amsterdam' + (pinned ? '&t=13:40' : '') : '', flags].filter(Boolean).join('&')
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: w < 700 ? 2 : 1, mobile: w < 700 }, S)
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] }, S)
  await send('Page.navigate', { url: 'about:blank' }, S)
  await send('Page.navigate', { url: `${base}${query ? '?' + query : ''}${hash}` }, S)
  for (let i = 0; i < 150; i++) { if (await evaluate(`document.readyState === 'complete' && !document.querySelector('[data-salah-ui]').hidden`).catch(() => false)) break; await sleep(100) }
  await evaluate(`(document.documentElement.style.scrollBehavior = 'auto', 1)`)
}
/** scroll so that the stage's top edge is `distance` px below the viewport's bottom edge (negative: that much of it is inside) */
const toDistance = (distance) => evaluate(`(() => { const s = document.querySelector('.salah-stage').getBoundingClientRect(); scrollTo(0, Math.max(0, s.top + scrollY - innerHeight - ${distance})); return Math.round(document.querySelector('.salah-stage').getBoundingClientRect().top - innerHeight) })()`)
const toScene = async () => { await evaluate(`document.querySelector('.salah-stage').scrollIntoView({ block: 'center' })`); for (let i = 0; i < 250; i++) { if (await evaluate(`!!document.querySelector('.salah.is-live')`)) break; await sleep(100) } await sleep(2600) }
const untilLive = async (ms = 12000) => { for (let i = 0; i < ms / 100; i++) { if (await evaluate(`!!document.querySelector('.salah.is-live')`)) return true; await sleep(100) } return false }
const probe = () => evaluate(`(() => { const P = window.__pw, a = window.__salahSection, r = document.querySelector('.salah'), e = a && a.engine
  return { contexts: P.contexts, programs: P.programs, textures: P.textures, draws: P.draws, complete: P.allComplete(), rejections: P.rejections, listeners: P.listeners, longest: Math.max(0, ...P.long.filter((x) => x[0] >= (P.since || 0)).map((x) => x[1])),
    prewarmed: a ? !!a.prewarmed : null, wantEngine: a ? !!a.wantEngine : null, engine: !!e, failed: a ? !!a.engineFailed : null, compile: e ? e.renderer.stats.compile : null, reveal: a ? !!a.reveal : null, restores: a ? a.restores : null,
    live: r.classList.contains('is-live'), lost: r.classList.contains('is-lost'), phase: r.dataset.phase, anchor: r.dataset.panelAnchor, frame: a && a.model ? +a.model.scene.frame.toFixed(2) : null,
    rows: [...document.querySelectorAll('[data-salah-time]')].map((t) => t.textContent).join(' '), posterShown: (() => { const p = document.querySelector('[data-salah-poster]'), ps = getComputedStyle(p); return ps.visibility !== 'hidden' && Number(ps.opacity) > 0.98 && p.complete && p.naturalWidth > 0 })() } })()`)
const framesIn = (ms) => evaluate(`new Promise((done) => { const P = window.__pw, d0 = P.draws, r0 = P.raf, l0 = P.loops.loop || 0; setTimeout(() => done({ draws: P.draws - d0, raf: P.raf - r0, loopPerFrame: +(((P.loops.loop || 0) - l0) / Math.max(1, P.raf - r0)).toFixed(2) }), ${ms}) })`)
const stagePixels = async (name) => {
  const clip = await evaluate(`(() => { const s = document.querySelector('.salah-scene').getBoundingClientRect(); return { x: s.left + s.width * 0.30 + scrollX, y: s.top + s.height * 0.08 + scrollY, width: s.width * 0.30, height: s.height * 0.22 } })()`)
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 0.25 } }, S)
  if (name) { const full = await evaluate(`(() => { const s = document.querySelector('.salah-stage').getBoundingClientRect(); return { x: 0, y: Math.max(0, s.top + scrollY - 12), width: innerWidth, height: s.height + 24 } })()`); const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 78, clip: { ...full, scale: 1 } }, S); fs.writeFileSync(path.join(outDir, name + '.jpg'), Buffer.from(shot.data, 'base64')) }
  return evaluate(`new Promise((done) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, white = 0, n = d.length / 4; for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; if (d[k] > 245 && d[k + 1] > 245 && d[k + 2] > 245) white++ } done({ r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), whiteShare: +(white / n).toFixed(3) }) }; i.src = 'data:image/png;base64,${data}' })`)
}
const near = (a, b, tol) => Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol
const lose = () => evaluate(`(() => { const gl = document.querySelector('[data-salah-canvas]').getContext('webgl2'); window.__ext = gl.getExtension('WEBGL_lose_context'); window.__ext.loseContext(); return true })()`)
const restore = () => evaluate(`window.__ext.restoreContext()`)
/** the hero's own cold start (a separate, open item) is over; long tasks are counted from here */
const settle = async () => { await sleep(4000); await evaluate(`(window.__pw.since = performance.now(), 1)`) }
const engineFiles = () => files.filter((f) => f.startsWith('engine/') && f !== 'engine/timeline.js') // timeline.js is a static import of the day model, on every visit, in production too
const sceneFiles = () => files.filter((f) => f.startsWith('scene/'))
const only = process.env.SALAH_ONLY || ''
const on = (k) => !only || only.split(',').includes(k)

// ================================================================= N - the visitor never approaches: nothing of the engine starts
if (on('N')) {
  await open(); await sleep(6000); const a = await probe()
  check('N: at the top for 6 s: no WebGL context, no program, no texture, no draw, no early start recorded', a.contexts === 0 && a.programs === 0 && a.textures === 0 && a.draws === 0 && a.prewarmed === false && a.wantEngine === false, JSON.stringify({ contexts: a.contexts, programs: a.programs }))
  check('N: no engine module and no scene asset is requested (only what the interface itself needs)', engineFiles().length === 0 && sceneFiles().length === 0, files.join(' '))
  const d = await toDistance(1900); await sleep(1500); const b = await probe()
  check('N: 1900 px away is still outside: nothing has started', b.contexts === 0 && b.programs === 0 && b.prewarmed === false && engineFiles().length === 0, `stage ${d} px below the viewport`)
  check('N: the interface works without any of it (six times, console clean)', /^(\d\d:\d\d ){5}\d\d:\d\d$/.test(b.rows) && consoleLog.length === 0, consoleLog.join(' || '))
}

// ================================================================= Z - inside the prewarm distance, outside the loading distance: programs only
if (on('Z')) {
  await open(); await settle(); const d = await toDistance(1200); await sleep(3500); const a = await probe()
  check('Z: 1200 px away: ONE context, the TWO programs started, the early start recorded', a.contexts === 1 && a.programs === 2 && a.prewarmed === true, `stage ${d} px below the viewport; ${JSON.stringify({ contexts: a.contexts, programs: a.programs })}`)
  check('Z: and NOTHING else: no scene asset requested, no texture, no draw, no engine, not live, the scene not yet "wanted"', sceneFiles().length === 0 && a.textures === 0 && a.draws === 0 && !a.engine && !a.live && a.wantEngine === false, `scene files ${sceneFiles().length}, textures ${a.textures}`)
  check('Z: the programs compile in the background without a long task', a.complete === true && a.longest < 200, `complete ${a.complete}, longest task since the approach began ${a.longest} ms`)
  // I - idempotent: in and out of the distance, again and again
  for (let i = 0; i < 4; i++) { await toDistance(2400); await sleep(350); await toDistance(1000); await sleep(350) }
  await evaluate(`scrollTo(0, 0)`); await sleep(800); const b = await probe()
  check('I: four approaches and retreats, then back to the top: still one context and two programs, nothing downloaded or drawn', b.contexts === 1 && b.programs === 2 && b.textures === 0 && b.draws === 0 && sceneFiles().length === 0 && !b.engine)
  // H - hand-over: the early renderer becomes THE renderer
  await toScene(); const c = await probe(), f = await framesIn(1000)
  check('H: arriving: live with the EARLY renderer - still one context, still two programs, no second compile, no wait', c.live && c.engine && c.contexts === 1 && c.programs === 2 && c.compile && c.compile.parallel && c.compile.waitedMs < 150, JSON.stringify(c.compile))
  check('H: one loop, drawing, one listener of each kind, no unhandled rejection, console clean', f.loopPerFrame === 1 && f.draws > 10 && c.listeners.webglcontextlost === 1 && c.listeners.webglcontextrestored === 1 && c.rejections === 0 && consoleLog.length === 0, consoleLog.join(' || '))
}

// ================================================================= T - prepared early, shown LATER: the first frame is the moment of arrival, not of preparation
if (on('T')) {
  await open(); await toScene(); const dhuhr = await stagePixels()
  await open('', {}); await evaluate(`(window.__salahSection.sim = 19 * 60 + 40, 1)`); await toScene(); const maghribRef = await stagePixels('T_reference_maghrib')
  await open(); await toDistance(1200); await sleep(3000); const a = await probe()
  await evaluate(`(window.__salahSection.sim = 19 * 60 + 40, 1)`); await sleep(1500) // hours pass between preparation and arrival
  await toScene(); const b = await probe(), px = await stagePixels('T_prepared_at_dhuhr_shown_at_maghrib')
  check('T: prepared at Dhuhr, arrived at Maghrib: phase, panel position and picture are Maghrib\'s', a.phase === 'dhuhr' && b.phase === 'maghrib' && b.anchor === 'inner' && near(px, maghribRef, 8) && !near(px, dhuhr, 8), `prepared in ${a.phase}; shown ${b.phase}/${b.anchor}; rgb ${px.r},${px.g},${px.b} vs Maghrib ${maghribRef.r},${maghribRef.g},${maghribRef.b} vs Dhuhr ${dhuhr.r},${dhuhr.g},${dhuhr.b}`)
  await open('', { pinned: false }); await toDistance(1200); await sleep(2500); await toScene()
  const live = await evaluate(`(() => { const a = window.__salahSection; return { frame: +a.model.scene.frame.toFixed(2), countdown: document.querySelector('[data-salah-text=countdown]').textContent.trim().length > 0 } })()`)
  check('T: real clock: live on the shared model\'s current frame, countdown present', (await probe()).live && live.countdown, `frame ${live.frame}`)
}

// ================================================================= A - the address names the section
if (on('A')) {
  await open('', { hash: '#prayer-times' }); const live = await untilLive(); await sleep(1200); const a = await probe()
  check('A: opened at #prayer-times: started at once, live, one context, two programs, console clean', live && a.prewarmed && a.engine && a.contexts === 1 && a.programs === 2 && consoleLog.length === 0, consoleLog.join(' || '))
  await open(); await sleep(1500); const b = await probe()
  await evaluate(`(document.documentElement.style.scrollBehavior = '', location.hash = '#prayer-times', 1)`); await sleep(120); const c = await probe()
  check('A: hashchange to #prayer-times from the top: the programs start BEFORE the smooth scroll gets there', b.programs === 0 && c.prewarmed === true && c.contexts === 1, `120 ms after the hash change: contexts ${c.contexts}, programs ${c.programs}, live ${c.live}`)
  const live2 = await untilLive(); await sleep(1200); const d = await probe()
  check('A: and the scene goes live there with that one renderer', live2 && d.contexts === 1 && d.programs === 2)
}

// ================================================================= R - reduced motion
if (on('R')) {
  await open('', { reduced: true, pinned: false }); await toDistance(1200); await sleep(3000); const a = await probe()
  check('R: reduced motion: the early start draws nothing', a.programs === 2 && a.draws === 0 && !a.live)
  await toScene(); const b = await probe(), f = await framesIn(2500), px = await stagePixels('R_reduced_motion')
  check('R: reduced motion: live without a reveal, a still scene (at most one redraw in 2.5 s), a real picture', b.live && !b.reveal && f.draws <= 2 && px.whiteShare < 0.2, `${f.draws} draw calls in 2.5 s`)
}

// ================================================================= L - context loss around the early start (H-02 must hold)
if (on('L1')) {
  await open(); await toDistance(1200); await sleep(3000); await lose(); await sleep(900); const a = await probe(), px = await stagePixels()
  check('L1: lost AFTER the early start, before the scene was wanted: nothing live, nothing white, the interface works', !a.live && !a.engine && px.whiteShare < 0.2 && /^(\d\d:\d\d ){5}\d\d:\d\d$/.test(a.rows))
  await restore(); await sleep(2500); const b = await probe()
  check('L1: restored: not marked lost, the programs are started again on the new context - and nothing more (no asset, no draw)', !b.lost && b.programs === 4 && b.contexts === 1 && b.textures === 0 && b.draws === 0 && !b.engine && b.restores === 1, JSON.stringify({ programs: b.programs, restores: b.restores, lost: b.lost }))
  await toScene(); const c = await probe(), f = await framesIn(1000)
  check('L1: arriving afterwards: live, the restarted programs were used (no third pair), one loop, one listener of each kind, console clean', c.live && c.engine && c.programs === 4 && f.loopPerFrame === 1 && c.listeners.webglcontextlost === 1 && c.listeners.webglcontextrestored === 1 && consoleLog.length === 0, consoleLog.join(' || '))
}
if (on('L2')) {
  await open('hold'); await toDistance(1200); await sleep(1500); await lose(); await sleep(600); await restore(); await sleep(1200)
  await evaluate(`(window.__pw.hold = false, 1)`); await toScene(); const a = await probe(), f = await framesIn(1000)
  check('L2: lost and restored WHILE the early programs were compiling: live on arrival, one loop, quiet', a.live && a.engine && f.loopPerFrame === 1 && a.rejections === 0 && consoleLog.length === 0, consoleLog.join(' || '))
}
if (on('L3')) {
  await open(); await toDistance(1200); await sleep(2500); await lose(); await sleep(600)
  await toScene(); const a = await probe(), px = await stagePixels('L3_arrived_with_a_lost_context')
  check('L3: arrived while the context is still lost: poster, no engine, never live, nothing white, the interface works', !a.live && !a.engine && a.posterShown && px.whiteShare < 0.2 && /^(\d\d:\d\d ){5}\d\d:\d\d$/.test(a.rows))
  check('L3: no error, no exception, no unhandled rejection (at most the one quiet "keeping the poster" warning)', consoleLog.filter((l) => /^\[(error|exception)/.test(l)).length === 0 && consoleLog.length <= 1 && a.rejections === 0, consoleLog.join(' || ') || 'nothing logged')
  await restore(); const live = await untilLive(); await sleep(1500); const b = await probe(), f = await framesIn(1000)
  check('L3: restored while on screen: rebuilt and live, no replayed reveal, one loop', live && b.engine && !b.lost && !b.reveal && f.loopPerFrame === 1)
}
if (on('L4')) {
  await open(); await toDistance(1200); await sleep(2500); await toScene(); await lose(); await sleep(800); await restore(); const live = await untilLive(); await sleep(1500); const a = await probe(), f = await framesIn(1000)
  check('L4: lost during active rendering (after an early start): H-02 as before - rebuilt, live, one loop, console clean', live && a.engine && !a.lost && f.loopPerFrame === 1 && consoleLog.length === 0, consoleLog.join(' || '))
  await evaluate(`scrollTo(0, 0)`); await sleep(800); await lose(); await sleep(600); await restore(); await sleep(3000); const b = await probe(), off = await framesIn(1000)
  check('L4: lost and restored OFF screen: rebuilt, nothing drawn while out of view; live again on return', b.engine && off.draws === 0)
  await toScene(); check('L4: back on screen: live', (await probe()).live)
}

// ================================================================= S - the tab goes to the background during the early start
if (on('S')) {
  await open('hold'); await toDistance(1200); await sleep(1200)
  await send('Target.activateTarget', { targetId: B }); await sleep(1200); const hidden = await evaluate(`document.visibilityState`)
  await evaluate(`(window.__pw.hold = false, 1)`); await sleep(3500); const a = await probe()
  await send('Target.activateTarget', { targetId: A }); await sleep(1200); await toScene(); const b = await probe(), f = await framesIn(1000)
  check('S: tab hidden during the early start: nothing drawn meanwhile; on return and arrival: live, one context, two programs, one loop, quiet', hidden === 'hidden' && a.draws === 0 && b.live && b.contexts === 1 && b.programs === 2 && f.loopPerFrame === 1 && consoleLog.length === 0, consoleLog.join(' || '))
}

// ================================================================= F - a browser without the extension (Firefox's situation): the early start must not move the blocking compile
if (on('F')) {
  await open('noparallel'); await settle(); await toDistance(1200); await sleep(3000); const a = await probe()
  check('F: no extension: the early start creates the context but compiles NOTHING - the blocking compile stays where it always was', a.contexts === 1 && a.programs === 0 && a.prewarmed === true && a.longest < 200, `programs ${a.programs}, longest task since the approach began ${a.longest} ms`)
  await toScene(); const b = await probe()
  check('F: no extension: on arrival the old path builds the scene: live, synchronous path, one context, two programs', b.live && b.compile && b.compile.parallel === false && b.contexts === 1 && b.programs === 2, JSON.stringify(b.compile))
}

// ================================================================= W - no WebGL2 at all
if (on('W')) {
  await open('nowebgl2'); await toDistance(1200); await sleep(2500); const a = await probe()
  check('W: no WebGL2: the early start fails silently - no warning yet, no unhandled rejection', consoleLog.length === 0 && a.rejections === 0, consoleLog.join(' || '))
  await toScene(); await sleep(500); const b = await probe()
  check('W: no WebGL2: on arrival ONE quiet warning, the poster stays, the interface works', !b.live && b.failed && b.posterShown && consoleLog.length === 1 && /^\[warning\]/.test(consoleLog[0]) && b.rejections === 0 && /^(\d\d:\d\d ){5}\d\d:\d\d$/.test(b.rows), consoleLog.join(' || '))
}

// ================================================================= M - a phone-sized viewport
if (on('M')) {
  await open('', { w: 390, h: 844 }); await sleep(3000); const a = await probe()
  await toDistance(1200); await sleep(3000); const b = await probe(); await toScene(); const c = await probe()
  check('M: phone viewport: nothing at the top; programs only at 1200 px; live with that renderer on arrival', a.contexts === 0 && b.programs === 2 && b.textures === 0 && c.live && c.contexts === 1 && c.programs === 2 && c.compile.waitedMs < 150, JSON.stringify(c.compile))
}

// ================================================================= P - under the production hostname the local benchmark switches do not exist
if (on('P')) {
  asProduction = true
  await open('salah-prewarm=eager', { base: SITE, dev: false }); await sleep(5000); const a = await probe()
  check('P: https://zulfaa.nl/?salah-prewarm=eager (local tree served under that name): NOTHING starts at the top - the switch is dead', a.contexts === 0 && a.programs === 0 && a.prewarmed === null, `contexts ${a.contexts}, programs ${a.programs}, DEV handle ${a.prewarmed === null ? 'absent' : 'PRESENT'}`)
  await open('salah-prewarm=off', { base: SITE, dev: false }); await toDistance(1200); await sleep(3000); const b = await probe()
  check('P: https://zulfaa.nl/?salah-prewarm=off: the early start happens all the same', b.contexts === 1 && b.programs === 2 && b.textures === 0)
  asProduction = false
}

console.log(failed ? `${failed} of ${n} checks FAILED` : `all ${n} checks passed`)
ws.close(); proc.kill()
await sleep(500); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
process.exit(failed ? 1 : 0)
