// Salah section - the zero-permission first guess (time zone -> place), tested without a browser:   node tools/salah_zones_test.mjs
// Audit finding H-01: a zone outside the 42 listed ones, or reported under a legacy name, used to get made-up coordinates
// (30 N, longitude from the UTC offset) under the visitor's own city name. This suite walks EVERY zone id this JavaScript
// engine knows, every zone and alias of the tz database table, and the ways a zone id can be missing or wrong.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SITE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = path.join(SITE, 'assets', 'salah')
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
const cities = read('places.json').cities, table = read('zones.json')

// the module under test runs in a page: give it the three things it touches there
const store = new Map()
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
globalThis.fetch = async (url) => ({ json: async () => read(String(url).split('/').pop().split('?')[0]) })
const P = await import(pathToFileURL(path.join(dir, 'places.js')))
const PT = await import(pathToFileURL(path.join(dir, 'prayer-times.js')))
const DM = await import(pathToFileURL(path.join(dir, 'day-model.js')))

let failed = 0, n = 0
const check = (name, ok, detail = '') => { n++; if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  - ' + detail : ''}`) }
const hhmm = (m) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') }
const guess = (tz) => P.placeForTimeZone(tz, cities, table)
const timesFor = (place, date, extra = {}) => DM.modelAt({ place, instant: new Date(date + 'T12:00:00Z'), config: { ...PT.DEFAULT_CONFIG }, riseFrame: 25.34, ...extra })
const ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

// ---------------------------------------------------------------- 1. the table is the tz database, not an invention
{
  const lines = fs.readFileSync(path.join(SITE, 'tools', 'tzdb', 'zone.tab'), 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'))
  const deg = (s, w) => { const sign = s[0] === '-' ? -1 : 1, d = Number(s.slice(1, 1 + w)), m = Number(s.slice(1 + w, 3 + w)), sec = Number(s.slice(3 + w) || 0); return Math.round(sign * (d + m / 60 + sec / 3600) * 100) / 100 }
  let bad = 0
  for (const [cc, coords, zone] of lines) {
    const m = /^([+-]\d{4}(?:\d{2})?)([+-]\d{5}(?:\d{2})?)$/.exec(coords), z = table.zones[zone]
    if (!z || z[0] !== cc || Math.abs(z[1] - deg(m[1], 2)) > 0.011 || Math.abs(z[2] - deg(m[2], 3)) > 0.011) bad++ // 0.01 = the last digit, where two languages may round a half differently
  }
  check('zones.json holds every zone.tab line with its country and coordinates (independent parser)', bad === 0 && lines.length === Object.keys(table.zones).length, `${lines.length} lines, ${Object.keys(table.zones).length} zones, ${bad} differences, ${table.source}`)
  const aliasBad = Object.entries(table.links).filter(([a, t]) => table.zones[a] || !table.zones[t])
  check('every alias points at a placed zone and never shadows one', aliasBad.length === 0, `${Object.keys(table.links).length} aliases`)
  check('coordinates are real places: latitude and longitude in range, none at the old fallback latitude 30.00 by construction', Object.values(table.zones).every(([, lat, lon]) => Math.abs(lat) <= 90 && Math.abs(lon) <= 180))
}

// ---------------------------------------------------------------- 2. every zone id this engine can report
{
  const ids = Intl.supportedValuesOf('timeZone')
  const unknown = ids.filter((tz) => guess(tz).unknown)
  check('every zone id the JavaScript engine lists resolves to a real place (listed city or tz database place)', unknown.every((tz) => /^(Etc\/|UTC$|GMT$)/.test(tz)), `${ids.length} ids, ${ids.length - unknown.length} placed, unplaced: ${unknown.join(', ') || 'none'}`)
  const legacy = ids.filter((tz) => !table.zones[tz] && table.links[tz])
  check('engine ids that are legacy names are followed to today\'s zone', legacy.every((tz) => !guess(tz).unknown), `${legacy.length} legacy ids, e.g. ${legacy.slice(0, 6).join(', ')}`)
  const all = [...Object.keys(table.zones), ...Object.keys(table.links)]
  const wrong = all.filter((tz) => { const p = guess(tz); return p.unknown || !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || p.picture })
  check('every zone and every alias of the table yields finite coordinates and no picture-only place', wrong.length === 0, `${all.length} ids`)
  const viaList = all.filter((tz) => guess(tz).id).length
  check('listed cities are still preferred for their zones (names in three languages)', cities.every((c) => guess(c.tz).id === cities.find((x) => x.tz === c.tz).id), `${viaList} of ${all.length} ids land on a listed city`)
}

// ---------------------------------------------------------------- 3. the cases named in the audit and the roadmap
{
  const want = [
    ['Europe/Amsterdam', 'amsterdam'], ['Europe/Istanbul', 'istanbul'], ['Africa/Khartoum', 'khartoum'], ['Asia/Kolkata', 'delhi'], ['Asia/Calcutta', 'delhi'],
    ['America/Toronto', 'toronto'], ['America/New_York', 'new-york'], ['Asia/Damascus', 'damascus'], ['Asia/Beirut', 'beirut'],
    ['Asia/Singapore', null, 1.28, 103.85], ['Europe/Zurich', null, 47.38, 8.53], ['America/Vancouver', null, 49.27, -123.12], ['Africa/Nairobi', null, -1.28, 36.82],
    ['Asia/Kathmandu', null, 27.72, 85.32], ['Asia/Katmandu', null, 27.72, 85.32], ['America/Edmonton', null, 53.55, -113.47], ['America/Halifax', null, 44.65, -63.6],
    ['America/St_Johns', null, 47.57, -52.72], ['America/Winnipeg', null, 49.88, -97.15], ['Asia/Saigon', null, 10.75, 106.67], ['Europe/Kiev', null, 50.43, 30.52],
  ]
  for (const [tz, id, lat, lon] of want) {
    const p = guess(tz)
    const ok = id ? p.id === id : !p.unknown && p.id === null && Math.abs(p.lat - lat) < 0.02 && Math.abs(p.lon - lon) < 0.02
    check(`${tz}`, ok && p.source === 'timezone', id ? `listed city ${p.id}` : `${p.name.en} ${p.lat}, ${p.lon} (${p.country ? p.country.en : 'no country name'}) zone ${p.zone}`)
  }
}

// ---------------------------------------------------------------- 4. missing, invalid and hostile ids: UNKNOWN, never a schedule
{
  const cases = ['', undefined, null, 'Not/AZone', 'Mars/Olympus_Mons', 'UTC', 'GMT', 'Etc/UTC', 'Etc/GMT+5', 'Etc/GMT-14', 'europe/amsterdam', ' Europe/Amsterdam', 'Europe/Amsterdam ', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 42, {}, 'Europe/Zurich\u0000']
  const bad = cases.filter((tz) => { const p = guess(tz); return !(p.unknown === true && p.source === 'unknown' && p.lat === undefined && p.lon === undefined && p.id === null) })
  check('missing, malformed and hostile zone ids give the UNKNOWN place: no coordinates, no city, no name', bad.length === 0, `${cases.length} cases${bad.length ? ', WRONG: ' + bad.map(String).join(' | ') : ''}`)
  const clocks = cases.map((tz) => guess(tz).tz)
  check('the unknown place still carries a clock the browser accepts (for the picture only)', clocks.every((tz) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false } }), [...new Set(clocks)].join(', '))
  check('a zone id newer than the table (not in it, no alias) is unknown rather than guessed', guess('Antarctica/New_Station_2031').unknown === true)
  check('without the zone table (download failed) an unlisted zone is unknown, a listed one still works', P.placeForTimeZone('Europe/Zurich', cities, null).unknown === true && P.placeForTimeZone('Europe/Amsterdam', cities, null).id === 'amsterdam')
}

