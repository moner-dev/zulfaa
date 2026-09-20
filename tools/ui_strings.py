# -*- coding: utf-8 -*-
"""Site chrome for the ar / nl subtrees.

Legal text is NEVER here - it comes from the app via content.json. This file
holds only navigation, headings and marketing copy, plus the small, mechanical
substitutions that move a clause's point of view from "inside the app" to "on
the website" without touching a word of its substance.
"""

LANGS = {
    "en": {"name": "English", "dir": "ltr", "base": ""},
    "ar": {"name": "العربية", "dir": "rtl", "base": "ar/"},
    "nl": {"name": "Nederlands", "dir": "ltr", "base": "nl/"},
}

# Deixis-only rewrites. Each is a plain substring swap on the app's own wording:
# the clause is otherwise byte-identical to what the app renders.
DEIXIS = {
    "ar": [
        ("أسفل هذه الصفحة",
         "أسفل صفحة الخصوصية داخل التطبيق"),
        ("منشورة أيضًا علنًا على الموقع الرسمي لزُلْفَى",
         "معروضة أيضًا بالكامل داخل التطبيق"),
    ],
    "nl": [
        ("onderaan deze pagina", "onderaan de privacypagina in de app"),
        ("staat ook openbaar op de officiële ZULFAA-website",
         "wordt ook volledig in de app getoond"),
    ],
    "en": [],
}

S = {}

# ─────────────────────────── ENGLISH (header chrome only) ───────────────────
# The English pages are the hand-written originals. build.py re-renders only
# their <header> - the menu button and the language menu - from these strings
# and from the links already in each page. No other English text lives here.
S["en"] = {
    "navLabel": "Primary",
    "langLabel": "Language",
    "langPrefix": "Language: ",
    "langShort": "EN",
    "playSoon": "Coming soon to Google Play",
    "ghLabel": "ZULFAA on GitHub",
    "topNote": "The first Android release is in preparation.",
    "menuLabel": "Menu",
    "closeLabel": "Close menu",
    # The footer and the journal are generated for all three languages, so
    # English needs these too. Every value is the wording the hand-written
    # English pages already carried, so nothing about them changes.
    "home": "Home",
    "deleteNav": "Data deletion",
    "navSupport": "Support",
    "footerLabel": "Footer",
    "devBy": "ZULFAA is designed and developed by",
    "rights": "© 2026 MONER INTELLIGENCE SYSTEMS. All rights reserved.",
    # The screenshot carousel and its preview are generated for all three
    # languages too (tools/showcase.py). The wording is the English page's own,
    # except the note, which no longer counts the images and says whose theme
    # they follow.
    "showEyebrow": "Inside the app",
    "showTitle": "A calm place to return to",
    "showNote": "ZULFAA on Android — the Qur'an, the qibla, adhkar, the daily challenge and more, shown in the theme you choose for this site.",
    "hint": "Swipe, drag or use the arrows — the arrow keys work too.",
    "prevShot": "Previous screenshot",
    "nextShot": "Next screenshot",
    "shotsLabel": "ZULFAA app screenshots",
    "zoomLabel": "Open the %s screenshot full size",
    "lbTitle": "Screenshot preview",
    "lbClose": "Close preview",
    # The primary navigation, the same four destinations on every page and in
    # the drawer (chrome.primary_nav). Privacy, Terms and Data deletion live in
    # the footer's Legal group.
    "skipToContent": "Skip to content",
    "pnStart": "Start",
    "pnUpdates": "Updates",
    "pnSupport": "Support",
    "pnContact": "Contact",
    # The text alternative for the one shared preview image, assets/og.png.
    # This is the English wording the hand-written homepage already carries
    # (audit H-07), kept here so the generated English page - /updates/ - can
    # describe the same image with the same approved words. One image, one
    # description per language; see chrome.head().
    "ogImageAlt": "The ZULFAA emblem: a gold-framed teal medallion with the name ZULFAA.",
}

