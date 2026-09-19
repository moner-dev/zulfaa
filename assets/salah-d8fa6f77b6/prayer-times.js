// ZULFAA Salah section - prayer-time calculation. Pure functions: no DOM, no storage, no scene knowledge.
//
//   computeTimes({ year, month, day }, { lat, lon }, utcOffsetMinutes, config) -> minutes after LOCAL midnight
//
// Astronomical method (the one used by the common public prayer-time tables): the sun's declination and the equation
// of time from the Julian date, then the hour angle at which the sun stands at a given altitude.
//   Fajr / Isha   sun a configured angle below the horizon (or Isha a fixed interval after sunset)
//   Sunrise / Maghrib   the sun's upper limb on the horizon (0.833 deg: refraction + semi-diameter)
//   Dhuhr   solar transit        Asr   shadow = object length x factor + its noon shadow
// The engine is replaceable: the scene and the UI only ever see the six numbers it returns.

export const METHODS = {
  MWL: { label: 'Muslim World League', fajrAngle: 18, ishaAngle: 17 },
  ISNA: { label: 'Islamic Society of North America', fajrAngle: 15, ishaAngle: 15 },
  EGYPT: { label: 'Egyptian General Authority of Survey', fajrAngle: 19.5, ishaAngle: 17.5 },
  MAKKAH: { label: 'Umm al-Qura University, Makkah', fajrAngle: 18.5, ishaMinutes: 90 },
  KARACHI: { label: 'University of Islamic Sciences, Karachi', fajrAngle: 18, ishaAngle: 18 },
  TURKEY: { label: 'Diyanet (Turkey)', fajrAngle: 18, ishaAngle: 17 },
}

/** The prototype's default. Exposed as ONE object so a later settings UI (or a per-country default) can replace it. */
export const DEFAULT_CONFIG = {
  method: 'MWL', //              Fajr 18 deg, Isha 17 deg
  asrFactor: 1, //               1 = standard (Shafi'i, Maliki, Hanbali), 2 = Hanafi
  highLatitude: 'angle-based', // 'none' | 'night-middle' | 'one-seventh' | 'angle-based' - used when twilight never ends
  offsets: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, // minutes, for local conventions
}

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] //           the five Salah
export const DAY_POINTS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] // + sunrise, a milestone, not a prayer

const RAD = Math.PI / 180
const sin = (d) => Math.sin(d * RAD), cos = (d) => Math.cos(d * RAD), tan = (d) => Math.tan(d * RAD)
const asin = (x) => Math.asin(x) / RAD, acos = (x) => Math.acos(x) / RAD, atan2 = (y, x) => Math.atan2(y, x) / RAD
const acot = (x) => Math.atan(1 / x) / RAD
const fix = (a, n) => ((a % n) + n) % n

function julian(year, month, day) {
  if (month <= 2) { year -= 1; month += 12 }
  const a = Math.floor(year / 100), b = 2 - a + Math.floor(a / 4)
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5
}

function sunPosition(jd) {
  const D = jd - 2451545.0
  const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360)
  const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360)
  const e = 23.439 - 0.00000036 * D
  const ra = atan2(cos(e) * sin(L), cos(L)) / 15
  return { declination: asin(sin(e) * sin(L)), equation: q / 15 - fix(ra, 24) }
}

/**
 * @returns {{fajr:number,sunrise:number,dhuhr:number,asr:number,maghrib:number,isha:number, adjusted:string[]}}
 *          minutes after local midnight (not rounded, may exceed 1440 for a late Isha); `adjusted` lists the points
 *          that needed the high-latitude rule.
 */
