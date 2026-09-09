/* ZULFAA — header navigation: the side drawer and the language menu.
 *
 * No library. The markup is complete without this file: the primary links and
 * the three language links are plain anchors that render inline when the `js`
 * class is absent from <html> (scripting off, or the file failing to load).
 * This file adds only the collapsed behaviour.
 *
 * TWO CONTROLS, AND THEY ARE NOT THE SAME KIND OF THING:
 *
 *   the drawer (".nav-toggle" -> "#site-menu")
 *     Below 1100px the primary nav and the language switcher slide in from the
 *     reading end — the right in English and Dutch, the left in Arabic, which
 *     the stylesheet does with one logical property. It is modal: a backdrop
 *     covers the page, the background does not scroll, Tab is kept inside, and
 *     it closes on the close button, the backdrop, Escape, or following a link.
 *
 *   the language menu (".lang-btn" -> "#lang-menu")
 *     A menu button, on the DESKTOP header only. Inside the drawer the same
 *     <ul> is styled as a plain segmented row of three links and the button is
 *     not rendered, so the menu semantics are removed with it — see
 *     applyLangMode(). Keeping role="menuitem" and tabindex="-1" on links that
 *     are no longer in a menu would make them unreachable by Tab.
 *
 * The button's aria-expanded is the single source of truth in both cases, and
 * the stylesheet reads it. Nothing here measures or sets the document width.
 */
