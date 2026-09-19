// GPU time of the scene in the homepage section (median of the WebGL timer over forced frames):   node tools/salah_perf.mjs [label]
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

const label = process.argv[2] || ''
const measure = () => evaluate(`new Promise((done) => { const a = __salahSection; const hold = setInterval(() => (a.dirty = true), 4); const g = []; let n = 0;
  const f = () => { const s = a.engine.renderer.stats; if (s.gpuMs != null) g.push(s.gpuMs); if (++n < 360) requestAnimationFrame(f); else { clearInterval(hold); g.sort((x, y) => x - y); done({ canvas: a.engine.renderer.canvas.width + 'x' + a.engine.renderer.canvas.height, median: +g[Math.floor(g.length / 2)].toFixed(2), p95: +g[Math.floor(g.length * 0.95)].toFixed(2), scale: a.scale }) } }; requestAnimationFrame(f) })`)
for (const [w, h, t] of [[1920, 1080, '19:40'], [1920, 1080, '13:40'], [390, 844, '19:40']]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: w < 700 ? 2 : 1, mobile: w < 700 }, S)
  await open('?salah-dev=quiet&city=amsterdam&t=' + t)
  await toSection()
  await evaluate(`document.querySelectorAll('.salah-panel:not([hidden]) [data-salah-close]').forEach((b) => b.click())`)
  await measure()
  console.log(label.padEnd(4), w + ' ' + t, JSON.stringify(await measure()))
}
ws.close(); proc.kill(); process.exit(0)