export function computeTimes(date, place, utcOffsetMinutes, config = DEFAULT_CONFIG) {
  const cfg = { ...DEFAULT_CONFIG, ...config, offsets: { ...DEFAULT_CONFIG.offsets, ...(config.offsets || {}) } }
  const method = METHODS[cfg.method] || METHODS.MWL
  const { lat, lon } = place
  const jd = julian(date.year, date.month, date.day) - lon / (15 * 24)
  const midDay = (t) => fix(12 - sunPosition(jd + t).equation, 24)
  const angleTime = (angle, t, before) => {
    const decl = sunPosition(jd + t).declination
    const x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))
    if (x < -1 || x > 1) return NaN // the sun never reaches this angle today
    const h = acos(x) / 15
    return midDay(t) + (before ? -h : h)
  }
  const asrTime = (factor, t) => angleTime(-acot(factor + tan(Math.abs(lat - sunPosition(jd + t).declination))), t, false)

  // hours, local mean time of the place; one refinement pass from day-portion guesses
  let t = { fajr: 5 / 24, sunrise: 6 / 24, dhuhr: 12 / 24, asr: 13 / 24, maghrib: 18 / 24, isha: 18 / 24 }
  t = {
    fajr: angleTime(method.fajrAngle, t.fajr, true), sunrise: angleTime(0.833, t.sunrise, true), dhuhr: midDay(t.dhuhr),
    asr: asrTime(cfg.asrFactor, t.asr), maghrib: angleTime(0.833, t.maghrib, false),
    isha: method.ishaMinutes ? NaN : angleTime(method.ishaAngle, t.isha, false),
  }
  const adjusted = []
  if (Number.isNaN(t.sunrise) || Number.isNaN(t.maghrib)) { // polar day / night: fall back to a 6-to-18 day so the scene still works
    t.sunrise = t.dhuhr - 6; t.maghrib = t.dhuhr + 6; adjusted.push('sunrise', 'maghrib')
  }
  if (method.ishaMinutes) t.isha = t.maghrib + method.ishaMinutes / 60

  // high latitudes: when twilight is too long (or never ends) the night is shared out instead
  if (cfg.highLatitude !== 'none') {
    const night = fix(t.sunrise - t.maghrib, 24)
    const portion = (angle) => (cfg.highLatitude === 'angle-based' ? angle / 60 : cfg.highLatitude === 'night-middle' ? 1 / 2 : 1 / 7) * night
    const fajrMax = portion(method.fajrAngle)
    if (Number.isNaN(t.fajr) || fix(t.sunrise - t.fajr, 24) > fajrMax) { t.fajr = t.sunrise - fajrMax; adjusted.push('fajr') }
    if (!method.ishaMinutes) {
      const ishaMax = portion(method.ishaAngle)
      if (Number.isNaN(t.isha) || fix(t.isha - t.maghrib, 24) > ishaMax) { t.isha = t.maghrib + ishaMax; adjusted.push('isha') }
    }
  }
  if (Number.isNaN(t.fajr)) { t.fajr = t.sunrise - 1.5; adjusted.push('fajr') }
  if (Number.isNaN(t.isha)) { t.isha = t.maghrib + 1.5; adjusted.push('isha') }
  if (Number.isNaN(t.asr)) { t.asr = (t.dhuhr + t.maghrib) / 2; adjusted.push('asr') }

  const out = { adjusted }
  for (const k of DAY_POINTS) {
    let minutes = (t[k] - lon / 15) * 60 + utcOffsetMinutes + cfg.offsets[k] // local mean time -> UTC -> the place's clock
    minutes = fix(minutes, 1440)
    out[k] = minutes
  }
  // keep the day in order across midnight (an Isha after 24:00, or a Fajr computed as "yesterday evening")
  if (out.isha < out.maghrib) out.isha += 1440
  if (out.fajr > out.sunrise) out.fajr -= 1440
  return out
}

/** Minutes between UTC and the wall clock of an IANA time zone at a given instant (DST-aware), e.g. +120. */
export function utcOffsetMinutes(timeZone, instant = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(instant)
  const v = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]))
  const asUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second)
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000)
}

/** The calendar date and the minutes after midnight on the wall clock of a time zone, at an instant. */
export function wallClock(timeZone, instant = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(instant)
  const v = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]))
  return { year: v.year, month: v.month, day: v.day, minutes: v.hour * 60 + v.minute + v.second / 60 + (instant.getMilliseconds() / 60000) }
}