(function () {
  "use strict";

  var head = document.querySelector(".site-head");
  if (!head) return;

  var COLLAPSED = window.matchMedia("(max-width: 68.75rem)");
  var open = null; // the disclosure currently open, if any

  var FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function disclosure(btn, panel, opts) {
    if (!btn || !panel) return null;

    var d = {
      btn: btn,
      panel: panel,
      links: Array.prototype.slice.call(panel.querySelectorAll("a")),
      isOpen: function () {
        return btn.getAttribute("aria-expanded") === "true";
      },
      set: function (on) {
        if (on === d.isOpen()) return;
        btn.setAttribute("aria-expanded", on ? "true" : "false");
        if (on) {
          if (open && open !== d) open.set(false);
          open = d;
        } else if (open === d) {
          open = null;
        }
        if (opts.onToggle) opts.onToggle(on);
      },
      /* close and, when focus was inside, hand it back to the button */
      dismiss: function () {
        var inside = btn === document.activeElement || panel.contains(document.activeElement);
        d.set(false);
        if (inside) btn.focus();
      },
      contains: function (node) {
        return btn.contains(node) || panel.contains(node);
      },
    };

    btn.addEventListener("click", function (e) {
      var on = !d.isOpen();
      d.set(on);
      /* e.detail is 0 for a keyboard (Enter / Space) or assistive-tech click:
         for those the first item takes focus, as a menu button does */
      if (on && opts.focusFirst && e.detail === 0) {
        var first = d.firstFocus && d.firstFocus();
        if (first) first.focus();
      }
    });

    btn.addEventListener("keydown", function (e) {
      if (!opts.arrowKeys || !d.links.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        d.set(true);
        d.links[e.key === "ArrowDown" ? 0 : d.links.length - 1].focus();
      }
    });

    /* a menu: arrows step through the options, Home/End jump */
    if (opts.arrowKeys) {
      panel.addEventListener("keydown", function (e) {
        var i = d.links.indexOf(document.activeElement);
        if (i === -1) return;
        var next = -1;
        if (e.key === "ArrowDown") next = (i + 1) % d.links.length;
        else if (e.key === "ArrowUp") next = (i - 1 + d.links.length) % d.links.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = d.links.length - 1;
        if (next === -1) return;
        e.preventDefault();
        d.links[next].focus();
      });
    }

    /* following a link closes the panel — matters for same-page links and
       for the back/forward cache, which restores the page as it was left */
    panel.addEventListener("click", function (e) {
      if (e.target.closest("a")) d.set(false);
    });

    return d;
  }

  // ── the drawer ─────────────────────────────────────────────────────────
  var toggle = head.querySelector(".nav-toggle");
  var drawer = toggle && document.getElementById(toggle.getAttribute("aria-controls"));
  var scrim = head.querySelector(".scrim");
  var closeBtn = drawer && drawer.querySelector(".drawer-close");

  /* the backdrop exists in the markup but stays `hidden` until this file runs,
     so a page with scripting off never has an invisible layer over it */
  if (scrim) scrim.removeAttribute("hidden");

  var menu = disclosure(toggle, drawer, {
    focusFirst: true,
    arrowKeys: false,
    onToggle: function (on) {
      /* the page behind a modal drawer does not scroll. Only ever set and
         cleared here, and only while the drawer is open, so nothing else on
         the page has to know about it. */
      document.body.style.overflow = on && COLLAPSED.matches ? "hidden" : "";
    },
  });

  if (menu) {
    /* opened by keyboard: the close button is the first thing in the panel */
    menu.firstFocus = function () {
      return closeBtn || menu.links[0];
    };

    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        menu.set(false);
        toggle.focus();
      });
    }

    if (scrim) {
      scrim.addEventListener("click", function () {
        menu.set(false);
      });
    }

    /* Tab stays inside the open drawer: it is modal, and letting focus walk
       into the page behind a backdrop is the classic drawer bug */
    drawer.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || !menu.isOpen() || !COLLAPSED.matches) return;
      var items = Array.prototype.filter.call(
        drawer.querySelectorAll(FOCUSABLE),
        function (el) { return el.getClientRects().length; }
      );
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  // ── the language menu (desktop header only) ────────────────────────────
  var langBtn = head.querySelector(".lang-btn");
  var langList = langBtn && document.getElementById(langBtn.getAttribute("aria-controls"));
  var lang = disclosure(langBtn, langList, { focusFirst: true, arrowKeys: true });
  if (lang) lang.firstFocus = function () { return lang.links[0]; };

  /* Menu semantics belong to the desktop control only. Inside the drawer the
     same list is a segmented row of ordinary links, and it must tab like one. */
  function applyLangMode() {
    if (!lang) return;
    var isMenu = !COLLAPSED.matches;
    if (isMenu) {
      langBtn.setAttribute("aria-haspopup", "menu");
      langList.setAttribute("role", "menu");
    } else {
      langBtn.removeAttribute("aria-haspopup");
      langList.removeAttribute("role");
      lang.set(false);
    }
    Array.prototype.forEach.call(langList.children, function (li) {
      if (isMenu) li.setAttribute("role", "none");
      else li.removeAttribute("role");
    });
    lang.links.forEach(function (a) {
      if (isMenu) {
        a.setAttribute("role", "menuitem");
        /* menu items are reached with the arrow keys; Tab leaves the menu */
        a.setAttribute("tabindex", "-1");
      } else {
        a.removeAttribute("role");
        a.removeAttribute("tabindex");
      }
    });
  }
  applyLangMode();

  // ── shared closers ─────────────────────────────────────────────────────
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !open) return;
    e.preventDefault();
    open.dismiss();
  });

  document.addEventListener("click", function (e) {
    /* the drawer has its own backdrop; a stray click on the page behind it
       cannot reach this handler anyway */
    if (open && open !== menu && !open.contains(e.target)) open.set(false);
  });

  /* crossing the breakpoint: the drawer is not a drawer above it, and the
     language list changes what kind of control it is */
  var onBreakpoint = function () {
    if (!COLLAPSED.matches && menu && menu.isOpen()) menu.set(false);
    document.body.style.overflow = menu && menu.isOpen() && COLLAPSED.matches ? "hidden" : "";
    applyLangMode();
  };
  if (COLLAPSED.addEventListener) COLLAPSED.addEventListener("change", onBreakpoint);
  else if (COLLAPSED.addListener) COLLAPSED.addListener(onBreakpoint);

  /* a page restored from the back/forward cache comes back as it was left */
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && open) open.set(false);
  });
})();
