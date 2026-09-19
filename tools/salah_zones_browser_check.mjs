// Salah section - the time-zone first guess IN A BROWSER (headless Chrome, raw CDP, no npm packages):
//   node tools/salah_zones_browser_check.mjs OUTDIR
// Chrome's real time zone is overridden per case (Emulation.setTimezoneOverride), so the page sees exactly what a visitor's
// browser would report - including Chrome's legacy names (India = Asia/Calcutta). Runs against the LOCAL preview
// (SALAH_ORIGIN, default the /preview/salah-release/ mount); the DEV handle window.__salahSection exists only there.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ORIGIN = process.env.SALAH_ORIGIN || 'http://127.0.0.1:8081/preview/salah-release/'
const outDir = process.argv[2] || '.'
fs.mkdirSync(outDir, { recursive: true })
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zulfaa-salah-zones-'))
const proc = spawn(chrome, ['--headless=new', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1440,900', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((resolve, reject) => { let buf = ''; proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]) }); setTimeout(() => reject(new Error('chrome did not start')), 20000) })
const ws = new WebSocket(wsUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0, S = null
const pending = new Map()
let requests = [], consoleLog = [], geoPrompts = 0
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })) })
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); return }
  if (m.method === 'Network.responseReceived') requests.push([m.params.response.status, m.params.response.url, m.params.response.encodedDataLength])
  else if (m.method === 'Network.loadingFinished') { const r = requests.find((x) => x[3] === undefined && x.id === m.params.requestId); if (r) r[3] = m.params.encodedDataLength }
  else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) consoleLog.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
  else if (m.method === 'Runtime.exceptionThrown') consoleLog.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 200))
}
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
S = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId
for (const d of ['Page', 'Runtime', 'Network']) await send(d + '.enable', {}, S)
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__geoCalls = 0; for (const k of ['getCurrentPosition', 'watchPosition']) { const o = Geolocation.prototype[k]; Geolocation.prototype[k] = function (...a) { window.__geoCalls++; return o.apply(this, a) } }` }, S)
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0, n = 0
const ascii = (s) => String(s).replace(/[^ -~]/g, '?')
const check = (name, ok, detail = '') => { n++; if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  - ' + ascii(detail).slice(0, 230) : ''}`) }

async function open(tz, target = '', w = 1440, h = 900, { reduced = false, clear = true } = {}) {
  const mobile = w < 700
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile }, S)
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] }, S)
  await send('Emulation.setTimezoneOverride', { timezoneId: tz }, S)
  await send('Page.navigate', { url: 'about:blank' }, S)
  if (clear) { await send('Page.navigate', { url: ORIGIN }, S); await sleep(300); await evaluate(`localStorage.clear()`); await send('Page.navigate', { url: 'about:blank' }, S) }
  requests = []; consoleLog = [] // count only the page under test, not the visit that cleared the storage
  await send('Page.navigate', { url: ORIGIN + target }, S)
  for (let i = 0; i < 150; i++) { if (await evaluate(`!!(window.__salahSection && window.__salahSection.model)`).catch(() => false)) break; await sleep(100) }
  await evaluate(`(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('.salah-stage').scrollIntoView({ block: 'center' }) })()`)
  await sleep(500)
}
const read = () => evaluate(`(() => { const a = window.__salahSection, p = a.place, q = (s) => document.querySelector(s), vis = (e) => !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0 && !e.closest('[hidden]')
  const st = q('.salah-stage').getBoundingClientRect(), f = q('.salah-focus').getBoundingClientRect()
  return { reported: Intl.DateTimeFormat().resolvedOptions().timeZone, source: p.source, id: p.id, zone: p.zone || null, lat: p.lat, lon: p.lon, unknown: !!p.unknown, dataPlace: q('.salah').dataset.place,
    chip: q('[data-salah-text=place]').textContent.trim(), status: q('[data-salah-text=status]').textContent.trim(), name: q('[data-salah-text=name]').textContent.trim(), help: q('[data-salah-text=countdown]').textContent.trim(),
    clockVisible: vis(q('.salah-time')), lineVisible: vis(q('.salah-line')), timesChipVisible: vis(q('[data-salah-open=times]')), timesPanelOpen: !q('#salah-times').hidden, title: q('[data-salah-text=timesTitle]').textContent.trim(),
    rows: [...document.querySelectorAll('[data-salah-time]')].map((t) => t.textContent).join(' '), focusTime: q('[data-salah-text=time]').textContent, note: q('[data-salah-text=placeSource]').textContent.trim(),
    modelUnknown: !!a.model.unknownPlace, frame: +a.model.scene.frame.toFixed(2), phase: q('.salah').dataset.phase, modelTimes: ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => Math.round(a.model.times[k])),
    overflowX: document.documentElement.scrollWidth - innerWidth, focusInside: f.left >= st.left - 1 && f.right <= st.right + 1, chipCut: [...document.querySelectorAll('.salah-chip span:not(.vh)')].some((t) => t.offsetParent && t.scrollWidth > t.clientWidth + 1),
    helpCut: q('[data-salah-text=countdown]').scrollWidth > q('[data-salah-text=countdown]').clientWidth + 1, geo: window.__geoCalls, announce: q('[data-salah-text=announce]').textContent.trim() } })()`)
