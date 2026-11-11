# DE-Adapter destination.one (fn-29 Rest-Adapter, Prüfstand 2026-11-07)

Die Registry führt 119 Gemeinden mit Integration `destinationone` (plus 14 über Amt/VG):
Niedersachsen (Emsland, Osnabrücker Land, Samtgemeinden), Oberpfalz und Bayerischer
Wald, Schleswig-Holstein, Brandenburg, Thüringen. Die Gemeindeseiten betten die
Terminsuche einer Experience ein (`pages.destination.one/de/<experience>/default/
search/Event…` bzw. `pages.et4.de/…` als Script, iframe oder `data-experience`).
Dieselbe Experience liefert `meta.et4.de/rest.ashx/search/?experience=…&type=Event&
template=ET2014A.json` als JSON (Doku: ein Lizenzschlüssel ist nur „für nicht
öffentliche Projekte" nötig): Termine als `timeIntervals` mit Offset und Zeitzone,
Reihen mit `freq`/`weekdays`/`repeatUntil`, Ort mit Straße, PLZ, Gemeinde und
Koordinaten, Veranstalter, Preistext, Bilder mit Lizenz je Bild, Datensatz-Lizenz.

Adapter `de-destinationone` (`src/lib/scrapers/de/DestinationOneDeScraper.ts`, Parser
`destinationone.ts`): Seite lesen, Experience finden, Termine ein Jahr ab heute
seitenweise (500 je Seite, höchstens zehn Seiten). Mehrere Gemeinden teilen eine
Experience (Samtgemeinde Selsingen: sieben Seiten, `nordwaerts-orte`); die API wird je
Experience einmal gelesen.

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Nicht öffentliche Experiences | 14 von 50 antworten `INVALID_LICENSE` (Kiel, Herne, Castrop-Rauxel, Sylt, Steingaden, Landkreis Regensburg, …) | ausgelassen, Kalender zählt als Fehler; der Schlüssel der eingebetteten Seite wird nicht verwendet |
| Eine Experience ist die Region | `osnabruecker-land` auf der Seite von Bad Laer: 3.832 Datensätze, `seenland-oderspree` 3.503 | Ort aus Straße, PLZ, Gemeinde und Koordinaten des Termins; ein anderer Ort als die Gemeinde der Seite bekommt nicht deren Kontext (`ownTown`) |
| Reihen | `freq: Weekly` mit `weekdays` und `repeatUntil` (Moorbahn Burgsittensen), `Daily` | Vorkommen je Tag zur Wandzeit des Intervallbeginns (`toUtcInstant`), höchstens 30 je Datensatz, die nächsten zuerst |
| Dauerangebote | 353 Datensätze mit 40 und mehr Vorkommen lieferten 14.562 von 33.443 Zeilen (Ausstellungen, Ponyreiten, Öffnungszeiten) | wie bei Eventfrog: mindestens 15 Vorkommen in 30 Tagen ist kein Termin, Datensatz fällt weg |
| Ganztägig | `00:00:00+02:00` bis `00:00:00` des Folgetags (Hurricane Festival) | Datum ohne Uhrzeit, ein Termin je Tag |
| Ende als Platzhalter | `hideEnd: true` mit Ende 23:59 (Baltrum) | ohne Ende |
| Bildlizenzen | je Bild `CC0`, `CC-BY`, `CC-BY-SA`, auch `CC-BY-NC-ND` | nur CC0, CC-BY, CC-BY-SA, PD; Nachweis „Autor (Lizenz)" |
| Detailseite | `media_objects` `rel: canonical` (nordwaerts.de), sonst `pages.<host>/de/<experience>/default/detail/Event/<global_id>/<slug>` (Slug frei, geprüft 200) | Quelle = kanonische Seite, sonst Detailseite der Experience |
| Keine Experience auf der Seite | 7 von 84 Seiten (Sylt, Cuxhaven, Miltenberg, Bayerischer Wald, reiseland-brandenburg) | „keine destination.one-Experience" im Log |

`source_id` = `et4-<global_id>@<Beginn>` (ein Vorkommen je Zeile).

## Ergebnis (2026-11-07)

84 Seiten, 77 mit Experience, 50 Experiences (36 antworten), 40.264 Termine geliefert,
22.453 geschrieben (gleicher Termin über mehrere Experiences einmal), öffentlich 21.237,
Quarantäne 1.212 (`no_position` 1.076, `municipal_service` 112,
`region_contradicts_coords` 30).

| Prüfung | destination.one | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 1,6 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,07 % |
| Dubletten in der Quelle | 0,1 % | 1,1 % |

Stichprobe (30 öffentliche Zeilen) gegen die Detailseite der Experience im Browser
(die Seite rendert Termine nur mit JavaScript): 29 von 30 zeigen Titel, Tag und
Uhrzeit der Zeile („Di., 10 Nov. 07:00 - 13:00" bzw. Liste „Termine"); Baltrum
„Beginn des Schatzkofferspiels" (22.03.2027 10:00) zeigt auf der Seite keine Terminliste,
die API nennt den Termin mit `interval_first_match_start 2027-03-22T10:00`.

## Nachtrag 2026-11-11

Der Adapter liest auch die Experience-Seiten, die die Registry unter GeoCMS führt
(Saale-Unstrut: Balgstädt, Gleina, Goseck, Freyburg, Karsdorf); die Experience
`saale-unstrut-tourismus` ist öffentlich (393 Termine am 11.11.2026).

## Offen

* Lizenz der Datensätze: `attributes.license` (CC0, CC-BY, CC-BY-SA) liegt vor, wird
  noch nicht gespeichert; für die Quellenseite (`/quellen`) nachziehen.
* `freq` Monthly/Yearly kommt nur mit dem Startdatum.
