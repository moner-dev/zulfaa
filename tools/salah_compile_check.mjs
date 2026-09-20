// Salah section - non-blocking shader preparation (roadmap V-01), headless Chrome, raw CDP, no npm packages:
//   node tools/salah_compile_check.mjs OUTDIR
// The engine starts its two programs at the beginning of load() and asks the browser "complete?" on a timer instead of
// waiting for the answer (KHR_parallel_shader_compile); without the extension it compiles and asks as it always did.
// A compile that takes seconds only happens on a first visit, so the PENDING state is produced from outside the page: the
// probe answers "not complete yet" for the Salah canvas while ?hold is in force (window.__hold). Nothing in the site is
// changed by this; the engine sees an ordinary slow compile. Runs against the LOCAL preview (DEV handle needed).
// Genuine background tabs: no --disable-background-timer-throttling, no --disable-renderer-backgrounding.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ORIGIN = process.env.SALAH_ORIGIN || 'http://127.0.0.1:8081/preview/salah-release/'
const outDir = process.argv[2] || '.'
fs.mkdirSync(outDir, { recursive: true })
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zulfaa-salah-compile-'))
const proc = spawn(chrome, ['--headless=new', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1440,900', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((resolve, reject) => { let buf = ''; proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]) }); setTimeout(() => reject(new Error('chrome did not start')), 20000) })
const ws = new WebSocket(wsUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0, S = null, consoleLog = []
const pending = new Map()
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })) })
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); return }
  if (m.sessionId !== S) return
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) consoleLog.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
  else if (m.method === 'Runtime.exceptionThrown') consoleLog.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 200))
}
const first = (await send('Target.getTargets')).targetInfos.find((t) => t.type === 'page')
const A = first.targetId
S = (await send('Target.attachToTarget', { targetId: A, flatten: true })).sessionId
for (const d of ['Page', 'Runtime']) await send(d + '.enable', {}, S)
const { targetId: B } = await send('Target.createTarget', { url: 'about:blank', newWindow: false }) // a second tab in the same window: activating it really hides tab A
await send('Target.activateTarget', { targetId: A })

