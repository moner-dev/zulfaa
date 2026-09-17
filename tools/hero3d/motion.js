/* ZULFAA hero phone — the one motion controller.
 *
 * Pure logic: it never reads a clock, schedules a timer or touches the DOM.
 * The host passes `now` (ms) into every call, asks `wake(now)` when it next
 * needs a frame, and draws from the callbacks. Every rule below is tested in
 * motion.test.mjs.
 *
 * ANGLE AND THEME
 *   The phone has one continuous angle (radians, any number of turns). Which
 *   theme its screen shows is decided by how many times it has passed through
 *   facing directly away (180° + a full turn each time), counted with a ±12°
 *   hysteresis band. So the screen can only change while it is hidden, a full
 *   turn either way reveals the other theme, turning back through the back
 *   restores it, and jitter at the back cannot flip it repeatedly. Automatic
 *   turns, drags, recovery and the toggle all move the same angle.
 *
 * STATES
 *   idle       not live yet; the toggle switches directly
 *   entering   the 1100 ms descent; cannot be grabbed
 *   hold       facing forward, reading time: 3000 ms after the entrance,
 *              4500 ms after an automatic turn or a recovery, 10 000 ms after
 *              a turn the visitor asked for; then an automatic turn
 *   turning    an eased move to the nearest front showing the wanted theme:
 *              automatic turns, toggle turns and the recovery
 *   dragging   the visitor holds the phone; nothing automatic happens
 *   released   left where the visitor let go; after 4500 ms it returns to the
 *              nearest forward LIGHT screen (unless paused or calm)
 *
 * RULES
 *   - Grabbing takes over from the drawn angle: any turn is dropped where it
 *     is, the shown theme is kept, timers are cancelled.
 *   - Toggle during a hold or while released: turn at once. During the
 *     entrance, a turn or a drag: remember the latest intent (an even number
 *     of clicks cancels out) and apply it when that motion ends.
 *   - Paused: holds and the release dwell never expire; drags and toggles
 *     still work. Play restores the forward light screen (if needed) and
 *     starts a fresh 4500 ms hold. The entrance never replays.
 *   - Inactive (offscreen / tab hidden): nothing advances; a drag is released.
 *     On return holds and dwells restart in full; turns continue from where
 *     they stopped. Nothing catches up.
 *   - Calm (prefers-reduced-motion): no entrance, no automatic turn, no
 *     recovery; drags are applied directly and the toggle switches at once.
 */

export const TIMING = Object.freeze({
  entrance: 1100,
  turn: 2400,
  firstHold: 3000,
  autoHold: 4500,
  manualHold: 10000,
});

export const DRAG = Object.freeze({
  /** time constant of the (light) drag smoothing; no inertia after release */
  smoothMs: 45,
  /** hysteresis around the back-facing crossing */
  backBand: (12 * Math.PI) / 180,
  /** shortest route duration as a fraction of a full turn's duration */
  minRouteFraction: 0.3,
});

const PI = Math.PI;
const TAU = PI * 2;
const SNAP = 1e-3; // radians: below this the tracking lag is invisible