# ─────────────────────────── ARABIC ───────────────────────────
S["ar"] = {
    "skip": "تخطّي إلى المحتوى",
    "navLabel": "التنقل الرئيسي",
    "skipToContent": "انتقل إلى المحتوى",
    "pnStart": "الرئيسية",
    "pnUpdates": "التحديثات",
    "pnSupport": "الدعم",
    "pnContact": "تواصل معنا",
    "footerLabel": "روابط التذييل",
    "langLabel": "اللغة",
    "langPrefix": "اللغة: ",
    "langShort": "عربي",
    "playSoon": "قريبًا على Google Play",
    "ghLabel": "زُلْفَى على GitHub",
    "heroTitle": "يومُك مع العبادة، في مكان واحد هادئ",
    "heroLead": "مواقيت الصلاة والقرآن الكريم والأذكار واتجاه القبلة، تُحسب على جهازك ومعظمها يعمل دون اتصال.",
    "ctaNotify": "أخبِرني عند الإطلاق",
    "ctaInside": "شاهِد داخل التطبيق",
    "heroTrust": "لا إعلانات ولا تتبّع عبر المواقع.",
    "themeLabel": "الوضع الداكن",
    "dayLabel": "نهار",
    "nightLabel": "ليل",
    "motionPause": "إيقاف حركة الهاتف مؤقتًا",
    "dragHint": "اسحب لتدوير الهاتف",
    "shownDark": "الوضع الداكن معروض",
    "shownLight": "الوضع الفاتح معروض",
    "shotAlt": "الشاشة الرئيسية في زُلْفَى: التحية، والعدّ إلى الصلاة القادمة، وتحدّي اليوم، والوصول السريع.",
    "topNote": "الإصدار الأوّل على أندرويد قيد التحضير.",
    "menuLabel": "القائمة",
    "closeLabel": "إغلاق القائمة",
    "home": "الرئيسية",
    "deleteNav": "حذف البيانات",
    "devBy": "زُلْفَى من تصميم وتطوير",
    "rights": "© ٢٠٢٦ MONER INTELLIGENCE SYSTEMS. جميع الحقوق محفوظة.",
    "contents": "المحتويات",
    "inShort": "باختصار",
    # home
    "homeTitle": "زُلْفَى — مواقيت الصلاة والقرآن والأذكار والقبلة",
    "homeDesc": "زُلْفَى تطبيق إسلامي يجمع مواقيت الصلاة الدقيقة والقرآن الكريم والأذكار والأدعية واتجاه القبلة في تجربة هادئة وأنيقة، بلا إعلانات ولا تحليلات ولا تتبّع.",
    "ogImageAlt": "شعار زُلْفَى: ميدالية فيروزية بإطار ذهبي تحمل اسم زُلْفَى.",
    "pill": "قريبًا على أندرويد",
    "lede": "زُلْفَى تطبيق إسلامي يجمع مواقيت الصلاة الدقيقة والقرآن الكريم والأذكار والأدعية واتجاه القبلة في تجربة هادئة وأنيقة. يعمل على جهازك أوّلًا، ومعظمه يعمل دون اتصال.",
    # the second section (the Quick Access dial) lives in tools/quick_access.py
    "showEyebrow": "داخل التطبيق",
    "showTitle": "مكان هادئ تعود إليه",
    "showNote": "زُلْفَى على أندرويد — القرآن والقبلة والأذكار وتحدّي اليوم وغيرها، بالوضع الذي تختاره لهذا الموقع.",
    "hint": "اسحب أو استخدم الأسهم — ومفاتيح الأسهم تعمل أيضًا.",
    "prevShot": "اللقطة السابقة",
    "nextShot": "اللقطة التالية",
    "shotsLabel": "لقطات من تطبيق زُلْفَى",
    "zoomLabel": "افتح لقطة %s بالحجم الكامل",
    "lbTitle": "معاينة اللقطة",
    "lbClose": "إغلاق المعاينة",
    "localTitle": "الأولوية لجهازك",
    "localNote": "القرآن والأذكار والأدعية ومواقيت الصلاة والقبلة تُحسب وتُحفظ على جهازك. ولا يحتوي زُلْفَى على إعلانات ولا تحليلات ولا تتبّع، ولا يطلب اسمك الحقيقي ولا بريدك ولا رقم هاتفك ولا تاريخ ميلادك.",
    "readPrivacy": "اقرأ سياسة الخصوصية",
    "availTitle": "التوفّر",
    "availNote": "زُلْفَى في مرحلة الإعداد النهائي لأول إصدار على أندرويد، ولم يُنشر بعد على Google Play. وستحمل هذه الصفحة رابط المتجر عند إتاحته. والواجهة متاحة بالعربية والإنجليزية والهولندية.",
    # support
    "supTitle": "الدعم — زُلْفَى",
    "supDesc": "الدعم لتطبيق زُلْفَى: كيف تتواصل مع الفريق، وإجابات عن الأسئلة الشائعة.",
    "supH1": "الدعم",
    "supSub": "إجابات، وطريق مباشر للتواصل معنا",
    "supWrite": "عند الكتابة عن مشكلة في التطبيق، يفيد ذكر طراز جهازك وإصدار أندرويد والشاشة التي كنت فيها. ولا تُرسل كلمات مرور أو أي بيانات حسّاسة — فزُلْفَى لا يطلبها أبدًا.",
    "supLegal": "الوثائق",
    "supPlayQ": "هل زُلْفَى متاح على Google Play؟",
    "supPlayA": "ليس بعد. زُلْفَى في مرحلة الإعداد النهائي لأول إصدار على أندرويد، وسيحمل هذا الموقع رابط المتجر عند إتاحته.",
    "supDelQ": "كيف أحذف بياناتي؟",
    "supDelA": "من صفحة الخصوصية داخل التطبيق. والخطوات كاملة في صفحة حذف البيانات.",
}

