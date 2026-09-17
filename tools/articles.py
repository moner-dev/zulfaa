# -*- coding: utf-8 -*-
"""The ZULFAA journal: the home page's editorial section, the /articles/ index
and the article pages themselves, in all three languages.

WHERE THE CONTENT COMES FROM. Every sentence below describes behaviour that
was read out of the app or off the site, never invented:

  prayer times ...... src/App.tsx prayer settings (calculation method, Asr
                      madhhab, per-prayer manual adjustment, device or manual
                      location) and the site's own former feature card
  Qur'an ............ the Uthmani text with an English translation bundled with
                      the app, bookmarks, saved verses, reading progress,
                      a choice of reciters, tafsir loaded on demand
  offline ........... adhkar, du'as and the qibla work offline; prayer times and
                      the qibla are computed on the device; the app carries no
                      advertising, analytics or tracking code
                      (src/App.tsx support FAQ + the Privacy Policy the site
                      mirrors from the app)

NO DATES, NO AUTHORS, NO ANNOUNCEMENTS. Nothing here claims a publication date,
a byline, a testimonial or a release. All three pieces are DRAFTS awaiting the
owner's editorial review, and every surface says so: `draft: True` renders the
draft word on the card, on the index and on the article page.

Artwork is the app's own gallery screenshots (assets/showcase), so an article
shows the real screen it is about.
"""
import html, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chrome import S, LANGS, e, head, header, footer, up, asset, main_open, themed_img_boot  # noqa: E402

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DRAFT = {"en": "Draft", "ar": "مسودة", "nl": "Concept"}
DRAFT_NOTE = {
    "en": "A draft. It is written from what the app does today and is waiting for editorial review before publication.",
    "ar": "مسودة. كُتبت مما يفعله التطبيق اليوم، وتنتظر المراجعة التحريرية قبل النشر.",
    "nl": "Een concept. Het is geschreven op basis van wat de app vandaag doet en wacht op redactionele controle vóór publicatie.",
}

UI = {
    "en": {
        "sectionEyebrow": "The journal",
        "sectionTitle": "Short guides to the app",
        "sectionNote": "Written from what ZULFAA actually does — how to set it up, how to read and listen, and what keeps working without a connection.",
        "all": "All articles",
        "read": "Read the guide",
        "indexTitle": "Articles — ZULFAA",
        "indexDesc": "Short guides to ZULFAA: prayer time settings, reading and listening to the Qur'an, and what works offline.",
        "indexH1": "Articles",
        "indexSub": "Short guides to ZULFAA, written from what the app does.",
        "back": "All articles",
        "next": "Read next",
        "home": "Home",
    },
    "ar": {
        "sectionEyebrow": "المقالات",
        "sectionTitle": "أدلة قصيرة لاستخدام التطبيق",
        "sectionNote": "مكتوبة مما يفعله زُلْفَى فعلًا: كيف تضبطه، وكيف تقرأ وتستمع، وما الذي يظل يعمل دون اتصال.",
        "all": "كل المقالات",
        "read": "اقرأ الدليل",
        "indexTitle": "المقالات — زُلْفَى",
        "indexDesc": "أدلة قصيرة لزُلْفَى: ضبط مواقيت الصلاة، وقراءة القرآن والاستماع إليه، وما يعمل دون اتصال.",
        "indexH1": "المقالات",
        "indexSub": "أدلة قصيرة لزُلْفَى، مكتوبة مما يفعله التطبيق.",
        "back": "كل المقالات",
        "next": "اقرأ بعده",
        "home": "الرئيسية",
    },
    "nl": {
        "sectionEyebrow": "Artikelen",
        "sectionTitle": "Korte gidsen bij de app",
        "sectionNote": "Geschreven op basis van wat ZULFAA werkelijk doet: hoe u het instelt, hoe u leest en luistert, en wat blijft werken zonder verbinding.",
        "all": "Alle artikelen",
        "read": "Lees de gids",
        "indexTitle": "Artikelen — ZULFAA",
        "indexDesc": "Korte gidsen bij ZULFAA: gebedstijden instellen, de Koran lezen en beluisteren, en wat offline werkt.",
        "indexH1": "Artikelen",
        "indexSub": "Korte gidsen bij ZULFAA, geschreven op basis van wat de app doet.",
        "back": "Alle artikelen",
        "next": "Lees hierna",
        "home": "Start",
    },
}

