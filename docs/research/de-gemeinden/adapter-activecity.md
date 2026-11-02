# DE-Adapter active-City (fn-29.15, Prüfstand 2026-11-02)

active-City ist das CMS der Advantic GmbH. Der Adapter `de-activecity`
(`src/lib/scrapers/de/ActiveCityDeScraper.ts`, Parser `activecity.ts`) liest die
Veranstaltungsliste der Registry-Einträge mit Merkmal `activecity` (51 Gemeinden, 31
Registry-URLs, 19 ohne URL) mit allen Folgeseiten. Er steht in `DE_SCRAPERS`, nicht im
Nachtlauf (fn-29.18). Abrufe über `BaseScraper.fetchHtml`, robots.txt je Website,
mindestens 1 s Pause. Teil von fn-29.15.

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Termin als `.event_wrapper` mit `data-sortdate` und `data-sorttime` (Ortszeit) | Lohne `data-sortdate="2026-10-30" data-sorttime="20:00"` | Beginn daraus; `00:00` heißt ganztägig (Vellmar „Energietag Vellmar“) |
| Datumszeile mit Spanne | Stadthagen „Fr 30. - Sa 31. Oktober 2026“, „Mi 04. November - Fr 04. Dezember 2026“ | letztes Datum mit Jahr ist das Ende (Tag) |
| Ort strukturiert | `.event_place_bezeichnung`, `_strasse`, `_ort` „49393 Lohne“ | Name, Straße, PLZ und Ort an den Resolver wie bei cEasy |
| Bild-Link vor dem Titel trägt dieselbe Klasse | Stadthagen, Vellmar: `a.event_teaser_link.event_teaser_image_link` | Titel aus `.event_teaser_title_link` |
| Reihen nur mit „Nächster Termin: TT.MM.JJJJ“, ohne `data-sortdate` und ohne Uhrzeit | Barntrup 20, Brieselang 20, Kalletal 15 | nicht gelesen (Uhrzeit nur auf der Detailseite) |
| Registry nennt eine Detailseite | Steinfurt `…/Veranstaltungen.htm/Veranstaltungen/Offener-Spieletreff.html` | Kalender = Pfad bis `.htm`, sonst ein Kalender-Link der Seite |
| robots.txt sperrt Seiten | Extertal, Felsberg, Schwalbach | nicht gelesen |
| Kein active-City | Kamenz (Contao), Eckelsheim (DokuWiki), Zittau, Hohenwestedt (PDF) | nicht gelesen |

Folgeseiten: `…/Veranstaltungen?event_regions=own&az=all&page=N`.

## Ergebnis

Lauf online (81 Abrufe): 31 Registry-Seiten, 7 Kalender (Lohne, Stadthagen, Langenfeld,
Bedburg, Neuenrade, Vellmar, Steinfurt). Geliefert 376, verworfen 0, geschrieben 376,
öffentlich 373, Quarantäne 3 (`municipal_service`).

| Prüfung | active-City | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 6,4 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,1 % |
| Dubletten in der Quelle | 0,0 % | 1,1 % |

Stichprobe (30 öffentliche Zeilen) gegen die Detailseiten: 30 von 30 Titel, Datum und
Uhrzeit korrekt, Ort 30 von 30 wie der Veranstaltungsort der Detailseite (Bedburg
„Agathator Alt-Kaster“, Stadthagen „Kulturzentrum Alte Polizei, Obernstr. 29“).

## Dorffest-Probe gegen die Quellseite

| Termin | Adapter | Quellseite |
|---|---|---|
| Rather Weihnachtsmarkt, Bedburg | 20.11.2026 16:00, Vorplatz der Kirche St. Lucia | Freitag 20.11.2026 16:00 bis 22:00 Uhr, Samstag 21.11.2026 16:00 bis 22:00 Uhr, an der St. Lucia Kirche in Bedburg-Rath |

Die Liste nennt nur den ersten Tag; der zweite Termin steht auf der Detailseite.

## Offen

* Reihen mit „Nächster Termin“ (Barntrup, Brieselang, Kalletal; 55 Einträge) brauchen die
  Detailseite je Reihe; nicht umgesetzt.
* 24 Registry-Seiten ohne lesbare Liste; eine nächste Erhebung kann sie anderen
  Integrationen zuordnen.