const shot = async (name) => { for (let i = 0; i < 100 && !(await evaluate(`!!document.querySelector('.salah.is-live')`)); i++) await sleep(100); await sleep(2600); /* the reveal and the canvas fade are over */ const clip = await evaluate(`(() => { const s = document.querySelector('.salah-stage').getBoundingClientRect(); const u = [...document.querySelectorAll('.salah-focus, .salah-panel:not([hidden])')].reduce((b, e) => Math.max(b, e.getBoundingClientRect().bottom), s.bottom); return { x: 0, y: Math.max(0, s.top + scrollY - 16), width: innerWidth, height: u - s.top + 32 } })()`); const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true }, S); fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(data, 'base64')) }
const hhmmToMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))

// ---------------------------------------------------------------- 1. what each visitor's zone gives now
console.log('zone set in Chrome'.padEnd(22), 'Chrome reports'.padEnd(20), 'chip'.padEnd(14), 'source'.padEnd(10), 'lat'.padStart(7), 'lon'.padStart(8), '  F S D A M I')
const expect = { 'Europe/Amsterdam': 'amsterdam', 'Europe/Istanbul': 'istanbul', 'Africa/Khartoum': 'khartoum', 'America/Toronto': 'toronto', 'America/New_York': 'new-york', 'Asia/Damascus': 'damascus', 'Asia/Beirut': 'beirut', 'Asia/Kolkata': 'delhi',
  'Asia/Singapore': [1.28, 103.85], 'Europe/Zurich': [47.38, 8.53], 'America/Vancouver': [49.27, -123.12], 'Africa/Nairobi': [-1.28, 36.82], 'Asia/Kathmandu': [27.72, 85.32], 'Asia/Makassar': [-5.12, 119.4], 'Pacific/Auckland': [-36.87, 174.77], 'America/Sao_Paulo': [-23.53, -46.62] }
const generic = []
for (const [tz, want] of Object.entries(expect)) {
  await open(tz)
  const r = await read()
  console.log(tz.padEnd(22), r.reported.padEnd(20), ascii(r.chip).padEnd(14), r.source.padEnd(10), String(r.lat).padStart(7), String(r.lon).padStart(8), ' ', r.rows)
  const ok = typeof want === 'string' ? r.id === want : r.id === null && !r.unknown && Math.abs(r.lat - want[0]) < 0.02 && Math.abs(r.lon - want[1]) < 0.02
  check(`${tz}: ${typeof want === 'string' ? 'the listed city ' + want : 'the tz database place'} - real coordinates, times shown, marked as a guess`, ok && r.source === 'timezone' && r.dataPlace === 'known' && /^(\d\d:\d\d ){5}\d\d:\d\d$/.test(r.rows) && r.lat !== 30, `${r.chip} | ${r.title} | ${r.note}`)
  if (r.lat === 30) generic.push(tz)
  // one model for both layers: the rows on screen ARE the model that produced the scene frame
  check(`${tz}: the schedule on screen equals the model that drives the scene`, r.rows.split(' ').every((t, i) => Math.abs(((hhmmToMin(t) - r.modelTimes[i]) % 1440 + 1440) % 1440) <= 1 || Math.abs(((hhmmToMin(t) - r.modelTimes[i]) % 1440 + 1440) % 1440) >= 1439) && !r.modelUnknown, `frame ${r.frame}, phase ${r.phase}`)
}
check('no zone received the old generic latitude-30 place', generic.length === 0, generic.join(', '))

// ---------------------------------------------------------------- 2. the zone table is only downloaded by the visitors who need it
await open('Europe/Amsterdam')
check('Amsterdam (a listed zone): zones.json is NOT downloaded', !requests.some((r) => /zones\.json/.test(r[1])), `${requests.filter((r) => /assets\/salah-/.test(r[1])).length} Salah requests`)
await open('Europe/Zurich')
const zr = requests.filter((r) => /zones\.json/.test(r[1]))
check('Zurich (an unlisted zone): zones.json is downloaded once, 200', zr.length === 1 && zr[0][0] === 200, zr.map((r) => r[0] + ' ' + r[1].split('/').slice(-2).join('/')).join(' '))