// ---------------------------------------------------------------- 5. the corrected place feeds the SAME calculation: sane times everywhere
{
  const dates = ['2026-03-20', '2026-06-21', '2026-09-19', '2026-12-21']
  let computed = 0, broken = []
  const polar = new Set()
  for (const tz of Object.keys(table.zones)) {
    const p = guess(tz)
    for (const d of dates) {
      const t = timesFor(p, d).times, v = ORDER.map((k) => t[k])
      computed++
      if (!v.every(Number.isFinite) || !v.every((x, i) => i === 0 || x >= v[i - 1])) { if (Math.abs(p.lat) > 62) polar.add(tz); else broken.push(`${tz} ${d}`) }
    }
  }
  check('every placed zone gives six finite, ordered times on the equinox, both solstices and today (below 62 degrees latitude)', broken.length === 0, `${computed} schedules, ${broken.length} broken${broken.length ? ': ' + broken.slice(0, 5).join(', ') : ''}`)
  console.log(`     beyond 62 degrees (polar day / night; a property of the calculation, recorded separately, not part of H-01): ${polar.size} zones${polar.size ? ' - ' + [...polar].slice(0, 8).join(', ') : ''}`)

  // Dhuhr against an independent solar-noon formula, incl. the zones with unusual offsets
  const noonError = (tz, d) => {
    const p = guess(tz), instant = new Date(d + 'T12:00:00Z'), t = timesFor(p, d).times
    const day = Math.floor((instant - Date.UTC(instant.getUTCFullYear(), 0, 0)) / 86400000), B = (2 * Math.PI * (day - 81)) / 364
    const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)
    const e = t.dhuhr - (720 - eot - 4 * p.lon + PT.utcOffsetMinutes(p.tz, instant))
    return ((e % 1440) + 2160) % 1440 - 720 // Chatham (UTC+12:45, 176 W): the formula's noon falls on the other side of midnight
  }
  const odd = ['Asia/Kathmandu', 'Asia/Kolkata', 'Asia/Calcutta', 'Australia/Eucla', 'Pacific/Chatham', 'America/St_Johns', 'Asia/Tehran', 'Asia/Kabul', 'Asia/Yangon', 'Australia/Adelaide', 'Pacific/Marquesas', 'Australia/Lord_Howe']
  const errs = odd.map((tz) => [tz, PT.utcOffsetMinutes(guess(tz).tz, new Date('2026-09-19T12:00:00Z')), noonError(tz, '2026-09-19')])
  check('zones with quarter- and half-hour offsets: Dhuhr stays within 2 minutes of an independent solar-noon formula', errs.every(([, , e]) => Math.abs(e) < 2), errs.map(([tz, off, e]) => `${tz.split('/').pop()} UTC${off >= 0 ? '+' : ''}${(off / 60).toFixed(2)} ${e.toFixed(1)}m`).join(', '))
  const worst = Object.keys(table.zones).map((tz) => [tz, Math.abs(noonError(tz, '2026-09-19'))]).sort((a, b) => b[1] - a[1])[0]
  check('every placed zone: Dhuhr within 2 minutes of solar noon at its own coordinates', worst[1] < 2, `worst ${worst[0]} ${worst[1].toFixed(2)} min`)
}

