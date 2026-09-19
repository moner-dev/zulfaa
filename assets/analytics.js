/* ZULFAA analytics - the production collector script.

   This is the ONLY analytics code a visitor's browser runs. It is small, it
   blocks nothing, and if the collector is unreachable the page carries on
   exactly as if this file did not exist.

   IT DOES NOTHING unless assets/analytics-config.js says `enabled: true` AND
   gives an endpoint for this host. With either missing it returns before
   registering a single listener.

   WHAT IT SENDS, in batches (normally two requests per page):
     page_view      once per page opening: path, title, referrer ORIGIN only,
                    UTM values, screen class, page language, and a random id
                    for this page opening (made here, kept in memory only)
     page_summary   for that page opening: the seconds the page was visible
                    and in use SINCE THE PREVIOUS SUMMARY, and the deepest
                    scroll so far as ONE number. Sent when the page is hidden
                    or closed, and - only while the page is visible AND being
                    used - at most every five minutes
     perf           once per page load: ttfb, fcp, lcp (as known), load. The
                    collector keeps a sample of these, as daily aggregates
     interaction    a NAMED action from a closed list: contact message
                    received / failed (read from the form's own state class),
                    store link, file download, language change
     outbound       a click on a link to another site: its host only
     error          window error / unhandled rejection: class + clipped message
     failed_request a same-site resource that failed to load: its path

   WHAT IT NO LONGER SENDS: an event per scroll milestone, an event per
   performance mark, a heartbeat, a second "leave" for the same departure,
   theme changes, menu / carousel / quick-access clicks, form submissions.

   WHAT IT DOES NOT DO:
     no cookie, no localStorage, no sessionStorage, no identifier of any kind
     on the device; the page id above dies with the page
     no canvas / audio / WebGL / font / hardware fingerprinting
     no geolocation API, no precise location, ever
     no pointer trails, no keystrokes, no form contents, no message text, no
     element text, no CSS selectors, no clipboard
     no query strings (a path is cut at "?"), no full URLs of other sites
     no third-party requests: it talks to the ZULFAA collector only

   ACTIVITY is one boolean: "something happened since the last check"
   (a scroll, a click, a key, a touch - never which one, where or what).
   A page left open and untouched stops counting as engaged after five
   minutes and sends nothing at all until it is used again.

   FLUSHING: 8 s after the first queued event, then every 30 s while events
   wait, immediately at 10 queued events, before a client-side navigation,
   and on pagehide / visibility hidden with sendBeacon. Batches carry an id,
   so a retried batch is stored once; summaries carry a sequence number, so a
   repeated summary changes nothing. If the collector answers "disabled",
   "protected", "stopped", "dnt" or "excluded" the script stops for this
   page; "reduced" / "sampled" stop the optional detail (performance and the
   periodic summaries) for this page. */
