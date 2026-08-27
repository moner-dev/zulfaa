# -*- coding: utf-8 -*-
"""Page builders for the ar / nl subtrees. Chrome comes from build_i18n."""
import os, sys, json, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chrome import (S, LANGS, C, SHOTS, CAPS, ALT, MAIL, DEV, PAGES, SITE,
                        e, head, header, footer, toc, dochead, clauses, up, write, num)
from dd_strings import DD

NL = chr(10)


def build_privacy(lang):
    p, d = "privacy/", 2
    c, s, n = C[lang]["privacy"], S[lang], C[lang]["nav"]
    ids = [x["id"] for x in c["sections"]]
    titles = [x["title"] for x in c["sections"]]
    lm = [(MAIL, "mailto:" + MAIL, MAIL)]
    return (head(lang, p, d, "%s — ZULFAA" % n["privacy"], c["intro"][:180])
            + header(lang, p, d)
            + "    <main>\n      <div class=\"shell\">\n"
            + dochead(lang, n["privacy"], c["subtitle"], c["updatedLabel"] + ": " + c["updated"], d)
            + '\n        <p class="summary"><strong>%s.</strong> %s</p>\n\n' % (e(s["inShort"]), e(c["summary"]))
            + toc(lang, ids, titles)
            + '        <div class="doc-body">\n          <p class="intro">%s</p>\n\n' % e(c["intro"])
            + clauses(lang, c["sections"], lm)
            + "        </div>\n      </div>\n    </main>\n\n"
            + footer(lang, p, d))


def build_terms(lang):
    p, d = "terms/", 2
    c, s, n = C[lang]["terms"], S[lang], C[lang]["nav"]
    ids = [x["id"] for x in c["sections"]]
    titles = [x["title"] for x in c["sections"]]
    pp = {"ar": "سياسة الخصوصية", "nl": "privacybeleid"}[lang]
    lm = [(MAIL, "mailto:" + MAIL, MAIL), (pp, "../privacy/", pp)]
    return (head(lang, p, d, "%s — ZULFAA" % n["terms"], c["intro"][:180])
            + header(lang, p, d)
            + "    <main>\n      <div class=\"shell\">\n"
            + dochead(lang, n["terms"], c["subtitle"], c["updatedLabel"] + ": " + c["updated"], d)
            + '\n        <p class="summary"><strong>%s.</strong> %s</p>\n\n' % (e(s["inShort"]), e(c["summary"]))
            + toc(lang, ids, titles)
            + '        <div class="doc-body">\n          <p class="intro">%s</p>\n\n' % e(c["intro"])
            + clauses(lang, c["sections"], lm)
            + "        </div>\n      </div>\n    </main>\n\n"
            + footer(lang, p, d))


def build_support(lang):
    p, d = "support/", 2
    s, sup, n = S[lang], C[lang]["support"], C[lang]["nav"]
    faq = list(sup["faq"]) + [{"q": s["supDelQ"], "a": s["supDelA"]},
                              {"q": s["supPlayQ"], "a": s["supPlayA"]}]
    qa = "".join("            <h3>%s</h3>\n            <p>%s</p>\n\n" % (e(x["q"]), e(x["a"])) for x in faq)
    return (head(lang, p, d, s["supTitle"], s["supDesc"])
            + header(lang, p, d)
            + "    <main>\n      <div class=\"shell\">\n"
            + dochead(lang, s["supH1"], s["supSub"], "", d)
            + '\n        <div class="doc-body">\n'
            + '          <section id="contact">\n            <h2>%s</h2>\n            <p>%s</p>\n'
              % (e(sup["contactTitle"]), e(sup["contactBody"]))
            + '            <div class="contact-box">\n              <p class="addr"><a href="mailto:%s">%s</a></p>\n              <p>%s</p>\n            </div>\n'
              % (MAIL, MAIL, DEV)
            + '            <p style="margin-top: 1rem">%s</p>\n          </section>\n\n' % e(s["supWrite"])
            + '          <section id="faq">\n            <h2>%s</h2>\n\n%s          </section>\n\n' % (e(sup["faqTitle"]), qa)
            + '          <section id="legal">\n            <h2>%s</h2>\n            <p>\n'
              '              <a href="../privacy/">%s</a><br />\n'
              '              <a href="../terms/">%s</a><br />\n'
              '              <a href="../delete-data/">%s</a>\n            </p>\n          </section>\n'
              % (e(s["supLegal"]), e(n["privacy"]), e(n["terms"]), e(s["deleteNav"]))
            + "        </div>\n      </div>\n    </main>\n\n"
            + footer(lang, p, d))


