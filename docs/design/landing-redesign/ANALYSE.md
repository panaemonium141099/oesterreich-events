# Startseite lasstreffen.at: Befund (29.10.2026)

Gemessen an der Live-Seite (Desktop 1440 px, Handy 390 px), am Code
(`src/app/[locale]/page.tsx`, `src/components/Landing/v4/*`, `src/lib/v4/get-landing-data.ts`)
und an den Zahlen im MASTERPLAN §2 (70 % Google-Traffic, 1,4 Seiten je Sitzung,
42 registrierte Nutzer). Klickdaten aus `analytics_events` konnte ich nicht lesen
(Produktions-Lesezugriff im Auto-Modus gesperrt); die Abfrage dafür steht am Ende.

## 1. Die Seite in Zahlen

| Messwert | Desktop | Handy |
|---|---|---|
| Seitenlänge | 5.804 px (6,4 Bildschirme) | 9.140 px (10,8 Bildschirme) |
| Höhe des Hero-Blocks | 619 px | 995 px |
| Erste Event-Karte des Rasters ab | 1.312 px | 2.226 px |
| Sektionen mit identischem Kopf (Eyebrow, H2, „Alle … ansehen“) | 10 | 10 |
| Großbuchstaben-Eyebrows insgesamt | 24 | 24 |
| Abgerundete Container-Kästen | 25 | 25 |
| Aktionen über der Falte (3 Buttons, Suche, 4 Trend-Chips) | 8 | 8 |
| Overlays beim ersten Besuch (Consent + Onboarding) | 2 | 2 |

## 2. Warum sich die Seite nach KI anfühlt

Die Muster, die generierte Seiten verraten, sind hier fast vollständig versammelt. Jedes
ist mit Code oder Screenshot belegt.

1. **Ein Sektions-Gerüst, zehnmal kopiert.** Jede Sektion ist Eyebrow (10,5 px,
   Versalien, Tracking 0,22 em) + H2 26 px + „Alle X ansehen ›“ rechts. Das ist die
   Tailwind-UI-Grammatik, die Sprachmodelle für jede Landingpage produzieren. Auf
   `/entdecken` heißt dieselbe Information Regal-Titel 21 px extrabold, Nebenzeile
   inline, „Alle anzeigen“. Die Startseite spricht eine andere Sprache als der Rest.
2. **Mitteldot-Tripel in den Eyebrows.** „Jede Woche · kostenlos · jederzeit abbestellbar“,
   „Nach Bezirk · ganz Österreich“, „Demnächst · Line-ups verfügbar“,
   „Personalisierung · meld dich an“. Vier Stück, alle nach demselben Schema.
3. **Die Oberfläche erklärt sich selbst.** „Wähle dein Bundesland, dann zeigen wir dir
   alle Events dort, oder du grenzt direkt auf einen Bezirk ein.“ Ein Event-Verzeichnis,
   das seine eigene Bedienung beschreibt, wurde nicht von jemandem gebaut, der Events
   zeigen wollte. Dazu Gedankenstriche in jeder zweiten Zeile (gegen die eigene Regel
   für Texte).
4. **„So geht’s: In drei Schritten unterwegs“** mit 01 / 02 / 03 in kursiver Serife ist
   das SaaS-Onboarding-Muster. Google-Besucher kommen, weil sie wissen wollen, was am
   Samstag los ist, nicht um ein Produkt zu lernen. Schritt 1 ist außerdem wieder
   „Künstler folgen“ (siehe Punkt 7).
5. **„Frag die KI“ mit Funkel-Icon** als dritter Hero-Button. Das Funkel-Icon ist das
   Erkennungszeichen schlechthin; auf `/entdecken` wurde der Chat am 23.10. schon aus
   gutem Grund zu einer Freitextsuche mit Regalen umgebaut.
