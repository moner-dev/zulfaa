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

  /* The lightbox asks the carousel to follow it, so closing the preview
     leaves the row showing the screenshot that was last being looked at. */
  root.addEventListener("zulfaa:goto", function (e) {
    go(e.detail.index);
  });

  root.classList.add("is-enhanced");
  setActive(nearest());
})();

/* ---------------------------------------------------------------------------
 * Screenshot lightbox.
 *
 * One dialog, reused. It is a sibling of the carousel and talks to it only
 * through a custom event, so neither knows how the other works. The markup is
 * `hidden` in the document and stays inert if this file never runs.
 * ------------------------------------------------------------------------ */
(function () {
  "use strict";

  var lb = document.getElementById("lb");
  var carousel = document.querySelector("[data-carousel]");
  if (!lb || !carousel) return;

  var slides = Array.prototype.slice.call(carousel.querySelectorAll(".shot"));
  if (!slides.length) return;

  var img = lb.querySelector(".lb-img");
  var stage = lb.querySelector(".lb-stage");
  var elIndex = lb.querySelector("[data-lb-index]");
  var elTotal = lb.querySelector("[data-lb-total]");
  var elName = lb.querySelector("[data-lb-name]");
  var btnClose = lb.querySelector(".lb-close");
  var btnPrev = lb.querySelector(".lb-prev");
  var btnNext = lb.querySelector(".lb-next");
  var focusables = [btnClose, btnPrev, btnNext];

  var shots = slides.map(function (s) {
    var i = s.querySelector("img");
    return {
      src: i.getAttribute("src"),
      alt: i.getAttribute("alt") || "",
      w: i.getAttribute("width"),
      h: i.getAttribute("height"),
      cap: s.getAttribute("data-cap") || "",
    };
  });

  var open = false;
  var current = 0;
  var opener = null;
  var openedAt = 0;
  var scrollY = 0;

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  if (elTotal) elTotal.textContent = pad(shots.length);

  function show(i) {
    current = (i + shots.length) % shots.length; // wrap-around
    var s = shots[current];
    img.setAttribute("width", s.w);
    img.setAttribute("height", s.h);
    img.src = s.src;
    img.alt = s.alt;
    if (elIndex) elIndex.textContent = pad(current + 1);
    if (elName) elName.textContent = s.cap;
  }

  /* The scrollbar is removed with the scroll lock, so its width is given back
     as padding — otherwise the page behind the backdrop jumps sideways. */
  function lockScroll() {
    scrollY = window.scrollY;
    var sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (sw > 0) document.body.style.paddingRight = sw + "px";
  }

  function unlockScroll() {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }

  function openAt(i, trigger) {
    if (open) return;
    opener = trigger || null;
    openedAt = i;
    show(i);
    lb.hidden = false;
    open = true;
    lockScroll();
    btnClose.focus();
  }

  function close() {
    if (!open) return;
    lb.hidden = true;
    open = false;
    unlockScroll();

    /* Send the row to whatever was last on screen, then hand focus back. If
       the viewer never navigated, that is the control they opened it with. */
    if (current !== openedAt) {
      carousel.dispatchEvent(new CustomEvent("zulfaa:goto", { detail: { index: current } }));
      var z = slides[current].querySelector(".shot-zoom");
      // preventScroll: the row is already gliding there; focus must not yank it
      if (z) { z.focus({ preventScroll: true }); opener = null; }
    }
    if (opener && document.contains(opener)) opener.focus();
    opener = null;
  }

  // ── openers ────────────────────────────────────────────────────────────
  slides.forEach(function (slide, i) {
    var zoom = slide.querySelector(".shot-zoom");
    if (zoom) {
      zoom.addEventListener("click", function (e) {
        e.stopPropagation(); // never also re-centre the row
        openAt(i, zoom);
      });
    }
    /* Tapping the centred screenshot opens it too — the natural gesture on a
       touch screen, where there is no hover to reveal the button. A slide that
       is not centred keeps its existing "bring me to the middle" click. */
    slide.addEventListener("click", function () {
      if (slide.classList.contains("is-active")) openAt(i, zoom || slide);
    });
  });

  // ── closers ────────────────────────────────────────────────────────────
  /* The dialog covers the whole viewport, so the backdrop is never the click
     target itself. Close on anything that is not the picture or a control:
     the backdrop, the dialog's own margin, and the empty stage around the
     image all read as "outside", which is what a viewer expects. */
  lb.addEventListener("click", function (e) {
    /* Order matters. The stage is a closing surface and the figure sits
       inside it, so the picture has to be excused FIRST - otherwise
       closest() walks up from the image, finds the stage, and a click on the
       screenshot dismisses the very thing it was meant to inspect. */
    if (e.target.closest(".lb-figure")) return; // the image and its caption
    if (e.target.closest(".lb-prev") || e.target.closest(".lb-next")) return;
    close(); // the X, the backdrop, the dialog's margin, the empty stage
  });

  btnPrev.addEventListener("click", function () { show(current - 1); });
  btnNext.addEventListener("click", function () { show(current + 1); });

  document.addEventListener("keydown", function (e) {
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); show(current - 1); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); show(current + 1); return; }
    if (e.key === "Tab") {
      // a three-control trap: focus cannot escape to the page behind
      var i = focusables.indexOf(document.activeElement);
      var next = e.shiftKey ? i - 1 : i + 1;
      if (i === -1) next = 0;
      if (next < 0) next = focusables.length - 1;
      if (next >= focusables.length) next = 0;
      e.preventDefault();
      focusables[next].focus();
    }
  });

  // ── swipe ──────────────────────────────────────────────────────────────
  var tx = 0, ty = 0;
  stage.addEventListener("touchstart", function (e) {
    tx = e.changedTouches[0].clientX;
    ty = e.changedTouches[0].clientY;
  }, { passive: true });

  stage.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - tx;
    var dy = e.changedTouches[0].clientY - ty;
    // horizontal intent only, so a vertical flick never flips the image
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(current + (dx < 0 ? 1 : -1));
  }, { passive: true });
})();
