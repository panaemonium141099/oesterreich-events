# DE-Adapter GeoCMS (fn-29 Rest-Adapter, Prüfstand 2026-11-11)

Die Registry führt 63 Gemeinden mit Integration `geocms` (plus 3 über Amt/VG), vor allem
in Sachsen-Anhalt, dazu Hessen, NRW, Niedersachsen, Thüringen und RLP. Die Seiten liegen
auf 33 Kalenderseiten. GeoCMS liefert die Termine als HTML-Liste mit Datumsfenster
(`min_date`/`max_date`, TT.MM.JJJJ) und Seitenblättern, je Termin eine Detailseite
`…/event/<ID>,<Mandant>/<slug>-TT-MM-JJJJ.html` mit Veranstaltungsort („PLZ Ort",
Straße), Text und Ticket-Link. Kein Feed, kein JSON-LD.

Adapter `de-geocms` (`src/lib/scrapers/de/GeocmsDeScraper.ts`, Parser `geocms.ts`):
Liste ein Jahr ab heute, den Pager-Links der Seite folgend (höchstens 15 Seiten), je
Termin die Detailseite (höchstens 80 je Kalender). `source_id` =
`geocms-<Host>-<Termin-Schlüssel>`, Quelle die Detailseite ohne Suchparameter.

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Vier Listenvorlagen | Köthen `article.gcevent-list-row` mit Kennung `event-…-YYYY-MM-DD-HH-MM` im Link-Titel; Nebra und Zerbst ohne Kennung, „07.11.2026 ab 11:00 Uhr"; Königswinter `li.media`, „17.10.2026 - 12.12.2026 von 09:30 Uhr bis 11:00 Uhr"; Oebisfelde Karten `div.card` mit `card-text date` | Ein Parser über den Detail-Link (`/event/<ID>,<Mandant>/…-TT-MM-JJJJ.html`), Uhrzeit aus Kennung oder Text der Zeile. Vorher las die Karten-Vorlage keine Uhrzeit: 66,4 % ohne Uhrzeit, Schwelle gerissen; danach 23,2 % |
| Pager-Parameter je Website verschieden | `gcevent[pager]` (Köthen), `btp_event[p_2_361_1081]` (Königswinter), `btp_event[p_1_29_1096]` (Oebisfelde) | Pager-Links der Seite (`a[data-offset]`), Datumsfenster angehängt |
| Detail-Links tragen die Suchparameter der Liste | Halberstadt `…/siegfried-07-11-2026.html?min_date=…&btp_event[…]=10` | Quelle ohne Query, sonst wechselt die `source_url` mit der Listenseite |
| Hoster drosseln Detailseiten | Köthen: nach rund 20 Abrufen `fetch failed`, direkt per curl 200 in 1,1 s; ebenso Zerbst, Nebra, Weida-Land | Nach drei Fehlern in Folge keine weiteren Detailseiten, der Rest kommt mit Datum, Uhrzeit und Ort aus der Liste (8 Kalender im Prüfstand) |
| Keine Termine | 11 Seiten (Kirchheimbolanden, Laatzen, Wethautal, Tangermünde, …): Seite ohne Terminliste oder leer im Fenster | „keine Termine" im Log |
| destination.one-Seite unter GeoCMS | Balgstädt, Gleina, Goseck (eigene Seite) und Freyburg, Karsdorf (über die VG): Kalender `pages.et4.de/de/saale-unstrut-tourismus/…`, eine öffentliche Experience mit 393 Terminen (11.11.2026) | liest `de-destinationone`, `de-geocms` lässt die Seite aus (`readsPage`); im Abdeckungsbericht stehen die fünf weiter unter GeoCMS, deren Termine zählen dort nicht |
| Seite fehlt | Muldestausee `veranstaltungskalender.html` HTTP 404, auch ohne Parameter | Kalender zählt als Fehler |

## Ergebnis (2026-11-11)

33 Seiten, 12 mit Terminliste, 502 Termine geliefert, 15 vom Sync verworfen
(`start_in_past`), 487 geschrieben, öffentlich 467, Quarantäne 20 (`no_position` 11,
`municipal_service` 9). Termine aus 12 Websites, öffentliche Termine in 17 Gemeinden.

| Prüfung | GeoCMS | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 23,2 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,07 % |
| Dubletten in der Quelle | 0,2 % | 1,1 % |

Stichprobe (30 öffentliche Zeilen) gegen die Quellseite: 15 live gegen die Detailseite,
15 antworteten am 11.11. nicht (Drosselung) und wurden gegen dieselbe Seite aus dem
Prüfstand-Cache geprüft (5 Detailseiten, 10 Listeneinträge). 30 von 30 Titel, Tag und
Uhrzeit korrekt (Köthen „Berufs- und Gewerbemesse": Liste „Samstag 13. März 2027, von
10:00 Uhr bis 17:00 Uhr", Zeile 13.03.2027 10:00).

## Nachtlauf

Gewicht 130 (gut zwei Stunden im Prüfstand). Die Shard-Aufteilung legt höchstens zehn
Adapter in einen Shard (`DE_MAX_ADAPTERS_PER_SHARD`, so viele startet ein Shard
gleichzeitig) und zählt nur Seiten, die ein Adapter liest; vorher verband
`pages.et4.de` GeoCMS mit der großen Gruppe in Shard 0 (11 Adapter).

## Offen

* Die Drosselung kostet Adressen: Termine ohne gelesene Detailseite haben nur den Ort der
  Liste. Ein Nachtlauf mit größerer Pause je Website (Crawl-delay fehlt in robots.txt)
  oder Fortsetzungs-Cursor wäre der nächste Schritt.
* 21 Seiten ohne lesbare Terminliste (11 leer, 2 ohne GeoCMS-Liste, Rest nicht lesbar).
