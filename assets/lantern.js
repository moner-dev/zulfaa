/* ZULFAA - the hanging lantern, which is the site's light/dark control.

   The lantern is drawn and animated entirely in CSS (assets/zulfaa.css). This
   file only decides state: which theme is on, what the button is called, and
   when to run the short ignition or shutdown sequence. There is no animation
   loop here and nothing runs while the page is idle.

   It does not touch the hero phone's own day/night button: that one belongs to
   hero3d.js, sets data-theme on the phone, and remembers itself in
   sessionStorage. This is `data-site-theme` on <html>, saved under
   `zulfaa-site-theme` in localStorage. The two never meet.

   Without this file the lantern still renders, hanging and lit-by-CSS in dark,
   and the page keeps whatever theme the boot script applied. */
(function () {
  "use strict";

  var root = document.documentElement;
  var btn = document.querySelector(".lantern");
  if (!btn) return;

  var KEY = "zulfaa-site-theme";
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var calm = function () { return !!(mq && mq.matches); };
  var busy = false;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function remember(theme) {
    try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode: this page only */ }
  }

  /* the button says what it will DO, not what it is */
  function paint(dark) {
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
    btn.setAttribute("aria-label", btn.getAttribute(dark ? "data-to-light" : "data-to-dark"));
    btn.setAttribute("title", btn.getAttribute(dark ? "data-tip-light" : "data-tip-dark"));
  }

  paint(stored() === "dark" || root.getAttribute("data-site-theme") === "dark");

  function apply(dark) {
    root.setAttribute("data-site-theme", dark ? "dark" : "light");
    remember(dark ? "dark" : "light");
    paint(dark);
  }

  btn.addEventListener("click", function () {
    if (busy) return;
    var dark = btn.getAttribute("aria-pressed") !== "true";

    if (calm()) { apply(dark); return; } // no theatre when motion is unwelcome

    busy = true;
    /* The sequence is CSS. `is-striking` runs the flicker-and-rise on the way
       into dark, `is-dimming` the fade on the way out; the theme itself flips
       partway through, while the light is already growing, so the page never
       changes under an unlit lantern. */
    btn.classList.add(dark ? "is-striking" : "is-dimming");
    window.setTimeout(function () { apply(dark); }, dark ? 260 : 180);
    window.setTimeout(function () {
      btn.classList.remove("is-striking", "is-dimming");
      busy = false;
    }, dark ? 760 : 560);
  });
})();

/* Images that follow the SITE theme: the carousel's screenshots and the
   article art. Each carries both themes' files as data-src-light /
   data-srcset-light / data-src-dark / data-srcset-dark, and chrome.THEMED_IMG_BOOT
   (inline, right after them) has already chosen the right set while the page
   was parsing. This keeps them in step when the theme changes afterwards, on
   any page - this file is on every page, the carousel's script only on home.

   Only src and srcset change: the browser keeps the current picture until the
   new one has arrived, and width/height hold the box, so nothing moves. A
   `zulfaa:theme` event on document tells anything showing a copy (the
   screenshot preview) to follow. Dark pictures are the app's own dark screens,
   never a filter. */
(function () {
  "use strict";

  var html = document.documentElement;
  if (!window.MutationObserver) return;

  var shown = null;

  function theme() {
    return html.getAttribute("data-site-theme") === "dark" ? "dark" : "light";
  }

  function apply() {
    var t = theme();
    if (t === shown) return;
    shown = t;
    var imgs = document.querySelectorAll("img[data-src-light][data-src-dark]");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var set = img.getAttribute("data-srcset-" + t);
      var src = img.getAttribute("data-src-" + t);
      // srcset first: with it in place the src change starts one request, not two
      if (set && img.getAttribute("srcset") !== set) img.setAttribute("srcset", set);
      if (src && img.getAttribute("src") !== src) img.setAttribute("src", src);
    }
    document.dispatchEvent(new CustomEvent("zulfaa:theme", { detail: { theme: t } }));
  }

  apply();
  new MutationObserver(apply).observe(html, { attributes: true, attributeFilter: ["data-site-theme"] });
})();
