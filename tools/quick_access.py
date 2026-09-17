# -*- coding: utf-8 -*-
"""Quick Access - the landing page's second section: the eight shortcuts of
the app's home screen on one circular dial.

Sources, so nothing here is invented from a sticker's look:
  tile names ............ src/App.tsx `home` strings (ar/en/nl)
  Qur'an, Adhkar, Du'a, Qibla ... the site's previous feature cards (lifted from
                          the app) and src/App.tsx `adhkar.cats`, `adhkar.duas`,
                          `adhkarNeutralHint`
  Saved / Favorites ..... two separate collections in the app: the bookmark
                          (`saveAction`) and the heart (`favAction`), each on
                          verses, du'as and adhkar; the Saved page filters by
                          verse / du'a / dhikr (src/App.tsx `SavedType`)
  Umrah Savings, Ramadan Planner ... Docs/releases/V1_1_0_USER_FACING_NOTES_DRAFT.md
                          sections 3b-3c. NOT released: src/release/nextRelease.ts
                          has umrahSavings / ramadanPlanner = false, so both
                          carry the future-update note in every language.
  artwork ............... the app's own stickers (src/assets/stickers, 512 px
                          masters in assets/masters/stickers). Saved and
                          Favorites are the app's vector drawings
                          (src/home/StickerIcons.tsx). Du'a has no file above
                          256 px, so it is never served larger than that.

ar/ and nl/ are rendered through home.py by build.py. The English index.html is
a hand-written original that build.py never writes below its header, so its
copy of this section is refreshed explicitly - and idempotently - with

    python tools/quick_access.py --write-en

which replaces only the region between the quick-access markers and makes sure
the page loads assets/quick-access.js.
"""
import html, math, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# clockwise from the gold marker (counter-clockwise in Arabic), neighbours that
# belong together: Qur'an beside Saved and Adhkar, Umrah beside Ramadan
ORDER = ("quran", "adhkar", "dua", "qibla", "ramadan", "umrah", "favorites", "saved")
UPCOMING = ("umrah", "ramadan")
VECTOR = ("saved", "favorites")
RASTER_SIZES = {"dua": (128, 256)}  # the largest Du'a file that exists
DEFAULT_SIZES = (128, 256, 512)

