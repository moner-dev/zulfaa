# -*- coding: utf-8 -*-
"""The Updates Oasis page's own furniture, in the three languages.

Release CONTENT never lives here - it lives in tools/releases/*.json. This file
holds the words the page says about itself: its headings, its status labels, the
names of the nine feature areas, and the month names the dates are rendered
with.

The three languages are equals. Arabic is not a translation of English: it is
one of three first-class versions, it is right to left, and its dates carry
Arabic-Indic digits, as the app's own screens do.
"""

# ── the page ────────────────────────────────────────────────────────────────
U = {}

U["en"] = {
    "title": "Updates — ZULFAA",
    "desc": "What has changed in ZULFAA, and what is on the way: every release, "
            "in plain language, with what is available today told apart from what is not.",
    "nav": "Updates",
    "eyebrow": "ZULFAA",
    "h1": "Updates",
    "lede": "What has changed in ZULFAA, told the way you would notice it rather than the "
            "way it was built. Every release stays here.",

    "latestTitle": "Latest update",
    "availableNow": "Available now",
    "onTheWayTitle": "On the way",
    "notReleasedYet": "Not released yet",
    "notReleasedNote": "This update has been submitted to Google Play and is waiting for "
                       "review. It has not been distributed, so nothing below is on "
                       "anyone's phone yet.",
    "proposed": "proposed",
    "dateUnknown": "No date set",
    "datePending": "exact publish date pending",
    "readMore": "Read what changed",

    "journeyTitle": "The journey",
    "journeyNote": "Every ZULFAA release, newest first. Each one keeps its own address, so a "
                   "link to it will still work after ten more updates.",
    "launch": "Launch",
    "update": "Update %s",
    "version": "Version",
    "changesTitle": "What changed",
    "worthTitle": "Worth knowing",
    "pendingTitle": "Still being written",
    "pendingNote": "Named here so its absence is visible rather than accidental.",
    "highlightsTitle": "A look at it",
    "screenshotOf": "Shown in the app's %s interface.",

    "filterLabel": "Show",
    "filterAll": "Everything",
    "filterNone": "Nothing in this release touched that part of the app.",

    "footTitle": "How versions work",
    "footNote": "The version number on this page is the one your device shows under Profile. "
                "A release appears here only once it has actually been distributed; anything "
                "still to come is marked as such and carries no date.",
    "footReport": "Found something wrong? Tell us on the support page.",
    "supportLink": "Support",

    "kinds": {"new": "New", "improved": "Improved", "changed": "Works differently",
              "fixed": "Fixed", "removed": "Removed"},
    "notes": {"behaviour": "How it behaves", "privacy": "Your data",
              "requirement": "What you need"},
    "areas": {
        "quran": "Qur'an", "prayer": "Prayer", "ramadan": "Ramadan", "umrah": "Umrah",
        "dhikr": "Dhikr", "challenge": "Daily Challenge", "profile": "Profile & Settings",
        "app": "Across the app", "legal": "Privacy & legal",
    },
    "months": ["January", "February", "March", "April", "May", "June",
               "July", "August", "September", "October", "November", "December"],
    "dateDay": "%(d)s %(m)s %(y)s",
    "dateMonth": "%(m)s %(y)s",
    # ── V1 editorial layout ─────────────────────────────────────────────
    "releasesLabel": "Releases",
    "pickRelease": "Choose a release",
    "sectionsLabel": "In this release",
    "overview": "Overview",
    "inThisUpdate": "In this update",
    "whatItHeld": "What the first ZULFAA contained",
    "viewAll": "View all %(area)s changes (%(n)s)",
    "hideAll": "Hide the full list",
    "keyChanges": "The changes that matter most",
    "testersOnly": "Available to testers only",
    "track": {"production": "Released on Google Play", "open-testing": "Open testing",
              "closed-testing": "Closed testing — Alpha", "internal-testing": "Internal testing"},
    "trackShort": {"production": "Released", "open-testing": "Open testing",
                   "closed-testing": "Closed testing", "internal-testing": "Internal"},
    "upcomingShort": "Upcoming",
    "navAreas": {"app": "Experience", "legal": "Privacy", "profile": "Profile",
                 "challenge": "Challenge"},
    "readInFull": "Read these in full",
    "viewAllArea": {"app": "View all changes across the app (%(n)s)"},
    "langName": {"en": "English", "ar": "Arabic", "nl": "Dutch"},
}

