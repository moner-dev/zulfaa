#!/usr/bin/env node
/* ZULFAA - what a visitor actually receives on the 404, 403 and maintenance
 * pages, in English, Dutch and Arabic.
 *
 *   node tools/error_pages_check.mjs [--origin http://127.0.0.1:8081]
 *        [--out <dir>] [--simulate-404] [--gate-root <built copy with the gate on>]
 *
 * WHAT IT CHECKS, against a running origin (the DEV LAB front door by default -
 * this starts no server of its own):
 *
 *   HTTP     an unknown page answers 404 with the site's 404.html at the SAME
 *            address (no redirect), at the root, under /nl/, under /ar/ and
 *            deep; a missing asset stays a non-HTML 404.
 *   404      per language, desktop and phone, light and dark: <html lang dir>,
 *            title, heading, recovery links, the header, drawer, menu button,
 *            language menu, lantern, dock and footer in that language; exactly
 *            one of each; no duplicate ids; no leftover <template>; no failed
 *            asset; no sideways overflow; the drawer and language menu open and
 *            close with the keyboard; the lantern changes and keeps the theme.
 *   no JS    the English fallback, visible, with English recovery links.
 *   safety   a 404 whose swap script never runs still becomes visible.
 *   403      the three pages, localized the same way.
 *   gate     (only with --gate-root) the maintenance flow: the gate sends each
 *            language to its own maintenance page, Try again follows the route
 *            into the language the visitor switches to, and unsafe `from`
 *            values fall back to that language's home.
 *
 * EXPECTED STRINGS ARE NOT TYPED HERE. They are read out of the generators
 * (notfound.COPY, forbidden.COPY, maintenance.COPY, ui_strings.S, nav_items,
 * lantern.UI, scrolldock.UI), so this checks that visitors receive what the
 * sources say, not that two copies of a sentence agree.
 *
 * --simulate-404 is for an origin that does not yet serve 404.html itself (a
 * front door running older code): when the SERVER answers a page with 404, the
 * browser is handed the local 404.html with that same status. The HTTP section
 * then reports the server as it really is, and says the browser part was
 * simulated. --gate-root works the same way for documents: pages come from a
 * copy built with maintenance ON, so the working tree never has to be.
 *
 * Needs Chrome (CHROME=... to override the default path). Exit code 1 on any
 * failure. Screenshots go to --out (default: the OS temp directory), never
 * into the site.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(TOOLS, "..");
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const ORIGIN = opt("--origin", "http://127.0.0.1:8081").replace(/\/$/, "");
const OUT = path.resolve(opt("--out", path.join(os.tmpdir(), "zulfaa-error-pages")));
const SIMULATE = argv.includes("--simulate-404");
const GATE_ROOT = opt("--gate-root", null);
const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
fs.mkdirSync(OUT, { recursive: true });

// ── expectations, from the generators ───────────────────────────────────────
const EXPECT = JSON.parse(
  execFileSync("python", ["-c", `
import json, sys
sys.path.insert(0, ".")
from chrome import S, nav_items
import lantern, scrolldock, notfound, forbidden, maintenance
out = {}
for l in ("en", "ar", "nl"):
    out[l] = {
        "dir": "rtl" if l == "ar" else "ltr",
        "menu": S[l]["menuLabel"],
        "nav": [label for _, label in nav_items(l)],
        "lantern": lantern.UI[l],
        "dock": scrolldock.UI[l],
        "topNote": S[l]["topNote"],
        "nf": notfound.COPY[l],
        "nfTitle": notfound.page_title(l),
        "fb": forbidden.COPY[l],
        "mt": maintenance.COPY[l],
    }
print(json.dumps(out, ensure_ascii=False))
`], { cwd: TOOLS, encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } }),
);
const BASE = { en: "/", ar: "/ar/", nl: "/nl/" };

// ── reporting ───────────────────────────────────────────────────────────────
const results = [];
function check(scope, name, ok, detail = "") {
  results.push({ scope, name, ok: !!ok, detail });
  const mark = ok ? "ok  " : "FAIL";
  console.log(`  ${mark} ${scope} · ${name}${ok || !detail ? "" : "  -> " + detail}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── HTTP, without a browser ─────────────────────────────────────────────────
async function http(pathname, method = "GET") {
  const res = await fetch(ORIGIN + pathname, { method, redirect: "manual" });
  return { status: res.status, type: res.headers.get("content-type") || "", location: res.headers.get("location"), body: method === "HEAD" ? "" : await res.text() };
}

const UNKNOWN = [
  ["en", "/nope-zulfaa-check/"],
  ["nl", "/nl/nope-zulfaa-check/"],
  ["ar", "/ar/nope-zulfaa-check/"],
  ["ar", "/ar/articles/nope/deeper/still"],
  ["nl", "/nl"], // the bare prefix is not a missing page: /nl is the Dutch home (301 to /nl/)
];

console.log(`\nHTTP  ${ORIGIN}`);
let serverServes404 = true;
for (const [, p] of UNKNOWN.slice(0, 4)) {
  const r = await http(p);
  const is404Page = r.status === 404 && /text\/html/.test(r.type) && r.body.includes("data-nf-page");
  if (!is404Page) serverServes404 = false;
  check("http", `${p} -> 404 + 404.html, no redirect`, is404Page && !r.location,
    `status ${r.status}, ${r.type}, location ${r.location}${SIMULATE ? " (browser part simulated)" : ""}`);
}
{
  const r = await http("/assets/nope-zulfaa-check.css");
  check("http", "missing asset stays a non-HTML 404", r.status === 404 && !/text\/html/.test(r.type), `${r.status} ${r.type}`);
  const home = await http("/nl");
  check("http", "/nl is the Dutch home, not a 404", home.status === 301 || home.status === 200, `${home.status}`);
}

// ── Chrome over CDP ─────────────────────────────────────────────────────────
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "zulfaa-errcheck-"));
const chrome = spawn(CHROME, ["--headless=new", "--hide-scrollbars", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--window-size=1280,900", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = "";
  chrome.stderr.on("data", (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  setTimeout(() => reject(new Error("Chrome did not start: " + buf)), 20000);
});
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const pending = new Map();
const listeners = new Set();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  } else if (m.method) for (const f of listeners) f(m);
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params, sessionId }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A fresh tab with its own storage state and the interception rules for this scenario. */
async function tab({ js = true, theme = null, gate = false, breakSwap = false } = {}) {
  const { browserContextId } = await send("Target.createBrowserContext");
  const { targetId } = await send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId: S } = await send("Target.attachToTarget", { targetId, flatten: true });
  for (const d of ["Page", "Runtime", "Network"]) await send(d + ".enable", {}, S);
  await send("Network.setCacheDisabled", { cacheDisabled: true }, S);
  await send("Emulation.setScriptExecutionDisabled", { value: !js }, S);
  if (theme) await send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("zulfaa-site-theme","${theme}")}catch(e){}` }, S);
  const t = { S, targetId, browserContextId, failed: [], statuses: {}, console: [] };
  const own = (m) => m.sessionId === S;
  const onEvent = async (m) => {
    if (!own(m)) return;
    if (m.method === "Network.responseReceived") {
      const { type, response } = m.params;
      if (type === "Document") t.statuses[response.url] = response.status;
      else if (response.status >= 400 && response.url.startsWith(ORIGIN)) t.failed.push(`${response.status} ${response.url}`);
    }
    if (m.method === "Network.loadingFailed" && m.params.type !== "Document" && !m.params.canceled) t.failed.push(`failed ${m.params.errorText} ${m.params.type}`);
    if (m.method === "Runtime.exceptionThrown") t.console.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
    if (m.method === "Fetch.requestPaused") {
      const { requestId, request, resourceType, responseStatusCode } = m.params;
      const u = new URL(request.url);
      const fulfil = (file, status) => send("Fetch.fulfillRequest", {
        requestId, responseCode: status,
        responseHeaders: [{ name: "Content-Type", value: "text/html; charset=utf-8" }],
        body: Buffer.from(breakSwap ? fs.readFileSync(file, "utf8").replace(/<script>\(function\(\)\{var h=document\.documentElement,b=document\.body;[\s\S]*?<\/script>/, "") : fs.readFileSync(file)).toString("base64"),
      }, S);
      if (resourceType !== "Document" || u.origin !== ORIGIN) return send("Fetch.continueRequest", { requestId }, S);
      if (gate && responseStatusCode === undefined) {
        const rel = decodeURIComponent(u.pathname).replace(/^\//, "");
        const file = path.join(GATE_ROOT, rel === "" || rel.endsWith("/") ? rel + "index.html" : rel);
        if (fs.existsSync(file) && fs.statSync(file).isFile()) return fulfil(file, 200);
        return send("Fetch.continueRequest", { requestId }, S);
      }
      if (responseStatusCode === 404 && (SIMULATE || breakSwap)) return fulfil(path.join(SITE, "404.html"), 404);
      return send("Fetch.continueRequest", { requestId }, S);
    }
  };
  listeners.add(onEvent);
  t.stop = async () => {
    listeners.delete(onEvent);
    await send("Target.closeTarget", { targetId }).catch(() => {});
    await send("Target.disposeBrowserContext", { browserContextId }).catch(() => {});
  };
  const patterns = [];
  if (gate) patterns.push({ urlPattern: ORIGIN + "/*", resourceType: "Document", requestStage: "Request" });
  if (SIMULATE || breakSwap) patterns.push({ urlPattern: ORIGIN + "/*", resourceType: "Document", requestStage: "Response" });
  if (patterns.length) await send("Fetch.enable", { patterns }, S);
  t.size = (w, h, mobile) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile }, S);
  t.go = async (url, wait = 900) => {
    const loaded = new Promise((r) => {
      const f = (m) => {
        if (own(m) && m.method === "Page.loadEventFired") {
          listeners.delete(f);
          r();
        }
      };
      listeners.add(f);
    });
    await send("Page.navigate", { url: url.startsWith("http") ? url : ORIGIN + url }, S);
    await Promise.race([loaded, sleep(10000)]);
    await sleep(wait);
  };
  t.eval = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, S)).result.value;
  t.key = async (key, code = key, keyCode = 0) => {
    for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: keyCode }, S);
  };
  t.shot = async (name) => {
    const { data } = await send("Page.captureScreenshot", { format: "png" }, S);
    fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(data, "base64"));
  };
  return t;
}

const STATE = `(() => {
  const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
  const txt = (el) => el ? el.textContent.replace(/\\s+/g, " ").trim() : null;
  const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  const copy = document.querySelector(".nf-copy,.mt-copy");
  return {
    href: location.pathname + location.search + location.hash,
    lang: document.documentElement.lang, dir: document.documentElement.dir,
    swapping: document.documentElement.classList.contains("nf-swap"),
    bodyVisible: getComputedStyle(document.body).visibility,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.content,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content,
    h1: [...document.querySelectorAll("h1")].filter(vis).map(txt),
    actions: [...document.querySelectorAll(".nf-actions a,.mt-actions a")].filter(vis).map((a) => ({ text: txt(a), href: a.getAttribute("href") ? new URL(a.getAttribute("href"), document.baseURI).pathname + new URL(a.getAttribute("href"), document.baseURI).search + new URL(a.getAttribute("href"), document.baseURI).hash : null })),
    nav: [...document.querySelectorAll(".site-nav a")].map(txt),
    menu: document.querySelector(".nav-toggle")?.getAttribute("aria-label"),
    topNote: txt(document.querySelector(".topbar-note")),
    langLinks: [...document.querySelectorAll(".topbar-lang-list a")].map((a) => ({ to: new URL(a.getAttribute("href"), document.baseURI).pathname + new URL(a.getAttribute("href"), document.baseURI).search, current: a.getAttribute("aria-current") })),
    lantern: { label: document.querySelector(".lantern")?.getAttribute("aria-label"), pressed: document.querySelector(".lantern")?.getAttribute("aria-pressed") },
    dock: [...document.querySelectorAll(".dock-btn")].map((b) => b.getAttribute("aria-label")),
    counts: { head: document.querySelectorAll(".site-head").length, topbar: document.querySelectorAll(".topbar").length, drawer: document.querySelectorAll(".drawer").length, lantern: document.querySelectorAll(".lantern").length, footer: document.querySelectorAll(".site-foot").length, dock: document.querySelectorAll("[data-dock]").length, templates: document.querySelectorAll("template").length, h1: document.querySelectorAll("h1").length },
    dupIds: [...new Set(dup)],
    theme: document.documentElement.getAttribute("data-site-theme"),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    copyDir: copy ? getComputedStyle(copy).direction : null,
    headDir: getComputedStyle(document.querySelector(".site-head")).direction,
    units: [...document.querySelectorAll(".mt-unit")].map(txt),
  };
})()`;

function expectShell(scope, s, lang) {
  const x = EXPECT[lang];
  check(scope, "<html lang dir>", s.lang === lang && s.dir === x.dir, `${s.lang} ${s.dir}`);
  check(scope, "header direction follows the language", s.headDir === x.dir && (!s.copyDir || s.copyDir === x.dir), `${s.headDir}/${s.copyDir}`);
  check(scope, "navigation labels", same(s.nav, x.nav), JSON.stringify(s.nav));
  check(scope, "menu button label", s.menu === x.menu, s.menu);
  check(scope, "top bar note", s.topNote === x.topNote, s.topNote);
  const dark = s.theme === "dark";
  check(scope, "lantern label", s.lantern.label === (dark ? x.lantern.toLight : x.lantern.toDark), s.lantern.label);
  check(scope, "scroll dock labels", same(s.dock, [x.dock.up, x.dock.down]), JSON.stringify(s.dock));
  check(scope, "exactly one top bar, header, drawer, lantern, footer, dock; no templates", same(s.counts, { ...s.counts, head: 1, topbar: 1, drawer: 1, lantern: 1, footer: 1, dock: 1, templates: 0 }), JSON.stringify(s.counts));
  check(scope, "no duplicate ids", s.dupIds.length === 0, s.dupIds.join(","));
  check(scope, "no sideways overflow", s.overflow <= 0, `${s.overflow}px`);
}

// ── 404 ─────────────────────────────────────────────────────────────────────
console.log(`\n404${SIMULATE ? "  (browser part SIMULATED: the origin's 404 is replaced by the local 404.html)" : ""}`);
const VIEWS = [["desktop", 1280, 900, false], ["phone", 390, 844, true]];
for (const [lang, p] of UNKNOWN.slice(0, 4)) {
  for (const theme of ["light", "dark"]) {
    for (const [view, w, h, mobile] of VIEWS) {
      if (p.includes("deeper") && (theme === "dark" || view === "phone")) continue; // one pass is enough for depth
      const scope = `404 ${p} ${view} ${theme}`;
      // light = a fresh profile with nothing saved; dark = saved before the page loads
      const t = await tab({ theme: theme === "dark" ? "dark" : null });
      await t.size(w, h, mobile);
      await t.go(p);
      const s = await t.eval(STATE);
      const x = EXPECT[lang];
      check(scope, "HTTP status 404 reached the browser", t.statuses[ORIGIN + p] === 404, String(t.statuses[ORIGIN + p]));
      check(scope, "address unchanged", s.href === p, s.href);
      check(scope, "title and metadata", s.title === x.nfTitle && s.ogTitle === x.nfTitle && s.description === x.nf.body, `${s.title} | ${s.ogTitle}`);
      check(scope, "heading", same(s.h1, [x.nf.title]), JSON.stringify(s.h1));
      check(scope, "recovery links in this language", same(s.actions, [{ text: x.nf.home, href: x.nf.at }, { text: x.nf.more, href: x.nf.atMore }]), JSON.stringify(s.actions));
      check(scope, "language menu: the three homes, this one current", same(s.langLinks, ["en", "ar", "nl"].map((l) => ({ to: BASE[l], current: l === lang ? "true" : null }))), JSON.stringify(s.langLinks));
      check(scope, "body visible, swap finished", !s.swapping && s.bodyVisible === "visible", `${s.swapping} ${s.bodyVisible}`);
      check(scope, "theme applied", s.theme === theme || (theme === "light" && s.theme !== "dark"), s.theme);
      expectShell(scope, s, lang);
      check(scope, "no failed assets", t.failed.length === 0, t.failed.join(" ; "));
      check(scope, "no script errors", t.console.length === 0, t.console.join(" ; "));
      if (!p.includes("deeper")) await t.shot(`404-${lang}-${view}-${theme}`);

      if (view === "phone" && theme === "light") {
        // drawer: keyboard open, one drawer, Escape closes and returns focus
        const opened = await t.eval(`(async()=>{const b=document.querySelector(".nav-toggle");b.focus();b.click();await new Promise(r=>setTimeout(r,400));return {exp:b.getAttribute("aria-expanded"),drawer:getComputedStyle(document.querySelector(".drawer")).visibility}})()`);
        await t.shot(`404-${lang}-phone-drawer`);
        await t.key("Escape", "Escape", 27);
        await sleep(400);
        const closed = await t.eval(`({exp:document.querySelector(".nav-toggle").getAttribute("aria-expanded"),focus:document.activeElement&&document.activeElement.className})`);
        check(scope, "drawer opens and Escape closes it, focus back on the button", opened.exp === "true" && closed.exp === "false" && /nav-toggle/.test(closed.focus), `${JSON.stringify(opened)} ${JSON.stringify(closed)}`);
        // top bar language menu at phone width
        const lm = await t.eval(`(async()=>{const b=document.querySelector(".topbar-lang-btn");b.focus();b.click();await new Promise(r=>setTimeout(r,250));return b.getAttribute("aria-expanded")})()`);
        await t.key("Escape", "Escape", 27);
        await sleep(250);
        const lm2 = await t.eval(`document.querySelector(".topbar-lang-btn").getAttribute("aria-expanded")`);
        check(scope, "language menu opens and Escape closes it", lm === "true" && lm2 === "false", `${lm} ${lm2}`);
      }
      if (view === "desktop" && theme === "light" && !p.includes("deeper")) {
        const lm = await t.eval(`(async()=>{const b=document.querySelector(".lang-btn");b.focus();b.click();await new Promise(r=>setTimeout(r,250));return b.getAttribute("aria-expanded")})()`);
        await t.key("Escape", "Escape", 27);
        await sleep(250);
        const lm2 = await t.eval(`document.querySelector(".lang-btn").getAttribute("aria-expanded")`);
        check(scope, "header language menu opens and Escape closes it", lm === "true" && lm2 === "false", `${lm} ${lm2}`);
        // lantern: switch to dark, it is saved, and a reload keeps it (at the same missing address)
        await t.eval(`document.querySelector(".lantern").click()`);
        await sleep(1000);
        const after = await t.eval(`({theme:document.documentElement.getAttribute("data-site-theme"),saved:localStorage.getItem("zulfaa-site-theme"),label:document.querySelector(".lantern").getAttribute("aria-label")})`);
        await t.go(p);
        const reloaded = await t.eval(STATE);
        check(scope, "lantern switches to dark, saves it, label in this language, kept after reload",
          after.theme === "dark" && after.saved === "dark" && after.label === EXPECT[lang].lantern.toLight && reloaded.theme === "dark" && reloaded.lang === lang,
          `${JSON.stringify(after)} reload ${reloaded.theme} ${reloaded.lang}`);
      }
      await t.stop();
    }
  }
}

// ── 404 without JavaScript ──────────────────────────────────────────────────
console.log("\n404 without JavaScript");
for (const [lang, p] of UNKNOWN.slice(1, 3)) {
  const scope = `404 ${p} no-JS`;
  const t = await tab({ js: false });
  await t.go(p);
  const s = await t.eval(STATE);
  const x = EXPECT.en;
  check(scope, "English fallback, visible", s.lang === "en" && s.dir === "ltr" && s.bodyVisible === "visible" && same(s.h1, [x.nf.title]) && s.title === x.nfTitle, `${s.lang} ${s.bodyVisible} ${JSON.stringify(s.h1)}`);
  check(scope, "English recovery links", same(s.actions.map((a) => a.href), ["/", "/articles/"]), JSON.stringify(s.actions));
  check(scope, "one header: the templates stay inert", s.counts.head === 1 && s.dupIds.length === 0, JSON.stringify(s.counts));
  if (lang === "ar") await t.shot("404-ar-url-nojs");
  await t.stop();
}

// ── 404 whose swap never runs ───────────────────────────────────────────────
console.log("\n404 safety: the swap script removed");
{
  const t = await tab({ breakSwap: true });
  await t.go("/ar/nope-zulfaa-check/", 2300);
  const s = await t.eval(STATE);
  check("404 /ar/ broken swap", "the page still becomes visible (CSS fallback)", s.bodyVisible === "visible" && s.h1.length === 1, `${s.bodyVisible} ${JSON.stringify(s.h1)}`);
  await t.stop();
}

// ── 403 ─────────────────────────────────────────────────────────────────────
console.log("\n403 (a designed page served with 200; GitHub Pages never answers 403)");
for (const lang of ["en", "nl", "ar"]) {
  for (const [view, w, h, mobile] of VIEWS) {
    const p = BASE[lang] + "403/";
    const scope = `403 ${p} ${view}`;
    const t = await tab();
    await t.size(w, h, mobile);
    await t.go(p);
    const s = await t.eval(STATE);
    const x = EXPECT[lang];
    check(scope, "title and heading", s.title === `${x.fb.title} — ZULFAA` && same(s.h1, [x.fb.title]), `${s.title} ${JSON.stringify(s.h1)}`);
    check(scope, "recovery links in this language", same(s.actions, [{ text: x.fb.home, href: BASE[lang] }, { text: x.fb.more, href: BASE[lang] + "support/" }]), JSON.stringify(s.actions));
    expectShell(scope, s, lang);
    check(scope, "no failed assets", t.failed.length === 0, t.failed.join(" ; "));
    if (view === "desktop" && lang !== "en") await t.shot(`403-${lang}-desktop`);
    await t.stop();
  }
}

// ── maintenance, with the gate ON in a separate copy ────────────────────────
if (GATE_ROOT) {
  console.log(`\nMaintenance gate (documents from ${GATE_ROOT})`);
  const flow = async (label, start, expectLang, expectFrom, expectRetry) => {
    const t = await tab({ gate: true });
    await t.go(start, 1600);
    const s = await t.eval(STATE);
    const x = EXPECT[expectLang];
    const scope = `gate ${label}`;
    check(scope, "sent to this language's maintenance page with from", s.href === BASE[expectLang] + "maintenance/?from=" + encodeURIComponent(expectFrom), s.href);
    check(scope, "heading, units in this language", same(s.h1, [x.mt.h1]) && same(s.units, x.mt.units), `${JSON.stringify(s.h1)} ${JSON.stringify(s.units)}`);
    check(scope, "Try again goes to the route in this language", s.actions.some((a) => a.text === x.mt.retry && a.href === expectRetry), JSON.stringify(s.actions));
    expectShell(scope, s, expectLang);
    return { t, s };
  };

  // /articles/prayer-times/ -> English maintenance; switch to Dutch, then Arabic
  {
    const { t, s } = await flow("en article", "/articles/prayer-times/", "en", "/articles/prayer-times/", "/articles/prayer-times/");
    const nl = s.langLinks.find((l) => l.to.startsWith("/nl/"));
    const ar = s.langLinks.find((l) => l.to.startsWith("/ar/"));
    check("gate en article", "language links carry the route in THEIR language", nl?.to === "/nl/maintenance/?from=" + encodeURIComponent("/nl/articles/prayer-times/") && ar?.to === "/ar/maintenance/?from=" + encodeURIComponent("/ar/articles/prayer-times/"), JSON.stringify(s.langLinks));
    await t.go(nl.to, 1400);
    const s2 = await t.eval(STATE);
    const xn = EXPECT.nl;
    check("gate switch en->nl", "Dutch page, Try again -> /nl/articles/prayer-times/", s2.lang === "nl" && s2.actions.some((a) => a.text === xn.mt.retry && a.href === "/nl/articles/prayer-times/"), JSON.stringify(s2.actions));
    const ar2 = s2.langLinks.find((l) => l.to.startsWith("/ar/"));
    await t.go(ar2.to, 1400);
    const s3 = await t.eval(STATE);
    const xa = EXPECT.ar;
    check("gate switch nl->ar", "Arabic RTL page, Try again -> /ar/articles/prayer-times/", s3.lang === "ar" && s3.dir === "rtl" && s3.actions.some((a) => a.text === xa.mt.retry && a.href === "/ar/articles/prayer-times/"), JSON.stringify(s3.actions));
    await t.shot("maintenance-ar-after-switch");
    await t.stop();
  }
  // Dutch home -> Dutch maintenance; switch to English: Try again -> "/"
  {
    const { t, s } = await flow("nl home", "/nl/", "nl", "/nl/", "/nl/");
    const en = s.langLinks.find((l) => l.to.startsWith("/maintenance/"));
    await t.go(en.to, 1400);
    const s2 = await t.eval(STATE);
    check("gate switch nl->en", "English page, Try again -> /", s2.lang === "en" && s2.actions.some((a) => a.text === EXPECT.en.mt.retry && a.href === "/"), JSON.stringify(s2.actions));
    await t.stop();
  }
  // unsafe or unknown `from`: Try again falls back to this language's home, language links carry nothing
  for (const bad of ["https://evil.example/", "//evil.example/", "/\\evil.example/", "javascript:alert(1)", "/nl/maintenance/", "/maintenance/?from=/", "/does-not-exist/", "/ar/nope/deeper/"]) {
    const t = await tab({ gate: true });
    await t.go("/nl/maintenance/?from=" + encodeURIComponent(bad), 1200);
    const s = await t.eval(STATE);
    const retry = s.actions.find((a) => a.text === EXPECT.nl.mt.retry);
    check(`gate from=${bad}`, "rejected: Try again -> /nl/, no from on language links",
      retry?.href === "/nl/" && s.langLinks.every((l) => !l.to.includes("from=")), `${JSON.stringify(retry)} ${JSON.stringify(s.langLinks)}`);
    await t.stop();
  }
  // a query and fragment the visitor had are kept; a nested from is not
  {
    const t = await tab({ gate: true });
    await t.go("/ar/maintenance/?from=" + encodeURIComponent("/nl/articles/?a=1&from=/x#top"), 1200);
    const s = await t.eval(STATE);
    const retry = s.actions.find((a) => a.text === EXPECT.ar.mt.retry);
    check("gate from with query", "Try again -> /ar/articles/?a=1#top (localized, nested from dropped)", retry?.href === "/ar/articles/?a=1#top", JSON.stringify(retry));
    await t.stop();
  }
  // legal pages are never gated
  {
    const t = await tab({ gate: true });
    await t.go("/nl/privacy/", 1400);
    const s = await t.eval(STATE);
    check("gate /nl/privacy/", "not gated", s.href === "/nl/privacy/", s.href);
    await t.stop();
  }
}

ws.close();
chrome.kill();
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, "error-pages-check.json"), JSON.stringify({ origin: ORIGIN, simulated404: SIMULATE, serverServes404, gateRoot: GATE_ROOT, results }, null, 1));
console.log(`\n${results.length - failed.length}/${results.length} checks passed${SIMULATE ? " (404 browser checks simulated)" : ""}. Screenshots and JSON: ${OUT}`);
if (!serverServes404) console.log("NOTE: the origin does not serve 404.html for missing pages yet - restart the DEV LAB front door to load the updated gateway.");
process.exit(failed.length ? 1 : 0);