QA = {
    "en": {
        "title": "One tap from the home screen",
        "note": "Eight shortcuts sit on ZULFAA’s home screen. Choose one to see what it opens.",
        "ring": "Quick Access shortcuts",
        "play": "Play tour",
        "pause": "Pause tour",
        "soon": "Coming in a future update. Not part of the first release.",
        "soonShort": "coming in a future update",
        "gallery": "Browse the app gallery below",
        "around": "Around them on the home screen: prayer times and reminders calculated on your phone, and an optional daily challenge.",
        "features": {
            "quran": ("Qur’an", "The Noble Qur’an",
                      "Read the full Uthmani text with an English translation, right inside the app.",
                      ["Bookmarks and your reading progress",
                       "Recitation from a choice of reciters",
                       "Tafsir loads when you open it"]),
            "adhkar": ("Adhkar", "Adhkar",
                       "Morning and evening adhkar from Hisn al-Muslim, with a daily wird to keep.",
                       ["Also for sleep, waking, after prayer, home and travel",
                        "Your progress stays on your device",
                        "Works offline"]),
            "dua": ("Du’a", "Du’a",
                    "Du’as gathered by theme, with translation and audio.",
                    ["From the Qur’an and the Sunnah, and for provision, healing, worry, travel, family and forgiveness",
                     "Works offline"]),
            "qibla": ("Qibla", "Qibla",
                      "The direction of the Ka’bah and your distance from it, worked out on your device.",
                      ["A compass that follows your phone’s orientation",
                       "Optional live location"]),
            "saved": ("Saved", "Saved",
                      "Bookmark a verse, du’a or dhikr to come back to it. Everything you bookmark waits on one page.",
                      ["Tap the bookmark on any verse, du’a or dhikr",
                       "Filter by verses, du’as or adhkar"]),
            "favorites": ("Favorites", "Favorites",
                          "Mark the verses, du’as and adhkar you love with a heart, and find them together.",
                          ["Tap the heart on any verse, du’a or dhikr",
                           "Kept apart from what you bookmark in Saved"]),
            "umrah": ("Umrah", "Umrah Savings",
                      "Set a savings goal for Umrah and see what you have put aside, what remains and how many days are left.",
                      ["Calculated only from the amounts you enter",
                       "Holds no money and connects to no bank"]),
            "ramadan": ("Ramadan", "Ramadan Planner",
                        "Each day of Ramadan at a glance: Suhoor and Iftar from your prayer times, a countdown and five acts of worship.",
                        ["A du’a for each day",
                         "An Eid countdown from the Hijri calendar, shown as an estimate"]),
        },
    },
    "ar": {
        "title": "بلمسة من الشاشة الرئيسية",
        "note": "ثمانية اختصارات على الشاشة الرئيسية في زُلْفَى. اختر واحدًا لترى ما يفتحه.",
        "ring": "اختصارات الوصول السريع",
        "play": "تشغيل الجولة",
        "pause": "إيقاف الجولة",
        "soon": "يصل في تحديث قادم، وليس ضمن الإصدار الأول.",
        "soonShort": "يصل في تحديث قادم",
        "gallery": "تصفّح معرض التطبيق أدناه",
        "around": "وحولها في الشاشة الرئيسية: مواقيت الصلاة والتذكيرات تُحسب على هاتفك، وتحدٍّ يومي اختياري.",
        "features": {
            "quran": ("القرآن", "القرآن الكريم",
                      "اقرأ النص العثماني كاملًا مع ترجمة إنجليزية، داخل التطبيق نفسه.",
                      ["العلامات وتقدّم القراءة",
                       "تلاوة بصوت القارئ الذي تختاره",
                       "التفسير يُحمَّل عند فتحه"]),
            "adhkar": ("الأذكار", "الأذكار",
                       "أذكار الصباح والمساء من حصن المسلم، مع وِردٍ يومي تحافظ عليه.",
                       ["وأذكار النوم والاستيقاظ وبعد الصلاة والمنزل والسفر",
                        "يبقى تقدّمك على جهازك",
                        "تعمل دون اتصال"]),
            "dua": ("الأدعية", "الأدعية",
                    "أدعية مرتّبة حسب الموضوع، مع الترجمة والصوت.",
                    ["من القرآن والسنة، وللرزق والشفاء والهمّ والسفر والأسرة والاستغفار",
                     "تعمل دون اتصال"]),
            "qibla": ("القبلة", "القبلة",
                      "اتجاه الكعبة والمسافة بينك وبينها، يُحسبان على جهازك.",
                      ["بوصلة تتبع اتجاه هاتفك",
                       "موقع مباشر اختياري"]),
            "saved": ("المحفوظات", "المحفوظات",
                      "احفظ آيةً أو دعاءً أو ذكرًا لتعود إليه، فتجد كل ما حفظته في صفحة واحدة.",
                      ["اضغط علامة الحفظ على أي آية أو دعاء أو ذكر",
                       "اعرضها حسب الآيات أو الأدعية أو الأذكار"]),
            "favorites": ("المفضلة", "المفضلة",
                          "ضع قلبًا على الآيات والأدعية والأذكار التي تحبها، وتجدها مجتمعة.",
                          ["اضغط القلب على أي آية أو دعاء أو ذكر",
                           "منفصلة عمّا تحفظه في المحفوظات"]),
            "umrah": ("العمرة", "ادخار العمرة",
                      "حدّد هدفًا لادخار العمرة، وتابع ما جمعته وما تبقّى وكم يومًا بقي.",
                      ["يُحسب من المبالغ التي تُدخلها وحدها",
                       "لا يحتفظ بأي أموال ولا يتصل بأي بنك"]),
            "ramadan": ("رمضان", "مخطط رمضان",
                        "كل يوم من رمضان في نظرة: السحور والإفطار من مواقيت صلاتك، وعدّ تنازلي، وخمس عبادات.",
                        ["دعاء لكل يوم",
                         "عدّ تنازلي للعيد من التقويم الهجري، تقديريًا"]),
        },
    },
    "nl": {
        "title": "Eén tik vanaf het startscherm",
        "note": "Op het startscherm van ZULFAA staan acht snelkoppelingen. Kies er een en zie wat die opent.",
        "ring": "Snelkoppelingen in Snelle toegang",
        "play": "Rondleiding starten",
        "pause": "Rondleiding pauzeren",
        "soon": "Komt in een volgende update, niet in de eerste versie.",
        "soonShort": "komt in een volgende update",
        "gallery": "Bekijk de app-galerij hieronder",
        "around": "Eromheen op het startscherm: gebedstijden en herinneringen, berekend op uw telefoon, en een optionele dagelijkse uitdaging.",
        "features": {
            "quran": ("Koran", "De Nobele Koran",
                      "Lees de volledige Uthmani-tekst met een Engelse vertaling, gewoon in de app.",
                      ["Bladwijzers en uw leesvoortgang",
                       "Recitatie door een reciteur naar keuze",
                       "Tafsir laadt wanneer u die opent"]),
            "adhkar": ("Adhkar", "Adhkar",
                       "Ochtend- en avond-adhkar uit Hisn al-Muslim, met een dagelijkse wird om bij te houden.",
                       ["Ook voor slapen, ontwaken, na het gebed, thuis en op reis",
                        "Uw voortgang blijft op uw apparaat",
                        "Werkt offline"]),
            "dua": ("Doe’a", "Doe’a",
                    "Doe’a’s geordend per thema, met vertaling en audio.",
                    ["Uit de Koran en de Soenna, en voor levensonderhoud, genezing, zorgen, reizen, gezin en vergeving",
                     "Werkt offline"]),
            "qibla": ("Qibla", "Qibla",
                      "De richting van de Ka’bah en uw afstand ertoe, berekend op uw apparaat.",
                      ["Een kompas dat de stand van uw telefoon volgt",
                       "Optioneel met live locatie"]),
            "saved": ("Opgeslagen", "Opgeslagen",
                      "Sla een vers, doe’a of dhikr op om er later naar terug te gaan. Alles wat u opslaat staat op één pagina.",
                      ["Tik op de bladwijzer bij een vers, doe’a of dhikr",
                       "Filter op verzen, doe’a’s of adhkar"]),
            "favorites": ("Favorieten", "Favorieten",
                          "Markeer de verzen, doe’a’s en adhkar die u dierbaar zijn met een hart, en vind ze bij elkaar.",
                          ["Tik op het hart bij een vers, doe’a of dhikr",
                           "Los van wat u met een bladwijzer opslaat"]),
            "umrah": ("Umrah", "Umrah-sparen",
                      "Stel een spaardoel voor de umrah en zie wat u opzij hebt gezet, wat er nog ontbreekt en hoeveel dagen er resten.",
                      ["Alleen berekend uit de bedragen die u invoert",
                       "Beheert geen geld en is aan geen enkele bank gekoppeld"]),
            "ramadan": ("Ramadan", "Ramadanplanner",
                        "Elke ramadandag in één oogopslag: suhoor en iftar uit uw gebedstijden, een aftelling en vijf daden van aanbidding.",
                        ["Een doe’a voor elke dag",
                         "Aftellen naar het Suikerfeest volgens de Hijri-kalender, als schatting"]),
        },
    },
}

