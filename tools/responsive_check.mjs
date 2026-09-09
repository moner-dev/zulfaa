#!/usr/bin/env node
/* Responsive / navigation check for the ZULFAA website.
 *
 * Serves the repository root on a local port, drives headless Chrome over the
 * DevTools protocol (no npm dependencies: Node's built-in http, fetch and
 * WebSocket), and for every page x language x width prints
 *
 *   scrollWidth vs clientWidth/innerWidth  -> horizontal overflow yes/no
 *   whether the burger button is rendered   (".nav-toggle" visible)
 *   whether the language dropdown is there  (".lang-btn" visible)
 *   whether the header row wrapped onto two lines
 *
 * and saves a screenshot per cell (plus, with --states, one with the menu
 * open and one with the language dropdown open).
 *
 * Usage
 *   node tools/responsive_check.mjs [--out DIR] [--tag NAME] [--states]
 *                                   [--nojs] [--widths 1920,390] [--langs en,ar]
 *                                   [--pages ,privacy/] [--chrome PATH]
 *
 *   --nojs   runs every page with script execution disabled
 *            (Emulation.setScriptExecutionDisabled) and checks that the
 *            navigation links are still visible and reachable.
 *
 * Exit status is 1 when any cell overflows horizontally.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── arguments ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf(name);
  return i === -1 ? dflt : argv[i + 1];
};
const flag = (name) => argv.includes(name);

const OUT = path.resolve(opt("--out", path.join(os.tmpdir(), "zulfaa-responsive")));
const TAG = opt("--tag", "run");
const STATES = flag("--states");
const NOJS = flag("--nojs");
const CHROME =
  opt("--chrome", null) ||
  process.env.CHROME ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const ALL_WIDTHS = {
  1920: { h: 1080, mobile: false, note: "desktop" },
  1366: { h: 768, mobile: false, note: "laptop" },
  1024: { h: 768, mobile: true, note: "tablet landscape" },
  768: { h: 1024, mobile: true, note: "tablet portrait" },
  430: { h: 932, mobile: true, note: "phone L" },
  390: { h: 844, mobile: true, note: "phone" },
  320: { h: 568, mobile: true, note: "phone S" },
};
const WIDTHS = (opt("--widths", Object.keys(ALL_WIDTHS).join(",")))
  .split(",")
  .map((w) => parseInt(w, 10))
  .map((w) => ({ w, ...(ALL_WIDTHS[w] || { h: 900, mobile: w <= 1024, note: "custom" }) }));
const LANGS = opt("--langs", "en,ar,nl").split(",");
const PAGES = opt("--pages", ",privacy/,terms/,delete-data/,support/").split(",");
const BASE = { en: "", ar: "ar/", nl: "nl/" };

// ── static server ───────────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(SITE, p);
  if (!file.startsWith(SITE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}/`;

// ── headless Chrome over CDP ────────────────────────────────────────────────
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "zulfaa-chrome-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1920,1080",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
const wsUrl = await new Promise((resolve, reject) => {
  let buf = "";
  chrome.stderr.on("data", (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  chrome.on("exit", (c) => reject(new Error("chrome exited " + c + "\n" + buf)));
  setTimeout(() => reject(new Error("chrome did not start\n" + buf)), 15000);
});

const ws = new WebSocket(wsUrl);
await new Promise((r, j) => {
  ws.onopen = r;
  ws.onerror = j;
});
let seq = 0;
const pending = new Map();
const listeners = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(m.error.message)) : res(m.result);
  } else if (m.method) {
    for (const l of listeners) l(m);
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
const once = (method, sessionId) =>
  new Promise((res) => {
    const l = (m) => {
      if (m.method === method && m.sessionId === sessionId) {
        listeners.splice(listeners.indexOf(l), 1);
        res(m.params);
      }
    };
    listeners.push(l);
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId: S } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, S);
await send("Runtime.enable", {}, S);
if (NOJS) await send("Emulation.setScriptExecutionDisabled", { value: true }, S);

const evaluate = async (expression) => {
  const r = await send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    S,
  );
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception || {}).description);
  return r.result.value;
};

const METRICS = `(() => {
  const de = document.documentElement;
  const vis = (el) => !!el && el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== "hidden";
  let maxRight = 0, minLeft = 0;
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === "hidden" || o === "auto" || o === "scroll" || o === "clip") return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.position === "fixed") continue;
    if (clipped(el)) continue; // e.g. carousel slides inside their own scroller
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    maxRight = Math.max(maxRight, r.right);
    minLeft = Math.min(minLeft, r.left);
  }
  const brand = document.querySelector(".brand");
  const nav = document.querySelector(".site-nav");
  const lang = document.querySelector(".lang-switch");
  const toggle = document.querySelector(".nav-toggle");
  const langBtn = document.querySelector(".lang-btn");
  const navLinks = [...document.querySelectorAll(".site-nav a")];
  const rowTop = brand ? brand.getBoundingClientRect().top : 0;
  const wrapped = [nav, lang].filter(vis).some((el) => el.getBoundingClientRect().top > rowTop + 20);
  return {
    innerWidth, clientWidth: de.clientWidth, scrollWidth: de.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    maxRight: Math.round(maxRight), minLeft: Math.round(minLeft),
    burger: vis(toggle), langBtn: vis(langBtn),
    navInline: vis(nav), navLinksVisible: navLinks.filter(vis).length, navLinks: navLinks.length,
    langLinksVisible: [...document.querySelectorAll(".lang-switch a")].filter(vis).length,
    headerWrapped: wrapped,
    jsClass: de.classList.contains("js"),
    dir: de.dir || "ltr",
  };
})()`;

fs.mkdirSync(OUT, { recursive: true });
const shot = async (name) => {
  const { data } = await send("Page.captureScreenshot", { format: "png" }, S);
  fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(data, "base64"));
};

const rows = [];
let bad = 0;
const pageName = (p) => (p === "" ? "home" : p.replace("/", ""));

for (const lang of LANGS) {
  for (const page of PAGES) {
    for (const { w, h, mobile, note } of WIDTHS) {
      await send(
        "Emulation.setDeviceMetricsOverride",
        { width: w, height: h, deviceScaleFactor: 1, mobile },
        S,
      );
      const url = ORIGIN + BASE[lang] + page;
      const loaded = once("Page.loadEventFired", S);
      await send("Page.navigate", { url }, S);
      await loaded;
      // with script execution disabled the page cannot settle a promise, so
      // the no-JS run simply waits for the fonts on the clock instead
      if (NOJS) await new Promise((r) => setTimeout(r, 500));
      else await evaluate("document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => setTimeout(r, 60))))");
      const m = await evaluate(METRICS);
      const overflow =
        m.scrollWidth > m.clientWidth || m.scrollWidth > m.innerWidth ||
        m.maxRight > m.innerWidth + 0.5 || m.minLeft < -0.5;
      if (overflow) bad++;
      const id = `${TAG}-${lang}-${pageName(page)}-${w}`;
      await shot(id);
      const row = { lang, page: pageName(page), w, note, mobile, ...m, overflow };
      rows.push(row);
      console.log(
        `${lang.padEnd(2)} ${pageName(page).padEnd(11)} ${String(w).padStart(4)} ` +
          `scroll=${m.scrollWidth} client=${m.clientWidth} inner=${m.innerWidth} ` +
          `maxRight=${m.maxRight} minLeft=${m.minLeft} ` +
          `overflow=${overflow ? "YES" : "no"} burger=${m.burger ? "yes" : "no"} ` +
          `langBtn=${m.langBtn ? "yes" : "no"} navInline=${m.navInline ? "yes" : "no"} ` +
          `navLinks=${m.navLinksVisible}/${m.navLinks} langLinks=${m.langLinksVisible} ` +
          `wrapped=${m.headerWrapped ? "yes" : "no"} js=${m.jsClass ? "yes" : "no"}`,
      );

      if (STATES && !NOJS) {
        // open the burger menu, if there is one, and screenshot
        if (m.burger) {
          const r = await evaluate(`(() => {
            const b = document.querySelector(".nav-toggle"); b.focus(); b.click();
            const menu = document.getElementById(b.getAttribute("aria-controls"));
            const links = [...menu.querySelectorAll("a")];
            const vis = (el) => el.getClientRects().length > 0;
            const de = document.documentElement;
            let maxRight = 0, minLeft = 0;
            for (const el of menu.querySelectorAll("*")) { const q = el.getBoundingClientRect(); maxRight = Math.max(maxRight, q.right); minLeft = Math.min(minLeft, q.left); }
            return { expanded: b.getAttribute("aria-expanded"), visible: links.filter(vis).length, total: links.length,
                     scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, maxRight: Math.round(maxRight), minLeft: Math.round(minLeft),
                     bodyOverflow: getComputedStyle(document.body).overflow };
          })()`);
          await evaluate("new Promise(r => setTimeout(r, 250))");
          await shot(id + "-menu");
          const ok = r.expanded === "true" && r.visible === r.total && r.scrollWidth <= r.clientWidth && r.maxRight <= m.innerWidth + 0.5 && r.minLeft >= -0.5;
          if (!ok) bad++;
          row.menuOpen = r;
          console.log(`   menu open: aria-expanded=${r.expanded} links=${r.visible}/${r.total} scroll=${r.scrollWidth}/${r.clientWidth} panel=[${r.minLeft}..${r.maxRight}] ${ok ? "ok" : "PROBLEM"}`);
          // Escape closes and returns focus to the button
          await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }, S);
          await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }, S);
          const closed = await evaluate(`(() => { const b = document.querySelector(".nav-toggle"); return { expanded: b.getAttribute("aria-expanded"), focus: document.activeElement === b }; })()`);
          if (closed.expanded !== "false") bad++;
          console.log(`   escape: aria-expanded=${closed.expanded} focusOnButton=${closed.focus}`);
        }
        if (m.langBtn) {
          const r = await evaluate(`(() => {
            const b = document.querySelector(".lang-btn"); b.focus(); b.click();
            const menu = document.getElementById(b.getAttribute("aria-controls"));
            const links = [...menu.querySelectorAll("a")];
            const vis = (el) => el.getClientRects().length > 0;
            const de = document.documentElement;
            const q = menu.getBoundingClientRect();
            return { expanded: b.getAttribute("aria-expanded"), visible: links.filter(vis).length, total: links.length,
                     scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, left: Math.round(q.left), right: Math.round(q.right),
                     hrefs: links.map(a => a.getAttribute("href")) };
          })()`);
          await evaluate("new Promise(r => setTimeout(r, 250))");
          await shot(id + "-lang");
          const ok = r.expanded === "true" && r.visible === r.total && r.scrollWidth <= r.clientWidth && r.right <= m.innerWidth + 0.5 && r.left >= -0.5;
          if (!ok) bad++;
          row.langOpen = r;
          console.log(`   lang open: aria-expanded=${r.expanded} links=${r.visible}/${r.total} box=[${r.left}..${r.right}] hrefs=${r.hrefs.join(" ")} ${ok ? "ok" : "PROBLEM"}`);
          await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }, S);
          await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }, S);
          const closed = await evaluate(`(() => { const b = document.querySelector(".lang-btn"); return { expanded: b.getAttribute("aria-expanded"), focus: document.activeElement === b }; })()`);
          if (closed.expanded !== "false") bad++;
          console.log(`   escape: aria-expanded=${closed.expanded} focusOnButton=${closed.focus}`);
        }
      }
    }
  }
}

fs.writeFileSync(path.join(OUT, `${TAG}-results.json`), JSON.stringify(rows, null, 2));
console.log(`\n${rows.length} cells, ${bad} problem(s). Screenshots in ${OUT}`);

ws.close();
chrome.kill();
server.close();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(bad ? 1 : 0);
