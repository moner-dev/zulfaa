# -*- coding: utf-8 -*-
"""Every word of the homepage Salah section, in the site's three languages.

The page script (assets/salah/salah-section.js) holds NO user-facing text: tools/salah.py embeds the dictionary for
the page's language as JSON inside the section, and the script reads it from there. Add a language by adding a key.

Sunrise is a milestone of the day, not one of the five prayers: it has a name here because the day line and the list
show it, and `sunriseNote` says what it is.
"""

T = {
    "en": {
        "eyebrow": "Prayer times",
        "title": "The day, where you are",
        "note": "A living view of today, from Fajr to Isha. Times are calculated in your browser for an approximate "
                "location, and nothing about you leaves this page.",
        "sceneAlt": "A mosque by a lake beneath mountains, shown at the current time of day.",
        "next": "Next prayer", "now": "Now", "tomorrow": "tomorrow",
        "in_hm": "in {h} h {m} min", "in_m": "in {m} min", "in_soon": "in less than a minute",
        "since_m": "began {m} min ago", "since_now": "began just now",
        "names": {"fajr": "Fajr", "sunrise": "Sunrise", "dhuhr": "Dhuhr", "asr": "Asr", "maghrib": "Maghrib", "isha": "Isha"},
        "dayLine": "Today, from Fajr to Isha",
        "todaysTimes": "Today's times", "hideTimes": "Hide times",
        "timesTitle": "Today in {place}",
        # a place guessed from the time zone is a first guess, and the title says so; a chosen city reads "Today in"
        "timesTitleApprox": "Today near {place}",
        # no time zone the tz database can place: no times are shown, the visitor is asked for a city
        "unknownStatus": "Location needed", "unknownName": "Choose your city", "choosePlace": "Choose city",
        "unknownHelp": "Your time zone does not tell us where you are, so no times are shown yet.",
        "placeUnknown": "We could not place your time zone. Choose a city to see prayer times.",
        "sunriseNote": "Sunrise marks the end of Fajr's time; it is not a prayer.",
        "methodNote": "Muslim World League method, standard Asr. Times are approximate; your local mosque may differ by a few minutes.",
        "adjustedNote": "At this latitude the night is too short for the usual twilight angles today, so Fajr and Isha use the angle-based rule.",
        "changePlace": "Change location", "placeApprox": "Approximate location, from your time zone",
        "placeChosen": "The city you chose", "chooseCity": "Choose a city", "searchCity": "Search a city",
        "useTimeZone": "Use my time zone instead", "close": "Close", "noCity": "No city matches.",
        "announce": "{status}: {name} at {time}, {countdown}.",
        "noScript": "Prayer times need JavaScript. The picture shows the mosque at midday.",
    },
    "nl": {
        "eyebrow": "Gebedstijden",
        "title": "De dag, waar jij bent",
        "note": "Een levend beeld van vandaag, van Fajr tot Isha. De tijden worden in je browser berekend voor een "
                "locatie bij benadering, en niets over jou verlaat deze pagina.",
        "sceneAlt": "Een moskee aan een meer onder bergen, getoond op het huidige moment van de dag.",
        "next": "Volgend gebed", "now": "Nu", "tomorrow": "morgen",
        "in_hm": "over {h} u {m} min", "in_m": "over {m} min", "in_soon": "over minder dan een minuut",
        "since_m": "{m} min geleden begonnen", "since_now": "zojuist begonnen",
        "names": {"fajr": "Fajr", "sunrise": "Zonsopkomst", "dhuhr": "Dhuhr", "asr": "Asr", "maghrib": "Maghrib", "isha": "Isha"},
        "dayLine": "Vandaag, van Fajr tot Isha",
        "todaysTimes": "Tijden vandaag", "hideTimes": "Verbergen",
        "timesTitle": "Vandaag in {place}",
        "timesTitleApprox": "Vandaag rond {place}",
        "unknownStatus": "Locatie nodig", "unknownName": "Kies je stad", "choosePlace": "Kies stad",
        "unknownHelp": "Je tijdzone vertelt ons niet waar je bent, dus er staan nog geen tijden.",
        "placeUnknown": "We konden je tijdzone niet plaatsen. Kies een stad om de gebedstijden te zien.",
        "sunriseNote": "Zonsopkomst is het einde van de tijd van Fajr; het is geen gebed.",
        "methodNote": "Methode van de Muslim World League, standaard Asr. De tijden zijn bij benadering; je lokale moskee kan enkele minuten afwijken.",
        "adjustedNote": "Op deze breedtegraad is de nacht vandaag te kort voor de gebruikelijke schemeringshoeken; Fajr en Isha volgen daarom de hoekgebaseerde regel.",
        "changePlace": "Locatie wijzigen", "placeApprox": "Locatie bij benadering, op basis van je tijdzone",
        "placeChosen": "De stad die je hebt gekozen", "chooseCity": "Kies een stad", "searchCity": "Zoek een stad",
        "useTimeZone": "Gebruik in plaats daarvan mijn tijdzone", "close": "Sluiten", "noCity": "Geen stad gevonden.",
        "announce": "{status}: {name} om {time}, {countdown}.",
        "noScript": "Voor gebedstijden is JavaScript nodig. Het beeld toont de moskee rond het middaguur.",
    },
    "ar": {
        "eyebrow": "مواقيت الصلاة",
        "title": "يومك، حيث أنت",
        "note": "مشهد حيّ ليومك من الفجر إلى العشاء. تُحسب المواقيت داخل متصفحك لموقع تقريبي، ولا يغادر هذه الصفحة أي شيء عنك.",
        "sceneAlt": "مسجد على ضفة بحيرة تحت الجبال، كما يبدو في هذا الوقت من اليوم.",
        "next": "الصلاة القادمة", "now": "الآن", "tomorrow": "غدًا",
        "in_hm": "بعد {h} س {m} د", "in_m": "بعد {m} د", "in_soon": "بعد أقل من دقيقة",
        "since_m": "بدأت قبل {m} د", "since_now": "بدأت الآن",
        "names": {"fajr": "الفجر", "sunrise": "الشروق", "dhuhr": "الظهر", "asr": "العصر", "maghrib": "المغرب", "isha": "العشاء"},
        "dayLine": "اليوم، من الفجر إلى العشاء",
        "todaysTimes": "مواقيت اليوم", "hideTimes": "إخفاء مواقيت اليوم",
        "timesTitle": "اليوم في {place}",
        "timesTitleApprox": "اليوم قرب {place}",
        "unknownStatus": "الموقع مطلوب", "unknownName": "اختر مدينتك", "choosePlace": "اختر مدينة",
        "unknownHelp": "منطقتك الزمنية لا تدلّنا على مكانك، لذلك لا تُعرض المواقيت بعد.",
        "placeUnknown": "لم نتمكّن من تحديد منطقتك الزمنية. اختر مدينة لعرض مواقيت الصلاة.",
        "sunriseNote": "الشروق نهاية وقت الفجر، وليس صلاة.",
        "methodNote": "طريقة رابطة العالم الإسلامي، والعصر على القول المشهور. المواقيت تقريبية، وقد يختلف مسجدك المحلي بدقائق.",
        "adjustedNote": "عند هذا العرض يقصر الليل اليوم عن زوايا الشفق المعتادة، فيُحسب الفجر والعشاء بقاعدة الزاوية.",
        "changePlace": "تغيير الموقع", "placeApprox": "موقع تقريبي بحسب منطقتك الزمنية",
        "placeChosen": "المدينة التي اخترتها", "chooseCity": "اختر مدينة", "searchCity": "ابحث عن مدينة",
        "useTimeZone": "استخدم منطقتي الزمنية بدلًا من ذلك", "close": "إغلاق", "noCity": "لا توجد مدينة مطابقة.",
        "announce": "{status}: {name} عند {time}، {countdown}.",
        "noScript": "تحتاج مواقيت الصلاة إلى JavaScript. تُظهر الصورة المسجد وقت الظهيرة.",
    },
}