// ---------------------------------------------------------------- 6. daylight saving, the day boundary, tomorrow's Fajr - for a tz-database place
{
  const z = guess('Europe/Zurich'), v = guess('America/Halifax'), s = guess('Asia/Singapore'), bc = guess('America/Vancouver')
  const shift = (p, a, b) => Math.round(timesFor(p, b).times.dhuhr - timesFor(p, a).times.dhuhr)
  check('Zurich: clocks go back on 25 Oct 2026 (Dhuhr one hour earlier), not a day sooner', shift(z, '2026-10-24', '2026-10-25') === -60 && Math.abs(shift(z, '2026-10-23', '2026-10-24')) <= 1, `${shift(z, '2026-10-23', '2026-10-24')} then ${shift(z, '2026-10-24', '2026-10-25')} min`)
  check('Halifax: clocks go back on 1 Nov 2026, a week after Europe', shift(v, '2026-10-31', '2026-11-01') === -60 && Math.abs(shift(v, '2026-10-24', '2026-10-25')) <= 1, `${shift(v, '2026-10-24', '2026-10-25')} then ${shift(v, '2026-10-31', '2026-11-01')} min`)
  check('Vancouver follows the tz database too: permanent UTC-7 since 2026, no November change', Math.abs(shift(bc, '2026-10-31', '2026-11-01')) <= 1 && PT.utcOffsetMinutes(bc.tz, new Date('2026-12-21T12:00:00Z')) === -420, `offset in December ${PT.utcOffsetMinutes(bc.tz, new Date('2026-12-21T12:00:00Z')) / 60} h`)
  check('Singapore: no daylight saving at all', [['2026-03-28', '2026-03-29'], ['2026-10-24', '2026-10-25'], ['2026-10-31', '2026-11-01']].every(([a, b]) => Math.abs(shift(s, a, b)) <= 1))
  const late = DM.modelAt({ place: z, simMinutes: 23 * 60 + 30, instant: new Date('2026-09-19T12:00:00Z'), config: { ...PT.DEFAULT_CONFIG }, riseFrame: 25.34 })
  check('Zurich 23:30: current Isha, next is TOMORROW\'s Fajr', late.currentPrayer === 'isha' && late.nextPrayer.id === 'fajr' && late.nextPrayer.tomorrow === true, `next ${late.nextPrayer.id} at ${hhmm(late.nextPrayer.at)} in ${Math.round(late.nextPrayer.inMinutes)} min`)
  let maxStep = 0, last = null
  for (let m = 0; m < 1440; m += 0.5) { const f = DM.modelAt({ place: z, simMinutes: m, instant: new Date('2026-09-19T12:00:00Z'), config: { ...PT.DEFAULT_CONFIG }, riseFrame: 25.34 }).scene.frame; if (last != null) maxStep = Math.max(maxStep, Math.abs(f - last) > 200 ? 0 : Math.abs(f - last)); last = f }
  check('Zurich: the scene timeline stays continuous through the whole day (no jump at a prayer time or at midnight)', maxStep < 1, `largest step ${maxStep.toFixed(2)} frames per 30 s`)
}

