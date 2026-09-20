// Homepage maintenance (audit H-06 .. H-09) and the homepage behaviours that must not regress, headless Chrome, raw CDP:
//   node tools/home_maintenance_check.mjs OUTDIR
// H-06  /#features lands BELOW the sticky header (direct, reload, in-page) - EN / AR / NL x desktop / tablet / phone
// H-07  the three homepages carry the same set of metadata, each in its own language; canonical and hreflang intact
// H-08  no <img> without a source; the lightbox still opens, shows the real picture, closes with Escape, returns focus
// H-09  "Skip to content": first stop of the Tab key, invisible until focused, moves focus into the content
// plus: navigation, language menu, theme switch, carousel, contact-form validation STATE (the submit button is never pressed -
// a submission can hand over to a mail client; every host except the local preview is blocked anyway).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ORIGIN = process.env.SALAH_ORIGIN || 'http://127.0.0.1:8081/preview/salah-release/'
const outDir = process.argv[2] || '.'
fs.mkdirSync(outDir, { recursive: true })
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zulfaa-home-maint-'))
const proc = spawn(chrome, ['--headless=new', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1440,900', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((resolve, reject) => { let buf = ''; proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) resolve(m[1]) }); setTimeout(() => reject(new Error('chrome did not start')), 20000) })
const ws = new WebSocket(wsUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0, S = null, consoleLog = [], requests = []
const pending = new Map(), blocked = new Set()
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })) })
ws.onmessage = async (ev) => { const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); return }
  if (m.method === 'Fetch.requestPaused') { const u = new URL(m.params.request.url); requests.push(m.params.request.url.slice(0, 80)); try { if (u.protocol === 'data:' || u.protocol === 'blob:' || u.origin === new URL(ORIGIN).origin) await send('Fetch.continueRequest', { requestId: m.params.requestId }, S); else { blocked.add(u.origin); await send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'BlockedByClient' }, S) } } catch {} }
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleLog.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160))
  else if (m.method === 'Runtime.exceptionThrown') consoleLog.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 160)) }
const t = (await send('Target.getTargets')).targetInfos.find((x) => x.type === 'page')
S = (await send('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId
for (const d of ['Page', 'Runtime']) await send(d + '.enable', {}, S)
await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, S)
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const key = (k, code, vk, text) => send('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk }, text ? { text } : {}), S).then(() => send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }, S))
let failed = 0, n = 0
const lines = []
const check = (name, ok, detail = '') => { n++; if (!ok) failed++; const line = `${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  - ' + String(detail).replace(/[^ -~]/g, '?').slice(0, 260) : ''}`; lines.push(line); console.log(line) }
async function open(target, { w = 1440, h = 900, hash = '' } = {}) {
  consoleLog = []; requests = []
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: w < 700 ? 2 : 1, mobile: w < 700 }, S)
  await send('Page.navigate', { url: 'about:blank' }, S); await send('Page.navigate', { url: ORIGIN + target + hash }, S)
  for (let i = 0; i < 120; i++) { if (await evaluate(`document.readyState === 'complete'`).catch(() => false)) break; await sleep(100) }
  await sleep(1200)
}
const LANGS = [['', 'en', 'ltr'], ['ar/', 'ar', 'rtl'], ['nl/', 'nl', 'ltr']]
const under = `(() => { const h = document.querySelector('header.site-head').getBoundingClientRect(), t = document.getElementById('features').getBoundingClientRect(); return { headerBottom: Math.round(h.bottom), headingTop: Math.round(t.top), scrollY: Math.round(scrollY) } })()`