// the probe: counts what a leak would multiply, records the ORDER of the engine's questions, and plays the slow compiler
const PROBE = `(() => { const q = new URLSearchParams(location.search), salah = (gl) => !!(gl.canvas && gl.canvas.hasAttribute && gl.canvas.hasAttribute('data-salah-canvas'))
  window.__hold = q.has('hold'); window.__log = []; window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask' }) } catch (e) {}
  window.__raf = 0; window.__loops = {}; window.__contexts = 0; window.__maxGap = 0; window.__gapFrom = performance.now()
  const r = window.requestAnimationFrame.bind(window); let lastT = -1
  window.requestAnimationFrame = (f) => r((t) => { if (t !== lastT) { lastT = t; window.__raf++; const n = performance.now(); window.__maxGap = Math.max(window.__maxGap, n - window.__gapFrom); window.__gapFrom = n } window.__loops[f.name || 'anonymous'] = (window.__loops[f.name || 'anonymous'] || 0) + 1; f(t) })
  window.__listeners = {}; const add = EventTarget.prototype.addEventListener; EventTarget.prototype.addEventListener = function (type, ...a) { if (this instanceof HTMLCanvasElement && this.hasAttribute('data-salah-canvas') && /^webglcontext/.test(type)) window.__listeners[type] = (window.__listeners[type] || 0) + 1; return add.call(this, type, ...a) }
  const P = WebGL2RenderingContext.prototype, COMPLETE = 0x91B1
  const gx = P.getExtension; P.getExtension = function (n) { if (n === 'KHR_parallel_shader_compile' && q.has('noparallel') && salah(this)) return null; return gx.call(this, n) }
  const gp = P.getProgramParameter; P.getProgramParameter = function (p, name) { if (!salah(this)) return gp.call(this, p, name)
    if (name === COMPLETE) { const real = gp.call(this, p, name); const v = window.__hold ? false : real; window.__log.push([v ? 'complete' : 'pending', Math.round(performance.now())]); return v }
    if (name === this.LINK_STATUS) { window.__log.push(['link?', Math.round(performance.now())]); if (q.has('loseatfinish') && !window.__lostAtFinish) { window.__lostAtFinish = true; (window.__ext = gx.call(this, 'WEBGL_lose_context')).loseContext() } }
    return gp.call(this, p, name) }
  const gs = P.getShaderParameter; P.getShaderParameter = function (s, name) { if (salah(this) && name === this.COMPILE_STATUS) window.__log.push(['compile?', Math.round(performance.now())]); return gs.call(this, s, name) }
  const ss = P.shaderSource; P.shaderSource = function (s, src) { return ss.call(this, s, q.has('badshader') && salah(this) && this.getShaderParameter && /uTexRefl|uLut/.test(src) && !window.__brokeOne ? (window.__brokeOne = true, src.replace('void main', 'void main_broken_on_purpose(')) : src) }
  const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...a) { const first = !this.__seen; const gl = gc.call(this, type, ...a)
    if (gl && type === 'webgl2' && this.hasAttribute('data-salah-canvas') && first) { this.__seen = true; window.__contexts++; if (q.has('loseatstart')) (window.__ext = gx.call(gl, 'WEBGL_lose_context')).loseContext() } return gl }
})()`
await send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE }, S)
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0, n = 0
const check = (name, ok, detail = '') => { n++; if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  - ' + String(detail).replace(/[^ -~]/g, '?').slice(0, 260) : ''}`) }

// a pinned DEV time keeps pictures comparable; the controller plays NO reveal under a pinned time, so the checks about the
// reveal and about reduced motion run on the real clock (pinned: false)
async function open(flags = '', { reduced = false, toStage = true, waitLive = true, lang = '', pinned = true } = {}) {
  const DEV = 'salah-dev=quiet&city=amsterdam' + (pinned ? '&t=13:40' : '')
  consoleLog = []
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, S)
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] }, S)
  await send('Page.navigate', { url: 'about:blank' }, S)
  await send('Page.navigate', { url: `${ORIGIN}${lang}?${DEV}${flags ? '&' + flags : ''}` }, S)
  for (let i = 0; i < 150; i++) { if (await evaluate(`!!(window.__salahSection && window.__salahSection.model)`).catch(() => false)) break; await sleep(100) }
  if (toStage) await toScene(waitLive)
}
const toScene = async (waitLive = true) => {
  await evaluate(`(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('.salah-stage').scrollIntoView({ block: 'center' }) })()`)
  if (!waitLive) return
  for (let i = 0; i < 250; i++) { if (await evaluate(`!!document.querySelector('.salah.is-live')`)) break; await sleep(100) }
  await sleep(2600) // the reveal and the canvas fade are over
}
/** the engine has asked "complete?" at least `times` times: the programs are started and load() is waiting */
const untilPending = async (times = 3) => { for (let i = 0; i < 200; i++) { if ((await evaluate(`window.__log.filter((e) => e[0] === 'pending').length`)) >= times) return true; await sleep(50) } return false }
const state = () => evaluate(`(() => { const a = window.__salahSection, q = (s) => document.querySelector(s), c = q('[data-salah-canvas]'), cs = getComputedStyle(c), p = q('[data-salah-poster]'), ps = getComputedStyle(p), e = a.engine
  return { live: q('.salah').classList.contains('is-live'), lost: q('.salah').classList.contains('is-lost'), engine: !!e, failed: !!a.engineFailed, compile: e ? e.renderer.stats.compile : null, frames: e ? e.renderer.stats.frames : null,
    contextLost: e ? e.renderer.gl.isContextLost() : null, canvasShown: cs.visibility !== 'hidden' && Number(cs.opacity) > 0.98, canvasHidden: cs.visibility === 'hidden' || Number(cs.opacity) < 0.02,
    posterShown: ps.visibility !== 'hidden' && Number(ps.opacity) > 0.98 && p.complete && p.naturalWidth > 0, poster: p.getAttribute('src').split('/').pop(), phase: q('.salah').dataset.phase,
    time: q('[data-salah-text=time]').textContent, countdown: q('[data-salah-text=countdown]').textContent.trim(), rows: [...document.querySelectorAll('[data-salah-time]')].map((t) => t.textContent).join(' '),
    frame: +a.model.scene.frame.toFixed(2), reveal: !!a.reveal, restores: a.restores, listeners: window.__listeners, contexts: window.__contexts, log: window.__log.map((e) => e[0]).join(' ').replace(/(pending ?)+/g, 'pending.. ') } })()`)