U["ar"] = {
    "title": "التحديثات — زُلْفَى",
    "desc": "ما الذي تغيّر في زُلْفَى وما هو في الطريق: كل إصدار بلغة واضحة، مع تمييز بيّن بين "
            "ما هو متاح اليوم وما ليس كذلك.",
    "nav": "التحديثات",
    "eyebrow": "زُلْفَى",
    "h1": "التحديثات",
    "lede": "ما الذي تغيّر في زُلْفَى، مرويًّا كما تلاحظه أنت لا كما بُني. وكل إصدار يبقى هنا.",

    "latestTitle": "آخر تحديث",
    "availableNow": "متاح الآن",
    "onTheWayTitle": "في الطريق",
    "notReleasedYet": "لم يصدر بعد",
    "notReleasedNote": "قُدِّم هذا التحديث إلى Google Play وهو ينتظر المراجعة. ولم يُوزَّع بعد، فما دونه ليس على هاتف أحد.",
    "proposed": "مقترح",
    "dateUnknown": "لا تاريخ محدَّد",
    "datePending": "تاريخ النشر الدقيق قيد التأكّد",
    "readMore": "اقرأ ما الذي تغيّر",

    "journeyTitle": "المسير",
    "journeyNote": "كل إصدارات زُلْفَى، الأحدث أوّلًا. ولكلٍّ عنوانه الخاص الذي لا يتغيّر، فالرابط "
                   "إليه يظلّ عاملًا بعد عشرة تحديثات أخرى.",
    "launch": "الإطلاق",
    "update": "التحديث %s",
    "version": "الإصدار",
    "changesTitle": "ما الذي تغيّر",
    "worthTitle": "ممّا يحسن أن تعرفه",
    "pendingTitle": "ما يزال يُكتب",
    "pendingNote": "ذُكر هنا ليكون غيابه ظاهرًا لا عَرَضيًّا.",
    "highlightsTitle": "نظرة عليه",
    "screenshotOf": "من واجهة التطبيق %s.",

    "filterLabel": "أظهِر",
    "filterAll": "كل شيء",
    "filterNone": "لا شيء في هذا الإصدار يمسّ ذلك الجزء من التطبيق.",

    "footTitle": "كيف تعمل الإصدارات",
    "footNote": "رقم الإصدار في هذه الصفحة هو نفسه الذي يعرضه جهازك في «مساحتك». ولا يظهر إصدار "
                "هنا إلا بعد أن يُوزَّع فعلًا؛ وما يزال في الطريق يُوسَم بذلك ولا يحمل تاريخًا.",
    "footReport": "وجدت خطأً؟ أخبرنا من صفحة الدعم.",
    "supportLink": "الدعم",

    "kinds": {"new": "جديد", "improved": "تحسين", "changed": "صار يعمل بشكل مختلف",
              "fixed": "إصلاح", "removed": "أُزيل"},
    "notes": {"behaviour": "كيف يتصرّف", "privacy": "بياناتك", "requirement": "ما تحتاج إليه"},
    "areas": {
        "quran": "القرآن الكريم", "prayer": "الصلاة", "ramadan": "رمضان", "umrah": "العمرة",
        "dhikr": "الأذكار", "challenge": "تحدّي اليوم", "profile": "مساحتك والإعدادات",
        "app": "في التطبيق كلّه", "legal": "الخصوصية والوثائق",
    },
    "months": ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
               "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
    "dateDay": "%(d)s %(m)s %(y)s",
    "dateMonth": "%(m)s %(y)s",
    # ── V1 editorial layout ─────────────────────────────────────────────
    "releasesLabel": "الإصدارات",
    "pickRelease": "اختر إصدارًا",
    "sectionsLabel": "في هذا الإصدار",
    "overview": "نظرة عامة",
    "inThisUpdate": "في هذا التحديث",
    "whatItHeld": "ما الذي حمله أول زُلْفَى",
    "viewAll": "اعرض كل تغييرات %(area)s (%(n)s)",
    "hideAll": "أخفِ القائمة الكاملة",
    "keyChanges": "أهمّ ما تغيّر",
    "testersOnly": "متاح للمختبِرين فقط",
    "track": {"production": "صدر على Google Play", "open-testing": "اختبار مفتوح",
              "closed-testing": "اختبار مغلق — ألفا", "internal-testing": "اختبار داخلي"},
    "trackShort": {"production": "صدر", "open-testing": "اختبار مفتوح",
                   "closed-testing": "اختبار مغلق", "internal-testing": "داخلي"},
    "upcomingShort": "قادم",
    "navAreas": {"app": "التجربة", "legal": "الخصوصية", "profile": "مساحتك",
                 "challenge": "التحدّي"},
    "readInFull": "اقرأها كاملة",
    "viewAllArea": {"app": "اعرض كل التغييرات في التطبيق كلّه (%(n)s)"},
    "langName": {"en": "الإنجليزية", "ar": "العربية", "nl": "الهولندية"},
}

