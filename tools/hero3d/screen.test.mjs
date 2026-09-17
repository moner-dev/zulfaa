/* Tests for the screen-quality policy.   node --test tools/hero3d/screen.test.mjs */
import { test } from "node:test";
import assert from "node:assert/strict";
import { biasForAngle, pixelRatioFor, createFrameGovernor, STATIONARY_BIAS, BIAS_FADE_RAD } from "./screen.js";

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("bias is full facing forward and fades to 0 within the fade angle, both directions", () => {
  assert.equal(biasForAngle(0), STATIONARY_BIAS);
  assert.ok(close(biasForAngle(Math.PI * 2), STATIONARY_BIAS));
  assert.ok(close(biasForAngle(BIAS_FADE_RAD), 0));
  assert.ok(close(biasForAngle(Math.PI), 0), "no bias with the screen turned away");
  assert.ok(close(biasForAngle(Math.PI * 2 - BIAS_FADE_RAD), 0));
  const mid = biasForAngle(BIAS_FADE_RAD / 2);
  assert.ok(mid < 0 && mid > STATIONARY_BIAS, "eases in between");
  // symmetric around the front
  assert.ok(close(biasForAngle(0.1), biasForAngle(Math.PI * 2 - 0.1)));
});

test("pixel ratio keeps fractional device ratios exactly and caps at 3", () => {
  assert.equal(pixelRatioFor(352, 704, 1, false), 1);
  assert.equal(pixelRatioFor(352, 704, 1.25, false), 1.25);
  assert.equal(pixelRatioFor(352, 704, 1.5, false), 1.5);
  assert.equal(pixelRatioFor(352, 704, 2, false), 2);
  assert.equal(pixelRatioFor(352, 704, 3, false), 3); // 2.23 M device px < 2.4 M
  assert.equal(pixelRatioFor(288, 576, 3, true), 3); // 1.49 M < 1.6 M
  assert.equal(pixelRatioFor(352, 704, 4, false), 3, "never above 3");
  assert.equal(pixelRatioFor(352, 704, 0.5, false), 1, "never below 1");
});

test("pixel ratio respects the device-pixel budget", () => {
  const pr = pixelRatioFor(352, 704, 3, true); // 2.23 M > 1.6 M touch budget
  assert.ok(pr < 3 && close(352 * 704 * pr * pr, 1.6e6, 1), "scaled into the budget, got " + pr);
});

test("governor ignores isolated slow frames", () => {
  const g = createFrameGovernor();
  let t = 0;
  let result = null;
  for (let i = 0; i < 60; i++) {
    t += i % 10 === 5 ? 80 : 16.7; // a hitch every 10 frames
    result = g.sample(t, 3) || result;
  }
  assert.equal(result, null);
  assert.equal(g.reduced, false);
});

test("governor reduces once for sustained slow frames, then resets", () => {
  const g = createFrameGovernor();
  let t = 0;
  const reductions = [];
  for (let i = 0; i < 80; i++) {
    t += 30; // ~33 fps, sustained
    const r = g.sample(t, 3);
    if (r) reductions.push(r);
  }
  assert.deepEqual(reductions, [2.25], "one reduction, 3 x 0.75");
  g.reset();
  assert.equal(g.reduced, false);
  assert.equal(g.sample(1000, 3), null, "needs fresh samples after reset");
});

test("governor treats pauses between drag moves as pauses, not slow frames", () => {
  const g = createFrameGovernor();
  let t = 0;
  let r = null;
  for (let i = 0; i < 120; i++) {
    t += i % 3 === 0 ? 400 : 16.7; // the pointer rests every few frames
    r = g.sample(t, 3) || r;
  }
  assert.equal(r, null);
});

test("governor never goes below its floor", () => {
  const g = createFrameGovernor();
  let t = 0;
  let r = null;
  for (let i = 0; i < 80; i++) {
    t += 40;
    r = g.sample(t, 1.5) || r;
  }
  assert.equal(r, null, "already at the floor");
});