const framesIn = (ms) => evaluate(`new Promise((done) => { const a = window.__salahSection, f0 = a.engine ? a.engine.renderer.stats.frames : 0, r0 = window.__raf, l0 = window.__loops.loop || 0; setTimeout(() => done({ frames: (a.engine ? a.engine.renderer.stats.frames : 0) - f0, raf: window.__raf - r0, loopPerFrame: +(((window.__loops.loop || 0) - l0) / Math.max(1, window.__raf - r0)).toFixed(2) }), ${ms}) })`)
const stagePixels = async (name) => {
  const clip = await evaluate(`(() => { const s = document.querySelector('.salah-scene').getBoundingClientRect(); return { x: s.left + s.width * 0.30 + scrollX, y: s.top + s.height * 0.08 + scrollY, width: s.width * 0.30, height: s.height * 0.22 } })()`)
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 0.25 } }, S)
  if (name) { const full = await evaluate(`(() => { const s = document.querySelector('.salah-stage').getBoundingClientRect(); return { x: 0, y: Math.max(0, s.top + scrollY - 12), width: innerWidth, height: s.height + 24 } })()`); const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 78, clip: { ...full, scale: 1 } }, S); fs.writeFileSync(path.join(outDir, name + '.jpg'), Buffer.from(shot.data, 'base64')) }
  return evaluate(`new Promise((done) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, white = 0, n = d.length / 4; for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; if (d[k] > 245 && d[k + 1] > 245 && d[k + 2] > 245) white++ } done({ r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n), whiteShare: +(white / n).toFixed(3) }) }; i.src = 'data:image/png;base64,${data}' })`)
}
const near = (a, b, tol) => Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol
const lose = () => evaluate(`(() => { const gl = document.querySelector('[data-salah-canvas]').getContext('webgl2'); window.__ext = window.__ext || gl.getExtension('WEBGL_lose_context'); window.__ext.loseContext(); return true })()`)
const restore = () => evaluate(`window.__ext.restoreContext()`)
const release = () => evaluate(`window.__hold = false`)
const untilLive = async (ms = 12000) => { for (let i = 0; i < ms / 100; i++) { if (await evaluate(`!!document.querySelector('.salah.is-live')`)) return true; await sleep(100) } return false }
const orderOk = (log) => { const i = log.indexOf('complete'), j = log.search(/link\?|compile\?/); return i !== -1 && j > i } // no status question before the browser said "complete"
const only = process.env.SALAH_ONLY || ''
const on = (k) => !only || only.split(',').includes(k)
let reference = null

