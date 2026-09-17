/* ZULFAA hero phone — how the app screenshot is put on the 3D screen.
 *
 * Measured on all six Start screenshots (Sept 2026): the texture pipeline is
 * lossless end to end (945x2055 source -> lossless WebP -> texture), and the
 * softness came from two places in our own rendering:
 *
 *  1. TRILINEAR MIPMAPS. At the hero's size the screen shows the 945 px image
 *     at 287-705 device px, and trilinear filtering blends in a mip level that
 *     is already smaller than the screen. Detail vs an ideal Lanczos downscale:
 *     58-65% as shipped, 82-89% for a plain <img>, 93-97% with a mip LOD bias
 *     of -0.5. Mipmaps stay on; the bias only moves the sampling to the
 *     sharper level.
 *
 *  2. PIXEL RATIO CAPPED AT 2. On a 3x phone the canvas was rendered at 2x and
 *     stretched 1.5x by the browser (39% detail). Up to 3x within a budget, 87%.
 *
 * SHIMMER. A negative bias can alias while the screen is foreshortened and
 * moving, so the bias is a uniform that is full only when the phone faces
 * forward and eases to 0 within the first ~20 degrees of a turn.
 *
 * No sharpening filter anywhere, and the screenshots are never altered.
 */
import { LinearMipmapLinearFilter, MeshBasicMaterial, SRGBColorSpace, Texture } from "three";

/** Mip LOD bias when the phone is stationary and facing forward. */
export const STATIONARY_BIAS = -0.5;
/** Angle over which the bias fades to 0 at the start (and back at the end) of a turn. */
export const BIAS_FADE_RAD = (20 * Math.PI) / 180;

export function makeScreenTexture(image, renderer) {
  const t = new Texture(image);
  t.colorSpace = SRGBColorSpace;
  t.flipY = false; // glTF UV convention (origin top-left)
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/**
 * The unlit display material, with a mip LOD bias uniform.
 * Returns { material, setBias(value) }.
 */
export function makeScreenMaterial() {
  const bias = { value: STATIONARY_BIAS };
  const material = new MeshBasicMaterial({ name: "M_Screen_Display", toneMapped: false });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMapBias = bias;
    shader.fragmentShader =
      "uniform float uMapBias;\n" +
      shader.fragmentShader.replace(
        "#include <map_fragment>",
        [
          "#ifdef USE_MAP",
          "  vec4 sampledDiffuseColor = texture2D( map, vMapUv, uMapBias );",
          "  diffuseColor *= sampledDiffuseColor;",
          "#endif",
        ].join("\n"),
      );
  };
  material.customProgramCacheKey = () => "zulfaa-screen-bias";
  return {
    material,
    setBias(value) {
      bias.value = value;
    },
    get bias() {
      return bias.value;
    },
  };
}

/** Bias for a given rotation angle (radians, 0..2π): full facing forward, 0 once turned. */
export function biasForAngle(angle, stationary = STATIONARY_BIAS, fade = BIAS_FADE_RAD) {
  const tau = Math.PI * 2;
  const a = ((angle % tau) + tau) % tau;
  const fromFront = Math.min(a, tau - a);
  const x = Math.min(1, fromFront / fade);
  const smooth = x * x * (3 - 2 * x);
  return stationary * (1 - smooth);
}

/**
 * Renderer pixel ratio: the device's own ratio (fractional ratios such as
 * 1.25 and 1.5 kept exactly), at most 3, and within a device-pixel budget.
 */
export function pixelRatioFor(cssWidth, cssHeight, devicePixelRatio, coarsePointer) {
  let pr = Math.min(Math.max(devicePixelRatio || 1, 1), 3);
  const budget = coarsePointer ? 1.6e6 : 2.4e6;
  const area = Math.max(1, cssWidth * cssHeight);
  if (area * pr * pr > budget) pr = Math.sqrt(budget / area);
  return pr;
}

/**
 * Sustained frame-time governor for turns. It never reacts to a single slow
 * frame: it lowers the ratio only when the median of the last `window` frame
 * intervals stays above `slowMs` for at least `minSamples` frames, and only
 * once per turn. `reset()` at the end of a turn restores full quality.
 */
export function createFrameGovernor({ slowMs = 22, window = 36, minSamples = 30, floorRatio = 1.5 } = {}) {
  let samples = [];
  let last = 0;
  let reduced = false;
  return {
    /** Feed a rAF timestamp; returns a reduced pixel ratio to switch to, or null. */
    sample(now, currentRatio) {
      // an interval longer than 250 ms is a pause (the pointer rested, a
      // frame was not needed), not a slow frame: it is not a measurement
      if (last && now - last <= 250) samples.push(now - last);
      last = now;
      if (samples.length > window) samples.shift();
      if (reduced || samples.length < minSamples || currentRatio <= floorRatio) return null;
      const sorted = [...samples].sort((a, b) => a - b);
      const median = sorted[sorted.length >> 1];
      if (median <= slowMs) return null;
      reduced = true;
      return Math.max(floorRatio, currentRatio * 0.75);
    },
    reset() {
      samples = [];
      last = 0;
      reduced = false;
    },
    get reduced() {
      return reduced;
    },
  };
}
