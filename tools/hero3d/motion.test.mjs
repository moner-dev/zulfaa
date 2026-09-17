/* Tests for the hero phone's motion controller.
 *
 *   node --test tools/hero3d/motion.test.mjs
 *
 * The controller is pure: it never reads a clock or schedules anything. Time
 * is passed in, so every rule below is checked deterministically. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMotion, TIMING, DRAG } from "./motion.js";

const TAU = Math.PI * 2;
const PI = Math.PI;

function harness(opts = {}) {
  const log = { themes: [], poses: [], statuses: [] };
  const m = createMotion({
    theme: "light",
    ...opts,
    onTheme: (theme, info) => log.themes.push({ theme, ...info, angle: m.angle }),
    onPose: (pose) => log.poses.push(pose),
    onStatus: (s) => log.statuses.push(s),
  });
  let now = 0;
  const api = {
    m,
    log,
    get now() {
      return now;
    },
    // advance the clock in ~60 fps frames, calling frame() only when the
    // controller says it needs one now (wake === 0) or a timer is due
    advance(ms) {
      const end = now + ms;
      while (now < end) {
        const w = m.wake(now);
        if (w === Infinity) {
          now = end;
          break;
        }
        const step = w === 0 ? 16 : Math.min(w, end - now);
        now = Math.min(end, now + step);
        m.frame(now);
      }
      return api;
    },
    // drag by `total` radians in `steps` pointer moves, one frame apart
    drag(total, steps = 40) {
      for (let i = 0; i < steps; i++) {
        m.dragBy(total / steps, now);
        api.advance(16);
      }
      api.advance(300); // let the tracking settle while still held
      return api;
    },
    settled() {
      api.advance(20);
      return api;
    },
  };
  return api;
}

// the screen is hidden from the viewer when it faces more than 90° away
const hidden = (angle) => Math.cos(angle) < -0.2;

// ── the approved automatic presentation (unchanged) ────────────────────────

test("entrance runs for its duration, then the first hold is 3 s", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: true });
  assert.equal(h.m.state, "entering");
  h.advance(TIMING.entrance / 2);
  const mid = h.log.poses.at(-1);
  assert.ok(mid.entrance > 0 && mid.entrance < 1, "entrance progresses");
  h.advance(TIMING.entrance / 2 + 20);
  assert.equal(h.m.state, "hold");
  assert.equal(h.log.poses.at(-1).entrance, 1);
  const w = h.m.wake(h.now);
  assert.ok(w > TIMING.firstHold - 40 && w <= TIMING.firstHold, "first hold ~3000 ms, got " + w);
});

test("automatic cycle alternates symmetrically with 4.5 s holds", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.advance(TIMING.firstHold + 5);
  assert.equal(h.m.state, "turning");
  h.advance(TIMING.turn + 40);
  assert.equal(h.m.state, "hold");
  assert.equal(h.m.theme, "dark");
  const w1 = h.m.wake(h.now);
  assert.ok(w1 > TIMING.autoHold - 60 && w1 <= TIMING.autoHold, "auto hold ~4500, got " + w1);
  h.advance(TIMING.autoHold + TIMING.turn + 80);
  assert.equal(h.m.theme, "light", "dark -> light");
  h.advance(TIMING.autoHold + TIMING.turn + 80);
  assert.equal(h.m.theme, "dark", "light -> dark again");
  assert.deepEqual(h.log.themes.map((t) => t.theme), ["dark", "light", "dark"]);
  assert.ok(h.log.themes.every((t) => t.manual === false));
});

test("each automatic turn swaps exactly once, with the screen hidden, and ends exactly at 0", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.advance(TIMING.firstHold + 5);
  const before = h.log.poses.length;
  while (h.m.state === "turning") h.advance(16);
  assert.equal(h.log.themes.length, 1, "one swap");
  assert.ok(hidden(h.log.themes[0].angle), "swap while hidden, at " + h.log.themes[0].angle);
  assert.ok(h.log.themes[0].angle >= PI && h.log.themes[0].angle < PI + 0.45);
  const angles = h.log.poses.slice(before).map((p) => p.angle);
  assert.equal(angles.at(-1), 0, "settles exactly facing forward");
  for (const a of angles) assert.ok(a >= 0 && a <= TAU);
});

test("a manual toggle during a hold turns at once and then holds 10 s", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.advance(1000);
  h.m.toggle(h.now);
  assert.equal(h.m.state, "turning");
  h.advance(TIMING.turn + 40);
  assert.equal(h.m.theme, "dark");
  assert.equal(h.log.themes.at(-1).manual, true);
  const w = h.m.wake(h.now);
  assert.ok(w > TIMING.manualHold - 60 && w <= TIMING.manualHold, "manual hold ~10000, got " + w);
  h.advance(TIMING.manualHold - 100);
  assert.equal(h.m.state, "hold");
  h.advance(200);
  assert.equal(h.m.state, "turning", "automatic resumes after the manual hold");
});

test("one click during a turn queues exactly one follow-up turn; two clicks queue none", () => {
  let h = harness();
  h.m.begin(h.now, { entrance: false });
  h.advance(TIMING.firstHold + 5);
  h.advance(600);
  h.m.toggle(h.now);
  h.advance(TIMING.turn);
  assert.equal(h.m.state, "turning", "follow-up turn started without a hold");
  h.advance(TIMING.turn + 40);
  assert.equal(h.m.theme, "light");
  assert.deepEqual(h.log.themes.map((t) => t.theme), ["dark", "light"]);
  assert.equal(h.m.holdKind, "manual");

  h = harness();
  h.m.begin(h.now, { entrance: false });
  h.advance(TIMING.firstHold + 5);
  h.advance(600);
  h.m.toggle(h.now);
  h.m.toggle(h.now);
  h.advance(TIMING.turn);
  assert.equal(h.m.state, "hold", "no follow-up turn");
  assert.equal(h.m.theme, "dark", "the turn in progress is never reversed");
  assert.equal(h.m.holdKind, "manual");
});

test("rapid clicks never stack more than one pending turn", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.advance(500);
  for (let i = 0; i < 7; i++) h.m.toggle(h.now + i);
  h.advance(TIMING.turn * 4);
  assert.deepEqual(h.log.themes.map((t) => t.theme), ["dark"]);
});

test("a click during the entrance turns right after the phone settles", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: true });
  h.advance(300);
  h.m.toggle(h.now);
  assert.equal(h.m.state, "entering");
  h.advance(TIMING.entrance);
  assert.equal(h.m.state, "turning");
  h.advance(TIMING.turn + 40);
  assert.equal(h.m.theme, "dark");
});

test("paused: no automatic turns, and a manual change does not resume autoplay", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.setPaused(true, h.now);
  assert.equal(h.m.wake(h.now), Infinity);
  h.advance(60000);
  assert.equal(h.log.themes.length, 0);
  h.m.toggle(h.now);
  h.advance(TIMING.turn + 40);
  assert.equal(h.m.theme, "dark");
  assert.equal(h.m.paused, true);
  h.advance(60000);
  assert.equal(h.log.themes.length, 1);
});

test("play from a light, forward phone starts a fresh 4.5 s hold (no entrance)", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.setPaused(true, h.now);
  h.advance(20000);
  h.m.setPaused(false, h.now);
  assert.equal(h.m.state, "hold");
  const w = h.m.wake(h.now);
  assert.ok(w > TIMING.autoHold - 5 && w <= TIMING.autoHold, "fresh auto hold, got " + w);
  h.advance(TIMING.autoHold + 20);
  assert.equal(h.m.state, "turning");
  assert.ok(!h.log.statuses.slice(1).some((s) => s.state === "entering"), "never replays the entrance");
});

test("play from dark restores the forward light screen first, then holds", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.setPaused(true, h.now);
  h.m.toggle(h.now);
  h.advance(TIMING.turn + 40);
  assert.equal(h.m.theme, "dark");
  h.m.setPaused(false, h.now);
  assert.equal(h.m.state, "turning", "recovery turn");
  h.advance(TIMING.turn + 40);
  assert.equal(h.m.theme, "light");
  assert.equal(h.m.state, "hold");
  assert.equal(h.m.holdKind, "auto");
  assert.ok(hidden(h.log.themes.at(-1).angle), "dark -> light swapped while hidden");
});

test("pausing mid-turn lets the turn finish and settle", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.advance(TIMING.firstHold + 500);
  h.m.setPaused(true, h.now);
  h.advance(TIMING.turn);
  assert.equal(h.m.state, "hold");
  assert.equal(h.log.poses.at(-1).angle, 0);
  assert.equal(h.m.wake(h.now), Infinity);
});

test("offscreen during a hold: no catch-up; the hold restarts in full on return", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.advance(2500);
  h.m.setActive(false, h.now);
  assert.equal(h.m.wake(h.now), Infinity);
  h.advance(120000);
  assert.equal(h.log.themes.length, 0);
  h.m.setActive(true, h.now);
  const w = h.m.wake(h.now);
  assert.ok(w > TIMING.firstHold - 5 && w <= TIMING.firstHold, "full hold again, got " + w);
});

test("offscreen mid-turn: the turn continues from where it stopped, one swap only", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.advance(TIMING.firstHold + 5);
  h.advance(TIMING.turn * 0.3);
  const angleAway = h.log.poses.at(-1).angle;
  h.m.setActive(false, h.now);
  h.advance(50000);
  h.m.setActive(true, h.now);
  h.m.frame(h.now);
  const angleBack = h.log.poses.at(-1).angle;
  assert.ok(Math.abs(angleBack - angleAway) < 0.08, `no jump: ${angleAway} -> ${angleBack}`);
  h.advance(TIMING.turn);
  assert.equal(h.log.themes.length, 1);
  assert.equal(h.m.state, "hold");
});

test("reduced motion: no entrance, no automatic turns, direct manual switching", () => {
  const h = harness({ calm: true });
  h.m.begin(h.now, { entrance: true });
  assert.equal(h.m.state, "hold");
  assert.equal(h.log.poses.at(-1).entrance, 1);
  h.advance(120000);
  assert.equal(h.log.themes.length, 0);
  h.m.toggle(h.now);
  assert.equal(h.m.state, "hold", "no turn");
  assert.equal(h.m.theme, "dark");
  assert.deepEqual(h.log.themes.map(({ theme, manual }) => ({ theme, manual })), [{ theme: "dark", manual: true }]);
  assert.ok(h.log.poses.every((p) => p.angle === 0));
});

test("before begin(): a toggle switches directly and becomes the starting theme", () => {
  const h = harness();
  h.m.toggle(0);
  assert.equal(h.m.theme, "dark");
  h.m.begin(10, { entrance: false });
  assert.equal(h.m.theme, "dark");
  h.advance(TIMING.manualHold + TIMING.turn + 80);
  assert.equal(h.m.theme, "light", "auto continues from the chosen theme");
});

test("status reports busy during turns and the paused flag", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.toggle(h.now);
  assert.equal(h.log.statuses.at(-1).busy, true);
  h.advance(TIMING.turn + 40);
  assert.equal(h.log.statuses.at(-1).busy, false);
  h.m.setPaused(true, h.now);
  assert.equal(h.log.statuses.at(-1).paused, true);
});

// ── direct drag ────────────────────────────────────────────────────────────

test("the phone cannot be grabbed before it is live or while it enters", () => {
  const h = harness();
  assert.equal(h.m.beginDrag(h.now), false, "idle");
  h.m.begin(h.now, { entrance: true });
  assert.equal(h.m.beginDrag(h.now), false, "entering");
  h.advance(TIMING.entrance + 20);
  assert.equal(h.m.beginDrag(h.now), true, "hold");
});

test("a full drag clockwise reveals the other theme once, swapped while hidden", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(TAU);
  assert.equal(h.m.state, "dragging");
  assert.equal(h.log.themes.length, 1);
  assert.equal(h.m.theme, "dark");
  assert.ok(hidden(h.log.themes[0].angle), "hidden at " + h.log.themes[0].angle);
  assert.equal(h.log.themes[0].manual, false, "a drag is not a saved theme choice");
  assert.equal(h.log.themes[0].drag, true);
});

test("a full drag counter-clockwise also reveals the other theme once", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(-TAU);
  assert.equal(h.log.themes.length, 1);
  assert.equal(h.m.theme, "dark");
  assert.ok(hidden(h.log.themes[0].angle));
});

test("small back-and-forth drags never flip the theme", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  for (let i = 0; i < 30; i++) h.drag(i % 2 ? -0.5 : 0.5, 6);
  assert.equal(h.log.themes.length, 0);
});

test("jitter across the back does not flip repeatedly", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(PI); // exactly facing away
  const flipsAtBack = h.log.themes.length;
  for (let i = 0; i < 40; i++) h.drag(i % 2 ? -DRAG.backBand * 0.8 : DRAG.backBand * 0.8, 4);
  assert.ok(h.log.themes.length - flipsAtBack <= 1, "at most one flip from jitter, got " + (h.log.themes.length - flipsAtBack));
});

test("reversing before the back changes nothing; reversing after it flips back", () => {
  let h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(0.7 * PI);
  h.drag(-0.7 * PI);
  assert.equal(h.log.themes.length, 0, "never reached the back");
  assert.equal(h.m.theme, "light");

  h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(1.4 * PI);
  assert.equal(h.m.theme, "dark");
  h.drag(-1.4 * PI);
  assert.equal(h.m.theme, "light", "back through the back: original theme");
  assert.equal(h.log.themes.length, 2);
  assert.ok(h.log.themes.every((t) => hidden(t.angle)));
});

test("several full turns alternate the theme once per turn", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(3 * TAU, 120);
  assert.deepEqual(h.log.themes.map((t) => t.theme), ["dark", "light", "dark"]);
});

test("holding the pointer still keeps control: no recovery, no frames", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(PI);
  assert.equal(h.m.wake(h.now), Infinity, "no frames while held still");
  h.advance(60000);
  assert.equal(h.m.state, "dragging");
});

test("grabbing an automatic turn takes over from the drawn angle without a snap", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.advance(TIMING.firstHold + 5);
  h.advance(TIMING.turn * 0.42);
  const angle = h.log.poses.at(-1).angle;
  const theme = h.m.theme;
  assert.equal(h.m.beginDrag(h.now), true);
  h.m.frame(h.now + 16);
  assert.ok(Math.abs(h.m.angle - angle) < 1e-6, `kept ${angle}, now ${h.m.angle}`);
  assert.equal(h.m.theme, theme, "the displayed theme is preserved");
  h.advance(10000);
  assert.equal(h.m.state, "dragging", "the automatic turn does not resume under the hand");
  assert.ok(Math.abs(h.m.angle - angle) < 1e-6);
});

test("release with the back facing: wait 4.5 s, return to a forward LIGHT screen, then autoplay", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(1.1 * PI); // back facing, past the swap -> dark
  assert.equal(h.m.theme, "dark");
  h.m.endDrag(h.now);
  assert.equal(h.m.state, "released");
  const w = h.m.wake(h.now);
  assert.ok(w > TIMING.autoHold - 40 && w <= TIMING.autoHold, "dwell ~4500 from release, got " + w);
  h.advance(TIMING.autoHold - 100);
  assert.equal(h.m.state, "released");
  h.advance(200);
  assert.equal(h.m.state, "turning", "recovery");
  h.advance(TIMING.turn + 40);
  assert.equal(h.m.state, "hold");
  assert.equal(h.m.theme, "light");
  assert.equal(h.log.poses.at(-1).angle, 0, "facing forward");
  const swap = h.log.themes.at(-1);
  assert.equal(swap.theme, "light");
  assert.ok(hidden(swap.angle), "no dark->light flash on the front");
  assert.equal(h.m.holdKind, "auto");
  h.advance(TIMING.autoHold + 20);
  assert.equal(h.m.state, "turning", "the automatic cycle resumes");
});

test("recovery when light and slightly turned takes a short route without a swap", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(0.35 * PI);
  h.m.endDrag(h.now);
  h.advance(TIMING.autoHold + 20);
  assert.equal(h.m.state, "turning");
  const start = h.now;
  while (h.m.state === "turning") h.advance(16);
  assert.ok(h.now - start < TIMING.turn, "short route, took " + (h.now - start));
  assert.equal(h.log.themes.length, 0);
  assert.equal(h.m.angle, 0);
});

test("recovery when dark but facing forward turns through the back", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(TAU); // forward again, dark
  h.m.endDrag(h.now);
  h.advance(TIMING.autoHold + TIMING.turn + 60);
  assert.equal(h.m.theme, "light");
  assert.ok(hidden(h.log.themes.at(-1).angle));
  assert.equal(h.m.angle, 0);
});

test("recovery skips motion when already forward and light", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(0.3);
  h.drag(-0.3);
  h.m.endDrag(h.now);
  h.advance(TIMING.autoHold + 20);
  assert.equal(h.m.state, "hold", "no turn needed");
  assert.equal(h.m.holdKind, "auto");
});

test("grabbing again during the dwell restarts it from the new release", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(PI);
  h.m.endDrag(h.now);
  h.advance(3000);
  h.m.beginDrag(h.now);
  h.drag(0.2);
  h.m.endDrag(h.now);
  const w = h.m.wake(h.now);
  assert.ok(w > TIMING.autoHold - 40, "restarted, got " + w);
});

test("grabbing during recovery interrupts it from the drawn angle", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(1.1 * PI);
  h.m.endDrag(h.now);
  h.advance(TIMING.autoHold + 20 + TIMING.turn * 0.3);
  assert.equal(h.m.state, "turning");
  const angle = h.m.angle;
  h.m.beginDrag(h.now);
  h.m.frame(h.now + 16);
  assert.ok(Math.abs(h.m.angle - angle) < 1e-6);
  assert.equal(h.m.state, "dragging");
});

test("paused: releasing never starts a return or autoplay", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.setPaused(true, h.now);
  h.m.beginDrag(h.now);
  h.drag(1.2 * PI);
  h.m.endDrag(h.now);
  h.advance(5000); // settle
  assert.equal(h.m.wake(h.now), Infinity);
  h.advance(120000);
  assert.equal(h.m.state, "released");
  assert.equal(h.m.theme, "dark");
});

test("play after a paused drag restores forward light, then a fresh hold", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.setPaused(true, h.now);
  h.m.beginDrag(h.now);
  h.drag(1.2 * PI);
  h.m.endDrag(h.now);
  h.advance(2000);
  h.m.setPaused(false, h.now);
  assert.equal(h.m.state, "turning");
  h.advance(TIMING.turn + 40);
  assert.equal(h.m.theme, "light");
  assert.equal(h.m.angle, 0);
  assert.equal(h.m.holdKind, "auto");
});

test("a toggle while released turns to the nearest front with the other theme", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.setPaused(true, h.now);
  h.m.beginDrag(h.now);
  h.drag(0.5 * PI); // light, side-on
  h.m.endDrag(h.now);
  h.advance(500);
  h.m.toggle(h.now);
  assert.equal(h.m.state, "turning");
  h.advance(TIMING.turn + 40);
  assert.equal(h.m.theme, "dark");
  assert.equal(h.m.angle, 0);
  assert.ok(hidden(h.log.themes.at(-1).angle));
  assert.equal(h.m.paused, true, "still paused");
  assert.equal(h.log.themes.at(-1).manual, true);
});

test("a toggle during a drag is applied on release, latest intent only", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(0.2 * PI);
  h.m.toggle(h.now);
  h.m.toggle(h.now);
  h.m.toggle(h.now); // odd: wants dark
  assert.equal(h.m.state, "dragging", "never interrupts the hand");
  h.m.endDrag(h.now);
  assert.equal(h.m.state, "turning");
  h.advance(TIMING.turn + 40);
  assert.equal(h.m.theme, "dark");
  assert.equal(h.m.holdKind, "manual");
});

test("going offscreen mid-drag releases cleanly; the dwell restarts on return", () => {
  const h = harness();
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.drag(PI);
  h.m.setActive(false, h.now);
  assert.equal(h.m.state, "released");
  h.advance(60000);
  h.m.setActive(true, h.now);
  const w = h.m.wake(h.now);
  assert.ok(w === 0 || w > TIMING.autoHold - 40, "no catch-up, got " + w);
  assert.equal(h.m.state, "released");
});

test("reduced motion: drag is direct (no smoothing) and never recovers", () => {
  const h = harness({ calm: true });
  h.m.begin(h.now, { entrance: false });
  h.m.beginDrag(h.now);
  h.m.dragBy(0.8, h.now);
  assert.equal(h.m.angle, 0.8, "applied at once");
  h.m.endDrag(h.now);
  h.advance(120000);
  assert.equal(h.m.state, "released");
  assert.equal(h.m.angle, 0.8);
  h.m.toggle(h.now);
  assert.equal(h.m.theme, "dark", "direct switch still available");
  assert.equal(h.m.state, "released");
});
