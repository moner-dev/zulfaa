// ZULFAA Salah scene - distant birds (web runtime only). Pure functions: no DOM, no WebGL, no state.
//
// A few far-away birds, and between flights none. Everything is a function of (scene state, scene time, seed):
//   * time is cut into SLOT-second slots; a slot may hold ONE flight of 1-4 birds (usually 2-3). Whether it does is
//     decided by the phase's presence (table below, blended like every other value), softly - a flight fades, it never pops;
//   * a flight enters at the LEFT or at the RIGHT edge of the framing (half and half) and recedes into the distance over the
//     lake, shrinking and fading into the haze - or does the same journey backwards. Left-hand flights come out from
//     behind the foreground tree on the desktop framing; right-hand flights come in over the right-hand range;
//   * the right-hand sky belongs to the sun from late Asr to sunset: while the sun is low on the right, a right-hand
//     flight gives way to its left-hand twin (a cross-fade of two fixed routes - a route itself never moves), and the
//     left-hand routes end before the middle of the frame. Any bird near a risen sun fades out, whatever its route;
//   * the schedule panel and the city picker are frosted glass ABOVE the canvas: a bird behind them is erased by their
//     blur (checked), exactly as the mosque and the tree hide one. Nothing is ever drawn over the interface;
//   * nothing exists at scene time 0, so reduced motion (the site passes time 0) is a sky without birds.
// The renderer turns the list into uniforms; the silhouettes are drawn in shaders.js (withBirds), behind the mountains.
import { smoothstep, clamp01 } from './timeline.js'

export const MAX_BIRDS = 12 // two overlapping flights of four, plus room for the left / right cross-fade in the afternoon
const PW = 1916, FOCAL = 2400, HORIZON = 546, RAD = Math.PI / 180
const SLOT = 36 //          seconds; one flight at most begins in each slot
const FIRST_START = 2 //    seconds of empty sky before the first flight may begin
const FLOOR_ROW = 222 //    no bird centre sinks below this plate row: clear of the dome's finial (245) and of every ridge (252+)

// share of 36-second slots that hold a flight. A flight is clearly in view for 25-35 s, so by day a visitor who looks at
// the sky for twenty seconds will usually see one; Maghrib is kept quieter, Isha has none (measured: see the lab README).
export const BIRD_PHASES = { FAJR: 0.74, DHUHR: 0.86, ASR: 0.84, MAGHRIB: 0.56, ISHA: 0.0 }

const lerp = (a, b, w) => a + (b - a) * w

/** Deterministic random numbers in [0, 1) for (seed, slot, channel) - integer hash (no Math.random: a moment can be re-rendered). */
function rand(seed, slot, channel) {
  let h = (Math.imul(slot | 0, 0x9e3779b1) ^ Math.imul((channel | 0) + 1, 0x85ebca6b) ^ Math.imul((seed * 8191) | 0, 0xc2b2ae35)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Smooth 1D value noise, 0..1. */
function noise1(x, k) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f)
  return lerp(rand(k, i, 77), rand(k, i + 1, 77), u)
}

/** How present birds are right now, 0..1 (a blend of the two neighbouring phases; gone before the moon and the stars arrive). */
export function birdPresence(st) {
  const [from, to] = st._timeline.segment.split('->')
  const p = st._timeline.progress
  let presence = lerp(BIRD_PHASES[from], BIRD_PHASES[to], st._timeline.weights.look)
  if (from === 'MAGHRIB') presence = BIRD_PHASES.MAGHRIB * (1 - smoothstep(p / 0.42)) // home before dusk turns into night
  return presence * (1 - clamp01(st.moon.fade)) ** 2 // never in the same sky as the moon
}

/** 1 while the sun is low on the RIGHT of the frame (late afternoon -> sunset): the right-hand sky is then the sun's. */
function sunLowRight(st) {
  const { azimuth: az, elevation: el } = st.sun
  return smoothstep((28 - el) / 8) * smoothstep((el + 4) / 3) * smoothstep((az - 2) / 6)
}

/**
 * The birds to draw at this moment: [{ x, y, span, beat, opacity, bank, far }] in plate pixels (at most MAX_BIRDS).
 * framing = { rect: [x, y, w, h] } in plate pixels; seed = any number (the renderer picks one per page load).
 */