# slug, gallery image (assets/showcase/<shot>.webp + -640), and the text
ARTICLES = [
    {
        "slug": "prayer-times",
        "shot": "prayer-settings",
        # the app's prayer settings in the phone frame, per language and theme
        # (tools/article_art.py); `shot` stays as the picture for a language
        # whose two themes do not both exist yet
        "screen": "prayer-settings",
        "draft": True,
        "en": {
            "title": "Setting prayer times that match your mosque",
            "summary": "Choose the calculation method and the Asr madhhab, then adjust any single prayer by a minute or two until the app agrees with the mosque you pray in.",
            "alt": "The prayer settings screen: calculation method, Asr madhhab and the high-latitude rule.",
            "body": [
                "ZULFAA calculates prayer times on your own phone, from your location and the settings you choose. Nothing is fetched from a timetable server, which is why the times keep working when you are offline.",
                "Two settings decide most of the result. The calculation method sets the sun angles used for Fajr and Isha, and different regions follow different conventions. The Asr madhhab decides whether Asr begins at one or two shadow lengths.",
                "Mosques often round or shift a prayer by a minute or two. Rather than change the method for all five, adjust the single prayer that differs: each prayer carries its own manual adjustment in minutes.",
                "Your location can come from the device or be chosen by hand. A manual city is useful when you want times for where you will be, or when you would rather not share location at all.",
            ],
        },
        "ar": {
            "title": "اضبط مواقيت الصلاة لتوافق مسجدك",
            "summary": "اختر طريقة الحساب ومذهب العصر، ثم عدّل صلاة بعينها دقيقة أو دقيقتين حتى يوافق التطبيق المسجد الذي تصلي فيه.",
            "alt": "شاشة إعدادات الصلاة: طريقة الحساب ومذهب العصر وقاعدة خطوط العرض العالية.",
            "body": [
                "يحسب زُلْفَى مواقيت الصلاة على هاتفك نفسه، من موقعك ومن الإعدادات التي تختارها. لا يُجلب شيء من خادم جداول، ولهذا تظل المواقيت تعمل دون اتصال.",
                "إعدادان يحددان معظم النتيجة: طريقة الحساب التي تضبط زوايا الشمس للفجر والعشاء، وتختلف باختلاف المناطق، ومذهب العصر الذي يحدد بدء العصر عند مثل الظل أو مثليه.",
                "كثير من المساجد تقرّب وقت صلاة أو تزيحه دقيقة أو دقيقتين. بدل تغيير الطريقة للصلوات الخمس، عدّل الصلاة المختلفة وحدها: لكل صلاة تعديل يدوي بالدقائق.",
                "يمكن أن يأتي موقعك من الجهاز أو أن تختاره بنفسك. والاختيار اليدوي مفيد حين تريد مواقيت المكان الذي ستكون فيه، أو حين تفضّل ألّا تشارك موقعك أصلًا.",
            ],
        },
        "nl": {
            "title": "Gebedstijden instellen die kloppen met uw moskee",
            "summary": "Kies de berekeningsmethode en de Asr-madhhab en pas daarna één gebed met een minuut of twee aan, tot de app overeenkomt met de moskee waar u bidt.",
            "alt": "Het scherm met gebedsinstellingen: berekeningsmethode, Asr-madhhab en de regel voor hoge breedtegraden.",
            "body": [
                "ZULFAA berekent gebedstijden op uw eigen telefoon, uit uw locatie en de instellingen die u kiest. Er wordt niets opgehaald bij een server met tijdtabellen, en daarom blijven de tijden werken zonder verbinding.",
                "Twee instellingen bepalen het meeste. De berekeningsmethode stelt de zonshoeken voor Fajr en Isha in, en regio's volgen daarin verschillende conventies. De Asr-madhhab bepaalt of Asr begint bij één of twee schaduwlengtes.",
                "Moskeeën ronden een gebed vaak af of verschuiven het met een minuut of twee. Verander dan niet de methode voor alle vijf, maar pas het ene afwijkende gebed aan: elk gebed heeft zijn eigen handmatige aanpassing in minuten.",
                "Uw locatie kan van het apparaat komen of met de hand worden gekozen. Een handmatig gekozen stad is handig als u tijden wilt voor waar u zult zijn, of als u uw locatie liever helemaal niet deelt.",
            ],
        },
    },
    {
        "slug": "reading-and-listening",
        "shot": "surah-reader",
        "draft": True,
        "en": {
            "title": "Reading and listening to the Qur'an",
            "summary": "The full Uthmani text with an English translation travels with the app. Bookmarks, saved verses and your reading position stay on the device; tafsir and recitation load when you ask for them.",
            "alt": "Surah Al-Baqarah open in the dark theme, with a choice of reciters above the Arabic text.",
            "body": [
                "The Qur'an is bundled with the app rather than downloaded: the complete Uthmani text and an English translation are there the first time you open it, with no connection needed to read.",
                "Two marks do different jobs. A bookmark, the save icon, gathers a verse on the Saved page; a heart puts it in Favorites. Both hold verses, du'as and adhkar, and both live on your device.",
                "Your reading position is remembered, so the app can offer to continue where you stopped rather than sending you back to the first page.",
                "Recitation and tafsir are the parts that use the internet. Choose a reciter to listen, or open the tafsir for the verse in front of you; neither is fetched until you ask for it.",
            ],
        },
        "ar": {
            "title": "قراءة القرآن والاستماع إليه",
            "summary": "النص العثماني كاملًا مع ترجمة إنجليزية يسافران مع التطبيق. العلامات والمحفوظات وموضع قراءتك تبقى على الجهاز، والتفسير والتلاوة يُحمَّلان عند طلبهما.",
            "alt": "سورة البقرة مفتوحة في الوضع الداكن، مع اختيار القارئ فوق النص العربي.",
            "body": [
                "القرآن مضمّن في التطبيق لا يُنزَّل: النص العثماني كاملًا وترجمة إنجليزية موجودان أول مرة تفتحه، دون حاجة إلى اتصال للقراءة.",
                "لكل علامة عملها. علامة الحفظ تجمع الآية في صفحة المحفوظات، والقلب يضعها في المفضلة. وكلتاهما تقبلان الآيات والأدعية والأذكار، وكلتاهما على جهازك.",
                "يُحفظ موضع قراءتك، فيعرض عليك التطبيق متابعة ما توقفت عنده بدل إعادتك إلى أول الصفحة.",
                "التلاوة والتفسير هما ما يستخدم الإنترنت. اختر قارئًا لتستمع، أو افتح تفسير الآية التي أمامك؛ ولا يُجلب أيٌّ منهما قبل أن تطلبه.",
            ],
        },
        "nl": {
            "title": "De Koran lezen en beluisteren",
            "summary": "De volledige Uthmani-tekst met Engelse vertaling reist mee met de app. Bladwijzers, opgeslagen verzen en uw leespositie blijven op het apparaat; tafsir en recitatie laden wanneer u erom vraagt.",
            "alt": "Soera Al-Baqara geopend in het donkere thema, met een keuze aan reciteurs boven de Arabische tekst.",
            "body": [
                "De Koran wordt met de app meegeleverd in plaats van gedownload: de volledige Uthmani-tekst en een Engelse vertaling staan er de eerste keer dat u de app opent, zonder verbinding om te lezen.",
                "Twee markeringen doen verschillend werk. Een bladwijzer verzamelt een vers op de pagina Opgeslagen; een hart zet het bij Favorieten. Beide nemen verzen, doe'a's en adhkar op, en beide blijven op uw apparaat.",
                "Uw leespositie wordt onthouden, zodat de app kan aanbieden verder te gaan waar u stopte in plaats van u terug te sturen naar de eerste pagina.",
                "Recitatie en tafsir zijn de delen die internet gebruiken. Kies een reciteur om te luisteren, of open de tafsir bij het vers dat voor u staat; geen van beide wordt opgehaald voordat u erom vraagt.",
            ],
        },
    },
    {
        "slug": "offline-and-privacy",
        "shot": "adhkar-dua",
        "draft": True,
        "en": {
            "title": "What keeps working without a connection",
            "summary": "Adhkar, du'as, the qibla and prayer times are worked out and kept on your phone. Only a few parts reach the internet, and the app asks for no account to do any of it.",
            "alt": "Adhkar and Du'a in the dark theme: the daily wird, favourites, search and du'as grouped by theme.",
            "body": [
                "Most of ZULFAA is local. Adhkar and du'as are stored in the app, the qibla is computed from your position, and prayer times come from a calculation rather than a request, so all of it survives a flight or a dead signal.",
                "Your marks stay with you as well: saved items, favourites, reading progress and your adhkar count live on the device, not in an account.",
                "The parts that do use the internet are the ones you start: recitation audio, tafsir, and the optional daily challenge. If there is no connection, the app says so instead of pretending.",
                "ZULFAA carries no advertising, no analytics and no tracking code, and it never asks for your real name, email address, phone number or date of birth.",
                "This website is separate from the app. Writing to us through the contact form means sending an email address so a reply can reach you — that is a choice you make on the site, not something the app does.",
            ],
        },
        "ar": {
            "title": "ما الذي يظل يعمل دون اتصال",
            "summary": "الأذكار والأدعية والقبلة ومواقيت الصلاة تُحسب وتُحفظ على هاتفك. ولا يصل إلى الإنترنت إلا أجزاء قليلة، ولا يطلب التطبيق حسابًا لشيء من ذلك.",
            "alt": "الأذكار والأدعية في الوضع الداكن: الورد اليومي والمفضلة والبحث والأدعية حسب الموضوع.",
            "body": [
                "معظم زُلْفَى محلي. الأذكار والأدعية مخزّنة داخل التطبيق، والقبلة تُحسب من موقعك، والمواقيت تأتي من حساب لا من طلب؛ فيبقى ذلك كله عاملًا في طائرة أو عند انقطاع الشبكة.",
                "وعلاماتك تبقى معك كذلك: المحفوظات والمفضلة وتقدّم القراءة وعدّ أذكارك على الجهاز، لا في حساب.",
                "أما ما يستخدم الإنترنت فهو ما تبدأه أنت: صوت التلاوة، والتفسير، وتحدّي اليوم الاختياري. وعند انقطاع الاتصال يقول التطبيق ذلك بدل أن يتظاهر.",
                "لا يحمل زُلْفَى إعلانات ولا تحليلات ولا أي كود تتبّع، ولا يطلب اسمك الحقيقي ولا بريدك ولا رقم هاتفك ولا تاريخ ميلادك.",
                "وهذا الموقع منفصل عن التطبيق. ومراسلتنا عبر نموذج التواصل تعني إرسال بريد إلكتروني ليصلك الرد — وهو اختيارك على الموقع، لا شيء يفعله التطبيق.",
            ],
        },
        "nl": {
            "title": "Wat blijft werken zonder verbinding",
            "summary": "Adhkar, doe'a's, de qibla en gebedstijden worden op uw telefoon berekend en bewaard. Slechts enkele onderdelen gaan het internet op, en de app vraagt daarvoor geen account.",
            "alt": "Adhkar en doe'a in het donkere thema: de dagelijkse wird, favorieten, zoeken en doe'a's per thema.",
            "body": [
                "Het meeste van ZULFAA is lokaal. Adhkar en doe'a's staan in de app, de qibla wordt uit uw positie berekend en gebedstijden komen uit een berekening in plaats van een aanvraag, dus alles overleeft een vlucht of een wegvallend signaal.",
                "Ook uw markeringen blijven bij u: opgeslagen items, favorieten, leesvoortgang en uw adhkar-telling staan op het apparaat, niet in een account.",
                "De onderdelen die wél internet gebruiken zijn de onderdelen die u zelf start: recitatie-audio, tafsir en de optionele dagelijkse uitdaging. Is er geen verbinding, dan zegt de app dat in plaats van te doen alsof.",
                "ZULFAA bevat geen advertenties, geen analytics en geen trackingcode, en vraagt nooit om uw echte naam, e-mailadres, telefoonnummer of geboortedatum.",
                "Deze website staat los van de app. Ons schrijven via het contactformulier betekent dat u een e-mailadres meestuurt zodat een antwoord u kan bereiken — dat is een keuze die u op de site maakt, niet iets wat de app doet.",
            ],
        },
    },
]

