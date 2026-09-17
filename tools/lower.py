# -*- coding: utf-8 -*-
"""The lower page: "Built local first", the contact composition and the footer.

The footer is shared by every page (chrome.footer delegates here); the contact
block belongs to the home page only, and the other pages link to it.

WHAT IS CLAIMED, AND ON WHAT EVIDENCE
  local first ....... the Qur'an, adhkar, du'as, prayer times and the qibla are
                      calculated or stored on the device; no advertising, no
                      analytics, no tracking code; no real name, email, phone
                      number or date of birth is asked for. This is the app's
                      own Privacy Policy, which this site mirrors from the app.
  needs internet .... recitation audio, tafsir on demand, the daily challenge.
  availability ...... "in final preparation for the first Android release, not
                      yet on Google Play" - the former Availability section,
                      kept as one compact footer line rather than dropped.
  the website ....... stated separately: the contact form sends an email
                      address so a reply can reach the visitor. The app's
                      promise is about the APP; the site must not borrow it.

SOCIAL LINKS. Only a link that exists in the project is rendered. GitHub is
chrome.GITHUB, the same address the app's About screen opens. INSTAGRAM and X
are deliberately empty: no handle for either was found anywhere in the app, the
site or the documentation, and a footer is not a place to guess. Fill either
constant in and the icon appears, in every language, with no other change.
"""
import html, os, sys
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chrome import S, C, LANGS, MAIL, DEV, GITHUB, e, up, lang_links, nav_items  # noqa: E402

# Verified external addresses only. Empty string = the link is not rendered.
INSTAGRAM = ""
X_COM = ""


def esc(s):
    return html.escape(s, quote=True)


