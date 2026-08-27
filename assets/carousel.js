/* ZULFAA — screenshot carousel.
 *
 * No library, and deliberately no custom drag handling: the track is a native
 * scroll container with CSS scroll-snap, so touch swipe, trackpad flick,
 * momentum and snapping all come from the browser and behave the way the
 * platform behaves. This file only adds what native scrolling does not give:
 * the arrows, the keyboard step, and the "which slide is centred" state that
 * drives the emphasis and the position readout.
 *
 * Without this file the section still works — every screenshot is visible and
 * the row is swipeable and scrollable. The arrows and the readout stay hidden
 * until `is-enhanced` is set, so nothing on the page is ever inert.
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-carousel]");
  if (!root) return;

  var view = root.querySelector(".car-viewport");
  var slides = Array.prototype.slice.call(root.querySelectorAll(".shot"));
  if (!view || !slides.length) return;

  var prevBtn = root.querySelector(".car-prev");
  var nextBtn = root.querySelector(".car-next");
  var elIndex = root.querySelector("[data-car-index]");
  var elCap = root.querySelector("[data-car-cap]");

  var reduce = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  var active = -1;
  var ticking = false;

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /* The centred slide is simply the one whose centre is nearest the
     viewport's. Measured from rects, so it stays correct through a smooth
     scroll, a resize, or a font swap that changes the caption height. */
  function nearest() {
    var vr = view.getBoundingClientRect();
    var mid = vr.left + vr.width / 2;
    var best = 0;
    var bestDist = Infinity;
    for (var i = 0; i < slides.length; i++) {
      var sr = slides[i].getBoundingClientRect();
      var d = Math.abs(sr.left + sr.width / 2 - mid);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  function setActive(i) {
    if (i === active) return;
    if (active > -1 && slides[active]) slides[active].classList.remove("is-active");
    active = i;
    slides[active].classList.add("is-active");
    if (elIndex) elIndex.textContent = pad(i + 1);
    if (elCap) elCap.textContent = slides[i].getAttribute("data-cap") || "";
    if (prevBtn) prevBtn.disabled = i === 0;
    if (nextBtn) nextBtn.disabled = i === slides.length - 1;
  }

  /* Scroll by the measured gap between this slide's centre and the
     viewport's, rather than to an absolute offset — correct whatever the
     track padding, gap or slide width resolve to at this breakpoint. */
  function go(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    var vr = view.getBoundingClientRect();
    var sr = slides[i].getBoundingClientRect();
    var delta = sr.left + sr.width / 2 - (vr.left + vr.width / 2);
    if (!delta) {
      setActive(i);
      return;
    }
    view.scrollBy({ left: delta, behavior: reduce.matches ? "auto" : "smooth" });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      setActive(nearest());
    });
  }

  view.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      go(active - 1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      go(active + 1);
    });
  }

  /* Click a neighbour to bring it to the centre. A swipe never ends in a
     click, so this cannot fight the touch gesture. */
  slides.forEach(function (slide, i) {
    slide.addEventListener("click", function () {
      if (i !== active) go(i);
    });
  });

  /* The track is focusable, so arrows step slide by slide instead of
     nudging the scroll by a scrollbar's worth. */
  view.addEventListener("keydown", function (e) {
    var handled = true;
    if (e.key === "ArrowLeft") go(active - 1);
    else if (e.key === "ArrowRight") go(active + 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(slides.length - 1);
    else handled = false;
    if (handled) e.preventDefault();
  });

  root.classList.add("is-enhanced");
  setActive(nearest());
})();
