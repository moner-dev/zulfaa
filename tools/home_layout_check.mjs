// Homepage - text scaling and reflow (roadmap V-02), headless Chrome, raw CDP, no npm packages:
//   node tools/home_layout_check.mjs OUTDIR [--quick]
// EN / AR / NL x 320 360 390 430 768 1024 1280 1440 1920 px, in three DIFFERENT modes that are never equated:
//   normal    the page as designed
//   zoom200   browser zoom 200 % (Ctrl +): half the CSS width at device pixel ratio 2 - only for windows of 768 px and more
//             (a phone has no browser zoom); plus WCAG 1.4.10 reflow: 320 CSS px (= 1280 px at 400 %), covered by "normal 320"
//   root200   the root font size doubled FROM THE START of the document - what a very large default font size in the browser
//             settings or a user stylesheet does to a rem-based site
// For each: horizontal overflow of the page (measured, not judged from a picture), the OUTERMOST elements that cause it, the
// Salah focus card (do its children stay inside it?), clipped controls, and every Q&A panel in turn.
// Expectation: 0 px overflow everywhere. Every host except the local preview is blocked.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ORIGIN = process.env.SALAH_ORIGIN || 'http://127.0.0.1:8081/preview/salah-release/'
const args = process.argv.slice(2), quick = args.includes('--quick')
const outDir = args.find((a) => !a.startsWith('--')) || '.'
fs.mkdirSync(outDir, { recursive: true })
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zulfaa-home-layout-'))
const proc = spawn(chrome, ['--headless=new', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1440,900', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((resolve, reject) => { let buf = ''; proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]) }); setTimeout(() => reject(new Error('chrome did not start')), 20000) })
const ws = new WebSocket(wsUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0, S = null
const pending = new Map()
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })) })
ws.onmessage = async (ev) => { const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); return }
  if (m.method === 'Fetch.requestPaused') { const u = new URL(m.params.request.url); try { if (u.protocol === 'data:' || u.protocol === 'blob:' || u.origin === new URL(ORIGIN).origin) await send('Fetch.continueRequest', { requestId: m.params.requestId }, S); else await send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' }, S) } catch {} } }
const t = (await send('Target.getTargets')).targetInfos.find((x) => x.type === 'page')
S = (await send('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId
for (const d of ['Page', 'Runtime']) await send(d + '.enable', {}, S)
await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, S)
// the doubled root font is in force before the first style is applied, as a browser setting would be
await send('Page.addScriptToEvaluateOnNewDocument', { source: `if (location.search.includes('root200')) { const add = () => { const s = document.createElement('style'); s.textContent = 'html{font-size:200% !important}'; document.documentElement.appendChild(s) }; if (document.documentElement) add(); else new MutationObserver((_, o) => { if (document.documentElement) { o.disconnect(); add() } }).observe(document, { childList: true }) }` }, S)
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const MEASURE = `(async () => {
  document.documentElement.style.scrollBehavior = 'auto'
  for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) }
  scrollTo(0, 0); await new Promise((r) => setTimeout(r, 120))
  const vw = document.documentElement.clientWidth, rtl = document.documentElement.dir === 'rtl'
  const sel = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')
  const culprits = () => { const out = []
    for (const e of document.querySelectorAll('body *')) { const r = e.getBoundingClientRect(), cs = getComputedStyle(e)
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed') continue
      const beyond = rtl ? r.left < -0.5 : r.right > vw + 0.5; if (!beyond) continue
      let clipped = false; for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p); if (/(hidden|clip|auto|scroll)/.test(o.overflowX) || o.position === 'fixed') { clipped = true; break } } // a fixed box and what it holds never widen the page
      if (!clipped) out.push([e, sel(e) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']']) }
    return out.filter(([e]) => !out.some(([o]) => o !== e && o.contains(e))).map(([, s]) => s).slice(0, 6) }
  const overflow = () => document.documentElement.scrollWidth - vw
  const out = { vw, rootFont: getComputedStyle(document.documentElement).fontSize, overflowX: overflow(), culprits: overflow() > 0 ? culprits() : [], panels: [] }
  // every Q&A panel in turn (the dial's links select them)
  for (const tab of document.querySelectorAll('.qa-node')) { tab.click(); await new Promise((r) => setTimeout(r, 40)); const o = overflow(); if (o > 0) out.panels.push(tab.getAttribute('href') + ' +' + o + 'px ' + culprits().join(' ; ')) }
  const firstTab = document.querySelector('.qa-node'); if (firstTab) firstTab.click()
  // the Salah focus card: do its children stay inside it?
  const f = document.querySelector('.salah-focus')
  if (f) { const fr = f.getBoundingClientRect(); out.salahFocus = [...f.children].filter((c) => c.offsetParent && (c.getBoundingClientRect().right > fr.right + 1 || c.getBoundingClientRect().left < fr.left - 1)).map((c) => sel(c) + ' ' + Math.round(c.getBoundingClientRect().left - fr.left) + '..' + Math.round(c.getBoundingClientRect().right - fr.left) + ' of ' + Math.round(fr.width))
    const st = document.querySelector('.salah-stage').getBoundingClientRect(); out.salahFocusInsideStage = fr.left >= st.left - 1 && fr.right <= st.right + 1 }
  // a Salah chip whose label is cut by its ellipsis. At the NORMAL text size the city chip may shorten a long city name by design (one row,
  // always); the times chip must never be cut, and with enlarged text neither may be
  out.cutChips = [...document.querySelectorAll('.salah-chip > span:not(.vh)')].filter((t) => { if (!t.offsetParent) return false; const r = document.createRange(); r.selectNodeContents(t); return r.getBoundingClientRect().width > t.getBoundingClientRect().width + 1.5 }).filter((t) => (document.documentElement.style.fontSize !== '' || getComputedStyle(document.documentElement).fontSize !== '16px' || t.closest('[data-salah-open=times]'))).map((t) => t.textContent.trim().slice(0, 16))
  // controls whose own text is cut off (the city chip shortens with an ellipsis by design and is reported separately)
  out.clipped = [...document.querySelectorAll('a, button')].filter((e) => e.offsetParent && !e.closest('.salah-chip') && !e.classList.contains('salah-chip') && getComputedStyle(e).overflow !== 'visible' && e.scrollWidth > e.clientWidth + 1 && e.textContent.trim()).map((e) => sel(e) + ' "' + e.textContent.trim().slice(0, 20) + '"').slice(0, 5)
  return out })()`

const WIDTHS = quick ? [390, 1024, 1440] : [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]
const results = [], lines = []
let failed = 0, n = 0
for (const [target, lang] of [['', 'en'], ['ar/', 'ar'], ['nl/', 'nl']]) for (const w of WIDTHS) for (const mode of ['normal', 'zoom200', 'root200']) {
  if (mode === 'zoom200' && w < 768) continue
  const cssW = mode === 'zoom200' ? Math.round(w / 2) : w, h = w < 700 ? 844 : 900, cssH = mode === 'zoom200' ? Math.round(h / 2) : h
  await send('Emulation.setDeviceMetricsOverride', { width: cssW, height: cssH, deviceScaleFactor: mode === 'zoom200' ? 2 : w < 700 ? 2 : 1, mobile: cssW < 700 }, S)
  await send('Page.navigate', { url: 'about:blank' }, S)
  await send('Page.navigate', { url: ORIGIN + target + (mode === 'root200' ? '?root200' : '') }, S)
  for (let i = 0; i < 120; i++) { if (await evaluate(`document.readyState === 'complete'`).catch(() => false)) break; await sleep(100) }
  await sleep(700)
  const r = await evaluate(MEASURE)
  const ok = r.overflowX <= 0 && r.panels.length === 0 && (!r.salahFocus || r.salahFocus.length === 0) && r.salahFocusInsideStage !== false && r.clipped.length === 0 && r.cutChips.length === 0
  n++; if (!ok) failed++
  results.push({ lang, width: w, mode, cssWidth: cssW, ...r, ok })
  const line = `${ok ? 'ok  ' : 'FAIL'} ${lang} ${String(w).padStart(4)} ${mode.padEnd(8)} overflowX ${String(r.overflowX).padStart(4)} px${r.culprits.length ? ' | ' + r.culprits.join(' ; ') : ''}${r.panels.length ? ' | Q&A: ' + r.panels.join(' ;; ') : ''}${r.salahFocus && r.salahFocus.length ? ' | Salah focus card: ' + r.salahFocus.join(' ; ') : ''}${r.clipped.length ? ' | clipped: ' + r.clipped.join(' ; ') : ''}${r.cutChips.length ? ' | Salah chip label cut: ' + r.cutChips.join(' ; ') : ''}`.replace(/[^ -~]/g, '?').slice(0, 420)
  lines.push(line); console.log(line)
  if (!ok || (mode === 'root200' && [390, 1024, 1440].includes(w) && lang !== 'nl')) { await evaluate(`scrollTo(0, document.documentElement.scrollHeight)`); await sleep(250); const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 60 }, S); fs.writeFileSync(path.join(outDir, `${lang}_${w}_${mode}_footer.jpg`), Buffer.from(data, 'base64')) }
}
const verdict = failed ? `${failed} of ${n} scenarios FAILED` : `all ${n} scenarios passed`
lines.push(verdict); console.log(verdict)
fs.writeFileSync(path.join(outDir, 'home_layout_check.txt'), lines.join('\n') + '\n'); fs.writeFileSync(path.join(outDir, 'home_layout_check.json'), JSON.stringify(results, null, 1))
ws.close(); proc.kill(); await sleep(500); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
process.exit(failed ? 1 : 0)