// ================================================================= H-06
for (const [target, lang] of LANGS) for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
  await open(target, { w, h, hash: '#features' }); const a = await evaluate(under)
  await send('Page.reload', {}, S); await sleep(2200); const b = await evaluate(under)
  await open(target, { w, h }); await evaluate(`(location.hash = '#features', 1)`); await sleep(2200); const c = await evaluate(under)
  const ok = (r) => r.headingTop >= r.headerBottom + 8 && r.headingTop <= r.headerBottom + 80 && r.scrollY > 100
  check(`H-06 ${lang} ${w}: /#features lands below the sticky header - direct, after a reload, and in-page with the smooth scroll`, ok(a) && ok(b) && ok(c), `header bottom ${a.headerBottom}; heading top: direct ${a.headingTop}, reload ${b.headingTop}, in-page ${c.headingTop}`)
}
await open('', { hash: '#contact' }); const con = await evaluate(`Math.round(document.getElementById('contact').getBoundingClientRect().top)`)
await open('', { hash: '#prayer-times' }); const pt = await evaluate(`Math.round(document.getElementById('prayer-times').getBoundingClientRect().top)`)
check('H-06: the other anchors are where they were (#contact, #prayer-times just below the header)', con > 40 && con < 140 && pt > 40 && pt < 140, `#contact ${con}, #prayer-times ${pt}`)

// ================================================================= H-07
const metas = {}
for (const [target, lang, dir] of LANGS) { await open(target)
  metas[lang] = await evaluate(`(() => { const m = (s) => (document.querySelector(s) || {}).content || null; return { lang: document.documentElement.lang, dir: document.documentElement.dir || 'ltr', title: document.title, description: m('meta[name=description]'), canonical: document.querySelector('link[rel=canonical]').href,
    hreflang: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => l.hreflang + '=' + l.href).join(' '), ogLocale: m('meta[property="og:locale"]'), ogImage: m('meta[property="og:image"]'), ogImageAlt: m('meta[property="og:image:alt"]'), twitterCard: m('meta[name="twitter:card"]'),
    ogTitle: m('meta[property="og:title"]'), ogDescription: m('meta[property="og:description"]'), ogUrl: m('meta[property="og:url"]'), robots: m('meta[name=robots]') } })()`)
  const x = metas[lang]
  check(`H-07 ${lang}: og:locale, twitter:card, og:image:alt, og:image, og:title, og:description, og:url all present; language and direction right`, x.ogLocale === lang && x.twitterCard === 'summary_large_image' && !!x.ogImageAlt && x.ogImage === 'https://zulfaa.nl/assets/og.png' && !!x.ogTitle && x.ogDescription === x.description && x.lang === lang && x.dir === dir, JSON.stringify({ locale: x.ogLocale, card: x.twitterCard, alt: (x.ogImageAlt || '').length + ' chars' }))
  check(`H-07 ${lang}: canonical and the four reciprocal hreflang links are intact; nothing blocks indexing`, x.canonical === 'https://zulfaa.nl/' + target && x.ogUrl === x.canonical && x.hreflang === 'en=https://zulfaa.nl/ ar=https://zulfaa.nl/ar/ nl=https://zulfaa.nl/nl/ x-default=https://zulfaa.nl/' && !/noindex/.test(x.robots || ''), x.hreflang)
}
check('H-07: each language describes the preview image in its OWN words (Arabic in Arabic script, Dutch not the English sentence)', /[\u0600-\u06FF]/.test(metas.ar.ogImageAlt) && metas.nl.ogImageAlt !== metas.en.ogImageAlt && /embleem/.test(metas.nl.ogImageAlt))
check('H-07: descriptions fit a search result (at most 160 characters); the Dutch privacy sentence is word for word what it was', Object.values(metas).every((m) => m.description.length <= 160) && metas.nl.description.endsWith('Lokaal eerst, zonder advertenties, analytics of tracking.'), Object.entries(metas).map(([l, m]) => l + ' ' + m.description.length).join(', '))

