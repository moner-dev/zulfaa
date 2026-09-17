/* ZULFAA — the 3D phone in the home hero.
 *
 * Source of assets/hero3d.js. Build: `cd tools/hero3d && npm install && npm run build`.
 * Tests: `node --test tools/hero3d/motion.test.mjs tools/hero3d/screen.test.mjs`.
 * Browser checks: `node tools/hero3d/check_motion.mjs`.
 *
 * WHAT IT DOES
 *   Loads assets/hero3d/zulfaa-phone.glb (its screen carries NO screenshot),
 *   puts the page's own language's Start screenshots on the screen, and once
 *   the phone is ready and in view, lets it descend into place. It then turns
 *   the phone to change the screen between light and dark - on a timer, when
 *   the visitor uses the day/night control, and when the visitor turns the
 *   phone by hand. motion.js is the one controller for all of it; screen.js
 *   is how the screenshot is sampled.
 *
 * DIRECT ROTATION
 *   A horizontal drag that starts ON THE DEVICE (its projected outline at the
 *   current angle, not the empty canvas) turns it about its vertical axis.
 *   Mouse: 3 px of mostly-horizontal travel starts the drag. Touch: 8 px,
 *   and a mostly-vertical move is left to the browser, which scrolls (the
 *   canvas is touch-action: pan-y pinch-zoom). The pointer is captured only
 *   once a drag is recognised; up, cancel, lost capture, a hidden tab or the
 *   phone leaving the viewport all release it. A full turn takes about 1.35
 *   device widths of travel, in the same physical direction in every
 *   language: the page's writing direction never mirrors the model.
 *
 * STAGES (data-stage on .phone3d, read by the stylesheet)
 *   loading  nothing but the ambient glow; the box already holds its size
 *   still    the static stills, shown if the live phone is not ready 2.5 s
 *            after it came into view, or for good when WebGL/the model fails
 *   live     the canvas; replaces a showing still in place, with no entrance
 *
 * THE PAGE WITHOUT IT
 *   With scripting off the stills show. If this module never runs,
 *   assets/nav.js sees no data-controller and drives the stills itself.
 *
 * RENDERING
 *   On demand: during the entrance, turns and while the phone is being moved,
 *   and once after any change. Never while it holds still. Offscreen or in a
 *   hidden tab nothing runs, and nothing catches up afterwards.
 */
import {
  Box3,
  DirectionalLight,
  NeutralToneMapping,
  PMREMGenerator,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createMotion, TIMING } from "./motion.js";
import {
  STATIONARY_BIAS,
  biasForAngle,
  createFrameGovernor,
  makeScreenMaterial,
  makeScreenTexture,
  pixelRatioFor,
} from "./screen.js";

const THEME_KEY = "zulfaa-hero-theme"; // shared with assets/nav.js
const MOTION_KEY = "zulfaa-hero-motion";
const HINT_KEY = "zulfaa-hero-drag-hint";
const STILL_AFTER_MS = 2500;
const HINT_MS = 8000;
const ENTRY_TILT = (4 * Math.PI) / 180;
const ENTRY_FADE = 450 / TIMING.entrance; // opacity reaches 1 in the first 450 ms
const TURN_PER_WIDTHS = 1.35; // pointer travel for a full turn, in device widths
const DRAG_START_PX = { mouse: 3, pen: 5, touch: 8 };

const DEBUG = /[?&]hero3d-debug\b/.test(location.search);
const stage = document.querySelector(".hero .phone3d");
if (stage) main(stage);