// ================================================================= P - the parallel path, as a visitor gets it (this is the first load of a fresh profile: a COLD compile)
if (on('P')) {
  await open('', { toStage: false }); await sleep(4000) // the hero's own cold start (a separate, open item) is over before the Salah window opens
  const tStart = await evaluate(`(window.__maxGap = 0, window.__gapFrom = performance.now(), performance.now())`)
  await toScene(false)
  const live = await untilLive(20000); const cold = await evaluate(`({ maxGap: Math.round(window.__maxGap), long: window.__long.filter((e) => e[0] >= ${tStart}).map((e) => e[1]) })`); await sleep(2600)
  const p = await state(); reference = await stagePixels('P_parallel_live')
  check('P: the extension is present and the parallel path is the one in use', p.compile && p.compile.parallel === true && p.compile.gaveUp === false, JSON.stringify(p.compile))
  check('P: the scene goes live, canvas shown, frames advancing, one context, one loop', live && p.live && p.engine && p.canvasShown && p.contexts === 1 && (await framesIn(1000)).loopPerFrame === 1, `contexts ${p.contexts}`)
  check('P: no status question is asked before the browser reports the programs complete', orderOk(p.log), p.log)
  // What this guards: the wait for the compiler must not sit INSIDE a task (the old engine: one task as long as the compile - 2000 ms on
  // 19 Sep 2026, 2500-2700 ms on a slower evening, 20 Sep). What remains is the rest of load() arriving at once after an instant jump to the
  // section (module evaluation, twelve texture uploads, one synchronous framebuffer check while the GPU process is busy): 245-273 ms on
  // 19 Sep, 288-356 ms on 20 Sep, the same for the engine with and without the early start. A fixed 300 ms was fitted to one evening; the
  // limit is therefore relative to the measured compile wait, with an absolute ceiling.
  const limit = Math.min(600, (p.compile ? p.compile.waitedMs : 0) * 0.5)
  check('P: COLD compile - the wait for the compiler is NOT inside a task (longest task and frame gap under half of that wait, never above 600 ms; the old engine: the whole wait, 2000-2700 ms)', cold.maxGap < limit && Math.max(0, ...cold.long) < limit, `waited ${p.compile && p.compile.waitedMs} ms for the compiler; limit ${Math.round(limit)} ms; longest frame gap ${cold.maxGap} ms; long tasks ${JSON.stringify(cold.long)}`)
  check('P: console clean', consoleLog.length === 0, consoleLog.join(' || '))
}

// ================================================================= R - while the programs are pending: responsive page, poster, working interface, then the right first frame
if (on('R')) {
  await open('hold', { waitLive: false, pinned: false })
  check('R: the engine is waiting for its programs (asks "complete?", gets "not yet")', await untilPending(5))
  await evaluate(`(window.__maxGap = 0, window.__gapFrom = performance.now(), 1)`); await sleep(2500)
  const r0 = await state(), px0 = await stagePixels('R_pending_poster'), gap = await evaluate(`Math.round(window.__maxGap)`)
  check('R: pending: no engine yet, the poster of the current phase is shown, the canvas is not', !r0.engine && !r0.live && r0.posterShown && r0.canvasHidden && r0.poster === r0.phase + '.webp', `poster ${r0.poster}`)
  check('R: pending: nothing white or half-drawn is visible', px0.whiteShare < 0.2, JSON.stringify(px0))
  check('R: pending: the page keeps producing frames (longest gap under 120 ms in 2.5 s) and asks at most once per timer tick', gap < 120 && (await evaluate(`window.__log.filter((e) => e[0] === 'pending').length`)) < 400, `longest gap ${gap} ms`)
  check('R: pending: not one status question has been asked', !/link\?|compile\?/.test(r0.log), r0.log)
  await evaluate(`document.querySelector('[data-salah-open=places]').click()`); await sleep(400)
  const picker = await evaluate(`!document.getElementById('salah-places').hidden`); await evaluate(`document.querySelector('[data-city=istanbul]').click()`); await sleep(500)
  const r1 = await state()
  check('R: pending: the prayer interface works (city picker opens, Istanbul chosen, six times change)', picker && r1.rows !== r0.rows && /^(\d\d:\d\d ){5}\d\d:\d\d$/.test(r1.rows), `${r0.rows} -> ${r1.rows}`)
  await release(); const live = await untilLive(); const r2 = await state()
  check('R: released: live with the one-time reveal, on the CURRENT model (the city chosen while waiting)', live && r2.engine && r2.reveal && Math.abs(r2.frame - r1.frame) < 0.5 && r2.compile.parallel && !r2.compile.gaveUp, `frame ${r1.frame} -> ${r2.frame}, waited ${r2.compile.waitedMs} ms`)
  check('R: the verdict is still asked after completion (compile status of 4 shaders, link status of 2 programs)', (r2.log.match(/compile\?/g) || []).length === 4 && (r2.log.match(/link\?/g) || []).length === 2 && orderOk(r2.log), r2.log)
  await sleep(2600)
  check('R: one context, one loop, console clean', r2.contexts === 1 && (await framesIn(1000)).loopPerFrame === 1 && consoleLog.length === 0, consoleLog.join(' || '))
}