T = {
    "en": {
        "trustEyebrow": "Local first",
        "trustTitle": "Your worship stays on your phone",
        "trustLead": "ZULFAA works from your device outward. What it knows about you, it keeps there.",
        "points": [
            ("On the device", "The Qur'an and the adhkar travel with the app, and prayer times and the qibla are calculated on your phone rather than fetched."),
            ("Kept, not collected", "Saved items, favourites, reading progress and your adhkar count stay on the device. The app asks for no real name, email address, phone number or date of birth."),
            ("Nothing watching", "No advertising, no analytics, no tracking code — in the app and on this website."),
            ("When the internet is used", "Recitation audio, tafsir and the optional daily challenge load only when you open them."),
        ],
        "trustLink": "Read the Privacy Policy",
        "contactEyebrow": "Contact",
        "contactTitle": "Write to ZULFAA",
        "contactLead": "A question, a correction, or something that behaved oddly on your phone — this reaches the developer directly.",
        "name": "Name",
        "nameHint": "Optional",
        "email": "Email",
        "emailHint": "So a reply can reach you",
        "message": "Message",
        # the button, in each mode: with no endpoint it opens the visitor's own
        # email app, and says so; "Send message" only where something is sent
        "send": "Send message",
        "sending": "Sending…",
        # what the note under the form says in the CURRENT mode (no endpoint).
        # The storage disclosure for a future endpoint is drafted in
        # Docs/website/CONTACT_FORM_BACKEND_PLAN_2026-09-16.md and is
        # deliberately NOT here: the page must not describe storage that is not
        # happening, and contact.js refuses endpoint mode without it.
        # the note when the form cannot send (no endpoint or no disclosure):
        # nothing is sent, nothing is stored, and no email app is ever opened
        "privacy": "Sending isn’t available on this page, so nothing you type here is sent or stored.",
        "unavailablePreview": "Sending isn’t available in this preview, so nothing was sent. Your text is still here. You can also",
        "unavailable": "Sending isn’t available on this page right now, so nothing was sent. Your text is still here. You can also",
        "subject": "Message from the ZULFAA website",
        # ENDPOINT MODE ONLY (approved 16 Sep 2026: storage only, 365 days).
        # Shown when the form actually posts to the contact service; contact.js
        # refuses endpoint mode without it. It describes the website form, not
        # the app, and promises no email reply while email is deferred.
        "privacyEndpoint": "When you send this form, your name (if you give one), email address and message are stored by our contact service on Cloudflare so we can handle your enquiry. Messages are deleted automatically after 365 days, and you can ask us to delete yours sooner.",
        # the service answered 503: collection is switched off
        "disabled": "The form isn’t accepting messages at the moment, so nothing was sent. Your text is still here. You can also",
        "fallback": "The form isn’t available right now, but you can write to us from your own email app.",
        "fallbackAction": "Write an email",
        "received": "Thank you — your message has been received.",
        "fail": "Your message could not reach us. Your text is still here — please try again. You can also",
        "rate": "Several messages were just sent from this connection. Please wait a few minutes and try again — your text is still here.",
        "invalid": "Something in the form could not be accepted. Please check it and try again.",
        "errEmail": "Please enter an email address so a reply can reach you.",
        "errEmailFormat": "That does not look like an email address.",
        "errEmailLong": "That email address is too long.",
        "errNameLong": "Please keep the name to 100 characters or fewer.",
        "errMessage": "Please write a message.",
        "errMessageShort": "Please write a little more — at least 10 characters.",
        "errMessageLong": "Please keep the message to 300 characters or fewer.",
        "countLeft": "{n} characters left",
        "countOver": "{n} characters over the limit",
        "footTag": "Prayer times, the Qur'an, adhkar and the qibla in one calm place, calculated on your own phone.",
        "footLinks": "Pages",
        "footMain": "The site",
        "footLegal": "Legal",
        "footContact": "Contact",
        "soon": "link not available yet",
        "availability": "In final preparation for the first Android release; not yet on Google Play. In Arabic, English and Dutch.",
        "github": "ZULFAA on GitHub",
        "instagram": "ZULFAA on Instagram",
        "x": "ZULFAA on X",
        "articles": "Articles",
    },
    "ar": {
        "trustEyebrow": "الأولوية لجهازك",
        "trustTitle": "عبادتك تبقى على هاتفك",
        "trustLead": "يعمل زُلْفَى من جهازك أولًا، وما يعرفه عنك يبقى فيه.",
        "points": [
            ("على الجهاز", "القرآن والأذكار يسافران مع التطبيق، ومواقيت الصلاة والقبلة تُحسب على هاتفك لا تُجلب."),
            ("محفوظ لا مجموع", "المحفوظات والمفضلة وتقدّم القراءة وعدّ أذكارك تبقى على الجهاز. ولا يطلب التطبيق اسمك الحقيقي ولا بريدك ولا رقم هاتفك ولا تاريخ ميلادك."),
            ("لا شيء يراقب", "بلا إعلانات ولا تحليلات ولا أي كود تتبّع، في التطبيق وفي هذا الموقع."),
            ("متى يُستخدم الإنترنت", "صوت التلاوة والتفسير وتحدّي اليوم الاختياري تُحمَّل عند فتحها وحدها."),
        ],
        "trustLink": "اقرأ سياسة الخصوصية",
        "contactEyebrow": "تواصل",
        "contactTitle": "راسِل زُلْفَى",
        "contactLead": "سؤال أو تصحيح أو أمر بدا غريبًا على هاتفك — تصل رسالتك إلى المطوّر مباشرة.",
        "name": "الاسم",
        "nameHint": "اختياري",
        "email": "البريد الإلكتروني",
        "emailHint": "ليصلك الرد",
        "message": "الرسالة",
        "send": "إرسال الرسالة",
        "sending": "جارٍ الإرسال…",
        "privacy": "الإرسال غير متاح في هذه الصفحة، لذلك لا يُرسَل ولا يُحفَظ شيء مما تكتبه هنا.",
        "unavailablePreview": "الإرسال غير متاح في هذه المعاينة، لذلك لم يُرسَل شيء. نصّك ما زال هنا. ويمكنك أيضًا أن",
        "unavailable": "الإرسال غير متاح في هذه الصفحة الآن، لذلك لم يُرسَل شيء. نصّك ما زال هنا. ويمكنك أيضًا أن",
        "subject": "رسالة من موقع زُلْفَى",
        "privacyEndpoint": "عند إرسال هذا النموذج تُحفَظ رسالتك وعنوان بريدك الإلكتروني واسمك (إن كتبته) لدى خدمة التواصل الخاصة بنا على Cloudflare، لنتمكّن من متابعة استفسارك. تُحذَف الرسائل تلقائيًا بعد ٣٦٥ يومًا، ويمكنك أن تطلب منا حذف رسالتك قبل ذلك.",
        "disabled": "النموذج لا يستقبل الرسائل في الوقت الحالي، لذلك لم يُرسَل شيء. نصّك ما زال هنا. ويمكنك أيضًا أن",
        "fallback": "النموذج غير متاح الآن، لكن يمكنك مراسلتنا من تطبيق البريد لديك.",
        "fallbackAction": "اكتب رسالة بريد",
        "received": "شكرًا لك — استلمنا رسالتك.",
        "fail": "تعذّر إيصال رسالتك إلينا. نصّك ما زال هنا — حاول مرة أخرى. ويمكنك أيضًا أن",
        "rate": "أُرسلت عدة رسائل من هذا الاتصال للتو. انتظر بضع دقائق ثم حاول مرة أخرى — نصّك ما زال هنا.",
        "invalid": "تعذّر قبول شيء في النموذج. راجِعه وحاول مرة أخرى.",
        "errEmail": "اكتب بريدًا إلكترونيًا ليصلك الرد.",
        "errEmailFormat": "هذا لا يبدو بريدًا إلكترونيًا.",
        "errEmailLong": "عنوان البريد هذا طويل جدًا.",
        "errNameLong": "اجعل الاسم ١٠٠ حرف أو أقل من فضلك.",
        "errMessage": "اكتب رسالتك من فضلك.",
        "errMessageShort": "اكتب أكثر قليلًا — ١٠ أحرف على الأقل.",
        "errMessageLong": "اجعل الرسالة ٣٠٠ حرف أو أقل من فضلك.",
        "countLeft": "الأحرف المتبقية: {n}",
        "countOver": "زيادة على الحد: {n}",
        "footTag": "مواقيت الصلاة والقرآن والأذكار والقبلة في مكان هادئ واحد، تُحسب على هاتفك.",
        "footLinks": "الصفحات",
        "footMain": "الموقع",
        "footLegal": "الوثائق",
        "footContact": "تواصل",
        "soon": "الرابط غير متاح بعد",
        "availability": "في مرحلة الإعداد النهائي لأول إصدار على أندرويد، ولم يُنشر بعد على Google Play. بالعربية والإنجليزية والهولندية.",
        "github": "زُلْفَى على GitHub",
        "instagram": "زُلْفَى على إنستغرام",
        "x": "زُلْفَى على إكس",
        "articles": "المقالات",
    },
    "nl": {
        "trustEyebrow": "Lokaal eerst",
        "trustTitle": "Uw aanbidding blijft op uw telefoon",
        "trustLead": "ZULFAA werkt vanaf uw apparaat naar buiten. Wat het van u weet, houdt het daar.",
        "points": [
            ("Op het apparaat", "De Koran en de adhkar reizen mee met de app, en gebedstijden en de qibla worden op uw telefoon berekend in plaats van opgehaald."),
            ("Bewaard, niet verzameld", "Opgeslagen items, favorieten, leesvoortgang en uw adhkar-telling blijven op het apparaat. De app vraagt niet om uw echte naam, e-mailadres, telefoonnummer of geboortedatum."),
            ("Niets dat meekijkt", "Geen advertenties, geen analytics, geen trackingcode — in de app en op deze website."),
            ("Wanneer internet nodig is", "Recitatie-audio, tafsir en de optionele dagelijkse uitdaging laden alleen wanneer u ze opent."),
        ],
        "trustLink": "Lees het privacybeleid",
        "contactEyebrow": "Contact",
        "contactTitle": "Schrijf ZULFAA",
        "contactLead": "Een vraag, een correctie, of iets dat zich vreemd gedroeg op uw telefoon — dit komt rechtstreeks bij de ontwikkelaar aan.",
        "name": "Naam",
        "nameHint": "Optioneel",
        "email": "E-mail",
        "emailHint": "Zodat een antwoord u kan bereiken",
        "message": "Bericht",
        "send": "Bericht versturen",
        "sending": "Versturen…",
        "privacy": "Versturen is op deze pagina niet beschikbaar; niets van wat u hier typt wordt verzonden of opgeslagen.",
        "unavailablePreview": "Versturen is niet beschikbaar in deze preview; er is dus niets verzonden. Uw tekst staat er nog. U kunt ook",
        "unavailable": "Versturen is op deze pagina nu niet beschikbaar; er is dus niets verzonden. Uw tekst staat er nog. U kunt ook",
        "subject": "Bericht via de ZULFAA-website",
        "privacyEndpoint": "Als u dit formulier verstuurt, worden uw naam (als u die invult), uw e-mailadres en uw bericht opgeslagen in onze contactdienst bij Cloudflare, zodat we uw vraag kunnen afhandelen. Berichten worden na 365 dagen automatisch verwijderd; u kunt ons vragen uw bericht eerder te verwijderen.",
        "disabled": "Het formulier neemt op dit moment geen berichten aan; er is dus niets verzonden. Uw tekst staat er nog. U kunt ook",
        "fallback": "Het formulier is nu niet beschikbaar, maar u kunt ons schrijven vanuit uw eigen e-mailprogramma.",
        "fallbackAction": "Schrijf een e-mail",
        "received": "Dank u — uw bericht is ontvangen.",
        "fail": "Uw bericht kon ons niet bereiken. Uw tekst staat er nog — probeer het opnieuw. U kunt ook",
        "rate": "Er zijn zojuist meerdere berichten vanaf deze verbinding verstuurd. Wacht een paar minuten en probeer het opnieuw — uw tekst staat er nog.",
        "invalid": "Iets in het formulier kon niet worden geaccepteerd. Controleer het en probeer het opnieuw.",
        "errEmail": "Vul een e-mailadres in zodat een antwoord u kan bereiken.",
        "errEmailFormat": "Dat lijkt geen e-mailadres.",
        "errEmailLong": "Dat e-mailadres is te lang.",
        "errNameLong": "Houd de naam op 100 tekens of minder.",
        "errMessage": "Schrijf een bericht.",
        "errMessageShort": "Schrijf iets meer — minstens 10 tekens.",
        "errMessageLong": "Houd het bericht op 300 tekens of minder.",
        "countLeft": "Nog {n} tekens",
        "countOver": "{n} tekens te veel",
        "footTag": "Gebedstijden, de Koran, adhkar en de qibla op één rustige plek, berekend op uw eigen telefoon.",
        "footLinks": "Pagina's",
        "footMain": "De site",
        "footLegal": "Juridisch",
        "footContact": "Contact",
        "soon": "link nog niet beschikbaar",
        "availability": "In voorbereiding op de eerste Android-uitgave; nog niet op Google Play. In het Arabisch, Engels en Nederlands.",
        "github": "ZULFAA op GitHub",
        "instagram": "ZULFAA op Instagram",
        "x": "ZULFAA op X",
        "articles": "Artikelen",
    },
}

