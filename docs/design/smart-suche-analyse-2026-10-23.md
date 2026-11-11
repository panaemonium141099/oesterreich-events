# Smart-Suche: Befund und Neuausrichtung (2026-10-23)

Stand nach Code-Lektüre, 20 Live-Queries gegen `/api/search/semantic` und
`/api/search/chat`, UI-Test auf Desktop und Mobile (lasstreffen.at) und
30-Tage-Zahlen aus `analytics_events` (Prod-DB auf Hetzner).

## 1. Nutzung: das Feature findet praktisch nicht statt

30 Tage (23.09. bis 23.10.), ohne die Crawler-Welle vom 14.09.:

| Kennzahl | Wert |
|---|---|
| Pageviews gesamt | 80.907 |
| Pageviews /entdecken | 945 (657 Sessions) |
| Erstsuchen im Smart-Tab (`smart_search`) | 35 (31 Sessions) |
| Chat-Nachrichten gesamt | 62, davon 27 Follow-ups |
| Klicks auf eine vorgeschlagene Karte (`chat_entity_click`) | **1** |
| Timeline-Auswahl (`chat_entity_select`) | 3 |
| Gespeicherte Pläne | 1 |
| CTA-Klicks „Frag die KI" | 21 (11 Gemeinde-Hub, 6 Landing-Hero) |

Lesart: Etwa 5 % der /entdecken-Besucher probieren den Smart-Tab, rund ein
Drittel davon antwortet dem Concierge noch einmal, aber fast niemand klickt
ein Ergebnis an. Die Leute lesen den Text und gehen. Die Suche produziert
Antworten, aber keine Handlung.

Was die Leute tatsächlich tippen (alle 35 Queries gelesen): die Hälfte ist
der vorbefüllte Hub-CTA „Was kann man in <Kleingemeinde> unternehmen?"
(Poggersdorf, Pernitz, Schrattenbach, Unterwart …), also genau die Orte,
für die die Datenbank am wenigsten hat. Der Rest sind kurze Stichwörter
(„Gols", „Fest", „Halloween", „gansl esse", „24.10 steiermark",
„Blasmusik am 23.10", „Martin Walker baden"), keine Alltagssprache-Sätze.
Die sechs Beispiel-Chips wurden in 30 Tagen dreimal geklickt.

## 2. Was in der Engine kaputt oder schwach ist (belegt)

1. **Gemini-Intent fällt bei Last still aus.** Bei 10 Anfragen in 10 s
   lieferten ab der 7. Antwort alle Ergebnisse ohne `intent:ai`; 20 s später
   war der Intent wieder da (Free-Tier-Ratenlimit pro Minute). Der Fehler
   wird in Prod nicht geloggt (`if NODE_ENV === 'development'` in
   `extractIntentViaAI`), die Suche degradiert unsichtbar in den
   Wort-Fallback. Folge: die UI-Beispiele **„Techno-Party am Wochenende"**
   und **„Gratis Familienausflug am Wochenende"** lieferten **0 Treffer**
   (`/api/search/semantic`), während derselbe Text im Chat (OpenAI-Pfad)
   Treffer fand. Das Ergebnis einer Suche hängt davon ab, wie viele andere
   gerade suchen.
