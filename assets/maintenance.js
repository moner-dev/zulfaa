/* ZULFAA - the maintenance page's countdown.

   The ONLY place the countdown is computed. The end time is not written here:
   tools/maintenance.json holds it, and the build copies it into the page as
   `data-ends` on .mt-count (an absolute UTC instant).

   HOW IT KEEPS TIME. Nothing counts down. Every tick recomputes what is left
   from the target instant and the browser clock, so a reload, a sleeping
   laptop or a throttled background tab can never make it drift - the next
   tick is simply right again. Ticks are scheduled for the moment the seconds
   figure actually changes rather than on a fixed 1000ms interval, and the
   figure shown is the remainder rounded UP, so 00:00:00:00 appears at exactly
   the moment the window ends and never a second early.

   AT ZERO it stops: the cells rest at zero, the calm "should be complete"
   line replaces the intro, and Try again becomes the primary action. It does
   NOT reload the page by itself - a page that reloads itself into a gate that
   is still closed is a loop.

   SCREEN READERS. The cells are not live; ticking them aloud every second
   would make the page unusable. The one polite announcement is the transition
   to zero, and only when the visitor was here to see it happen.

   A CLOCK THAT CANNOT BE RIGHT (years off, or the end hundreds of days away)
   hides the cells and keeps the absolute end time, which is still true. */