ICON = {
    "github": '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27s-1.36.09-2 .27c-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>',
    "instagram": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/></svg>',
    "x": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.1L4.8 21H1.6l7.5-8.6L1.2 3h6.6l4.5 5.6L17.5 3Zm-1.1 16.1h1.8L7.7 4.8H5.8l10.6 14.3Z"/></svg>',
    "play": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 2.7v18.6c0 .6.6 1 1.1.7l14.4-8.6a.9.9 0 0 0 0-1.5L5.1 2c-.5-.3-1.1.1-1.1.7Z"/></svg>',
}


def render_trust(lang, a=""):
    """Built local first: a claim, then four differentiated points."""
    t = T[lang]
    items = "\n".join(
        '              <li class="tr-point">\n'
        '                <h3>%s</h3>\n'
        '                <p>%s</p>\n'
        '              </li>' % (esc(h), esc(b)) for h, b in t["points"])
    return (
        '        <!-- trust:start -->\n'
        '        <section class="trust" aria-labelledby="privacy-first">\n'
        '          <div class="shell">\n'
        '            <div class="tr-head">\n'
        '              <p class="tr-eyebrow">%s</p>\n'
        '              <h2 id="privacy-first">%s</h2>\n'
        '              <p class="tr-lead">%s</p>\n'
        '              <p class="tr-link"><a href="%sprivacy/">%s</a></p>\n'
        '            </div>\n'
        '            <ul class="tr-points">\n%s\n            </ul>\n'
        '          </div>\n'
        '        </section>\n'
        '        <!-- trust:end -->'
        % (esc(t["trustEyebrow"]), esc(t["trustTitle"]), esc(t["trustLead"]),
           a + LANGS[lang]["base"] if a else LANGS[lang]["base"], esc(t["trustLink"]), items))