PLAY_SVG = ('<svg class="qa-i-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">'
            '<path d="M8 5.6v12.8c0 .8.9 1.3 1.6.9l10-6.4a1 1 0 0 0 0-1.8l-10-6.4C8.9 4.3 8 4.8 8 5.6Z"/></svg>')
PAUSE_SVG = ('<svg class="qa-i-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">'
             '<rect x="6.5" y="5" width="3.6" height="14" rx="1.2"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.2"/></svg>')


def esc(s):
    return html.escape(s, quote=True)


def _pt(r, deg):
    t = math.radians(deg)
    return 50 + r * math.sin(t), 50 - r * math.cos(t)


def _line(r0, r1, deg):
    x0, y0 = _pt(r0, deg)
    x1, y1 = _pt(r1, deg)
    return '<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f"/>' % (x0, y0, x1, y1)


def face():
    """The dial face: static SVG, drawn once here rather than by script.

    Outer: a double gold hairline bezel with fine 5-degree marks between the
    lines and a longer gold mark at each of the eight sticker positions; at the
    top a short gold arc and the fixed marker, which is where a chosen sticker
    comes to rest. Inner: two concentric rings around the centre disc, joined
    by eight short radial bars that point at the eight positions. No dashes and
    no gaps anywhere, so at rest it reads as an instrument, never a spinner."""
    minor = "".join(_line(46.9, 48.4, d) for d in range(0, 360, 5) if d % 45)
    major = "".join(_line(46.2, 49.0, d) for d in range(45, 360, 45))
    bars = "".join(_line(18.2, 19.6, d) for d in range(0, 360, 45))
    ax, ay = _pt(49, -9)
    bx, by = _pt(49, 9)
    return ('<svg class="qa-face" viewBox="0 0 100 100" aria-hidden="true" focusable="false">'
            '<circle class="qa-bz" cx="50" cy="50" r="49"/>'
            '<circle class="qa-bz2" cx="50" cy="50" r="46.2"/>'
            '<g class="qa-tk">%s</g>'
            '<g class="qa-tk8">%s</g>'
            '<path class="qa-arc" d="M%.2f %.2fA49 49 0 0 1 %.2f %.2f"/>'
            '<circle class="qa-r2" cx="50" cy="50" r="19.6"/>'
            '<circle class="qa-r1" cx="50" cy="50" r="18.2"/>'
            '<g class="qa-dv">%s</g>'
            '<path class="qa-mk" d="M50 4.3 48.4 0.8H51.6Z"/>'
            '</svg>') % (minor, major, ax, ay, bx, by, bars)