2. **Wort-Fallback nimmt die falschen Wörter.** „Konzert von Pizzera & Jaus"
   wird zu den Suchbegriffen `Konzert` + `von` (erste zwei Wörter ≥ 3
   Zeichen; „von" steht nicht in der Stoppwortliste) und liefert
   Senta Berger und John Williams. „Lauf 10km November" liest `10km` als
   Umkreis, „November" gar nicht, Treffer: ein Krampuslauf.
3. **Keine ehrliche Leere.** „oldtimer treffen niederösterreich" (Intent lief)
   zeigt selbstbewusst Kleidungstausch, Pensionisten-Heimnachmittag und
   eine Jahreshauptversammlung, weil Kategorie- und Facetten-Pfad immer
   etwas liefern und der Text-Pfad nichts. Nirgends steht „keine
   Oldtimer-Treffen gefunden".
4. **Serien werden nicht zusammengefasst.** „Weihnachtsmarkt Salzburg": 6 von
   8 Treffern sind zwei Märkte an je drei Tagen; „wandern tirol": dreimal
   Winterwandernacht. Acht Plätze, drei Inhalte.
5. **Ranking nach Score statt Nähe.** „kinderprogramm eisenstadt" zeigt
   zuerst 20. Dezember und April 2027, „Halloween im Familypark" (heute) auf
   Platz 5. Ohne Datumswort rankt `event_score`, nicht der Termin.
6. **Ortsnähe funktioniert nicht.** „therme in der nähe von wien" liefert
   0 Aktivitäten (Wien als Bundesland-Filter, 15-km-Gemeinde-Radius, kein
   Nachbar-Bundesland); „jazz" ohne Ort streut von Bludenz bis Mödling.
   Ein Standort des Nutzers wird nie abgefragt.
7. **Datenmüll in den Top-Treffern.** Titel „Jazzcafe Zwe, Floßgasse 4, 1020
   Wien, Österreich", `location_name = "Österreich"`, Uhrzeiten 00:00,
   HTML-Entities (`Doctors&#8217; After Hours`) ungedecodet in Chat-Karten.

## 3. Was in der Oberfläche nicht funktioniert (belegt)

1. **10 bis 17 Sekunden Leere.** Der Chat antwortet erst, wenn alles fertig
   ist; das „Streaming" zerlegt den fertigen Text nachträglich in
   Sechs-Wort-Häppchen. Der Nutzer sieht so lange nur einen blinkenden
   Cursor. Karten kommen erst nach dem Text.
2. **Rückfragen ohne Antwortmöglichkeit.** „Plan mir ein Date für Samstag"
   bringt vier Textfragen (Alter, Interessen, Ort, Budget). Darunter stehen
   die Chips „Eher indoor / Günstiger bitte / Mit Kindern", die zu keiner
   der Fragen passen. Wer antworten will, muss einen Absatz tippen.
3. **AdSense-Auto-Anzeigen in der Suche.** Google injiziert „Intent-Links"
   (`google-anno`) in den Intro-Text („er sucht live in allen [Events]
   … [Event planen]") und auf Mobile liegt der Anchor „Event planen"
   **genau über dem Eingabefeld**. Das ist ein Account-Setting, kein Code.
4. **Text doppelt.** Die Antwort zählt die Treffer als Liste auf und darunter
   stehen dieselben Treffer als Karten. Die Karten sind 56-px-Zeilen, kein
   Bild-Erlebnis. Der Concierge siezt (gpt-4o-mini ignoriert
   „freundlich-österreichisch").
5. **Der falsche Einstieg.** Die Top-Nav-Suche („Künstler, Event oder Ort
   suchen") ist der Ort, an dem Leute tippen; sie führt in die Liste. Der
   Smart-Tab ist ein zweiter, leerer Bildschirm. `smart-chips.ts`
   („Verstanden: Heute · Graz · Indoor") ist gebaut, getestet und wird
   nirgends gerendert.
6. **Nichts ist teilbar oder indexierbar.** Ergebnisse haben keine URL;
   `?q=` befüllt nur das Feld. Bei 70 % Google-Traffic lebt das Feature in
   einem Raum, den Google nie betritt.

## 4. Warum das Chat-Format das Kernproblem ist

Event-Entdeckung ist visuell und stöbernd: Poster, Datum, Ort, Preis, auf
einen Blick vergleichen. Ein Chat verlangt das Gegenteil: leere Seite,
formulieren, warten, Prosa lesen, dann klicken. Jede Stufe verliert
Nutzer, und die Zahlen zeigen genau das (35 Suchen, 1 Klick). Die Engine
darunter (Intent → Taxonomie → indexierte Queries) ist dafür nicht das
Problem; sie ist nur falsch verpackt.

## 5. Empfehlung: vom Chat zum geführten Planer

Reihenfolge nach Wirkung pro Aufwand.

### Stufe 0: Fundament reparieren (ohne Design, 1 bis 2 Tage)

- Intent-Fehler in Prod loggen und zählen; Intent über denselben
  Provider-Schalter wie der Chat (OpenAI in Prod) oder zweiter Gemini-Key.
  Kein Beispiel-Chip darf je 0 Treffer liefern (Test gegen Prod).
- Fallback-Wörter: Stoppwörter ergänzen, längste/seltenste Wörter statt der
  ersten zwei; Monatsnamen und „in der Nähe" parsen.
- Serien zusammenfassen (Titel + Venue), „+ 5 weitere Termine".
- Ranking: ohne Datumswort Termin-Nähe vor `event_score`.
- Ehrliche Leere: hat ein konkreter Suchbegriff keinen Text-Treffer, sagt
  die Antwort das und bietet Nachbarn an (anderes Bundesland, anderes
  Datum), statt Kategorie-Beifang zu zeigen.
- AdSense: Anchor + Intent-Links für `/entdecken` abschalten
  (AdSense → Automatische Anzeigen → Seitenausschluss), zusätzlich
  `google-anno-skip` auf dem Smart-Container.
- Du-Form im System-Prompt erzwingen, HTML-Entities decodieren.

### Stufe 1: Der Composer ist kein leeres Feld, sondern ein Formular aus Chips

Statt „Was hast du vor? Tipp ein …" vier Zeilen antippbarer Chips, die
zusammen die Query bilden; Freitext bleibt optional:

```
Wann      [Heute] [Morgen] [Wochenende] [Datum …]
Wo        [📍 Mein Standort] [Wien] [Graz] [Ort tippen …]
Mit wem   [Allein] [Date] [Freunde] [Familie] [Kinder]
Lust auf  [Party] [Konzert] [Kultur] [Natur] [Essen] [Markt] [Entspannen]
```

Das löst drei Probleme auf einmal: keine leere Seite, keine Rückfragen
als Textwand (Alter/Ort/Budget sind Chips, keine Fragen), und die
Queries werden für die Engine präziser als „Was kann man in Pernitz
unternehmen?". Standort per Geolocation ersetzt den 15-km-Blindflug.

### Stufe 2: Die Antwort ist ein Regal, kein Absatz

- Oben eine Zeile „Verstanden: Wochenende · Tirol · Familie" aus
  `smart-chips.ts` (existiert), jeder Chip entfernbar oder tauschbar.
- Darunter ein bis zwei Sätze Concierge („Samstag ist Bergherbst-Wetter,
  Sonntag regnet es: drei Outdoor-Ideen, zwei Indoor").
- Dann **Poster-Karten im Regal-Layout von PR #328** (Bild, Datum,
  Ort, Preis, Ticket-Badge), 6 bis 12 Stück, nicht 56-px-Zeilen. Die
  Karten erscheinen, sobald das Tool-Ergebnis da ist, der Text streamt
  danach. Wahrgenommene Wartezeit sinkt von 15 s auf 1 bis 2 s.
- Karten-Toggle „Karte/Liste": Treffer als Pins auf der bestehenden
  Mapbox-Karte, weil „in der Nähe" visuell ist.
- Wetter-Chip fürs Wochenende (open-meteo ist in der CSP schon erlaubt):
  bei Regen rückt Indoor automatisch nach vorn.

### Stufe 3: Rückfragen als Chips, nicht als Prosa

Das Modell liefert Rückfragen strukturiert (`{frage, optionen[]}`), die UI
rendert sie als Chip-Zeilen. Ein Tipp pro Frage, dann wird gesucht.
Keine Vier-Fragen-Liste, die niemand beantwortet.

### Stufe 4: Timeline als visuelles Ergebnis

„Mach mir einen Tagesplan" liefert heute Prosa mit „Nachmittag:". Stattdessen
eine vertikale Tagesleiste (Nachmittag → Abend → Nacht) mit den
ausgewählten Karten, Drag-and-drop, Fahrzeit zwischen Stopps, Speichern
als Plan, Teilen per Link. Das ist der sichtbare Payoff, der den Smart-Tab
von der Liste unterscheidet.

### Stufe 5: Dort auftauchen, wo die Leute sind

- Top-Nav-Suche: Eingaben mit ≥ 3 Wörtern, Fragezeichen oder Zeitwort
  („heute", „Wochenende") landen im Smart-Planer statt in der Liste.
- Listen-Tab ohne Treffer: „Nichts dabei? Lass den Planer suchen" mit den
  aktuellen Filtern vorbefüllt.
- Ergebnisseiten mit URL (`/entdecken?q=…` rendert serverseitig das Regal
  für die Deterministik-Variante ohne LLM), dazu programmatische
  SEO-Seiten „Was geht am Wochenende in <Bundesland>" aus derselben Engine
  ohne KI-Call. So bringt die Suche Google-Traffic, statt nur welchen zu
  kosten.
- Hub-CTA: statt „Was kann man in Schrattenbach unternehmen?" (leer) die
  Query auf den Bezirk oder 25-km-Umkreis vorbefüllen.

## 6. Was das kostet

Stufen 0 bis 2 brauchen keinen neuen Backend-Pfad: `runSmartSearch`
liefert schon `parsed.signals`, Karten-Daten und Aktivitäten; der
Regal-Code ist aus PR #328 da. Mehraufwand pro Suche: null zusätzliche
LLM-Calls (die Chip-Query spart eher den Rückfrage-Turn). Stufe 5 nutzt den
deterministischen Pfad (Regex + Facetten) ohne Gemini und ist damit
crawler-sicher.

## 7. Messen, ob es wirkt

Zielgrößen nach Umbau, gleiche Tabelle `analytics_events`:
Suchen pro /entdecken-Session (heute 5 %), Klickrate auf Karten je Suche
(heute 3 %), Timeline-Auswahl je Suche (heute 9 %), Zeit bis zur ersten
sichtbaren Karte (heute 10 bis 17 s), Anteil Suchen ohne `intent:ai`
(heute unbekannt, muss geloggt werden).
