// Release check for the homepage Salah section, as a visitor of the PUBLISHED site sees it (raw CDP, no npm packages).
//
//   node tools/salah_release_check.mjs OUTDIR --rehearse   the browser opens https://zulfaa.nl/... but every request to that
//                                                          host is answered from the LOCAL release tree (SALAH_ORIGIN, default
//                                                          the /preview/salah-release/ mount). Nothing reaches the real site.
//   node tools/salah_release_check.mjs OUTDIR --live       the real site.
// In BOTH modes every other host (analytics, contact, anything third-party) is blocked and listed, so the check never
// creates production records. It proves: the three homepages load, the section sits right after the showcase, every
// request answers 200, the scene goes live from ONE versioned runtime folder, no DEV tool can be switched on by an
// address, the page keeps no debug handle, and the console stays clean.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const SITE = 'https://zulfaa.nl/'
const LOCAL = process.env.SALAH_ORIGIN || 'http://127.0.0.1:8081/preview/salah-release/'
const args = process.argv.slice(2)
const live = args.includes('--live')
if (!live && !args.includes('--rehearse')) { console.error('say --rehearse or --live'); process.exit(2) }
const outDir = args.find((a) => !a.startsWith('--')) || '.'
fs.mkdirSync(outDir, { recursive: true })

const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zulfaa-salah-release-'))
const proc = spawn(chrome, ['--headless=new', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1440,900', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'],
{ stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((resolve, reject) => {
  let buf = ''
  proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]) })
  setTimeout(() => reject(new Error('chrome did not start')), 20000)
})
const ws = new WebSocket(wsUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0, S = null
const pending = new Map()
let run = null // per-page collectors
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq
  pending.set(id, { res, rej })
  ws.send(JSON.stringify({ id, method, params, sessionId }))
})
ws.onmessage = async (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); return }
  if (!run) return
  if (m.method === 'Fetch.requestPaused') {
    const { requestId, request } = m.params
    const u = new URL(request.url)
    try {
      if (u.protocol === 'data:' || u.protocol === 'blob:') return void (await send('Fetch.continueRequest', { requestId }, S))
      if (u.origin + '/' !== SITE) { run.blocked.add(u.origin); return void (await send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }, S)) }
      if (live) return void (await send('Fetch.continueRequest', { requestId }, S))
      let p = u.pathname.slice(1)
      if (p === '' || p.endsWith('/')) p += 'index.html'
      const r = await fetch(LOCAL + p)
      const body = Buffer.from(await r.arrayBuffer())
      run.served.push([r.status, u.pathname])
      await send('Fetch.fulfillRequest', { requestId, responseCode: r.status, responseHeaders: [{ name: 'content-type', value: r.headers.get('content-type') || 'application/octet-stream' }], body: body.toString('base64') }, S)
    } catch (error) { run.notes.push('intercept: ' + error.message) }
  } else if (m.method === 'Network.responseReceived') {
    const r = m.params.response
    if (r.url.startsWith(SITE)) run.responses.push([r.status, new URL(r.url).pathname + new URL(r.url).search, r.mimeType, r.headers['cache-control'] || r.headers['Cache-Control'] || ''])
  } else if (m.method === 'Network.loadingFailed') {
    if (m.params.errorText !== 'net::ERR_BLOCKED_BY_CLIENT') run.notes.push('failed: ' + m.params.errorText + ' ' + (m.params.type || ''))
  } else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) run.console.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300))
  else if (m.method === 'Runtime.exceptionThrown') run.console.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300))
  else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/ERR_BLOCKED_BY_CLIENT/.test(m.params.entry.text)) run.console.push('[log] ' + m.params.entry.text.slice(0, 300) + ' ' + (m.params.entry.url || ''))
}
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
S = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId
for (const d of ['Page', 'Runtime', 'Network', 'Log']) await send(d + '.enable', {}, S)
await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, S)
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, S)
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S)
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  - ' + detail : ''}`) }