;(function () {
  'use strict'

  var cfg = window.ZULFAA_ANALYTICS
  /* https only - except a loopback address, which the isolated test harness uses */
  if (!cfg || cfg.enabled !== true || typeof cfg.endpoint !== 'string' || !/^(https:\/\/|http:\/\/127\.0\.0\.1[:/])/.test(cfg.endpoint)) return

  /* one run per document, however often the tag appears: the 404 page carries the footer three
     times (one per language), and a deferred script runs once for every tag that names it */
  if (window.__zulfaaAnalyticsStarted) return
  window.__zulfaaAnalyticsStarted = true

  /* a browser that asks not to be tracked is not measured (the server checks too) */
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1') return
  /* never a private or preview path */
  if (/^\/(con|admin|api|__devlab|__analytics|p|preview)(\/|$)/.test(location.pathname)) return

  var endpoint = cfg.endpoint
  /* the test harness may shorten the liveness interval; production never sets it */
  var LIVENESS_MS = typeof cfg.livenessMs === 'number' && /^http:\/\/127\.0\.0\.1[:/]/.test(endpoint) ? cfg.livenessMs : 300000
  var FLUSH_FIRST_MS = 8000
  var FLUSH_EVERY_MS = 30000
  var FLUSH_AT = 10
  var MAX_QUEUE = 20
  var MAX_SUMMARIES = 100

  var queue = []
  var stopped = false
  var detail = true
  var flushTimer = null
  /* a page with many broken images or a looping error is reported, not narrated */
  var errorBudget = { error: 5, failed_request: 3 }

  /* the page opening: everything below is reset by a client-side route change */
  var pv = ''
  var pagePath = ''
  var engaged = 0 //          ms the page has been visible and in use
  var reported = 0 //         ms already sent in earlier summaries
  var visibleSince = null
  var paused = false //       visible, but untouched for a whole liveness interval
  var activeSinceCheck = false
  var seq = 0
  var maxDepth = 0
  var leaveSent = false //    one summary per hidden / departure period
  var perfSent = false

  function randomId() {
    try {
      var bytes = new Uint8Array(8)
      crypto.getRandomValues(bytes)
      var s = ''
      for (var i = 0; i < bytes.length; i++) s += (bytes[i] + 256).toString(16).slice(1)
      return s
    } catch (e) {
      var t = ''
      while (t.length < 16) t += Math.floor(Math.random() * 16).toString(16)
      return t
    }
  }
  function uuid() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID()
    } catch (e) { /* older browser */ }
    var s = ''
    for (var i = 0; i < 36; i++) s += i === 8 || i === 13 || i === 18 || i === 23 ? '-' : i === 14 ? '4' : i === 19 ? '89ab'[Math.floor(Math.random() * 4)] : Math.floor(Math.random() * 16).toString(16)
    return s
  }
  function referrer() {
    try {
      if (!document.referrer) return ''
      var url = new URL(document.referrer)
      if (url.host === location.host) return 'internal'
      return url.protocol + '//' + url.host
    } catch (e) {
      return ''
    }
  }
  function campaign() {
    var out = {}
    try {
      var params = new URLSearchParams(location.search)
      ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
        var value = params.get(key)
        if (value) out[key.slice(4)] = String(value).slice(0, 120)
      })
    } catch (e) { /* not worth a broken page */ }
    return out
  }
  var screenClass = (function () {
    var w = window.innerWidth || 0
    return w < 640 ? 'small' : w < 1024 ? 'medium' : 'large'
  })()

  function push(type, extra) {
    if (stopped) return
    if (!detail && type === 'perf') return
    if (type in errorBudget) {
      if (errorBudget[type] <= 0) return
      errorBudget[type] -= 1
    }
    var event = { type: type, path: pagePath || location.pathname, pv: pv, dt: Date.now() }
    if (extra) for (var key in extra) if (Object.prototype.hasOwnProperty.call(extra, key)) event[key] = extra[key]
    queue.push(event)
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE)
    if (queue.length >= FLUSH_AT) flush(false)
    else if (!flushTimer) flushTimer = setTimeout(function () { flush(false) }, queue.length === 1 ? FLUSH_FIRST_MS : FLUSH_EVERY_MS)
  }

  function handleAnswer(header) {
    if (header === 'disabled' || header === 'protected' || header === 'stopped' || header === 'dnt' || header === 'excluded') {
      stopped = true
      queue.length = 0
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
    } else if (header === 'reduced' || header === 'sampled') detail = false
  }

  function flush(unloading) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
    if (!queue.length || stopped) return
    var now = Date.now()
    var events = queue.splice(0, MAX_QUEUE).map(function (e) {
      e.dt = now - e.dt // milliseconds before this batch was sent
      return e
    })
    var payload = JSON.stringify({ v: 1, id: uuid(), events: events })
    try {
      /* text/plain keeps the request "simple": no preflight, one request per
         batch. sendBeacon survives a page being closed; fetch keepalive is
         the fallback and its answer is read for the mode header. */
      if (unloading && navigator.sendBeacon) {
        if (navigator.sendBeacon(endpoint, new Blob([payload], { type: 'text/plain' }))) return
      }
      fetch(endpoint, { method: 'POST', body: payload, headers: { 'Content-Type': 'text/plain' }, keepalive: true, credentials: 'omit', mode: 'cors' })
        .then(function (res) { handleAnswer(res.headers.get('x-zulfaa-analytics')) })
        .catch(function () { /* the collector is unreachable: the page does not care */ })
    } catch (e) { /* analytics must never break the site */ }
  }

  /* ── the page opening ──────────────────────────────────────────────────── */
  function openPage(fromRoute) {
    pv = randomId()
    pagePath = location.pathname
    engaged = 0
    reported = 0
    seq = 0
    maxDepth = 0
    leaveSent = false
    paused = false
    activeSinceCheck = false
    visibleSince = document.visibilityState === 'visible' ? Date.now() : null
    push('page_view', { title: (document.title || '').slice(0, 200), referrer: fromRoute ? 'internal' : referrer(), screen: screenClass, lang: (document.documentElement.lang || '').slice(0, 8), campaign: campaign() })
  }

  /* ── engaged time: visible AND in use ──────────────────────────────────── */
  function settle() {
    if (visibleSince !== null) { engaged += Date.now() - visibleSince; visibleSince = null }
  }
  function resume() {
    if (visibleSince === null && document.visibilityState === 'visible') visibleSince = Date.now()
    paused = false
  }
  /* THE ONE PLACE a summary is made. `engaged` is a DELTA: what has not been reported yet. */
  function summary(kind) {
    var wasCounting = visibleSince !== null
    settle()
    if (kind === 'beat' && wasCounting) visibleSince = Date.now()
    var delta = Math.max(0, Math.round((engaged - reported) / 1000))
    if (kind === 'beat' && delta <= 0) return
    if (seq >= MAX_SUMMARIES) return
    reported += delta * 1000
    seq += 1
    push('page_summary', { seq: seq, engaged: delta, depth: maxDepth, end: kind === 'end', beat: kind === 'beat' })
  }
  /* hidden, closed or navigated away: ONE summary per departure, whichever event comes first */
  function leave(kind) {
    if (leaveSent) { flush(true); return }
    leaveSent = true
    summary(kind)
    flush(true)
  }
  function back() {
    leaveSent = false
    resume()
  }

  function activity() {
    activeSinceCheck = true
    if (paused) resume()
  }
  ;['scroll', 'click', 'keydown', 'touchstart', 'pointerdown'].forEach(function (name) {
    window.addEventListener(name, activity, { passive: true, capture: true })
  })

  /* liveness: only a visible page that was used since the last check says anything */
  var beat = setInterval(function () {
    if (stopped || document.visibilityState !== 'visible') return
    if (!activeSinceCheck) {
      /* untouched for a whole interval: stop counting it as engaged and stay silent */
      settle()
      paused = true
      return
    }
    activeSinceCheck = false
    if (detail) summary('beat')
  }, LIVENESS_MS)

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') leave('hide')
    else back()
  })
  window.addEventListener('pagehide', function () {
    clearInterval(beat)
    leave('end')
  })
  /* restored from the back/forward cache: the same page opening continues */
  window.addEventListener('pageshow', function (e) {
    if (e && e.persisted) back()
  })

  /* ── deepest scroll: one number, measured on a throttled listener ──────── */
  var ticking = false
  function measureScroll() {
    ticking = false
    var doc = document.documentElement
    var total = Math.max(1, (doc.scrollHeight || 0) - (window.innerHeight || 0))
    var pct = Math.min(100, Math.round(((window.scrollY || doc.scrollTop || 0) / total) * 100))
    if (pct > maxDepth) maxDepth = pct
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(measureScroll) }
  }, { passive: true })

  openPage(false)

  /* ── the closed list of named actions ──────────────────────────────────── */
  var ACTIONS = { contact_sent: 1, contact_failed: 1, store_click: 1, download_click: 1, lang_switch: 1 }
  function action(name, label) {
    if (!ACTIONS[name]) return
    push('interaction', label ? { name: name, label: String(label).slice(0, 24) } : { name: name })
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null
    if (!a) return
    var href = a.getAttribute('href') || ''
    if (/^mailto:|^tel:/i.test(href)) return // never the address
    var url = null
    try {
      url = new URL(a.href, location.href)
    } catch (err) { return /* not a URL */ }
    if (/^https?:$/.test(url.protocol) && url.host !== location.host) {
      if (/play\.google\.com|apps\.apple\.com/.test(url.host)) action('store_click')
      else push('outbound', { name: url.protocol + '//' + url.host })
      return
    }
    /* the language menu's links carry hreflang AND lang (tools/chrome.py langswitch); <link rel=alternate> is not an anchor */
    if (a.hasAttribute('hreflang') && a.hasAttribute('lang')) action('lang_switch', String(a.getAttribute('hreflang') || '').slice(0, 8))
    if (/\.(apk|pdf|zip)$/i.test(url.pathname || '')) action('download_click')
  }, true)

  /* the contact form announces its own outcome with a state class (assets/contact.js: "cf-state is-ok" /
     "is-fail"). Only that class name is read - never a field, never the message, never the state text. */
  try {
    var state = document.querySelector('#contact-form .cf-state')
    if (state && window.MutationObserver) {
      var lastState = ''
      new MutationObserver(function () {
        var now = /\bis-ok\b/.test(state.className) ? 'ok' : /\bis-fail\b/.test(state.className) ? 'fail' : ''
        if (now === lastState) return
        lastState = now
        if (now === 'ok') action('contact_sent')
        else if (now === 'fail') action('contact_failed')
      }).observe(state, { attributes: true, attributeFilter: ['class'] })
    }
  } catch (e) { /* no observer: no contact action */ }

  /* the site may announce an allowlisted action itself; only the name and one short label are read */
  document.addEventListener('zulfaa:analytics', function (e) {
    var d = e && e.detail
    if (d && typeof d.name === 'string') action(d.name, typeof d.label === 'string' && /^[\w-]{1,24}$/.test(d.label) ? d.label : '')
  })

  /* ── errors and failed resources (class + clipped message, never a stack) ── */
  window.addEventListener('error', function (e) {
    if (e && e.target && e.target !== window && (e.target.tagName === 'IMG' || e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK')) {
      try {
        var src = new URL(e.target.src || e.target.href || '', location.href)
        if (src.host === location.host) push('failed_request', { name: src.pathname })
      } catch (err) { /* not a URL */ }
      return
    }
    var error = e && e.error
    push('error', { name: (error && error.name) || 'Error', message: String((e && e.message) || '').slice(0, 160) })
  }, true)
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason
    push('error', { name: (r && r.name) || 'UnhandledRejection', message: String((r && r.message) || r || '').slice(0, 160) })
  })

  /* ── performance: ONE event per page load, shortly after load ──────────── */
  try {
    var lcp = 0
    if (window.PerformanceObserver) {
      try {
        new PerformanceObserver(function (list) {
          var entries = list.getEntries()
          if (entries.length) lcp = entries[entries.length - 1].startTime
        }).observe({ type: 'largest-contentful-paint', buffered: true })
      } catch (err) { /* this browser has no LCP entries */ }
    }
    var reportPerf = function () {
      if (perfSent) return
      perfSent = true
      var m = {}
      var n = performance.getEntriesByType && performance.getEntriesByType('navigation')[0]
      if (n) {
        if (n.responseStart >= 0) m.ttfb = Math.round(n.responseStart)
        if (n.loadEventEnd > 0) m.load = Math.round(n.loadEventEnd)
      }
      var paints = performance.getEntriesByType ? performance.getEntriesByType('paint') : []
      for (var i = 0; i < paints.length; i++) if (paints[i].name === 'first-contentful-paint') m.fcp = Math.round(paints[i].startTime)
      if (lcp > 0) m.lcp = Math.round(lcp)
      for (var key in m) { push('perf', { m: m }); break }
    }
    var afterLoad = function () { setTimeout(reportPerf, 2000) }
    if (document.readyState === 'complete') afterLoad()
    else window.addEventListener('load', afterLoad)
  } catch (e) { /* no performance API: no perf event */ }

  /* ── client-side route changes (guarded so the first render never counts twice) ── */
  function routeChanged() {
    if (location.pathname === pagePath) return
    summary('end')
    flush(false)
    openPage(true)
  }
  window.addEventListener('popstate', routeChanged)
  var pushState = history.pushState
  if (typeof pushState === 'function') {
    history.pushState = function () {
      pushState.apply(this, arguments)
      setTimeout(routeChanged, 0)
    }
  }
})()