6. **Kästen in Kästen.** Saison-Karte (rounded-3xl) im Hero, Künstler-Teaser (22 px) mit
   innerem Kasten (16 px), Newsletter-Kasten, So-geht’s-Kasten mit 1-px-Raster, Region-
   Kacheln mit Zähl-Pille. 25 abgerundete Container, nichts liegt frei auf der Fläche.
   `/entdecken` zeigt Poster-Karten ohne Rahmen.
7. **Fünf Kartenformen für dasselbe Objekt Event.** Saison-Listenzeile (56-px-Bild),
   V4CardHero (16:9 randlos), V4CardV (16:9 im Rahmen mit Datums-Eyebrow),
   Festival-Karte, und auf `/entdecken` die Poster-Karte (quadratisch, weißes
   Datums-Badge, Preis unten rechts). Ein Besucher lernt vier Layouts, bevor er eine
   Unterseite sieht.
8. **Hartkodierte „Trends“ und „Beliebt in Österreich“.** `TRENDS` in `HeroV4.tsx` nennt am
   29. Oktober FM4 Frequency (August) und Seefestspiele Mörbisch (Sommer) als Trend.
   `popularArtists` kommt nie aus der Datenbank; `getLandingDataInner` gibt immer
   `FALLBACK_ARTISTS` zurück (Bilderbuch, Wanda, Pizzera & Jaus). Statische Behauptungen
   wirken generiert, weil sie es sind.
9. **Schwarze Platzhalterflächen.** Festivals: vier Karten, deren Bilder im Screenshot
   dunkel bleiben; Wochenend-Raster: drei von sechs Karten mit Kategorie-Fallback ohne
   Foto. Daneben „Winterfest“ mit dem Untertitel „Circusvorstellungen Erwachsene 30 bis
   82 Euro, Kinder bis 15 Jahre 21 bis 26 Euro“ (ein Preisfeld als Beschreibung).
10. **Dekorativer Hintergrund-Glow** im Hero (zwei Radialverläufe bei 4 bis 6 % Deckung),
    unsichtbar, aber typisch.
11. **Zwei Overlays vor dem ersten Inhalt.** Consent-Banner plus Onboarding-Modal
    („Entdecke / Merke / Triff dich“), wobei Slide 3 die eingefrorenen Social-Features
    bewirbt (MASTERPLAN §8.6). Dazu der Tippfehler „Uberspringen“.
12. **Der Entwicklungs-Hinweis** („Diese Seite ist noch in Entwicklung“) als erstes
    sichtbares Element über dem Hero, auf jeder Seite, für jeden Google-Besucher.

## 3. Verstöße gegen Grundregeln

**Prioritäten stehen Kopf.** Der gefüllte Primär-Button im Hero heißt „Künstler suchen“
und führt zu `/artists`. Das ist das Feature für 42 registrierte Nutzer. Die Aktion,
für die 70 % der Besucher kommen (Events heute und am Wochenende), ist der sekundäre
Outline-Button. Die Karte bekommt im Hero gar keinen Einstieg mehr.

**Dasselbe Argument viermal.** Hero-Button „Künstler suchen“, dann `ArtistTeaserV4`
(427 px), direkt darunter `AnonFollowTeaser` (266 px, Überschrift „Wer sind deine
Lieblingskünstler?“), später „So geht’s“ Schritt 1. Auf dem Desktop liegen knapp 700 px
Login-Werbung zwischen Hero und der ersten Event-Sektion; auf dem Handy ist das ein
ganzer Bildschirm.

**Inhalts-Dubletten.** „Konzerte diese Woche“ zeigt Loveboat Trio, Sego und Deloraine,
also exakt die drei Musik-Karten, die eine Sektion weiter oben im Wochenend-Raster
stehen. Ursache: beide Abfragen sortieren nach `event_score` im 7-Tage-Fenster,
`concerts` wird nicht gegen `todayWeekend` entdoppelt.

