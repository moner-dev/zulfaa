// ZULFAA Salah section - where is the visitor, approximately? Three levels, in order of precedence:
//   3. precise coordinates      only ever after an explicit user action (not wired to any production UI yet)
//   2. a city the visitor chose persisted locally, restored on the next visit
//   1. the browser's TIME ZONE  the zero-permission default. A zone is not a city, so this is a first guess and the
//                               interface says "approximate": (a) a listed city of that zone (places.json: names in three
//                               languages), else (b) the zone's own reference place from the IANA time zone database
//                               (zones.json, made by tools/salah_zones.py; legacy names such as Asia/Calcutta are followed
//                               to today's zone), else (c) UNKNOWN - the page then asks for a city and shows NO times.
//                               Coordinates are never made up from a UTC offset: an offset says nothing about latitude.
// Nothing here ever calls the Geolocation API by itself, and nothing leaves the browser.

const STORE_KEY = 'zulfaa-salah-place' // { kind: 'city', id } | { kind: 'coords', lat, lon, label }

let cities = []
let zoneTable = null // zones.json: loaded only for a visitor whose zone is not one of the listed cities' zones

/** The zone id exactly as this browser reports it ('' when it reports none). */
export function browserTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch { return '' }
}

const usableTimeZone = (tz) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return !!tz } catch { return false } }

export async function loadPlaces(url) {
  const data = await (await fetch(url)).json()
  cities = data.cities
  if (!cities.some((c) => c.tz === browserTimeZone())) {
    try { zoneTable = await (await fetch(url.replace(/places\.json(\?.*)?$/, 'zones.json'))).json() } catch { zoneTable = null } // without it an unlisted zone is simply unknown
  }
  return cities
}

export const allCities = () => cities
export const cityById = (id) => cities.find((c) => c.id === id) || null

/** PURE. A zone id as a browser reports it -> the tz database's entry for it, legacy aliases followed; null = the database places it nowhere. */
export function resolveZone(tz, table) {
  if (!tz || typeof tz !== 'string' || !table) return null
  let id = tz
  for (let i = 0; i < 4 && !Object.hasOwn(table.zones, id) && Object.hasOwn(table.links, id); i++) id = table.links[id]
  if (!Object.hasOwn(table.zones, id)) return null
  const [cc, lat, lon] = table.zones[id]
  return { zone: id, cc, lat, lon }
}

function countryNames(cc) {
  const out = {}
  for (const lang of ['en', 'ar', 'nl']) { try { out[lang] = new Intl.DisplayNames([lang], { type: 'region' }).of(cc) } catch { /* an engine without DisplayNames: the label is the place alone */ } }
  return out.en ? out : null
}

/** A clock for the picture when the zone itself is unusable: the device's own UTC offset, whole hours (Etc/GMT-3 means UTC+3). */
function offsetClock() {
  const hours = Math.round(-new Date().getTimezoneOffset() / 60)
  const tz = hours === 0 ? 'UTC' : `Etc/GMT${hours > 0 ? '-' : '+'}${Math.abs(hours)}`
  return usableTimeZone(tz) ? tz : 'UTC'
}

/** PURE apart from Intl. The first guess for a zone id: listed city -> the zone's reference place -> unknown. */
export function placeForTimeZone(tz, cityList, table) {
  const direct = tz ? cityList.find((c) => c.tz === tz) : null
  if (direct) return { ...direct, source: 'timezone' }
  const z = resolveZone(tz, table)
  if (z) {
    const listed = cityList.find((c) => c.tz === z.zone) // Asia/Calcutta -> Asia/Kolkata -> the listed city of that zone
    if (listed) return { ...listed, source: 'timezone' }
    const locality = z.zone.split('/').pop().replace(/_/g, ' ') // the database names a zone after its reference locality
    const country = countryNames(z.cc)
    const cityState = !!country && country.en.toLowerCase() === locality.toLowerCase() // Singapore, Kuwait, Monaco: say the name once
    return { id: null, zone: z.zone, tz: usableTimeZone(tz) ? tz : z.zone, lat: z.lat, lon: z.lon, name: { en: locality }, country: cityState ? null : country, source: 'timezone' }
  }
  // UNKNOWN: no times will be shown. `picture` only lets the scene follow the visitor's own clock through a nominal day
  // (day by day, night by night); it is never used for a prayer time and never shown.
  const clock = usableTimeZone(tz) ? tz : offsetClock()
  return { id: null, unknown: true, tz: clock, name: { en: '' }, country: null, source: 'unknown', picture: { lat: 30, lon: -new Date().getTimezoneOffset() / 4 } }
}

const fromTimeZone = () => placeForTimeZone(browserTimeZone(), cities, zoneTable)

function stored() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
    if (v && v.kind === 'city' && cityById(v.id)) return { ...cityById(v.id), source: 'chosen' }
    if (v && v.kind === 'coords' && Number.isFinite(v.lat) && Number.isFinite(v.lon)) {
      const tz = usableTimeZone(browserTimeZone()) ? browserTimeZone() : offsetClock()
      return { id: null, tz, lat: v.lat, lon: v.lon, name: { en: v.label, ar: v.label, nl: v.label }, country: null, source: 'precise' }
    }
  } catch { /* private mode, blocked storage: fall through to the time zone */ }
  return null
}

/** The place to use right now. */
export const currentPlace = () => stored() || fromTimeZone()

export function chooseCity(id) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ kind: 'city', id })) } catch { /* the choice then lasts for this page only */ }
  return { ...cityById(id), source: 'chosen' }
}

/** DEV only: look at a city without remembering it - a testing address or the DEV panel must never overwrite a visitor's own choice. */
export const previewCity = (id) => (cityById(id) ? { ...cityById(id), source: 'dev-preview' } : null)

export function clearChoice() {
  try { localStorage.removeItem(STORE_KEY) } catch { /* nothing stored */ }
  return fromTimeZone()
}

/**
 * Level 3, prepared but NOT offered by the production UI yet. Must be called from a user gesture; resolves to a place
 * rounded to two decimals (about 1 km) or rejects - the caller then simply keeps the current place.
 */
export function requestPrecise(label) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'))
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = Math.round(pos.coords.latitude * 100) / 100, lon = Math.round(pos.coords.longitude * 100) / 100
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ kind: 'coords', lat, lon, label })) } catch { /* session only */ }
      resolve(stored())
    }, reject, { enableHighAccuracy: false, timeout: 10000, maximumAge: 3600000 })
  })
}

export const placeName = (place, lang) => place.name[lang] || place.name.en
export const placeLabel = (place, lang) => (place.country ? `${placeName(place, lang)} \u00b7 ${place.country[lang] || place.country.en}` : placeName(place, lang))