BY_SLUG = {a["slug"]: a for a in ARTICLES}


def esc(s):
    return html.escape(s, quote=True)


def themed_art(art, lang):
    """{theme: site-relative base} when the article has a `screen` and BOTH of
    this language's pictures exist (tools/article_art.py), else None."""
    screen = art.get("screen")
    if not screen:
        return None
    bases = {t: "assets/articles/%s-%s-%s" % (screen, lang, t) for t in ("light", "dark")}
    for base in bases.values():
        for rel in (base + ".webp", base + "-640.webp"):
            if not os.path.exists(os.path.join(SITE, rel)):
                return None
    return bases


def art_img(a, art, lang, sizes, cls=""):
    """The article's picture. With a `screen` whose two themes exist in this
    language: the app's own screen in the phone frame, light in the markup and
    both themes as data attributes, followed by the boot line that picks dark
    before the lazy image loads (assets/lantern.js follows the lantern after).
    Otherwise the article's own gallery screenshot, at the two sizes shipped."""
    bases = themed_art(art, lang)
    if bases:
        src = {t: a + b + ".webp" for t, b in bases.items()}
        sets = {t: "%s%s-640.webp 640w, %s%s.webp 941w" % (a, b, a, b) for t, b in bases.items()}
        return ('<img%s src="%s" srcset="%s" sizes="%s" width="941" height="1672" alt="%s" '
                'loading="lazy" decoding="async" data-src-light="%s" data-srcset-light="%s" '
                'data-src-dark="%s" data-srcset-dark="%s" />%s'
                % ((' class="%s"' % cls) if cls else "", src["light"], sets["light"], sizes, esc(art[lang]["alt"]),
                   src["light"], sets["light"], src["dark"], sets["dark"], themed_img_boot("").strip()))
    shot = art["shot"]
    return ('<img%s src="%sassets/showcase/%s.webp" srcset="%sassets/showcase/%s-640.webp 640w, '
            '%sassets/showcase/%s.webp 941w" sizes="%s" width="941" height="1672" alt="%s" '
            'loading="lazy" decoding="async" />'
            % ((' class="%s"' % cls) if cls else "", a, shot, a, shot, a, shot, sizes, esc(art[lang]["alt"])))


