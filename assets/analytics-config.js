/* ZULFAA - where the website's analytics batches go, and whether they go at all.

   THIS FILE IS PUBLIC. An endpoint URL is fine here; a key, token or password
   never is - and none is needed from the browser.

   TWO GATES:
     enabled   false  -> assets/analytics.js returns at once: no request, no
                         timer, no listener.
     endpoint  ""     -> chosen by the page's own host: only zulfaa.nl has
                         one; every other host gets "" and stays silent.

   Nothing else is configurable from here. What is measured is fixed by
   assets/analytics.js: no cookie, no device storage, no form contents. */
window.ZULFAA_ANALYTICS = {
  enabled: false,
  endpoint: ({
    "zulfaa.nl": "https://zulfaa-analytics.moner-intelligence.workers.dev/v1/collect",
  })[location.hostname] || "",
}