(function () {
  "use strict";

  var box = document.querySelector(".mt-count");
  if (!box) return;

  var end = Date.parse(box.getAttribute("data-ends"));
  var start = Date.parse(box.getAttribute("data-starts"));
  /* set by the build when the gate is on AND covers this language's home */
  var homeGated = box.getAttribute("data-home-gated") === "true";
  var lang = box.getAttribute("data-lang") || "en";
  var cells = {};
  Array.prototype.forEach.call(box.querySelectorAll("[data-unit]"), function (el) {
    cells[el.getAttribute("data-unit")] = el;
  });
  var doneLine = box.querySelector(".mt-done");
  var live = document.querySelector("[data-mt-live]");
  var home = document.querySelector("[data-mt-home]");
  var retry = document.querySelector("[data-mt-retry]");

  var AR = "٠١٢٣٤٥٦٧٨٩";
  var DAY = 86400000;
  var FLOOR = Date.UTC(2024, 0, 1); // a clock earlier than this is not a clock
  var HORIZON = 400 * DAY; // no maintenance window is announced this far out

  function two(n) {
    var s = n < 10 ? "0" + n : String(n);
    /* Arabic pages number in Arabic-Indic digits, as the app and the legal
       pages do (tools/chrome.py `num`) */
    return lang === "ar" ? s.replace(/\d/g, function (d) { return AR.charAt(+d); }) : s;
  }

  function show(unit, n) {
    var el = cells[unit];
    if (!el) return;
    var text = two(n);
    if (el.textContent === text) return;
    if (lang !== "ar" || text.indexOf("٠") === -1) {
      el.textContent = text;
      return;
    }
    /* The Arabic-Indic zero is traditionally a small dot, so "٠٠" read as an
       empty cell. Each zero gets its own span that the stylesheet sizes up to
       the weight of its neighbours; the digit itself is unchanged. */
    el.innerHTML = text.replace(/٠/g, '<span class="mt-zero">٠</span>');
  }

  // ── Try again: back to where the visitor was going ──────────────────────
  /* The gate sends people here with ?from=<path>. It is accepted only when it
     is a path on this site whose ROUTE - the path with any /ar/ or /nl/ prefix
     taken off - is one of the pages that exist in all three languages
     (`data-routes`, written by the build). Anything else - another origin, a
     protocol-relative or backslash trick, a maintenance page, a route the site
     does not have - is dropped, and Try again stays on this language's home.

     Try again always goes to that route IN THIS PAGE'S LANGUAGE, and each
     language link carries the same route in ITS language, so switching
     language on this page moves the destination with it. */
  var routes = (box.getAttribute("data-routes") || "").split(/\s+/).filter(Boolean);

  function split(path) {
    var m = /^\/(ar|nl)(\/.*)?$/.exec(path);
    return m ? { lang: m[1], route: m[2] || "/" } : { lang: "en", route: path };
  }
  function localize(route, l) {
    return (l === "ar" || l === "nl" ? "/" + l : "") + route;
  }

  var from = null; // { route, rest } - rest is the query and fragment, kept as given
  try {
    var raw = new URLSearchParams(location.search).get("from");
    if (raw && raw.charAt(0) === "/" && raw.charAt(1) !== "/" && raw.indexOf("\\") === -1) {
      var u = new URL(raw, location.href);
      var path = u.pathname.replace(/index\.html$/, "");
      if (path.charAt(path.length - 1) !== "/") path += "/";
      var route = split(path).route;
      if (u.origin === location.origin && routes.indexOf(route) !== -1 &&
          !/^\/maintenance\//.test(route)) {
        /* the gate never forwards a query of its own; one the visitor had is
           kept, but a nested `from` is not, so no chain can be built */
        u.searchParams.delete("from");
        from = { route: route, rest: u.search + u.hash };
      }
    }
  } catch (e) {
    from = null;
  }
  if (from) {
    if (retry) retry.setAttribute("href", localize(from.route, lang) + from.rest);
    Array.prototype.forEach.call(document.querySelectorAll(
      ".topbar-lang-list a, .lang-list a, .fo-langs a"), function (a) {
      var target = (a.getAttribute("href") || "").split("?")[0];
      var to;
      try {
        to = split(new URL(target, location.href).pathname).lang;
      } catch (e) {
        return;
      }
      a.setAttribute("href", target + "?from=" + encodeURIComponent(localize(from.route, to) + from.rest));
    });
  }

  // ── the end time, in the visitor's own zone ─────────────────────────────
  var time = box.querySelector("time");
  if (time && isFinite(end)) {
    try {
      var locale = { en: "en-GB", nl: "nl-NL", ar: "ar-u-nu-arab" }[lang] || "en-GB";
      var parts = {
        weekday: "long", day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit",
      };
      /* Latin locales have short zone names ("CEST"); Arabic falls back to
         "غرينتش+٢", which reads as noise. The time is the reader's own local
         time either way. */
      if (lang !== "ar") parts.timeZoneName = "short";
      time.textContent = new Intl.DateTimeFormat(locale, parts).format(end);
    } catch (e) {
      /* no Intl: the UTC text the build wrote stays */
    }
  }

  // ── links the gate would send straight back here ────────────────────────
  /* The header and footer are the site's own, so they link to pages the gate
     may be covering. While the window is open those links give up their href
     (kept aside, and given back when the window ends) instead of offering a
     round trip to this page. "=/ar/" means exactly that page, "/articles/"
     everything under it. The build writes nothing here while the gate is off. */
  var covered = (box.getAttribute("data-covered") || "").split(/\s+/).filter(Boolean);
  var withheld = [];
  if (covered.length) {
    Array.prototype.forEach.call(document.querySelectorAll("a[href]"), function (a) {
      if (a.closest(".mt-actions")) return; /* the two actions have their own rules */
      var p;
      try {
        var u = new URL(a.getAttribute("href"), location.href);
        if (u.origin !== location.origin) return;
        p = u.pathname;
      } catch (e) {
        return;
      }
      for (var i = 0; i < covered.length; i++) {
        var c = covered[i];
        if (c.charAt(0) === "=" ? p === c.slice(1) : p.indexOf(c) === 0) {
          withheld.push(a);
          return;
        }
      }
    });
  }

  function withhold(on) {
    withheld.forEach(function (a) {
      if (on && !a.hasAttribute("data-mt-off")) {
        a.setAttribute("data-mt-off", a.getAttribute("href"));
        a.removeAttribute("href");
        a.setAttribute("aria-disabled", "true");
      } else if (!on && a.hasAttribute("data-mt-off")) {
        a.setAttribute("href", a.getAttribute("data-mt-off"));
        a.removeAttribute("data-mt-off");
        a.removeAttribute("aria-disabled");
      }
    });
  }

  var timer = 0;
  var seen = false; // has this visitor watched it count?
  var finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    show("d", 0); show("h", 0); show("m", 0); show("s", 0);
    box.classList.add("is-done");
    withhold(false);
    if (doneLine) doneLine.hidden = false;
    /* the gate has stopped by now, so home is a real destination again */
    if (home) {
      home.hidden = false;
      home.classList.remove("primary");
    }
    if (retry) retry.classList.add("primary");
    if (seen && live && doneLine) live.textContent = doneLine.textContent;
  }

  function tick() {
    window.clearTimeout(timer);
    if (finished) return;
    var now = Date.now();
    if (!isFinite(end) || now < FLOOR || end - now > HORIZON) {
      box.classList.add("is-unknown");
      return;
    }
    box.classList.remove("is-unknown");
    var left = end - now;
    if (left <= 0) {
      finish();
      return;
    }
    /* While the gate is actually sending the home page back here, "Return
       home" would be a loop with a friendly label: it is hidden and Try again
       leads. Same clock and same window as the gate itself, so the two can
       never disagree. With scripting off neither runs, and home is honest. */
    var open = isFinite(start) && now >= start;
    withhold(open);
    var gated = homeGated && open;
    if (home && home.hidden !== gated) {
      home.hidden = gated;
      home.classList.toggle("primary", !gated);
      if (retry) retry.classList.toggle("primary", gated);
    }
    var total = Math.ceil(left / 1000); // round UP: zero means done
    show("d", Math.floor(total / 86400));
    show("h", Math.floor(total / 3600) % 24);
    show("m", Math.floor(total / 60) % 60);
    show("s", total % 60);
    box.classList.add("is-running");
    seen = true;
    /* wake when the figure next changes, not on a fixed interval */
    timer = window.setTimeout(tick, (left % 1000 || 1000) + 15);
  }

  tick();

  /* a background tab's timers are throttled; catch up the moment it is seen */
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) tick();
  });
  window.addEventListener("pageshow", tick);
})();