export function birdsAt(st, framing, timeSec, seed = 0, options = {}) {
  const out = []
  if (!(timeSec > 0)) return out
  const natural = birdPresence(st)
  if (natural <= 0) return out
  // taller framings (tablet, phone) show more sky above the plate: fly a little higher and a little larger there
  const narrow = clamp01((PW - framing.rect[2]) / 1036)
  // no tree and no panel stand in front of the phone's sky, so the same schedule would show birds far more of the time
  const presence = options.presence != null ? options.presence : natural * lerp(1, 0.84, narrow) // DEV review mode can raise it, never at night
  const lift = 0.45 * framing.rect[1], grow = 1 + 0.55 * narrow
  // the sun's place on the plate: a silhouette must never cross the disc or its glare
  const sunUp = smoothstep((st.sun.elevation + 3) / 3)
  const sunX = PW / 2 + FOCAL * Math.tan(st.sun.azimuth * RAD), sunY = HORIZON - (FOCAL * Math.tan(st.sun.elevation * RAD)) / Math.cos(st.sun.azimuth * RAD)
  // routes are laid out across what this framing SHOWS (the phone sees less than half of the plate's width), and the
  // right-hand sky is only the sun's where the sun is inside the framing (on the phone it sets outside the picture)
  const left = framing.rect[0], wide = framing.rect[2]
  const low = sunLowRight(st) * smoothstep((left + wide + 150 - sunX) / 150)

  const slot = Math.floor(timeSec / SLOT)
  for (const k of [slot - 1, slot]) {
    if (k < 0) continue
    const r = (c) => rand(seed, k, c)
    // which slots fly: a golden-ratio sequence with a little chance on top. Pure chance leaves the sky empty for ten
    // minutes and then sends three flights in a row; this spreads them out without ever becoming a rhythm. The very
    // first slot always flies by day, so a visitor who arrives straight at the section is not left with an empty sky.
    const draw = k === 0 ? 0 : (rand(seed, 0, 99) + k * 0.6180339887 + 0.24 * (r(0) - 0.5) + 1) % 1
    const flightOpacity = smoothstep((presence - draw) / 0.06)
    if (flightOpacity <= 0) continue
    const start = k * SLOT + FIRST_START + r(1) * (k === 0 ? 3 : 8), duration = 40 + r(2) * 14
    const count = r(3) < 0.08 ? 1 : r(3) < 0.42 ? 2 : r(3) < 0.8 ? 3 : 4 //   usually two or three; a loner or a four now and then
    const arriving = k > 0 && r(4) < 0.35 //                      the same journey, backwards: out of the distance, off past the edge
    // a right-hand flight and its left-hand twin: two FIXED routes; only their weights follow the sun
    const routes = r(10) < 0.5 ? [[true, 1 - low], [false, low]] : [[false, 1]]

    for (const [fromRight, weight] of routes) {
      if (weight <= 0.003) continue
      // the route: a shallow arc from the edge to a vanishing place above the far ranges. Left-hand routes end 30-68 %
      // across (30-46 % under a low right-hand sun); right-hand routes end 42-66 % across, right of the minaret
      const x0 = fromRight ? left + wide + 70 : left - 70, y0 = 100 + r(5) * 105 + lift
      const x1 = left + wide * (fromRight ? 0.66 - r(6) * 0.24 : 0.3 + r(6) * lerp(0.38, 0.16, low)), y1 = 125 + r(7) * 80 + lift
      const bend = (r(8) < 0.5 ? -1 : 1) * (25 + r(9) * 45)
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy)
      const cx = (x0 + x1) / 2 - (dy / len) * bend, cy = (y0 + y1) / 2 + (dx / len) * bend
      const heading = (arriving ? -1 : 1) * (fromRight ? -1 : 1) //  +1 = flying toward the right of the frame

      for (let i = 0; i < count; i++) {
        const q = (c) => rand(seed + 17.3 * (i + 1), k, c)
        const lag = i === 0 ? 0 : 0.9 * i + q(0) * 1.6 //   followers trail the leader, loosely
        let s = (timeSec - start - lag) / duration
        if (s <= 0 || s >= 1) continue
        if (arriving) s = 1 - s
        // perspective: the same air speed covers fewer pixels the further away the bird is
        const e = 1 - (1 - s) ** 1.7
        const depth = lerp(1, 0.4, e ** 0.9) //              apparent size: 1 at the edge, 0.4 at the vanishing place
        const a = 1 - e
        let x = a * a * x0 + 2 * a * e * cx + e * e * x1, y = a * a * y0 + 2 * a * e * cy + e * e * y1
        // place in the group + a slow personal wander, both shrinking with distance
        const side = i === 0 ? 0 : (i % 2 ? 1 : -1) * (22 + q(1) * 26)
        const t = timeSec * 0.11 + q(2) * 50
        x += depth * (-(dy / len) * side + 9 * (noise1(t, seed + i) - 0.5))
        y += depth * ((dx / len) * side + 14 * (noise1(t + 31.7, seed + i + 5) - 0.5))
        y -= 20 * Math.log1p(Math.exp((y - FLOOR_ROW) / 20)) // a soft floor: routes bend away from it, they never hit it
        // wings: a few calm beats, then a glide with the wings held a little raised
        const hz = 2.0 + q(3) * 0.7
        const flapping = smoothstep((noise1(timeSec * 0.21 + q(4) * 40, seed + i + 9) - 0.34) / 0.22)
        const beat = lerp(0.2, Math.sin(2 * Math.PI * (hz * timeSec + q(5))), flapping)
        // soft ends: out of / into the haze at the far end; the near end is off the plate, nothing to fade
        let opacity = flightOpacity * weight * (1 - smoothstep((s - 0.7) / 0.3)) * lerp(1.0, 0.68, e)
        opacity *= 1 - sunUp * (1 - smoothstep((Math.hypot(x - sunX, y - sunY) - 200) / 130))
        if (opacity <= 0.003) continue
        const bank = (bend > 0 ? 1 : -1) * heading * 0.1 + 0.07 * (noise1(t * 1.7, seed + i + 13) - 0.5)
        // far: the far wing is a little shorter; its sign says which wing that is (+ left, - right)
        out.push({ x, y, span: (21.5 + q(6) * 8.5) * depth * grow, beat, opacity, bank, far: heading * (0.84 + q(7) * 0.1) })
      }
    }
  }
  return out.length > MAX_BIRDS ? out.sort((a, b) => b.opacity - a.opacity).slice(0, MAX_BIRDS) : out
}