**Score ist keine Redaktion.** Im „Heute & Wochenende“-Raster stehen „Rückbildung mit
Pilates, KinderCampus Höchst“ und „Tito & Tarantula … Österreich“ (ohne Ort). Beides
hat einen hohen Score, aber keine Startseiten-Relevanz. Die Saison-Karte dagegen ist
kuratiert (Tags plus Titel-Hinweise plus Admin-Pins) und wirkt genau deshalb stimmig.

**Festivals ohne Line-up unter „Festivals mit Line-up“.** Keine der vier Karten zeigt
Acts. Zwei davon sind Serien-Artefakte („Interpenetration 5. Nov. bis 20. Mai“, „On the
Couch“), die der Code-Kommentar in `get-landing-data.ts` selbst als Problem benennt.
Seit PR #335 gibt es `data/festivals-upcoming.json` mit Bild, Zeitraum und Lineup; die
Startseite liest es nicht.

**Erfundene Zustände auf der Karte.** Die Legende zeigt „Künstler im Line-up“ und „In
deinem Plan“ für anonyme Besucher, die weder Line-ups folgen noch einen Plan haben.
Die sechs Pins sind in `MapPreview.tsx` hartkodiert (Wien, Eisenstadt, Salzburg, Linz,
Graz, Innsbruck), keine echten Events.

**Zwei Wege zu den Regionen, zwei Looks.** Die Startseiten-Kacheln öffnen ein Modal mit
Bezirksliste und verlinken auf `/entdecken?bl=`. Die SEO-Hubs `/wien`, `/steiermark` usw.
haben seit 2e268e32 selbst das Regale-Layout, werden aber von der Startseite nicht
verlinkt. Auf `/entdecken` sind dieselben Regionen 150×96-Kacheln, die direkt zum Hub
gehen. Zusätzlich steht die Bezirkszahl auf jeder Kachel zweimal (Pille oben links,
Zeile unten) und jede Kachel trägt „Auswählen →“.

**Über der Falte auf dem Handy:** Hinweisbanner, Eyebrow, Slogan, drei Zeilen Text,
drei Buttons (umbrechend, „Frag die KI“ allein in Zeile 2), Suchfeld, Trend-Chips in
zwei Zeilen. Das erste Event (Saison-Karte) beginnt bei 631 px, das erste Event des
Rasters bei 2.226 px, also auf Bildschirm drei.

**Kleinkram, der sich summiert:** `data-track="cta_artist_search"` zweimal auf der Seite
(Hero und Teaser nicht unterscheidbar); Gewichte wechseln zwischen 700 (Startseite) und
800 (`/entdecken`); H1 60 px bold gegen H1 40 px extrabold; Newsletter-Kasten mitten
im Content-Fluss zwischen Festivals und Regionen.

## 4. Was nach vorne gehört, was weichen kann

Die Zahlen sagen: Besucher kommen über Google oder direkt, sehen 1,4 Seiten und gehen.
Die Startseite muss in einem Bildschirm beweisen, dass hier heute etwas los ist, und
in einem Klick dorthin führen.

**Prominenter:**

- **Die Events selbst, sofort.** Top-Picks-Bühne oder Saison-Bühne mit echten Fotos
  statt Text, Buttons und Chips. `/entdecken` macht das seit PR #328 vor.
- **Die Saison als Kurationslinie.** Das ist der Teil, der heute schon funktioniert
  (Halloween jetzt, Advent ab 14.11., Bälle ab 7.1.). Nicht als Seitenkasten, sondern
  als Bühne oder Band mit Poster-Karten.
- **Region als echter Einstieg.** Kacheln direkt auf die Hub-Seiten (`/wien`), ohne Modal.
- **Freizeitaktivitäten.** Zweite Inhaltssäule (fn-18: 9.471 Deskline-POIs, 73.912
  OSM-POIs), auf der Startseite heute nur bei Regen über 3 mm sichtbar. Ein Regal „Bei
  Regen“ oder „Ausflug am Sonntag“ mit Wetterbezug gehört dauerhaft hin.