# The client's limits. Convenience only: they save a visitor a round trip, and
# nothing more. A future endpoint must enforce its own (the plan, section 4.2),
# because anything in a browser can be bypassed. Counted in characters (code
# points), the same unit Postgres char_length uses.
LIMITS = {"name": 100, "email": 254, "messageMin": 10, "messageMax": 300}


def mailto(lang):
    return "mailto:%s?subject=%s" % (MAIL, quote(T[lang]["subject"]))


def contact_form(lang, a=""):
    """The fallback, then the form.

    SAFE BY DEFAULT. What the markup shows on its own is the FALLBACK: a
    sentence and a real mailto link. The form ships `hidden`, and
    assets/contact.js removes that attribute only as the last step of a
    successful initialisation - after its submit handler is attached. So with
    scripting off, a blocked or failed script, or an exception during set-up,
    the visitor sees a working way to write and never a form that cannot send.

    Belt and braces: the form also says method="post". Were it ever shown
    without the script, a submit would put nothing in the address bar (the
    browser default, GET, is what put the name, email and message into the URL).

    Every string the controller shows is an attribute here, so contact.js
    carries no language of its own."""
    t = T[lang]
    data = [
        ("recipient", MAIL), ("subject", t["subject"]), ("lang", lang),
        ("send", t["send"]), ("sending", t["sending"]), ("write-email", t["fallbackAction"]),
        ("unavailable", t["unavailable"]), ("unavailable-preview", t["unavailablePreview"]),
        ("received", t["received"]), ("fail", t["fail"]), ("rate", t["rate"]), ("invalid", t["invalid"]),
        ("err-email", t["errEmail"]), ("err-email-format", t["errEmailFormat"]),
        ("err-email-long", t["errEmailLong"]), ("err-name-long", t["errNameLong"]),
        ("err-message", t["errMessage"]), ("err-message-short", t["errMessageShort"]),
        ("err-message-long", t["errMessageLong"]),
        ("count-left", t["countLeft"]), ("count-over", t["countOver"]),
        ("max-name", LIMITS["name"]), ("max-email", LIMITS["email"]),
        ("min-message", LIMITS["messageMin"]), ("max-message", LIMITS["messageMax"]),
        # Empty ON PURPOSE until activation. Endpoint mode stores messages, and
        # contact.js will not enter it without this disclosure. At activation,
        # add the APPROVED wording per language as T[lang]["privacyEndpoint"]
        # (draft: Docs/website/CONTACT_STORAGE_DISCLOSURE_DRAFT.md).
        ("privacy-endpoint", t.get("privacyEndpoint", "")),
        ("disabled", t["disabled"]),
    ]
    attrs = "".join('\n              data-%s="%s"' % (k, esc(str(v))) for k, v in data)
    return (
        '            <div class="cf cf-fallback" data-cf-fallback>\n'
        '              <p class="cf-fallback-text">%s</p>\n'
        '              <p class="cf-actions">\n'
        '                <a class="btn primary cf-send" href="%s">%s</a>\n'
        '              </p>\n'
        '              <p class="cf-fallback-addr"><a href="%s" dir="ltr">%s</a></p>\n'
        '            </div>\n'
        '            <form class="cf" id="contact-form" method="post" novalidate hidden%s\n'
        '            >\n'
        '              <p class="cf-row">\n'
        '                <label for="cf-name">%s <span class="cf-hint">%s</span></label>\n'
        '                <input id="cf-name" name="name" type="text" autocomplete="name" dir="auto"\n'
        '                  aria-describedby="cf-name-err" />\n'
        '                <span class="cf-err" id="cf-name-err" hidden></span>\n'
        '              </p>\n'
        '              <p class="cf-row">\n'
        '                <label for="cf-email">%s <span class="cf-hint">%s</span></label>\n'
        '                <input id="cf-email" name="email" type="email" inputmode="email" autocomplete="email"\n'
        '                  dir="ltr" required aria-describedby="cf-email-err" />\n'
        '                <span class="cf-err" id="cf-email-err" hidden></span>\n'
        '              </p>\n'
        '              <p class="cf-row">\n'
        '                <label for="cf-message">%s</label>\n'
        '                <textarea id="cf-message" name="message" rows="5" dir="auto" required\n'
        '                  maxlength="%d" aria-describedby="cf-message-err"></textarea>\n'
        '                <span class="cf-count" id="cf-message-count" hidden></span>\n'
        '                <span class="cf-err" id="cf-message-err" hidden></span>\n'
        '              </p>\n'
        '              <p class="cf-actions">\n'
        '                <button class="btn primary cf-send" type="submit">%s</button>\n'
        '              </p>\n'
        '              <p class="cf-state" role="status" aria-live="polite" tabindex="-1" hidden></p>\n'
        '              <p class="cf-privacy">%s</p>\n'
        '            </form>'
        % (esc(t["fallback"]), esc(mailto(lang)), esc(t["fallbackAction"]), esc(mailto(lang)), MAIL,
           attrs,
           esc(t["name"]), esc(t["nameHint"]), esc(t["email"]), esc(t["emailHint"]),
           esc(t["message"]), LIMITS["messageMax"], esc(t["send"]), esc(t["privacy"])))


