/* ZULFAA — the Updates page.
 *
 * Progressive enhancement only. Everything here already works without it:
 * the stylesheet shows the release the URL fragment names (or the newest),
 * the release navigator is a <details> that simply stands open, and each
 * "View all … changes" is a <details> of its own. This script makes three
 * things explicit that CSS can only approximate:
 *
 *   1. which release is selected, as a class rather than a :target guess -
 *      so a link into a section deep inside a release still shows that
 *      release, and scrolls to the section once it is visible;
 *   2. the navigator's "current" mark and the one-line label it collapses
 *      to on a phone;
 *   3. which section of the selected release is in view, for the section nav.
 */
(function () {
  "use strict";
  var nav = document.querySelector(".release-nav");
  var stage = document.querySelector(".stage");
  if (!nav || !stage) return;

  var releases = Array.prototype.slice.call(stage.querySelectorAll(".release"));
  var links = Array.prototype.slice.call(nav.querySelectorAll(".rn-list a"));
  var label = nav.querySelector("[data-rn-label]");
  var version = nav.querySelector("[data-rn-version]");
  var narrow = window.matchMedia("(max-width: 68.75rem)");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  function releaseFor(hash) {
    var id = hash && hash.charAt(0) === "#" ? hash.slice(1) : hash;
    var el = id ? document.getElementById(id) : null;
    while (el && !(el.classList && el.classList.contains("release"))) el = el.parentElement;
    return el || releases[0];
  }

  function select(scroll) {
    var cur = releaseFor(location.hash);
    releases.forEach(function (r) {
      var on = r === cur;
      r.classList.toggle("is-selected", on);
      r.hidden = !on;
    });
    links.forEach(function (a) {
      var on = a.getAttribute("href") === "#" + cur.id;
      if (on) {
        a.setAttribute("aria-current", "true");
        label.textContent = a.querySelector(".rn-label").textContent;
        version.textContent = a.querySelector(".rn-version").textContent;
      } else {
        a.removeAttribute("aria-current");
      }
    });
    if (narrow.matches) nav.open = false;
    if (scroll && location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "start" });
    }
    watchSections(cur);
  }

  // ── the section nav: mark the section that is in view ────────────────
  var sectionLinks = [], sections = [], ticking = false;

  function watchSections(cur) {
    var sn = cur.querySelector(".sec-nav");
    sectionLinks = sn ? Array.prototype.slice.call(sn.querySelectorAll("a")) : [];
    sections = sectionLinks.map(function (a) {
      return document.getElementById(a.getAttribute("href").slice(1));
    });
    markSection();
  }

  function markSection() {
    ticking = false;
    if (!sections.length) return;
    var line = window.innerHeight * 0.32, best = 0;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i] && sections[i].getBoundingClientRect().top <= line) best = i;
    }
    sectionLinks.forEach(function (a, i) {
      if (i === best) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  }

  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(markSection); }
  }, { passive: true });

  // ── the navigator: sidebar above the breakpoint, a selector below ─────
  function fit() {
    if (!narrow.matches) nav.open = true;
  }
  if (narrow.addEventListener) narrow.addEventListener("change", fit);
  else narrow.addListener(fit);

  // Close the selector when a release is chosen from it, and let the browser
  // change the hash as it would for any link.
  nav.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest(".rn-list a");
    if (a && narrow.matches) nav.open = false;
  });

  stage.classList.add("js-select");
  window.addEventListener("hashchange", function () { select(true); });
  fit();
  select(true);
})();
