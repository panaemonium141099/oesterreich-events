# DE-Adapter recon CMS / regiogate (fn-29 Rest-Adapter, Prüfstand 2026-11-07)

38 Gemeinden der Registry (Bayern, Hessen, NRW, RLP) laufen auf dem recon CMS der
regiogate GmbH (`cdn.regiogate.net`, `data-recon-lyb`). Die Kalenderseite listet die
kommenden Termine als Karten `div.card--event` (Chamerau 22, Bad Kissingen 24 am
07.11.2026): `datebox` mit Wochentag, Tag und Monat ohne Jahr und Uhrzeit, Überschrift,
Teaser; der Link `?ev[id]=<ID>` führt zur Detailseite `catalog-details` mit Datum,
Uhrzeit, Adresse (`events-address-title`, `-str`, `-ort` mit PLZ) und Text. Rheine zeigt
die Karten mit vollem Datum („08.11.2026, 11:00 Uhr bis 12:00 Uhr") und Ort. Einige
Websites nutzen eine zweite Detail-Vorlage (`catalog-details__datetime`: Tag,
Monatskürzel, Uhrzeit; Grünwald, Großlangheim). Fünf Websites verlinken zusätzlich einen
iCal-Export (`webcal://…/ics/<name>-termine.ics`, Bad Kissingen 500 Termine), der Rest
nicht; der Adapter liest deshalb überall die Karten.

Adapter `de-regiogate` (`src/lib/scrapers/de/RegiogateDeScraper.ts`, Parser
`regiogate.ts`): Karten der Kalenderseite, je Termin die Detailseite (höchstens 60).
Das Jahr fehlt in der Liste: die Seite zeigt nur kommende Termine, ein Tag vor heute
liegt im nächsten Jahr. `source_id` = `regiogate-<Host>-<ID>`, Quelle die Detailseite.

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Tag als Uhrzeit gelesen | Sinntal „St. Martinsumzug" stand mit 13:11 (Datum 13.11.) | Punkt nur mit „Uhr" dahinter zählt als Uhrzeit |
| Zweite Detail-Vorlage ohne `datebox` | Grünwald „Benefizkonzert" 10 / Nov / 19:00 Uhr | `catalog-details__datetime` gelesen; vorher 32,8 % ohne Uhrzeit, danach 14,0 % |
| Andere Listenvorlagen | Kronach `events-list-link`, Würzburg eigene Terminsuche, Straubing, Trier, Werneck | „keine Terminkarten" im Log (9 Seiten) |
| Server antwortet nicht | geroda.de, schondra.de, sulzthal.de, oberleichtersbach.de, Schweinfurt (Artikelseite) | Kalender zählt als Fehler |

## Ergebnis (2026-11-07)

38 Seiten, 24 mit Terminkarten, 229 Termine geliefert und geschrieben, alle öffentlich.

| Prüfung | regiogate | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 14,0 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,07 % |
| Dubletten in der Quelle | 0,9 % | 1,1 % |

Stichprobe (30 öffentliche Zeilen) gegen die Detailseite (Seitentext): 30 von 30
Titel, Tag und Uhrzeit korrekt (27 per Skript, die drei Seiten der zweiten Vorlage mit
„10 Nov 19:00 Uhr" von Hand gelesen).

## Offen

* Kronach-Vorlage (`events-list-link`) und die Terminsuche von Würzburg.
