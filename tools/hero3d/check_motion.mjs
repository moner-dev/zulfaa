#!/usr/bin/env node
/* Browser acceptance checks for the hero phone: automatic motion, direct
 * rotation, controls, visibility, fallback, layouts and the clean background.
 *
 *   node tools/hero3d/check_motion.mjs [--only a,b,...] [--out DIR]
 *   sections: timeline, drag, recovery, pause, toggle, touch, visibility,
 *             calm, fallback, controls, background, layouts
 *
 * Headless Chrome on the hardware GPU, this tree served on a private port.
 * Real mouse and touch input through the DevTools protocol (not synthetic JS
 * calls). Long waits run with ?hero3d-speed=4 (all durations / 4, same code);
 * the timeline and one drag/recovery pass run at real speed. Every browser
 * call has a timeout, and each result is appended to results.txt as it is
 * known, so a stuck step is visible instead of silent.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { serve, launch, sleep } from "./cdp.mjs";

const argv = process.argv.slice(2);
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const ALL = "timeline,drag,recovery,pause,toggle,touch,visibility,calm,fallback,controls,background,layouts";
const ONLY = new Set(opt("--only", ALL).split(","));
const OUT = path.resolve(opt("--out", path.join(os.tmpdir(), "zulfaa-hero3d-check")));
fs.mkdirSync(OUT, { recursive: true });
const RESULTS = path.join(OUT, "results.txt");
fs.writeFileSync(RESULTS, "");
const BASE = { en: "", ar: "ar/", nl: "nl/" };
const T = { entrance: 1100, turn: 2400, firstHold: 3000, autoHold: 4500, manualHold: 10000 };
const PI = Math.PI;
const TAU = 2 * PI;

const { server, origin } = await serve();
const b = await launch({ gpu: "hardware" });
let failures = 0;
let total = 0;
function note(line) {
  console.log(line);
  fs.appendFileSync(RESULTS, line + "\n");
}
function check(name, ok, detail = "") {
  total++;
  if (!ok) failures++;
  note(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}
const near = (x, y, tol) => Math.abs(x - y) <= tol;
const hiddenAngle = (a) => Math.cos(a) < -0.2;

function withTimeout(p, ms, what) {
  let t;
  return Promise.race([p, new Promise((_, rej) => (t = setTimeout(() => rej(new Error("timeout: " + what)), ms)))]).finally(() => clearTimeout(t));
}
const ev = (expr, ms = 45000) => withTimeout(b.evaluate(expr), ms, expr.slice(0, 60));
const cdp = (method, params = {}, ms = 20000) => withTimeout(b.send(method, params, b.S), ms, method);

/* sessionStorage is per origin: open a tiny same-origin file and clear it.
   Navigate without waiting for a load event (a plain-text document under
   emulation does not always report one), then poll until it is current. */
async function clearSessionStorage(preset = null) {
  await cdp("Page.navigate", { url: origin + "robots.txt" });
  const t0 = Date.now();
  for (;;) {
    let href = "";
    try {
      href = await withTimeout(b.evaluate(`location.href`), 3000, "href");
    } catch (e) {
      /* the document is being replaced */
    }
    if (href.endsWith("/robots.txt")) break;
    if (Date.now() - t0 > 15000) throw new Error("could not open robots.txt to clear storage");
    await sleep(100);
  }
  await ev(`try { sessionStorage.clear() } catch (e) {}`, 5000);
  if (preset) await ev(`(() => { const p = ${JSON.stringify(preset)}; for (const k in p) sessionStorage.setItem(k, p[k]); })()`, 5000);
}

async function load(lang, { w = 1920, h = 1080, mobile = false, dpr = 1, speed = 1, calm = false, keepStorage = false, touch = false, block = null, storage = null } = {}) {
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: calm ? "reduce" : "no-preference" }] });
  // Chrome requires maxTouchPoints in 1..16 even when touch emulation is off
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: 1 });
  await cdp("Network.setBlockedURLs", { urls: block ? [block] : [] });
  await withTimeout(b.viewport(w, h, mobile, dpr), 10000, "viewport");
  if (!keepStorage) await clearSessionStorage(storage);
  const q = "?hero3d-debug" + (speed !== 1 ? "&hero3d-speed=" + speed : "");
  await withTimeout(b.goto(origin + BASE[lang] + q), 30000, "goto " + lang);
  await ev(`document.documentElement.style.scrollBehavior = "auto"`);
  if (block) return;
  const ok = await ev(`new Promise((res) => { const t0 = Date.now(); (function w() {
    if (window.__hero3d) return res(true); if (Date.now() - t0 > 30000) return res(false); setTimeout(w, 50); })(); })`);
  if (!ok) throw new Error(`hero3d not ready: ${lang} ${w}x${h}`);
}
const st = () => ev(`window.__hero3d.state()`);
const log = () => ev(`window.__hero3d.events`);
const clearLog = () => ev(`window.__hero3d.events.length = 0`);
const waitState = (cond, ms = 30000) =>
  ev(
    `new Promise((res) => { const t0 = performance.now(); (function w() {
      const s = window.__hero3d.state(); if (${cond}) return res({ ok: true, s, t: performance.now() - t0 });
      if (performance.now() - t0 > ${ms}) return res({ ok: false, s, t: performance.now() - t0 }); setTimeout(w, 16); })(); })`,
    ms + 15000,
  );