def socials(lang, cls="fo-social"):
    """The three marks as one group. A mark with no verified address is drawn
    but not a link: no href at all, so it cannot navigate anywhere, and its
    accessible name says why it does nothing. Fill the constant in and the
    same mark becomes a real link, in every language, with no other change."""
    t = T[lang]
    out = ['        <ul class="%s">' % cls]
    for url, key in ((GITHUB, "github"), (INSTAGRAM, "instagram"), (X_COM, "x")):
        if url:
            out.append('          <li><a href="%s" rel="me noopener" target="_blank" aria-label="%s">%s</a></li>'
                       % (url, esc(t[key]), ICON[key]))
        else:
            out.append('          <li><span class="fo-social-soon" role="img" aria-label="%s — %s" title="%s">%s</span></li>'
                       % (esc(t[key]), esc(t["soon"]), esc(t["soon"]), ICON[key]))
    out.append("        </ul>")
    return "\n".join(out)


def _links(lang, depth, wanted):
    """`wanted` is a list of route keys; the labels are the ones each language's
    own pages already use (chrome.nav_items), plus the journal."""
    base = up(depth) + LANGS[lang]["base"]
    labels = dict(nav_items(lang))
    labels["articles/"] = T[lang]["articles"]
    # the Updates page's own heading, so the link and the page agree
    from updates_strings import U
    labels["updates/"] = U[lang]["h1"]
    return "\n".join('              <li><a href="%s">%s</a></li>' % ((base + href) or "./", e(labels[href]))
                     for href in wanted)


