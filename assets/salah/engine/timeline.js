// ZULFAA Salah scene - one continuous day from the five approved phase presets.
//
// Browser port of fajr-prototype/scripts/salah_timeline.py (same numbers, same rules) - pure functions, no DOM, no WebGL.
//   * every lighting / colour / atmosphere value is a blend of the two neighbouring APPROVED presets;
//   * the sun travels one continuous monotone (PCHIP) path through the approved sun positions, all the way round
//     the clock (it keeps going under the horizon at night and comes back up on the left);
//   * things that are invisible in an approved phase (sun disc below the horizon, hidden moon, zero-intensity stars)
//     get "gate" handling, so only their AMOUNT animates - patterns and shapes never swim.
//
// The timeline coordinate is the same "frame" unit as the Blender prototype:
//   FAJR 12 · DHUHR 112 · ASR 190 · MAGHRIB 256 · ISHA 356 · (night) · next FAJR 456  ->  one cycle = 444 units.

export const ANCHORS = ['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA']
export const KNOTS = [12, 112, 190, 256, 356]
export const NIGHT_HOLD_END = 416 // Isha look is held until here; the last 40 units of the night blend into Fajr
export const CYCLE_END = 456 // == the next day's FAJR knot
export const CYCLE = CYCLE_END - KNOTS[0]
export const PLATE_LAYERS = ['L1_mountains_far', 'L2_mountain_right', 'L3_mountains_left', 'L4_far_shore', 'L5_mosque_island', 'L6_foreground']

// the sun's path, including the part nobody sees: down behind the right-hand ridge, under the scene, up on the left
const SUN_NIGHT_KNOT = { frame: 406, azimuth: 3.5, elevation: -42.0 }
// a designed half-way sky for Asr -> Maghrib, so blue and orange never mix into grey-mauve (transition only)
const GOLDEN_HOUR_SKY = [
  { elevation: 0.0, color: [0.98, 0.6, 0.27] },
  { elevation: 3.0, color: [0.92, 0.66, 0.42] },
  { elevation: 6.5, color: [0.5, 0.55, 0.7] },
  { elevation: 12.0, color: [0.16, 0.3, 0.68] },
  { elevation: 20.0, color: [0.07, 0.185, 0.55] },
  { elevation: 30.0, color: [0.05, 0.14, 0.45] },
]

// ---------------------------------------------------------------- helpers
export const clamp01 = (x) => Math.max(0, Math.min(1, x))
export const smoothstep = (x) => {
  x = clamp01(x)
  return x * x * (3 - 2 * x)
}
const clone = (o) => JSON.parse(JSON.stringify(o))

export function lerp(a, b, w) {
  if (Array.isArray(a)) return a.map((x, i) => lerp(x, b[i], w))
  if (w <= 0) return a
  if (w >= 1) return b // exact at the anchors: no floating-point dust
  return a + (b - a) * w
}

/** Monotone cubic interpolation (Fritsch-Carlson): never overshoots, so the sun never bounces. */
export function pchip(xs, ys, x, startSlopeFactor = 1) {
  const n = xs.length
  if (x <= xs[0]) return ys[0]
  if (x >= xs[n - 1]) return ys[n - 1]
  const h = [], sec = []
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1] - xs[i])
    sec.push((ys[i + 1] - ys[i]) / h[i])
  }
  const d = new Array(n).fill(0)
  d[0] = sec[0] * startSlopeFactor
  d[n - 1] = sec[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (sec[i - 1] * sec[i] > 0) {
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]
      d[i] = (w1 + w2) / (w1 / sec[i - 1] + w2 / sec[i])
    }
  }
  let i = 0
  for (let k = 0; k < n - 1; k++) if (xs[k] <= x) i = k
  const t = (x - xs[i]) / h[i]
  const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t
  const h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2
  return h00 * ys[i] + h10 * h[i] * d[i] + h01 * ys[i + 1] + h11 * h[i] * d[i + 1]
}

