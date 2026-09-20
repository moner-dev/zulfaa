// ZULFAA Salah scene - GLSL for the browser runtime.
//
// One 2D space for everything: PLATE PIXELS (1916 x 821, horizon on row 546, focal 2400 px). The camera never moves,
// so every approved Blender layer is simply an image in that space; depth only matters for draw order, fog and the
// lake's mirror. The shading below repeats the approved Blender materials term by term (same parameter names as
// phase_presets.json), and the final colour goes through a LUT baked from Blender's own AgX view transform.

export const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`

const COMMON = `#version 300 es
precision highp float;
precision highp sampler2D;
precision highp sampler3D;

const float PW = 1916.0, PH = 821.0, FOCAL = 2400.0, HORIZON = 546.0, CAM_H = 3.2;
const float PI = 3.14159265, RAD = 0.017453293;

uniform float uTime;
// ---- sky
uniform vec3 uSky[32];                 // Blender's B-spline colour ramp, sampled 0..30 deg of |elevation|
uniform vec2 uSun;                     // azimuth, elevation (rad)
uniform vec4 uGlowWide, uGlowCore;     // rgb * (intensity * low-sun fade)
uniform vec4 uGlowSigma;               // wide az, wide el, core az, core el (rad)
uniform float uGlowEl;                 // max(sun elevation, glow centre elevation)
uniform vec4 uSunDisc;                 // rgb * strength, half card (rad)
uniform vec4 uStars;                   // intensity, fade start, fade full (rad), presence probability
uniform vec4 uStars2;                  // glow, colour variation, moon mask, star radius (rad)
uniform vec4 uMoon;                    // azimuth, elevation (rad), fade, half card (rad)
uniform vec4 uMoonCol;                 // rgb * strength, earthshine
uniform vec4 uMoonShape;               // light dir x, y, phase offset, -
uniform vec4 uMoonGlowA;               // rgb, inner intensity
uniform vec4 uMoonGlowB;               // inner sigma, outer intensity, outer sigma (rad), -
// ---- clouds
uniform sampler2D uTexClouds;
uniform vec4 uCloudRect;
uniform vec4 uCloudAmb;                // rgb ambient source, density
uniform vec3 uCloudSun;                // key light * visibility + underglow (scaled by the phase function in the shader)
// ---- path-traced plate cards (L1 far, L2 right, L3 left, L4 shore)
uniform sampler2D uTexL1, uTexL2, uTexL3, uTexL4, uTexRim, uTexTown;
uniform vec4 uLRect[4], uLGeo[4];      // rect (plate px) | depth, lean, base row, z top
uniform vec4 uLRelight[4];             // flatten, saturation, gain, gamma
uniform vec3 uLWB[4], uLFlat[4];
uniform vec4 uLHaze[4], uLHazeSun[4];  // rgb, amount
uniform float uLRim[4], uLMirror[4];
uniform vec4 uRimRect, uTownRect;
uniform vec3 uRimColor, uCardLight[4]; // per card: (sky irradiance + plate key + sun key on its tilted face) / pi
uniform float uHazeSunSigma;
uniform vec4 uTown;                    // rgb, emission
// ---- hero layers (clean 2.5D: texture x preset light, exactly as in Blender)
uniform sampler2D uTexL5, uTexIslA, uTexIslB, uTexL6;
uniform vec4 uIslRect, uIslRelight;    // rect | flatten, saturation, gain, gamma
uniform vec3 uIslWB, uIslFlat, uIslAmbient, uWindowColor, uIslRimColor;
uniform vec4 uIslFx;                   // noon relight, rock cool, window emission, practical glow
uniform vec2 uIslRim;                  // left, right
uniform vec4 uIslWaterline[16];       // 64 waterline rows, packed 4 per vector
uniform vec4 uFgRelight;
uniform vec3 uFgWB, uFgFlat, uFgAmbient;
uniform vec3 uFgFx;                    // contact shadow, tree visibility, -
// ---- atmosphere
uniform vec4 uMist;                    // near, lake, valley, ranges densities
uniform vec3 uMistAmb, uMistSun;
// ---- distant birds (birds.js decides where they are; at most 12, often none)
uniform vec4 uBirds[12], uBirds2[12];  // x, y, wingspan (plate px), wing beat -1..1 | opacity, bank (rad), far-wing ratio (sign: + left wing, - right wing), -
uniform vec4 uBirdBox;                 // plate-px box around every bird in the air: min x, min y, max x, max y (empty = none)
uniform float uBirdPx;                 // plate pixels per device pixel

