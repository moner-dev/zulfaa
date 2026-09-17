/* ZULFAA - the contact form.

   SAFE BY DEFAULT. The page ships a fallback (a sentence and a mailto link)
   and the form `hidden` (tools/lower.py). This file swaps them ONLY as the
   last step of a set-up that completed: the submit handler is attached first.
   So scripting off, this file failing to load, or anything throwing during
   set-up all leave the visitor with a working way to write - never with a form
   that could put their name, email and message into the address bar.

   THE SUBMIT BUTTON NEVER OPENS AN EMAIL APPLICATION. Not on the live site,
   not in a preview, not after an error. Email is only ever a separate link,
   "Write an email", that the visitor clicks deliberately.

   TWO MODES.
     endpoint     an endpoint (assets/contact-config.js, zulfaa.nl only) AND the
                  page's storage disclosure (data-privacy-endpoint) are both
                  present. The message is posted to the contact service.
                  "Received" is shown only for the contract's durable-acceptance
                  answer:  202 {"status": "received", "id": "<non-empty string>"}
                  Anything else - another 2xx included - is not a confirmation.
                  409 and 503 are failures; 503 {"status":"disabled"} says the
                  form is not accepting messages. The text always stays.
     unavailable  no endpoint or no disclosure - the local preview on 8081, or a
                  page whose configuration did not load. Submitting explains that
                  nothing was sent (in a preview, that it is a preview), keeps the
                  text, and offers the "Write an email" link. Nothing is posted.

   VALIDATION HERE IS A CONVENIENCE. It saves a visitor a round trip. A future
   endpoint must check everything again, with its own limits, because anything
   a browser does can be skipped (plan, section 4.2). The limits below are read
   from the markup so the generator states them once.

   Every string comes from data-* attributes on the form, so this file carries
   no language of its own. */