export function sampleGradient(stops, elevation) {
  if (elevation <= stops[0].elevation) return stops[0].color.slice()
  const last = stops[stops.length - 1]
  if (elevation >= last.elevation) return last.color.slice()
  for (let i = 0; i < stops.length - 1; i++) {
    if (stops[i].elevation <= elevation && elevation <= stops[i + 1].elevation) {
      const w = (elevation - stops[i].elevation) / (stops[i + 1].elevation - stops[i].elevation)
      return lerp(stops[i].color, stops[i + 1].color, w)
    }
  }
  return last.color.slice()
}

function blendGradients(a, b, w) {
  if (w <= 1e-6) return clone(a)
  if (w >= 1 - 1e-6) return clone(b)
  const es = [...new Set([...a.map((s) => s.elevation), ...b.map((s) => s.elevation)])].sort((x, y) => x - y)
  return es.map((e) => ({ elevation: e, color: lerp(sampleGradient(a, e), sampleGradient(b, e), w) }))
}

// ---------------------------------------------------------------- anchors
const setDefault = (o, k, v) => {
  if (o[k] === undefined) o[k] = v
}

/** Make every optional key explicit (same defaults as salah_phase.apply_preset) so presets can be blended. */
function fillDefaults(preset) {
  const p = clone(preset)
  const { sun, moon, sky, plates: pl, mosque: m } = p
  setDefault(sun, 'plate_key_strength', 0.0)
  setDefault(sun, 'disc_scale', 1.0)
  setDefault(sun, 'disc_color', [1.0, 0.93, 0.8])
  setDefault(moon, 'color', [0.93, 0.92, 0.86])
  setDefault(moon, 'phase_offset', 0.62)
  setDefault(moon, 'earthshine', 0.035)
  setDefault(moon, 'light_dir', [0.8, -0.6])
  setDefault(moon, 'disc_scale', 1.0)
  moon.fade = moon.visible ? 1.0 : 0.0 // the moon fades by transparency at full brightness
  const st = sky.stars
  for (const [k, v] of [['density', 0.2], ['glow', 0.0], ['color_variation', 0.0], ['cell_scale', 260.0], ['randomness', 1.0], ['moon_mask', 0.0]]) setDefault(st, k, v)
  setDefault(sky, 'moon_glow', {})
  for (const [k, v] of [['color', [0.72, 0.82, 1.0]], ['inner_intensity', 0.0], ['inner_sigma', 0.8], ['outer_intensity', 0.0], ['outer_sigma', 3.0]]) setDefault(sky.moon_glow, k, v)
  setDefault(pl, 'sun_rim_color', [1.0, 0.55, 0.25])
  setDefault(pl, 'haze_sun_sigma', 14.0)
  for (const layer of PLATE_LAYERS) {
    const L = pl[layer]
    setDefault(L, 'flatten', 0.0)
    setDefault(L, 'saturation', pl.saturation)
    setDefault(L, 'white_balance', pl.white_balance.slice())
    setDefault(L, 'gamma', pl.gamma)
    setDefault(L, 'haze_sun', 0.0)
    setDefault(L, 'haze_sun_color', [1.0, 0.5, 0.2])
    setDefault(L, 'sun_rim', 0.0)
  }
  setDefault(pl.L5_mosque_island, 'rock_cool', 0.0)
  setDefault(pl.L5_mosque_island, 'noon_relight', 0.0)
  setDefault(pl.L6_foreground, 'contact_shadow', 0.0)
  setDefault(m, 'lamp_neutralise', 0.0)
  delete pl._note
  return p
}