def draft_chip(lang, art):
    return ('<span class="jr-draft">%s</span>' % esc(DRAFT[lang])) if art.get("draft") else ""


def render_journal(lang, a=""):
    """The home page's editorial section: one lead article, two beside it."""
    T = UI[lang]
    lead, rest = ARTICLES[0], ARTICLES[1:]
    # the language's own tree, the way chrome.footer addresses pages: on the
    # Arabic home page this is "../ar/", which resolves to /ar/articles/...
    base = a + LANGS[lang]["base"]
    href = lambda slug: "%sarticles/%s/" % (base, slug)

    items = "\n".join(
        '              <li class="jr-item">\n'
        '                <a class="jr-item-link" href="%s">\n'
        '                  <span class="jr-item-art">%s</span>\n'
        '                  <span class="jr-item-text">\n'
        '                    <span class="jr-item-title">%s</span>%s\n'
        '                    <span class="jr-item-sum">%s</span>\n'
        '                  </span>\n'
        '                </a>\n'
        '              </li>'
        % (href(x["slug"]), art_img(a, x, lang, "5.5rem", "jr-thumb"), esc(x[lang]["title"]),
           (" " + draft_chip(lang, x)) if x.get("draft") else "", esc(x[lang]["summary"]))
        for x in rest)

    return (
        '        <!-- journal:start -->\n'
        '        <section class="journal" aria-labelledby="journal-title">\n'
        '          <div class="shell">\n'
        '            <div class="jr-head">\n'
        '              <p class="jr-eyebrow">%s</p>\n'
        '              <h2 class="jr-title" id="journal-title">%s</h2>\n'
        '              <p class="jr-note">%s</p>\n'
        '            </div>\n'
        '            <div class="jr-body">\n'
        '              <article class="jr-lead">\n'
        '                <a class="jr-lead-link" href="%s">\n'
        '                  <span class="jr-lead-art">%s</span>\n'
        '                  <span class="jr-lead-text">\n'
        '                    <span class="jr-lead-title">%s</span>%s\n'
        '                    <span class="jr-lead-sum">%s</span>\n'
        '                    <span class="jr-more">%s</span>\n'
        '                  </span>\n'
        '                </a>\n'
        '              </article>\n'
        '              <ul class="jr-list">\n%s\n              </ul>\n'
        '            </div>\n'
        '            <p class="jr-all"><a href="%sarticles/">%s</a></p>\n'
        '          </div>\n'
        '        </section>\n'
        '        <!-- journal:end -->'
        % (esc(T["sectionEyebrow"]), esc(T["sectionTitle"]), esc(T["sectionNote"]),
           href(lead["slug"]), art_img(a, lead, lang, "(max-width: 56rem) 88vw, 26rem", "jr-lead-img"),
           esc(lead[lang]["title"]), (" " + draft_chip(lang, lead)) if lead.get("draft") else "",
           esc(lead[lang]["summary"]), esc(T["read"]), items, base, esc(T["all"])))