- **Blog.** 64 Posts, täglicher Autowriter, SEO-Träger, auf der Startseite nicht vorhanden.
- **Festivals, aber kuratiert.** Aus `festivals-upcoming.json`: Bild, Zeitraum, drei Acts.
- **Tickets-Signal.** Preis-Badge auf der Poster-Karte wie auf `/entdecken`; das führt
  zu Events mit Eventim-Links, also zum Affiliate-Umsatz. Gepinnte Boost-Events
  (`landing_features`) bekommen den „Tipp“-Slot in der Saison.

**Kleiner oder weg:**

- Künstler folgen: einmal, unten, als Nutzen eines Kontos (eine Zeile, kein Kasten).
- „So geht’s“: weg.
- Kartenvorschau mit falscher Legende: weg; die Karte wird ein Einstieg („In meiner
  Nähe“) in Chips oder Kacheln.
- Newsletter: eine Zeile mit Formular am Seitenende, nicht ein Kasten in der Mitte.
- Entwicklungs-Hinweis: in die Fußzeile.
- Onboarding-Modal: weg (die Seite ist das Onboarding).
- Trend-Chips: nur mit echter Quelle (meistgeklickte Suchen der Woche), sonst weg.

## 5. Die drei Varianten

Alle drei nutzen die Bausteine von `/entdecken` (Regal, Poster-Karte, Top-Pick-Kachel,
Region-Kachel, Chips) und dieselbe Reihenfolge unter dem Kopf: Heute Abend, Dieses
Wochenende, Nach Region, Bei Regen, Festivals, Aus dem Blog, Newsletter-Zeile,
Konto-Zeile, Fußzeile. Sie unterscheiden sich nur im Kopf.

| | A Saison-Bühne | B Heute in Österreich | C Einstiege |
|---|---|---|---|
| Erster Eindruck | Stimmung: ein großes Foto der Saison | Angebot: Tipp des Tages plus vier Picks | Orientierung: wohin willst du |
| Saison | Panel auf der Bühne (4 Picks) | farbiges Band mit Poster-Karten | doppelt breite Kachel, darunter Regal |
| Suche | auf dem Bild, mit Schnell-Chips | unter dem Titel, mit Orts-Chips | zuerst, groß |
| Aufwand | Saison braucht je Fenster ein gutes Foto | am nächsten an `/entdecken`, kaum neue Bausteine | Kacheln brauchen tagesaktuelle Bilder |
| Risiko | Bild trägt alles, schlechtes Foto = schlechte Seite | Startseite und `/entdecken` könnten sich zu ähnlich sehen | sechs Kacheln verlangen sechs Entscheidungen |

**Meine Empfehlung ist B**, mit dem Saison-Panel aus A als Option für Fenster mit starkem
Bildmaterial (Advent, Silvester). B ist am konsistentesten mit `/entdecken` und den
Hubs, braucht keine neuen Komponenten (Top-Picks, Regale, Chips existieren), und der
Kopf („Donnerstag, 29. Oktober · 88.210 Events · ganz Österreich“) sagt in einer Zeile,
was die Seite ist. Der Unterschied zu `/entdecken` bleibt klar: die Startseite hat
Saison, Region, Freizeit, Festivals und Blog; `/entdecken` hat Filter und die Liste.

## 6. Offen: Klickdaten

Welche Startseiten-Aktionen tatsächlich genutzt werden, steht in `analytics_events`
(ClickTracker seit 2026-07). Abfrage auf dem Hetzner-Server:

```sql
select event_type, count(*) as klicks, count(distinct session_id) as sitzungen
from analytics_events
where created_at >= now() - interval '30 days'
  and page in ('/', '/en')
  and event_type <> 'page_view'
group by 1 order by 2 desc;
```

Erwartung nach den Masterplan-Zahlen: `event_click` und `landing_season_pick` weit vor
`cta_artist_search`. Wenn das stimmt, bestätigt es die Reihenfolge oben; wenn nicht,
gehört der Künstler-Einstieg zurück in den Kopf.
