# Startseiten-Redesign: Analyse und drei Mockup-Varianten (2026-10-29)

`ANALYSE.md` hält fest, warum die heutige Startseite generiert wirkt, wo sie gegen
Grundregeln verstößt und welche Inhalte nach vorne gehören. Die Mockups bauen auf der
Regale-Sprache von `/entdecken` (PR #328) auf, damit Startseite und Unterseiten eine
Sprache sprechen.

## Entscheidung (29.10.2026, User)

Umgesetzt wird **D Tagesausgabe** (`d-tagesausgabe.html`). A, B und C bleiben als verworfene
Varianten liegen (zu nah am Regal-Template, Karte und Künstler folgen fehlten).

**Implementiert: Branch `claude/landing-page-redesign-e6dafa`, 2026-10-30, PR folgt**
(Epic fn-30, `src/app/[locale]/page.tsx`, Komponenten in `src/components/Landing/v4/`).

- Kopf: Datumszeile mit Wetter und Event-Zahl, Slogan „Bleib ned daham.“, Suche.
- Bühne aus vier Karten: **Tipp des Tages** (genau ein Veranstalter pro Tag aus
  `landing_features`, Kennzeichnung in der Umsetzung „Anzeige“ plus Sponsorname nach
  § 26 MedienG / § 6 ECG, nicht „Gesponsert“ wie hier zuerst geplant; ohne aktiven Boost
  eine redaktionelle Wahl nach Score ohne Label), **Saison** wie bisher, **Karte** mit den Pins der heutigen Events,
  **Diese Woche live** mit drei Künstlern.
- Diese Woche live muss ohne Login funktionieren: Künstler aus der Eventim-Quelle mit
  Terminen in Österreich in den nächsten sieben Tagen, stündlich rotiert. Eingeloggt stehen
  gefolgte Künstler mit anstehenden Terminen zuerst, der Rest wird aus der Rotation
  aufgefüllt. Der Feed liefert `artists` je Serie (ID, Name, Bild, Affiliate-Link), der
  Parser liest sie bisher nicht; der Import muss sie speichern.
- Darunter: Heute Abend als Programmliste, Wochenende als Poster-Spur, Regionen als Kacheln
  zu den Hub-Seiten, Festivals und Blog nebeneinander, Freizeit mit Wetterbezug, Newsletter
  als Zeile, Entwicklungs-Hinweis in der Fußzeile.
- Entfällt: Onboarding-Modal, beide Künstler-Teaser, „So geht’s“, Kartenvorschau mit
  Legende, Region-Modal, hartkodierte Trend-Chips und Künstlerliste.

Kosmetik-Regeln aus dem Feedback: Text bleibt in der Karte (Ellipsis), Listen füllen ihre
Karte bis unten; Folgen-Knöpfe immer gleich groß und an derselben Stelle; Regal-Spuren
enden an derselben rechten Kante wie alle anderen Bereiche, **auch auf /entdecken und den
Hub-Seiten** (`shelf-ui.tsx`, dort hängt die Spur heute mit negativen Rändern über);
Freizeit-Kacheln zeigen Fotos aus `poi_activities.images`.

`index.html` öffnen (lokal über einen statischen Server, z. B.
`python -m http.server 5179 --directory docs/design/landing-redesign`) und oben zwischen
Varianten und Desktop/Handy wechseln.

| Variante | Kopf | Idee |
|---|---|---|
| A `a-buehne.html` | Saisonbild als Bühne | Ein großes Foto der Saison (Martiniloben), darauf Slogan, Datum, Suche und Schnell-Chips; rechts die Saison-Picks als Panel |
| B `b-heute.html` | Kopf wie /entdecken | Titel links, Datum und Event-Zahl rechts, Suche mit Orts-Chips, Top-Picks-Bühne mit Tipp des Tages, Saison als farbiges Band |
| C `c-einstiege.html` | Suche zuerst | Slogan, große Suche, sechs Einstiegskacheln (Saison doppelt breit, Heute Abend, Wochenende, Konzerte, Karte) |

Unter dem Kopf sind alle drei gleich: Heute Abend, Dieses Wochenende, Nach Region,
Bei Regen (Freizeit), Festivals (kuratierte Ausgaben mit Programm), Aus dem Blog,
Newsletter und Konto als Zeilen, Fußzeile.

Inhalte sind echt (lasstreffen.at am 29.10.2026, `data/festivals-upcoming.json`,
Blog-Posts). Preise nur dort, wo `/entdecken` sie zeigte. Die Freizeit-Kacheln tragen
den Kategorie-Verlauf statt Fotos, weil die API die Deskline-Bild-URLs gekürzt liefert.
