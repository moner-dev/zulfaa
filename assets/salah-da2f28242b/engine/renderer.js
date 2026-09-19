// ZULFAA Salah scene - WebGL2 renderer. Two passes per frame:
//   A  what the lake mirrors  -> small HDR buffer (plate x  by  water rows)
//   B  the frame              -> sky, clouds, mountains, water (sampling A through the ripples), shore, mosque, foreground, AgX LUT
// No 3D geometry, no library: two full-screen triangles. All art is the approved Blender layers.
import { VERTEX, REFLECT_FRAGMENT, SCENE_FRAGMENT } from './shaders.js'
import { PLATE_LAYERS, sampleGradient } from './timeline.js'
import { waterLook } from './water.js'
import { birdsAt, MAX_BIRDS } from './birds.js'

const RAD = Math.PI / 180
const CARDS = ['L1_mountains_far', 'L2_mountain_right', 'L3_mountains_left', 'L4_far_shore']
const LUT = { file: 'view_lut_48.bin', n: 48, minEv: -12.0, maxEv: 6.5 }
const REFLECT_SIZE = [1600, 128] // wide and SHORT on purpose: crisp across, already soft down the streaks

// ---- light-transport constants (the only calibrated numbers in the runtime; everything else is preset data) ----
export const CAL = {
  cardAmbient: 0.7, //   share of the sky's mean radiance that reaches a camera-facing card (half sky, half lake)
  plateKeyFrom: [-0.345, -0.775, 0.53], // unit vector TOWARD L_PLATE_KEY (rotation 58 / 0 / -24 deg in the .blend)
  glitter: 13.0, //       radiance scale of the sun's broken reflection on the lake
  moonGlitter: 0.2, //   the moon's path is a whisper next to the sun's
  glitterSlope: 0.021, // rms slope (rad) of the ripples at ripple_strength 0.2
  volumeAmbient: 0.55, // clouds see the sky from above and the sides only: the dark lake fills the lower hemisphere
  mistAmbient: 0.8,
  starPresence: 0.64, // probability that a star cell holds a star at sky.stars.density 0.72
}

/** Blender's colour ramp, B_SPLINE interpolation (BKE_colorband_evaluate) - so the sky bends exactly like the approved one. */
export function evalRampBSpline(stops, pos) {
  const n = stops.length
  const P = (i) => stops[i].pos, C = (i) => stops[i].color
  if (n === 1) return C(0).slice()
  let a = 0
  while (a < n && P(a) <= pos) a++ // first stop to the right of pos (Blender's cbd1)
  let right, left, r2, l2
  if (pos <= P(0)) a = 0
  if (a === n) { right = { pos: 1, color: C(n - 1) }; left = stops[n - 1] } else if (a === 0) { right = stops[0]; left = { pos: 0, color: C(0) } } else { right = stops[a]; left = stops[a - 1] }
  if (a === n && P(n - 1) >= 1) return C(n - 1).slice()
  r2 = a >= n - 1 ? right : stops[a + 1]
  l2 = a < 2 ? left : stops[a - 2]
  const span = left.pos - right.pos
  const f = span !== 0 ? Math.max(0, Math.min(1, (pos - right.pos) / span)) : 0
  const f2 = f * f, f3 = f2 * f
  const t0 = -f3 / 6 + f2 / 2 - f / 2 + 1 / 6, t1 = f3 / 2 - f2 + 2 / 3, t2 = -f3 / 2 + f2 / 2 + f / 2 + 1 / 6, t3 = f3 / 6
  return [0, 1, 2].map((k) => t3 * l2.color[k] + t2 * left.color[k] + t1 * right.color[k] + t0 * r2.color[k])
}

const scale = (v, s) => v.map((x) => x * s)
const add = (a, b) => a.map((x, i) => x + b[i])
const mul = (a, b) => a.map((x, i) => x * b[i])

