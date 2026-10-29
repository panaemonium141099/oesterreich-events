# DE-Adapter The Events Calendar (fn-29.7 Teil 1, Prüfstand 2026-10-29)

The Events Calendar (WordPress, „Tribe“) liefert über
`/wp-json/tribe/events/v1/events?per_page=50&start_date=…&end_date=…&page=N` je
Termin Titel, Wandzeit, `all_day`, Ort (`venue`: Name, Straße, PLZ, Ort, teils
`geo_lat`/`geo_lng`), Veranstalter, Kategorie, Kosten und die Detailseite. Der
Adapter `de-tribe` (`src/lib/scrapers/de/TribeDeScraper.ts`, Parser `tribe.ts`) liest
alle 226 Tribe-Kalender der DE-Registry, ein Jahr ab heute, seitenweise (höchstens 40
Seiten je Kalender). Er steht in `DE_SCRAPERS`, nicht im Nachtlauf (fn-29.18).

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| `utc_start_date` ist bei festem Versatz falsch | 229 von 7.280 Terminen mit „UTC+1“, „UTC+2“, „UTC+0“; Mellingen zeigt 18:00, meldet 15:00 UTC; Fuchstal hat die Zeitzone Europe/Helsinki | Wandzeit `start_date` als deutsche Ortszeit (Seite und iCal der Website zeigen sie) |
| 00:00 bis 00:00 ohne `all_day` heißt ohne Uhrzeit | Kaiser-Wilhelm-Koog „Volkstrauertag“ | ganztägig |
| ganztägig endet 23:59:59 des letzten Tags | Esthal „MGV Chorfreizeit“ 26. bis 28.03.2027 | Ende = letzter Tag einschließlich |
| HTML-Entitäten in Titeln | Mellingen „Vokalkonzert &#8222;Yuppies&#8220;“ | entschlüsselt |
| Detailseite leitet teils auf die Terminliste um | Fuchstal `/termin/weihnachtsfeier/` → 301 `/termine/` | Quelle bleibt die Termin-URL der REST-Antwort |
| robots.txt sperrt die REST-Route | gemeinde-wolken.eu, wehlen-online.de | ausgelassen |

Kosten (`cost`) gehen nach `price_text`. Das Beitragsbild (`image`, mit Maßen) wird mit
der Website als Bildnachweis übernommen, ohne Logo, Wappen und Platzhalter (`bild.ts`,
seit 2026-10-29). Titel mit HTML werden zu Text; ein durchgestrichener Titel (Artlenburg
„Pausiert: <s>Spiele-Abend</s>") heißt, der Termin findet nicht statt.
`source_id` = `tribe-<Host>-<Post-ID>`.

## Kalenderort und andere Gemeinde (alle DE-Adapter, `de/kontext.ts`)

Der Prüfstand fand Termine, die im Kalender einer Gemeinde stehen, aber eine andere
nennen: 39 Termine aus Biedenkopf, Gießen, Lollar, Wettenberg, Allendorf (Lumda) und
weiteren Orten im Marburger NOLIS-Kalender, „Kirchenkonzert in Nördlingen“ im Kalender von Reimlingen,
„Berlinreise“ mit Ort „Berlin“ in Bornheim. Ohne Adresse bekamen sie den Kalenderort.
Jetzt gilt für Termine ohne Adresse im Kalender einer Gemeinde:

* Ortsname gleich der eigenen Gemeinde, einem eigenen Ortsteil (PLZ-Referenz) oder einem
  Teil des Gemeindenamens („Sporthalle Neuenkirchen“ in Neuenkirchen-Vörden): Kalenderort.
* Ortsname als ganzes Wort oder Titel „in X“ nennt genau eine andere Gemeinde im Umkreis
  von 30 km: diese Gemeinde. Der Name mit Zusatz geht vor („Allendorf / Lumda“ ist
  Allendorf (Lumda), nicht Allendorf (Eder)); bleibt es mehrdeutig („Remise Allendorf“),
  kein Ort.
* Ortsname ist genau der Name einer ferneren Gemeinde: kein Ort, der Freigabevertrag hält
  den Termin zurück („Berlinreise“; auch „Kirchen“ als Ort eines Gottesdiensts, weil es
  die Gemeinde Kirchen (Sieg) gibt).

Wirkung (gezählt im Vorher/nachher der Prüfstände): an die genannte Gemeinde verschoben
Tribe 20, NOLIS 50, ionas 7; zurückgehalten Tribe 5, NOLIS 7, ionas 2.

## Ergebnis (2026-10-29)

Geliefert 7.250, geschrieben 7.250, öffentlich 6.706, Quarantäne 544
(`no_location_evidence` 268, `municipal_service` 151, `no_position` 126).

| Prüfung | Tribe | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 12,9 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,07 % |
| Dubletten in der Quelle | 0,4 % | 1,1 % |

ionas und NOLIS mit der neuen Kontext-Regel: alle Schwellen weiter eingehalten.

Stichprobe (30 öffentliche Zeilen, Seed 29) gegen das JSON-LD der Detailseite, wo es
fehlt gegen den iCal-Export der Website (`?ical=1`): 30 von 30 Titel, Datum und Uhrzeit
korrekt; Orte aus `venue` oder dem Kalender der Gemeinde, Ortsteile richtig zugeordnet
(Schwabering in Söchtenau, Niederstriegis in Roßwein, Strinz-Margarethä in Hohenstein).
Eine erste Stichprobe vor der Kontext-Regel war ebenfalls 30 von 30.

Dorffest gegen die Quellseite: „Bornheimer Kerwe Eröffnung“, Seite 03.09.2027 18:00 bis
23:30, Dorfgemeinschaftshaus, In den Weppen 1, 76879 Bornheim; Zeile 18:00 bis 23:30
Ortszeit, Gemeinde Bornheim.

## Offen

* Saalbelegungen als Termine („Hochzeit“ im Gemeindesaal Bodenrode) zeigt die Quelle so;
  keine Wortliste, bleibt sichtbar.
* Restliche Plugins von fn-29.7: Events Manager (iCal, Probe nur 8 Termine), DPCalendar
  (Google-Kalender mit RRULE), MEC und JEvents (Registry-Feeds in den Proben leer bzw.
  Kommentar-Feed), iCagenda (kein bestätigter Feed).