(function () {
  "use strict";

  var started = false;

  /* Declared BEFORE start() can run. A `var` further down is hoisted but still
     undefined when the configuration is already loaded and start() runs at
     once - and setTimeout(abort, undefined) aborts every request immediately. */
  var TIMEOUT_MS = 15000;

  function start() {
    if (started) return;
    started = true;
    var form = document.getElementById("contact-form");
    var fallback = document.querySelector("[data-cf-fallback]");
    if (!form) return;
    try {
      setup(form);
    } catch (err) {
      // leave the page exactly as it shipped: fallback shown, form hidden
      form.hidden = true;
      if (fallback) fallback.hidden = false;
      return;
    }
    // the handler is attached: only now does the form replace the fallback
    form.hidden = false;
    if (fallback) fallback.hidden = true;
  }

  /* The configuration must exist before set-up reads it. Both scripts are
     `defer`, which runs them in document order before DOMContentLoaded; the
     generators put contact-config.js first. If this file ever runs first
     anyway, waiting for DOMContentLoaded lets the configuration arrive. */
  if (window.ZULFAA_CONTACT) start();
  else if (document.readyState === "complete") start();
  else document.addEventListener("DOMContentLoaded", start);

  function setup(form) {
    var cfg = window.ZULFAA_CONTACT || {};
    var say = function (key) { return form.getAttribute("data-" + key) || ""; };
    var num = function (key) { return parseInt(say(key), 10); };

    var lang = say("lang") || document.documentElement.lang || "en";
    var recipient = String(cfg.recipient || say("recipient")).trim();
    var endpoint = typeof cfg.endpoint === "string" ? cfg.endpoint.trim() : "";
    var disclosure = say("privacy-endpoint");
    // collection is never switched on without its disclosure on the page
    var mode = endpoint && disclosure ? "endpoint" : "unavailable";
    // only the live host is not a preview; any other host (8081 included) is one
    var preview = location.hostname !== "zulfaa.nl";
    var timeoutMs = cfg.timeoutMs > 0 ? cfg.timeoutMs : TIMEOUT_MS;

    var name = form.querySelector("#cf-name");
    var email = form.querySelector("#cf-email");
    var message = form.querySelector("#cf-message");
    var count = form.querySelector("#cf-message-count");
    var button = form.querySelector(".cf-send");
    var state = form.querySelector(".cf-state");
    var privacy = form.querySelector(".cf-privacy");
    if (!name || !email || !message || !button || !state || !recipient) {
      throw new Error("contact form incomplete");
    }

    var LIMIT = {
      name: num("max-name"),
      email: num("max-email"),
      messageMin: num("min-message"),
      messageMax: num("max-message"),
    };
    for (var k in LIMIT) if (!(LIMIT[k] > 0)) throw new Error("contact limit missing: " + k);

    var digits = lang === "ar" ? "arab" : "latn";
    var fmt;
    try { fmt = new Intl.NumberFormat(lang + "-u-nu-" + digits); } catch (e) { fmt = null; }
    var n = function (x) { return fmt ? fmt.format(x) : String(x); };

    // code points, not UTF-16 units: an emoji or a rare script counts once
    var length = function (s) { return Array.from(s).length; };

    button.textContent = say("send");

    /* A honeypot for scripts that fill every field. Created here rather than
       in the markup, so the page ships nothing a script-less reader could
       stumble into; clipped out of view (never display:none, which some bots
       skip), out of the tab order, hidden from assistive technology, and
       labelled for anyone who somehow reaches it. The server treats a
       non-empty value as a bot and stores nothing. */
    var trap = document.createElement("div");
    trap.setAttribute("aria-hidden", "true");
    trap.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0";
    var trapLabel = document.createElement("label");
    trapLabel.textContent = "Leave this field empty";
    var trapInput = document.createElement("input");
    trapInput.type = "text";
    trapInput.name = "website";
    trapInput.tabIndex = -1;
    trapInput.autocomplete = "off";
    trapLabel.appendChild(trapInput);
    trap.appendChild(trapLabel);
    form.appendChild(trap);

    // how long a person took: the server refuses the impossibly fast
    var startedAt = Date.now();
    form.addEventListener("focusin", function first() {
      startedAt = Date.now();
      form.removeEventListener("focusin", first);
    });
    if (mode === "endpoint" && privacy) {
      privacy.textContent = disclosure;
      /* The storage details, folded under the sentence: where the data is,
         the backup window, and how to ask for deletion. Built as text nodes,
         one paragraph per line of the attribute. */
      var moreTitle = say("privacy-more-title");
      var moreText = say("privacy-more");
      if (moreTitle && moreText) {
        var details = document.createElement("details");
        details.className = "cf-privacy-more";
        details.style.marginTop = "0.5rem";
        var summary = document.createElement("summary");
        summary.textContent = moreTitle;
        summary.style.cursor = "pointer";
        summary.style.textDecoration = "underline";
        summary.style.textUnderlineOffset = "0.2em";
        details.appendChild(summary);
        moreText.split("\n").forEach(function (line) {
          if (!line.trim()) return;
          var para = document.createElement("p");
          para.textContent = line;
          para.style.margin = "0.4rem 0 0";
          details.appendChild(para);
        });
        privacy.appendChild(details);
      }
    }

    // ── client-side validation (convenience; the server decides) ──────────
    var RULES = {
      name: function (v) {
        // any script, any punctuation, any order: only the length is checked
        return length(v) > LIMIT.name ? "err-name-long" : "";
      },
      email: function (v) {
        if (!v) return "err-email";
        if (length(v) > LIMIT.email) return "err-email-long";
        // deliberately forgiving: something, one @, something with a dot
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "err-email-format";
        return "";
      },
      message: function (v) {
        if (!v) return "err-message";
        if (length(v) < LIMIT.messageMin) return "err-message-short";
        if (length(v) > LIMIT.messageMax) return "err-message-long";
        return "";
      },
    };
    var FIELDS = { name: name, email: email, message: message };

    function fieldError(input, key) {
      var box = document.getElementById(input.id + "-err");
      var text = key ? say(key) : "";
      if (box) {
        box.textContent = text;
        box.hidden = !text;
      }
      if (text) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
      input.classList.toggle("is-bad", !!text);
    }

    function check(field, show) {
      var input = FIELDS[field];
      var key = RULES[field](input.value.trim());
      // while typing, only clear an error; never raise one mid-word
      if (key && !show && !input.classList.contains("is-bad")) return !key;
      fieldError(input, key);
      return !key;
    }

    function checkAll() {
      var first = null;
      ["name", "email", "message"].forEach(function (f) {
        if (!check(f, true) && !first) first = FIELDS[f];
      });
      return first;
    }

    ["name", "email", "message"].forEach(function (f) {
      FIELDS[f].addEventListener("blur", function () {
        // an empty optional field, or one never touched, is not an error yet
        if (FIELDS[f].value.trim() || FIELDS[f].classList.contains("is-bad")) check(f, true);
      });
      FIELDS[f].addEventListener("input", function () { check(f, false); });
    });

    /* The counter appears near the limit. It is not a live region: the error
       on submit is what a screen reader hears, not every keystroke. */
    function updateCount() {
      if (!count) return;
      var left = LIMIT.messageMax - length(message.value.trim());
      if (left > 500) {
        count.hidden = true;
        count.textContent = "";
        return;
      }
      count.hidden = false;
      count.classList.toggle("is-over", left < 0);
      count.textContent = say(left < 0 ? "count-over" : "count-left").replace("{n}", n(Math.abs(left)));
    }
    message.addEventListener("input", updateCount);

    // ── states ─────────────────────────────────────────────────────────────
    function show(kind, parts, focus) {
      state.hidden = false;
      state.className = "cf-state is-" + kind;
      state.textContent = "";
      parts.forEach(function (p) {
        if (typeof p === "string") state.appendChild(document.createTextNode(p));
        else state.appendChild(p);
      });
      if (focus) state.focus();
    }

    function clearState() {
      state.hidden = true;
      state.textContent = "";
      state.className = "cf-state";
    }

    function mailHref() {
      var body = message.value.trim();
      var who = name.value.trim();
      if (who) body = who + "\n\n" + body;
      if (email.value.trim()) body += "\n\n" + email.value.trim();
      return "mailto:" + recipient +
        "?subject=" + encodeURIComponent(say("subject")) +
        "&body=" + encodeURIComponent(body);
    }

    function link(href, text, ltr) {
      var a = document.createElement("a");
      a.className = "cf-mailto";
      a.href = href;
      a.textContent = text;
      if (ltr) a.setAttribute("dir", "ltr");
      return a;
    }

    function block(parts) {
      var s = document.createElement("span");
      s.className = "cf-state-line";
      parts.forEach(function (p) {
        s.appendChild(typeof p === "string" ? document.createTextNode(p) : p);
      });
      return s;
    }

    /* The one way to email: a plain link the visitor clicks. It is created,
       never followed by this script. */
    function writeEmailLink() {
      return link(mailHref(), say("write-email"), false);
    }

    // ── unavailable: nothing is sent, nothing is opened ─────────────────────
    function explainUnavailable() {
      show("preview", [say(preview ? "unavailable-preview" : "unavailable") + " ", writeEmailLink(), "."], true);
    }

    // ── endpoint mode: one request at a time, text kept until "received" ───
    var busy = false;
    var draft = null;
    var submissionId = null;

    function uuid() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      var b = new Uint8Array(16);
      crypto.getRandomValues(b);
      b[6] = (b[6] & 15) | 64;
      b[8] = (b[8] & 63) | 128;
      var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join("");
      return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
    }

    function setBusy(on) {
      busy = on;
      button.disabled = on;
      form.setAttribute("aria-busy", on ? "true" : "false");
      button.textContent = on ? say("sending") : say("send");
    }

    var CODES = {
      name: { too_long: "err-name-long" },
      email: { required: "err-email", format: "err-email-format", too_long: "err-email-long" },
      message: { required: "err-message", too_short: "err-message-short", too_long: "err-message-long" },
    };

    function send() {
      var body = {
        name: name.value.trim(),
        email: email.value.trim(),
        message: message.value.trim(),
      };
      // the same text retried keeps its id, so a lost answer cannot become a
      // second message; changed text is a new submission
      var key = body.name + "\u0000" + body.email + "\u0000" + body.message;
      if (key !== draft) {
        draft = key;
        submissionId = uuid();
      }
      body.submission_id = submissionId;
      body.lang = lang;
      body.website = trapInput.value;
      body.elapsed_ms = Date.now() - startedAt;

      setBusy(true);
      show("busy", [say("sending")], false);

      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs);

      fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        credentials: "omit",
        cache: "no-store",
        signal: ctrl ? ctrl.signal : undefined,
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var data = null;
            try { data = JSON.parse(text); } catch (e) { /* not JSON: not a confirmation */ }
            return { status: res.status, data: data };
          });
        })
        .then(function (r) {
          var d = r.data || {};
          if (r.status === 202 && d.status === "received" && typeof d.id === "string" && d.id) {
            form.reset();
            draft = null;
            submissionId = null;
            ["name", "email", "message"].forEach(function (f) { fieldError(FIELDS[f], ""); });
            updateCount();
            show("ok", [say("received")], true);
            return;
          }
          if (r.status === 400 && d.status === "invalid" && d.fields && typeof d.fields === "object") {
            var first = null;
            for (var f in CODES) {
              var errKey = CODES[f][d.fields[f]];
              if (errKey) {
                fieldError(FIELDS[f], errKey);
                if (!first) first = FIELDS[f];
              }
            }
            if (first) {
              clearState();
              first.focus();
              return;
            }
            show("fail", [say("invalid")], true);
            return;
          }
          if (r.status === 409) {
            // this id was already used for different text: the next attempt is a new submission
            draft = null;
            submissionId = null;
          }
          if (r.status === 503 && d.status === "disabled") {
            // collection is switched off: say so, keep the text, offer the email app
            show("fail", [say("disabled") + " ", writeEmailLink(), "."], true);
            return;
          }
          if (r.status === 429) {
            show("fail", [say("rate")], true);
            return;
          }
          throw new Error("unexpected answer " + r.status);
        })
        .catch(function () {
          // network, timeout, 5xx, or an answer that is not the contract's:
          // the visitor's text is untouched, and their own email app is offered
          show("fail", [say("fail") + " ", writeEmailLink(), "."], true);
        })
        .then(function () {
          clearTimeout(timer);
          setBusy(false);
        });
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (busy) return;
      var bad = checkAll();
      if (bad) {
        bad.focus();
        return;
      }
      if (mode === "endpoint") send();
      else explainUnavailable();
    });
  }
})();