function readStore(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function writeStore(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch (e) {
    /* storage refused: the choice lasts for this page */
  }
}

function decodeImage(url) {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  return img.decode().then(() => img);
}

function main(el) {
  // Claim the phone before assets/nav.js runs, so exactly one script owns the toggle.
  el.setAttribute("data-controller", "hero3d");

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const toggleBtn = document.querySelector(".theme-demo");
  const pauseBtn = document.querySelector(".motion-toggle");
  const statusEl = document.querySelector("[data-hero3d-status]");
  const hint = el.querySelector(".drag-hint");
  const params = new URLSearchParams(location.search);
  const speed = DEBUG ? Number(params.get("hero3d-speed")) || 1 : 1;
  const timing = Object.fromEntries(Object.entries(TIMING).map(([k, v]) => [k, v / speed]));

  const events = [];
  const log = (type, data) => {
    if (DEBUG) events.push({ t: Math.round(performance.now()), type, ...data });
  };

  const savedTheme = readStore(THEME_KEY) === "dark" ? "dark" : "light";
  let view = null; // the live phone, once ready
  let direct = false; // no live phone: the toggle switches the stills directly

  function showTheme(theme) {
    el.setAttribute("data-theme", theme);
    if (toggleBtn) toggleBtn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }
  showTheme(savedTheme);

  const motion = createMotion({
    theme: savedTheme,
    calm,
    timing,
    onTheme(theme, info) {
      showTheme(theme);
      if (view) view.setTheme(theme);
      // Only a deliberate selection (the day/night control) is the visitor's
      // choice: saved for the session and announced. Automatic turns, the
      // return to light and turning the phone by hand are neither.
      if (info.manual) {
        writeStore(THEME_KEY, theme);
        if (statusEl) statusEl.textContent = statusEl.getAttribute(theme === "dark" ? "data-dark" : "data-light") || "";
      }
      log("theme", { theme, manual: !!info.manual, drag: !!info.drag, angle: motion.angle });
    },
    onPose(pose) {
      if (view) view.setPose(pose);
    },
    onStatus(s) {
      if (toggleBtn) {
        if (s.busy) toggleBtn.setAttribute("aria-busy", "true");
        else toggleBtn.removeAttribute("aria-busy");
      }
      if (pauseBtn) pauseBtn.setAttribute("aria-pressed", s.paused ? "true" : "false");
      el.setAttribute("data-motion", s.state);
      if (s.state === "hold" && view) showHintOnce();
      log("status", { state: s.state, theme: s.theme, paused: s.paused, pending: s.pending, hold: s.holdKind, angle: +motion.angle.toFixed(4) });
    },
  });
  if (readStore(MOTION_KEY) === "paused") motion.setPaused(true, performance.now());

  // ── one scheduling loop for everything ──────────────────────────────────
  let raf = 0;
  let timer = 0;
  function kick() {
    if (raf) cancelAnimationFrame(raf);
    if (timer) clearTimeout(timer);
    raf = 0;
    timer = 0;
    if (!active()) return;
    const w = motion.wake(performance.now());
    if (w === 0 || (view && view.dirty)) raf = requestAnimationFrame(tick);
    else if (w !== Infinity) {
      timer = setTimeout(() => {
        timer = 0;
        raf = requestAnimationFrame(tick);
      }, w);
    }
  }
  function tick(now) {
    raf = 0;
    motion.frame(now);
    if (view) view.draw(now, motion.state);
    kick();
  }

  // ── visibility ──────────────────────────────────────────────────────────
  let onScreen = false;
  let visibleEnough = false;
  let stillTimer = 0;
  const active = () => onScreen && !document.hidden;

  function syncActive() {
    if (!active()) releaseDrag("inactive");
    motion.setActive(active(), performance.now());
    kick();
  }

  function maybeStart() {
    if (!visibleEnough) return;
    if (!view && !direct && el.getAttribute("data-stage") === "loading" && !stillTimer) {
      stillTimer = setTimeout(() => {
        if (!view) el.setAttribute("data-stage", "still");
      }, STILL_AFTER_MS);
    }
    if (view && motion.state === "idle") {
      const inPlace = el.getAttribute("data-stage") === "still";
      clearTimeout(stillTimer);
      view.reveal(inPlace || calm);
      el.setAttribute("data-stage", "live");
      if (pauseBtn) pauseBtn.hidden = calm;
      motion.begin(performance.now(), { entrance: !inPlace && !calm });
      log("begin", { entrance: !inPlace && !calm });
      kick();
    }
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        onScreen = e.isIntersecting;
        visibleEnough = e.isIntersecting && e.intersectionRatio >= 0.35;
        syncActive();
        maybeStart();
      },
      { threshold: [0, 0.35] },
    ).observe(el);
  } else {
    onScreen = visibleEnough = true;
  }
  document.addEventListener("visibilitychange", syncActive);

  // ── controls ────────────────────────────────────────────────────────────
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (direct) {
        const theme = el.getAttribute("data-theme") === "dark" ? "light" : "dark";
        showTheme(theme);
        writeStore(THEME_KEY, theme);
        return;
      }
      motion.toggle(performance.now());
      log("toggle", { state: motion.state, pending: motion.pending });
      kick();
    });
  }
  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      const next = !motion.paused;
      motion.setPaused(next, performance.now());
      writeStore(MOTION_KEY, next ? "paused" : "playing");
      log("pause", { paused: next });
      kick();
    });
  }

  // ── the one-time hint ───────────────────────────────────────────────────
  let hintTimer = 0;
  function showHintOnce() {
    if (!hint || !hint.hidden || hintTimer || readStore(HINT_KEY) === "seen") return;
    hint.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => hint.classList.add("is-shown")));
    hintTimer = setTimeout(hideHint, HINT_MS);
  }
  function hideHint() {
    if (!hint || hint.hidden) return;
    writeStore(HINT_KEY, "seen");
    clearTimeout(hintTimer);
    hint.classList.remove("is-shown");
    setTimeout(() => {
      hint.hidden = true;
    }, calm ? 0 : 400);
  }

  // ── direct rotation ─────────────────────────────────────────────────────
  let grip = null; // { id, type, x0, y0, lastX, recognized, radPerPx }

  function grabbable() {
    return view && !direct && motion.state !== "idle" && motion.state !== "entering";
  }

  function onPointerDown(e) {
    if (grip || !grabbable()) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!view.hitTest(e.clientX, e.clientY)) return;
    grip = {
      id: e.pointerId,
      type: e.pointerType || "mouse",
      x0: e.clientX,
      y0: e.clientY,
      lastX: e.clientX,
      recognized: false,
      radPerPx: (Math.PI * 2) / Math.max(120, view.deviceWidth() * TURN_PER_WIDTHS),
    };
    // a mouse press on the phone must not start a text selection
    if (grip.type === "mouse") e.preventDefault();
  }

  function onPointerMove(e) {
    const canvas = view && view.canvas;
    if (!grip) {
      if (canvas && e.pointerType === "mouse") canvas.classList.toggle("is-grabbable", !!grabbable() && view.hitTest(e.clientX, e.clientY));
      return;
    }
    if (e.pointerId !== grip.id) return;
    if (!grip.recognized) {
      const dx = e.clientX - grip.x0;
      const dy = e.clientY - grip.y0;
      const threshold = DRAG_START_PX[grip.type] || 5;
      if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (!motion.beginDrag(performance.now())) {
          grip = null;
          return;
        }
        grip.recognized = true;
        grip.lastX = e.clientX;
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (err) {
          /* capture refused: moves over the canvas still arrive */
        }
        canvas.classList.add("is-grabbing");
        hideHint();
        log("drag", { phase: "start", angle: +motion.angle.toFixed(4), state: motion.state });
        kick();
      } else if (grip.type !== "mouse" && Math.abs(dy) >= threshold && Math.abs(dy) >= Math.abs(dx)) {
        grip = null; // a vertical swipe: the page scrolls, the phone stays
      }
      return;
    }
    if (e.cancelable) e.preventDefault();
    const delta = (e.clientX - grip.lastX) * grip.radPerPx;
    grip.lastX = e.clientX;
    if (delta) {
      motion.dragBy(delta, performance.now());
      kick();
    }
  }

  function onPointerEnd(e) {
    if (!grip || e.pointerId !== grip.id) return;
    releaseDrag(e.type);
  }

  function releaseDrag(reason) {
    const g = grip;
    grip = null;
    if (!g || !view) return;
    const canvas = view.canvas;
    canvas.classList.remove("is-grabbing");
    if (!g.recognized) return;
    try {
      if (canvas.hasPointerCapture(g.id)) canvas.releasePointerCapture(g.id);
    } catch (err) {
      /* already released */
    }
    motion.endDrag(performance.now());
    log("drag", { phase: "end", reason, angle: +motion.angle.toFixed(4), state: motion.state });
    kick();
  }

  function attachPointer(canvas) {
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerEnd);
    canvas.addEventListener("pointercancel", onPointerEnd);
    canvas.addEventListener("lostpointercapture", onPointerEnd);
    canvas.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse" && !grip) canvas.classList.remove("is-grabbable");
      // a mouse leaving before a drag was recognised is not a drag
      if (grip && !grip.recognized && e.pointerId === grip.id) grip = null;
    });
    window.addEventListener("blur", () => releaseDrag("blur"));
  }

  // ── the live phone ──────────────────────────────────────────────────────
  bootView(el, { coarse, log })
    .then((v) => {
      view = v;
      view.setTheme(motion.theme);
      view.onDirty = kick;
      view.onLost = () => {
        releaseDrag("context-lost");
        view = null;
        direct = true;
        motion.setPaused(true, performance.now());
        el.classList.remove("is-live");
        el.setAttribute("data-stage", "still");
        if (pauseBtn) pauseBtn.hidden = true;
        if (hint) hint.hidden = true;
        kick();
      };
      attachPointer(view.canvas);
      if (DEBUG) exposeDebug();
      maybeStart();
    })
    .catch((err) => {
      direct = true;
      clearTimeout(stillTimer);
      el.setAttribute("data-stage", "still");
      if (pauseBtn) pauseBtn.hidden = true;
      if (DEBUG) {
        document.documentElement.setAttribute("data-hero3d", "failed");
        document.documentElement.setAttribute("data-hero3d-error", String((err && err.stack) || err));
      }
    });

  function exposeDebug() {
    window.__hero3d = {
      events,
      state() {
        return {
          state: motion.state,
          theme: motion.theme,
          shownTexture: view ? view.textureTheme : null,
          toggle: toggleBtn ? toggleBtn.getAttribute("aria-pressed") : null,
          paused: motion.paused,
          pending: motion.pending,
          hold: motion.holdKind,
          angle: motion.angle,
          pose: motion.pose,
          stage: el.getAttribute("data-stage"),
          grip: grip ? { recognized: grip.recognized, type: grip.type } : null,
          pixelRatio: view ? view.pixelRatio : null,
          bias: view ? view.bias : null,
          entryOffset: view ? view.entryOffset : null,
          hint: hint ? { hidden: hint.hidden, shown: hint.classList.contains("is-shown") } : null,
        };
      },
      /** projected device outline at the current angle, in client px */
      deviceRect: () => view.deviceRect(),
      toggle: () => toggleBtn && toggleBtn.click(),
      setAngle(rad) {
        view.setPose({ angle: rad, entrance: 1, t: 1 });
        view.render();
      },
      setTheme(theme) {
        showTheme(theme);
        view.setTheme(theme);
        view.render();
      },
      snapshot() {
        view.render();
        return view.canvas.toDataURL("image/png");
      },
      render: () => view.render(),
      internals: view.internals,
      info: () => view.info(),
    };
    document.documentElement.setAttribute("data-hero3d", "ready");
  }
}