def build_delete(lang):
    p, d = "delete-data/", 2
    s, t, ui, n = S[lang], DD[lang], C[lang]["deleteUi"], C[lang]["nav"]
    V = {"privacy": n["privacy"], "delTitle": ui["delAccTitle"], "delAction": ui["delAccAction"],
         "delConfirm": ui["delAccConfirm"], "delDone": ui["delAccDone"].rstrip("."),
         "clearTitle": ui["privClearTitle"], "clearAction": ui["privClearAction"],
         "clearConfirm": ui["privClearConfirm"]}
    steps = lambda L: "".join("              <li>%s</li>\n" % (x % V) for x in L)
    items = lambda L: "".join("              <li>%s</li>\n" % x for x in L)
    body = []
    body.append('          <section id="who">\n            <h2>%s. %s</h2>\n' % (num(1, lang), e(t["s1h"])))
    body.append('            <p>\n              <strong>%s</strong> ZULFAA (<code>com.zulfaa.app</code>)<br />\n'
                '              <strong>%s</strong> %s<br />\n'
                '              <strong>%s</strong> <a href="mailto:%s">%s</a>\n            </p>\n'
                % (e(t["s1_app"]), e(t["s1_dev"]), DEV, e(t["s1_contact"]), MAIL, MAIL))
    body.append('            <p>%s <a href="../privacy/">%s</a>.</p>\n          </section>\n\n'
                % (e(t["s1_note"]), e(t["s1_pp"])))

    body.append('          <section id="in-app">\n            <h2>%s. %s</h2>\n            <p>%s</p>\n'
                % (num(2, lang), e(t["s2h"]), e(t["s2_intro"])))
    for h, L in ((t["s2_openH"], t["s2_open"]), (t["s2_srvH"], t["s2_srv"]), (t["s2_locH"], t["s2_loc"])):
        body.append('            <h3>%s</h3>\n            <ol class="steps">\n%s            </ol>\n' % (e(h), steps(L)))
    body.append('            <p>%s</p>\n' % e(t["s2_why"]))
    body.append('            <div class="contact-box">\n              <p><strong>%s</strong> %s</p>\n'
                '              <p>%s</p>\n            </div>\n          </section>\n\n'
                % (e(t["s2_orderT"]), t["s2_orderB"], e(t["s2_orderN"])))

    body.append('          <section id="email">\n            <h2>%s. %s</h2>\n            <p>%s</p>\n'
                % (num(3, lang), e(t["s3h"]), e(t["s3_intro"])))
    body.append('            <div class="contact-box">\n'
                '              <p class="addr"><a href="mailto:%s?subject=ZULFAA%%20data%%20deletion%%20request">%s</a></p>\n'
                '              <p>%s</p>\n            </div>\n' % (MAIL, MAIL, DEV))
    body.append('            <p style="margin-top: 1rem">%s</p>\n            <ul>\n%s            </ul>\n'
                % (e(t["s3_incl"]), items(t["s3_li"])))
    body.append('            <p>%s</p>\n            <p>%s</p>\n            <p>%s</p>\n          </section>\n\n'
                % (t["s3_only"], t["s3_limit"], e(t["s3_act"])))

    body.append('          <section id="deleted">\n            <h2>%s. %s</h2>\n            <p>%s</p>\n            <ul>\n%s            </ul>\n            <p>%s</p>\n          </section>\n\n'
                % (num(4, lang), e(t["s4h"]), e(t["s4_intro"]),
                   "".join("              <li>%s</li>\n" % e(x) for x in ui["delAccList"]), e(t["s4_tail"])))

    body.append('          <section id="retained">\n            <h2>%s. %s</h2>\n            <p>%s</p>\n            <p>%s</p>\n            <ul>\n%s            </ul>\n          </section>\n\n'
                % (num(5, lang), e(t["s5h"]), t["s5_lead"], e(t["s5_two"]), items(t["s5_li"])))

    body.append('          <section id="device">\n            <h2>%s. %s</h2>\n            <p>%s</p>\n            <p>%s</p>\n            <p>%s</p>\n            <p>%s</p>\n          </section>\n\n'
                % (num(6, lang), e(t["s6h"]), e(t["s6_intro"]), t["s6_inapp"] % V, t["s6_android"], e(t["s6_backup"])))

    body.append('          <section id="automatic">\n            <h2>%s. %s</h2>\n            <p>%s</p>\n            <ul>\n%s            </ul>\n            <p>%s</p>\n            <p>%s</p>\n          </section>\n'
                % (num(7, lang), e(t["s7h"]), e(t["s7_intro"]), items(t["s7_li"]), e(t["s7_same"]), e(t["s7_only"])))

    tocids = ["who", "in-app", "email", "deleted", "retained", "device", "automatic"]
    return (head(lang, p, d, t["title"], t["desc"])
            + header(lang, p, d)
            + "    <main>\n      <div class=\"shell\">\n"
            + dochead(lang, t["h1"], t["sub"], t["updated"], d)
            + '\n        <p class="summary"><strong>%s.</strong> %s</p>\n\n' % (e(s["inShort"]), e(t["summary"]))
            + toc(lang, tocids, t["toc"])
            + '        <div class="doc-body">\n'
            + "".join(body)
            + "        </div>\n      </div>\n    </main>\n\n"
            + footer(lang, p, d))
