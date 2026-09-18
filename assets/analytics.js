/* ZULFAA analytics - the production collector script.

   This is the ONLY analytics code a visitor's browser runs. It is small, it
   blocks nothing, and if the collector is unreachable the page carries on
   exactly as if this file did not exist.

   IT DOES NOTHING unless assets/analytics-config.js says `enabled: true` AND
   gives an endpoint for this host. With either missing it returns before
   registering a single listener.

   WHAT IT SENDS, in batches (never one request per movement):
     page_view   path, title, referrer ORIGIN only, UTM values, screen class,
                 page language
     heartbeat   every 90 s while the tab is visible ("still here")
     scroll      the quarter milestones 25 / 50 / 75 / 100 - one event each,
                 computed on a throttled scroll listener, never a trail
     leave       on pagehide: seconds the page was visible, deepest milestone
     outbound    a click on a link to another site: its host only
     interaction a NAMED action from a closed list (contact form submitted,
                 store link, theme or language switch, menu, carousel,
                 quick access, updates) with at most one short label
     error       window error / unhandled rejection: class + clipped message
     failed_request  a same-site resource that failed to load: its path
     perf        ttfb, fcp, lcp, cls (x1000), dcl, load - once, rounded

   WHAT IT DOES NOT DO:
     no cookie, no localStorage, no sessionStorage, no identifier of any kind
     no canvas / audio / WebGL / font / hardware fingerprinting
     no geolocation API, no precise location, ever
     no pointer trails, no keystrokes, no form contents, no message text
     no query strings (a path is cut at "?"), no full referrer URLs
     no third-party requests: it talks to the ZULFAA collector only

   FLUSHING: 8 s after the first queued event, then every 30 s while events
   wait, immediately at 10 queued events, before a client-side navigation,
   and on pagehide / visibility hidden with sendBeacon. Batches carry an id,
   so a retried batch is stored once. If the collector answers "disabled",
   "protected" or "dnt" the script stops for this page; "reduced" stops the
   detail events (scroll, perf, heartbeat) for this page. */
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
  var HEARTBEAT_MS = 90000
  var FLUSH_FIRST_MS = 8000
  var FLUSH_EVERY_MS = 30000
  var FLUSH_AT = 10
  var MAX_QUEUE = 20

  var queue = []
  var stopped = false
  var detail = true
  var flushTimer = null
  var pageStart = Date.now()
  var visibleSince = document.visibilityState === 'visible' ? Date.now() : null
  var engaged = 0
  var maxDepth = 0
  var sentMilestones = {}
  var perfSent = {}
  /* a page with many broken images or a looping error is reported, not narrated */
  var errorBudget = { error: 5, failed_request: 3 }

  function uuid() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID()
    } catch (e) { /* older browser */ }
    var s = ''
    for (var i = 0; i < 36; i++) s += i === 8 || i === 13 || i === 18 || i === 23 ? '-' : i === 14 ? '4' : i === 19 ? '89ab'[Math.floor(Math.random() * 4)] : Math.floor(Math.random() * 16).toString(16)
    return s
  }
  function path() {
    return location.pathname
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
    if (!detail && (type === 'scroll' || type === 'perf' || type === 'heartbeat')) return
    if (type in errorBudget) {
      if (errorBudget[type] <= 0) return
      errorBudget[type] -= 1
    }
    var event = { type: type, path: path(), dt: Date.now() }
    if (extra) for (var key in extra) if (Object.prototype.hasOwnProperty.call(extra, key)) event[key] = extra[key]
    queue.push(event)
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE)
    if (queue.length >= FLUSH_AT) flush(false)
    else if (!flushTimer) flushTimer = setTimeout(function () { flush(false) }, queue.length === 1 ? FLUSH_FIRST_MS : FLUSH_EVERY_MS)
  }

  function handleAnswer(header) {
    if (header === 'disabled' || header === 'protected' || header === 'dnt' || header === 'excluded') stopped = true
    else if (header === 'reduced' || header === 'sampled') detail = false
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

  /* ── the page view ─────────────────────────────────────────────────────── */
  push('page_view', { title: (document.title || '').slice(0, 200), referrer: referrer(), screen: screenClass, lang: (document.documentElement.lang || '').slice(0, 8), campaign: campaign() })

  /* ── heartbeat while visible ───────────────────────────────────────────── */
  var beat = setInterval(function () {
    if (document.visibilityState === 'visible') push('heartbeat')
  }, HEARTBEAT_MS)

  /* ── scroll milestones, throttled, one event per milestone ─────────────── */
  var ticking = false
  function measureScroll() {
    ticking = false
    var doc = document.documentElement
    var total = Math.max(1, (doc.scrollHeight || 0) - (window.innerHeight || 0))
    var pct = Math.min(100, Math.round(((window.scrollY || doc.scrollTop || 0) / total) * 100))
    if (pct > maxDepth) maxDepth = pct
    ;[25, 50, 75, 100].forEach(function (m) {
      if (pct >= m && !sentMilestones[m]) {
        sentMilestones[m] = true
        push('scroll', { value: m })
      }
    })
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(measureScroll) }
  }, { passive: true })

  /* ── visibility and leaving ────────────────────────────────────────────── */
  function settleVisible() {
    if (visibleSince !== null) { engaged += Date.now() - visibleSince; visibleSince = null }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      settleVisible()
      push('leave', { value: Math.round(engaged / 1000), depth: maxDepth })
      flush(true)
    } else if (visibleSince === null) visibleSince = Date.now()
  })
  window.addEventListener('pagehide', function () {
    clearInterval(beat)
    if (document.visibilityState !== 'hidden') {
      settleVisible()
      push('leave', { value: Math.round(engaged / 1000), depth: maxDepth })
    }
    flush(true)
  })

  /* ── outbound links and named interactions ─────────────────────────────── */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null
    if (!a) return
    var href = a.getAttribute('href') || ''
    if (/^mailto:|^tel:/i.test(href)) return // never the address
    try {
      var url = new URL(a.href, location.href)
      if (/^https?:$/.test(url.protocol) && url.host !== location.host) {
        if (/play\.google\.com|apps\.apple\.com/.test(url.host)) push('interaction', { name: 'store_click' })
        else push('outbound', { name: url.protocol + '//' + url.host })
      }
    } catch (err) { /* not a URL */ }
    /* the language menu's links carry hreflang AND lang (tools/chrome.py langswitch); <link rel=alternate> is not an anchor */
    if (a.hasAttribute('hreflang') && a.hasAttribute('lang')) push('interaction', { name: 'lang_switch', label: String(a.getAttribute('hreflang') || '').slice(0, 8) })
    if (/\.(apk|pdf|zip)$/i.test(url && url.pathname || '')) push('interaction', { name: 'download_click' })
  }, true)

  document.addEventListener('submit', function (e) {
    var form = e.target
    if (form && form.id === 'contact-form') push('interaction', { name: 'contact_submit' })
  }, true)

  /* the site announces its own outcomes with CustomEvents; only the name is read */
  document.addEventListener('zulfaa:analytics', function (e) {
    var d = e && e.detail
    if (d && typeof d.name === 'string') push('interaction', { name: d.name, label: typeof d.label === 'string' ? d.label.slice(0, 24) : undefined })
  })

  /* theme switch: the <html data-site-theme> attribute changes */
  try {
    var themeObserver = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].attributeName === 'data-site-theme') {
          push('interaction', { name: 'theme_switch', label: document.documentElement.getAttribute('data-site-theme') || 'system' })
          return
        }
      }
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-site-theme'] })
  } catch (e) { /* no observer: no theme event */ }

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

  /* ── performance marks, once each, rounded ─────────────────────────────── */
  function perf(name, value) {
    if (perfSent[name] || !(value >= 0)) return
    perfSent[name] = true
    push('perf', { name: name, value: Math.round(value) })
  }
  try {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0]
    var onLoad = function () {
      setTimeout(function () {
        var n = nav || (performance.getEntriesByType && performance.getEntriesByType('navigation')[0])
        if (n) {
          perf('ttfb', n.responseStart)
          perf('dcl', n.domContentLoadedEventEnd)
          perf('load', n.loadEventEnd)
        }
        var paints = performance.getEntriesByType ? performance.getEntriesByType('paint') : []
        for (var i = 0; i < paints.length; i++) if (paints[i].name === 'first-contentful-paint') perf('fcp', paints[i].startTime)
      }, 0)
    }
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad)
    if (window.PerformanceObserver) {
      var lcp = 0
      new PerformanceObserver(function (list) {
        var entries = list.getEntries()
        if (entries.length) lcp = entries[entries.length - 1].startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })
      var cls = 0
      new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) { if (!entry.hadRecentInput) cls += entry.value })
      }).observe({ type: 'layout-shift', buffered: true })
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
          if (lcp) perf('lcp', lcp)
          perf('cls', cls * 1000)
        }
      })
    }
  } catch (e) { /* no performance API: no perf events */ }

  /* ── client-side route changes (guarded so the first render never counts twice) ── */
  var lastPath = location.pathname
  function routeChanged() {
    if (location.pathname === lastPath) return
    flush(false)
    lastPath = location.pathname
    sentMilestones = {}
    maxDepth = 0
    push('page_view', { title: (document.title || '').slice(0, 200), referrer: 'internal', screen: screenClass, lang: (document.documentElement.lang || '').slice(0, 8), campaign: campaign() })
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