export class SalahRenderer {
  constructor(canvas) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false })
    if (!gl) throw new Error('WebGL2 is not available in this browser.')
    this.gl = gl
    this.floatTarget = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float')
    gl.getExtension('OES_texture_float_linear')
    this.timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2')
    this.stats = { textureBytes: 0, gpuMs: null, cpuMs: 0, frames: 0, birds: 0 }
    this.units = {}
    // distant birds: on by default; `birds = false` switches them off, a fixed `birdSeed` makes a moment repeatable
    this.birds = true
    this.birdSeed = Math.floor(Math.random() * 4096)
    this.birdOptions = {}
  }

  async load(base, onProgress = () => {}) {
    const gl = this.gl
    const j = (f) => fetch(base + f).then((r) => { if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`); return r })
    this.scene = await (await j('scene.json')).json()
    this.presets = await (await j('phase_presets.json')).json()
    const L = this.scene.layers, M = this.scene.masks
    const jobs = [
      ['uTexL1', L.L1_mountains_far.file, true], ['uTexL2', L.L2_mountain_right.file, true], ['uTexL3', L.L3_mountains_left.file, true],
      ['uTexL4', L.L4_far_shore.file, true], ['uTexL5', L.L5_mosque_island.file, true], ['uTexL6', L.L6_foreground.file, true],
      ['uTexIslA', M.island_a.file, false], ['uTexIslB', M.island_b.file, false], ['uTexRim', M.mountain_rim.file, false],
      ['uTexTown', M.town_contact.file, false], ['uTexClouds', this.scene.clouds.file, false],
    ]
    let done = 0
    await Promise.all(jobs.map(async ([name, file, srgb], unit) => {
      const blob = await (await j(file)).blob()
      const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
      const tex = gl.createTexture()
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
      // colour layers are sRGB textures: the GPU linearises BEFORE filtering, as Blender does
      gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp)
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      this.units[name] = unit
      this.stats.textureBytes += Math.round(bmp.width * bmp.height * 4 * 1.333)
      bmp.close()
      onProgress(++done / (jobs.length + 1))
    }))
    // Blender's view transform as a 3D LUT
    const lut = new Uint8Array(await (await j(LUT.file)).arrayBuffer())
    const lutUnit = jobs.length
    gl.activeTexture(gl.TEXTURE0 + lutUnit)
    gl.bindTexture(gl.TEXTURE_3D, gl.createTexture())
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB8, LUT.n, LUT.n, LUT.n, 0, gl.RGB, gl.UNSIGNED_BYTE, lut)
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_3D, p, gl.LINEAR)
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.CLAMP_TO_EDGE)
    this.units.uLut = lutUnit
    this.stats.textureBytes += lut.length
    // reflection buffer
    const reflUnit = lutUnit + 1
    this.reflTex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + reflUnit)
    gl.bindTexture(gl.TEXTURE_2D, this.reflTex)
    if (this.floatTarget) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, ...REFLECT_SIZE, 0, gl.RGBA, gl.HALF_FLOAT, null)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, ...REFLECT_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR)
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE)
    this.units.uTexRefl = reflUnit
    this.reflUnit = reflUnit
    this.stats.textureBytes += REFLECT_SIZE[0] * REFLECT_SIZE[1] * (this.floatTarget ? 8 : 4)
    this.fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.reflTex, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('reflection buffer is incomplete')
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    this.progReflect = this.program(VERTEX, REFLECT_FRAGMENT)
    this.progScene = this.program(VERTEX, SCENE_FRAGMENT)
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    for (const prog of [this.progReflect, this.progScene]) {
      const loc = gl.getAttribLocation(prog.p, 'aPos')
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    }
    this.buildSilhouette()
    onProgress(1)
  }

  program(vsSrc, fsSrc) {
    const gl = this.gl
    const mk = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s))
      return s
    }
    const p = gl.createProgram()
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc))
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsSrc))
    gl.bindAttribLocation(p, 0, 'aPos')
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p))
    const loc = {}
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '')
      loc[name] = gl.getUniformLocation(p, name)
    }
    return { p, loc }
  }

  /** The mountain skyline as seen from the camera: used to know how much of the sun disc the ridge hides. */
  buildSilhouette() {
    const s = this.scene
    this.ridge = s.silhouette_rows.map((v, i) => Math.min(v, s.right_ridge_rows[i] ?? 1e9))
  }

  sunVisibility(st) {
    const { focal_px: F, horizon_row: H, width: PW } = this.scene.plate
    const az = st.sun.azimuth * RAD, el = st.sun.elevation * RAD
    const x = PW / 2 + F * Math.tan(az), y = H - (F * Math.tan(el)) / Math.cos(az)
    const r = F * Math.tan(0.29 * RAD * st.sun.disc_scale)
    const above = Math.max(0, Math.min(1, (el / RAD + 0.4) / 0.8))
    if (x < 0 || x > PW - 1) return above
    const ridge = this.ridge[Math.max(0, Math.min(this.ridge.length - 1, Math.round(x / 4)))]
    return above * Math.max(0, Math.min(1, (ridge - (y - r)) / (2 * r)))
  }

  /** Timeline state (a preset-shaped object) -> shader uniforms. Every number comes from the presets except CAL. */
  uniformsFor(st, framing, timeSec) {
    const s = this.scene, U = {}
    U.uTime = [timeSec]
    // ---- sky ramp, sampled like Blender evaluates it
    const stops = st.sky.gradient.map((g) => ({ pos: Math.min(1, g.elevation / 30), color: scale(g.color, st.sky.strength) }))
    const ramp = []
    for (let i = 0; i < 32; i++) ramp.push(...evalRampBSpline(stops, i / 31))
    U.uSky = ramp
    const sunEl = st.sun.elevation
    const lowSunFade = Math.max(0, Math.min(1, (sunEl + 18) / 14)) // Blender: map range -18..-4 deg -> 0..1
    U.uSun = [st.sun.azimuth * RAD, sunEl * RAD]
    const gw = st.sky.glow_wide, gc = st.sky.glow_core
    U.uGlowWide = [...scale(gw.color, gw.intensity * lowSunFade * st.sky.strength), 0]
    U.uGlowCore = [...scale(gc.color, gc.intensity * lowSunFade * st.sky.strength), 0]
    U.uGlowSigma = [gw.sigma_az, gw.sigma_el, gc.sigma_az, gc.sigma_el].map((v) => v * RAD)
    U.uGlowEl = [Math.max(sunEl, st.sky.glow_center_elevation) * RAD]
    U.uSunDisc = [...scale(st.sun.disc_color, st.sun.disc_strength), 1.6 * RAD * st.sun.disc_scale]
    const sp = st.sky.stars
    const pxAngle = (framing.rect[2] / this.canvas.width) / s.plate.focal_px // radians per device pixel
    U.uStars = [sp.intensity, sp.fade_start_elevation * RAD, sp.fade_full_elevation * RAD, CAL.starPresence * (sp.density / 0.72)]
    U.uStars2 = [sp.glow, sp.color_variation, sp.moon_mask, Math.max(0.0187 * RAD, 0.85 * pxAngle)]
    const m = st.moon
    U.uMoon = [m.azimuth * RAD, m.elevation * RAD, m.visible ? m.fade : 0, 0.95 * RAD * m.disc_scale]
    U.uMoonCol = [...scale(m.color, m.disc_strength), m.earthshine]
    U.uMoonShape = [m.light_dir[0], m.light_dir[1], m.phase_offset, 0]
    const mg = st.sky.moon_glow
    U.uMoonGlowA = [...mg.color, mg.inner_intensity]
    U.uMoonGlowB = [mg.inner_sigma * RAD, mg.outer_intensity, mg.outer_sigma * RAD, 0]

    // ---- how much light the sky gives (means of the gradient; the sun's lobes are in front of the camera, behind the cards)
    let upW = 0, allW = 0, zenW = 0
    let up = [0, 0, 0], all = [0, 0, 0], zen = [0, 0, 0]
    for (let e = 1; e < 90; e += 3) {
      const c = scale(sampleGradient(st.sky.gradient, Math.min(e, 30)), st.sky.strength), ce = Math.cos(e * RAD), se = Math.sin(e * RAD)
      up = add(up, scale(c, ce * ce)); upW += ce * ce
      all = add(all, scale(c, ce)); allW += ce
      zen = add(zen, scale(c, se * ce)); zenW += se * ce
    }
    const skyFacing = scale(up, 1 / upW), skyAll = scale(all, 1 / allW), skyZenith = scale(zen, 1 / zenW)
    const vis = this.sunVisibility(st)
    const key = scale(st.sun.key_color, st.sun.key_strength)
    // The "cards" are not vertical: each relief mesh leans back (its ridge is far behind its base), so its face tilts
    // up toward the sky. That decides how much sky it sees and whether the high sun reaches it (Dhuhr yes, Maghrib no).
    const sunV = [Math.sin(st.sun.azimuth * RAD) * Math.cos(sunEl * RAD), Math.cos(st.sun.azimuth * RAD) * Math.cos(sunEl * RAD), Math.sin(sunEl * RAD)]
    U.uCardLight = CARDS.flatMap((n) => {
      const L = s.layers[n], run = L.depth / s.plate.focal_px, len = Math.hypot(run, L.lean)
      const N = [0, -run / len, L.lean / len] // facing the camera and the sky
      const dot = (v) => Math.max(0, N[0] * v[0] + N[1] * v[1] + N[2] * v[2])
      const ambient = add(scale(skyFacing, CAL.cardAmbient * (1 - N[2])), scale(skyZenith, N[2]))
      const plateKey = scale(st.sun.key_color, (st.sun.plate_key_strength * dot(CAL.plateKeyFrom)) / Math.PI)
      const sunKey = scale(st.sun.key_color, (st.sun.key_strength * dot(sunV) * vis) / Math.PI)
      return add(add(ambient, plateKey), sunKey)
    })

    // ---- plate cards
    const pl = st.plates
    const arr = (f) => CARDS.flatMap(f)
    U.uLRect = arr((n) => s.layers[n].rect)
    U.uLGeo = arr((n) => [s.layers[n].depth, s.layers[n].lean, s.layers[n].base_row, s.layers[n].z_top])
    U.uLRelight = arr((n) => [pl[n].flatten, pl[n].saturation, pl[n].gain, pl[n].gamma])
    U.uLWB = arr((n) => pl[n].white_balance)
    U.uLFlat = arr((n) => s.layers[n].flat_color)
    U.uLHaze = arr((n) => [...pl[n].haze_color, pl[n].haze])
    U.uLHazeSun = arr((n) => [...pl[n].haze_sun_color, pl[n].haze_sun])
    U.uLRim = CARDS.map((n) => pl[n].sun_rim)
    U.uLMirror = CARDS.map((n) => s.mirror_rows[n])
    U.uRimRect = s.masks.mountain_rim.rect
    U.uTownRect = s.masks.town_contact.rect
    U.uRimColor = pl.sun_rim_color
    U.uHazeSunSigma = [pl.haze_sun_sigma * RAD]
    U.uTown = [...st.mosque.town_color, st.mosque.town_emission]

    // ---- hero layers: the same closed-form light as the Blender materials
    const isl = pl.L5_mosque_island, fg = pl.L6_foreground, L = s.layers
    U.uIslRect = L.L5_mosque_island.rect
    U.uIslRelight = [isl.flatten, isl.saturation, isl.gain, isl.gamma]
    U.uIslWB = isl.white_balance
    U.uIslFlat = L.L5_mosque_island.flat_color
    U.uIslAmbient = isl.ambient
    U.uWindowColor = st.mosque.window_color
    U.uIslRimColor = st.mosque.rim_color
    U.uIslFx = [isl.noon_relight, isl.rock_cool, st.mosque.window_emission, st.mosque.practical_glow]
    U.uIslRim = [st.mosque.rim_left, st.mosque.rim_right]
    U.uIslWaterline = s.island_waterline_rows
    U.uFgRelight = [fg.flatten, fg.saturation, fg.gain, fg.gamma]
    U.uFgWB = fg.white_balance
    U.uFgFlat = L.L6_foreground.flat_color
    U.uFgAmbient = fg.ambient
    U.uFgFx = [fg.contact_shadow, framing.tree ?? 1, 0]

    // ---- atmosphere (single scattering: sky from everywhere + the sun through the phase function)
    U.uMist = [st.mist.near, st.mist.lake, st.mist.valley, st.mist.ranges]
    const mistAlbedo = [0.86, 0.9, 1.0]
    U.uMistAmb = scale(mul(mistAlbedo, skyAll), CAL.mistAmbient)
    U.uMistSun = mul(mistAlbedo, scale(key, vis / (4 * Math.PI)))
    const c = st.clouds
    U.uCloudRect = s.clouds.rect
    U.uCloudAmb = [...scale(skyAll, 0.92 * CAL.volumeAmbient), c.density]
    U.uCloudSun = scale(add(scale(key, vis), scale(c.underglow_color, c.underglow_strength)), 0.92 / (4 * Math.PI))

    // ---- water
    U.uWater = [...st.water.deep_color, st.water.ripple_strength]
    U.uWaterAmb = add(skyZenith, scale(key, (Math.max(0, sunV[2]) * vis) / Math.PI)) // the lake's diffuse base sees sky + sun
    const wl = waterLook(st) // Water Pass v2: per-phase behaviour of the lake, blended like everything else
    U.uGlitter = [...scale(key, vis * CAL.glitter * wl.sun), CAL.glitterSlope * (st.water.ripple_strength / 0.2)]
    U.uWaterFx = [wl.ripple, wl.speed, wl.push, wl.soft]
    U.uWaterFx2 = [wl.sheen, 0]
    U.uMoonGlitter = scale(m.color, m.disc_strength * (m.visible ? m.fade : 0) * wl.moon * CAL.moonGlitter)
    // ---- distant birds: a handful of numbers, and an empty box (= the shader's early exit) whenever the sky is empty
    const flock = this.birds ? birdsAt(st, framing, timeSec, this.birdSeed, this.birdOptions) : []
    const box = [1e9, 1e9, -1e9, -1e9]
    U.uBirds = new Array(MAX_BIRDS * 4).fill(0)
    U.uBirds2 = new Array(MAX_BIRDS * 4).fill(0)
    flock.forEach((b, i) => {
      U.uBirds.splice(i * 4, 4, b.x, b.y, b.span, b.beat)
      U.uBirds2.splice(i * 4, 4, b.opacity, b.bank, b.far, 0)
      const m = b.span * 0.7
      box[0] = Math.min(box[0], b.x - m); box[1] = Math.min(box[1], b.y - m); box[2] = Math.max(box[2], b.x + m); box[3] = Math.max(box[3], b.y + m)
    })
    U.uBirdBox = box
    U.uBirdPx = [framing.rect[2] / this.canvas.width]
    this.stats.birds = flock.length
    U.uFrame = framing.rect
    U.uResolution = [this.canvas.width, this.canvas.height]
    U.uLutDomain = [LUT.minEv, LUT.maxEv, LUT.n]
    return U
  }

  apply(prog, U) {
    const gl = this.gl
    gl.useProgram(prog.p)
    for (const [name, unit] of Object.entries(this.units)) if (prog.loc[name]) gl.uniform1i(prog.loc[name], unit)
    const sizes = { uSky: 3, uCardLight: 3, uLRect: 4, uLGeo: 4, uLRelight: 4, uLWB: 3, uLFlat: 3, uLHaze: 4, uLHazeSun: 4, uLRim: 1, uLMirror: 1, uIslWaterline: 4, uBirds: 4, uBirds2: 4 }
    for (const [name, v] of Object.entries(U)) {
      const loc = prog.loc[name]
      if (!loc) continue
      const n = sizes[name] ?? v.length
      gl[`uniform${n}fv`](loc, v)
    }
  }

  render(st, framing, timeSec) {
    const gl = this.gl, t0 = performance.now()
    const U = this.uniformsFor(st, framing, timeSec)
    let query = null
    if (this.timerExt && !this.pendingQuery) {
      query = gl.createQuery()
      gl.beginQuery(this.timerExt.TIME_ELAPSED_EXT, query)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.viewport(0, 0, ...REFLECT_SIZE)
    this.apply(this.progReflect, U)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.apply(this.progScene, U)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    if (query) {
      gl.endQuery(this.timerExt.TIME_ELAPSED_EXT)
      this.pendingQuery = query
    } else if (this.pendingQuery && gl.getQueryParameter(this.pendingQuery, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(this.timerExt.GPU_DISJOINT_EXT)) this.stats.gpuMs = gl.getQueryParameter(this.pendingQuery, gl.QUERY_RESULT) / 1e6
      gl.deleteQuery(this.pendingQuery)
      this.pendingQuery = null
    }
    this.stats.cpuMs = performance.now() - t0
    this.stats.frames++
  }
}
