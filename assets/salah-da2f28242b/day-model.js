// ZULFAA Salah section - THE shared timing model. One source of truth for one moment:
//
//        place + instant + calculation config
//                      |
//                 modelAt(...)
//            /                   \
//   scene: frame, segment, progress      UI: times, next prayer, countdown, status, visual state, timeline position
//
// The scene never reads prayer names; the UI never positions the sun. Both only read this object.
// Prayer times are ANCHORS on a continuous timeline: nothing here (or downstream) switches at a prayer-time second.
import { computeTimes, utcOffsetMinutes, wallClock, DEFAULT_CONFIG, PRAYERS, DAY_POINTS } from './prayer-times.js'
import { KNOTS, NIGHT_HOLD_END, CYCLE_END, CYCLE, sunPosition } from './engine/timeline.js'

export const DAWN_BLEND_MINUTES = 80 //  the night turns into the Fajr look over the last 80 minutes before Fajr
export const NOW_WINDOW_MINUTES = 20 //  for this long after a prayer begins the focus says "now" instead of "next"
/** The six contextual states of the interface, as ranges of the scene timeline (so UI and scene can never disagree). */
// Timeline frames during which the sun is LOW ON THE RIGHT of the picture - from the moment its disc enters the top of the
// frame shortly before Asr (elevation under about 13 degrees), through the sunset behind the right-hand peak, until the
// afterglow has gone and the moon starts to appear (frame 300, sun just under the horizon). The interface keeps that part
// of the composition clear. Derived from the approved sun path; tools/salah_model_test.mjs proves it still matches.
export const SUN_LOW_RIGHT = [181, 300]
const VISUAL_STATES = [['fajr', 430, 466.5], ['sunrise', 22.5, 46], ['dhuhr', 46, 160], ['asr', 160, 236], ['maghrib', 236, 292], ['isha', 292, 430]]

const addDays = ({ year, month, day }, n) => {
  const d = new Date(Date.UTC(year, month - 1, day + n))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** Timeline frame at which the sun crosses the horizon on its way up - found once from the approved sun path. */
export function sunriseFrame(anchors) {
  let lo = KNOTS[0], hi = KNOTS[1]
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (sunPosition(anchors, mid).elevation < 0) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Three days of times on ONE axis: minutes relative to today's local midnight (yesterday negative, tomorrow + 1440). */
function threeDays(date, place, instant, config) {
  const days = [-1, 0, 1].map((n) => {
    const d = addDays(date, n)
    const noon = new Date(Date.UTC(d.year, d.month - 1, d.day, 12))
    const t = computeTimes(d, place, utcOffsetMinutes(place.tz, noon), config)
    const shifted = { adjusted: t.adjusted }
    for (const k of DAY_POINTS) shifted[k] = t[k] + n * 1440
    return shifted
  })
  return { yesterday: days[0], today: days[1], tomorrow: days[2] }
}

/**
 * @param {object} o
 * @param {{tz:string,lat:number,lon:number}} o.place
 * @param {Date}   [o.instant]        the real moment (default: now)
 * @param {number} [o.simMinutes]     DEV: pretend the place's clock shows this many minutes after midnight, today
 * @param {object} [o.config]         calculation config (method, Asr factor, high-latitude rule, offsets)
 * @param {number} o.riseFrame        from sunriseFrame()
 */
export function modelAt({ place, instant = new Date(), simMinutes = null, config = DEFAULT_CONFIG, riseFrame }) {
  const clock = wallClock(place.tz, instant)
  const now = simMinutes == null ? clock.minutes : simMinutes
  const { yesterday: y, today: t, tomorrow: n } = threeDays(clock, place, instant, config)

  // ---- the scene: clock -> timeline frame, piecewise linear between the anchors, continuous over midnight
  const [FAJR, DHUHR, ASR, MAGHRIB, ISHA] = KNOTS
  const track = [
    [y.isha, ISHA - CYCLE], [t.fajr - DAWN_BLEND_MINUTES, NIGHT_HOLD_END - CYCLE], [t.fajr, FAJR], [t.sunrise, riseFrame], [t.dhuhr, DHUHR],
    [t.asr, ASR], [t.maghrib, MAGHRIB], [t.isha, ISHA], [n.fajr - DAWN_BLEND_MINUTES, NIGHT_HOLD_END], [n.fajr, CYCLE_END], [n.sunrise, riseFrame + CYCLE],
  ]
  let frame = ISHA, segmentIndex = 0, progress = 0
  for (let i = 0; i < track.length - 1; i++) {
    const [t0, f0] = track[i], [t1, f1] = track[i + 1]
    if (now >= t0 && now <= t1) {
      progress = Math.max(0, Math.min(1, (now - t0) / Math.max(t1 - t0, 1e-6))) // (now - phaseStart) / (phaseEnd - phaseStart)
      frame = f0 + (f1 - f0) * progress
      segmentIndex = i
      break
    }
  }
  const wrapped = KNOTS[0] + ((((frame - KNOTS[0]) % CYCLE) + CYCLE) % CYCLE)
  const state = (VISUAL_STATES.find(([, a, b]) => (wrapped >= a && wrapped < b) || (wrapped + CYCLE >= a && wrapped + CYCLE < b)) || VISUAL_STATES[5])[0]

  // ---- the five Salah: which one are we in, which one is next, how long until it
  const line = [...PRAYERS.map((id) => ({ id, at: y[id], day: -1 })), ...PRAYERS.map((id) => ({ id, at: t[id], day: 0 })), ...PRAYERS.map((id) => ({ id, at: n[id], day: 1 }))]
  const next = line.find((p) => p.at > now)
  const previous = [...line].reverse().find((p) => p.at <= now)
  // Fajr's time ends at sunrise: between sunrise and Dhuhr no Salah is "current", although the scene is in its morning
  const sunriseOfPrev = previous.day === -1 ? y.sunrise : previous.day === 0 ? t.sunrise : n.sunrise
  const current = previous.id === 'fajr' && now >= sunriseOfPrev ? null : previous
  const sincePrevious = now - previous.at
  const status = current && sincePrevious <= NOW_WINDOW_MINUTES ? 'now' : 'next'
  const focus = status === 'now' ? current : next

  // ---- the compact day line: six evenly spaced points, the marker moves continuously between them with the clock
  const points = DAY_POINTS.map((id) => t[id])
  let line01 = 0
  if (now <= points[0]) line01 = 0
  else if (now >= points[5]) line01 = 1
  else for (let i = 0; i < 5; i++) if (now >= points[i] && now <= points[i + 1]) line01 = (i + (now - points[i]) / (points[i + 1] - points[i])) / 5
  const night = now < points[0] || now > points[5]

  return {
    place, config,
    clock: { minutes: now, date: { year: clock.year, month: clock.month, day: clock.day }, simulated: simMinutes != null },
    times: Object.fromEntries(DAY_POINTS.map((id) => [id, t[id]])), adjusted: t.adjusted,
    scene: { frame: wrapped, segmentIndex, progress, sunLowRight: wrapped >= SUN_LOW_RIGHT[0] && wrapped < SUN_LOW_RIGHT[1] },
    visualState: state, //                       'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
    currentPrayer: current ? current.id : null, // the Salah whose time we are in (null between sunrise and Dhuhr)
    nextPrayer: { id: next.id, at: next.at, tomorrow: next.day === 1, inMinutes: next.at - now },
    status, focus: { id: focus.id, at: focus.at }, // what the interface puts first
    dayLine: { position: line01, night },
  }
}