// ================================================================= S - the visitor scrolls away before the programs are ready, and comes back
if (on('S')) {
  await open('hold', { waitLive: false }); await untilPending(3)
  await evaluate(`scrollTo(0, 0)`); await sleep(600); await release(); await sleep(1500)
  const s0 = await state(), off = await framesIn(1200)
  check('S: finished off screen: the engine is ready, nothing is drawn while out of view', s0.engine && off.frames === 0, `frames off screen ${off.frames}`)
  await toScene(); const s1 = await state()
  check('S: back on screen: live, drawing, the right moment, one loop', s1.live && s1.canvasShown && (await framesIn(1000)).frames > 10 && s1.contexts === 1, `frame ${s1.frame}`)
  await open('hold', { waitLive: false }); await untilPending(3); await evaluate(`scrollTo(0, 0)`); await sleep(500); await toScene(false); await sleep(500)
  const s2 = await state(); await release(); const live = await untilLive(); await sleep(2600)
  check('S: away and back WHILE still pending: poster meanwhile, then live - one engine, one loop', !s2.engine && s2.posterShown && live && (await state()).contexts === 1 && (await framesIn(1000)).loopPerFrame === 1)
  check('S: console clean', consoleLog.length === 0, consoleLog.join(' || '))
}

// ================================================================= T - the tab goes to the background during preparation (a real tab switch)
if (on('T')) {
  await open('hold', { waitLive: false }); await untilPending(3)
  await send('Target.activateTarget', { targetId: B }); await sleep(1200)
  const hidden = await evaluate(`document.visibilityState`); await release(); await sleep(4000) // timers are throttled to one per second in a background tab
  const t0 = await state()
  check('T: really hidden; the preparation still FINISHES in the background (a timer, not an animation frame)', hidden === 'hidden' && t0.engine && t0.compile && !t0.compile.gaveUp, `visibility ${hidden}, engine ${t0.engine}`)
  check('T: nothing is drawn while the tab is hidden', (await framesIn(1200)).frames === 0)
  await send('Target.activateTarget', { targetId: A }); await sleep(3000); const t1 = await state()
  check('T: back in the foreground: live and drawing, one loop, console clean', t1.live && t1.canvasShown && (await framesIn(1000)).frames > 10 && (await framesIn(500)).loopPerFrame === 1 && consoleLog.length === 0, consoleLog.join(' || '))
}

// ================================================================= M - reduced motion
if (on('M')) {
  await open('hold', { reduced: true, waitLive: false, pinned: false }); await untilPending(3); await release(); const live = await untilLive(); await sleep(1500)
  const m = await state(), f = await framesIn(2500), px = await stagePixels('M_reduced_motion')
  check('M: reduced motion: live without a reveal, a still scene (at most one redraw in 2.5 s), a real picture', live && m.engine && !m.reveal && f.frames <= 1 && px.whiteShare < 0.2, `${f.frames} frames, reveal ${m.reveal}`)
}

// ================================================================= L1 - the context is lost WHILE the programs are pending
if (on('L1')) {
  await open('hold', { waitLive: false }); await untilPending(3)
  await lose(); await sleep(900); const a = await state(), px = await stagePixels('L1_lost_while_pending')
  check('L1: lost while pending: poster, no engine, marked lost, nothing white', a.lost && !a.engine && !a.live && a.posterShown && px.whiteShare < 0.2)
  await release(); await sleep(1200); const b = await state()
  check('L1: the abandoned preparation never activates anything (still no engine after its compiler "finished")', !b.engine && !b.live && b.lost)
  check('L1: and it ended quietly: no warning, no error, no unhandled rejection', consoleLog.length === 0, consoleLog.join(' || '))
  await restore(); const live = await untilLive(); await sleep(1200); const c = await state()
  check('L1: restored: rebuilt and live, no replayed reveal, one listener of each kind, one loop', live && c.engine && !c.lost && !c.reveal && c.listeners.webglcontextlost === 1 && c.listeners.webglcontextrestored === 1 && (await framesIn(1000)).loopPerFrame === 1, JSON.stringify(c.listeners))
  check('L1: console still clean', consoleLog.length === 0, consoleLog.join(' || '))
}

