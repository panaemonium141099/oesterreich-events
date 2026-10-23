# Smart-Suche: drei Mockup-Varianten (2026-10-23)

Statische, klickbare HTML-Mockups für den Umbau des Smart-Tabs auf /entdecken.
Befund dazu in `../smart-suche-analyse-2026-10-23.md`.

Leitgedanke in allen drei: **Freitext bleibt der Haupteingang.** Leute sollen
ihre Situation in eigenen Worten beschreiben („Bin Student und will heute
abend billig saufen gehen"). Was sich ändert, ist die Antwort: statt Prosa mit
Mini-Zeilen kommen Verstanden-Chips, ein Satz vom Concierge und Poster-Regale,
dazu eine Timeline, die sich aus den Karten füllt.

Szenario in allen Varianten ist genau diese Query. Die Treffer sind echte
Zeilen aus `/api/search/semantic` (23.10., Wien, heute Abend), Bilder und
Koordinaten aus der DB; Preise ohne DB-Wert sind mit `*` ergänzt, Öffi-Minuten
sind angenommen.

`index.html` öffnen und oben zwischen Varianten und Desktop/Handy wechseln.
Karten per + in die Timeline legen funktioniert in allen drei.

| Variante | Vorbild | Idee | Stärke | Schwäche |
|---|---|---|---|---|
| A `a-composer.html` | Perplexity-Startseite, Airbnb-Ergebnis | Großes Freitext-Feld als Bühne mit Beispielsätzen, Antwort als Regale nach Abendphase, Timeline als Seitenleiste | Klarster Einstieg, Regal-Code aus PR #328 wiederverwendbar, ein Bildschirm | Nachfragen wirken weniger natürlich als im Chat |
| B `b-karte.html` | Google Maps Explore | Freitext-Zeile, Treffer links, Karte rechts mit Standort und Route, Abend-Zeitachse unten | „Was liegt nah beieinander" wird sichtbar, Mapbox ist schon da | Dichter, am Handy klebt die Karte oben; Poster-Erlebnis kleiner |
| C `c-flow.html` | ChatGPT mit Karten, Perplexity-Antworten | Chat bleibt, aber jede Antwort ist Satz + Regale; Nachfrage-Chips entstehen aus der Antwort; Skeleton-Karten statt blinkendem Cursor | Kleinster Umbau, Follow-ups bleiben Gespräch, Streaming-Zustand gelöst | Scrollt bei langen Gesprächen weg, Timeline nur als Leiste |

## Was alle drei gemeinsam haben

- Freitext zuerst, Chips nur als Ergänzung oder als Rückspiegel („Verstanden:
  Heute Abend · Wien · bis 15 €"), jeder Chip abwählbar.
- Concierge-Text ist ein bis zwei Sätze mit Begründung, die Treffer sind
  Poster-Karten mit `why`-Zeile.
- Regale nach Phase des Abends statt einer flachen Liste (Vorglühen, Partys,
  nach Mitternacht, knapp daneben).
- Jede Karte hat ein +, die Auswahl wird zur Timeline mit Öffi-Minuten und
  Eintritt gesamt, speicherbar als Plan, teilbar an Freunde.
- Nachfragen als Chips, die zur Antwort passen, plus Freitext.

## Empfehlung

C als erster Schritt, weil es den heutigen Chat behält und nur die Antwort
umbaut (Regale, Verstanden-Chips, passende Nachfrage-Chips, echtes Streaming
mit Skeleton-Karten). Danach den Einstieg aus A übernehmen (großes Feld mit
Beispielsätzen statt leerem Composer) und den Karten-Umschalter aus B über
den Regalen anbieten.

Lokal ansehen: `python -m http.server 8765 --directory docs/design` und
`http://localhost:8765/smart-planer/`; `.claude/launch.json` hat dafür den
Eintrag `mockups`.
