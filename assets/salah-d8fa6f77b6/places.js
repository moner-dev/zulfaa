// ZULFAA Salah section - where is the visitor, approximately? Three levels, in order of precedence:
//   3. precise coordinates      only ever after an explicit user action (not wired to any production UI yet)
//   2. a city the visitor chose persisted locally, restored on the next visit
//   1. the browser's TIME ZONE  the zero-permission default: the first listed city of that zone
// Nothing here ever calls the Geolocation API by itself, and nothing leaves the browser.

const STORE_KEY = 'zulfaa-salah-place' // { kind: 'city', id } | { kind: 'coords', lat, lon, label }

let cities = []

export async function loadPlaces(url) {
  const data = await (await fetch(url)).json()
  cities = data.cities
  return cities
}

export const allCities = () => cities
export const cityById = (id) => cities.find((c) => c.id === id) || null

function fromTimeZone() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const city = cities.find((c) => c.tz === tz)
  if (city) return { ...city, source: 'timezone' }
  // an unlisted zone: keep the visitor's own clock, estimate the longitude from the UTC offset and use a mid latitude
  const offsetMin = -new Date().getTimezoneOffset()
  const region = tz.includes('/') ? tz.split('/').pop().replace(/_/g, ' ') : tz
  return { id: null, tz, lat: 30, lon: offsetMin / 4, name: { en: region, ar: region, nl: region }, country: null, source: 'timezone-estimate' }
}

function stored() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
    if (v && v.kind === 'city' && cityById(v.id)) return { ...cityById(v.id), source: 'chosen' }
    if (v && v.kind === 'coords' && Number.isFinite(v.lat) && Number.isFinite(v.lon)) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
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
