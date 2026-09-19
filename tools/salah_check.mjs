// Review tool for the homepage Salah section: opens the LOCAL site in headless Chrome (raw CDP, no npm packages),
// scrolls to the section, waits for the scene, and saves a screenshot of the section (canvas + HTML overlay together).
//
//   node tools/salah_check.mjs OUTDIR  SHOT [SHOT...]
//   SHOT = name|path?query|WIDTHxHEIGHT[|open=times|places][|rm]      e.g.  "maghrib|?salah-dev&t=19:40|1440x900"
//   open=... makes sure that panel is open; `closed` closes whatever is open (today's times rest open on tablet / desktop).
//   birds=172 pins the scene clock near that second with bird seed 0, so a known flight is in the air (test-side only; the
//   page's own code is not changed). The info line reports how many birds the engine drew.
//   path is relative to the preview mount: "" (English), "ar/", "nl/".   rm = emulate prefers-reduced-motion.
// Prints the shared timing model for every shot, so functional checks and pictures come from the same run.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ORIGIN = process.env.SALAH_ORIGIN || 'http://127.0.0.1:8081/preview/salah-site/' // the local preview mount to test (another mount of the same origin may be named)
const [outDir, ...shots] = process.argv.slice(2)
fs.mkdirSync(outDir, { recursive: true })
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zulfaa-salah-site-'))
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
let seq = 0
const pending = new Map(), logs = []
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result) }
  else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
  else if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text))
}
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq
  pending.set(id, { res, rej })
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`${method} timed out`)) } }, 60000)
  ws.send(JSON.stringify({ id, method, params, sessionId }))
})
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId: S } = await send('Target.attachToTarget', { targetId, flatten: true })
for (const d of ['Page', 'Runtime']) await send(d + '.enable', {}, S)
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S)
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let code = 0
for (const shot of shots) {
  const [name, target, size, ...flags] = shot.split('|')
  const [w, h] = size.split('x').map(Number)
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: w < 700 ? 2 : 1, mobile: w < 700 }, S)
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: flags.includes('rm') ? 'reduce' : 'no-preference' }] }, S)
    await send('Page.navigate', { url: 'about:blank' }, S)
    await send('Page.navigate', { url: ORIGIN + target }, S)
    const t0 = Date.now()
    for (;;) {
      const st = await evaluate(`(() => { const a = window.__salahSection; if (!a || !a.model) return null; document.documentElement.style.scrollBehavior = 'auto';
        const el = document.querySelector('.salah-stage'); el.scrollIntoView({ block: 'center' }); return { live: !!a.engine, failed: !!a.engineFailed && !a.engine } })()`)
      if (st && (st.live || (st.failed && Date.now() - t0 > 6000))) break
      if (Date.now() - t0 > 30000) throw new Error('section did not become ready')
      await sleep(200)
    }
    const birds = flags.find((f) => f.startsWith('birds='))
    if (birds) await evaluate(`(() => { const r = window.__salahSection.engine && window.__salahSection.engine.renderer; if (!r) return; r.birdSeed = 0; const draw = r.render.bind(r);
      r.render = (st, framing, t) => draw(st, framing, t > 0 ? ${Number(birds.slice(6))} + (t % 1) : t) })()`)
    await sleep(2300) // reveal + canvas fade
    const open = flags.find((f) => f.startsWith('open='))
    if (open) { await evaluate(`(() => { const n = ${JSON.stringify(open.slice(5))}; if (document.querySelector('[data-salah-panel="' + n + '"]').hidden) document.querySelector('[data-salah-open="' + n + '"]').click() })()`); await sleep(300) }
    if (flags.includes('closed')) { await evaluate(`document.querySelectorAll('.salah-panel:not([hidden]) [data-salah-close]').forEach((b) => b.click())`); await sleep(300) }
    const info = await evaluate(`(() => { const a = window.__salahSection, m = a.model, r = document.querySelector('.salah').getBoundingClientRect(), s = document.querySelector('.salah-stage').getBoundingClientRect();
      const ui = document.querySelector('.salah-focus').getBoundingClientRect(); const f = (x) => { x = Math.round(x); x = ((x % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0') };
      const u = [...document.querySelectorAll('.salah-focus, .salah-panel:not([hidden])')].reduce((b, e) => Math.max(b, e.getBoundingClientRect().bottom), s.bottom);
      return { clip: { x: 0, y: Math.max(0, s.top + scrollY - 20), width: innerWidth, height: u - s.top + 40 }, stage: [Math.round(s.width), Math.round(s.height)], focusBox: [Math.round(ui.left - s.left), Math.round(ui.top - s.top), Math.round(ui.width), Math.round(ui.height)],
        overflowX: document.documentElement.scrollWidth - innerWidth, dir: document.documentElement.dir, lang: document.documentElement.lang,
        place: m.place.name.en + ' [' + m.place.source + ']', clock: f(m.clock.minutes), phase: m.visualState, status: m.status, current: m.currentPrayer, next: m.nextPrayer.id + (m.nextPrayer.tomorrow ? ' (tomorrow)' : '') + ' ' + f(m.nextPrayer.at) + ' in ' + Math.round(m.nextPrayer.inMinutes) + ' min',
        frame: +m.scene.frame.toFixed(1), line: +m.dayLine.position.toFixed(3), engine: a.engine ? a.engine.renderer.canvas.width + 'x' + a.engine.renderer.canvas.height : 'poster', birds: a.engine ? a.engine.renderer.stats.birds : 0,
        times: (() => { const p = document.querySelector('#salah-times'); return p.hidden ? 'closed' : 'open' + (p.scrollHeight > p.clientHeight + 1 ? ' CUT' : '') + ' ' + Math.round(100 * p.offsetHeight / s.height) + '% of stage height' })(),
        chips: [...document.querySelectorAll('.salah-chip')].map((c) => { const t = c.querySelector('span:not(.vh)'); return c.offsetWidth + (t.scrollWidth > t.clientWidth ? ' CUT' : '') }).join(' + ') + ' in ' + document.querySelector('.salah-actions').clientWidth,
        text: [...document.querySelectorAll('.salah-focus [data-salah-text]')].map((e) => e.textContent.trim()).join(' | ') } })()`)
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { ...info.clip, scale: 1 }, captureBeyondViewport: true }, S)
    fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(data, 'base64'))
    delete info.clip
    console.log(name.padEnd(22), JSON.stringify(info))
  } catch (error) { console.error(name, 'FAILED:', error.message); code = 1 }
}
for (const l of [...new Set(logs)]) console.log('  page', l)
ws.close()
proc.kill()
process.exit(code)
