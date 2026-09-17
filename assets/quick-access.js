/* ZULFAA - the Quick Access dial, the landing page's second section.

   Progressive enhancement. Without this file every feature is already in the
   page as text and each sticker is a link to it. With it:
     - the ring becomes a tablist and one feature is shown at a time;
     - choosing a sticker turns the ring the short way until that sticker rests
       under the fixed gold marker (stickers and labels stay upright: CSS);
     - Play presents all eight once, seven seconds each, then stops.
   Nothing runs at rest: there is no animation-frame loop, and the one timer
   belongs to a presentation the visitor started. It is suspended while the
   dial is off screen or the tab is hidden and restarted, never caught up, on
   return. Markup: tools/quick_access.py. Styles: the .qa block in zulfaa.css. */
(function () {
  "use strict";

  var root = document.querySelector("[data-qa]");
  if (!root) return;

  var DWELL = 7000;
  var dial = root.querySelector(".qa-dial");
  var ring = root.querySelector(".qa-ring");
  var big = root.querySelector(".qa-big");
  var box = root.querySelector(".qa-panels");
  var tour = root.querySelector(".qa-tour");
  var play = root.querySelector(".qa-play");
  var playLabel = play ? play.querySelector(".qa-play-label") : null;
  if (!dial || !ring || !big || !box) return;

  var nodes = [].slice.call(ring.querySelectorAll(".qa-node"));
  var panels = nodes.map(function (n) {
    return document.getElementById(n.hash.slice(1));
  });
  if (!nodes.length || panels.indexOf(null) !== -1) return;

  var rtl = document.documentElement.getAttribute("dir") === "rtl";
  var step = rtl ? -45 : 45;
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function calm() {
    return !!(mq && mq.matches);
  }

  var current = 0;
  var rot = 0;
  var fade = null;

  ring.setAttribute("role", "tablist");
  if (ring.getAttribute("data-label")) ring.setAttribute("aria-label", ring.getAttribute("data-label"));
  nodes.forEach(function (n, i) {
    n.setAttribute("role", "tab");
    n.setAttribute("aria-controls", panels[i].id);
    panels[i].setAttribute("role", "tabpanel");
    panels[i].setAttribute("aria-labelledby", n.id);
    if (n.classList.contains("is-selected")) current = i;
    n.addEventListener("click", function (ev) {
      ev.preventDefault();
      choose(i, false);
    });
  });

  /* Turn to feature i. The ring's angle is kept as one running number and moved
     by the shortest signed difference, so it never takes the long way or makes
     a full turn. A choice made while the ring is still moving simply retargets
     the same CSS transition from where it is - nothing queues or stacks. */
  function show(i, animate) {
    var n = nodes.length;
    i = ((i % n) + n) % n;
    var target = -i * step;
    rot += ((((target - rot) % 360) + 540) % 360) - 180;
    dial.style.setProperty("--rot", rot + "deg");

    nodes.forEach(function (node, k) {
      var on = k === i;
      node.classList.toggle("is-selected", on);
      node.setAttribute("aria-selected", on ? "true" : "false");
      node.tabIndex = on ? 0 : -1;
      panels[k].classList.toggle("is-active", on);
    });

    var src = nodes[i].getAttribute("data-big");
    if (big.getAttribute("src") !== src) {
      var set = nodes[i].getAttribute("data-big-srcset");
      if (set) big.setAttribute("srcset", set);
      else big.removeAttribute("srcset");
      big.setAttribute("src", src);
      big.setAttribute("data-kind", nodes[i].getAttribute("data-kind"));
      if (animate && !calm() && big.animate) {
        if (fade) fade.cancel();
        fade = big.animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: 240, easing: "ease-out" });
      }
    }
    current = i;
  }

  /* a visitor's choice always wins over the presentation */
  function choose(i, focus) {
    stop();
    show(i, true);
    if (focus) nodes[current].focus();
  }

  ring.addEventListener("keydown", function (ev) {
    var next = rtl ? "ArrowLeft" : "ArrowRight";
    var prev = rtl ? "ArrowRight" : "ArrowLeft";
    var to;
    if (ev.key === next || ev.key === "ArrowDown") to = current + 1;
    else if (ev.key === prev || ev.key === "ArrowUp") to = current - 1;
    else if (ev.key === "Home") to = 0;
    else if (ev.key === "End") to = nodes.length - 1;
    else if (ev.key === " " || ev.key === "Enter") {
      to = nodes.indexOf(document.activeElement);
      if (to < 0) return;
    } else return;
    ev.preventDefault();
    choose(to, true);
  });

  /* ── the one-pass presentation ─────────────────────────────────────────── */
  var playing = false;
  var left = 0; // features still to show in this pass
  var timer = 0;
  var inView = true;

  function paint() {
    if (play) {
      play.setAttribute("aria-pressed", playing ? "true" : "false");
      if (playLabel) playLabel.textContent = play.getAttribute(playing ? "data-pause" : "data-play");
    }
    // announce a visitor's own choice; stay quiet while the tour moves on
    box.setAttribute("aria-live", playing ? "off" : "polite");
  }

  function arm() {
    clearTimeout(timer);
    timer = 0;
    if (playing && inView && !document.hidden) timer = setTimeout(tick, DWELL);
  }

  function tick() {
    timer = 0;
    if (left > 0) {
      left -= 1;
      show(current + 1, true);
      arm();
    } else {
      playing = false; // the eighth has had its turn: the pass is over
      paint();
    }
  }

  function stop() {
    playing = false;
    left = 0;
    clearTimeout(timer);
    timer = 0;
    paint();
  }

  if (play) {
    play.addEventListener("click", function () {
      if (playing) {
        playing = false; // pause keeps the place in the pass
      } else {
        if (left <= 0) left = nodes.length - 1;
        playing = true;
      }
      paint();
      arm();
    });
  }

  var warmed = false;
  function warm() {
    if (warmed) return;
    warmed = true;
    nodes.forEach(function (n) {
      var im = new Image();
      im.decoding = "async";
      var set = n.getAttribute("data-big-srcset");
      if (set) {
        im.sizes = big.getAttribute("sizes") || "";
        im.srcset = set;
      }
      im.src = n.getAttribute("data-big");
    });
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        inView = entries[entries.length - 1].isIntersecting;
        if (inView) warm();
        arm();
      },
      { threshold: 0.35 }
    ).observe(dial);
  } else {
    warm();
  }
  document.addEventListener("visibilitychange", arm);

  // a link to one feature (#qa-umrah) opens on that feature
  var fromHash = panels.map(function (p) { return "#" + p.id; }).indexOf(location.hash);
  show(fromHash >= 0 ? fromHash : current, false);
  if (tour) tour.hidden = false;
  paint();
  // transitions only once the first position is painted, so nothing turns on load
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      root.classList.add("is-ready");
    });
  });
})();