async function bootView(el, { coarse, log }) {
  const modelUrl = el.getAttribute("data-model");
  const screenUrl = { light: el.getAttribute("data-screen-light"), dark: el.getAttribute("data-screen-dark") };
  if (!modelUrl || !screenUrl.light || !screenUrl.dark) throw new Error("hero3d: missing data attributes");

  const canvas = document.createElement("canvas");
  canvas.className = "phone3d-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: DEBUG });
  // shader-compiler notes (e.g. D3D X4122) print as console warnings when on
  renderer.debug.checkShaderErrors = DEBUG;
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  try {
    const scene = new Scene();
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = 0.55;
    room.dispose();
    pmrem.dispose();

    // a soft key from the upper reading-start side and a cool rim from behind
    const key = new DirectionalLight(0xfff6e8, 1.1);
    key.position.set(-0.6, 0.9, 1.0);
    const rim = new DirectionalLight(0xe8f1ef, 0.9);
    rim.position.set(0.9, 0.4, -1.0);
    scene.add(key, rim);
    const camera = new PerspectiveCamera(12, 0.5, 0.2, 3);

    const [gltf, imgLight, imgDark] = await Promise.all([
      new GLTFLoader().loadAsync(modelUrl),
      decodeImage(screenUrl.light),
      decodeImage(screenUrl.dark),
    ]);
    const root = gltf.scene.getObjectByName("Zulfaa_Phone") || gltf.scene;
    scene.add(gltf.scene);

    let litScreen = null;
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.name === "M_Screen_Display") litScreen = m;
        // restrained reflections; the lens rings darker titanium, rougher
        else if (m.envMapIntensity !== undefined) {
          m.envMapIntensity = /Lens_Ring/.test(m.name) ? 0.45 : /Glass|Island/.test(m.name) ? 0.8 : 1.0;
          if (/Lens_Ring/.test(m.name)) {
            m.roughness = Math.max(m.roughness, 0.38);
            if (m.color) m.color.multiplyScalar(0.62);
          }
        }
      }
    });
    if (!litScreen) throw new Error("hero3d: no M_Screen_Display in the model");

    // the display is unlit (MeshBasicMaterial) with a mip LOD bias - see screen.js
    const screen = makeScreenMaterial();
    gltf.scene.traverse((o) => {
      if (o.isMesh && o.material === litScreen) o.material = screen.material;
    });
    litScreen.dispose();
    // both textures are made once; changing theme only swaps which one is bound
    const tex = { light: makeScreenTexture(imgLight, renderer), dark: makeScreenTexture(imgDark, renderer) };
    screen.material.map = tex.light;
    let textureTheme = "light";

    // framing: the whole device, camera bump included, at every angle
    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    let sweep = 0;
    for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) sweep = Math.max(sweep, Math.hypot(x, z));
    const FILL = 0.965;
    let deviceTopFraction = 0.04;
    let deviceWidthFraction = 0.9;

    const corner = new Vector3(); // reused: no allocation per pointer event
    const Y_AXIS = new Vector3(0, 1, 0);

    function frameCamera(aspect) {
      camera.aspect = aspect;
      const tanV = Math.tan((camera.fov * Math.PI) / 360);
      const tanH = tanV * aspect;
      const dV = sweep + size.y / 2 / (tanV * FILL);
      const dH = Math.hypot(sweep / (tanH * FILL), sweep);
      const d = Math.max(dV, dH);
      camera.position.set(0, 0, d);
      camera.near = Math.max(0.05, d - sweep * 2);
      camera.far = d + sweep * 2;
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const top = corner.set(0, box.max.y, box.max.z).project(camera);
      deviceTopFraction = (1 - top.y) / 2;
      const right = corner.set(box.max.x, 0, box.max.z).project(camera).x;
      const left = corner.set(box.min.x, 0, box.max.z).project(camera).x;
      deviceWidthFraction = (right - left) / 2;
    }

    let fullRatio = 1;
    let cssW = 1;
    let cssH = 1;
    function resize() {
      const r = el.getBoundingClientRect();
      cssW = Math.max(1, Math.round(r.width));
      cssH = Math.max(1, Math.round(r.height));
      fullRatio = pixelRatioFor(cssW, cssH, window.devicePixelRatio, coarse);
      renderer.setPixelRatio(fullRatio);
      renderer.setSize(cssW, cssH, false);
      frameCamera(cssW / cssH);
    }
    resize();
    el.appendChild(canvas);

    // both screens on the GPU and the shaders compiled before anything shows
    renderer.initTexture(tex.light);
    renderer.initTexture(tex.dark);
    if (renderer.extensions.has("KHR_parallel_shader_compile")) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    renderer.render(scene, camera);

    const governor = createFrameGovernor();
    let wasMoving = false;
    let angle = 0;
    let entryOffset = 0;
    let entering = false;

    /** How far above its place the phone starts: within the hero, below the
     *  header and never over the copy above it on narrow layouts. */
    function measureEntryOffset() {
      const boxRect = el.getBoundingClientRect();
      const wrap = el.closest(".hero-wrap");
      let limit = wrap ? wrap.getBoundingClientRect().top : boxRect.top - 96;
      const head = document.querySelector(".site-head");
      if (head) limit = Math.max(limit, head.getBoundingClientRect().bottom);
      const copy = document.querySelector(".hero-copy");
      if (copy) {
        const c = copy.getBoundingClientRect();
        if (c.bottom <= boxRect.top + 1) limit = Math.max(limit, c.bottom);
      }
      const deviceTop = boxRect.top + boxRect.height * deviceTopFraction;
      const room = deviceTop - limit - 6;
      const desired = Math.min(120, boxRect.height * 0.16);
      return Math.max(0, Math.min(desired, room));
    }

    /** projected outline of the device at the current angle, client px */
    function deviceRect() {
      const r = canvas.getBoundingClientRect();
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            corner.set(x, y, z).applyAxisAngle(Y_AXIS, angle).project(camera);
            const px = r.left + (corner.x * 0.5 + 0.5) * r.width;
            const py = r.top + (1 - (corner.y * 0.5 + 0.5)) * r.height;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          }
        }
      }
      return { left: minX, top: minY, right: maxX, bottom: maxY };
    }

    const v = {
      canvas,
      dirty: true,
      onDirty: null,
      onLost: null,
      get angle() {
        return angle;
      },
      get textureTheme() {
        return textureTheme;
      },
      get pixelRatio() {
        return renderer.getPixelRatio();
      },
      get bias() {
        return screen.bias;
      },
      get entryOffset() {
        return entryOffset;
      },
      internals: { scene, camera, renderer, root, screenMat: screen.material, tex, screen },
      markDirty() {
        v.dirty = true;
        if (v.onDirty) v.onDirty();
      },
      setTheme(theme) {
        const t = tex[theme];
        if (screen.material.map !== t) {
          screen.material.map = t;
          textureTheme = theme;
          v.markDirty();
        }
      },
      hitTest(clientX, clientY) {
        const d = deviceRect();
        const pad = 10;
        return clientX >= d.left - pad && clientX <= d.right + pad && clientY >= d.top - pad && clientY <= d.bottom + pad;
      },
      deviceRect,
      deviceWidth() {
        return canvas.getBoundingClientRect().width * deviceWidthFraction;
      },
      /** Show the canvas: in place (no entrance) or ready to descend. */
      reveal(inPlace) {
        if (inPlace) {
          el.classList.add("is-live");
          el.style.setProperty("--entry", "1");
          return;
        }
        entryOffset = measureEntryOffset();
        entering = true;
        canvas.style.transition = "none";
        canvas.style.opacity = "0";
        canvas.style.transform = `translate3d(0, ${-entryOffset}px, 0)`;
        el.style.setProperty("--entry", "0");
        el.classList.add("is-live");
        log("entry", { offset: Math.round(entryOffset) });
      },
      setPose(pose) {
        angle = pose.angle;
        root.rotation.y = pose.angle;
        root.rotation.x = entering ? ENTRY_TILT * (1 - pose.entrance) : 0;
        screen.setBias(biasForAngle(pose.angle, STATIONARY_BIAS));
        if (entering) {
          const fade = Math.min(1, pose.t / ENTRY_FADE);
          canvas.style.opacity = String(1 - (1 - fade) * (1 - fade));
          canvas.style.transform = `translate3d(0, ${(-entryOffset * (1 - pose.entrance)).toFixed(2)}px, 0)`;
          el.style.setProperty("--entry", pose.entrance.toFixed(3));
          if (pose.entrance >= 1) {
            entering = false;
            root.rotation.x = 0;
            canvas.style.transition = "";
            canvas.style.opacity = "";
            canvas.style.transform = "";
            el.style.setProperty("--entry", "1");
          }
        }
        v.dirty = true;
      },
      draw(now, state) {
        // adaptive resolution only while the phone is actually moving
        const moving = state === "turning" || ((state === "dragging" || state === "released") && v.dirty);
        if (moving) {
          const reduced = governor.sample(now, renderer.getPixelRatio());
          if (reduced) {
            renderer.setPixelRatio(reduced);
            renderer.setSize(cssW, cssH, false);
            log("resolution", { ratio: reduced, reason: "sustained slow frames" });
          }
        } else if (wasMoving) {
          governor.reset();
          if (renderer.getPixelRatio() !== fullRatio) {
            renderer.setPixelRatio(fullRatio);
            renderer.setSize(cssW, cssH, false);
            log("resolution", { ratio: fullRatio, reason: "motion ended" });
            v.dirty = true;
          }
        }
        wasMoving = moving;
        if (v.dirty) v.render();
      },
      render() {
        renderer.render(scene, camera);
        v.dirty = false;
      },
      info() {
        return {
          pixelRatio: renderer.getPixelRatio(),
          fullRatio,
          buffer: [canvas.width, canvas.height],
          css: [cssW, cssH],
          sweep,
          deviceTopFraction,
          deviceWidthFraction,
        };
      },
    };

    if ("ResizeObserver" in window) {
      new ResizeObserver(() => {
        resize();
        v.markDirty();
      }).observe(el);
    }
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      if (v.onLost) v.onLost();
    });
    return v;
  } catch (err) {
    renderer.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    throw err;
  }
}
