// Functional checks of the Salah section's shared timing model (no browser needed):   node tools/salah_model_test.mjs
import fs from 'node:fs'
import { modelAt, sunriseFrame, SUN_LOW_RIGHT } from '../assets/salah/day-model.js'
import { loadAnchors, KNOTS, sunPosition } from '../assets/salah/engine/timeline.js'
import { computeTimes, utcOffsetMinutes } from '../assets/salah/prayer-times.js'

const presets = JSON.parse(fs.readFileSync(new URL('../assets/salah/scene/phase_presets.json', import.meta.url)))
const cities = JSON.parse(fs.readFileSync(new URL('../assets/salah/places.json', import.meta.url))).cities
const riseFrame = sunriseFrame(loadAnchors(presets))
const city = (id) => cities.find((c) => c.id === id)
const hhmm = (m) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
let failed = 0
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  - ' + detail : ''}`) }
const instant = new Date(Date.UTC(2026, 8, 19, 12)) // 19 September 2026
const at = (id, minutes) => modelAt({ place: city(id), instant, simMinutes: minutes, riseFrame })

// ---- next / current prayer semantics, in Amsterdam
const a = at('amsterdam', 0).times
check('before Fajr: next is Fajr today', at('amsterdam', a.fajr - 30).nextPrayer.id === 'fajr' && !at('amsterdam', a.fajr - 30).nextPrayer.tomorrow)
check('before Fajr: current is still Isha (of yesterday)', at('amsterdam', a.fajr - 30).currentPrayer === 'isha')
check('at Fajr: status "now", focus Fajr', at('amsterdam', a.fajr + 3).status === 'now' && at('amsterdam', a.fajr + 3).focus.id === 'fajr')
check('after sunrise: no current Salah, next is Dhuhr', at('amsterdam', a.sunrise + 20).currentPrayer === null && at('amsterdam', a.sunrise + 20).nextPrayer.id === 'dhuhr')
check('sunrise is never the next prayer', [a.fajr + 30, a.sunrise - 1, a.sunrise + 1].every((m) => at('amsterdam', m).nextPrayer.id !== 'sunrise'))
check('between Dhuhr and Asr: next is Asr', at('amsterdam', (a.dhuhr + a.asr) / 2).nextPrayer.id === 'asr')
check('between Maghrib and Isha: next is Isha', at('amsterdam', (a.maghrib + a.isha) / 2).nextPrayer.id === 'isha')
const late = at('amsterdam', a.isha + 60)
check('after Isha: next is TOMORROW\'s Fajr', late.nextPrayer.id === 'fajr' && late.nextPrayer.tomorrow, `${hhmm(late.nextPrayer.at)} in ${Math.round(late.nextPrayer.inMinutes)} min`)
const m2358 = at('amsterdam', 1438), m0002 = at('amsterdam', 2)
check('midnight rollover: countdown keeps falling across 00:00', m2358.nextPrayer.id === 'fajr' && m0002.nextPrayer.id === 'fajr' && m2358.nextPrayer.inMinutes > 300)
check('midnight rollover: the scene frame is continuous', Math.abs(m2358.scene.frame - at('amsterdam', 1439.9).scene.frame) < 1)

// ---- prayer times are anchors, never switches: the scene frame moves continuously through every anchor
let worst = 0
for (let m = 0; m < 1440; m += 0.5) { const d = Math.abs(at('amsterdam', m + 0.5).scene.frame - at('amsterdam', m).scene.frame); worst = Math.max(worst, d > 400 ? 0 : d) }
check('no jump in the scene timeline anywhere in the day', worst < 1.2, `largest step in 30 s: ${worst.toFixed(3)} frames`)
for (const [i, id] of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].entries()) check(`at ${id} the scene is exactly the approved ${id} anchor`, Math.abs(at('amsterdam', a[id]).scene.frame - KNOTS[i]) < 1e-6)

