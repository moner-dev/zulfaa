/* ZULFAA — header navigation: the menu button and the language menu.
 *
 * Two disclosures, no library. The markup is complete without this file: the
 * primary links and the three language links are plain anchors that render
 * inline when the `js` class is absent from <html> (scripting off, or the
 * file failing to load). This file only adds the collapsed behaviour:
 *
 *   - the menu button (".nav-toggle") shows/hides the primary nav on narrow
 *     screens; the button's aria-expanded is the single source of truth and
 *     the stylesheet reads it
 *   - the language button (".lang-btn") opens the language list as a menu
 *   - both close on Escape (focus returns to the button), on a click outside,
 *     when a link inside is followed, and when focus leaves by keyboard
 *   - opening one closes the other
 *
 * Nothing here touches the scroll position, body overflow or the document
 * width. Direction-neutral: every offset lives in the stylesheet as a logical
 * property, so Arabic pages mirror themselves.
 */
(function () {
  "use strict";

  var head = document.querySelector(".site-head");
  if (!head) return;

  var COLLAPSED = window.matchMedia("(max-width: 68.75rem)");
  var open = null; // the disclosure currently open, if any

  function disclosure(btn, panel, opts) {
    if (!btn || !panel) return null;
    var links = Array.prototype.slice.call(panel.querySelectorAll("a"));

    var d = {
      btn: btn,
      panel: panel,
      isOpen: function () {
        return btn.getAttribute("aria-expanded") === "true";
      },
      set: function (on) {
        btn.setAttribute("aria-expanded", on ? "true" : "false");
        if (on) {
          if (open && open !== d) open.set(false);
          open = d;
        } else if (open === d) {
          open = null;
        }
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
      links: links,
    };

    btn.addEventListener("click", function (e) {
      var on = !d.isOpen();
      d.set(on);
      /* e.detail is 0 for a keyboard (Enter / Space) or assistive-tech click:
         for those the first item takes focus, as a menu button does */
      if (on && opts.focusFirst && e.detail === 0 && links.length) links[0].focus();
    });

    btn.addEventListener("keydown", function (e) {
      if (!opts.focusFirst || !links.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        d.set(true);
        links[e.key === "ArrowDown" ? 0 : links.length - 1].focus();
      }
    });

    /* a menu: arrows step through the options, Home/End jump */
    if (opts.focusFirst) {
      panel.addEventListener("keydown", function (e) {
        var i = links.indexOf(document.activeElement);
        if (i === -1) return;
        var next = -1;
        if (e.key === "ArrowDown") next = (i + 1) % links.length;
        else if (e.key === "ArrowUp") next = (i - 1 + links.length) % links.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = links.length - 1;
        if (next === -1) return;
        e.preventDefault();
        links[next].focus();
      });
    }

    /* following a link closes the panel — matters for same-page links and
       for the back/forward cache, which restores the page as it was left */
    panel.addEventListener("click", function (e) {
      if (e.target.closest("a")) d.set(false);
    });

    /* keyboard focus leaving both button and panel closes it. A null
       relatedTarget (focus going to the browser chrome, or a pointer press in
       a browser that does not focus what it presses) is left alone; the
       outside-click handler below covers the pointer case. */
    var onFocusOut = function (e) {
      if (!d.isOpen()) return;
      var to = e.relatedTarget;
      if (to && !d.contains(to)) d.set(false);
    };
    btn.addEventListener("focusout", onFocusOut);
    panel.addEventListener("focusout", onFocusOut);

    return d;
  }

  // ── the menu button ────────────────────────────────────────────────────
  var toggle = head.querySelector(".nav-toggle");
  var menu = disclosure(
    toggle,
    toggle && document.getElementById(toggle.getAttribute("aria-controls")),
    { focusFirst: false }
  );

  // ── the language menu ──────────────────────────────────────────────────
  var langBtn = head.querySelector(".lang-btn");
  var langList = langBtn && document.getElementById(langBtn.getAttribute("aria-controls"));
  var lang = disclosure(langBtn, langList, { focusFirst: true });
  if (lang) {
    /* menu semantics are added here, not in the markup, because without this
       file the list is a plain row of links and must read as one */
    langBtn.setAttribute("aria-haspopup", "menu");
    langList.setAttribute("role", "menu");
    Array.prototype.forEach.call(langList.children, function (li) {
      li.setAttribute("role", "none");
    });
    lang.links.forEach(function (a) {
      a.setAttribute("role", "menuitem");
      /* menu items are reached with the arrow keys; Tab leaves the menu */
      a.setAttribute("tabindex", "-1");
    });
  }

  // ── shared closers ─────────────────────────────────────────────────────
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !open) return;
    e.preventDefault();
    open.dismiss();
  });

  document.addEventListener("click", function (e) {
    if (open && !open.contains(e.target)) open.set(false);
  });

  /* the primary nav is inline again above the breakpoint: forget the state */
  var onBreakpoint = function () {
    if (!COLLAPSED.matches && menu && menu.isOpen()) menu.set(false);
  };
  if (COLLAPSED.addEventListener) COLLAPSED.addEventListener("change", onBreakpoint);
  else if (COLLAPSED.addListener) COLLAPSED.addListener(onBreakpoint);

  /* a page restored from the back/forward cache comes back as it was left */
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && open) open.set(false);
  });
})();