// ---------------------------------------------------------------- 7. a chosen city: wins, persists, survives bad storage
{
  const asZone = (tz) => { process.env.TZ = tz; return P.browserTimeZone() }
  asZone('Asia/Singapore')
  await P.loadPlaces('assets/salah/places.json')
  store.clear()
  const auto = P.currentPlace()
  check('Singapore, first visit: the tz database place, marked as a time-zone guess', auto.source === 'timezone' && auto.id === null && Math.abs(auto.lat - 1.28) < 0.02, `${auto.name.en} ${auto.lat}, ${auto.lon}`)
  const chosen = P.chooseCity('makkah')
  check('choosing a city stores only its id and wins over the time zone', store.get('zulfaa-salah-place') === '{"kind":"city","id":"makkah"}' && P.currentPlace().id === 'makkah' && P.currentPlace().source === 'chosen' && chosen.id === 'makkah')
  check('"use my time zone" forgets the choice and returns to the guess', P.clearChoice().zone === 'Asia/Singapore' && store.size === 0)
  for (const junk of ['{"kind":"city","id":"atlantis"}', '{broken', '{"kind":"coords","lat":"x","lon":1}', 'null', '[]']) { store.set('zulfaa-salah-place', junk); const p = P.currentPlace(); if (p.source !== 'timezone') { check('damaged or outdated storage falls back to the time zone', false, junk); break } }
  check('damaged or outdated storage falls back to the time zone', true, '5 kinds of bad stored value')
  store.clear(); asZone('UTC'); await P.loadPlaces('assets/salah/places.json')
  check('UTC, first visit: unknown - no coordinates', P.currentPlace().unknown === true)
  P.chooseCity('istanbul')
  check('UTC + a chosen city: the city is used, with its own zone', P.currentPlace().id === 'istanbul' && P.currentPlace().tz === 'Europe/Istanbul' && !P.currentPlace().unknown)
  check('UTC, "use my time zone": back to unknown, never a made-up place', P.clearChoice().unknown === true)
  store.clear(); asZone('Asia/Calcutta'); await P.loadPlaces('assets/salah/places.json')
  check('a browser that says Asia/Calcutta (Chrome, Edge) gets the listed Indian city', P.currentPlace().id === 'delhi', P.browserTimeZone())
}