export function loadAnchors(presets, options = {}) {
  const A = {}
  for (const name of ANCHORS) A[name] = fillDefaults(presets[name])
  // --- things that are INVISIBLE in an approved phase may be set freely without changing that phase's look ---
  // Fajr: the disc is below the horizon. Give it a golden sunrise disc so it rises the way it later sets.
  Object.assign(A.FAJR.sun, { disc_color: [1.0, 0.5, 0.12], disc_strength: 4.0, disc_scale: 1.5 })
  // Isha: the disc is below the horizon. Keep Maghrib's disc so sunset is pure occlusion, never a fade.
  for (const k of ['disc_color', 'disc_strength', 'disc_scale']) A.ISHA.sun[k] = clone(A.MAGHRIB.sun[k])
  // Maghrib: the moon is hidden. Start it a little higher-left so it drifts down-right while it fades in.
  Object.assign(A.MAGHRIB.moon, { azimuth: -2.0, elevation: 13.6 })
  // WEB ONLY - one star field for the whole night. The browser draws its own procedural stars, so there is no Blender
  // pattern to keep at Fajr: dawn's few faint stars are simply the Isha field, dimmer and higher up. (Blender's Fajr
  // keeps its own field; its stars are barely visible in the approved frame.)
  if (!options.blenderParity) {
    for (const k of ['density', 'glow', 'color_variation', 'cell_scale', 'randomness', 'moon_mask']) A.FAJR.sky.stars[k] = A.ISHA.sky.stars[k]
    A.FAJR.sky.stars.intensity = 0.45
  }
  // End of the night (a copy of Fajr used only as the target of the Isha -> Fajr blend): the hidden moon has drifted on
  // toward the west, and the star FIELD stays the Isha field (only its intensity and fade heights change), so the
  // pattern never swims while night turns into dawn.
  A.FAJR_NEXT = clone(A.FAJR)
  Object.assign(A.FAJR_NEXT.moon, { azimuth: 9.5, elevation: 4.6 })
  return A
}

// "gated" groups: if a group's gate is 0 in one anchor, its shape parameters are copied from the other anchor
function gateCopy(a0, b0) {
  const a = clone(a0), b = clone(b0)
  const copyKeys = (da, db, gateA, gateB, keys) => {
    if (gateA <= 1e-6 && gateB > 1e-6) for (const k of keys) da[k] = clone(db[k])
    else if (gateB <= 1e-6 && gateA > 1e-6) for (const k of keys) db[k] = clone(da[k])
  }
  const sum = (p, key) => PLATE_LAYERS.reduce((t, l) => t + p.plates[l][key], 0)
  copyKeys(a.sky.stars, b.sky.stars, a.sky.stars.intensity, b.sky.stars.intensity,
    ['fade_start_elevation', 'fade_full_elevation', 'density', 'glow', 'color_variation', 'cell_scale', 'randomness', 'moon_mask'])
  copyKeys(a.moon, b.moon, a.moon.fade, b.moon.fade, ['color', 'phase_offset', 'earthshine', 'light_dir', 'disc_scale', 'disc_strength'])
  const mg = (p) => p.sky.moon_glow.inner_intensity + p.sky.moon_glow.outer_intensity
  copyKeys(a.sky.moon_glow, b.sky.moon_glow, mg(a), mg(b), ['color', 'inner_sigma', 'outer_sigma'])
  for (const lobe of ['glow_wide', 'glow_core']) copyKeys(a.sky[lobe], b.sky[lobe], a.sky[lobe].intensity, b.sky[lobe].intensity, ['color', 'sigma_az', 'sigma_el'])
  copyKeys(a.sun, b.sun, a.sun.key_strength + a.sun.plate_key_strength, b.sun.key_strength + b.sun.plate_key_strength, ['key_color'])
  copyKeys(a.plates, b.plates, sum(a, 'sun_rim'), sum(b, 'sun_rim'), ['sun_rim_color'])
  copyKeys(a.plates, b.plates, sum(a, 'haze_sun'), sum(b, 'haze_sun'), ['haze_sun_sigma'])
  for (const l of PLATE_LAYERS) copyKeys(a.plates[l], b.plates[l], a.plates[l].haze_sun, b.plates[l].haze_sun, ['haze_sun_color'])
  copyKeys(a.mosque, b.mosque, a.mosque.rim_left + a.mosque.rim_right, b.mosque.rim_left + b.mosque.rim_right, ['rim_color'])
  copyKeys(a.mosque, b.mosque, a.mosque.town_emission, b.mosque.town_emission, ['town_color'])
  copyKeys(a.clouds, b.clouds, a.clouds.underglow_strength, b.clouds.underglow_strength, ['underglow_color'])
  return [a, b]
}