U["nl"] = {
    "title": "Updates — ZULFAA",
    "desc": "Wat er in ZULFAA is veranderd en wat eraan komt: elke uitgave in gewone taal, "
            "met duidelijk onderscheid tussen wat vandaag beschikbaar is en wat niet.",
    "nav": "Updates",
    "eyebrow": "ZULFAA",
    "h1": "Updates",
    "lede": "Wat er in ZULFAA is veranderd, verteld zoals u het merkt en niet zoals het is "
            "gebouwd. Elke uitgave blijft hier staan.",

    "latestTitle": "Laatste update",
    "availableNow": "Nu beschikbaar",
    "onTheWayTitle": "Onderweg",
    "notReleasedYet": "Nog niet uitgebracht",
    "notReleasedNote": "Deze update is ingediend bij Google Play en wacht op beoordeling. "
                       "Hij is niet verspreid, dus niets hieronder staat al op iemands "
                       "telefoon.",
    "proposed": "voorgesteld",
    "dateUnknown": "Geen datum vastgesteld",
    "datePending": "exacte publicatiedatum nog te bevestigen",
    "readMore": "Lees wat er is veranderd",

    "journeyTitle": "De route",
    "journeyNote": "Elke uitgave van ZULFAA, de nieuwste eerst. Elk houdt zijn eigen adres, "
                   "zodat een link ernaartoe ook na tien updates nog werkt.",
    "launch": "Lancering",
    "update": "Update %s",
    "version": "Versie",
    "changesTitle": "Wat er is veranderd",
    "worthTitle": "Goed om te weten",
    "pendingTitle": "Wordt nog geschreven",
    "pendingNote": "Hier genoemd zodat het ontbreken ervan zichtbaar is en niet per ongeluk.",
    "highlightsTitle": "Een blik erop",
    "screenshotOf": "Getoond in de %se versie van de app.",

    "filterLabel": "Toon",
    "filterAll": "Alles",
    "filterNone": "Niets in deze uitgave raakt dat deel van de app.",

    "footTitle": "Hoe versies werken",
    "footNote": "Het versienummer op deze pagina is hetzelfde dat uw toestel onder Uw ruimte "
                "toont. Een uitgave verschijnt hier pas wanneer zij werkelijk is verspreid; "
                "wat nog komt, staat als zodanig gemarkeerd en draagt geen datum.",
    "footReport": "Iets gevonden dat niet klopt? Laat het ons weten via de ondersteuningspagina.",
    "supportLink": "Ondersteuning",

    "kinds": {"new": "Nieuw", "improved": "Beter", "changed": "Werkt anders",
              "fixed": "Opgelost", "removed": "Verwijderd"},
    "notes": {"behaviour": "Hoe het zich gedraagt", "privacy": "Uw gegevens",
              "requirement": "Wat u nodig hebt"},
    "areas": {
        "quran": "Koran", "prayer": "Gebed", "ramadan": "Ramadan", "umrah": "Umrah",
        "dhikr": "Dhikr", "challenge": "Dagelijkse uitdaging", "profile": "Profiel & instellingen",
        "app": "Door de hele app", "legal": "Privacy & documenten",
    },
    "months": ["januari", "februari", "maart", "april", "mei", "juni",
               "juli", "augustus", "september", "oktober", "november", "december"],
    "dateDay": "%(d)s %(m)s %(y)s",
    "dateMonth": "%(m)s %(y)s",
    # ── V1 editorial layout ─────────────────────────────────────────────
    "releasesLabel": "Uitgaven",
    "pickRelease": "Kies een uitgave",
    "sectionsLabel": "In deze uitgave",
    "overview": "Overzicht",
    "inThisUpdate": "In deze update",
    "whatItHeld": "Wat de eerste ZULFAA bevatte",
    "viewAll": "Alle wijzigingen in %(area)s bekijken (%(n)s)",
    "hideAll": "Volledige lijst verbergen",
    "keyChanges": "De veranderingen die er het meest toe doen",
    "testersOnly": "Alleen beschikbaar voor testers",
    "track": {"production": "Uitgebracht op Google Play", "open-testing": "Open test",
              "closed-testing": "Besloten test — Alpha", "internal-testing": "Interne test"},
    "trackShort": {"production": "Uitgebracht", "open-testing": "Open test",
                   "closed-testing": "Besloten test", "internal-testing": "Intern"},
    "upcomingShort": "Verwacht",
    "navAreas": {"app": "Ervaring", "legal": "Privacy", "profile": "Profiel",
                 "challenge": "Uitdaging"},
    "readInFull": "Lees ze volledig",
    "viewAllArea": {"app": "Alle wijzigingen door de hele app bekijken (%(n)s)"},
    "langName": {"en": "Engels", "ar": "Arabisch", "nl": "Nederlands"},
}