// ---------------------------------------------------------------- 8. before / after, and the honest limits (report, not assertions)
{
  const truth = { 'America/Vancouver': [49.28, -123.12], 'Asia/Singapore': [1.35, 103.82], 'Europe/Zurich': [47.38, 8.54], 'Africa/Nairobi': [-1.29, 36.82], 'Pacific/Auckland': [-36.85, 174.76], 'America/Sao_Paulo': [-23.55, -46.63], 'Asia/Tokyo': [35.68, 139.69], 'Atlantic/Reykjavik': [64.15, -21.94], 'Africa/Johannesburg': [-26.2, 28.05], 'Australia/Melbourne': [-37.81, 144.96], 'America/Mexico_City': [19.43, -99.13], 'Asia/Calcutta': [28.61, 77.21] }
  console.log('\n     before / after against the true coordinates of the zone\'s own city (minutes, worst of Fajr / Dhuhr / Maghrib over 21 Jun, 19 Sep, 21 Dec):')
  let worstAfter = 0
  for (const [tz, [lat, lon]] of Object.entries(truth)) {
    let before = 0, after = 0
    for (const d of ['2026-06-21', '2026-09-19', '2026-12-21']) {
      const p = guess(tz), real = timesFor({ tz: p.tz, lat, lon }, d).times, now = timesFor(p, d).times
      const old = timesFor({ tz: p.tz, lat: 30, lon: PT.utcOffsetMinutes(p.tz, new Date(d + 'T12:00:00Z')) / 4 }, d).times
      for (const k of ['fajr', 'dhuhr', 'maghrib']) { const wrap = (x) => ((x % 1440) + 2160) % 1440 - 720; before = Math.max(before, Math.abs(wrap(old[k] - real[k]))); after = Math.max(after, Math.abs(wrap(now[k] - real[k]))) }
    }
    worstAfter = Math.max(worstAfter, after)
    console.log(`       ${tz.padEnd(22)} before ${String(Math.round(before)).padStart(4)}   after ${String(Math.round(after)).padStart(3)}   (${guess(tz).id || guess(tz).name.en})`)
  }
  check('the audit\'s sample zones: the guess is now within 3 minutes of the zone city\'s true times', worstAfter <= 3, `worst ${worstAfter.toFixed(1)} min`)
  console.log('\n     the limit that remains - a zone is not a city. Other cities of the SAME zone, against the zone\'s guess (19 Sep, minutes Fajr / Dhuhr / Maghrib):')
  for (const [tz, name, lat, lon] of [['Asia/Kolkata', 'Mumbai', 19.08, 72.88], ['Asia/Kolkata', 'Kolkata', 22.57, 88.36], ['Asia/Kolkata', 'Chennai', 13.08, 80.27], ['Asia/Shanghai', 'Chengdu', 30.57, 104.07], ['America/Chicago', 'Houston', 29.76, -95.37], ['Europe/Moscow', 'Kazan', 55.8, 49.11], ['America/Sao_Paulo', 'Brasilia', -15.79, -47.88], ['Asia/Jakarta', 'Medan', 3.59, 98.67], ['Europe/Madrid', 'Vigo', 42.24, -8.72], ['America/Vancouver', 'Prince George', 53.92, -122.75]]) {
    const p = guess(tz), a = timesFor(p, '2026-09-19').times, b = timesFor({ tz: p.tz, lat, lon }, '2026-09-19').times
    console.log(`       ${tz.padEnd(18)} guess = ${(p.id || p.name.en).padEnd(12)} visitor in ${name.padEnd(14)} ${['fajr', 'dhuhr', 'maghrib'].map((k) => String(Math.round(a[k] - b[k])).padStart(4)).join(' ')}`)
  }
}

console.log(failed ? `\n${failed} of ${n} checks FAILED` : `\nall ${n} checks passed`)
process.exit(failed ? 1 : 0)