float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec3 hash32(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yxz + 33.33); return fract((q.xxy + q.yzz) * q.zyx); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }

vec3 rgb2hsv(vec3 c) {
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), d = mx - mn, h = 0.0;
  if (d > 1e-9) { if (mx == c.r) h = mod((c.g - c.b) / d, 6.0); else if (mx == c.g) h = (c.b - c.r) / d + 2.0; else h = (c.r - c.g) / d + 4.0; h /= 6.0; }
  return vec3(h, mx > 1e-9 ? d / mx : 0.0, mx);
}
vec3 hsv2rgb(vec3 c) { vec3 k = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return c.z * mix(vec3(1.0), k, c.y); }
vec3 hueSat(vec3 c, float sat, float val) { vec3 h = rgb2hsv(max(c, 0.0)); h.y = clamp(h.y * sat, 0.0, 1.0); h.z *= val; return hsv2rgb(h); }

/* The relight stage every plate material shares: flatten -> saturation / gain -> white balance -> gamma. */
vec3 relight(vec3 tex, vec4 r, vec3 flatC, vec3 wb) { return pow(max(hueSat(mix(tex, flatC, r.x), r.y, r.z) * wb, 0.0), vec3(r.w)); }

vec3 dirOf(vec2 p) { return normalize(vec3(p.x - PW * 0.5, FOCAL, HORIZON - p.y)); }
float hg(float c, float g) { return (1.0 - g * g) / (4.0 * PI * pow(max(1.0 + g * g - 2.0 * g * c, 1e-4), 1.5)); }
vec3 sunDir() { return vec3(sin(uSun.x) * cos(uSun.y), cos(uSun.x) * cos(uSun.y), sin(uSun.y)); }

// ------------------------------------------------------------------ sky, stars, sun, moon
float starField(float az, float el) {
  if (uStars.x <= 0.0) return 0.0;
  float cell = 0.92 * RAD;
  vec2 g = vec2(az, el) / cell, id = floor(g);
  float sum = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = id + vec2(float(i), float(j));
    vec3 h = hash32(c + 71.3);
    if (h.z > uStars.w) continue;                                   // this cell holds no star
    vec2 pos = (c + 0.5 + (h.xy - 0.5) * 0.7) * cell;               // jittered 0.7: neighbours can never touch
    float d = length((vec2(az, el) - pos) * vec2(cos(el), 1.0));
    float b = pow(hash12(c + 9.17), 3.0);                           // few bright, many faint
    float core = pow(clamp(1.0 - d / uStars2.w, 0.0, 1.0), 2.0);
    float soft = pow(clamp(1.0 - d / (uStars2.w * 3.5), 0.0, 1.0), 3.0) * uStars2.x;
    float tw = 1.0 + 0.06 * sin(uTime * (1.3 + 2.1 * h.x) + 40.0 * h.y);
    sum += (core + soft) * b * tw;
  }
  return sum;
}