# ── the area vocabulary ─────────────────────────────────────────────────────
# One icon per area, defined once and reused by the hero's headline chips, the
# change cards and the archive filter, so that a reader learns it once.
#
# Deliberately NOT one accent colour per area. Nine accents on a cream page
# would be a rainbow, and ZULFAA's palette is teal, gold and cream. The icon
# carries the area; the small kind word above a card carries new / fixed /
# changed; gold is spent only on what is genuinely new.
AREA_ICON = {
    # an open book
    "quran": '<path d="M4 5.2A2.2 2.2 0 0 1 6.2 3H19v15H6.2A2.2 2.2 0 0 0 4 20.2Z"/>'
             '<path d="M19 18v3H6.2A2.2 2.2 0 0 1 4 18.8"/>',
    # a mihrab arch
    "prayer": '<path d="M6 21V11a6 6 0 0 1 12 0v10"/><path d="M4 21h16"/>'
              '<path d="M12 8.5v3"/>',
    # a crescent with a star
    "ramadan": '<path d="M17.5 15.5A7 7 0 0 1 9 5.2a7.5 7.5 0 1 0 8.5 10.3Z"/>'
               '<path d="M18 4.2v3M16.5 5.7h3"/>',
    # a path towards a destination
    "umrah": '<path d="M5 20h14"/><path d="M8 20V9.5L12 6l4 3.5V20"/><path d="M12 20v-4"/>',
    # prayer beads
    "dhikr": '<circle cx="12" cy="5" r="2"/><circle cx="18.4" cy="9.6" r="2"/>'
             '<circle cx="16" cy="17.2" r="2"/><circle cx="8" cy="17.2" r="2"/>'
             '<circle cx="5.6" cy="9.6" r="2"/>',
    # a question mark in a ring
    "challenge": '<circle cx="12" cy="12" r="9"/>'
                 '<path d="M9.6 9.2a2.5 2.5 0 1 1 3 2.5v1.4"/><path d="M12.6 16.4h-.01"/>',
    # a person
    "profile": '<circle cx="12" cy="8" r="3.4"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/>',
    # the eight-point star, the app's own geometry
    "app": '<path d="M12 3.2 14.4 7 18.6 5.4 17 9.6l3.8 2.4-3.8 2.4 1.6 4.2-4.2-1.6L12 20.8 '
           '9.6 17l-4.2 1.6L7 14.4 3.2 12 7 9.6 5.4 5.4 9.6 7Z"/>',
    # a shield
    "legal": '<path d="M12 3.2 19 6v5.5c0 4.2-2.9 7.6-7 9.3-4.1-1.7-7-5.1-7-9.3V6Z"/>'
             '<path d="m9.2 12 2 2 3.6-3.8"/>',
}

ICON = ('<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" '
        'aria-hidden="true">%s</svg>')

# The order areas are grouped in on a release. Not alphabetical in any language:
# it runs from the acts of worship outwards to the app's furniture and its
# documents, which is the order a reader cares about them in.
AREA_ORDER = ["quran", "prayer", "ramadan", "umrah", "dhikr", "challenge",
              "profile", "app", "legal"]

# Within an area, what is new comes first and what was taken away comes last.
KIND_ORDER = {"new": 0, "improved": 1, "changed": 2, "fixed": 3, "removed": 4}