/** CSS-style cubic-bezier easing: returns y for x in [0, 1]. */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-7) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-7) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 40 && hi - lo > 1e-7; i++) {
      if (sx(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/** A controlled drop: fast start, long gentle deceleration, no overshoot. */
export const easeEntrance = cubicBezier(0.16, 1, 0.3, 1);
/** A deliberate, symmetric turn. */
export const easeTurn = cubicBezier(0.65, 0, 0.35, 1);

const other = (theme) => (theme === "dark" ? "light" : "dark");
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const parity = (n) => ((n % 2) + 2) % 2;

export function createMotion({
  theme = "light",
  calm = false,
  timing = TIMING,
  onPose = () => {},
  onTheme = () => {},
  onStatus = () => {},
} = {}) {
  let state = "idle";
  let base = theme === "dark" ? "dark" : "light"; // theme at winding 0
  let k = 0; // winding: which front the phone belongs to
  let a = 0; // drawn angle
  let target = 0; // where the hand wants it (dragging / released)
  let lastFrame = null;
  let paused = false;
  let active = true;
  let pending = null; // latest toggle intent during entering/turning/dragging
  let interacted = false;
  let anim = null; // { from, to, duration, theme, reason, manual }
  const run = { start: 0, progress: 0 };
  const hold = { kind: "first", start: 0, duration: timing.firstHold };
  let pose = { angle: 0, entrance: 0, t: 0 };

  const themeAt = (n) => (parity(n) === 0 ? base : other(base));
  const shown = () => themeAt(k);

  const status = () =>
    onStatus({
      state,
      theme: shown(),
      paused,
      busy: state === "turning",
      dragging: state === "dragging",
      pending,
      holdKind: state === "hold" || state === "released" ? hold.kind : null,
    });

  const emitPose = (entrance = 1, t = 1) => {
    pose = { angle: a, entrance, t };
    onPose(pose);
  };

  /** update the winding from the angle; announce a theme change (screen hidden) */
  function track(info) {
    const before = shown();
    const H = DRAG.backBand;
    while (a > PI * (2 * k + 1) + H) k++;
    while (a < PI * (2 * k - 1) - H) k--;
    const after = shown();
    if (after !== before) onTheme(after, info);
  }

  /** fold whole turns out of the angle without changing what is shown */
  function normalize() {
    const n = Math.round(a / TAU);
    if (n === 0) return;
    a -= n * TAU;
    target -= n * TAU;
    k -= n;
    if (parity(n) === 1) base = other(base);
    if (Math.abs(a) < 1e-12) a = 0;
    if (Math.abs(target) < 1e-12) target = 0;
  }

  /** nearest front (angle 2πn) that shows `wanted`; ties go forward */
  function frontFor(wanted) {
    const n0 = Math.round(a / TAU);
    let best = null;
    for (let n = n0 - 2; n <= n0 + 2; n++) {
      if (themeAt(n) !== wanted) continue;
      const d = Math.abs(n * TAU - a);
      if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && n > best.n)) best = { n, d };
    }
    return best;
  }

  function startHold(kind, now) {
    state = "hold";
    normalize();
    target = a;
    hold.kind = kind;
    hold.duration = kind === "first" ? timing.firstHold : kind === "manual" ? timing.manualHold : timing.autoHold;
    hold.start = now;
    emitPose();
    status();
  }

  /** move to the nearest front showing `wanted`; false if already there */
  function startGoTo(wanted, reason, manual, now) {
    const f = frontFor(wanted);
    if (f.d < 1e-4) {
      a = f.n * TAU;
      target = a;
      track({ manual });
      normalize();
      return false;
    }
    state = "turning";
    anim = {
      from: a,
      to: f.n * TAU,
      duration: timing.turn * Math.max(DRAG.minRouteFraction, Math.min(1, f.d / TAU)),
      theme: wanted,
      reason,
      manual,
    };
    run.start = now;
    run.progress = 0;
    status();
    return true;
  }

  function startRecover(now) {
    if (!startGoTo("light", "recover", false, now)) startHold("auto", now);
  }

  function afterMotion(now, holdKind) {
    const wanted = pending;
    pending = null;
    interacted = false;
    if (wanted && wanted !== shown()) {
      if (!startGoTo(wanted, "manual", true, now)) startHold("manual", now);
    } else {
      startHold(holdKind, now);
    }
  }

  function release(now) {
    if (state !== "dragging") return;
    if (calm) a = target;
    state = "released";
    hold.kind = "release";
    hold.duration = timing.autoHold;
    hold.start = now;
    lastFrame = now;
    if (pending && !calm) {
      const wanted = pending;
      pending = null;
      interacted = false;
      if (!startGoTo(wanted, "manual", true, now)) startHold("manual", now);
      return;
    }
    status();
  }

  return {
    get state() {
      return state;
    },
    get theme() {
      return shown();
    },
    get paused() {
      return paused;
    },
    get pending() {
      return pending;
    },
    get pose() {
      return pose;
    },
    get angle() {
      return a;
    },
    get holdKind() {
      return state === "hold" || state === "released" ? hold.kind : null;
    },

    /** The phone is ready and visible: play the entrance, or settle in place. */
    begin(now, { entrance = true } = {}) {
      if (state !== "idle") return;
      if (calm || !entrance) {
        const kind = interacted ? "manual" : "first";
        interacted = false;
        startHold(kind, now);
        return;
      }
      state = "entering";
      run.start = now;
      run.progress = 0;
      emitPose(0, 0);
      status();
    },

    /** The visitor pressed the day/night control. */
    toggle(now) {
      const current = state === "turning" ? anim.theme : shown();
      const want = other(pending || current);
      if (state === "idle" || calm) {
        if (want !== shown()) base = other(base);
        pending = null;
        if (state === "idle") interacted = true;
        onTheme(shown(), { manual: true });
        status();
        return;
      }
      if (state === "hold" || state === "released") {
        if (!startGoTo(want, "manual", true, now)) startHold("manual", now);
        return;
      }
      pending = want === current ? null : want;
      interacted = true;
      status();
    },

    /** Pointer recognised as a drag on the phone. False if it cannot be grabbed now. */
    beginDrag(now) {
      if (!active || state === "idle" || state === "entering") return false;
      anim = null; // take over from the drawn angle
      state = "dragging";
      target = a;
      lastFrame = now;
      status();
      return true;
    },

    /** Horizontal pointer travel, converted to radians by the host. */
    dragBy(delta, now) {
      if (state !== "dragging" || !delta) return;
      target += delta;
      if (calm) {
        a = target;
        emitPose();
        track({ manual: false, drag: true });
      }
    },

    endDrag(now) {
      release(now);
    },

    setPaused(value, now) {
      value = !!value;
      if (paused === value) return;
      paused = value;
      if (!paused && !calm && (state === "hold" || state === "released")) startRecover(now);
      status();
    },

    /** Offscreen or tab hidden: freeze (and let go). On return, no catch-up. */
    setActive(value, now) {
      value = !!value;
      if (active === value) return;
      if (!value && state === "dragging") release(now);
      active = value;
      if (active) {
        lastFrame = null;
        if (state === "entering") run.start = now - run.progress * timing.entrance;
        else if (state === "turning") run.start = now - run.progress * anim.duration;
        else if (state === "hold" || state === "released") hold.start = now;
      }
      status();
    },

    /** Advance to `now`. */
    frame(now) {
      if (!active) return;
      if (state === "entering") {
        run.progress = clamp01((now - run.start) / timing.entrance);
        emitPose(easeEntrance(run.progress), run.progress);
        if (run.progress >= 1) {
          emitPose();
          afterMotion(now, interacted ? "manual" : "first");
        }
      } else if (state === "turning") {
        run.progress = clamp01((now - run.start) / anim.duration);
        a = run.progress >= 1 ? anim.to : anim.from + (anim.to - anim.from) * easeTurn(run.progress);
        emitPose();
        track({ manual: anim.manual || interacted });
        if (run.progress >= 1) {
          const manual = anim.manual || interacted;
          anim = null;
          target = a;
          afterMotion(now, manual ? "manual" : "auto");
        }
      } else if (state === "dragging" || state === "released") {
        const dt = lastFrame === null ? 16 : Math.min(50, Math.max(0, now - lastFrame));
        lastFrame = now;
        const gap = target - a;
        if (gap !== 0) {
          const next = a + gap * (1 - Math.exp(-dt / DRAG.smoothMs));
          a = Math.abs(target - next) <= SNAP ? target : next;
          emitPose();
          track({ manual: false, drag: true });
        }
        if (state === "released" && a === target && !paused && !calm && now - hold.start >= hold.duration) startRecover(now);
      } else if (state === "hold") {
        if (!paused && !calm && now - hold.start >= hold.duration) startGoTo(other(shown()), "auto", false, now);
      }
    },

    /** ms until the next frame is needed: 0 = every frame, Infinity = idle. */
    wake(now) {
      if (!active || state === "idle") return Infinity;
      if (state === "entering" || state === "turning") return 0;
      if (state === "dragging") return target !== a ? 0 : Infinity;
      if (state === "released") {
        if (target !== a) return 0;
        if (paused || calm) return Infinity;
        return Math.max(0, hold.duration - (now - hold.start));
      }
      if (paused || calm) return Infinity;
      return Math.max(0, hold.duration - (now - hold.start));
    },
  };
}
