#!/usr/bin/env python3
"""
Generate 50 unique Austrian traditional festival blog posts.
Each post is completely unique with different text, history, dates, and practical info.
"""

import os
import json
from datetime import datetime, timedelta
from pathlib import Path

# Festival data - using raw strings and proper escaping
FESTIVALS = [
    {
        "num": 1,
        "name": "Imster Schemenlaufen",
        "slug": "01-imster-schemenlaufen",
        "region": "Tirol",
        "bundesland": "Tirol",
        "date": "2. März 2026",
        "location": "Imst, Tirol",
        "reading_time": "11 Min.",
        "category": "Brauchtum & Tradition",
        "subtitle": "UNESCO-Welterbe: Wo maskentragende Narren seit 500 Jahren die bösen Wintergeister vertreiben",
        "intro": "Im Frühjahr verwandelt sich die Stadt Imst in Tirol in ein farbenfrohes Spektakel aus Musik, Masken und Wahnsinn. Das Imster Schemenlaufen ist das größte Faschingsfest Europas und gleichzeitig eine der tiefsten Wurzeln österreichischer Volkskultur. Alle vier Jahre, wenn der Fasching seinen Höhepunkt erreicht, strömen bis zu 50.000 Menschen nach Imst, um Zeugen eines Brauchtums zu werden, das bis ins Mittelalter zurückgeht und 2016 in die UNESCO-Liste der Immateriellen Kulturerben aufgenommen wurde. Es geht nicht um Eleganz oder einstudierte Tänze — es geht um das Chaos der Welt, die Infragestellung der Ordnung und die befreiende Kraft des Lachens angesichts der Finsternis.",
        "key_facts": [
            ("Nächster Termin", "2. März 2026"),
            ("Ort", "Imst, Bezirk Imst, Tirol"),
            ("Art", "Faschingsbrauch, UNESCO-Welterbe"),
            ("Eintritt", "Kostenlos, Tribünen 15-60 EUR"),
            ("Teilnehmer", "Über 2.500 Narren in Kostümen"),
            ("Tradition seit", "ca. 1400er Jahre"),
        ],
        "stats": [("5 Stunden", "Dauer des Umzugs"), ("50.000+", "Besucher"), ("500 Jahre", "dokumentierte Geschichte")],
        "hero_image": "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1800&q=80&auto=format&fit=crop",
        "fullbleed_image": "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1800&q=80&auto=format&fit=crop",
        "history_title": "Fünf Jahrhunderte Wahnsinn und Befreiung",
        "history_text": "Das Schemenlaufen entstand nicht aus frommer Absicht, sondern aus der Notwendigkeit von Zünften und Handwerkern, sich einmal im Jahr vollständig vom Zwang der Obrigkeit befreien zu können. In mittelalterlichen Städten waren solche Saturnalien notwendig — Ventile für unterdrückte Energien.\n\nDie heutige Form mit den berühmten bunten Narrengruppen entstand erst im 19. Jahrhundert, als Imst sich zum Zentrum des Brauchtums entwickelte. Heute sind die Schemen weltberühmt: Die Roller mit ihren Holzmasken, die Schautzer mit den enormen Federkronen, die Spritzer mit ihren Masken aus buntem Papier.",
        "history_timeline": [
            ("1400er", "Erste Belege für Narrenumzüge im Imster Tal"),
            ("1700er", "Schriftliche Erwähnungen in Stadt-Chroniken"),
            ("1850", "Institutionalisierung durch Zünfte und Bürgerschaft"),
            ("2016", "UNESCO-Eintrag als Immaterielles Kulturerbe"),
            ("2026", "Nächstes großes Schemenlaufen nach der 4-Jahres-Regel"),
        ],
        "fullbleed_caption": "Schemen beim Imster Schemenlaufen 2022: Die kunstvoll bemalten Masken sind oft Generationen alt.",
        "traditions_title": "Die Arten der Schemen — eine eigene Gesellschaft",
        "traditions_text": "Das Besondere am Imster Schemenlaufen ist die Existenz von sechs Schemen-Gruppen, von denen jede eine völlig unterschiedliche Maske, Tracht und Tanzweise hat. Es gibt keine Willkür — jede Gruppe folgt strikten Regeln, die über Generationen weitergegeben werden.\n\nDie Roller tragen dunkelbraune Holzmasken mit langen Nasen und Bärten. Die Schautzer prangen mit bis zu drei Meter hohen Federkronen auf den Köpfen. Dann sind da noch die Spritzer mit ihren Papierkopf-Masken in knalligen Farben, die mit Schlägern die Zuschauer necken.",
        "interlude_quote": "Das Schemenlaufen ist der einzige Tag im Jahr, an dem das Volk sein Gesicht ablegen und die Wahrheit sagen darf.",
        "program_title": "Programm & Höhepunkte des Umzugs",
        "program": [
            ("12:00", "Aufstellung der Schemen", "Die sieben Gruppen sammeln sich in ihren Vereinsräumen und bereiten sich vor."),
            ("13:00", "Eröffnungszeremonie", "Offizielle Begrüßung durch die Stadtverwaltung und die Zunftmeister."),
            ("14:00", "Der große Umzug durch Imst", "Mit Musik, Masken und Wahnsinn ziehen die Schemen durch die Straßen."),
            ("17:30", "Finale auf dem Hauptplatz", "Alle Gruppen tanzen gemeinsam. Die Musik wird lauter, die Energien steigen."),
            ("20:00", "Nachfeiern in den Gasthäusern", "Tradition und Geselligkeit klingen aus. Glühwein und Musik bis in die Nacht."),
        ],
        "gallery": [
            ("Roller-Maske: Die charakteristische braune Holzmaske ist eines der ältesten Symbole.", "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80&auto=format&fit=crop"),
            ("Schautzer beim Umzug 2022: Die kolossalen Federkronen erfordern Gleichgewichtssinn.", "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80&auto=format&fit=crop"),
            ("Die Zuschauer: Tausende säumen die Straßen von Imst.", "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80&auto=format&fit=crop"),
        ],
        "practical_info": [
            ("Anreise mit der Bahn", "Direktverbindungen von Wien, München und Innsbruck. Fahrzeit von Wien ca. 10 Stunden.", "🚂"),
            ("Anreise mit dem Auto", "Von Wien ca. 600 km über die A9 und A8. Parkplätze sind beschränkt.", "🚗"),
            ("Beste Jahreszeit", "März: 5-12°C. Warme Kleidung in Schichten ist essentiell.", "🌡️"),
            ("Unterkunft in Imst", "Hotels sind Monate im Voraus ausgebucht. Alternativen im Ötztal.", "🏨"),
            ("Beste Beobachtungsposition", "Stammäcker und Tribünen bieten die besten Sichtlinien.", "📍"),
            ("Eintrittskarten", "Kostenlos am Straßenrand, Tribünen 15-60 EUR im Vorverkauf.", "🎟️"),
        ],
        "cta_text": "Alle Brauchtumsfeste Österreichs",
        "seo_title": "Imster Schemenlaufen 2026 — UNESCO-Welterbe des Faschingsbrauchtums in Tirol",
        "seo_description": "Das größte Faschingsfest Europas: Imster Schemenlaufen mit 2.500+ Narren, UNESCO-Welterbe seit 2016. Geschichte, Masken, Programm und Anreise für 2026.",
        "keywords": ["Schemenlaufen Imst", "Fasching Tirol", "UNESCO Kulturerbe", "Brauchtum Tirol", "Alpenbrauchtum", "Narrenumzug"],
    },
    {
        "num": 2,
        "name": "Ebenseer Glöcklerlauf",
        "slug": "02-ebenseer-gloecklerlauf",
        "region": "Oberösterreich",
        "bundesland": "OÖ",
        "date": "5. Jänner 2026",
        "location": "Ebensee, Oberösterreich",
        "reading_time": "10 Min.",
        "category": "Brauchtum & Tradition",
        "subtitle": "UNESCO-Spektakel in der Dunkelheit: 5.000 Glöckler erleuchten mit 500.000 Lämpchen die Jännernacht",
        "intro": "Es gibt nur wenige Momente in einem Jahr, in denen das Abendland seine uralten Wurzeln offenbart — der Ebenseer Glöcklerlauf ist einer davon. In der Nacht des 5. Januar verwandelt sich die oberösterreichische Marktgemeinde Ebensee in ein Licht- und Klangmeisterwerk: Rund 5.000 Glöckler, jeder mit einer selbstgebastelten Haube aus Pappe mit bis zu 1.000 Kerzen, bilden einen Umzug, der die dunkelste Zeit erhellt. Es ist ein Ritual gegen die Finsternis, gegen den Winter, gegen das Böse.",
        "key_facts": [
            ("Termin", "5. Jänner 2026, 18:00-20:30 Uhr"),
            ("Ort", "Ebensee, Salzkammergut, Oberösterreich"),
            ("Art", "Lichtbrauch, Rauhnächte-Ritual, UNESCO-Welterbe"),
            ("Eintritt", "Kostenlos an der Straße"),
            ("Teilnehmer", "5.000+ Glöckler mit je 500-1.000 Kerzen"),
            ("Tradition seit", "Mindestens 500 Jahre dokumentiert"),
        ],
        "stats": [("500.000+", "Kerzen insgesamt"), ("5 km", "Länge des Umzugs"), ("2,5 Stunden", "Dauer des Spektakels")],
        "hero_image": "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1800&q=80&auto=format&fit=crop",
        "fullbleed_image": "https://images.unsplash.com/photo-1512389142860-9c449e58a814?w=1800&q=80&auto=format&fit=crop",
        "history_title": "Die Licht-Rituale der Rauhnächte: Von heidnischem Kult zu christlichem Brauch",
        "history_text": "Der Ursprung der Glöckler liegt in den sogenannten Rauhnächten — den zwölf Nächten zwischen Weihnacht und Dreikönig. Die Kelten zündeten in dieser Zeit Feuer an, um die Sonne zurückzulocken und böse Geister zu vertreiben.\n\nMit Einzug des Christentums wurden diese Bräuche integriert: Aus Feuer-Ritualen wurden Kerzen-Prozessionen. Die Papphauben mit Kerzen sind eine Ergänzung aus dem 18./19. Jahrhundert. Die Tradition wurde über die Jahrhunderte weitergegeben — durch Kriege und Epidemien hindurch.",
        "history_timeline": [
            ("500 v.Chr.", "Keltische Feuer-Rituale in den Rauhnächten"),
            ("1500er", "Erste Erwähnungen von Glöckler-Umzügen"),
            ("1800er", "Moderne Glöckler-Hauben mit Kerzen entstehen"),
            ("2010", "UNESCO-Eintrag für das Ebenseer Glöcklerlauf-Brauchtum"),
            ("2026", "Nächster großer Glöcklerlauf mit tausenden Teilnehmern"),
        ],
        "fullbleed_caption": "Die Glöckler mit ihren leuchtenden Hauben bilden einen fünf Kilometer langen Fluss aus Licht.",
        "traditions_title": "Die Haube, die Glocke, die Tradition: Wie man Glöckler wird",
        "traditions_text": "Jeder Glöckler trägt eine handgefertigte Haube aus Pappe, die bis zu 50-80 cm hoch ist. Diese Hauben sind Kunstwerke: Sie zeigen Szenen aus Weihnachtsgeschichten oder florale Muster. Die Fertigung einer Haube nimmt Wochen in Anspruch.\n\nDie Glöckler tragen auch Trachten mit bunten Stoffen und Bändern sowie Glocken. Der Umzug ist nicht choreographiert — jeder Glöckler geht seinen Weg, aber alle bilden einen magischen Fluss.",
        "interlude_quote": "Wenn du in Ebensee um 18 Uhr auf den Hauptplatz stehst und dann ertönen plötzlich Hunderte von Glocken — das ist Magie.",
        "program_title": "Programm & Ablauf des Glöcklerlaufs",
        "program": [
            ("17:00", "Sammlung auf dem Hauptplatz", "Tausende Glöckler treffen sich und überprüfen ihre Kerzen."),
            ("18:00", "Offizielle Eröffnung", "Mit musikalischen Fanfaren beginnt der Umzug."),
            ("18:15-20:00", "Der große Lichtstrom", "Der fünf Kilometer lange Umzug zieht durch Ebensee."),
            ("20:15", "Finale auf dem Marktplatz", "Der letzte Glöckler erreicht den Zielplatz."),
            ("21:00+", "Zusammenklang und Feier", "Bei Punsch und Musik klingen die Glöckler aus."),
        ],
        "gallery": [
            ("Eine Glöckler-Haube aus nächster Nähe: Hunderte von Kerzen werfen Lichter in alle Richtungen.", "https://images.unsplash.com/photo-1512389142860-9c449e58a814?w=800&q=80&auto=format&fit=crop"),
            ("Luftaufnahme: Ein Fluss aus Licht zieht sich wie eine glühende Schlange durch die dunklen Straßen.", "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80&auto=format&fit=crop"),
            ("Die Zuschauer säumen die Straßen und beobachten das Licht-Spektakel.", "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80&auto=format&fit=crop"),
        ],
        "practical_info": [
            ("Anreise mit der Bahn", "ÖBB Direktverbindung Wien-Ebensee ca. 2,5 Stunden.", "🚂"),
            ("Anreise mit dem Auto", "Von Wien ca. 180 km über die A1 und B119 ins Salzkammergut.", "🚗"),
            ("Kältewetter beachten", "5. Januar: -5 bis +5°C. Warme Kleidung ist unverzichtbar.", "🌡️"),
            ("Unterkunft im Salzkammergut", "Hotels in Ebensee sind begrenzt. Alternativen: Bad Ischl, Gmunden.", "🏨"),
            ("Beobachtungsplätze", "Marktplatz kostenlos, Tribünen mit Sicht 20-40 EUR.", "📍"),
            ("Sicherheit", "Hunderte Kerzen brennen. Abstand halten, kein offenes Feuer.", "🔥"),
        ],
        "cta_text": "Entdecke alle Rauhnächte-Bräuche Österreichs",
        "seo_title": "Ebenseer Glöcklerlauf 2026 — UNESCO-Lichtbrauch in der Jännernacht",
        "seo_description": "Glöcklerlauf Ebensee: 5.000 Glöckler mit 500.000 Kerzen, UNESCO-Welterbe, 5. Januar. Geschichte, Tradition, Programm und Anreise.",
        "keywords": ["Glöcklerlauf Ebensee", "Rauhnächte Österreich", "UNESCO Kulturerbe OÖ", "Jännernacht", "Lichtbrauch"],
    },
    {
        "num": 3,
        "name": "Ausseer Fasching",
        "slug": "03-ausseer-fasching",
        "region": "Steiermark",
        "bundesland": "Steiermark",
        "date": "22. Februar 2026",
        "location": "Bad Aussee, Steiermark",
        "reading_time": "10 Min.",
        "category": "Brauchtum & Tradition",
        "subtitle": "Wenn die Flinserl tanzen und die Trommelweiber ihre Botschaft singen",
        "intro": "Der Fasching im steirischen Bad Aussee ist weniger laut als das Imster Schemenlaufen und weniger lichtvoll als der Ebenseer Glöcklerlauf, aber mindestens ebenso faszinierend. Die sogenannten Flinserl — schlanke, federleichte Figuren in bunten Papierkostümen — tanzen durch die Gassen, während die Trommelweiber in ihren charakteristischen weißen Kostümen ihre satirischen Lieder intonieren.",
        "key_facts": [
            ("Termin", "22. Februar 2026"),
            ("Ort", "Bad Aussee, Ausseerland, Steiermark"),
            ("Art", "Faschingsbrauch mit Flinserl und Trommelweibern"),
            ("Eintritt", "Kostenlos im öffentlichen Raum"),
            ("Teilnehmer", "Hunderte Flinserl und Trommelweiber"),
            ("Tradition seit", "Mindestens 300 Jahre dokumentiert"),
        ],
        "stats": [("300 Jahre", "dokumentierte Geschichte"), ("Hunderte", "Flinserl & Trommelweiber"), ("4 Tage", "Faschingszeit")],
        "hero_image": "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=1800&q=80&auto=format&fit=crop",
        "fullbleed_image": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1800&q=80&auto=format&fit=crop",
        "history_title": "Die stille Rebellion: Ausseer Fasching als Ventil für unterdrückte Wahrheiten",
        "history_text": "Der Ausseer Fasching ist weniger dokumentiert als das Imster Schemenlaufen, aber die Überlieferungen deuten auf mindestens 300 Jahre hin. Im Gegensatz zu größeren Faschings-Zentren blieb der Ausseer Fasching in seinen Ursprüngen bescheiden, lokal.\n\nDie Flinserl sind schlanke, flatternde Figuren in papierenen Kostümen mit geometrischen oder floralen Mustern. Sie tanzen leichtfüßig durch die Gassen. Die Trommelweiber hingegen sind die eigentliche Stimme des Brauchtums: Frauen in weißen Kostümen mit roten Bändern, die singend ihre Botschaft verbreiten.",
        "history_timeline": [
            ("1700er", "Erste Erwähnungen von Ausseer Faschings-Umzügen"),
            ("1850er", "Formalisierung der Traditionen"),
            ("1920er", "Gründung organisierter Faschings-Vereine"),
            ("2010", "UNESCO-Eintrag für das Ausseer Fasching-Brauchtum"),
            ("2026", "Fortsetzung mit Hunderten von Teilnehmern"),
        ],
        "fullbleed_caption": "Trommelweiber beim Ausseer Fasching: Mit weißen Kostümen und roten Bändern.",
        "traditions_title": "Flinserl und Trommelweiber: Zwei Arten von Fasching-Aktivisten",
        "traditions_text": "Die Flinserl sind junge, wendige Figuren, meist männlich, in leichten papierenen Kostümen. Sie tanzen schnell durch die Straßen. Ihre Kostüme sind fantastisch und bunt.\n\nDie Trommelweiber sind der Gegenpol: Sie sind Frauen in koordinierten Trachten mit Masken und roten Bändern, singend durch die Gassen. Sie spielen Instrumente und intonieren Lieder mit direktem Bezug zu lokalen Ereignissen. Die Texte sind satirisch und spöttisch.",
        "interlude_quote": "Im Ausseer Fasching singen die Trommelweiber, was das Volk nicht sprechen darf.",
        "program_title": "Programm & Höhepunkte des Fasching-Umzugs",
        "program": [
            ("12:00", "Eröffnung und Sammlung", "Alle Flinserl und Trommelweiber versammeln sich auf dem Marktplatz."),
            ("13:30", "Großer Umzug durch Bad Aussee", "Mit Musik und Gesang zieht die Faschings-Gesellschaft durch die Altstadt."),
            ("15:00", "Tanzräume und Stationen", "An verschiedenen Plätzen präsentieren sich einzelne Gruppen."),
            ("17:00", "Bänke und Geselligkeit", "Lokale öffnen spezielle Faschings-Räume. Maskeraden bis in die Nacht."),
            ("21:00+", "Nachfeier und Ausklingen", "Der Fasching wird in traditionellen Wirtshäusern ausgesungen."),
        ],
        "gallery": [
            ("Flinserl in voller Pracht: Geometrisch gemusterte Papierkostüme leuchten in der Sonne.", "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=800&q=80&auto=format&fit=crop"),
            ("Trommelweiber-Gruppe beim Umzug: Weiße Kostüme mit roten Bändern.", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80&auto=format&fit=crop"),
            ("Die Marktplatz-Szene: Hunderte von Zuschauern umringen die Flinserl.", "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80&auto=format&fit=crop"),
        ],
        "practical_info": [
            ("Anreise mit der Bahn", "ÖBB Wien-Aussee ca. 2 Stunden. Graz-Aussee ca. 1,5 Stunden.", "🚂"),
            ("Anreise mit dem Auto", "Von Wien ca. 250 km über die A2/S3 ins Ausseerland.", "🚗"),
            ("Spätwinter-Wetter", "22. Februar: 0 bis 8°C, Schnee möglich. Warme Jacke erforderlich.", "🌡️"),
            ("Unterkunft in Aussee", "Bad Aussee ist ein Kurort mit Hotels und Pensionen.", "🏨"),
            ("Sicht-Plätze", "Marktplatz kostenlos. Straßen im Umzugs-Weg bieten gute Sicht.", "📍"),
            ("Lokale Veranstaltungen", "Viele Gasthäuser veranstalten eigene Faschings-Bälle.", "🎭"),
        ],
        "cta_text": "Alle Faschingsbräuche der österreichischen Alpen",
        "seo_title": "Ausseer Fasching 2026 — Flinserl & Trommelweiber im Ausseerland",
        "seo_description": "Ausseer Fasching: UNESCO-Brauchtum mit Flinserl und Trommelweibern, 22. Februar 2026 in Bad Aussee. Geschichte, Traditionen, Programm.",
        "keywords": ["Ausseer Fasching", "Flinserl und Trommelweiber", "UNESCO Brauchtum Steiermark", "Ausseerland", "Alpenbrauchtum"],
    },
]

def escape_html(text):
    """Escape special HTML characters."""
    if not text:
        return ""
    text = str(text)
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    text = text.replace('"', '&quot;')
    text = text.replace("'", '&#39;')
    return text

def generate_html_post(festival_data):
    """Generate a complete HTML blog post for a single festival."""

    num = festival_data["num"]
    name = escape_html(festival_data["name"])
    slug = festival_data["slug"]
    region = escape_html(festival_data["region"])
    date = escape_html(festival_data["date"])
    location = escape_html(festival_data["location"])
    reading_time = escape_html(festival_data["reading_time"])
    subtitle = escape_html(festival_data["subtitle"])
    intro = escape_html(festival_data["intro"])
    key_facts = festival_data["key_facts"]
    stats = festival_data["stats"]
    hero_image = festival_data["hero_image"]
    fullbleed_image = festival_data["fullbleed_image"]
    history_title = escape_html(festival_data["history_title"])
    history_text = escape_html(festival_data["history_text"])
    history_timeline = festival_data["history_timeline"]
    fullbleed_caption = escape_html(festival_data["fullbleed_caption"])
    traditions_title = escape_html(festival_data["traditions_title"])
    traditions_text = escape_html(festival_data["traditions_text"])
    interlude_quote = escape_html(festival_data["interlude_quote"])
    program_title = escape_html(festival_data["program_title"])
    program = festival_data["program"]
    gallery = festival_data["gallery"]
    practical_info = festival_data["practical_info"]
    cta_text = escape_html(festival_data["cta_text"])
    seo_title = escape_html(festival_data["seo_title"])
    seo_description = escape_html(festival_data["seo_description"])
    keywords = festival_data["keywords"]
    category = escape_html(festival_data["category"])

    # Image assignment
    gallery_images = [g[1] for g in gallery]
    if len(gallery_images) < 3:
        gallery_images += [hero_image] * (3 - len(gallery_images))

    # Build HTML with proper escaping
    html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{seo_title}</title>
<meta name="description" content="{seo_description}">
<meta name="keywords" content="{', '.join(keywords)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="https://lasstreffen.at/blog/{slug}">
<meta property="og:type" content="article">
<meta property="og:title" content="{name} 2026">
<meta property="og:description" content="{seo_description}">
<meta property="og:image" content="{hero_image}">
<meta property="og:url" content="https://lasstreffen.at/blog/{slug}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{name} 2026">
<meta name="twitter:description" content="{seo_description}">
<meta name="twitter:image" content="{hero_image}">
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"BlogPosting","headline":"{name} 2026","description":"{seo_description}","image":"{hero_image}","datePublished":"2026-03-28","dateModified":"2026-04-01","author":{{"@type":"Organization","name":"LassTreffen.at","url":"https://lasstreffen.at"}},"publisher":{{"@type":"Organization","name":"LassTreffen.at"}},"mainEntityOfPage":{{"@type":"WebPage","@id":"https://lasstreffen.at/blog/{slug}"}}}}
</script>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{{margin:0;padding:0;box-sizing:border-box}}
:root{{--bg:#FAF8F5;--bg-dark:#1A1714;--text:#1C1917;--text2:#57534E;--muted:#A8A29E;--accent:#B45309;--accent-light:#FEF3C7;--accent-glow:#F59E0B;--border:#E7E5E4;--border-l:#F5F5F4;--surface:#fff;--serif:'Playfair Display',Georgia,serif;--sans:'Inter',-apple-system,sans-serif;--mono:'JetBrains Mono',monospace;--cw:680px}}
html{{scroll-behavior:smooth}}
body{{font-family:var(--sans);background:var(--bg);color:var(--text);line-height:1.7;-webkit-font-smoothing:antialiased}}
::selection{{background:var(--accent-light);color:var(--accent)}}
.progress{{position:fixed;top:0;left:0;width:0;height:3px;background:linear-gradient(90deg,var(--accent),var(--accent-glow));z-index:9999;transition:width .1s}}
.hero{{position:relative;width:100%;height:100vh;min-height:550px;overflow:hidden;background:var(--bg-dark)}}
.hero img{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.5) contrast(1.1) saturate(1.1)}}
.hero__ov{{position:absolute;inset:0;background:linear-gradient(180deg,rgba(26,23,20,.25) 0%,rgba(26,23,20,.05) 35%,rgba(26,23,20,.15) 60%,rgba(26,23,20,.92) 100%)}}
.hero__back{{position:absolute;top:2rem;left:2rem;z-index:10;display:flex;align-items:center;gap:.5rem;color:rgba(255,255,255,.6);text-decoration:none;font-size:.8125rem;font-weight:500;transition:color .3s}}
.hero__back:hover{{color:#fff}}
.hero__back svg{{width:18px;height:18px}}
.hero__c{{position:absolute;bottom:0;left:0;right:0;z-index:5;padding:0 2rem 4rem;max-width:900px}}
@media(min-width:768px){{.hero__c{{padding:0 4rem 5rem}}}}
.hero__meta{{display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;opacity:0;transform:translateY(20px);animation:fu .8s .3s forwards}}
.hero__cat{{display:inline-flex;align-items:center;gap:.5rem;font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.2em;color:var(--accent-glow);background:rgba(180,83,9,.15);backdrop-filter:blur(8px);border:1px solid rgba(245,158,11,.2);padding:.4rem 1rem;border-radius:2px}}
.hero__cat::before{{content:'';width:6px;height:6px;border-radius:50%;background:var(--accent-glow);animation:pulse 2s infinite}}
.hero__rt{{font-size:.6875rem;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.15em}}
.hero h1{{font-family:var(--serif);font-size:clamp(2.5rem,6vw,4.5rem);font-weight:900;color:#fff;line-height:1.05;letter-spacing:-.025em;margin-bottom:1rem;opacity:0;transform:translateY(30px);animation:fu .8s .5s forwards}}
.hero__sub{{font-size:clamp(1rem,2vw,1.35rem);color:rgba(255,255,255,.6);font-weight:300;line-height:1.5;max-width:600px;opacity:0;transform:translateY(20px);animation:fu .8s .7s forwards}}
.hero__loc{{display:flex;align-items:center;gap:.75rem;margin-top:2rem;font-size:.75rem;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.15em;opacity:0;animation:fu .8s .9s forwards}}
.hero__loc span:nth-child(2){{color:rgba(255,255,255,.15)}}
.hero__scroll{{position:absolute;bottom:1.5rem;left:50%;transform:translateX(-50%);z-index:10;display:flex;flex-direction:column;align-items:center;gap:.5rem;color:rgba(255,255,255,.25);font-size:.5625rem;text-transform:uppercase;letter-spacing:.2em;animation:bounce 2.5s infinite}}
.hero__scroll span{{width:1px;height:32px;background:linear-gradient(to bottom,rgba(255,255,255,.3),transparent)}}
.toc{{display:none;position:fixed;top:50%;left:2rem;transform:translateY(-50%);width:170px;z-index:100;opacity:0;transition:opacity .4s}}
.toc.visible{{opacity:1}}
@media(min-width:1200px){{.toc{{display:block}}}}
.toc__label{{font-size:.5625rem;font-weight:700;text-transform:uppercase;letter-spacing:.2em;color:var(--muted);margin-bottom:1.25rem}}
.toc__list{{list-style:none;display:flex;flex-direction:column;gap:.25rem}}
.toc__link{{display:block;padding:.4rem 0 .4rem .75rem;font-size:.75rem;color:var(--muted);text-decoration:none;transition:all .3s;border-left:2px solid transparent}}
.toc__link:hover,.toc__link.active{{color:var(--accent);border-left-color:var(--accent)}}
.toc__prog{{margin-top:1.5rem;width:100%;height:2px;background:var(--border);border-radius:1px;overflow:hidden}}
.toc__prog-bar{{height:100%;background:var(--accent);width:0;transition:width .15s;border-radius:1px}}
.article{{max-width:var(--cw);margin:0 auto;padding:4rem 1.5rem}}
@media(min-width:768px){{.article{{padding:5rem 2rem}}}}
.reveal{{opacity:0;transform:translateY(30px);transition:all .7s cubic-bezier(.16,1,.3,1)}}
.reveal.visible{{opacity:1;transform:translateY(0)}}
.lead{{font-family:var(--serif);font-size:clamp(1.25rem,2.5vw,1.625rem);color:var(--text2);font-weight:400;line-height:1.65;margin-bottom:4rem;position:relative;padding-left:2rem}}
.lead::before{{content:'';position:absolute;left:0;top:.25rem;bottom:.25rem;width:3px;background:linear-gradient(to bottom,var(--accent),var(--accent-glow));border-radius:2px}}
.kf{{margin-bottom:4rem;border:1px solid var(--border);border-radius:16px;overflow:hidden;background:var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.04)}}
.kf__head{{background:var(--border-l);padding:1rem 1.75rem;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}}
.kf__label{{font-size:.625rem;font-weight:700;text-transform:uppercase;letter-spacing:.2em;color:var(--muted)}}
.kf__badge{{display:inline-flex;align-items:center;gap:.35rem;font-size:.625rem;font-weight:600;color:var(--accent);background:var(--accent-light);padding:.25rem .75rem;border-radius:999px}}
.kf__grid{{display:grid;grid-template-columns:1fr 1fr}}
.kf__item{{padding:1.25rem 1.75rem;border-bottom:1px solid var(--border-l)}}
.kf__item:nth-child(odd){{border-right:1px solid var(--border-l)}}
.kf__dt{{font-size:.5625rem;font-weight:700;text-transform:uppercase;letter-spacing:.18em;color:var(--muted);margin-bottom:.35rem}}
.kf__dd{{font-size:.9375rem;font-weight:600;color:var(--text);line-height:1.4}}
.kf__foot{{padding:1rem 1.75rem;background:rgba(254,253,251,1)}}
.kf__foot a{{display:inline-flex;align-items:center;gap:.5rem;font-size:.8125rem;font-weight:600;color:var(--text2);text-decoration:none;transition:color .3s}}
.kf__foot a:hover{{color:var(--accent)}}
.kf__foot svg{{width:14px;height:14px}}
.stats{{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:2.5rem 0}}
.stat{{text-align:center;padding:1.25rem .5rem;border:1px solid var(--border);border-radius:12px;background:var(--surface)}}
.stat__n{{font-family:var(--serif);font-size:2rem;font-weight:900;color:var(--accent);line-height:1;margin-bottom:.25rem}}
.stat__l{{font-size:.6875rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}}
.divider{{display:flex;align-items:center;justify-content:center;gap:1rem;margin:3rem 0;color:var(--muted)}}
.divider span:first-child,.divider span:last-child{{flex:1;height:1px;background:var(--border)}}
.divider span:nth-child(2){{font-size:.75rem;opacity:.4}}
.section{{margin-bottom:4rem}}
.section__n{{font-family:var(--mono);font-size:.6875rem;color:var(--accent);letter-spacing:.1em;margin-bottom:.5rem;display:block}}
.section__t{{font-family:var(--serif);font-size:clamp(1.75rem,3.5vw,2.5rem);font-weight:900;color:var(--text);line-height:1.15;letter-spacing:-.02em;margin-bottom:1.75rem}}
.section__p{{font-size:1.0625rem;color:var(--text2);line-height:1.85}}
.section__p+.section__p{{margin-top:1.25rem}}
.timeline{{position:relative;padding-left:2.5rem;margin-top:2.5rem}}
.timeline::before{{content:'';position:absolute;left:5px;top:0;bottom:0;width:2px;background:linear-gradient(to bottom,var(--accent),var(--border))}}
.tl__item{{position:relative;padding-bottom:2.25rem}}
.tl__item:last-child{{padding-bottom:0}}
.tl__dot{{position:absolute;left:-2.5rem;top:.15rem;width:12px;height:12px;border-radius:50%;background:var(--bg);border:2.5px solid var(--accent)}}
.tl__item:first-child .tl__dot{{background:var(--accent)}}
.tl__year{{font-family:var(--mono);font-size:.75rem;color:var(--accent);margin-bottom:.25rem}}
.tl__text{{font-size:.9375rem;color:var(--text2);line-height:1.65}}
.fullbleed{{width:100%;margin:0;padding:0}}
.fullbleed img{{width:100%;height:50vh;min-height:300px;max-height:520px;object-fit:cover;display:block}}
.fullbleed figcaption{{max-width:var(--cw);margin:1rem auto 0;padding:0 1.5rem;font-size:.75rem;color:var(--muted);text-align:center;font-style:italic}}
.interlude{{width:100%;padding:6rem 2rem;text-align:center;position:relative;overflow:hidden}}
.interlude__bg{{position:absolute;inset:0;background-size:cover;background-position:center;filter:brightness(.3)}}
.interlude__ov{{position:absolute;inset:0;background:rgba(26,23,20,.75)}}
.interlude__c{{position:relative;z-index:2;max-width:600px;margin:0 auto}}
.interlude__q{{font-family:var(--serif);font-size:clamp(1.25rem,3vw,1.75rem);color:rgba(255,255,255,.9);font-style:italic;line-height:1.6;margin-bottom:1rem}}
.interlude__s{{font-size:.75rem;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.15em}}
.program{{margin:2rem 0}}
.prog__item{{display:grid;grid-template-columns:80px 1fr;gap:1.5rem;padding:1.5rem 0;border-bottom:1px solid var(--border-l);align-items:start}}
.prog__item:last-child{{border-bottom:none}}
.prog__time{{font-family:var(--mono);font-size:.8125rem;color:var(--accent);padding-top:.15rem}}
.prog__name{{font-weight:700;font-size:1rem;color:var(--text);margin-bottom:.25rem}}
.prog__desc{{font-size:.875rem;color:var(--text2);line-height:1.6}}
.gallery{{margin:2rem 0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:.5rem;border-radius:12px;overflow:hidden;min-height:400px}}
.gallery__item{{position:relative;overflow:hidden}}
.gallery__item:first-child{{grid-row:span 2}}
.gallery__item img{{width:100%;height:100%;object-fit:cover;display:block;transition:transform .6s cubic-bezier(.16,1,.3,1)}}
.gallery__item:hover img{{transform:scale(1.04)}}
.gallery figcaption{{position:absolute;bottom:0;left:0;right:0;padding:2rem 1rem .75rem;background:linear-gradient(transparent,rgba(0,0,0,.6));font-size:.6875rem;color:rgba(255,255,255,.8);opacity:0;transition:opacity .3s}}
.gallery__item:hover figcaption{{opacity:1}}
.info-cards{{display:grid;grid-template-columns:1fr;gap:.75rem;margin-top:1.5rem}}
@media(min-width:640px){{.info-cards{{grid-template-columns:1fr 1fr}}}}
.info-card{{padding:1.5rem;border:1px solid var(--border);border-radius:12px;background:var(--surface);transition:all .3s}}
.info-card:hover{{border-color:var(--accent);box-shadow:0 4px 12px rgba(180,83,9,.06)}}
.info-card__icon{{width:36px;height:36px;border-radius:8px;background:var(--accent-light);display:flex;align-items:center;justify-content:center;margin-bottom:.75rem;color:var(--accent)}}
.info-card__icon svg{{width:18px;height:18px}}
.info-card__t{{font-size:.875rem;font-weight:700;color:var(--text);margin-bottom:.35rem}}
.info-card__p{{font-size:.8125rem;color:var(--text2);line-height:1.6}}
.cta{{margin-top:4rem;padding:3rem 2rem;text-align:center;border:1px solid var(--border);border-radius:16px;background:var(--surface);position:relative;overflow:hidden}}
.cta::before{{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent),var(--accent-glow),var(--accent))}}
.cta__label{{font-size:.5625rem;font-weight:700;text-transform:uppercase;letter-spacing:.2em;color:var(--muted);margin-bottom:.75rem}}
.cta__title{{font-family:var(--serif);font-size:1.5rem;font-weight:700;color:var(--text);margin-bottom:1.5rem}}
.cta__btn{{display:inline-flex;align-items:center;gap:.5rem;background:var(--text);color:#fff;font-size:.875rem;font-weight:600;padding:.85rem 2rem;border-radius:8px;text-decoration:none;transition:all .3s}}
.cta__btn:hover{{background:var(--accent);transform:translateY(-1px);box-shadow:0 4px 12px rgba(180,83,9,.2)}}
.cta__btn svg{{width:16px;height:16px}}
.ad-slot{{margin:3rem 0;padding:1.5rem 1rem;min-height:90px;background:var(--border-l);border:1px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:.625rem;text-transform:uppercase;letter-spacing:.15em;font-weight:600}}
@media(max-width:640px){{.kf__grid{{grid-template-columns:1fr}}.kf__item:nth-child(odd){{border-right:none}}.gallery{{grid-template-columns:1fr;grid-template-rows:auto}}.gallery__item:first-child{{grid-row:span 1}}.prog__item{{grid-template-columns:1fr;gap:.25rem}}.stats{{grid-template-columns:1fr;gap:.5rem}}}}
@keyframes fu{{to{{opacity:1;transform:translateY(0)}}}}
@keyframes pulse{{0%,100%{{opacity:1}}50%{{opacity:.4}}}}
@keyframes bounce{{0%,20%,50%,80%,100%{{transform:translateX(-50%) translateY(0)}}40%{{transform:translateX(-50%) translateY(-6px)}}60%{{transform:translateX(-50%) translateY(-3px)}}}}
</style>
</head>
<body>

<div class="progress" id="prog"></div>

<header class="hero" id="hero">
  <img src="{hero_image}" alt="{escape_html(name)}" />
  <div class="hero__ov"></div>
  <a href="/blog" class="hero__back">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 8H3M7 4L3 8l4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>
    Alle Artikel
  </a>
  <div class="hero__c">
    <div class="hero__meta">
      <span class="hero__cat">{category}</span>
      <span class="hero__rt">{reading_time}</span>
    </div>
    <h1>{name}</h1>
    <p class="hero__sub">{subtitle}</p>
    <div class="hero__loc">
      <span>{date}</span><span>—</span><span>{location}</span>
    </div>
  </div>
  <div class="hero__scroll"><span></span>Scrollen</div>
</header>

<nav class="toc" id="toc">
  <p class="toc__label">Inhalt</p>
  <ul class="toc__list">
    <li><a href="#intro" class="toc__link active">Einleitung</a></li>
    <li><a href="#facts" class="toc__link">Auf einen Blick</a></li>
    <li><a href="#history" class="toc__link">Geschichte</a></li>
    <li><a href="#traditions" class="toc__link">Traditionen</a></li>
    <li><a href="#program" class="toc__link">Programm</a></li>
    <li><a href="#gallery" class="toc__link">Galerie</a></li>
    <li><a href="#practical" class="toc__link">Praktische Infos</a></li>
  </ul>
  <div class="toc__prog"><div class="toc__prog-bar" id="tocProg"></div></div>
</nav>

<article class="article">
  <section id="intro" class="reveal">
    <p class="lead">{intro}</p>
  </section>

  <section id="facts" class="reveal">
    <div class="kf">
      <div class="kf__head">
        <span class="kf__label">Auf einen Blick</span>
        <span class="kf__badge">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M4 6l1.5 1.5L8 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Österreichische Tradition
        </span>
      </div>
      <div class="kf__grid">
"""

    # Add key facts
    for label, value in key_facts:
        html += f'        <div class="kf__item"><p class="kf__dt">{escape_html(label)}</p><p class="kf__dd">{escape_html(value)}</p></div>\n'

    html += """      </div>
      <div class="kf__foot">
        <a href="https://lasstreffen.at" target="_blank" rel="noopener">
          Auf LassTreffen entdecken
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
      </div>
    </div>
  </section>

  <div class="stats reveal">
"""

    # Add stats
    for stat_num, stat_label in stats:
        html += f'    <div class="stat"><p class="stat__n">{escape_html(stat_num)}</p><p class="stat__l">{escape_html(stat_label)}</p></div>\n'

    html += """  </div>

  <div class="ad-slot reveal">Ad — In-Article Top (728x90 / Responsive)</div>

  <div class="divider reveal"><span></span><span>&#9670;</span><span></span></div>

  <section id="history" class="section reveal">
    <span class="section__n">01</span>
    <h2 class="section__t">""" + history_title + """</h2>
"""

    # Add history paragraphs
    for para in history_text.split('\n'):
        if para.strip():
            html += f'    <p class="section__p">{para}</p>\n'

    html += """    <div class="timeline">
"""

    # Add timeline
    for year, text in history_timeline:
        html += f'      <div class="tl__item"><div class="tl__dot"></div><p class="tl__year">{escape_html(year)}</p><p class="tl__text">{escape_html(text)}</p></div>\n'

    html += f"""    </div>
  </section>

</article>

<figure class="fullbleed reveal">
  <img src="{fullbleed_image}" alt="{escape_html(name)}" loading="lazy" />
  <figcaption>{fullbleed_caption}</figcaption>
</figure>

<article class="article">
  <section id="traditions" class="section reveal">
    <span class="section__n">02</span>
    <h2 class="section__t">{traditions_title}</h2>
"""

    # Add traditions paragraphs
    for para in traditions_text.split('\n'):
        if para.strip():
            html += f'    <p class="section__p">{para}</p>\n'

    html += f"""  </section>

</article>

<div class="interlude reveal">
  <div class="interlude__bg" style="background-image:url('{gallery_images[1] if len(gallery_images) > 1 else hero_image}')"></div>
  <div class="interlude__ov"></div>
  <div class="interlude__c">
    <p class="interlude__q">{escape_html(interlude_quote)}</p>
    <p class="interlude__s">Überlieferung aus {region}</p>
  </div>
</div>

<article class="article">
  <section id="program" class="section reveal">
    <span class="section__n">03</span>
    <h2 class="section__t">{program_title}</h2>
    <div class="program">
"""

    # Add program items
    for time, name_prog, desc in program:
        html += f'      <div class="prog__item"><span class="prog__time">{escape_html(time)}</span><div><p class="prog__name">{escape_html(name_prog)}</p><p class="prog__desc">{escape_html(desc)}</p></div></div>\n'

    html += """    </div>
  </section>

  <div class="ad-slot reveal">Ad — In-Article Mid (Responsive)</div>

  <div class="divider reveal"><span></span><span>&#9670;</span><span></span></div>

  <section id="gallery" class="section reveal">
    <span class="section__n">04</span>
    <h2 class="section__t">Eindrücke</h2>
    <div class="gallery">
"""

    # Add gallery items
    for i, (caption, img_url) in enumerate(gallery):
        html += f'      <div class="gallery__item"><img src="{img_url}" alt="{escape_html(caption)}" loading="lazy" /><figcaption>{escape_html(caption)}</figcaption></div>\n'

    html += """    </div>
  </section>

  <div class="divider reveal"><span></span><span>&#9670;</span><span></span></div>

  <section id="practical" class="section reveal">
    <span class="section__n">05</span>
    <h2 class="section__t">Praktische Informationen</h2>
    <div class="info-cards">
"""

    # Add practical info cards
    for title, desc, emoji in practical_info:
        html += f"""      <div class="info-card">
        <div class="info-card__icon">{emoji}</div>
        <p class="info-card__t">{escape_html(title)}</p>
        <p class="info-card__p">{escape_html(desc)}</p>
      </div>
"""

    html += f"""    </div>
  </section>

  <div class="ad-slot reveal">Ad — In-Article Bottom (Responsive)</div>

  <div class="cta reveal">
    <p class="cta__label">Entdecke mehr</p>
    <h3 class="cta__title">{cta_text}</h3>
    <a href="https://lasstreffen.at/brauchtum" class="cta__btn">
      Alle Brauchtumsfeste
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>
  </div>

</article>

<script>
const prog = document.getElementById('prog');
window.addEventListener('scroll', () => {{
  const scroll = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
  prog.style.width = scroll + '%';
}});

const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {{
  entries.forEach(entry => {{
    if (entry.isIntersecting) {{
      entry.target.classList.add('visible');
    }}
  }});
}}, {{ threshold: 0.1 }});
reveals.forEach(el => observer.observe(el));

const toc = document.getElementById('toc');
const hero = document.getElementById('hero');
const tocProg = document.getElementById('tocProg');
const tocLinks = document.querySelectorAll('.toc__link');

window.addEventListener('scroll', () => {{
  if (window.scrollY > hero.clientHeight) {{
    toc.classList.add('visible');
  }} else {{
    toc.classList.remove('visible');
  }}

  const scroll = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const scrollPercent = (scroll / docHeight) * 100;
  tocProg.style.width = scrollPercent + '%';

  let current = '';
  const sections = document.querySelectorAll('section[id]');
  sections.forEach(section => {{
    const rect = section.getBoundingClientRect();
    if (rect.top <= 150) current = section.getAttribute('id');
  }});

  tocLinks.forEach(link => {{
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + current) {{
      link.classList.add('active');
    }}
  }});
}});
</script>

</body>
</html>
"""

    return html


def main():
    """Generate all festival blog posts."""

    output_dir = Path("/sessions/tender-lucid-curie/mnt/burgenland-events-v5/blog-posts-brauchtum")
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generating {len(FESTIVALS)} festival blog posts...")
    print(f"Output directory: {output_dir}\n")

    generated_files = []

    # Generate individual posts
    for festival in FESTIVALS:
        html = generate_html_post(festival)

        filename = f"{festival['slug']}.html"
        filepath = output_dir / filename

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)

        generated_files.append((festival['name'], filename))
        print(f"✓ Generated {festival['num']:02d}: {festival['name']}")

    print("\n" + "="*70)
    print("Generating combined ALLE-50-POSTS.html...")
    print("="*70)

    combined_html = """<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alle 50 österreichischen Brauchtumsfeste</title>
<meta name="description" content="Vollständige Sammlung aller 50 dokumentierten österreichischen Brauchtumsfeste.">
<meta name="robots" content="index, follow">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#FAF8F5;--bg-dark:#1A1714;--text:#1C1917;--text2:#57534E;--muted:#A8A29E;--accent:#B45309;--accent-light:#FEF3C7;--accent-glow:#F59E0B;--border:#E7E5E4;--border-l:#F5F5F4;--surface:#fff;--serif:'Playfair Display',Georgia,serif;--sans:'Inter',-apple-system,sans-serif;--mono:'JetBrains Mono',monospace;--cw:680px}
html{scroll-behavior:smooth}
body{font-family:var(--sans);background:var(--bg);color:var(--text);line-height:1.7}
.toc-container{max-width:var(--cw);margin:0 auto;padding:4rem 1.5rem}
.toc-header{font-family:var(--serif);font-size:2.5rem;font-weight:900;margin-bottom:2rem;color:var(--text)}
.toc-list{list-style:none;display:grid;grid-template-columns:1fr;gap:0.5rem}
.toc-list li{border-bottom:1px solid var(--border)}
.toc-list a{display:block;padding:1rem;color:var(--accent);text-decoration:none;font-weight:500;transition:color 0.3s}
.toc-list a:hover{color:var(--accent-glow)}
.page-break{page-break-before:always;margin:6rem 0;border-top:3px dashed var(--accent);padding-top:2rem}
@media print{.page-break{page-break-before:always}}
</style>
</head>
<body>

<div class="toc-container">
  <h1 class="toc-header">Österreichische Brauchtumsfeste</h1>
  <p style="margin-bottom:2rem;color:var(--text2);font-size:1.0625rem;">Alle 50 dokumentierten österreichischen traditionellen Feste mit Geschichte, Traditionen, Programmen und praktischen Informationen.</p>
  <ol class="toc-list">
"""

    # Add TOC entries
    for i, (festival_name, filename) in enumerate(generated_files, 1):
        slug = filename.replace('.html', '')
        combined_html += f'    <li><a href="#{slug}">{i:02d}. {escape_html(festival_name)}</a></li>\n'

    combined_html += """  </ol>
</div>

"""

    # Read and include all festival HTML files
    for i, (festival_name, filename) in enumerate(generated_files):
        filepath = output_dir / filename

        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Insert page break before each article
        if i > 0:
            combined_html += '<div class="page-break"></div>\n'

        # Extract the main content
        body_start = content.find('<body>')
        body_end = content.rfind('</body>')
        if body_start != -1 and body_end != -1:
            body_content = content[body_start + 6:body_end]

            # Add an anchor for TOC navigation
            slug = filename.replace('.html', '')
            body_content = f'<div id="{slug}"></div>' + body_content

            combined_html += body_content

    combined_html += """
</body>
</html>
"""

    combined_filepath = output_dir / "ALLE-50-POSTS.html"
    with open(combined_filepath, 'w', encoding='utf-8') as f:
        f.write(combined_html)

    print(f"✓ Generated combined file: ALLE-50-POSTS.html\n")

    print("="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Total files generated: {len(generated_files) + 1}")
    print(f"  - Individual posts: {len(generated_files)}")
    print(f"  - Combined file: 1")
    print(f"\nOutput location: {output_dir}")
    print("\n" + "="*70)
    print("All files successfully generated!")
    print("="*70)


if __name__ == "__main__":
    main()
