/* Minimal static server + headless Chrome over CDP, shared by the hero3d tools.
 * No npm dependencies beyond Node itself (same plumbing as responsive_check.mjs). */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2",
  ".json": "application/json", ".glb": "model/gltf-binary", ".xml": "application/xml",
  // without this robots.txt is served as a download and never becomes a page
  ".txt": "text/plain; charset=utf-8",
};

export async function serve(root = SITE) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, origin: `http://127.0.0.1:${server.address().port}/` };
}

export async function launch({ chrome = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", gpu = "swiftshader", headless = true, windowSize = "1920,1080" } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "zulfaa-hero3d-"));
  const gl = gpu === "swiftshader"
    ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    : ["--enable-gpu", "--ignore-gpu-blocklist"];
  // headless: false opens an ordinary visible Chrome window (own temporary profile)
  const mode = headless ? ["--headless=new", "--hide-scrollbars"] : ["--new-window"];
  const proc = spawn(chrome, [
    ...mode, "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check",
    `--window-size=${windowSize}`, ...gl, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    proc.stderr.on("data", (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    proc.on("exit", (c) => reject(new Error("chrome exited " + c + "\n" + buf)));
    setTimeout(() => reject(new Error("chrome did not start\n" + buf)), 20000);
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let seq = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else if (m.method) for (const l of listeners) l(m);
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: S } = await send("Target.attachToTarget", { targetId, flatten: true });
  for (const d of ["Page", "Runtime", "Network", "Log"]) await send(d + ".enable", {}, S);

  const problems = [];
  const urls = new Map();
  listeners.push((m) => {
    if (m.sessionId !== S) return;
    if (m.method === "Network.requestWillBeSent") urls.set(m.params.requestId, m.params.request.url);
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(m.params.type))
      problems.push(`console.${m.params.type}: ` + m.params.args.map((a) => a.value ?? a.description).join(" "));
    if (m.method === "Runtime.exceptionThrown") problems.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") problems.push("log: " + m.params.entry.text + " " + (m.params.entry.url || ""));
    if (m.method === "Network.loadingFailed" && !m.params.canceled)
      problems.push(`request failed: ${m.params.errorText || "(no text)"} ${m.params.blockedReason || ""} ${urls.get(m.params.requestId) || m.params.requestId}`);
    if (m.method === "Network.responseReceived" && m.params.response.status >= 400) problems.push(`HTTP ${m.params.response.status}: ${m.params.response.url}`);
  });

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception || {}).description);
    return r.result.value;
  };
  const once = (method) => new Promise((res) => {
    const l = (m) => {
      if (m.method === method && m.sessionId === S) {
        listeners.splice(listeners.indexOf(l), 1);
        res(m.params);
      }
    };
    listeners.push(l);
  });
  const viewport = (width, height, mobile = false, dpr = 1) =>
    send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: dpr, mobile }, S);
  const goto = async (url) => {
    const loaded = once("Page.loadEventFired");
    await send("Page.navigate", { url }, S);
    await loaded;
    await evaluate("document.fonts.ready");
  };
  const screenshot = async (file, clip) => {
    const params = { format: "png" };
    if (clip) params.clip = { ...clip, scale: 1 };
    const { data } = await send("Page.captureScreenshot", params, S);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
  };
  const close = () => {
    ws.close();
    proc.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  };
  // raw protocol events (e.g. Page.screencastFrame) for tools that need them
  const listen = (fn) => listeners.push(fn);
  const unlisten = (fn) => {
    const i = listeners.indexOf(fn);
    if (i !== -1) listeners.splice(i, 1);
  };
  return { send, S, evaluate, viewport, goto, screenshot, problems, close, listen, unlisten };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