// ---------------------------------------------------------------- easing: how fast each channel moves inside a segment
/** seg 0..4, p = linear progress 0..1 inside it, sunEl = the sun's elevation right now. 'look' drives everything not listed. */
export function channelWeights(seg, p, sunEl) {
  if (seg === 0) {
    // Fajr -> Dhuhr. Values blend in LINEAR light, where the bright preset dominates: a slow start keeps dawn a dawn.
    const look = 1 - (1 - p ** 1.25) ** 1.6
    // the sun's light and its broad white midday halo arrive with the sun's HEIGHT, not with the clock: a sun that has
    // only just cleared the ridge must not flood the dawn mist with noon light (the old pale, hazy sunrise)
    const high = smoothstep((sunEl - 1.0) / 27.0)
    const glow = smoothstep((sunEl - 5.0) / 40.0)
    // the dawn glow belongs to the horizon: once the sun itself is up it must not drag a bright band across the sky
    const glow_gain = 1 - 0.72 * smoothstep(sunEl / 9.0) * (1 - glow)
    return { look, stars: smoothstep(p / 0.14), mist: 1 - (1 - p) ** 3.0, sun_disc: smoothstep((p - 0.34) / 0.5), lamps: look,
      sun_key: Math.min(look, high), glow, glow_gain }
  }
  if (seg === 1) {
    // Dhuhr -> Asr: the warmth arrives late in the afternoon
    const look = smoothstep(p ** 1.4)
    // the wide noon halo has to be Asr-tight BEFORE the sun re-enters the top of the tallest framing (19 deg)
    return { look, stars: look, mist: look, sun_disc: smoothstep((p - 0.5) / 0.5), lamps: look, sun_key: look,
      glow: Math.max(look, smoothstep((58.0 - sunEl) / 34.0)) }
  }
  if (seg === 2) {
    const look = smoothstep(p)
    return { look, stars: look, mist: look, sun_disc: look, lamps: look, sun_key: look, glow: look, sky_via_golden_hour: true }
  }
  if (seg === 3) {
    // Maghrib -> Isha: the sun is gone within the first moments; twilight lingers; then the moon, then the stars
    const look = smoothstep(p)
    return { look, stars: smoothstep((p - 0.5) / 0.5), mist: look, sun_disc: 0.0, moon: smoothstep((p - 0.38) / 0.52),
      moon_pos: smoothstep(p), lamps: smoothstep(p / 0.8), sun_key: look, glow: look }
  }
  // night: Isha is held, then the last stretch before Fajr turns into dawn. The moon sets first, stars thin out late.
  const q = clamp01((p - 0.6) / 0.4)
  const look = smoothstep(q)
  return { look, stars: smoothstep((q - 0.15) / 0.85), mist: look, sun_disc: look, moon: smoothstep((p - 0.45) / 0.3),
    moon_pos: p, lamps: look, sun_key: look, glow: look }
}

