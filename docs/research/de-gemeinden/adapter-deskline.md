# DE-Adapter Feratel Deskline (fn-29 Rest-Adapter, Prüfstand 2026-11-07)

Die Registry führt 115 Gemeinden mit Integration `deskline` (plus 23 über Amt/VG), vor
allem an der Mosel, im Allgäu, in der Eifel und in Hessen. Die Gemeindeseiten betten
das Deskline-Widget DW5 ein (`resc.deskline.net/DW5/start/<Owner>/<GUID>/index.js`,
Mechernich als iframe auf `web5.deskline.net/NORDEIFEL/<GUID>/de`). Der Schlüssel der
WebAPI steht nicht auf der Seite, sondern im Tag-Kontext des Widgets
(`resc.deskline.net/DW5/tags/<owner>/<GUID>/tagcontext.js`, Feld `linkKey`: Zeller Land
„ZELL" → `rptzell`, Bad Sobernheim „SOBERNHEIM" → `naheglan`). Mit dem Linkkey liefert
dieselbe WebAPI wie für Österreich (`FeratelScraper.ts`, Header `DW-Source` und
`DW-SessionId`) die Termine als JSON: naive Wandzeit, Dauer, Veranstaltungsort
(`place`), genannter Ort (`town`), Koordinaten, Kriterienbaum, Bilder mit Lizenz.

Adapter `de-deskline` (`src/lib/scrapers/de/DesklineDeScraper.ts`, Parser `deskline.ts`):
Seite lesen, Widget finden, Tag-Kontext lesen, Liste der WebAPI seitenweise (400 je
Seite, höchstens fünf Seiten), ohne Detail-Abfrage. Mehrere Gemeinden teilen einen
Linkkey (Zeller Land: 13 Gemeinden); die API wird je Linkkey einmal gelesen.

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Linkkey nur im Tag-Kontext | `webapi.deskline.net/zell/de/events` → 400 „Linkkey with name 'zell' is not found", `tagcontext.js` → `rptzell` | Tag-Kontext je Widget einmal lesen |
| Ein Linkkey liefert die Region, nicht die Gemeinde | `rptzell` auf stadt-zell-mosel.de: 97 Termine, auch Wittlich und Trier; `moselneu` auf neumagen-dhron.de: 1.942 Termine der ganzen Mosel | Nennt `town` einen anderen Ort als die Gemeinde der Seite oder ihre Ortsteile, bekommt der Termin weder PLZ noch Mittelpunkt der Seiten-Gemeinde (`ownTown`); der Resolver arbeitet mit dem genannten Ort. Vorher: 443 Zeilen `no_position` (PLZ von Zell an Terminen in Wittlich), nachher 10 |
| 00:00 ohne Dauer ist ohne Uhrzeit | `moselneu`: 72 von 400 Terminen mit `T00:00:00` und Dauer 0 | Datum ohne Uhrzeit |
| Serien stehen mit ihrem nächsten Termin in der Liste | `hasMoreDates` bei 266 von 400 (`moselneu`) | Eine Zeile je Serie (wie in Österreich ohne Detail-Abfrage); der Nachtlauf zieht den nächsten Termin nach |
| Termine außerhalb Deutschlands | Länderfeld der WebAPI | ausgelassen (Zähler im Log) |
| Linkkey nicht konfiguriert | `winterberg`, `pirna`, `wehlen` → HTTP 422 „not configured correctly" | Kalender zählt als Fehler |
| Kein DW5-Widget auf der Seite | 47 von 80 Seiten: Vermieter-Login `webclient4.deskline.net/<Code>/de/Login` (Gerolsteiner Land, Pfronten, Wonnegau), TOSC5-Warenkorb (Hörnerdörfer), andere Seiten (Kastellaun „Eventrucksack", Bad Sobernheim ohne Kalender) | „kein Deskline-Widget" im Log; diese Gemeinden bleiben ohne Kalender |

Quelle ist die Kalenderseite der Gemeinde (die WebAPI ist keine Seite); `source_id` =
`deskline-<Event-ID>`. Kategorie und Tags aus dem Kriterienbaum wie in Österreich
(`feratel-facets.ts`), Bild mit Nachweis aus `copyright`/`author` der WebAPI, KI-Bilder
ausgelassen.

## Ergebnis (2026-11-07)

80 Seiten, 33 mit Widget, 23 Linkkeys (20 antworten), 3.761 Termine geliefert,
3.406 geschrieben (gleiche Event-ID über mehrere Seiten einmal), öffentlich 3.390,
Quarantäne 16 (`no_position` 10, `municipal_service` 5, `placeholder_location` 1).

| Prüfung | Deskline | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 5,3 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,07 % |
| Dubletten in der Quelle | 0,3 % | 1,1 % |

Stichprobe (30 öffentliche Zeilen) gegen die Detail-Antwort der WebAPI je Termin
(`/events/<dbCode>/<ID>`: Name, nächste Termine mit Uhrzeit, Veranstaltungsort): 30 von
30 Titel, Tag und Uhrzeit korrekt (ganztägige Zeilen: „00:00" ohne Dauer in der Quelle).
Das Widget auf stadt-zell-mosel.de zeigt dieselbe Liste (Zell 51, Zell-Kaimt 15, …),
rendert sie aber nur im Browser.

## Offen

* Detail-Abfrage (Adresse des Veranstaltungsorts, weitere Termine einer Serie) wie in
  Österreich mit Tagesbudget; bisher kommt der Ort aus `place`, `town` und Koordinaten.
* 47 Registry-Seiten ohne DW5-Widget (56 Gemeinden): die Vollerhebung erkannte Deskline
  am Vermieter-Login oder am TOSC5-Warenkorb; ein Kalender ist dort nicht eingebettet.