def build_index(lang):
    """/articles/ — every article, newest thinking first; no dates are claimed."""
    p, d = "articles/", 1 if lang == "en" else 2
    T = UI[lang]
    a = up(d)
    cards = "\n".join(
        '          <li class="ax-item">\n'
        '            <a class="ax-link" href="%s/">\n'
        '              <span class="ax-art">%s</span>\n'
        '              <span class="ax-text">\n'
        '                <span class="ax-title">%s</span>%s\n'
        '                <span class="ax-sum">%s</span>\n'
        '              </span>\n'
        '            </a>\n'
        '          </li>'
        % (x["slug"], art_img(a, x, lang, "7rem", "ax-thumb"), esc(x[lang]["title"]),
           (" " + draft_chip(lang, x)) if x.get("draft") else "", esc(x[lang]["summary"]))
        for x in ARTICLES)
    return (head(lang, p, d, T["indexTitle"], T["indexDesc"])
            + header(lang, p, d)
            + main_open(lang, d)
            + '        <div class="doc-head">\n'
            + '          <img src="%sassets/emblem-256.webp" alt="" width="256" height="256" />\n' % a
            + '          <h1>%s</h1>\n' % esc(T["indexH1"])
            + '          <p class="sub">%s</p>\n' % esc(T["indexSub"])
            + '        </div>\n\n'
            + '        <ul class="ax-list">\n%s\n        </ul>\n' % cards
            + '      </div>\n    </main>\n\n'
            + footer(lang, p, d))