vec3 skyColor(vec3 dir) {
  float el = asin(clamp(dir.z * 0.9999, -1.0, 1.0)), ela = abs(el), az = atan(dir.x, dir.y);
  float t = clamp(ela / (30.0 * RAD), 0.0, 1.0) * 31.0;
  int i = int(min(floor(t), 30.0));
  vec3 col = mix(uSky[i], uSky[i + 1], t - float(i));
  float daz = az - uSun.x, del = ela - uGlowEl;
  col += uGlowWide.rgb * exp(-(pow(daz / uGlowSigma.x, 2.0) + pow(del / uGlowSigma.y, 2.0)));
  col += uGlowCore.rgb * exp(-(pow(daz / uGlowSigma.z, 2.0) + pow(del / uGlowSigma.w, 2.0)));
  // moon aura (two lobes) - lives in the sky so it sits behind clouds and mountains
  vec2 dm = vec2(az - uMoon.x, el - uMoon.y);
  float md2 = dot(dm, dm);
  col += uMoonGlowA.rgb * (uMoonGlowA.a * exp(-md2 / (uMoonGlowB.x * uMoonGlowB.x)) + uMoonGlowB.y * exp(-md2 / (uMoonGlowB.z * uMoonGlowB.z)));
  // stars
  if (uStars.x > 0.0 && ela > uStars.y) {
    float fade = smoothstep(uStars.y, uStars.z, ela);
    float hide = uStars2.z * exp(-pow(md2 / pow(0.62 * RAD, 2.0), 2.0));
    float s = starField(az, el) * uStars.x * fade * (1.0 - clamp(hide, 0.0, 1.0));
    vec3 tint = mix(vec3(0.82, 0.90, 1.0), vec3(1.0, 0.88, 0.72), clamp(hash12(floor(vec2(az, el) / (0.92 * RAD)) + 3.3) * uStars2.y, 0.0, 1.0));
    col += tint * s;
  }
  // procedural sun: hot core, soft limb, faint corona
  vec2 ds = vec2(daz * cos(el), el - uSun.y) / uSunDisc.a;
  float rs = length(ds);
  if (rs < 1.0) {
    float core = smoothstep(0.0, 1.0, clamp((rs - 0.20) / (0.16 - 0.20), 0.0, 1.0));
    float a = clamp(core + 0.35 * pow(1.0 - rs, 3.0), 0.0, 1.0);
    col = mix(col, uSunDisc.rgb, a);
  }
  // procedural moon: crescent from an offset shadow circle, earthshine, soft maria, faint halo
  vec2 pm = vec2(dm.x * cos(el), dm.y) / uMoon.w;
  float rm = length(pm);
  if (rm < 1.0 && uMoon.z > 0.0) {
    const float R0 = 0.44;
    float disc = smoothstep(0.0, 1.0, clamp((rm - (R0 + 0.012)) / (-0.024), 0.0, 1.0));
    float lit = smoothstep(R0 - 0.05, R0 + 0.03, distance(pm, uMoonShape.xy * (-R0 * uMoonShape.z)));
    float albedo = mix(0.45, 1.0, clamp((fbm(pm * 3.2 + 5.0) - 0.35) / 0.35, 0.0, 1.0));
    float light = lit * albedo + uMoonCol.a * albedo;
    float halo = 0.10 * pow(clamp(1.0 - rm, 0.0, 1.0), 3.0);
    float cover = disc * (lit * 0.70 + 0.30), haloA = halo * (1.0 - disc);
    float aFull = clamp(cover + haloA, 0.0, 1.0);
    float amount = (light * cover + haloA) / max(aFull, 1e-4);
    col = mix(col, uMoonCol.rgb * amount, aFull * uMoon.z);
  }
  return col;
}

vec3 withClouds(vec3 col, vec2 p, vec3 dir) {
  vec2 q = p + vec2(10.0 * sin(uTime * 0.011) + 3.0 * vnoise(p * 0.004 + uTime * 0.013), 1.5 * vnoise(p.yx * 0.006 - uTime * 0.01));
  vec2 uv = (q - uCloudRect.xy) / uCloudRect.zw;
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return col;
  float a0 = texture(uTexClouds, uv).r;                              // coverage baked from the Blender volumes at density 2
  float a = 1.0 - exp(log(max(1.0 - a0, 1e-4)) * uCloudAmb.a * 0.5);
  vec3 j = uCloudAmb.rgb + uCloudSun * hg(dot(dir, sunDir()), 0.55) * 4.0 * PI;
  return mix(col, j, a);
}