def _art(a, fid, big):
    """(src, srcset, intrinsic width) for a ring sticker or the centre one."""
    if fid in VECTOR:
        return "%sassets/quick-access/%s.svg" % (a, fid), "", 48
    sizes = RASTER_SIZES.get(fid, DEFAULT_SIZES)
    pool = sizes[1:] if big else sizes[:2]
    srcset = ", ".join("%sassets/quick-access/%s-%d.webp %dw" % (a, fid, w, w) for w in pool)
    return "%sassets/quick-access/%s-%d.webp" % (a, fid, pool[0]), srcset, pool[-1]


def _kind(fid):
    return "vector" if fid in VECTOR else ("dua" if fid == "dua" else "raster")


def render(lang, a=""):
    T = QA[lang]
    sign = -1 if lang == "ar" else 1
    first = ORDER[0]

    nodes = []
    panels = []
    for i, fid in enumerate(ORDER):
        tile, name, line, facts = T["features"][fid]
        src, srcset, w = _art(a, fid, False)
        bsrc, bsrcset, _ = _art(a, fid, True)
        img = '<img src="%s"%s width="%d" height="%d" alt="" loading="lazy" decoding="async" />' % (
            src, (' srcset="%s" sizes="3.5rem"' % srcset) if srcset else "", w, w)
        soon_vh = ('<span class="vh"> (%s)</span>' % esc(T["soonShort"])) if fid in UPCOMING else ""
        nodes.append(
            '                  <a class="qa-node%s" href="#qa-%s" id="qa-tab-%s" style="--a: %ddeg"'
            ' data-kind="%s" data-big="%s" data-big-srcset="%s">\n'
            '                    %s\n'
            '                    <span class="qa-label">%s</span>%s\n'
            '                  </a>'
            % (" is-selected" if fid == first else "", fid, fid, sign * i * 45,
               _kind(fid), bsrc, bsrcset, img, esc(tile), soon_vh))

        items = "\n".join("                <li>%s</li>" % esc(f) for f in facts)
        panels.append(
            '            <article class="qa-panel%s" id="qa-%s">\n'
            '%s'
            '              <h3>%s</h3>\n'
            '              <p class="qa-line">%s</p>\n'
            '              <ul class="qa-facts">\n%s\n              </ul>\n'
            '              <a class="qa-more" href="#showcase-title">%s</a>\n'
            '            </article>'
            % (" is-active" if fid == first else "", fid,
               ('              <p class="qa-soon">%s</p>\n' % esc(T["soon"])) if fid in UPCOMING else "",
               esc(name), esc(line), items, esc(T["gallery"])))

    bsrc, bsrcset, _ = _art(a, first, True)
    big = ('<img class="qa-big" src="%s" srcset="%s" sizes="(max-width: 56rem) 6.2rem, 7.6rem"'
           ' width="512" height="512" alt="" decoding="async" data-kind="%s" />' % (bsrc, bsrcset, _kind(first)))

    return (
        '        <!-- quick-access:start -->\n'
        '        <section class="qa" aria-labelledby="features" data-qa>\n'
        '          <div class="qa-head">\n'
        '            <h2 class="qa-title" id="features">%s</h2>\n'
        '            <p class="qa-note">%s</p>\n'
        '          </div>\n'
        '          <div class="qa-body">\n'
        '            <div class="qa-dial-col">\n'
        '              <div class="qa-dial-box">\n'
        '                <div class="qa-dial">\n'
        '                  %s\n'
        '                  <div class="qa-center" aria-hidden="true">%s</div>\n'
        '                  <div class="qa-ring" data-label="%s">\n'
        '%s\n'
        '                  </div>\n'
        '                </div>\n'
        '              </div>\n'
        '              <div class="qa-tour" hidden>\n'
        '                <button class="qa-play" type="button" aria-pressed="false" data-play="%s" data-pause="%s">'
        '%s%s<span class="qa-play-label">%s</span></button>\n'
        '              </div>\n'
        '            </div>\n'
        '            <div class="qa-panels">\n'
        '%s\n'
        '            </div>\n'
        '          </div>\n'
        '          <p class="qa-around">%s</p>\n'
        '        </section>\n'
        '        <!-- quick-access:end -->'
        % (esc(T["title"]), esc(T["note"]), face(), big, esc(T["ring"]), "\n".join(nodes),
           esc(T["play"]), esc(T["pause"]), PLAY_SVG, PAUSE_SVG, esc(T["play"]),
           "\n".join(panels), esc(T["around"])))