def main_links(lang, depth):
    """what the site is: the pages a visitor browses"""
    from articles import PUBLISHED
    pages = ["", "articles/", "updates/", "support/"] if PUBLISHED else ["", "updates/", "support/"]
    return _links(lang, depth, pages)


def legal_links(lang, depth):
    """what the site owes: the documents and the data routes"""
    return _links(lang, depth, ["privacy/", "terms/", "delete-data/"])


def render_contact(lang, a=""):
    """The home page's contact block. It sits directly above the footer and
    shares its deep material, so the two read as one closing composition."""
    t = T[lang]
    return (
        '      <!-- contact:start -->\n'
        '      <section class="contact" id="contact" aria-labelledby="contact-title">\n'
        '        <div class="shell">\n'
        '          <div class="co-grid">\n'
        '            <div class="co-intro">\n'
        '              <p class="co-eyebrow">%s</p>\n'
        '              <h2 id="contact-title">%s</h2>\n'
        '              <p class="co-lead">%s</p>\n'
        '              <p class="co-mail"><a href="mailto:%s">%s</a></p>\n'
        '            </div>\n'
        '%s\n'
        '          </div>\n'
        '        </div>\n'
        '      </section>\n'
        '      <!-- contact:end -->'
        % (esc(t["contactEyebrow"]), esc(t["contactTitle"]), esc(t["contactLead"]), MAIL, MAIL,
           contact_form(lang, a)))


