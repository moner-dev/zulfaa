// ZULFAA Salah scene - Water Pass v2: how the LAKE behaves in each phase (web runtime only).
//
// The approved presets already own the lake's colour (water.deep_color) and base ripple strength. This table adds the
// things a still Blender frame never needed: how fast the surface moves, how much single ripples push the mirror
// image around, how soft the reflections are, and how strongly the sun and the moon glitter on it.
// Values are blended between phases with the same "look" weight as everything else, so the water changes continuously.
export const WATER_PHASES = {
  //         ripple  speed  push   soft   sheen  sunGlitter moonGlitter
  FAJR:    { ripple: 0.85, speed: 0.75, push: 0.85, soft: 1.12, sheen: 0.55, sun: 0.0, moon: 0.0 }, // cool, hushed, hazy; no glitter
  DHUHR:   { ripple: 1.0, speed: 1.0, push: 1.0, soft: 0.9, sheen: 0.8, sun: 1.0, moon: 0.0 }, //   clean and lively, clear sky in it
  ASR:     { ripple: 1.05, speed: 1.0, push: 1.05, soft: 0.98, sheen: 0.9, sun: 0.6, moon: 0.0 }, // more contrast, directional light
  MAGHRIB: { ripple: 1.0, speed: 0.9, push: 1.0, soft: 1.0, sheen: 0.75, sun: 1.2, moon: 0.0 }, //  bronze, a rich broken sun path
  ISHA:    { ripple: 0.8, speed: 0.65, push: 0.8, soft: 1.06, sheen: 0.5, sun: 0.0, moon: 1.0 }, //  dark, glossy, calm; lamps + a quiet moon path
}

const lerp = (a, b, w) => a + (b - a) * w

/** Timeline state -> the lake's behaviour right now (a blend of the two neighbouring phases). */
export function waterLook(st) {
  const [from, to] = st._timeline.segment.split('->')
  const w = st._timeline.weights.look
  const a = WATER_PHASES[from], b = WATER_PHASES[to]
  const out = {}
  for (const k of Object.keys(a)) out[k] = lerp(a[k], b[k], w)
  return out
}