def build_article(lang, slug):
    art = BY_SLUG[slug]
    p, d = "articles/%s/" % slug, 2 if lang == "en" else 3
    T, t = UI[lang], art[lang]
    a = up(d)
    paras = "\n".join('          <p>%s</p>' % esc(x) for x in t["body"])
    others = [x for x in ARTICLES if x["slug"] != slug][:2]
    nexts = "\n".join('            <li><a href="../%s/">%s</a></li>' % (x["slug"], esc(x[lang]["title"]))
                      for x in others)
    return (head(lang, p, d, "%s — ZULFAA" % t["title"], t["summary"][:180])
            + header(lang, p, d)
            + main_open(lang, d)
            + '        <article class="ap">\n'
            + '          <p class="ap-back"><a href="../">%s</a></p>\n' % esc(T["back"])
            + '          <h1 class="ap-title">%s</h1>\n' % esc(t["title"])
            + '          <p class="ap-sum">%s</p>\n' % esc(t["summary"])
            + (('          <p class="ap-draft"><span class="jr-draft">%s</span> %s</p>\n'
                % (esc(DRAFT[lang]), esc(DRAFT_NOTE[lang]))) if art.get("draft") else "")
            + '          <figure class="ap-fig">%s</figure>\n' % art_img(a, art, lang, "(max-width: 46rem) 80vw, 22rem")
            + '          <div class="ap-body">\n%s\n          </div>\n' % paras
            + '          <nav class="ap-next" aria-label="%s">\n            <h2>%s</h2>\n            <ul>\n%s\n            </ul>\n          </nav>\n'
              % (esc(T["next"]), esc(T["next"]), nexts)
            + '        </article>\n      </div>\n    </main>\n\n'
            + footer(lang, p, d))