// ------------------------------------------------------------------ distant birds
float sdTaper(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
/* Far-away birds are two bent strokes and a dot. Each wing is shoulder -> wrist -> tip; the beat lifts the tips into a
   shallow V and drops them into a gull's arch. They darken the sky behind them instead of painting a colour, so they
   take every phase's light and haze for free; drawn before the mountains, so ridges, mosque and tree hide them.
   Almost every pixel leaves at the first line: the box is empty whenever no bird is in the air. */
vec3 withBirds(vec3 col, vec2 p) {
  if (p.x < uBirdBox.x || p.x > uBirdBox.z || p.y < uBirdBox.y || p.y > uBirdBox.w) return col;
  float cover = 0.0;
  for (int i = 0; i < 12; i++) {
    vec4 b = uBirds[i], e = uBirds2[i];
    vec2 q = vec2(p.x - b.x, b.y - p.y);                              // y up
    if (e.x <= 0.0 || abs(q.x) > b.z * 0.62 || abs(q.y) > b.z * 0.52) continue;
    float c = cos(e.y), s = sin(e.y);
    q = vec2(c * q.x + s * q.y, c * q.y - s * q.x) / b.z;             // banked, in wingspans
    vec2 w = vec2(abs(q.x) / ((q.x < 0.0) == (e.z > 0.0) ? abs(e.z) : 1.0), q.y);   // the far wing is a little shorter
    float f = b.w;
    vec2 body = vec2(0.0, -0.035 * f);                                // the body rides against the wings
    vec2 wrist = vec2(0.23, 0.045 + 0.085 * f), tip = vec2(0.5 * (1.0 - 0.15 * f * f), 0.025 + 0.23 * f);
    float d = min(sdTaper(w, body, wrist, 0.058, 0.044), sdTaper(w, wrist, tip, 0.044, 0.014));
    d = min(d, length((q - body) * vec2(0.7, 1.0)) - 0.068);
    float aa = max(uBirdPx, 0.8) * 1.15;                              // never razor sharp: they are far away
    cover = max(cover, clamp(0.5 - d * b.z / aa, 0.0, 1.0) * e.x);
  }
  return mix(col, col * vec3(0.13, 0.14, 0.18), cover);
}

// ------------------------------------------------------------------ fog: closed-form optical depth of the four mist slabs
float slabOD(vec3 d, float hit, vec4 yz, vec2 sk, float amount) {   // yz = y0, y1, z0, z1 | sk = sigma, falloff
  if (amount <= 0.0 || hit <= yz.x) return 0.0;
  float s0 = yz.x / d.y, s1 = min(yz.y, hit) / d.y;
  if (abs(d.z) > 1e-6) {
    float ta = (yz.z - CAM_H) / d.z, tb = (yz.w - CAM_H) / d.z;
    s0 = max(s0, min(ta, tb)); s1 = min(s1, max(ta, tb));
  } else if (CAM_H < yz.z || CAM_H > yz.w) return 0.0;
  if (s1 <= s0) return 0.0;
  float dz = yz.w - yz.z, k = sk.y / dz, a = k * d.z;
  float base = exp(-k * (CAM_H - yz.z));
  float integral = abs(a) < 1e-7 ? (s1 - s0) : (exp(-a * s0) - exp(-a * s1)) / a;
  return sk.x * amount * base * integral;
}
vec3 fogged(vec3 col, vec3 d, float depth) {
  float od = slabOD(d, depth, vec4(70.0, 262.0, 0.05, 2.4), vec2(0.0016, 2.5), uMist.x)
           + slabOD(d, depth, vec4(300.0, 1300.0, 0.05, 34.0), vec2(0.0013, 3.5), uMist.y)
           + slabOD(d, depth, vec4(700.0, 3450.0, 0.05, 190.0), vec2(0.00040, 3.2), uMist.z)
           + slabOD(d, depth, vec4(3600.0, 10800.0, 0.05, 520.0), vec2(0.00016, 3.0), uMist.w);
  if (od <= 0.0) return col;
  float T = exp(-od);
  vec3 j = uMistAmb + uMistSun * hg(dot(d, sunDir()), 0.35) * 4.0 * PI;
  return col * T + j * (1.0 - T);
}

// ------------------------------------------------------------------ layers
vec4 card(sampler2D tex, int i, vec2 p, float rimMask, vec3 extra) {
  vec2 uv = (p - uLRect[i].xy) / uLRect[i].zw;
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return vec4(0.0);
  vec4 t = texture(tex, uv);
  if (t.a <= 0.002) return vec4(0.0);
  vec3 albedo = relight(t.rgb, uLRelight[i], uLFlat[i], uLWB[i]);
  vec3 col = albedo * uCardLight[i];
  // aerial perspective: per-layer haze, denser toward the base, plus a lobe of extra haze toward the sun
  float depth = uLGeo[i].x + max(0.0, uLGeo[i].z - p.y) * uLGeo[i].y;
  float z = CAM_H - (p.y - HORIZON) / FOCAL * depth;
  float hw = mix(1.25, 0.70, clamp(z / max(uLGeo[i].w, 1.0), 0.0, 1.0));
  float azHere = atan(p.x - PW * 0.5, FOCAL);
  float lobe = exp(-pow((azHere - uSun.x) / uHazeSunSigma, 2.0)) * uLHazeSun[i].a * hw;
  float hazeF = clamp(clamp(uLHaze[i].a * hw, 0.0, 1.0) + lobe, 0.0, 1.0);
  vec3 hazeC = mix(uLHaze[i].rgb, uLHazeSun[i].rgb, clamp(lobe / max(hazeF, 1e-4), 0.0, 1.0));
  col = mix(col, hazeC, hazeF);
  col += albedo * uRimColor * (rimMask * uLRim[i]) + extra;          // low-sun ridge light, town windows
  return vec4(col, t.a);
}
float islandWaterline(float x) {
  float f = clamp(x / (PW - 1.0), 0.0, 1.0) * 63.0; int i = int(min(floor(f), 62.0)), k = i + 1;
  return mix(uIslWaterline[i >> 2][i & 3], uIslWaterline[k >> 2][k & 3], f - float(i));
}
vec4 island(vec2 p) {
  vec2 uv = (p - uIslRect.xy) / uIslRect.zw;
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return vec4(0.0);
  vec4 t = texture(uTexL5, uv);
  if (t.a <= 0.002) return vec4(0.0);
  vec3 ma = texture(uTexIslA, uv).rgb, mb = texture(uTexIslB, uv).rgb;   // windows, lamp pools, rock | rim L, rim R, noon gain / 2
  vec3 c = relight(t.rgb, uIslRelight, uIslFlat, uIslWB) * ((mb.b * 2.0 - 1.0) * uIslFx.x + 1.0);
  c = mix(c, hueSat(c, 0.30, 0.92) * vec3(0.90, 0.98, 1.10), clamp(ma.b * uIslFx.y, 0.0, 1.0));
  vec3 col = c * (uIslAmbient + uWindowColor * (ma.g * uIslFx.w));
  col += t.rgb * uWindowColor * (ma.r * uIslFx.z) + uIslRimColor * (mb.r * uIslRim.x + mb.g * uIslRim.y);
  return vec4(col, t.a);
}
vec3 over(vec3 under, vec4 top, vec3 d, float depth) { return top.a <= 0.0 ? under : mix(under, fogged(top.rgb, d, depth), top.a); }

/* Everything above the water for plate position p. mirror = per-layer mirror row for the lake's reflection (0 = direct view). */
vec3 sceneAbove(vec2 p, bool mirrored) {
  vec2 ps = mirrored ? vec2(p.x, 2.0 * HORIZON - p.y) : p;
  vec3 d = dirOf(ps);
  vec3 col = fogged(withClouds(skyColor(d), ps, d), d, 1e9);
  if (!mirrored) col = withBirds(col, p);                            // too small to read in the lake: the mirror pass skips them
  vec3 rim = vec3(0.0);
  { vec2 uv = (ps - uRimRect.xy) / uRimRect.zw; if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) rim = texture(uTexRim, uv).rgb; }
  vec2 q;
  q = mirrored ? vec2(p.x, 2.0 * uLMirror[0] - p.y) : p; col = over(col, card(uTexL1, 0, q, mirrored ? 0.0 : rim.r, vec3(0.0)), dirOf(q), uLGeo[0].x);
  q = mirrored ? vec2(p.x, 2.0 * uLMirror[1] - p.y) : p; col = over(col, card(uTexL2, 1, q, mirrored ? 0.0 : rim.g, vec3(0.0)), dirOf(q), uLGeo[1].x);
  q = mirrored ? vec2(p.x, 2.0 * uLMirror[2] - p.y) : p; col = over(col, card(uTexL3, 2, q, mirrored ? 0.0 : rim.b, vec3(0.0)), dirOf(q), uLGeo[2].x);
  return col;
}
vec3 townLights(vec2 q) {
  vec2 uv = (q - uTownRect.xy) / uTownRect.zw;
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return vec3(0.0);
  return uTown.rgb * (texture(uTexTown, uv).r * uTown.a);
}
vec3 nearLand(vec3 col, vec2 p, bool mirrored) {
  vec2 q = mirrored ? vec2(p.x, 2.0 * uLMirror[3] - p.y) : p;
  col = over(col, card(uTexL4, 3, q, 0.0, townLights(q)), dirOf(q), uLGeo[3].x);
  q = mirrored ? vec2(p.x, 2.0 * islandWaterline(p.x) - p.y) : p;
  return over(col, island(q), dirOf(q), 274.0);
}
`

/* Pass A - what the lake mirrors. Rendered into a small HDR buffer: x = plate x, y = water rows 546..821. */
export const REFLECT_FRAGMENT = COMMON + `
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 p = vec2(vUv.x * PW, HORIZON + (1.0 - vUv.y) * (PH - HORIZON));
  outColor = vec4(min(nearLand(sceneAbove(p, true), p, true), vec3(60000.0)), 1.0);
}`

/* Pass B - the frame. */
export const SCENE_FRAGMENT = COMMON + `
in vec2 vUv;
out vec4 outColor;
uniform vec4 uFrame;                   // the framing, in plate pixels: x, y, w, h
uniform vec2 uResolution;
uniform sampler2D uTexRefl;
uniform sampler3D uLut;
uniform vec3 uLutDomain;               // min EV, max EV, N
uniform vec4 uWater;                   // deep rgb, ripple strength
uniform vec3 uWaterAmb;                // sky irradiance on the lake / pi
uniform vec4 uGlitter;                 // rgb * strength * visibility, sigma of the ripple slope (rad)
uniform vec4 uWaterFx;                 // ripple gain, speed, push (image displacement), softness (streak length)
uniform vec2 uWaterFx2;                // sheen (Fresnel response to the ripples), -
uniform vec3 uMoonGlitter;             // the moon's quiet path on the lake
uniform float uDebug;

