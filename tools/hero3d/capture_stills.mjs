#!/usr/bin/env node
/* Captures the hero phone's static stills from the live renderer itself.
 *
 *   node tools/hero3d/capture_stills.mjs
 *
 * For each language and theme it saves assets/hero3d/still-<lang>-<theme>-<w>.webp
 * at w = 352, 704 and 1056 px (the 22rem box at 1x, 2x and 3x; transparent).
 * The page runs with prefers-reduced-motion emulated, so the phone settles in
 * place without an entrance or a turn, and the phone box is pinned to
 * 352x704 CSS px while the device-pixel ratio selects the size. The stills
 * therefore carry exactly the live phone's framing, lighting and screen
 * sampling (including the mip LOD bias). Rerun whenever any of those change.
 *
 * Hardware GPU, not SwiftShader: SwiftShader rasterises a hairline crack into
 * the light screens that no real GPU shows.
 */
import fs from "node:fs";
import path from "node:path";
import { SITE, serve, launch, sleep } from "./cdp.mjs";

const OUT = path.join(SITE, "assets", "hero3d");
const { server, origin } = await serve();
const b = await launch({ gpu: process.argv.includes("--swiftshader") ? "swiftshader" : "hardware" });
try {
  await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, b.S);
  for (const dpr of [1, 2, 3]) {
    await b.viewport(1400, 1000, false, dpr);
    for (const [lang, base] of [["en", ""], ["ar", "ar/"], ["nl", "nl/"]]) {
      await b.goto(origin + base + "?hero3d-debug");
      await b.evaluate(`(() => { const s = document.createElement("style");
        s.textContent = ".phone3d{width:352px!important;height:704px!important}"; document.head.appendChild(s); })()`);
      const state = await b.evaluate(`new Promise((res) => { const t0 = Date.now(); (function wait() {
        const de = document.documentElement;
        if (window.__hero3d && document.querySelector('.phone3d[data-stage="live"]')) return res("ready");
        if (de.getAttribute("data-hero3d") === "failed") return res("failed: " + de.getAttribute("data-hero3d-error"));
        if (Date.now() - t0 > 60000) return res("timeout"); setTimeout(wait, 100); })(); })`);
      if (state !== "ready") throw new Error("hero3d " + state + " on " + lang + "\n" + b.problems.join("\n"));
      await sleep(300); // the ResizeObserver applies the pinned size
      for (const theme of ["light", "dark"]) {
        const [w, h, data] = await b.evaluate(`(() => { window.__hero3d.setTheme("${theme}"); window.__hero3d.setAngle(0);
          const c = document.querySelector(".phone3d-canvas"); return [c.width, c.height, c.toDataURL("image/webp", 0.92)]; })()`);
        const want = 352 * dpr;
        if (w !== want || h !== want * 2) throw new Error(`canvas is ${w}x${h}, expected ${want}x${want * 2}`);
        const file = path.join(OUT, `still-${lang}-${theme}-${want}.webp`);
        fs.writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
        console.log(`${path.basename(file)}  ${w}x${h}  ${Math.round(fs.statSync(file).size / 1024)} KB`);
      }
    }
  }
  const real = b.problems.filter((p) => !/X4122|still-.*\.webp|Failed to load resource/.test(p));
  if (real.length) console.log("problems:\n  " + real.join("\n  "));
} finally {
  b.close();
  server.close();
}