// ================================================================= H-08
for (const [target, lang] of LANGS) { await open(target)
  const noSrc = await evaluate(`[...document.images].filter((i) => !i.getAttribute('src') && !i.getAttribute('srcset')).map((i) => i.className || i.outerHTML.slice(0, 60))`)
  check(`H-08 ${lang}: every <img> in the page has a source`, noSrc.length === 0, noSrc.join(' ; '))
  const before = requests.length
  const opened = await evaluate(`(async () => { const lb = document.querySelector('.lb-img'); const placeholder = lb.getAttribute('src').startsWith('data:image/gif'); document.querySelector('.salah') && scrollTo(0, 0)
    const shot = document.querySelector('.car-track .shot-zoom'); shot.scrollIntoView({ block: 'center' }); await new Promise((r) => setTimeout(r, 400)); shot.focus(); shot.click(); await new Promise((r) => setTimeout(r, 900))
    const box = document.getElementById('lb'); const vis = !box.hidden && getComputedStyle(box).display !== 'none'
    return { placeholder, open: vis, src: lb.getAttribute('src').slice(0, 60), natural: lb.naturalWidth, alt: lb.alt.length, focusInside: box.contains(document.activeElement), opener: shot.tagName } })()`)
  await key('Escape', 'Escape', 27); await sleep(600)
  const closed = await evaluate(`(() => { const box = document.getElementById('lb'); return { hidden: box.hidden, focusOn: document.activeElement.className || document.activeElement.tagName } })()`)
  check(`H-08 ${lang}: the placeholder is a data URI (no request); the lightbox opens with the real picture and a text alternative, focus inside`, opened.placeholder && opened.open && /\.webp|\.png|\.jpg/.test(opened.src) && opened.natural > 100 && opened.alt > 0 && opened.focusInside, JSON.stringify(opened))
  check(`H-08 ${lang}: Escape closes it and focus returns to the picture that opened it`, closed.hidden && /shot|car/.test(closed.focusOn), JSON.stringify(closed))
}

// ================================================================= H-09
for (const [target, lang, dir] of LANGS) for (const [w, h] of [[1440, 900], [390, 844]]) { await open(target, { w, h })
  const hiddenBefore = await evaluate(`(() => { const r = document.querySelector('.skip-link').getBoundingClientRect(); return r.bottom <= 0 })()`)
  await key('Tab', 'Tab', 9); await sleep(350)
  const f = await evaluate(`(() => { const a = document.activeElement, r = a.getBoundingClientRect(), cs = getComputedStyle(a); return { cls: a.className, text: a.textContent.trim(), inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, side: r.left < innerWidth / 2 ? 'left' : 'right', outline: cs.outlineStyle !== 'none', h: Math.round(r.height) } })()`)
  { const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: 150, scale: 1 } }, S); fs.writeFileSync(path.join(outDir, `skip_link_focused_${lang}_${w}.png`), Buffer.from(shot.data, 'base64')) }
  await key('Enter', 'Enter', 13, String.fromCharCode(13)); await sleep(500)
  const g = await evaluate(`({ hash: location.hash, active: document.activeElement.id || document.activeElement.tagName })`)
  await key('Tab', 'Tab', 9); await sleep(300)
  const next = await evaluate(`(() => { const a = document.activeElement; return { inMain: !!a.closest('main'), inHeader: !!a.closest('header, .topbar'), what: (a.className || a.tagName).toString().slice(0, 40) } })()`)
  check(`H-09 ${lang} ${w}: out of sight until focused; the FIRST Tab stop; then fully visible with a focus ring, on the reading-start side`, hiddenBefore && f.cls === 'skip-link' && f.inView && f.outline && f.h >= 24 && f.side === (dir === 'rtl' ? 'right' : 'left'), JSON.stringify(f))
  check(`H-09 ${lang} ${w}: Enter moves to the content (focus on #content); the next Tab continues INSIDE the content, not in the header`, g.hash === '#content' && g.active === 'content' && next.inMain && !next.inHeader, JSON.stringify({ ...g, next: next.what }))
}
await open(''); const land = await evaluate(`({ mains: document.querySelectorAll('main').length, h1: document.querySelectorAll('h1').length, headers: document.querySelectorAll('header.site-head').length })`)
check('H-09: landmarks and headings as before (one main, one h1, one header)', land.mains === 1 && land.h1 === 1 && land.headers === 1, JSON.stringify(land))