/* value noise with analytic derivatives: one call gives a ripple layer's height AND its slope */
vec3 noised(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0), du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  float k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * vec2(b - a + k * u.y, c - a + k * u.x));
}
/* one travelling ripple layer in lake metres: wavelength (across, along the view), heading, speed (m/s), slope amplitude */
vec2 rippleLayer(vec2 P, vec2 wavelength, float heading, float speed, float amp, float seed) {
  float c = cos(heading), s = sin(heading);
  vec2 q = mat2(c, s, -s, c) * (P - vec2(s, -c) * speed * uTime) / wavelength + seed;
  vec2 g = noised(q).yz / wavelength;                                // d(height)/d(metres), in the layer's frame
  return mat2(c, -s, s, c) * g * amp;
}

/* A ripple layer as TWO wave trains that cross at a shallow angle and travel at different speeds. One train alone is a
   fixed pattern sliding down the screen; two of them interfere, so crests keep forming, merging and fading - the surface
   evolves instead of scrolling. The weights (0.8, 0.6) keep the layer's RMS slope exactly what a single train had, so a
   still frame has the same amount of ripple as before. */
vec2 rippleCrossing(vec2 P, vec2 wavelength, float heading, float fan, float speed, float amp, float seed) {
  return 0.8 * rippleLayer(P, wavelength, heading, speed, amp, seed)
       + 0.6 * rippleLayer(P, wavelength * vec2(0.87, 1.13), heading + fan, speed * 0.74, amp, seed + 41.3);
}