def render_footer(lang, page, depth):
    """The site footer: brand, pages, availability, social, copyright strip.

    Pages other than the home page carry a Contact link into the home page's
    form rather than a second copy of it."""
    a = up(depth)
    s, t = S[lang], T[lang]
    base = a + LANGS[lang]["base"]
    home = base or "./"
    contact_href = (home + "#contact") if page != "" else "#contact"
    langs = "\n".join(
        '            <li><a href="%s" lang="%s" hreflang="%s"%s>%s</a></li>'
        % (href, l, l, ' aria-current="true"' if cur else "", e(LANGS[l]["name"]))
        for l, href, cur in lang_links(lang, page, depth))
    # On the home page the contact block sits directly above, so the footer
    # continues its material instead of starting a new one. A sibling selector
    # cannot say this - </main> closes between the two - so the page says it.
    joined = " is-joined" if page == "" else ""
    return f"""    <footer class="site-foot{joined}">
      <div class="shell">
        <div class="fo-grid">
          <div class="fo-brand">
            <a class="fo-mark" href="{home}">
              <img src="{a}assets/emblem-256.webp" alt="" width="256" height="256" />
              <span>ZULFAA</span>
            </a>
            <p class="fo-tag">{esc(t['footTag'])}</p>
            <p class="fo-avail"><span class="fo-play">{ICON['play']}</span>{esc(t['availability'])}</p>
{socials(lang)}
          </div>

          <nav class="fo-links" aria-label="{e(s['footerLabel'])}">
            <h2>{esc(t['footMain'])}</h2>
            <ul>
{main_links(lang, depth)}
            </ul>
          </nav>

          <nav class="fo-links" aria-label="{esc(t['footLegal'])}">
            <h2>{esc(t['footLegal'])}</h2>
            <ul>
{legal_links(lang, depth)}
            </ul>
          </nav>

          <div class="fo-say">
            <h2>{esc(t['footContact'])}</h2>
            <p><a class="fo-cta" href="{contact_href}">{esc(t['contactTitle'])}</a></p>
            <p class="fo-mail"><a href="mailto:{MAIL}">{MAIL}</a></p>
            <ul class="fo-langs" aria-label="{e(s['langLabel'])}">
{langs}
            </ul>
          </div>
        </div>

        <div class="fo-base">
          <p class="fo-dev">{e(s['devBy'])} <span class="dev">Moner Intelligence Systems</span></p>
          <p class="fo-copy">{e(s['rights'])}</p>
        </div>
      </div>
    </footer>
"""