for (const [label, target] of [['en', ''], ['ar', 'ar/'], ['nl', 'nl/'], ['en-dev-address', '?salah-dev&t=19:40&city=makkah'], ['ar-dev-address', 'ar/?salah-dev=quiet&t=03:00&city=jakarta']]) {
  run = { responses: [], served: [], blocked: new Set(), console: [], notes: [] }
  await send('Page.navigate', { url: 'about:blank' }, S)
  await send('Page.navigate', { url: SITE + target }, S)
  let ready = false
  for (let i = 0; i < 150 && !ready; i++) { ready = await evaluate(`!!document.querySelector('[data-salah-ui]') && !document.querySelector('[data-salah-ui]').hidden`).catch(() => false); if (!ready) await sleep(100) }
  await evaluate(`(() => { document.documentElement.style.scrollBehavior = 'auto'; const s = document.querySelector('.salah-stage'); if (s) s.scrollIntoView({ block: 'center' }) })()`)
  let isLive = false
  for (let i = 0; i < 200 && !isLive; i++) { isLive = await evaluate(`!!document.querySelector('.salah.is-live')`); if (!isLive) await sleep(100) }
  await sleep(2600)
  const info = await evaluate(`(() => { const q = (s) => document.querySelector(s), root = q('[data-salah]'); if (!root) return null
    const prev = root.previousElementSibling, sc = q('section.showcase'), order = [...document.querySelectorAll('main section, main > div > section')].map((s) => s.className.split(' ')[0])
    const canvas = q('[data-salah-canvas]'), gl = canvas && (canvas.getContext('webgl2'))
    return { lang: document.documentElement.lang, dir: document.documentElement.dir, order, afterShowcase: !!sc && (sc.compareDocumentPosition(root) & 4) === 4 && order[order.indexOf('showcase') + 1] === 'salah',
      assets: root.dataset.assets, entry: [...document.scripts].map((s) => s.getAttribute('src') || '').find((s) => /salah-section/.test(s)), css: [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.getAttribute('href')).find((h) => /salah\\.css/.test(h)),
      uiShown: !q('[data-salah-ui]').hidden, name: q('[data-salah-text=name]').textContent, time: q('[data-salah-text=time]').textContent, countdown: q('[data-salah-text=countdown]').textContent.trim(), place: q('[data-salah-text=place]').textContent.trim(),
      rows: [...document.querySelectorAll('[data-salah-time]')].map((t) => t.textContent).join(' '), canvas: canvas ? canvas.width + 'x' + canvas.height : null, webgl: !!gl,
      devPanel: !!q('.salah-dev, [data-salah-dev]'), handle: typeof window.__salahSection, overflowX: document.documentElement.scrollWidth - innerWidth,
      phase: root.dataset.phase, stored: (() => { try { return localStorage.getItem('zulfaa-salah-place') } catch { return 'n/a' } })() } })()`)
  const tag = (live ? 'live ' : 'rehearsal ') + label
  if (!info) { check(tag + ': the Salah section is in the page', false); continue }
  const bad = run.responses.filter(([s]) => s >= 400)
  const rt = info.assets.replace(/^(\.\.\/)*/, '')
  const salahReq = run.responses.filter(([, p]) => /\/assets\/salah/.test(p))
  const outside = salahReq.filter(([, p]) => !p.startsWith('/' + rt))
  check(tag + ': the section comes right after the showcase', info.afterShowcase, info.order.join(' > '))
  check(tag + ': language and direction', info.lang === label.slice(0, 2) && (label.startsWith('ar') ? info.dir === 'rtl' : info.dir !== 'rtl'), info.lang + ' ' + (info.dir || '(default ltr)'))
  check(tag + ': interface shown with real times', info.uiShown && /^\d\d:\d\d$/.test(info.time) && /^(\d\d:\d\d ){5}\d\d:\d\d$/.test(info.rows), `${info.name} ${info.time} | ${info.countdown} | ${info.place} | ${info.rows}`)
  check(tag + ': the scene is live (WebGL2)', isLive && info.webgl, 'canvas ' + info.canvas + ', phase ' + info.phase)
  check(tag + ': every request answered 200', bad.length === 0, bad.length ? bad.map((b) => b.join(' ')).join(' | ') : run.responses.length + ' responses')
  check(tag + ': every Salah file comes from ONE versioned folder', /^assets\/salah-[0-9a-f]{10}\/$/.test(rt) && outside.length === 0 && salahReq.length >= 20, rt + ' - ' + salahReq.length + ' files' + (outside.length ? ', OUTSIDE: ' + outside.map((o) => o[1]).join(' ') : ''))
  check(tag + ': birds-v3 and Water v3 modules were loaded', ['engine/birds.js', 'engine/shaders.js', 'engine/water.js', 'engine/renderer.js', 'engine/timeline.js'].every((f) => salahReq.some(([, p]) => p === '/' + rt + f)))
  check(tag + ': no DEV tool, no debug handle, no salah-dev.js request', !info.devPanel && info.handle === 'undefined' && !run.responses.some(([, p]) => /salah-dev.js/.test(p)), 'handle ' + info.handle + ', dev panel ' + info.devPanel)
  check(tag + ': an address cannot set the time or the place', !/makkah|jakarta/i.test(info.place) && info.stored === null, info.place + ', stored ' + info.stored)
  check(tag + ': no horizontal overflow at 1440', info.overflowX <= 0, String(info.overflowX))
  check(tag + ': console clean', run.console.length === 0, run.console.join(' || '))
  if (run.notes.length) console.log('     notes:', [...new Set(run.notes)].join(' | '))
  console.log('     blocked hosts (never contacted):', [...run.blocked].join(', ') || 'none')
  if (live) console.log('     cache-control of the entry module:', (run.responses.find(([, p]) => /salah-section\.js/.test(p)) || [])[3])
  const clip = await evaluate(`(() => { const s = document.querySelector('.salah').getBoundingClientRect(); return { x: 0, y: Math.max(0, s.top + scrollY - 10), width: innerWidth, height: Math.min(s.height + 20, 1100) } })()`)
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true }, S)
  fs.writeFileSync(path.join(outDir, `${live ? 'live' : 'rehearsal'}_${label}.png`), Buffer.from(data, 'base64'))
  fs.writeFileSync(path.join(outDir, `${live ? 'live' : 'rehearsal'}_${label}_requests.txt`), run.responses.map((r) => r.join('\t')).join('\n') + '\n')
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed')
ws.close()
proc.kill()
process.exit(failed ? 1 : 0)