/* WATER PASS v3 - a calm lake that is never still (v2 + motion refinement: crossing wave trains, breathing far streaks).
   Three travelling ripple layers (long swell across the view, medium, fine). Where a ripple is bigger than a pixel it is
   RESOLVED: it tilts the surface, which pushes the mirror image, changes how much sky the surface reflects (Fresnel) and
   catches or loses the sun. Where ripples are smaller than a pixel they only BLUR the mirror image into streaks.
   Slow "slicks" of calmer and livelier water drift over the lake; ripples grow a little finer and busier at the shores. */
vec3 water(vec2 p, vec3 above) {
  float rows = p.y - HORIZON;
  float dw = FOCAL * CAM_H / max(rows, 0.05);                        // distance to the water at this pixel (m)
  vec2 P = vec2((p.x - PW * 0.5) / FOCAL * dw, dw);                  // lake position: x across, y away from the camera
  float foot = dw * dw / (FOCAL * CAM_H);                            // metres of lake covered by one plate row
  float att = mix(1.0, 0.22, clamp((dw - 20.0) / 680.0, 0.0, 1.0));  // the approved ripple distance fade

  // --- where the water meets land: the island / far shore waterline, and the near bank (foreground contact mask)
  float shoreRow = p.x < 1216.0 ? islandWaterline(p.x) : 559.0;
  float shore = exp(-max(p.y - shoreRow, 0.0) / 9.0);
  vec2 cuv = (p - uTownRect.xy) / uTownRect.zw;
  float bank = (cuv.x > 0.0 && cuv.x < 1.0 && cuv.y > 0.0 && cuv.y < 1.0) ? texture(uTexTown, cuv).g : 0.0;
  float edge = clamp(shore + bank * 0.9, 0.0, 1.0);

  // --- drifting slicks: patches of calmer and livelier water, so the surface never looks tiled or mechanical
  float slick = mix(0.55, 1.25, smoothstep(0.25, 0.75, vnoise(P / vec2(95.0, 60.0) + vec2(uTime * 0.011 * uWaterFx.y, -uTime * 0.017 * uWaterFx.y))));
  float amp = uWaterFx.x * slick * (uWater.a / 0.2) * (1.0 + 0.9 * edge);

  // --- ripple slopes. A layer counts as resolved once its wavelength spans about 2.5 rows of pixels.
  float r1 = clamp(2.6 / foot * 0.4 - 0.15, 0.0, 1.0), r2 = clamp(1.1 / foot * 0.4 - 0.15, 0.0, 1.0), r3 = clamp(0.42 / foot * 0.4 - 0.15, 0.0, 1.0);
  float sp = uWaterFx.y;
  vec2 g1 = rippleCrossing(P, vec2(13.0, 2.6), 0.10, -0.42, 0.62 * sp, 0.078, 0.0);
  vec2 g2 = rippleCrossing(P, vec2(4.2, 1.1), -0.45, 0.50, 0.50 * sp, 0.030, 19.7);
  vec2 g3 = rippleCrossing(P, vec2(1.5, 0.42), 0.60, -0.55, 0.36 * sp, 0.011 * (1.0 + 2.0 * edge), 7.3);
  vec2 slope = (g1 * r1 + g2 * r2 + g3 * r3) * amp;                  // resolved surface tilt (x across, y toward the far shore)
  float hidden = sqrt(max(1.0 - (0.55 * r1 * r1 + 0.30 * r2 * r2 + 0.15 * r3 * r3), 0.0));   // share of ripple energy below a pixel

  // far water, where no single ripple can be seen: broad soft bands of livelier and calmer water drift toward the viewer.
  // They carry the far field's motion: the reflection streaks grow a little longer and shorter as a band passes (here), and
  // the sheen brightens and dims with it (below) - one cause, two effects, so light and movement stay together.
  float bands = (vnoise(P / vec2(70.0, 9.0) + vec2(uTime * 0.024, uTime * 0.105) * uWaterFx.y) - 0.5) * 2.0;

  // --- the mirror image, read through the ripples
  float sig = (1.0 + 0.16 * hidden * bands) * 17.0 * uWaterFx.w * (uWater.a / 0.2) * mix(1.15, 0.85, att) * mix(0.55, 1.0, hidden) * mix(1.0, 0.8, edge);
  float push = 2.0 * FOCAL * slope.y * 0.085 * uWaterFx.z;            // resolved ripples move the image up / down...
  float pushX = FOCAL * slope.x * 0.052 * uWaterFx.z;                 // ...and sideways: long vertical edges (the minaret, lamp streaks) undulate by about a pixel
  float jit = hash12(gl_FragCoord.xy + 17.0);
  vec3 refl = vec3(0.0); float wsum = 0.0;
  for (int i = 0; i < 12; i++) {
    // seen at a grazing angle, ripple faces tilted toward the viewer count for more: the image is dragged DOWN toward the
    // viewer much further than up - that is what turns lamps into long streaks
    float z = mix(-3.4, 1.3, (float(i) + jit) / 12.0);
    float wgt = exp(-0.5 * z * z / (z < 0.0 ? 2.4 : 0.55));
    float dy = max(push + z * sig, -rows + 0.2);
    refl += texture(uTexRefl, vec2((p.x + pushX) / PW, 1.0 - (rows + dy) / (PH - HORIZON))).rgb * wgt;
    wsum += wgt;
  }
  refl /= wsum;
  refl *= 1.0 + 0.05 * hidden * uWaterFx2.x * bands;

  // --- Fresnel on the TILTED surface: a face leaning toward the viewer shows the dark water body, one leaning away
  //     shows the sky. This is the shading that makes ripples visible at all, and it travels with them.
  float cosT = clamp(rows / FOCAL + slope.y * uWaterFx2.x, 0.0015, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
  vec3 col = refl * fres + uWater.rgb * uWaterAmb * (1.0 - fres);
  col *= 1.0 - 0.12 * exp(-max(p.y - shoreRow, 0.0) / 1.8);          // wet contact line: land sits IN the water, not on it

  // --- glitter: ripple faces that happen to mirror the sun (or, far more quietly, the moon). The resolved slope moves
  //     the path and breaks it into travelling glints; the unresolved ripples give it its soft width.
  float elv = atan(rows / FOCAL), azp = atan(p.x - PW * 0.5, FOCAL);
  float sy = uGlitter.a * att * slick + 0.004;
  float twinkle = 0.75 + 0.5 * vnoise(P * vec2(0.9, 2.2) + vec2(uTime * 0.35, -uTime * 0.9));
  float needS = (uSun.y - elv) * 0.5 - slope.y * 0.55;
  float gs = exp(-0.5 * pow(needS / sy, 2.0)) * exp(-0.5 * pow((azp - uSun.x - slope.x * 0.5) / (0.0085 + 0.004 * (1.0 - att)), 2.0));
  col += uGlitter.rgb * (gs * twinkle * fres);
  float needM = (uMoon.y - elv) * 0.5 - slope.y * 0.55;
  float gm = exp(-0.5 * pow(needM / (sy * 1.25), 2.0)) * exp(-0.5 * pow((azp - uMoon.x - slope.x * 0.5) / 0.013, 2.0));
  col += uMoonGlitter * (gm * twinkle * fres);
  return fogged(col, dirOf(p), dw);
}

void main() {
  vec2 p = uFrame.xy + vec2(vUv.x, 1.0 - vUv.y) * uFrame.zw;
  vec3 col = sceneAbove(p, false);
  if (p.y > HORIZON) col = mix(col, water(p, col), clamp((p.y - HORIZON) / 1.2, 0.0, 1.0));
  col = nearLand(col, p, false);
  // foreground: contact shadow on the water it overhangs, then the (depth-of-field blurred) shrubs and tree
  { vec2 uv = (p - uTownRect.xy) / uTownRect.zw;
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) col *= 1.0 - clamp(texture(uTexTown, uv).g * uFgFx.x, 0.0, 1.0); }
  if (p.y > 0.0) {
    vec4 t = texture(uTexL6, p / vec2(PW, PH));
    float inTree = step(p.y, 330.0) * step(p.x, 430.0);
    t.a *= mix(1.0, uFgFx.y, inTree);
    col = mix(col, relight(t.rgb, uFgRelight, uFgFlat, uFgWB) * uFgAmbient, t.a);
  }
  // Blender's own view transform (AgX, Medium High Contrast), baked into a LUT
  vec3 x = clamp((log2(max(col, vec3(1e-9)) / 0.18) - uLutDomain.x) / (uLutDomain.y - uLutDomain.x), 0.0, 1.0);
  vec3 disp = texture(uLut, (x * (uLutDomain.z - 1.0) + 0.5) / uLutDomain.z).rgb;
  disp += (hash12(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;   // dither: no banding in the sky
  outColor = vec4(disp, 1.0);
}`
