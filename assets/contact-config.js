/* ZULFAA - where the contact form sends its message.

   THE SITE IS STATIC. GitHub Pages serves files and runs nothing, so a form
   cannot deliver mail by itself: something has to accept the POST. Until that
   exists `endpoint` stays empty ON PURPOSE, and the form works in MAIL mode:
   its button opens the visitor's own email app with the message filled in, and
   it never claims that anything was sent.

   EVERYTHING HERE IS PUBLIC the moment it is deployed. An endpoint URL is fine;
   a key, token or password never is.

   Setting `endpoint` alone does NOT switch the form to sending. assets/contact.js
   also requires the page's storage disclosure (data-privacy-endpoint, written
   by tools/lower.py), because a real endpoint stores messages and the page must
   say so first. The endpoint must answer the contract in
   Docs/website/CONTACT_FORM_BACKEND_PLAN_2026-09-16.md:

     POST JSON {submission_id, lang, name, email, message}
     202  {"status": "received", "id": "..."}   the message is durably stored
     400  {"status": "invalid", "fields": {...}} field codes
     429  rate limited                            anything else = failure

   The recipient address is not repeated here: the page carries it
   (data-recipient, from chrome.MAIL). `recipient` may still override it. */
/* The endpoint is chosen by the page's own host: only the live site
   (zulfaa.nl) posts to the production contact service. Any other host - the
   local preview on 127.0.0.1:8081 included - gets "" and stays in email-app
   mode, and the service itself refuses every origin but https://zulfaa.nl.
   Public collection is switched on separately, in the Admin, after the site
   is published (Docs/website/CONTACT_AND_ADMIN_INBOX_SETUP.md). */
window.ZULFAA_CONTACT = {
  endpoint: ({
    "zulfaa.nl": "https://zulfaa-contact.moner-intelligence.workers.dev/v1/contact",
  })[location.hostname] || "",
}
