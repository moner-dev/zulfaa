/* ZULFAA - the scroll dock: "back to top" and "skip to the footer".

   It holds no animation loop. The only listeners are a passive scroll listener
   throttled to one frame, and a resize listener; between them they read
   window.scrollY, which costs no layout, and compare it against two numbers
   measured once per resize. Nothing here touches the wheel or touch events, so
   an ordinary scroll is never interrupted or hijacked.

   WHY aria-disabled AND NOT disabled. A real `disabled` button is removed from
   the tab order the instant it is disabled - so a reader who tabs to "back to
   top", presses it, and arrives at the top would have the focus fall off the
   button onto <body> while the page is still moving. `aria-disabled` keeps the
   button focusable and still announces it as unavailable, and the handler
   simply does nothing. That is the one behaviour the visual state must match.

   Without this file the dock stays `hidden` (the markup ships that way and the
   stylesheet hides it again for good measure), so it never appears as a pair
   of buttons that do nothing. */
(function () {
  "use strict";

  var dock = document.querySelector("[data-dock]");
  if (!dock) return;
  var up = dock.querySelector("[data-dock-up]");
  var down = dock.querySelector("[data-dock-down]");
  var foot = document.querySelector(".site-foot");
  if (!up || !down || !foot) return;

  var calm = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  /* the header is sticky, so the footer's first line has to clear it */
  function headroom() {
    var head = document.querySelector(".site-head");
    if (!head) return 0;
    return getComputedStyle(head).position === "sticky" ? head.getBoundingClientRect().height : 0;
  }

  /* Measured, never hard-coded. `target` is where the footer's top edge sits
     under the header - clamped to the furthest the document can actually
     scroll, because on a short page the document ends before the footer can
     reach the top of the screen and an unclamped target would leave the down
     arrow permanently available. */
  var target = 0;
  var furthest = 0;

  function measure() {
    var de = document.documentElement;
    furthest = Math.max(0, de.scrollHeight - window.innerHeight);
    var footTop = foot.getBoundingClientRect().top + window.scrollY;
    target = Math.min(Math.max(0, footTop - headroom()), furthest);
    /* a page that barely scrolls does not need the dock at all */
    var was = dock.hidden;
    dock.hidden = furthest < 240;
    if (was && !dock.hidden && typeof watch === "function") watch();
    paint();
  }

  function off(btn, no) {
    btn.setAttribute("aria-disabled", no ? "true" : "false");
  }

  function paint() {
    var y = window.scrollY;
    off(up, y <= 4);
    off(down, y >= target - 4);
  }

  function go(y) {
    window.scrollTo({ top: y, behavior: calm && calm.matches ? "instant" : "smooth" });
  }

  up.addEventListener("click", function () {
    if (up.getAttribute("aria-disabled") === "true") return;
    go(0);
  });

  down.addEventListener("click", function () {
    if (down.getAttribute("aria-disabled") === "true") return;
    measure();          // the page may have grown since the last resize
    go(target);
  });

  /* one frame's worth of throttling, not a loop: the callback is scheduled
     only when a scroll has happened and unschedules itself immediately */
  var waiting = false;
  window.addEventListener("scroll", function () {
    if (waiting) return;
    waiting = true;
    window.requestAnimationFrame(function () {
      waiting = false;
      paint();
    });
  }, { passive: true });

  /* STEPPING ASIDE. On a phone the contact form runs the full width, so for the
     whole time it scrolls past the corner the dock would sit on its labels,
     fields, button and the storage disclosure. While any part of the form is
     under the dock, the dock fades out (the same way it does for the drawer)
     and comes back once the form has passed. Wider layouts never overlap, so
     nothing changes there.

     No scroll work: one IntersectionObserver whose root box is shrunk, by
     negative margins, to the dock's own rectangle plus a small gap - so the
     browser reports exactly "the form is under the dock". It is rebuilt only
     when the viewport changes size. The dock is kept while it holds the
     keyboard focus, so a reader who pressed an arrow keeps their place while
     the page travels past the form. */
  var AVOID = "#contact-form, [data-cf-fallback], [data-dock-avoid]";
  var covered = 0;
  var watcher = null;

  function aside() {
    var keep = dock.contains(document.activeElement);
    dock.classList.toggle("is-aside", covered > 0 && !keep);
  }

  function watch() {
    if (!("IntersectionObserver" in window)) return;
    var avoid = document.querySelectorAll(AVOID);
    if (!avoid.length) return;
    if (watcher) watcher.disconnect();
    covered = 0;
    aside();
    if (dock.hidden) return;
    var r = dock.getBoundingClientRect();
    var gap = 8;
    var margin = [
      -Math.max(0, r.top - gap),
      -Math.max(0, window.innerWidth - r.right - gap),
      -Math.max(0, window.innerHeight - r.bottom - gap),
      -Math.max(0, r.left - gap)
    ].map(function (n) { return Math.floor(n) + "px"; }).join(" ");
    var under = [];
    watcher = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = under.indexOf(e.target);
        if (e.isIntersecting && i < 0) under.push(e.target);
        if (!e.isIntersecting && i >= 0) under.splice(i, 1);
      });
      covered = under.length;
      aside();
    }, { rootMargin: margin, threshold: 0 });
    for (var k = 0; k < avoid.length; k++) watcher.observe(avoid[k]);
  }

  dock.addEventListener("focusout", function () { window.setTimeout(aside, 0); });

  window.addEventListener("resize", measure, { passive: true });
  window.addEventListener("resize", watch, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  /* The home page carries twenty lazily-loaded slides, so the document is still
     growing for a second or two after first paint and the footer's position
     moves with it. Re-measure once everything has arrived. (A scroll already in
     flight cannot be corrected without taking the scroll away from the reader,
     which this dock never does - the arrow simply stays available.) */
  window.addEventListener("load", measure, { once: true, passive: true });
  measure();
  watch();
})();