const pageNow = () => ev(`performance.now()`);

// ── real input ──────────────────────────────────────────────────────────
async function deviceCenter() {
  return ev(`(() => { const d = window.__hero3d.deviceRect(); return { x: (d.left + d.right) / 2, y: (d.top + d.bottom) / 2, w: d.right - d.left }; })()`);
}
async function fullTurnPx() {
  return ev(`(() => { const i = window.__hero3d.info(); return i.css[0] * i.deviceWidthFraction * 1.35; })()`);
}
async function mouse(type, x, y, buttons = 0) {
  await cdp("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" ? (buttons ? "left" : "none") : "left", buttons, clickCount: type === "mouseMoved" ? 0 : 1 });
}
/** press on the device, move by the given px list (segments), optionally hold, release */
async function mouseDrag(segments, { stepPx = 6, frameMs = 16, holdMs = 0, release = true, start = null } = {}) {
  const c = start || (await deviceCenter());
  let x = c.x;
  const y = c.y;
  await mouse("mousePressed", x, y, 1);
  for (const dx of segments) {
    const steps = Math.max(1, Math.round(Math.abs(dx) / stepPx));
    for (let i = 0; i < steps; i++) {
      x += dx / steps;
      await mouse("mouseMoved", x, y, 1);
      await sleep(frameMs);
    }
  }
  if (holdMs) await sleep(holdMs);
  if (release) await mouse("mouseReleased", x, y, 0);
  return { x, y };
}
async function clickSel(sel) {
  const r = await ev(`(() => { const e = document.querySelector("${sel}").getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; })()`);
  await mouse("mousePressed", r.x, r.y, 1);
  await mouse("mouseReleased", r.x, r.y, 0);
}
async function pressKeyOn(sel, key = " ") {
  await ev(`document.querySelector("${sel}").focus()`);
  const code = key === " " ? "Space" : "Enter";
  const vk = key === " " ? 32 : 13;
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, text: key === " " ? " " : "\r" });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk });
}
async function touchSwipe(dx, dy, steps = 24, frameMs = 16) {
  const c = await deviceCenter();
  let x = c.x;
  let y = c.y;
  await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  for (let i = 0; i < steps; i++) {
    x += dx / steps;
    y += dy / steps;
    await cdp("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y, id: 1 }] });
    await sleep(frameMs);
  }
  await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const themesIn = (events) => events.filter((e) => e.type === "theme");
const toggleMatchesTexture = (s) => s.toggle === (s.theme === "dark" ? "true" : "false") && s.shownTexture === s.theme;

async function section(name, fn) {
  if (!ONLY.has(name)) return;
  note(`\n── ${name} ──`);
  try {
    await fn();
  } catch (e) {
    check(`${name}: section completed`, false, e.message);
  }
}

try {
  // ── automatic presentation, real speed ─────────────────────────────────
  await section("timeline", async () => {
    await load("en");
    const r = await waitState(`window.__hero3d.events.filter(e => e.type === "theme").length >= 2 && s.state === "hold"`, 26000);
    const events = await log();
    const sts = events.filter((e) => e.type === "status");
    const spans = [];
    for (let i = 0; i < sts.length - 1; i++) if (sts[i].state !== sts[i + 1].state) spans.push({ state: sts[i].state, hold: sts[i].hold, ms: sts[i + 1].t - sts[i].t });
    const pick = (s, h, n = 0) => spans.filter((x) => x.state === s && (h === undefined || x.hold === h))[n];
    const ent = pick("entering"), fh = pick("hold", "first"), t1 = pick("turning", undefined, 0), ah = pick("hold", "auto"), t2 = pick("turning", undefined, 1);
    check("entrance ~1100 ms", r.ok && ent && near(ent.ms, T.entrance, 70), ent && ent.ms + " ms");
    check("first hold ~3000 ms", fh && near(fh.ms, T.firstHold, 70), fh && fh.ms + " ms");
    check("automatic turns ~2400 ms", t1 && t2 && near(t1.ms, T.turn, 70) && near(t2.ms, T.turn, 70), `${t1 && t1.ms} / ${t2 && t2.ms} ms`);
    check("reading hold after an automatic turn ~4500 ms", ah && near(ah.ms, T.autoHold, 70), ah && ah.ms + " ms");
    const th = themesIn(events);
    check("light -> dark -> light", th.map((e) => e.theme).join(",") === "dark,light", th.map((e) => e.theme).join(","));
    check("automatic swaps happen with the screen hidden", th.every((e) => hiddenAngle(e.angle)), th.map((e) => ((e.angle * 180) / PI).toFixed(1) + "°").join(" "));
    const s = await st();
    check("settles exactly facing forward, toggle = texture", s.angle === 0 && toggleMatchesTexture(s), JSON.stringify({ angle: s.angle, toggle: s.toggle, theme: s.theme, tex: s.shownTexture }));
    check("automatic changes are not saved or announced", (await ev(`sessionStorage.getItem("zulfaa-hero-theme")`)) === null && (await ev(`document.querySelector("[data-hero3d-status]").textContent`)) === "");
  });

  // ── direct rotation with a real mouse ──────────────────────────────────
  await section("drag", async () => {
    const S = 4;
    await load("en", { speed: S });
    await waitState(`s.state === "hold" && s.hold === "first"`, 8000);
    const full = await fullTurnPx();

    // hover sets the grab cursor but does not suspend anything
    const c = await deviceCenter();
    await mouse("mouseMoved", c.x, c.y, 0);
    await sleep(80);
    const hover = await ev(`document.querySelector(".phone3d-canvas").className`);
    const sHover = await st();
    check("hover: grab cursor, autoplay not suspended", /is-grabbable/.test(hover) && sHover.state === "hold", hover + " / " + sHover.state);
    await mouse("mouseMoved", 20, 20, 0);

    // one full clockwise turn
    await clearLog();
    await mouseDrag([full], { release: false });
    await sleep(250);
    let s = await st();
    let th = themesIn(await log());
    check("full turn clockwise: one swap, hidden, now dark", th.length === 1 && hiddenAngle(th[0].angle) && s.theme === "dark" && s.state === "dragging", `${th.length} swaps @ ${th.map((e) => e.angle.toFixed(2))}, ${s.theme}, ${s.state}`);
    check("drag swaps are not saved as the visitor's theme", (await ev(`sessionStorage.getItem("zulfaa-hero-theme")`)) === null && th.every((e) => !e.manual && e.drag));
    check("toggle follows the texture during a drag", toggleMatchesTexture(s));
    // held still: remains in control
    await sleep((T.autoHold * 2) / S);
    s = await st();
    check("pointer held still: stays in control, no recovery", s.state === "dragging" && !!s.grip && s.grip.recognized, s.state);
    const cur = await deviceCenter();
    await mouse("mouseReleased", cur.x + full, cur.y, 0);
    await waitState(`s.state === "released"`, 2000);

    // one full counter-clockwise turn back
    await ev(`window.__hero3d.setAngle(window.__hero3d.state().angle)`);
    await clearLog();
    await mouseDrag([-full], { holdMs: 200 });
    th = themesIn(await log());
    s = await st();
    check("full turn counter-clockwise: one swap, hidden, back to light", th.length === 1 && hiddenAngle(th[0].angle) && s.theme === "light", `${th.length} swaps, ${s.theme}`);

    // small back-and-forth: no flicker
    await clearLog();
    const small = full * 0.12;
    await mouseDrag([small, -small, small, -small, small, -small, small, -small], { holdMs: 150 });
    check("small back-and-forth drags: no theme change", themesIn(await log()).length === 0);

    // reverse before the back: nothing; reverse after it: back again
    await clearLog();
    await mouseDrag([full * 0.35, -full * 0.35], { holdMs: 150 });
    const before = themesIn(await log()).length;
    await clearLog();
    await mouseDrag([full * 0.7, -full * 0.7], { holdMs: 150 });
    th = themesIn(await log());
    s = await st();
    check("reversal before the back: no change; after it: returns to the same theme", before === 0 && th.length === 2 && th.every((e) => hiddenAngle(e.angle)) && s.theme === "light", `${before} / ${th.length} swaps, ${s.theme}`);

    // several turns
    await clearLog();
    await mouseDrag([full * 3], { stepPx: 8, holdMs: 250 });
    th = themesIn(await log());
    check("three full turns: dark, light, dark", th.map((e) => e.theme).join(",") === "dark,light,dark" && th.every((e) => hiddenAngle(e.angle)), th.map((e) => e.theme).join(","));
    check("phone stays the same size and place while turned", await ev(`(() => { const r = document.querySelector(".phone3d-canvas").getBoundingClientRect(), b = document.querySelector(".phone3d").getBoundingClientRect(); return Math.abs(r.top - b.top) < 0.5 && Math.abs(r.left - b.left) < 0.5 && Math.abs(r.width - b.width) < 0.5; })()`));

    // pointer starting on empty canvas space does not turn the phone
    const empty = await ev(`(() => { const c = document.querySelector(".phone3d-canvas").getBoundingClientRect(), d = window.__hero3d.deviceRect(); return { x: c.left + 4, y: (d.top + d.bottom) / 2, inside: c.left + 4 < d.left - 10 }; })()`);
    await clearLog();
    const a0 = (await st()).angle;
    await mouseDrag([full * 0.5], { start: empty });
    const a1 = (await st()).angle;
    check("drag starting beside the device does nothing", !empty.inside || a0 === a1, `${a0} -> ${a1}`);
  });

  // ── taking over an automatic turn, releasing, recovery, real speed ──────
  await section("recovery", async () => {
    await load("en");
    await waitState(`s.state === "turning"`, 8000);
    await sleep(T.turn * 0.4);
    const before = await st();
    const full = await fullTurnPx();
    const c = await deviceCenter();
    await mouse("mousePressed", c.x, c.y, 1);
    for (let i = 1; i <= 3; i++) {
      await mouse("mouseMoved", c.x + i * 2, c.y, 1);
      await sleep(16);
    }
    const grabbed = await st();
    check("grab mid-turn: taken over from the drawn angle, no snap", grabbed.state === "dragging" && Math.abs(grabbed.angle - before.angle) < 0.35, `${before.angle.toFixed(2)} -> ${grabbed.angle.toFixed(2)} rad`);
    check("grab mid-turn: displayed theme kept", grabbed.theme === before.theme && toggleMatchesTexture(grabbed), `${before.theme} / ${grabbed.theme}`);
    // leave the back facing the viewer (net about half a turn from here)
    const need = ((PI - (grabbed.angle % TAU) + TAU) % TAU) / TAU;
    let x = c.x + 6;
    const dxTotal = need * full;
    const steps = Math.max(1, Math.round(dxTotal / 6));
    for (let i = 0; i < steps; i++) {
      x += dxTotal / steps;
      await mouse("mouseMoved", x, c.y, 1);
      await sleep(16);
    }
    await sleep(300);
    const heldAtBack = await st();
    await mouse("mouseReleased", x, c.y, 0);
    const releaseT = await pageNow();
    const rel = await st();
    check("released with the back facing", rel.state === "released" && hiddenAngle(rel.angle), `${((rel.angle * 180) / PI).toFixed(0)}°, ${rel.state}`);
    // recovery starts after ~4.5 s from release
    const rec = await waitState(`s.state === "turning"`, 8000);
    const waited = (await pageNow()) - releaseT;
    check("recovery waits the reading dwell after release (~4.5 s)", rec.ok && near(waited, T.autoHold, 250), waited.toFixed(0) + " ms");
    // grab during recovery, then let go again
    await sleep(150);
    const midRec = await st();
    const c2 = await deviceCenter();
    await mouse("mousePressed", c2.x, c2.y, 1);
    await mouse("mouseMoved", c2.x + 6, c2.y, 1);
    await sleep(40);
    const grab2 = await st();
    check("grab during recovery: interrupts from the drawn angle", grab2.state === "dragging" && Math.abs(grab2.angle - midRec.angle) < 0.4, `${midRec.angle.toFixed(2)} -> ${grab2.angle.toFixed(2)}`);
    await mouse("mouseReleased", c2.x + 6, c2.y, 0);
    const release2 = await pageNow();
    await clearLog();
    const rec2 = await waitState(`s.state === "hold"`, 12000);
    const events = await log();
    const recTurnStart = events.find((e) => e.type === "status" && e.state === "turning");
    check("new release restarts the dwell (not continued)", recTurnStart && recTurnStart.t - release2 > T.autoHold - 300, recTurnStart && (recTurnStart.t - release2).toFixed(0) + " ms");
    const sw = themesIn(events);
    check("recovery ends facing forward on LIGHT, toggle synced", rec2.ok && rec2.s.angle === 0 && rec2.s.theme === "light" && toggleMatchesTexture(rec2.s) && rec2.s.hold === "auto", JSON.stringify({ a: rec2.s.angle, theme: rec2.s.theme, hold: rec2.s.hold }));
    check("recovery swaps (if any) only while hidden", sw.every((e) => hiddenAngle(e.angle)), sw.map((e) => `${e.theme}@${((e.angle * 180) / PI).toFixed(0)}°`).join(" ") || "no swap needed");
    const auto = await waitState(`s.state === "turning"`, 7000);
    check("then the normal reading hold and the automatic cycle resume", auto.ok && near(auto.t, T.autoHold, 300), auto.t.toFixed(0) + " ms");
    check("recovery never saves a theme choice", (await ev(`sessionStorage.getItem("zulfaa-hero-theme")`)) === null);
    void heldAtBack;
  });

  // ── explicit pause ─────────────────────────────────────────────────────
  await section("pause", async () => {
    const S = 4;
    await load("nl", { speed: S });
    await waitState(`s.state === "hold"`, 8000);
    await clickSel(".motion-toggle");
    check("pause pressed", (await st()).paused === true && (await ev(`document.querySelector(".motion-toggle").getAttribute("aria-pressed")`)) === "true");
    const full = await fullTurnPx();
    await mouseDrag([full * 0.6], { holdMs: 150 });
    // the last few percent of tracking lag settles right after release (no inertia): read after it
    await sleep(400);
    const released = await st();
    await sleep((T.autoHold * 3) / S);
    const later = await st();
    check("paused: drag works, release starts no return and no autoplay", released.state === "released" && later.state === "released" && Math.abs(later.angle - released.angle) < 1e-3 && Math.abs(released.angle) > 1, `${released.state}/${later.state}, ${released.angle.toFixed(4)} -> ${later.angle.toFixed(4)} rad`);
    // toggle while paused: turns, stays paused
    await clickSel(".theme-demo");
    const t = await waitState(`s.state === "hold"`, 5000);
    await sleep((T.manualHold * 1.5) / S);
    const afterToggle = await st();
    check("paused: toggle turns to a forward screen and autoplay stays paused", t.ok && t.s.angle === 0 && afterToggle.state === "hold" && afterToggle.paused, JSON.stringify({ theme: t.s.theme, state: afterToggle.state }));
    // play: restore forward light (if needed) and a fresh hold, no entrance
    await clearLog();
    await clickSel(".motion-toggle");
    const back = await waitState(`s.state === "hold" && s.theme === "light" && s.angle === 0`, 6000);
    const playT = await pageNow();
    const next = await waitState(`s.state === "turning"`, 4000);
    const events = await log();
    check("play: forward light restored, no entrance replay", back.ok && !events.some((e) => e.type === "status" && e.state === "entering"), back.s.theme);
    check("play: a fresh 4.5 s hold before the next automatic turn", next.ok && near(((await pageNow()) - playT) * S, T.autoHold, 700), (((await pageNow()) - playT) * S).toFixed(0) + " ms real-equivalent");
    // pause during an automatic turn: it completes and stays still
    await clickSel(".motion-toggle");
    const done = await waitState(`s.state === "hold"`, 4000);
    await sleep((T.autoHold * 2) / S);
    check("pause mid-turn: the turn settles, then stays paused", done.ok && done.s.angle === 0 && (await st()).state === "hold");
  });

  // ── the theme toggle in different states ───────────────────────────────
  await section("toggle", async () => {
    const S = 4;
    await load("ar", { speed: S });
    await waitState(`s.state === "hold"`, 8000);
    await clickSel(".theme-demo");
    const turning = await waitState(`s.state === "turning"`, 400);
    check("toggle in a hold: turns at once (aria-busy)", turning.ok && (await ev(`document.querySelector(".theme-demo").getAttribute("aria-busy")`)) === "true");
    const held = await waitState(`s.state === "hold"`, 4000);
    check("toggle choice: saved, announced, 10 s manual hold", held.s.hold === "manual" && (await ev(`sessionStorage.getItem("zulfaa-hero-theme")`)) === "dark" && (await ev(`document.querySelector("[data-hero3d-status]").textContent`)).length > 0);
    // during a drag (keyboard on the toggle while the mouse holds the phone)
    const full = await fullTurnPx();
    const pos = await mouseDrag([full * 0.2], { release: false });
    await pressKeyOn(".theme-demo", " ");
    await sleep(60);
    const during = await st();
    check("toggle during a drag: never interrupts the hand, remembered", during.state === "dragging" && during.pending === "light", JSON.stringify({ state: during.state, pending: during.pending }));
    await mouse("mouseReleased", pos.x, pos.y, 0);
    const applied = await waitState(`s.state === "hold"`, 4000);
    check("…applied on release: forward light", applied.ok && applied.s.theme === "light" && applied.s.angle === 0 && applied.s.hold === "manual");
    // rapid clicks during a turn: one latest intent
    await clickSel(".theme-demo");
    await sleep(80);
    await clearLog();
    for (let i = 0; i < 3; i++) await clickSel(".theme-demo");
    await waitState(`s.state === "hold"`, 6000);
    const th = themesIn(await log());
    check("three rapid clicks mid-turn: exactly one follow-up", th.length === 2, th.map((e) => e.theme).join(","));
  });

  // ── touch: vertical scroll vs horizontal turn ──────────────────────────
  await section("touch", async () => {
    // Autoplay is paused through storage before load, so every angle change
    // below comes from the finger. Headless touch emulation scrolls any page
    // content only a few pixels per synthetic swipe, so "the page scrolls" is
    // judged the way the browser decides it: it takes the gesture for panning
    // (pointercancel to the page), exactly as it does over plain text, and the
    // phone neither starts a drag nor turns.
    const paused = { "zulfaa-hero-motion": "paused", "zulfaa-hero-drag-hint": "seen" };
    // `bypass` makes the canvas transparent to input for a controlled baseline:
    // the same swipe, at the same point and scroll position, on what lies beneath it
    const swipe = async (targetSel, where, dx, dy, bypass = false) => {
      await load("en", { w: 390, h: 844, mobile: true, dpr: 2, touch: true, storage: paused });
      await waitState(`s.stage === "live" && s.state === "hold"`, 10000);
      if (bypass) await ev(`document.querySelector(".phone3d-canvas").style.pointerEvents = "none"`);
      await ev(`(() => { const r = document.querySelector("${targetSel}").getBoundingClientRect(); window.scrollTo(0, Math.max(0, r.top + scrollY - innerHeight * 0.3)); })()`);
      await sleep(400);
      const p = await ev(`(() => { const d = window.__hero3d.deviceRect(), t = document.querySelector("${targetSel}").getBoundingClientRect();
        const pt = "${where}" === "device" ? { x: (d.left + d.right) / 2, y: (d.top + d.bottom) / 2 } : { x: t.left + Math.min(40, t.width / 2), y: t.top + t.height / 2 };
        window.__seen = []; for (const type of ["pointercancel", "pointerdown"]) window.addEventListener(type, (e) => window.__seen.push(type + "@" + (e.target.className || e.target.tagName)), { capture: true, passive: true });
        const under = document.elementFromPoint(pt.x, pt.y); return { ...pt, under: under ? String(under.className || under.tagName) : "", y: scrollY, angle: window.__hero3d.state().angle }; })()`);
      await clearLog();
      let x = p.x;
      let y = p.y;
      await cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
      for (let i = 0; i < 20; i++) {
        x += dx / 20;
        y += dy / 20;
        await cdp("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y, id: 1 }] });
        await sleep(16);
      }
      await cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(600);
      const r = await ev(`(() => { const s = window.__hero3d.state(); return { y: scrollY, angle: s.angle, state: s.state, seen: window.__seen, drags: window.__hero3d.events.filter(e => e.type === "drag").map(e => e.phase) }; })()`);
      return { under: p.under, scroll: r.y - p.y, turned: r.angle - p.angle, state: r.state, cancelled: r.seen.some((s) => s.startsWith("pointercancel")), drags: r.drags };
    };
    const plain = await swipe(".hero .tagline", "text", 0, -200);
    const beneath = await swipe(".phone3d", "device", 0, -200, true);
    const vertical = await swipe(".phone3d", "device", 0, -200);
    const slanted = await swipe(".phone3d", "device", 24, -170);
    const horizontal = await swipe(".phone3d", "device", 150, 4);
    note(`INFO  plain text: ${JSON.stringify(plain)}`);
    note(`INFO  same point, canvas transparent to input: ${JSON.stringify(beneath)}`);
    note(`INFO  phone, vertical: ${JSON.stringify(vertical)}`);
    note(`INFO  phone, mostly vertical: ${JSON.stringify(slanted)}`);
    note(`INFO  phone, horizontal: ${JSON.stringify(horizontal)}`);
    check("touch: the browser takes a vertical swipe on plain text for panning (baseline)", plain.cancelled);
    check("touch: vertical swipe on the phone is handed to the browser exactly as without the canvas; the phone does not turn", /phone3d-canvas/.test(vertical.under) && vertical.cancelled && vertical.drags.length === 0 && vertical.turned === 0 && Math.abs(vertical.scroll - beneath.scroll) <= 3, `scroll ${vertical.scroll} px (same point without the canvas ${beneath.scroll} px; text elsewhere ${plain.scroll} px), turned ${vertical.turned}`);
    check("touch: a mostly-vertical swipe on the phone does not turn it either", slanted.cancelled && slanted.drags.length === 0 && slanted.turned === 0);
    check("touch: horizontal swipe on the phone turns it, releases on lift, does not scroll", horizontal.drags.join(",") === "start,end" && Math.abs(horizontal.turned) > 0.5 && horizontal.state === "released" && Math.abs(horizontal.scroll) < 3, `turned ${horizontal.turned.toFixed(2)} rad, scroll ${horizontal.scroll}`);
  });

  // ── offscreen and hidden tab ───────────────────────────────────────────
  await section("visibility", async () => {
    const S = 4;
    await load("en", { speed: S });
    await waitState(`s.state === "hold"`, 8000);
    const full = await fullTurnPx();
    const pos = await mouseDrag([full * 0.3], { release: false });
    // simulate the tab being hidden mid-drag (document.hidden + visibilitychange)
    await ev(`(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); })()`);
    await sleep(50);
    const hiddenState = await st();
    check("tab hidden mid-drag: the drag is released cleanly", hiddenState.state === "released" && hiddenState.grip === null, JSON.stringify({ state: hiddenState.state, grip: hiddenState.grip }));
    await mouse("mouseReleased", pos.x, pos.y, 0);
    await clearLog();
    await sleep((T.autoHold * 3) / S);
    check("tab hidden: nothing advances", (await log()).filter((e) => e.type === "status" && e.state === "turning").length === 0);
    await ev(`(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); })()`);
    const backT = await pageNow();
    const rec = await waitState(`s.state === "turning"`, 4000);
    check("tab visible again: the dwell restarts in full, no catch-up", rec.ok && ((await pageNow()) - backT) * S > T.autoHold * 0.85, (((await pageNow()) - backT) * S).toFixed(0) + " ms real-equivalent");
    await waitState(`s.state === "hold"`, 4000);
    // offscreen during a hold
    await ev(`window.scrollTo(0, document.body.scrollHeight)`);
    await clearLog();
    await sleep((T.autoHold * 3) / S);
    check("offscreen: no turns", (await log()).filter((e) => e.type === "status" && e.state === "turning").length === 0);
    await ev(`window.scrollTo(0, 0)`);
    const back2 = await pageNow();
    const r2 = await waitState(`s.state === "turning"`, 4000);
    check("back on screen: full hold, no catch-up", r2.ok && ((await pageNow()) - back2) * S > T.autoHold * 0.85);
    // a real hidden tab, if this Chrome reports one
    try {
      const other = await withTimeout(b.send("Target.createTarget", { url: "about:blank", background: false }), 8000, "createTarget");
      await sleep(400);
      const hidden = await ev(`document.visibilityState`, 5000);
      note(`INFO  second tab opened; this tab reports visibilityState=${hidden}`);
      await withTimeout(b.send("Target.closeTarget", { targetId: other.targetId }), 8000, "closeTarget");
    } catch (e) {
      note("INFO  real background-tab check unavailable here: " + e.message);
    }
  });

  // ── reduced motion ─────────────────────────────────────────────────────
  await section("calm", async () => {
    await load("ar", { calm: true });
    const r = await waitState(`s.stage === "live" && s.state === "hold"`, 6000);
    const events = await log();
    check("reduced motion: no entrance, pause control hidden", r.ok && !events.some((e) => e.type === "status" && e.state === "entering") && (await ev(`document.querySelector(".motion-toggle").hidden`)));
    const full = await fullTurnPx();
    await mouseDrag([full * 0.3], { holdMs: 100 });
    const s = await st();
    check("reduced motion: drag is strictly user-driven", s.state === "released" && Math.abs(s.angle) > 0.5);
    await sleep(8000);
    const later = await st();
    check("reduced motion: no animated return or autoplay", later.state === "released" && later.angle === s.angle);
    await clickSel(".theme-demo");
    await sleep(80);
    const sw = await st();
    check("reduced motion: toggle switches directly", sw.theme === "dark" && sw.state === "released" && toggleMatchesTexture(sw));
  });

  // ── static fallback ────────────────────────────────────────────────────
  await section("fallback", async () => {
    await load("nl", { block: "*zulfaa-phone.glb*" });
    await sleep(3000);
    const f = await ev(`(() => { const p = document.querySelector(".phone3d"); return { stage: p.dataset.stage, canvas: !!document.querySelector(".phone3d-canvas"), still: getComputedStyle(document.querySelector(".still-light")).visibility, pause: document.querySelector(".motion-toggle").hidden, hint: document.querySelector(".drag-hint").hidden }; })()`);
    check("model unavailable: stills shown, no canvas, no pause, no hint", f.stage === "still" && !f.canvas && f.still === "visible" && f.pause && f.hint, JSON.stringify(f));
    await clickSel(".theme-demo");
    await sleep(100);
    check("model unavailable: toggle switches the stills", (await ev(`document.querySelector(".phone3d").dataset.theme`)) === "dark");
    await cdp("Network.setBlockedURLs", { urls: [] });
    for (let i = b.problems.length - 1; i >= 0; i--) if (/zulfaa-phone\.glb|ERR_BLOCKED|blockedbyclient/i.test(b.problems[i])) b.problems.splice(i, 1);
  });

  // ── controls and navigation are not intercepted ────────────────────────
  await section("controls", async () => {
    // The phone case uses a viewport tall enough to hold the whole hero, so no
    // control needs scrolling into view (elementFromPoint sees only the
    // viewport, and scrolling this RTL page pans it sideways through the
    // carousel's pre-existing overflow, which would misplace the clicks).
    for (const [lang, w, h, mobile] of [["en", 1920, 1080, false], ["ar", 390, 1500, true]]) {
      await load(lang, { w, h, mobile, dpr: mobile ? 2 : 1 });
      await waitState(`s.state === "hold"`, 8000);
      // navbar links folded into the closed drawer on a phone are not on screen
      // at all; the menu check below covers them
      const hits = await ev(`(() => { const at = (sel) => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return "absent";
          if (e.closest("#site-menu") && getComputedStyle(document.querySelector(".nav-toggle")).display !== "none") return "absent";
          const r = e.getBoundingClientRect(); if (r.bottom > innerHeight || r.top < 0) return "offscreen";
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top && (top === e || e.contains(top)) ? "ok" : (top ? top.className || top.tagName : "none"); };
        return { toggle: at(".theme-demo"), pause: at(".motion-toggle"), menu: at(".nav-toggle"), nav: at(".site-nav a"), lang: at(".topbar-lang-btn"), scrollX }; })()`);
      delete hits.scrollX;
      const ok = Object.values(hits).every((v) => v === "ok" || v === "absent");
      check(`${lang} ${w}: toggle, pause, menu, nav and language controls receive their own clicks`, ok, JSON.stringify(hits));
      if (mobile) {
        await clickSel(".nav-toggle");
        await sleep(400);
        const menu = await ev(`(() => ({ expanded: document.querySelector(".nav-toggle").getAttribute("aria-expanded"), links: [...document.querySelectorAll("#site-menu a")].filter(a => a.getClientRects().length).length }))()`);
        check(`${lang} ${w}: side menu opens over the hero`, menu.expanded === "true" && menu.links >= 5, JSON.stringify(menu));
        await b.screenshot(path.join(OUT, `menu-${lang}-${w}.png`));
        await clickSel(".drawer-close");
      }
    }
  });

  // ── the background is the same cream in both themes ────────────────────
  await section("background", async () => {
    for (const lang of ["en", "ar"]) {
      await load(lang, { calm: true });
      await waitState(`s.stage === "live"`, 6000);
      const shots = {};
      for (const theme of ["light", "dark"]) {
        await ev(`window.__hero3d.setTheme("${theme}")`);
        await sleep(700);
        const file = path.join(OUT, `background-${lang}-${theme}.png`);
        await b.screenshot(file);
        shots[theme] = file;
      }
      const boxes = await ev(`(() => { const r = (s) => { const e = document.querySelector(s).getBoundingClientRect(); return [e.left, e.top, e.right, e.bottom].map(Math.round); }; return { phone: r(".phone3d"), controls: r(".hero-controls"), wrap: r(".hero-wrap") }; })()`);
      fs.writeFileSync(path.join(OUT, `background-${lang}.json`), JSON.stringify(boxes));
      note(`INFO  background captures for ${lang}: ${shots.light} | ${shots.dark} (compare outside ${JSON.stringify(boxes.phone)} and ${JSON.stringify(boxes.controls)})`);
    }
  });

  // ── layouts ────────────────────────────────────────────────────────────
  await section("layouts", async () => {
    const LAYOUTS = [
      ["desktop-en", "en", 1920, 1080, false, 1],
      ["desktop-ar", "ar", 1920, 1080, false, 1],
      ["laptop-nl", "nl", 1366, 768, false, 1],
      ["ipad-landscape-ar", "ar", 1024, 1366, true, 2],
      ["ipad-portrait-nl", "nl", 768, 1024, true, 2],
      ["phone-en", "en", 390, 1500, true, 3],
      ["phone-ar", "ar", 390, 1500, true, 3],
      ["phone-s-nl", "nl", 320, 1400, true, 2],
    ];
    const EDGE = `(async () => { const img = new Image(); img.src = window.__hero3d.snapshot(); await img.decode();
      const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height; const g = cv.getContext("2d"); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, img.width, img.height).data, W = img.width, H = img.height; let edge = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8 && (x < 2 || y < 2 || x >= W - 2 || y >= H - 2)) edge++; return edge; })()`;
    for (const [name, lang, w, h, mobile, dpr] of LAYOUTS) {
      await load(lang, { w, h, mobile, dpr });
      const r = await waitState(`s.state === "hold"`, 9000);
      const lay = await ev(`(() => { const de = document.documentElement, p = document.querySelector(".phone3d").getBoundingClientRect(), c = document.querySelector(".hero-copy").getBoundingClientRect(), hero = document.querySelector(".hero-wrap").getBoundingClientRect();
        let over = 0; for (const el of document.querySelectorAll(".hero-wrap *")) { const q = el.getBoundingClientRect(); if (q.width && (q.right > innerWidth + 0.5 || q.left < -0.5)) over++; }
        return { side: p.left + p.width / 2 > innerWidth / 2 ? "right" : "left", stacked: c.bottom <= p.top + 1, heroOverflow: over, box: [Math.round(p.width), Math.round(p.height)] }; })()`);
      let worst = 0;
      for (let deg = 0; deg < 360; deg += 15) {
        await ev(`window.__hero3d.setAngle(${(deg * PI) / 180})`);
        worst = Math.max(worst, await ev(EDGE));
      }
      await ev(`window.__hero3d.setAngle(0)`);
      const expect = lay.stacked ? null : lang === "ar" ? "left" : "right";
      check(`${name}: live and placed (${lay.stacked ? "below the copy" : lay.side})`, r.ok && (expect === null || lay.side === expect), `box ${lay.box}`);
      check(`${name}: no clipping at 24 angles, nothing in the hero overflows`, worst === 0 && lay.heroOverflow === 0, `edge px ${worst}, overflowing hero elements ${lay.heroOverflow}`);
      await ev(`(() => { const r = document.querySelector(".hero-wrap").getBoundingClientRect(); window.scrollTo(0, Math.max(0, r.top + scrollY - 8)); })()`);
      await sleep(200);
      await b.screenshot(path.join(OUT, `layout-${name}.png`));
    }
  });

  // /favicon.ico is requested by Chrome itself on the plain-text robots.txt this
  // checker opens to clear storage (the home pages declare their own icon)
  const real = b.problems.filter((p) => !/X4122|\/favicon\.ico/.test(p));
  check("no console errors or failed requests", real.length === 0, real.slice(0, 5).join(" | "));
} catch (e) {
  check("run completed", false, e.stack || e.message);
} finally {
  b.close();
  server.close();
}
note(`\n${total} checks, ${failures} failed. Output in ${OUT}`);
process.exit(failures ? 1 : 0);
