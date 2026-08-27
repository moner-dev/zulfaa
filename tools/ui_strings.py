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

# ─────────────────────────── ARABIC ───────────────────────────
S["ar"] = {
    "skip": "تخطّي إلى المحتوى",
    "navLabel": "التنقل الرئيسي",
    "footerLabel": "روابط التذييل",
    "langLabel": "اللغة",
    "home": "الرئيسية",
    "deleteNav": "حذف البيانات",
    "devBy": "زُلْفَى من تصميم وتطوير",
    "rights": "© ٢٠٢٦ MONER INTELLIGENCE SYSTEMS. جميع الحقوق محفوظة.",
    "contents": "المحتويات",
    "inShort": "باختصار",
    # home
    "homeTitle": "زُلْفَى — مواقيت الصلاة والقرآن والأذكار والقبلة",
    "homeDesc": "زُلْفَى تطبيق إسلامي يجمع مواقيت الصلاة الدقيقة والقرآن الكريم والأذكار والأدعية واتجاه القبلة في تجربة هادئة وأنيقة، بلا إعلانات ولا تحليلات ولا تتبّع.",
    "pill": "قريبًا على أندرويد",
    "lede": "زُلْفَى تطبيق إسلامي يجمع مواقيت الصلاة الدقيقة والقرآن الكريم والأذكار والأدعية واتجاه القبلة في تجربة هادئة وأنيقة. يعمل على جهازك أوّلًا، ومعظمه يعمل دون اتصال.",
    "featTitle": "ما يقدّمه زُلْفَى",
    "featNote": "كل ما يحتاجه المسلم في يومه، في مكان واحد هادئ.",
    "cards": [
        ("مواقيت الصلاة", "تُحسب على جهازك من موقعك وطريقة الحساب والمذهب، مع إمكان التعديل اليدوي لكل صلاة."),
        ("القرآن الكريم", "النص العثماني كاملًا مع الترجمة الإنجليزية، مضمّن داخل التطبيق، مع العلامات والمحفوظات وتقدّم القراءة."),
        ("الأذكار والأدعية", "أذكار الصباح والمساء ومجموعة أدعية مع الترجمة والصوت، كلها تعمل دون اتصال."),
        ("اتجاه القبلة", "الاتجاه والمسافة إلى الكعبة، تُحسب على جهازك، مع تتبّع مباشر اختياري وبوصلة."),
        ("التذكيرات", "تذكيرات محلية للصلوات الخمس والأذكار وورد القرآن والمناسبات الإسلامية. لا يُرسل شيء من أي خادم."),
        ("تحدّي اليوم", "سؤال معرفي يومي اختياري، مع توكنز ولوحة شرف. والتوكنز نقاط داخل التطبيق فقط، لا قيمة مالية لها ولا تُباع ولا تُشترى."),
    ],
    "showEyebrow": "داخل التطبيق",
    "showTitle": "مكان هادئ تعود إليه",
    "showNote": "أربع عشرة شاشة من زُلْفَى على أندرويد — الصلاة والقرآن والأذكار والقبلة وتحدّي اليوم.",
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
    "footerLabel": "Voettekst",
    "langLabel": "Taal",
    "home": "Start",
    "deleteNav": "Gegevens verwijderen",
    "devBy": "ZULFAA is ontworpen en ontwikkeld door",
    "rights": "© 2026 MONER INTELLIGENCE SYSTEMS. Alle rechten voorbehouden.",
    "contents": "Inhoud",
    "inShort": "In het kort",
    "homeTitle": "ZULFAA — Gebedstijden, Koran, adhkar en qibla",
    "homeDesc": "ZULFAA is een islamitische app die nauwkeurige gebedstijden, de Koran, adhkar en doe'a's en de qiblarichting samenbrengt in één rustige, elegante ervaring. Lokaal eerst, zonder advertenties, analytics of tracking.",
    "pill": "Binnenkort op Android",
    "lede": "ZULFAA is een islamitische app die nauwkeurige gebedstijden, de Koran, adhkar en doe'a's en de qiblarichting samenbrengt in één rustige, elegante ervaring. De app werkt eerst op uw apparaat, en het meeste werkt offline.",
    "featTitle": "Wat ZULFAA biedt",
    "featNote": "Alles waar een moslim de dag door naar grijpt, op één rustige plek.",
    "cards": [
        ("Gebedstijden", "Op uw apparaat berekend uit uw locatie, uw berekeningsmethode, madhhab en elke handmatige aanpassing die u maakt."),
        ("De Nobele Koran", "De volledige Uthmani-tekst met een Engelse vertaling, meegeleverd met de app, plus bladwijzers, opgeslagen verzen en uw leesvoortgang."),
        ("Adhkar &amp; doe'a's", "Ochtend- en avond-adhkar en een doe'a-verzameling met vertaling en audio, allemaal offline beschikbaar."),
        ("Qiblarichting", "De richting en afstand tot de Ka'bah, op uw apparaat berekend, met optionele live tracking en een kompas."),
        ("Herinneringen", "Lokale herinneringen voor de vijf gebeden, ochtend- en avond-adhkar, uw Koran-wird en islamitische gelegenheden. Er wordt niets vanaf een server gestuurd."),
        ("Dagelijkse uitdaging", "Een optionele dagelijkse kennisvraag, met tokens en een Erelijst. Tokens zijn alleen een score binnen de app — ze hebben geen geldwaarde en kunnen niet worden gekocht of verkocht."),
    ],
    "showEyebrow": "IN DE APP",
    "showTitle": "Een rustige plek om naar terug te keren",
    "showNote": "Veertien schermen uit ZULFAA op Android — gebed, de Koran, adhkar, de qibla en de dagelijkse uitdaging, in de eigen Arabische interface van de app.",
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