def write_en():
    from chrome import SITE, asset
    path = os.path.join(SITE, "index.html")
    t = open(path, encoding="utf-8").read()
    block = render("en", "") + "\n"
    marked = re.compile(r"        <!-- quick-access:start -->.*?<!-- quick-access:end -->\n", re.S)
    legacy = re.compile(r'        <section class="band" aria-labelledby="features">.*?</section>\n', re.S)
    if marked.search(t):
        out = marked.sub(lambda m: block, t, count=1)
    else:
        assert legacy.search(t), "no features section in index.html"
        out = legacy.sub(lambda m: block, t, count=1)
    tag = '    <script src="%s" defer></script>\n' % asset("assets/quick-access.js")
    if "assets/quick-access.js" in out:
        out = re.sub(r'    <script src="[^"]*assets/quick-access\.js[^"]*" defer></script>\n', lambda m: tag, out)
    else:
        m = re.search(r'    <script src="[^"]*assets/carousel\.js[^"]*" defer></script>\n', out)
        assert m, "no carousel.js script tag in index.html"
        out = out[:m.start()] + tag + out[m.start():]
    if out != t:
        open(path, "w", encoding="utf-8", newline="").write(out)
        print("wrote index.html (quick-access section)")
    else:
        print("index.html already current")


if __name__ == "__main__":
    if "--write-en" in sys.argv:
        write_en()
    else:
        print(__doc__)