// ================================================================= L2 - the context is lost BEFORE compilation starts (at the moment it is created)
if (on('L2')) {
  await open('loseatstart', { waitLive: false }); await sleep(2500); const a = await state()
  check('L2: lost before anything was compiled: poster, no engine, the interface works', !a.engine && !a.live && a.posterShown && /^(\d\d:\d\d ){5}\d\d:\d\d$/.test(a.rows))
  check('L2: no error and no exception (at most the one quiet "keeping the poster" warning)', consoleLog.filter((l) => /^\[(error|exception)/.test(l)).length === 0 && consoleLog.length <= 1, consoleLog.join(' || ') || 'nothing logged')
  await restore(); const live = await untilLive(); await sleep(1200); const b = await state()
  check('L2: restored: the scene is built and live', live && b.engine && !b.lost && b.compile && b.compile.parallel)
}

// ================================================================= L3 - the context is lost at the last moment: programs complete, verdict being asked, first frame not drawn yet
if (on('L3')) {
  await open('loseatfinish', { waitLive: false }); await sleep(3000); const a = await state(), px = await stagePixels('L3_lost_before_first_frame')
  check('L3: lost between "complete" and the first frame: no engine, poster, nothing white, never live', !a.engine && !a.live && a.posterShown && px.whiteShare < 0.2, a.log)
  check('L3: a dead context is treated as a loss, not reported as a shader error', consoleLog.length === 0, consoleLog.join(' || '))
  await restore(); const live = await untilLive(); await sleep(1200); const b = await state()
  check('L3: restored: live, one loop', live && b.engine && !b.lost && (await framesIn(1000)).loopPerFrame === 1)
}

// ================================================================= L4 - repeated loss and restoration while every rebuild is kept pending
if (on('L4')) {
  await open('hold', { waitLive: false }); await untilPending(3)
  for (let i = 0; i < 3; i++) { await lose(); await sleep(350); await restore(); await sleep(450) }
  const a = await state()
  check('L4: three losses during preparation: never half-built (no engine, poster, not live)', !a.engine && !a.live && a.posterShown, `restores ${a.restores}`)
  await release(); const live = await untilLive(); await sleep(1500); const b = await state(), f = await framesIn(1000)
  check('L4: released: exactly one engine comes up, live, one loop, one listener of each kind', live && b.engine && !b.lost && f.loopPerFrame === 1 && f.frames > 10 && b.listeners.webglcontextlost === 1 && b.listeners.webglcontextrestored === 1, `frames ${f.frames}`)
  check('L4: console clean', consoleLog.length === 0, consoleLog.join(' || '))
}

// ================================================================= Q - prepare(): the engine's optional early start (no caller uses it yet; load() calls it itself)
if (on('Q')) {
  await open('', { toStage: false })
  const q = await evaluate(`(async () => { const base = new URL(document.documentElement.innerHTML.match(new RegExp('assets.salah-[0-9a-f]+.'))[0], document.baseURI).href
    const [{ SalahRenderer }, timeline] = await Promise.all([import(base + 'engine/renderer.js'), import(base + 'engine/timeline.js')])
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 274
    let programs = 0; const cp = WebGL2RenderingContext.prototype.createProgram; WebGL2RenderingContext.prototype.createProgram = function () { if (this.canvas === canvas) programs++; return cp.call(this) }
    const r = new SalahRenderer(canvas); r.prepare(); r.prepare(); const started = programs
    await new Promise((d) => setTimeout(d, 4000)) // the scene is wanted only later
    const t0 = performance.now(); await r.load(base + 'scene/'); const loadMs = Math.round(performance.now() - t0)
    const f = r.scene.framings.desktop, px = new Uint8Array(4)
    r.render(timeline.state(timeline.loadAnchors(r.presets), 112), { rect: [f.rect[0], f.rect[1], f.rect[2] - f.rect[0], f.rect[3] - f.rect[1]], tree: f.show_tree ? 1 : 0 }, 0); r.gl.readPixels(320, 40, 1, 1, r.gl.RGBA, r.gl.UNSIGNED_BYTE, px)
    const out = { started, programs, loadMs, compile: r.stats.compile, sky: [...px], glError: r.gl.getError() }
    WebGL2RenderingContext.prototype.createProgram = cp; const lose = r.gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext()
    return out })()`)
  check('Q: prepare() starts the two programs once - a second call and load() start nothing again', q.started === 2 && q.programs === 2, `programs created ${q.programs}`)
  check('Q: prepared early, load() finds them complete (no wait), verifies them and draws a valid frame', q.compile && q.compile.parallel && q.compile.waitedMs < 100 && !q.compile.gaveUp && q.glError === 0 && q.sky[2] > 60, JSON.stringify(q))
  check('Q: console clean', consoleLog.length === 0, consoleLog.join(' || '))
}

// ================================================================= F - a browser WITHOUT the extension (hidden from the Salah canvas): the path the engine always had
if (on('F')) {
  await open('noparallel'); const f = await state(), px = await stagePixels('F_fallback_live')
  check('F: no extension: the synchronous path is used and the scene is live', f.compile && f.compile.parallel === false && f.live && f.engine && f.canvasShown, JSON.stringify(f.compile))
  check('F: no extension: "complete?" is never asked; shaders and programs are still verified', !/pending|complete/.test(f.log) && (f.log.match(/compile\?/g) || []).length === 4 && (f.log.match(/link\?/g) || []).length === 2, f.log)
  if (reference) check('F: both paths put the same picture on the stage', near(px, reference, 6), `parallel rgb ${reference.r},${reference.g},${reference.b}  fallback rgb ${px.r},${px.g},${px.b}`)
  await lose(); await sleep(800); await restore(); const live = await untilLive(); await sleep(1200)
  check('F: no extension: context loss and restoration still work; console clean', live && (await state()).engine && consoleLog.length === 0, consoleLog.join(' || '))
}

// ================================================================= E - a shader that does not compile must still be REPORTED, on both paths
for (const [k, flags] of [['E1', 'badshader'], ['E2', 'badshader&noparallel']]) if (on(k)) {
  await open(flags, { waitLive: false }); await sleep(4000); const e = await state()
  check(`${k}: broken shader (${flags.includes('noparallel') ? 'synchronous' : 'parallel'} path): the poster stays, never live, the interface works`, !e.live && !e.engine && e.failed && e.posterShown && /^(\d\d:\d\d ){5}\d\d:\d\d$/.test(e.rows))
  check(`${k}: the compile error reaches the existing error path: one warning naming the shader, no exception`, consoleLog.length === 1 && /^\[warning\].*(shader|link):/.test(consoleLog[0]), consoleLog.join(' || ').slice(0, 200))
}

// ================================================================= G - a compiler that never reports completion: the wait is bounded
if (on('G')) {
  await open('hold', { waitLive: false }); await untilPending(3)
  const t0 = Date.now(); const live = await untilLive(30000); const g = await state()
  check('G: "complete" never arrives: after the limit the engine stops waiting, asks the old way, and the scene is live', live && g.engine && g.compile.gaveUp === true && g.compile.waitedMs >= 19000 && g.compile.waitedMs < 23000, `${JSON.stringify(g.compile)} after ${Date.now() - t0} ms`)
  check('G: console clean', consoleLog.length === 0, consoleLog.join(' || '))
}

console.log(failed ? `${failed} of ${n} checks FAILED` : `all ${n} checks passed`)
ws.close(); proc.kill()
await sleep(500); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
process.exit(failed ? 1 : 0)