// ---------------------------------------------------------------- 3. UNKNOWN: a zone the tz database cannot place
for (const tz of ['UTC', 'Etc/GMT-5']) {
  await open(tz)
  const r = await read()
  check(`${tz}: unknown place - no coordinates, no city name, the model is marked`, r.unknown && r.source === 'unknown' && r.lat === undefined && r.dataPlace === 'unknown' && r.modelUnknown, `chip "${r.chip}" status "${r.status}" name "${r.name}"`)
  check(`${tz}: NO times anywhere - clock, day line and schedule chip are gone, every row reads --:--, the schedule is closed`, !r.clockVisible && !r.lineVisible && !r.timesChipVisible && !r.timesPanelOpen && r.focusTime === '--:--' && /^(--:-- ){5}--:--$/.test(r.rows), r.rows)
  check(`${tz}: the glass asks for a city in words, and says so to a screen reader once`, r.name.length > 3 && r.help.length > 20 && r.announce.includes(r.name), `${r.name} / ${r.help}`)
  check(`${tz}: the picture still follows the visitor's clock (scene frame set, phase set), nothing overflows, no location prompt`, Number.isFinite(r.frame) && !!r.phase && r.overflowX <= 0 && r.focusInside && !r.helpCut && r.geo === 0, `frame ${r.frame} phase ${r.phase}`)
}
await open('UTC')
await shot('unknown_desktop_en')
await evaluate(`document.querySelector('[data-salah-open=times]').click()`); await sleep(300)
check('unknown: the schedule cannot be opened, not even by script', await evaluate(`document.getElementById('salah-times').hidden`))
await evaluate(`document.querySelector('[data-salah-open=places]').click()`); await sleep(500)
const pk = await evaluate(`({ open: !document.getElementById('salah-places').hidden, focus: document.activeElement === document.querySelector('[data-salah-search]'), cities: document.querySelectorAll('[data-salah-cities] button').length, note: document.querySelector('[data-salah-text=placeSource]').textContent.trim(), current: document.querySelectorAll('[data-salah-cities] [aria-current]').length })`)
check('unknown: the city chip opens the existing picker, focus in the search field, every city offered, none pre-selected', pk.open && pk.focus && pk.cities >= 40 && pk.current === 0, `${pk.cities} cities | ${pk.note}`)
await shot('unknown_desktop_en_picker')
await evaluate(`[...document.querySelectorAll('[data-salah-cities] button')].find((b) => b.dataset.city === 'istanbul').click()`); await sleep(900)
let r = await read()
check('unknown -> choose Istanbul: everything returns together (chip, clock, day line, schedule open, real times, model known)', r.id === 'istanbul' && r.source === 'chosen' && r.dataPlace === 'known' && r.clockVisible && r.lineVisible && r.timesChipVisible && r.timesPanelOpen && /^(\d\d:\d\d ){5}\d\d:\d\d$/.test(r.rows) && !r.modelUnknown && /Istanbul/.test(r.title), `${r.title} | ${r.rows}`)
check('a chosen city reads "Today in", a guess reads "Today near"', /^Today in /.test(r.title), r.title)
await open('UTC', '', 1440, 900, { clear: false })
r = await read()
check('the chosen city survives a reload although the zone is unknown', r.id === 'istanbul' && r.dataPlace === 'known', r.chip)
await evaluate(`document.querySelector('[data-salah-open=places]').click()`); await sleep(300)
await evaluate(`document.querySelector('[data-salah-timezone]').click()`); await sleep(700)
r = await read()
check('"use my time zone" from a chosen city returns to the honest unknown state, not to a made-up place', r.unknown && r.dataPlace === 'unknown' && !r.clockVisible && !r.timesPanelOpen && (await evaluate(`localStorage.getItem('zulfaa-salah-place')`)) === null)

// ---------------------------------------------------------------- 4. three languages, three device sizes, reduced motion
for (const [target, lang] of [['', 'en'], ['ar/', 'ar'], ['nl/', 'nl']]) for (const [w, h, dev] of [[1440, 900, 'desktop'], [820, 1180, 'tablet'], [390, 844, 'phone']]) {
  await open('UTC', target, w, h)
  let u = await read()
  await shot(`unknown_${dev}_${lang}`)
  check(`unknown ${lang} ${dev}: state shown, no overflow, glass inside the stage, nothing cut, console clean`, u.dataPlace === 'unknown' && u.overflowX <= 0 && u.focusInside && !u.chipCut && !u.helpCut && consoleLog.length === 0, `${u.name} | chip ${u.chip}${consoleLog.length ? ' | ' + consoleLog.join(' ') : ''}`)
  await open('Asia/Singapore', target, w, h)
  u = await read()
  if (dev === 'desktop') await shot(`singapore_${dev}_${lang}`)
  check(`Singapore ${lang} ${dev}: place, times and approximate title shown, no overflow, nothing cut`, u.id === null && !u.unknown && Math.abs(u.lat - 1.28) < 0.02 && u.overflowX <= 0 && u.focusInside && !u.chipCut && consoleLog.length === 0, `${u.chip} | ${u.title}`)
}
await open('UTC', '', 1440, 900, { reduced: true })
r = await read()
const frames = await evaluate(`new Promise((done) => { const a = window.__salahSection; const f0 = a.engine ? a.engine.renderer.stats.frames : 0; setTimeout(() => done((a.engine ? a.engine.renderer.stats.frames : 0) - f0), 2500) })`)
check('reduced motion + unknown place: the state is shown and the scene stays a still picture', r.dataPlace === 'unknown' && frames <= 1, `${frames} frames in 2.5 s`)
check('no page in this run ever called the Geolocation API', r.geo === 0)

console.log(failed ? `\n${failed} of ${n} checks FAILED` : `\nall ${n} checks passed`)
ws.close(); proc.kill(); process.exit(failed ? 1 : 0)