// ================================================================= the homepage still behaves
for (const [target, lang] of LANGS) { await open(target)
  const order = await evaluate(`[...document.querySelectorAll('main section, main .hero-wrap')].map((s) => s.id || s.className.split(' ')[0]).filter(Boolean).join(' > ')`)
  const nav = await evaluate(`[...document.querySelectorAll('header.site-head nav a')].map((a) => a.getAttribute('href')).join(' ')`)
  check(`behaviour ${lang}: section order and primary navigation as before`, order === 'content > hero > qa > showcase > prayer-times > trust > contact' && /updates\//.test(nav) && /support\//.test(nav) && /#contact/.test(nav), order.slice(0, 160))
  const theme = await evaluate(`(async () => { const b = document.querySelector('button.lantern'); const t0 = document.documentElement.getAttribute('data-site-theme'); b.click(); await new Promise((r) => setTimeout(r, 2200)); const t1 = document.documentElement.getAttribute('data-site-theme'); b.click(); await new Promise((r) => setTimeout(r, 2200)); return [t0, t1, document.documentElement.getAttribute('data-site-theme')] })()`)
  check(`behaviour ${lang}: the theme switch toggles and toggles back`, theme[1] !== theme[0] && theme[2] !== theme[1], theme.join(' -> '))
  const car = await evaluate(`(async () => { const next = document.querySelector('.car-next, [data-car-next]'); const track = document.querySelector('.car-track'); if (!next || !track) return null; const a = track.getBoundingClientRect().left + ':' + track.scrollLeft + ':' + getComputedStyle(track).transform; next.scrollIntoView({ block: 'center' }); next.click(); await new Promise((r) => setTimeout(r, 900)); const b = track.getBoundingClientRect().left + ':' + track.scrollLeft + ':' + getComputedStyle(track).transform; return a !== b })()`)
  check(`behaviour ${lang}: the carousel advances`, car === true)
  // the contact form is only LOOKED at: its submit button is never pressed (a submission can hand over to a mail client)
  const form = await evaluate(`(() => { const f = document.getElementById('contact-form'); if (!f) return null; return { validWhenEmpty: f.checkValidity(), required: f.querySelectorAll('[required]').length, invalid: f.querySelectorAll(':invalid').length, recipientKept: f.dataset.recipient === 'moner.intelligence@gmail.com' } })()`)
  check(`behaviour ${lang}: the contact form is intact and an empty form is invalid (validation state only - the submit button is never pressed)`, form && form.validWhenEmpty === false && form.required > 0 && form.invalid > 0 && form.recipientKept, JSON.stringify(form))
  const langMenu = await evaluate(`[...document.querySelectorAll('.lang-list a, .topbar-lang-list a')].map((a) => a.getAttribute('hreflang') || a.lang).filter(Boolean).join(' ')`)
  check(`behaviour ${lang}: the language menus offer all three languages; console free of errors`, /en/.test(langMenu) && /ar/.test(langMenu) && /nl/.test(langMenu) && consoleLog.length === 0, consoleLog.join(' || '))
}

lines.push(`blocked hosts (never contacted): ${[...blocked].join(', ') || 'none'}`); console.log(lines[lines.length - 1])
const verdict = failed ? `${failed} of ${n} checks FAILED` : `all ${n} checks passed`
lines.push(verdict); console.log(verdict)
fs.writeFileSync(path.join(outDir, 'home_maintenance_check.txt'), lines.join('\n') + '\n')
ws.close(); proc.kill(); await sleep(500); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
process.exit(failed ? 1 : 0)