# ─────────────────────────── DUTCH ───────────────────────────
S["nl"] = {
    "skip": "Naar de inhoud",
    "navLabel": "Hoofdnavigatie",
    "skipToContent": "Naar de inhoud",
    "pnStart": "Start",
    "pnUpdates": "Updates",
    "pnSupport": "Ondersteuning",
    "pnContact": "Contact",
    "footerLabel": "Voettekst",
    "langLabel": "Taal",
    "langPrefix": "Taal: ",
    "langShort": "NL",
    "playSoon": "Binnenkort op Google Play",
    "ghLabel": "ZULFAA op GitHub",
    "heroTitle": "Uw dag van aanbidding, op één rustige plek",
    "heroLead": "Gebedstijden, de Koran, adhkar en de qibla, berekend op uw eigen telefoon en grotendeels offline.",
    "ctaNotify": "Laat het me weten bij de lancering",
    "ctaInside": "Bekijk de app van binnen",
    "heroTrust": "Geen advertenties of tracking tussen websites.",
    "themeLabel": "Donker thema",
    "dayLabel": "Dag",
    "nightLabel": "Nacht",
    "motionPause": "Beweging van de telefoon pauzeren",
    "dragHint": "Sleep om de telefoon te draaien",
    "shownDark": "Donker thema weergegeven",
    "shownLight": "Licht thema weergegeven",
    "shotAlt": "Het startscherm van ZULFAA: de begroeting, het aftellen naar het volgende gebed, de dagelijkse uitdaging en snelle toegang.",
    "topNote": "De eerste Android-release wordt voorbereid.",
    "menuLabel": "Menu",
    "closeLabel": "Menu sluiten",
    "home": "Start",
    "deleteNav": "Gegevens verwijderen",
    "devBy": "ZULFAA is ontworpen en ontwikkeld door",
    "rights": "© 2026 MONER INTELLIGENCE SYSTEMS. Alle rechten voorbehouden.",
    "contents": "Inhoud",
    "inShort": "In het kort",
    "homeTitle": "ZULFAA — Gebedstijden, Koran, adhkar en qibla",
    "homeDesc": "ZULFAA is een islamitische app met nauwkeurige gebedstijden, de Koran, adhkar, doe'a's en de qibla. Lokaal eerst, zonder advertenties, analytics of tracking.",
    "ogImageAlt": "Het ZULFAA-embleem: een turquoise medaillon in een gouden rand met de naam ZULFAA.",
    "pill": "Binnenkort op Android",
    "lede": "ZULFAA is een islamitische app die nauwkeurige gebedstijden, de Koran, adhkar en doe'a's en de qiblarichting samenbrengt in één rustige, elegante ervaring. De app werkt eerst op uw apparaat, en het meeste werkt offline.",
    # the second section (the Quick Access dial) lives in tools/quick_access.py
    "showEyebrow": "IN DE APP",
    "showTitle": "Een rustige plek om naar terug te keren",
    "showNote": "ZULFAA op Android — de Koran, de qibla, adhkar, de dagelijkse uitdaging en meer, in het thema dat u voor deze site kiest.",
    "hint": "Veeg, sleep of gebruik de pijlen — de pijltoetsen werken ook.",
    "prevShot": "Vorige schermafbeelding",
    "nextShot": "Volgende schermafbeelding",
    "shotsLabel": "Schermafbeeldingen van de ZULFAA-app",
    "zoomLabel": "Open de schermafbeelding %s op volledige grootte",
    "lbTitle": "Voorbeeld van schermafbeelding",
    "lbClose": "Voorbeeld sluiten",
    "localTitle": "Lokaal eerst gebouwd",
    "localNote": "De Koran, adhkar, doe'a's, gebedstijden en de qibla worden op uw eigen apparaat berekend en bewaard. ZULFAA bevat geen advertentie-, analytics- of trackingcode en vraagt nooit om uw echte naam, e-mailadres, telefoonnummer of geboortedatum.",
    "readPrivacy": "Lees het privacybeleid",
    "availTitle": "Beschikbaarheid",
    "availNote": "ZULFAA wordt voorbereid op de eerste Android-uitgave en staat nog niet op Google Play. Deze pagina krijgt de winkellink zodra de app openbaar beschikbaar is. De interface is beschikbaar in het Arabisch, Engels en Nederlands.",
    "supTitle": "Ondersteuning — ZULFAA",
    "supDesc": "Ondersteuning voor de ZULFAA-app: hoe u het team bereikt en antwoorden op veelgestelde vragen.",
    "supH1": "Ondersteuning",
    "supSub": "Antwoorden, en een directe manier om ons te bereiken",
    "supWrite": "Vermeld bij een probleem in de app uw toestelmodel, uw Android-versie en het scherm waar u was. Stuur geen wachtwoorden of andere gevoelige gegevens — ZULFAA vraagt er nooit om.",
    "supLegal": "Documenten",
    "supPlayQ": "Staat ZULFAA al op Google Play?",
    "supPlayA": "Nog niet. ZULFAA wordt voorbereid op de eerste Android-uitgave. Deze site krijgt de winkellink zodra de app openbaar beschikbaar is.",
    "supDelQ": "Hoe verwijder ik mijn gegevens?",
    "supDelA": "Via de privacypagina in de app. De volledige stappen staan op de pagina Gegevens verwijderen.",
}