// ---- six visual states in order, and the day line is monotone
const states = []
for (let m = a.fajr - 60; m < a.fajr + 1440 - 60; m += 5) { const s = at('amsterdam', ((m % 1440) + 1440) % 1440).visualState; if (states[states.length - 1] !== s) states.push(s) }
check('visual states run fajr, sunrise, dhuhr, asr, maghrib, isha', states.join(' ').includes('fajr sunrise dhuhr asr maghrib isha'), states.join(' > '))
let mono = true, prev = -1
for (let m = a.fajr; m <= a.isha; m += 3) { const p = at('amsterdam', m).dayLine.position; if (p < prev - 1e-9) mono = false; prev = p }
check('the day-line marker only moves forward between Fajr and Isha', mono)

// ---- other places and time zones (the place's own clock, not the browser's)
for (const id of ['beirut', 'damascus', 'london', 'new-york', 'makkah', 'jakarta', 'oslo', 'sydney']) {
  const c = city(id), t = computeTimes({ year: 2026, month: 9, day: 19 }, c, utcOffsetMinutes(c.tz, instant))
  const order = t.fajr < t.sunrise && t.sunrise < t.dhuhr && t.dhuhr < t.asr && t.asr < t.maghrib && t.maghrib < t.isha
  check(`${c.name.en.padEnd(9)} ordered and plausible`, order && t.dhuhr > 660 && t.dhuhr < 800, ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => hhmm(t[k])).join(' '))
}
const osloJune = computeTimes({ year: 2026, month: 6, day: 21 }, city('oslo'), utcOffsetMinutes('Europe/Oslo', new Date(Date.UTC(2026, 5, 21, 12))))
check('high latitude, midsummer: Fajr and Isha fall back to the angle-based rule', osloJune.adjusted.includes('fajr') && osloJune.adjusted.includes('isha'), `fajr ${hhmm(osloJune.fajr)} isha ${hhmm(osloJune.isha)}`)

// ---- smart panel position: the frame window must match the approved sun path (the scene is locked; this guards against drift)
const anchorsNow = loadAnchors(presets)
const sunAt = (f) => { const s = sunPosition(anchorsNow, f); return { x: (958 + 2400 * Math.tan((s.azimuth * Math.PI) / 180)) / 1916, y: (546 - 2400 * Math.tan((s.elevation * Math.PI) / 180)) / 821, el: s.elevation } }
const [from, to] = SUN_LOW_RIGHT
check('sun-low-right window opens as the disc enters the top of the frame', sunAt(from).y <= 0.02 && sunAt(from).y > -0.08 && sunAt(from - 8).y < -0.2, `frame ${from}: y ${(sunAt(from).y * 100).toFixed(0)} %`)
check('...and closes with the sun just under the horizon', sunAt(to).el < 0 && sunAt(to).el > -1.5, `frame ${to}: elevation ${sunAt(to).el.toFixed(2)}`)
let clear = true
for (let f = from; f < to; f += 1) if (sunAt(f).x < 0.715 + 0.04) clear = false
check('inside the window the sun stays at least 4 % of the stage to the right of the inner anchor (71.5 %)', clear, `sun column ${(sunAt(from).x * 100).toFixed(1)} .. ${(sunAt(to).x * 100).toFixed(1)} %`)
const am = at('amsterdam', 0).times
check('panel anchor through the day: edge at Fajr, Dhuhr and Isha, inner at Asr and Maghrib', ['fajr', 'dhuhr', 'isha'].every((k) => !at('amsterdam', am[k] + 1).scene.sunLowRight) && ['asr', 'maghrib'].every((k) => at('amsterdam', am[k] + 1).scene.sunLowRight))
let flips = 0, prevFlag = at('amsterdam', 0).scene.sunLowRight
for (let m = 1; m < 1440; m += 1) { const v = at('amsterdam', m).scene.sunLowRight; if (v !== prevFlag) flips++; prevFlag = v }
check('the panel relocates exactly twice in a whole day (no flicker)', flips === 2, `${flips} changes`)
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed')
process.exit(failed ? 1 : 0)