function blend(a, b, W) {
  const w = W.look
  const out = clone(a)
  const mixAll = (da, db, dout, weight) => {
    for (const [k, v] of Object.entries(da)) {
      if (k.startsWith('_')) continue
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) mixAll(v, db[k] ?? v, dout[k], weight)
      else if (typeof v === 'boolean' || typeof v === 'string') continue
      else if (Array.isArray(v) && v.length && typeof v[0] === 'object') continue // the sky gradient is handled separately
      else dout[k] = lerp(v, db[k] ?? v, weight)
    }
  }
  const mix = (path, weight) => {
    let da = a, db = b, dout = out
    for (const k of path.slice(0, -1)) [da, db, dout] = [da[k], db[k], dout[k]]
    const k = path[path.length - 1]
    dout[k] = lerp(da[k], db[k], weight)
  }
  mixAll(a, b, out, w)
  // channels with their own timing
  for (const k of ['disc_strength', 'disc_color', 'disc_scale']) mix(['sun', k], W.sun_disc)
  for (const k of ['key_strength', 'plate_key_strength']) mix(['sun', k], W.sun_key)
  for (const lobe of ['glow_wide', 'glow_core']) for (const k of ['color', 'intensity', 'sigma_az', 'sigma_el']) mix(['sky', lobe, k], W.glow)
  if (W.glow_gain !== undefined) for (const lobe of ['glow_wide', 'glow_core']) out.sky[lobe].intensity *= W.glow_gain
  mix(['sky', 'stars', 'intensity'], W.stars)
  for (const k of Object.keys(a.mist)) mix(['mist', k], W.mist)
  for (const k of ['window_emission', 'practical_glow', 'town_emission']) mix(['mosque', k], W.lamps)
  const wm = W.moon ?? w
  mix(['moon', 'fade'], wm)
  for (const k of ['inner_intensity', 'outer_intensity']) mix(['sky', 'moon_glow', k], wm)
  const wp = W.moon_pos ?? w
  mix(['moon', 'azimuth'], wp)
  mix(['moon', 'elevation'], wp)
  out.moon.visible = out.moon.fade > 1e-3
  // sky gradient: exact anchor stops at the ends; Asr -> Maghrib travels THROUGH a designed golden-hour sky
  if (W.sky_via_golden_hour) {
    out.sky.gradient = w <= 0.5 ? blendGradients(a.sky.gradient, GOLDEN_HOUR_SKY, smoothstep(w * 2)) : blendGradients(GOLDEN_HOUR_SKY, b.sky.gradient, smoothstep(w * 2 - 1))
  } else out.sky.gradient = blendGradients(a.sky.gradient, b.sky.gradient, w)
  return out
}

// ---------------------------------------------------------------- public API
/** Wrap any timeline coordinate into one cycle [12, 456). */
export const wrapFrame = (f) => KNOTS[0] + ((((f - KNOTS[0]) % CYCLE) + CYCLE) % CYCLE)

const SUN_X = [...KNOTS, SUN_NIGHT_KNOT.frame, CYCLE_END]

export function sunPosition(A, f) {
  const az = [...ANCHORS.map((n) => A[n].sun.azimuth), SUN_NIGHT_KNOT.azimuth, A.FAJR.sun.azimuth]
  const el = [...ANCHORS.map((n) => A[n].sun.elevation), SUN_NIGHT_KNOT.elevation, A.FAJR.sun.elevation]
  return { azimuth: pchip(SUN_X, az, f, 0.45), elevation: pchip(SUN_X, el, f, 0.45) }
}

/** state(frame) -> a preset-shaped object: exactly an approved preset at the five knots, a blend of two in between. */
export function state(A, frame) {
  const f = wrapFrame(frame)
  const sun = sunPosition(A, f)
  const bounds = [...KNOTS, CYCLE_END]
  let seg = 0
  for (let i = 0; i < 5; i++) if (bounds[i] <= f) seg = i
  const p = (f - bounds[seg]) / (bounds[seg + 1] - bounds[seg])
  const names = [...ANCHORS, 'FAJR_NEXT']
  const [a, b] = gateCopy(A[names[seg]], A[names[seg + 1]])
  const W = channelWeights(seg, p, sun.elevation)
  const out = blend(a, b, W)
  out.sun.azimuth = sun.azimuth
  out.sun.elevation = sun.elevation
  out._timeline = { frame: f, segment: `${names[seg]}->${names[seg + 1] === 'FAJR_NEXT' ? 'FAJR' : names[seg + 1]}`, progress: p, weights: W }
  return out
}
