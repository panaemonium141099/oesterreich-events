# Anhang zu 02-bayern.md: alle gestellten Anfragen und Rohnotizen (27.10.2026)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.3`. Alle Anfragen lesend (GET), ohne Konto,
Formular oder Mail. Teil A sind die Anfragen der Hauptsession, Teile B bis D die Rohnotizen der drei
Stichproben-Gruppen, unverändert übernommen (nur ein Gedankenstrich in einem zitierten Titel ersetzt).
Vor dem ersten Abruf einer Gemeinde-Website wurde deren robots.txt gelesen.

## A. Hauptsession

| # | Anfrage | Status |
|---|---|---|
| 1 | https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV3QAktuell.xlsx?__blob=publicationFile | 200 (1.872.608 Bytes) |
| 2 | https://heimatinfo-api-platform.azurewebsites.net/communes/search (Header `accept: application/json`, `callertype: web`) | 200 (648 Einträge) |
| 3 bis 9 | `https://heimatinfo-api-platform.azurewebsites.net/communes/<id>/events` für Stammham, Pürgen, Buttenheim, Buxheim, Aham, Adelzhausen, Riekofen | 7 × 200 |
| 10 | `meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&startdate=2026-10-27&enddate=2027-10-27&limit=3&q=city:"Bad Hindelang"` (Syntaxtest) | 200 |
| 11 bis 44 | dieselbe Suche mit `limit=500` und `q=city:"<Gemeinde>"` für alle 30 Stichprobengemeinden, bei 0 Treffern Schreibvarianten (Flintsbach 1, Pullach 3, Neuburg 3); je 4 s Pause | 34 × 200 |
| 45 | dieselbe Suche mit `q=area:"Bayern"`, `limit=500`, `offset=1000` (Herkunftsprobe) | 200 |
| 46 | https://www.evangelische-termine.de/robots.txt | 404 (HTML-Fehlerseite) |
| 47 | https://www.evangelische-termine.de/xml?eventtype=7&itemsPerPage=40&highlight=all | 200 |
| 48 | https://handbuch.evangelische-termine.de/anzeige-im-internet/ausgabe-parameter | 200 |
| 49 | https://www.evangelische-termine.de/xml?q=Kirchweih&itemsPerPage=30&highlight=all | 200 (`totalItems` 129) |
| 50 | https://www.evangelische-termine.de/xml?q=Feuerwehr&itemsPerPage=30&highlight=all | 200 (`totalItems` 92) |
| 51 | https://www.bayern.by/robots.txt | 302 |
| 52 | https://www.bayern.by/erlebnisse/veranstaltungen/ | 200 nach Weiterleitung auf https://erlebe.bayern/ |
| 53 | https://data.bayerncloud.digital/robots.txt | 200 (`Disallow: /`) |
| 54 | https://erlebe.bayern/robots.txt | 200 (`Allow: /`) |
| 55 | https://erlebe.bayern/ | 200 |
| 56 | https://erlebe.bayern/sitemap.xml | 200 |
| 57 | https://veranstaltungen.erlebe.bayern/robots.txt | 444 („beep boop“) |
| 58 | https://veranstaltungen.erlebe.bayern/region/ | 444 |
| 59 | HEAD Kirchweihkalender-PDF Landratsamt Roth (Link aus Websuche) | 405, nicht weiter abgerufen |
| 60 | https://modbox.cosmema.de/live/adelzhausen/GV49YWXXDZ | 200 (Ladeseite ohne Termine) |
| 61 | https://www.communice.de/robots.txt | 404 nach Weiterleitung auf inixmedia.de |
| 62 | https://www.communice.de/ | 200 nach Weiterleitung auf https://www.inixmedia.de/communice-web/ |
| 63 | https://www.inixmedia.de/robots.txt | 200 |
| 64 | https://www.inixmedia.de/communice-web/ (zweimal) | 200 |
| 65 | https://www.inixmedia.de/impressum/ | 200 |
| 66 | https://www.rce-event.de/robots.txt | 444 |
| 67 | https://www.rce-event.de/veranstaltungen/ | 444 |
| 68 | https://www.heimat-info.de/veranstaltungen/5a589d51-b8f0-43c6-ad36-ad9aa13acff4 | 200 |
| 69 | https://www.heimat-info.de/veranstaltungen/6e957dec-272c-4199-8171-9054a91c51ba | 200 |

Anfragen je Host: meta.et4.de 36, heimatinfo-api-platform.azurewebsites.net 8, evangelische-termine.de 4,
inixmedia.de 4 (davon 2 über Weiterleitung von communice.de), erlebe.bayern 3, alle übrigen höchstens 2.
An meta.et4.de gingen mehr als die übliche Handvoll Anfragen, weil die Spec die Zählung je
Stichprobengemeinde verlangt; alle mit Pause, keine leere Antwort. Dazu Websuchen (ohne eigene
Host-Anfrage) zu Kirchweihkalendern der Landkreise, AKDB, communice und RCE-Event.

## B. Gruppe a (Gemeinden 1 bis 10)


Downloads: `C:\Users\jonag\AppData\Local\Temp\claude\C--Users-jonag-Documents-Portfolio-burgenland-events-v5-fresh--claude-worktrees-epic-dhawan-fff797\c854d244-ed36-4105-ae84-74daeb29b648\scratchpad\by-a\` (Log: `log.txt`).
User-Agent für curl: `Mozilla/5.0 (compatible; lasstreffen-research/1.0; +https://lasstreffen.at)`.
Domains per Websuche (Wikipedia-Infobox, Bayernportal, Treffer) gefunden.

### Anfragen (URL, Status)

```
GET https://www.flintsbach.de/robots.txt -> 200 (Weiterleitung auf flintsbach.de)
GET https://www.stammham.de/robots.txt -> 200 (leer)
GET https://www.nonnenhorn.de/robots.txt -> 200
GET https://www.pullach.de/robots.txt -> 200
GET https://www.hohenpeissenberg.de/robots.txt -> 404
GET https://www.pappenheim.de/robots.txt -> 404
GET https://www.boebing.de/robots.txt -> 200
GET https://www.kastl-kem.de/robots.txt -> 200
GET https://www.puergen.de/robots.txt -> 200
GET https://www.painten.de/robots.txt -> 200 (leer)
GET https://flintsbach.de/ -> 200
GET https://www.stammham.de/ -> 200
GET https://www.pullach.de/ -> 200
GET https://www.hohenpeissenberg.de/ -> 200
GET https://www.pappenheim.de/ -> 200
GET https://www.boebing.de/ -> 200
GET https://www.kastl-kem.de/ -> 200
GET https://www.puergen.de/ -> 200
GET https://www.painten.de/ -> 200
GET https://veranstaltungen.flintsbach.de/robots.txt -> 200
GET https://veranstaltungen.pullach.de/robots.txt -> 200
GET https://veranstaltungen.flintsbach.de/flintsbach/ -> 200
GET https://veranstaltungen.pullach.de/pullach-i-isartal/ -> 200
GET https://veranstaltungen.flintsbach.de/1428/flintsbach-ainn/adventsmarkt-am-rathaus-e0f2f3b1486ad0696dd5048652e45607a.html -> 200
GET https://veranstaltungen.pullach.de/pullach-i-isartal/fahnenweihe-e91a72e911fd468274ccadf8bd7feeb2f.html -> 200
GET https://veranstaltungen.pullach.de/output.php?mode=vcs&hid=91a72e911fd468274ccadf8bd7feeb2f&id=1111 -> 200 text/calendar
GET https://www.stammham.de/veranstaltungen/ -> 200
GET https://www.stammham.de/veranstaltungen/adventsmarkt-313c21fc/ -> 200
GET https://www.painten.de/veranstaltungen -> 200 (Weiterleitung auf /wp-content/uploads/2026/10/Veraka2026-26.10.2026.pdf)
GET https://www.painten.de/mitteilungsblatt -> 200
GET https://www.boebing.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-01-01&end_date=2026-12-31 -> 200 JSON
GET https://www.hohenpeissenberg.de/freizeit-erholung/veranstaltungen/veranstaltungskalender -> 200
GET https://www.hohenpeissenberg.de/.../veranstaltungskalender/rss.xml?tx_communicecalendar_calendar[sourcePid]=15,286,1220,1274,42,1318,1319 -> 200 (2 Items)
GET https://www.hohenpeissenberg.de/.../veranstaltungskalender/ical-download?tx_communicecalendar_calendarical[action]=ical&...[eventlist]=533,523,527,626,82,92&cHash=... -> 200 (6 VEVENT)
GET https://www.pappenheim.de/stadt-ortsteile/veranstaltungen/kalender/?no_cache=1 -> 200
GET https://www.pappenheim.de/stadt-ortsteile/veranstaltungen/kalender/?id=520&no_cache=1&tx_events2_events[action]=listSearchResults&tx_events2_events[controller]=Event&tx_events2_events[search][search]=markt -> 200
GET https://www.pappenheim.de/stadt-ortsteile/veranstaltungen/kalender/detail/event/d/s/ts/2026-11-29/1400/t/4-bieswanger-weihnachtsmarkt-1364.html -> 200
GET https://www.kastl-kem.de/buergerservice/veranstaltungen -> 200 (Liste leer)
GET https://www.kastl-kem.de/typo3conf/ext/c3_planer/Resources/Public/JavaScript/c3planer.js -> 200 (nur Datumsfilter im Browser, kein Nachladen)
GET https://www.kastl-kem.de/fileadmin/user_upload/zielgruppen/News/Veranstaltungen/2026/2026-10_KEM-Journal_web.pdf -> 200
GET https://www.erntedankfest-kastl.de/robots.txt -> 404
GET https://www.erntedankfest-kastl.de/ -> 200
GET https://www.kemnath.de/robots.txt -> 200
GET https://www.kemnath.de/ -> 200
GET https://www.kemnath.de/buergerservice/veranstaltungen -> 200
GET https://kemevent.de/robots.txt -> 200
GET https://kemevent.de/de -> 200
GET https://www.puergen.de/unsere-gemeinde/termine/ -> 200 (leer)
GET https://www.puergen.de/gmoa-blattl/ -> 200
GET https://www.puergen.de/fileadmin/user_upload/gemeinde-puergen/gmoablattl/2026/2026_10.pdf -> 200 (5,4 MB)
GET https://www.vg-puergen.de/robots.txt -> 200
GET https://www.vg-puergen.de/ -> 200
GET https://www.vg-puergen.de/aktuelles-bekanntmachungen/termine/ -> 200 ("Keine Veranstaltung gefunden")
GET https://flintsbach.de/flintsbacher-bote/ -> 200
GET https://www.rottenbuch.de/robots.txt -> 200
GET https://www.rottenbuch.de/ -> 200
GET https://www.rottenbuch.de/tourismus/veranstaltungen/ -> 200
GET https://www.rce-event.de/robots.txt -> 200 (Disallow: /, Allow: /veranstaltungen/)
GET https://www.rce-event.de/veranstaltungen/ -> 404
WebFetch https://www.nonnenhorn.de/ (Claude-User, in robots.txt freigegeben)
WebFetch https://www.nonnenhorn.de/termine-und-feste-im-ueberblick/
WebFetch https://www.nonnenhorn.de/veranstaltungen/ (Kalender lädt per JS, im Inhalt leer)
WebFetch https://de-at.wordpress.org/plugins/rce-event/
```

Ein curl auf nonnenhorn.de mit UA „Claude-User" wurde vom Berechtigungssystem abgelehnt und NICHT ausgeführt.

### Nonnenhorn robots.txt
`User-agent: *` → `Disallow: /`. Freigegeben sind nur benannte Bots (Googlebot, Bingbot, ..., Claude-SearchBot, Claude-User, DeepSeekBot), für diese ist `*/feed/` gesperrt. Deshalb kein curl mit eigenem UA, nur WebFetch (Claude-User).

### Je Gemeinde

#### 1 Flintsbach a.Inn
- Website https://flintsbach.de/ (WordPress, Theme Enfold/avia, Real Cookie Banner). Startseite verlinkt https://veranstaltungen.flintsbach.de/flintsbach/.
- Kalender: RCE-Event („Powered by RCE-Event.de", Logo `powered-rce-event_medium_transparent.png`, Link http://www.rce.de/), Kundennummer 1428. Detailseiten `/1428/<ort>/<slug>-e<hash>.html`. Ortsschreibweisen gemischt (`flintsbach-a-inn`, `flintsbach-ainn`).
- Feed: je Termin vCalendar `https://veranstaltungen.flintsbach.de/output.php?mode=vcs&hid=<hash>&id=1428`. Kein JSON-LD, keine Event-Microdata.
- Dorffest-Beleg: „Adventsmarkt am Rathaus", Sa 28.11.2026 13:00, weitere Termine 29.11.2026 15:00, 27.11.2027, 28.11.2027. https://veranstaltungen.flintsbach.de/1428/flintsbach-ainn/adventsmarkt-am-rathaus-e0f2f3b1486ad0696dd5048652e45607a.html
- Amtsblatt: „Flintsbacher Bote" (monatlich, PDF), https://flintsbach.de/flintsbacher-bote/, z. B. /zexuksor/2026/10/Bote-Oktober-2026-Homepage.pdf. Verlag nicht belegt.
- Tourismus: Gastgeber über https://tportal.tomas.travel/flintsbach/ukv (TOMAS tportal, nur Unterkünfte). Kein Event-Widget.
- Feuerwehr: flintsbach.feuerwehren.bayern (aus Websuche, nicht abgerufen).

#### 2 Stammham (85134)
- Website https://www.stammham.de/ (WordPress + Elementor, Plugin `townhall.wordpress`, viele `cosmema-*`-Snippets, Button „Heimat-Info App", Link https://www.heimat-info.de/gemeinden/stammham mit Linktext-Zuordnung „Veranstaltungskalender").
- Veranstaltungen https://www.stammham.de/veranstaltungen/ serverseitig gerendert (TownHall), Slug mit 8-stelligem Hex-Suffix (`adventsmarkt-313c21fc`). Felder auf Detailseite: Titel, Start, Ort (Freitext), Text, Erstellt, Aktualisiert. Kein Event-JSON-LD (nur Yoast WebSite/Organization), kein iCal.
- Schluss: Heimat-Info-Daten über Cosmema-WordPress-Plugin eingebunden (Marker `plugins/townhall`). Gleichheit der Datensätze mit der Heimat-Info-API nicht selbst geprüft.
- Dorffest-Beleg: „Adventsmarkt", 22.11.2026 13:00, Gasthaus Rehm. https://www.stammham.de/veranstaltungen/adventsmarkt-313c21fc/
- Amtsblatt: nicht belegt.

#### 3 Nonnenhorn
- Website https://www.nonnenhorn.de/ auf Canvayo (Medien `media.canvayo.com`, Datenschutz `site.canvayo.com`; Matomo „lottaleben media gmbh"). robots.txt sperrt generische Bots.
- Kalender https://www.nonnenhorn.de/veranstaltungen/#/veranstaltungen (JS-Widget mit Hash-Routen wie auch #/unterkuenfte, #/prospekte; Hersteller nicht belegt). Übersicht https://www.nonnenhorn.de/termine-und-feste-im-ueberblick/ (Feste 2026, PDF „Download Termine"). Kein iCal/RSS gefunden.
- Dorffest-Beleg: Weihnachtsmärktle 04./05.12.2026; Winzerfest am See 14./15.08.2026; Schäfflertanz 17. bis 19.04.2026; Komm und See 03./04.07.2026 (Quelle: termine-und-feste-im-ueberblick).
- Amtsblatt: „Dorfspiegel" der Seegemeinden Nonnenhorn und Wasserburg, https://www.nonnenhorn.de/buergerinfo/dorfspiegel/ (Archivausgaben bei readkong als „Canvayo"). Verlag nicht belegt.
- Tourismus: Tourist-Info im Gemeindeauftritt, Echt-Bodensee-Card, Buchung buchen.echt-bodensee.de, Touren regio.outdooractive.com/oar-lindau-landkreis (nur Link). App: „Zeigmal. App" (https://www.nonnenhorn.de/zeigmal-app/).

#### 4 Pullach i.Isartal
- Website https://www.pullach.de/ (WordPress, Theme „pullach", Yoast). Kalender https://veranstaltungen.pullach.de/pullach-i-isartal/ = RCE-Event, Kunde 1111 (`rce/1111_pullach/...`), eingebettet als Seite „RCE-Veranstaltungen".
- vCalendar-Probe (output.php?mode=vcs&hid=...&id=1111): `PRODID:-//RCE Medien GmbH & Co. KG//RCE-Event//DE`, Felder `TZID`, `DTSTART`, `DTEND` (Wandzeit ohne Z), `UID`, `DTSTAMP`, `LOCATION` (Ort, Gemeinde), `DESCRIPTION`, `URL`, `SUMMARY`. Inhalt Latin-1 trotz `charset=utf-8`. Detailseite zusätzlich: Veranstaltungsort mit Straße/PLZ, Veranstalter mit Adresse/Telefon, „Quelle: Gemeinde Pullach i. Isartal". Kein JSON-LD.
- Dorffest-Beleg: „Fahnenweihe" (Soldatenkameradschaft, Andacht und Feier im Sportheim), 30.10.2026 17:00 bis 21:00. https://veranstaltungen.pullach.de/pullach-i-isartal/fahnenweihe-e91a72e911fd468274ccadf8bd7feeb2f.html ; außerdem „Kirta-Café der Senioren Union" 27.10.2026.
- Amtsblatt: kein Mitteilungsblatt gefunden; monatlicher E-Mail-Newsletter und „Bürgerinformation als E-Broschüre" auf der Startseite. Facebook/Instagram verlinkt.

#### 5 Hohenpeißenberg
- Website https://www.hohenpeissenberg.de/ (TYPO3, Agentur-Paket communice: `communice.js`, `communice-iconfont`, Extension `tx_communicecalendar`).
- Kalender https://www.hohenpeissenberg.de/freizeit-erholung/veranstaltungen/veranstaltungskalender, Kategorien Gemeinde/Senioren/Soziales, Formular „Veranstaltung einreichen".
- Feeds: RSS (`rss.xml?tx_communicecalendar_calendar[sourcePid]=...`, Felder title, link, guid „news-82", description mit Start/Ende als Text, content:encoded, category) und iCal (`PRODID:-//hacksw/handcal//NONSGML v1.0//EN`, Felder UID, DTSTAMP, DTSTART, DTEND, SUMMARY, LOCATION). Nur 6 kommende Termine (Seniorentreff, Yoga, Törggelen, Sitzungen).
- Dorffest-Beleg: nicht gefunden (Kalender S. 1, RSS, iCal, Websuche). Nur „Törggelen" 07.11.2026 Haus der Vereine.
- Amtsblatt: nicht belegt. Tourismus: Seite „Urlaub am Bayerischen Rigi", kein Widget erkannt. Facebook verlinkt.

#### 6 Pappenheim, Stadt
- Website https://www.pappenheim.de/ (TYPO3, Extension events2 von jweiland: `tx_events2_events`, `events2calendar`).
- Kalender https://www.pappenheim.de/stadt-ortsteile/veranstaltungen/kalender/?no_cache=1 (5 Seiten, Vereins- und Kirchentermine, Ortsteile). Suche per GET-Parameter `tx_events2_events[search][search]`.
- Detailseite: JSON-LD `@type Event` mit `startDate`, `endDate`, `name`, `description`, `url`, `location{@type Place, name, address{streetAddress, postalCode, addressLocality}}`, `organizer{name}`, `isAccessibleForFree`. Dazu iCal-Datei `typo3temp/tx_events2/iCal/event<datum><id>.ics`.
- Dorffest-Beleg: „4. Bieswanger Weihnachtsmarkt", So 29.11.2026 14:00 bis 20:00, Kreuter Doni, Kirchengasse 3, 91788 Bieswang. https://www.pappenheim.de/stadt-ortsteile/veranstaltungen/kalender/detail/event/d/s/ts/2026-11-29/1400/t/4-bieswanger-weihnachtsmarkt-1364.html ; außerdem „Pelzmärtelmarkt in Pappenheim" 07.11.2026.
- Amtsblatt: „Mitteilungsblatt/Rathaus-Info" (/stadt-ortsteile/rathaus/stadtverwaltung/mitteilungsblattrathaus-info.html), Verlag nicht belegt. Tourismus: eigene Rubrik /tourismus/, Links naturpark-altmuehltal.de und frankentourismus.de, kein Widget.

#### 7 Böbing (VGem Rottenbuch)
- Website https://www.boebing.de/ (WordPress 7.1.3, Kadence, The Events Calendar 6.x mit iCal `?ical=1` und REST `wp-json/tribe/events/v1/`).
- REST-Probe: 32 Termine 23.10. bis 29.11.2026 (ältere nicht mehr enthalten), Feldnamen u. a. `id, global_id, title, description, excerpt, url, start_date, end_date, utc_start_date, timezone (Europe/Berlin), all_day, cost, categories, tags, venue, organizer, image, modified`. `venue` und `organizer` in allen 32 leer.
- Dorffest-Beleg: „Adventsmarkt mit dem Frauenbund und den Bäuerinnen", 27.11.2026 15:00. https://www.boebing.de/veranstaltungen/adventsmarkt-mit-dem-frauenbund-und-den-baeuerinnen/
- Amtsblatt: „Böbinger Mitteilungsblatt" (zweimonatlich, z. B. /boebinger-mitteilungsblatt-september-oktober-2026/). Verlag nicht belegt.
- VGem Rottenbuch: https://www.rottenbuch.de/ (WordPress/Bricks, „VG-Rottenbuch", Klosterhof 42). Kalender https://www.rottenbuch.de/tourismus/veranstaltungen/ = iframe `//www.rce-event.de/output.php?id=1438&mode=L` (RCE-Event, Kunde 1438). Ob Böbinger Termine darin stehen: nicht geprüft, weil www.rce-event.de per robots.txt alles außer /veranstaltungen/ sperrt.

#### 8 Kastl (VGem Kemnath)
- Website https://www.kastl-kem.de/ (TYPO3, Extensions `c3_planer`, `c3accessibility`, `c3cookie`, `femanager`, tx_news). Kalender https://www.kastl-kem.de/buergerservice/veranstaltungen mit Registrierung für Veranstalter; am 27.10.2026 serverseitig leer, c3planer.js filtert nur vorhandene Zeilen.
- VGem Kemnath https://www.kemnath.de/ (TYPO3, gleiches Template). Kalenderseite verlinkt destination.one: `https://pages.destination.one/de/kemnath/default/search/Event/city%3Akemnath/...` und Eintragsformular `pages.destination.one/de/kemnath/default/announce/Event/edit` (nicht abgerufen, Hauptsession). kemevent.de ist nur die Veranstaltungsstätte „Foyer Kemnath" (KEMevent GmbH), kein Kastl-Bezug.
- Amtsblatt: „KEM-Journal" (monatlich, Herausgeber Stadt Kemnath, Auflage 4200, Gesamtherstellung Druckerei Weyh Medien, Marketing Druck- & Verlag GmbH, Kemnath), PDF auf kastl-kem.de und kemnath.de. Ausgabe 10/2026 hat Rubrik „Termine" mit Kastl-Vereinen (Kulturtreff Kastl 05.11.2026, Volkstrauertag 14.11.2026).
- Dorffest-Beleg: „Erntedankfest Kastl", 12.09. bis 14.09.2025, eigene Website https://www.erntedankfest-kastl.de/ (Festprogramm, Festumzug, Tickets). 2026: nicht gefunden (Kalender leer, KEM-Journal 10/2026, Websuche „Kirwa").

#### 9 Pürgen (VGem Pürgen)
- Website https://www.puergen.de/ (TYPO3, Agentur abavo GmbH: „abavo GmbH ... www.abavo.de", `tx_abavosearch`). Termine https://www.puergen.de/unsere-gemeinde/termine/ = tx_news, am 27.10.2026 leer. Kein Heimat-Info-Embed auf Startseite und Terminseite.
- RIS: https://ris.komuna.net/vgpuergen (komuna, nur Ratsinfo).
- VGem https://www.vg-puergen.de/ (TYPO3), Termine mit Filter VG/Hofstetten/Pürgen/Schwifting: „Keine Veranstaltung gefunden".
- Amtsblatt: „'s Gmoa-Blattl", monatlich, Herausgeber Gemeinde Pürgen, Druck EOS PRINT (Erzabtei 14a), PDFs /fileadmin/user_upload/gemeinde-puergen/gmoablattl/2026/2026_10.pdf. Ausgabe 10/2026 kündigt die neue Gemeinde-App Heimat-Info an und bittet Vereine, Termine künftig dort einzustellen.
- Dorffest-Beleg: Fahrzeugsegnung HLF 10 der Feuerwehr Lengenfeld mit Festzug, So 11.10.2026 (Gmoa-Blattl 10/2026, PDF oben); außerdem Weinfest Sa 07.11.2026 20:00 (gleiche Ausgabe, Veranstalter im Text nicht eindeutig gelesen).

#### 10 Painten, Markt
- Website https://www.painten.de/ (WordPress + Elementor, Plugin `townhall`, Cosmema-Snippets wie Stammham). /veranstaltungen leitet direkt auf PDF „Veranstaltungskalender Markt Painten 2026, Stand 26.10.2026" (https://www.painten.de/wp-content/uploads/2026/10/Veraka2026-26.10.2026.pdf).
- Dorffest-Belege (PDF): Maibaumfest 25.04.2026; 125 Jahre Feuerwehr Maierhofen 26. bis 28.06.2026; Kirchweih Maierhofen 09.08.2026; Kirchweih Rothenbügl 15.08.2026; Weihnachtsmarkt am Marktplatz 28.11.2026; Waldweihnacht der Feuerwehr Maierhofen 19./20.12.2026.
- Amtsblatt: „Mitteilungsblatt", https://www.painten.de/mitteilungsblatt/ (Dateien `BA-2026-09-Webseite.pdf` usw.), Verlag nicht belegt.
- App: „Boin-App wieder verfügbar" (Startseite). Heimat-Info nur als Linkmuster im Cosmema-Skript, kein Embed belegt.

### Hersteller-Merkmale (Zusammenfassung)
- RCE-Event (RCE Medien GmbH & Co. KG): Flintsbach (1428), Pullach (1111), VGem Rottenbuch (1438). Muster: Subdomain `veranstaltungen.<gemeinde>.de` mit eigener robots.txt (output.php erlaubt) oder iframe `www.rce-event.de/output.php?id=<kunde>&mode=L` (dort robots Disallow). Pro Termin vCalendar `output.php?mode=vcs&hid=<hash>&id=<kunde>`. WordPress-Plugin „rce-event" (RCE Medien) seit 03.12.2025 auf wordpress.org geschlossen (https://de-at.wordpress.org/plugins/rce-event/); laut Websuche-Snippet konnten Nichtkunden Termine für bis zu drei PLZ anzeigen (nicht selbst geprüft).
- Cosmema-WordPress mit `townhall`: Stammham, Painten.
- TYPO3 events2 (JSON-LD gut): Pappenheim. communice-Kalender (RSS+iCal): Hohenpeißenberg. The Events Calendar: Böbing. c3_planer: Kastl, Kemnath. abavo: Pürgen, VG Pürgen.
- destination.one: VGem Kemnath (Mandant `kemnath`).

## C. Gruppe b (Gemeinden 11 bis 20)


Downloads: `C:\Users\jonag\AppData\Local\Temp\claude\C--Users-jonag-Documents-Portfolio-burgenland-events-v5-fresh--claude-worktrees-epic-dhawan-fff797\c854d244-ed36-4105-ae84-74daeb29b648\scratchpad\by-b\`
User-Agent aller curl-Abrufe: `Mozilla/5.0 (research; lasstreffen.at)`. Nur GET.

### Anfragen (URL, Status)

#### 11 Bergkirchen (www.bergkirchen.de, 5)
- https://www.bergkirchen.de/robots.txt 200 (Umbraco, Disallow nur /umbraco/ usw.)
- https://www.bergkirchen.de/ 200
- https://www.bergkirchen.de/aktuelles-aus-bergkirchen/veranstaltungen/ 200
- https://www.bergkirchen.de/gemeinde/gemeindeblatt/ 200
- https://www.bergkirchen.de/media/24745/bergkirchen_buergerjournal_52_aug_sept_26_v3_web.pdf 200 (13,2 MB, einziges PDF, für Dorffest-Beleg)
- www.rce-event.de: https://www.rce-event.de/robots.txt 200 (`User-agent: *` / `Disallow: /` / `Allow: /veranstaltungen/`); https://www.rce-event.de/veranstaltungen/ 404. output.php NICHT abgerufen (robots).

Merkmale: Footer „CMS, © 2026 digitalfabriX“ mit title „akdb.digitalfabriX GmbH“ (AKDB-Tochter), Umbraco, Pfad `/komx/Surface/...`. Kalenderseite = Iframe
`https://www.rce-event.de/output.php?id=1248&mode=L&gembox=9174113` (gembox = AGS der Gemeinde). RSS nur News: `https://www.bergkirchen.de/aktuelles/newsrss/`.
Gemeindeblatt: „Bergkirchner Gemeindeblatt“ seit 1992, alle 2 Monate, Dateien heißen „bergkirchen_buergerjournal_NN“; Verlag/Druckerei im PDF-Text nicht gefunden (nicht belegt). Amtsblatt seit 2026 nur digital unter https://www.bergkirchen.de/amtsblatt/ (laut Gemeindeblatt 52).
Dorffest: Gemeindeblatt 52 (Aug/Sept 2026) S. 1 Termine: „28. November 2026, 14:00 Uhr Adventsmarkt der Gemeinde Bergkirchen, Zwischen Rathaus und Pfarrplatz“; Text: 14:00 bis 20:00 Uhr. Außerdem Rückblick „Dorffest“ GBV Deutenhausen-Eisolzried am 25.07.2026.

#### 12 Odelzhausen (www.odelzhausen.de, 5)
- https://www.odelzhausen.de/robots.txt 200 (WordPress-Standard)
- https://www.odelzhausen.de/ 200
- https://www.odelzhausen.de/aktuelles/veranstaltungen 200
- https://www.odelzhausen.de/wohnen-und-soziales/maerkte/11481-2 (Menüpunkt „Christkindlmarkt“) zweimal 000: „Failed to connect to www.odelzhausen.de port 443“. Danach keine weiteren Versuche.

Merkmale: WordPress 7.1.3, WPBakery, Theme „odelzhausen“ (bootscore), Plugins `maple-*`. Kalender = Iframe `//www.rce-event.de/output.php?id=1255&mode=L` (RCE-Event, robots-gesperrt). komuna nur als RIS: https://ris.komuna.net/odelzhausen . Menü „Märkte“: Regionalmarkt, Sommerfest, Christkindlmarkt, Marienmarkt (Seiten nicht gelesen). Kein Amtsblatt-Link auf Start- oder Kalenderseite gefunden (nicht belegt).
Dorffest: nicht gefunden (Kalender robots-gesperrt, Christkindlmarkt-Seite nicht erreichbar; Websuche ohne Treffer).

#### 13 Grafengehaig (www.grafengehaig.de 6, vg.marktleugast.de 5)
- https://www.grafengehaig.de/robots.txt 404 (TYPO3-Fehlerseite, also keine Regeln)
- https://www.grafengehaig.de/ 200
- https://www.grafengehaig.de/freizeit-tourismus/veranstaltungen/alle-veranstaltungen 200
- Detail `...veranstaltungsdetails?tx_calendarize_calendar[action]=detail&...[index]=4532&cHash=...` 200
- ICS `...&tx_calendarize_calendar[format]=ics&...[index]=4532&cHash=eeb7...` 200 text/calendar
- https://www.grafengehaig.de/verwaltung-politik/mitteilungsblatt 200
- https://vg.marktleugast.de/robots.txt 404 (TYPO3-Seite)
- https://vg.marktleugast.de/veranstaltungen/alle-veranstaltungen 200, dazu currentPage=3, 5, 6 je 200

Merkmale: TYPO3 + Bootstrap Package, `calendarize` (37 Treffer), `tx_news`. Gemeinde- und VG-Seite teilen eine Datenbasis (Fußzeile „© 2026 Verwaltungsgemeinschaft Marktleugast“, Gemeindeseite verlinkt „Alle Termine in der VG Marktleugast“). VG-Liste enthält Grafengehaiger Termine (z. B. „Heimat- und Ehrungsabend 30.10.2026“ in beiden).
ICS-Probe (PRODID `-//TYPO3/NONSGML Calendarize//EN`): UID `calendarize-heimat-und-ehrungsabend-1-1`, DTSTAMP, DTSTART `20261030T183000Z` (UTC, entspricht 19:30 Ortszeit), SUMMARY, DESCRIPTION (leer), X-ALT-DESC, LOCATION `im Sportheim der SG Gösmes-Walberngrün`. Kein JSON-LD (0 ld+json). Detailseite zeigt Veranstaltungsort und Veranstalter (Frankenwaldverein e.V. Ortsgruppe Gösmes-Walberngrün), die ICS hat keinen ORGANIZER.
Mitteilungsblatt: eigene Jahrgangsseiten 2019 bis 2026 auf grafengehaig.de, Verlag nicht belegt.
Dorffest: „2. Grafengehaiger Weihnachtsmarkt“ 19.12.2026, 15:30 bis 20:00 Uhr, VG-Kalender Seite 5, Detail-Index 4536: https://vg.marktleugast.de/veranstaltungen/alle-veranstaltungen/veranstaltungsdetails?tx_calendarize_calendar%5Baction%5D=detail&tx_calendarize_calendar%5Bcontroller%5D=Calendar&tx_calendarize_calendar%5Bindex%5D=4536&cHash=5ecdf0bf6a05f16b4d8a720c633f4b8513dc65a7ceb4865c0c6b8e3e4e60efa9 (Link aus der Liste, Detail nicht abgerufen). Außerdem im Gemeindekalender „Schlachtfest mit Straßenverkauf“ 07.11.2026 17:00.

#### 14 Gerach (www.gerach.de 2, www.vg-baunach.de 6)
- https://www.gerach.de/robots.txt 404 (TYPO3-Fehlerseite)
- https://www.gerach.de/ 200, Weiterleitung auf https://www.vg-baunach.de/gemeinden/gemeinde-gerach (keine eigene Website, Unterseite der VG)
- https://www.vg-baunach.de/robots.txt 404 (TYPO3-Seite)
- https://www.vg-baunach.de/freizeit-tourismus/veranstaltungen/kirchweihen 200
- https://www.vg-baunach.de/freizeit-tourismus/veranstaltungen/kirchweihen/kirchweih-gerach 200
- https://www.vg-baunach.de/freizeit-tourismus/veranstaltungen/veranstaltungskalender 200
- https://www.vg-baunach.de/freizeit-tourismus/veranstaltungen/veranstaltungskalender/rss 500 (TYPO3-Fehlerseite „Oops, an error occurred“, Statuscode im Text 503)

Merkmale: TYPO3, Agentur communice (`communice_instance`, `communicecalendar_calendarlistwithfilters`, `matomo01.communice.de`, Terminbuchung `baunach.communicetime.de`). Liste zeigt je Termin Titel, Datum, Uhrzeit, Ort, Gemeinde (Stadt Baunach / Gemeinde Reckendorf / Gemeinde Lauter / Verwaltungsgemeinschaft), Kategorie (z. B. „Kirche“); 17 Seiten. Listen-iCal-Link `?tx_communicecalendar_calendarlistwithfilters[action]=ical&...[eventlist]=178,177,...` vorhanden, nicht abgerufen (Anfragegrenze). Gerach-Termine auf Seite 1 nicht gesehen (Seite 1 nur Reckendorf, Baunach, Lauter, VG). Tourismus-Link: https://tourismus-baunach.de/veranstaltungen-2/ (nicht abgerufen). Menü: „Gemeindliche Apps“, „Mitteilungsblatt“ unter /digitale-verwaltung/digitaler-service/ (nicht abgerufen, Name/Verlag nicht belegt).
Dorffest: Kirchweih Gerach „am 4. Sonntag im Juni auch Freitag, Samstag und Montag“ (nur Regel, kein Datum) https://www.vg-baunach.de/freizeit-tourismus/veranstaltungen/kirchweihen/kirchweih-gerach . Konkretes Datum nicht gefunden.

#### 15 Buttenheim (www.buttenheim.de, 6)
- https://www.buttenheim.de/robots.txt 404 (TYPO3-Fehlerseite)
- https://www.buttenheim.de/ 200
- https://www.buttenheim.de/freizeit-tourismus/veranstaltungen 200
- https://www.buttenheim.de/freizeit-tourismus/veranstaltungen/veranstaltung/weihnachtsmarkt-buttenheim 200
- iCal `.../veranstaltung/ical-download?tx_communicecalendar_calendar[action]=ical&...[eventlist]=84&cHash=3dd6...` 200 application/octet-stream
- https://www.buttenheim.de/buergerservice-politik/service/amtsblatt 200

Merkmale: TYPO3, communice (`communice_instance`, `communice_calendar`), Veranstaltung einreichen `/freizeit-tourismus/veranstaltungen/einreichen`. Kein JSON-LD. Heimat-Info: auf Startseite, Kalenderseite und Detailseite kein Embed (`heimat-info`, `embeddings`, `cosmema` nicht vorhanden; einziger Treffer „Heimat“ im De-Mail-Text). Die Gemeinde bindet Heimat-Info also nicht ein (auf den drei Seiten belegt).
iCal-Probe (PRODID `-//hacksw/handcal//NONSGML v1.0//EN`): UID `68d30a9594728bc39aa24be94b319d21_iCal`, DTSTAMP, DTSTART;VALUE=DATE:20261205, DTEND;VALUE=DATE:20261206, SUMMARY `Weihnachtsmarkt Buttenheim`, LOCATION `Buttenheim`. Keine Uhrzeit, keine Beschreibung. Anzeige sagt 05.12. bis 06.12.2026; nach RFC 5545 ist DTEND bei VALUE=DATE exklusiv, die Datei deckt also nur den 05.12. ab.
Amtsblatt: „Marktanzeiger“, PDFs auf eigener Seite (z. B. `/fileadmin/.../Amtsblatt/2025/Marktanzeiger_Nr._29-36_vom_24.07.2026.pdf`), Verlag nicht belegt.
Dorffest: „Weihnachtsmarkt Buttenheim“ 05.12. bis 06.12.2026, Kategorie „Feste & Märkte“: https://www.buttenheim.de/freizeit-tourismus/veranstaltungen/veranstaltung/weihnachtsmarkt-buttenheim ; außerdem „Weihnachtsmarkt Dreuschendorf“ 13.12.2026, „Glühweinparty“ 28.11.2026 Feuerwehrhaus Gunzendorf (Liste).

#### 16 Seukendorf (seukendorf.de 4, www.veitsbronn.de 2, veitsbronn.de 2)
- https://seukendorf.de/robots.txt 200 (WordPress-Standard)
- https://seukendorf.de/ 200
- https://seukendorf.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-10-27&end_date=2027-12-31 200 JSON, total 27
- https://seukendorf.de/service/amtliches-mitteilungsblatt/ 200
- https://www.veitsbronn.de/robots.txt 301 (nicht gefolgt), https://www.veitsbronn.de/ 200 (nach https://veitsbronn.de/), https://veitsbronn.de/robots.txt 200 (WordPress-Standard)

Merkmale: WordPress 7.1.3, Theme porto, WPBakery, The Events Calendar (`wp-json/tribe/events/v1/`, iCal `https://seukendorf.de/veranstaltungskalender/?ical=1`), Multisite der VG (Uploads `sites/5` Seukendorf, `sites/4` Veitsbronn, Umschalter „Gemeinde wechseln: Veitsbronn | Seukendorf“). Veitsbronn hat eigenen Tribe-Kalender (`https://veitsbronn.de/events/?ical=1`), ob Seukendorfer Termine dort stehen: nicht geprüft. Jahreskalender als PDF: `.../uploads/sites/5/2026/01/Kalender-Seukendorf-2026.pdf`. Gemeinde-App: App Store https://apps.apple.com/de/app/gemeinde-seukendorf/id6692617839 , Android `appseukendorfvgveitsbronnde.wpapp` (Hersteller nicht belegt). RIS Veitsbronn: kommune-aktiv.
Tribe-Felder (echte Probe): id, global_id, author, status, date, date_utc, modified, url, rest_url, title, description, excerpt, slug, image, all_day, start_date, start_date_details, end_date, end_date_details, utc_start_date, utc_end_date, timezone, timezone_abbr, cost, cost_details, website, show_map, show_map_link, hide_from_listings, sticky, featured, categories, tags, venue{id, venue, address, city, zip, url, show_map, ...}, organizer [] (leer), custom_fields. Datenbefund: viele Termine als 00:00:00 bis 23:59:59 mit Uhrzeit nur im Titel („AWO ...: SeniorenClub-Treff … Beginn: 14:00“), Veranstalter als Titelpräfix, venue meist leer, ein Eintrag mit Slug `__trashed-2`.
Amtsblatt: „Die Amtlichen Mitteilungen der Gemeinde Seukendorf finden Sie im Lokalanzeiger“, Link https://www.die-lokalanzeiger.de/aktuelle-ausgaben-lokalanzeiger/ (nicht abgerufen).
Dorffest: „Adventsmarkt Seukendorf“ 06.12.2026 https://seukendorf.de/event/adventsmarkt-seukendorf/ ; außerdem „Katharinenmarkt im und vor dem Gemeindehaus“ 22.11.2026.

#### 17 Nesselwang (www.nesselwang.de 3, www.nesselwang-buergerservice.de 3)
- https://www.nesselwang.de/robots.txt 200 (`Disallow:` leer)
- https://www.nesselwang.de/ 200 (Tourismusseite, Contao)
- https://www.nesselwang.de/veranstaltungskalender-nesselwang.html 200
- https://www.nesselwang-buergerservice.de/robots.txt 200 (`disallow:/contao/`)
- https://www.nesselwang-buergerservice.de/ 200 (Gemeindeseite laut Wikipedia-Infobox, Contao)
- https://www.nesselwang-buergerservice.de/termine-und-veranstaltungen.html 200

Merkmale: Tourismus: Feratel Deskline DW5 `https://resc.deskline.net/DW5/start/NESSELWANG/2275052e-07bf-4433-87cd-86791ecd8959/index.js`, Detail-Hash-URLs `#/veranstaltungen/VIT/<uuid>/<slug>`, `files/tao/js/form.feratel.js`. Gemeindeseite: Contao, handgeschriebene Monatsliste „Terminübersicht für Vereine“ (Text, kein Feed, „Kursiv geschriebene Termine sind noch NICHT fix“), Links auf nesselwang.de-Seiten. Weitere Liste: https://www.abc-nesselwang.de/veranstaltungen.html (nicht abgerufen). Mitteilungsblatt auf Gemeindestartseite nicht gefunden (nicht belegt).
Dorffest: „16. Nesselwanger Adventsmarkt“ Samstag 12.12.2026, 15.00 bis 21.00 Uhr, Parkplatz der Alpspitzhalle (https://www.nesselwang-buergerservice.de/termine-und-veranstaltungen.html), eigene Seite https://www.nesselwang.de/nesselwanger_adventsmarkt.html . In Deskline verlinkt: „Nesselwanger Adventsbummel mit verkaufsoffenem Sonntag“ (22.11.2026 laut Gemeindeliste) `https://www.nesselwang.de/veranstaltungskalender-nesselwang.html#/veranstaltungen/VIT/48dc2249-8f8f-42f9-8a10-9d1bbaafb70f/...`. Laut Gemeindetext auch Johannisfeuer und Waldfestabende (ohne Datum).

#### 18 Buxheim, Lkr. Eichstätt (www.buxheim.eu 5; Fehlversuche)
- Erst geraten: https://www.buxheim.de/ 200 = Buxheim in Schwaben (Adresse 87740, Heimat-Info-Link `buxheim-schwaben`), verworfen. robots 404.
- DNS-Fehlschläge (000): www.gemeinde-buxheim.de, buxheim-oberbayern.de, www.buxheim-oberbayern.de, www.buxheim-obb.de, www.gemeinde-buxheim.info, www.buxheim-eichstaett.de, buxheim.bayern, www.buxheim.info
- Website laut https://de.wikipedia.org/wiki/Buxheim_(Oberbayern): www.buxheim.eu
- https://www.buxheim.eu/robots.txt 200 leer (0 Byte)
- https://www.buxheim.eu/ 200
- https://www.buxheim.eu/veranstaltungskalender 200 (nach /veranstaltungskalender/)
- https://www.buxheim.eu/mitteilungsblatt 200
- https://www.buxheim.eu/feed/ 200 (RSS ohne Items)

Merkmale: WordPress + Elementor 4.3.2 + WP Rocket, Borlabs Cookie, Skripte `cosmema-bf-*`, `cosmema-autolink`, `CosmemaCaptchaConfig` (Website von Cosmema). Kalenderseite: Borlabs-Content-Blocker `heimat-info-kalender`, base64 entschlüsselt: `<iframe id="heimat-info-events" ... src="https://www.heimat-info.de/embeddings/events/v1/?&bgc=%23ffffff&acbc=%23980000&acfc=%23ffffff&c=32a7fdbf-c77f-47c8-ae92-e8fbb084f80e">`. Heimat-Info-Embed damit bestätigt (Kommunen-ID c=32a7fdbf-c77f-47c8-ae92-e8fbb084f80e), Embed selbst nicht abgerufen. Startseite verlinkt https://www.heimat-info.de/gemeinden/buxheim . Skriptkommentare nennen „TownHall-Detailseiten“ und „Townhall-Filter“, ein `plugins/townhall`-Pfad wurde nicht gesehen.
Mitteilungsblatt: monatlich als PDF auf eigener Seite (`/wp-content/uploads/...`), Jahrgänge 2020 bis 2026, Verlag nicht belegt.
Dorffest: auf der Website nicht gefunden (Termine nur im Heimat-Info-Iframe, Feed leer); Websuche ohne 2026-Treffer.

#### 19 Mittelstetten (www.mittelstetten.de 4, www.vgmammendorf.de 2)
- https://www.mittelstetten.de/robots.txt 200 (`Allow: /`)
- https://www.mittelstetten.de/ 200 (Weiterleitung /startseite-mittelstetten, Title „Startseite - Verwaltungsgemeinschaft Mammendorf“)
- https://www.mittelstetten.de/veranstaltungen-mittelsetten 200
- https://www.mittelstetten.de/export/rss.php?id=2 200 text/xml
- https://www.vgmammendorf.de/robots.txt 200 (`Allow: /`)
- https://www.vgmammendorf.de/export/export_ical.php?idlist=36726,...,36645&nocat=1 200 text/calendar, 17 VEVENT

Merkmale: Generator „open2c - kinetiqa GmbH - www.kinetiqa.de“, `/plugins/eventcalendar/`, Exporte `export_ical.php?idlist=`, `export_events.php?idlist=`, RSS `rss.php?id=1` Aktuelles, `id=2` Termine, `id=3` News-Feed Althegnenberg. Plattform der VG Mammendorf für alle Mitgliedsgemeinden.
iCal-Felder (PRODID `< http://www.open2c.de/ >`, X-PUBLISHED-TTL PT12H): CREATED, LAST-MODIFIED, ORGANIZER;CN="Krieger- und Soldatenkameradschaft", DTSTAMP, DTSTART (teils `20261101T000000Z`, teils `;VALUE=DATE:20261101`), DTEND, URL (Vereinsseite auf mittelstetten.de), SUMMARY, DESCRIPTION „Organisator ...“, LOCATION, UID. Befund: „Andacht mit anschl. Gräbersegnung“ steht in HTML mit 14:00 Uhr, im iCal nur VALUE=DATE (Uhrzeit fehlt).
RSS „Termine“: 100 Items, VG-weit (Mammendorf, Adelshofen, Landsberied, Oberschweinbach, Günzlhofen, Hattenhofen ...), Felder title, description („18.12.2027 um 14:00 Uhr<br>“), link (vgmammendorf.de), pubDate (Einstelldatum), guid. Ohne Gemeindefeld.
Gemeindeblatt: „Gmoa-Blattl“ (Nr. 95 verlinkt) und „Mitteilungsblatt Oktober 2026“, Verlag nicht belegt.
Dorffest: „Adventsmarkt“ 28.11.2026, Organisator „Glonnquell Schützen und Ländlicher Garten“, LOCATION Vereinsheim-Mittelstetten (iCal oben, Kalender https://www.mittelstetten.de/veranstaltungen-mittelsetten ). Außerdem „Glühmarkt“ 19.12.2026, „Waldweihnacht“ 29.11.2026. Im VG-RSS zusätzlich „Dorffest Burschenverein Oberschweinbach am Maibaum“, „Dorffest der FFW Günzlhofen“ (andere Gemeinden der VG).

#### 20 Holzkirchen, Lkr. Würzburg (www.holzkirchen-ufr.de 3, www.vgem-helmstadt.de 3)
- https://www.holzkirchen-ufr.de/robots.txt 200 (Disallow /neos/, /_Resources/, /account/)
- https://www.holzkirchen-ufr.de/ 200
- https://www.holzkirchen-ufr.de/angebote 200
- https://www.vgem-helmstadt.de/robots.txt 200 (wie oben)
- https://www.vgem-helmstadt.de/ 200
- https://www.vgem-helmstadt.de/startseite-1/mitteilungsblatt/2026 200

Merkmale: Neos mit Paket `DigiPublica.Platform` (Gemeinde und VGem), Websuche zeigt zusätzlich Host `holzkirchenufr.digiportal.de`. Kein Veranstaltungskalender auf Gemeinde- oder VGem-Startseite (nur Sitzungskalender, Online-Terminbuchung). „ical“-Treffer auf der Startseite sind nur Teil von „vertical“.
Mitteilungsblatt: „Mitteilungsblatt VGem Gemeinden“ Januar bis März 2026 als PDF auf vgem-helmstadt.de, „Link Mitteilungsblatt ab April 2026“ auf https://www.wittich.de/produkte/zeitungen/2361-mitteilungsblatt (LINUS WITTICH).
Dorffest: auf Gemeinde/VGem nicht gefunden. Websuche: festivalsindeutschland „130 Jahre FFW Holzkirchen & Sportfest“, 17. bis 19.07.2026, „Sportplatz Holzkirchen, 97292 Holzkirchen“, Kopf „Landkreis Würzburg (09679)“, Veranstalter FFW Holzkirchen + FC Holzkirchen 1949 e.V., https://www.festivalsindeutschland.de/festival/130-jahre-ffw-holzkirchen-sportfest (WebFetch). Nur Lückenliste (AGB), Primärquelle fc-holzkirchen.de nicht geprüft.

### Zusatzquellen
- WebFetch https://de.wikipedia.org/wiki/Buxheim_(Oberbayern) (Website www.buxheim.eu), https://de.wikipedia.org/wiki/Nesselwang (Website www.nesselwang-buergerservice.de)
- WebSearch: Buxheim-Website, Nesselwang-Rathaus, Holzkirchen-Feste (2x), Bergkirchen-Feste (2x), Odelzhausen-Feste, Landkreis Dachau Kalender. Ergebnis Landkreis Dachau: kein Kreiskalender gefunden.

### Anfragen je Host
bergkirchen.de 5 · rce-event.de 2 · odelzhausen.de 5 (davon 2 ohne Verbindung) · grafengehaig.de 6 · vg.marktleugast.de 5 · gerach.de 2 · vg-baunach.de 6 · buttenheim.de 6 · seukendorf.de 4 · www.veitsbronn.de 2 · veitsbronn.de 2 · nesselwang.de 3 · nesselwang-buergerservice.de 3 · buxheim.de 2 · buxheim.eu 5 · 8 Fehl-Domains je 1 (DNS) · mittelstetten.de 4 · vgmammendorf.de 2 · holzkirchen-ufr.de 3 · vgem-helmstadt.de 3 · de.wikipedia.org 2 · festivalsindeutschland.de 1. heimat-info.de 0.

## D. Gruppe c (Gemeinden 21 bis 30)


Downloads: `C:\Users\jonag\AppData\Local\Temp\claude\C--Users-jonag-Documents-Portfolio-burgenland-events-v5-fresh--claude-worktrees-epic-dhawan-fff797\c854d244-ed36-4105-ae84-74daeb29b648\scratchpad\by-c\`
(vollständiges Anfrageprotokoll dort in `requests.log`, Format `URL -> Status Ziel-URL Bytes`).
Alle Anfragen GET mit curl, UA "Mozilla/5.0 (research; lasstreffen.at)". Keine Cookies, keine Formulare.
Websuchen (kein Host-Zugriff): Domains für Wattendorf, Haunsheim, Ködnitz, Oberpöring, Riekofen, Aham, Neuburg a.Inn; "modbox.cosmema.de adelzhausen" (0 Treffer); Wattendorf Kirchweih 2026 (nichts).

### Anfragen (URL, Status)

```
https://www.wattendorf-oberfranken.de/robots.txt 200
https://haunsheim.de/robots.txt 200
https://www.koednitz.de/robots.txt 200
https://www.oberpoering.de/robots.txt 200 (Weiterleitung auf https://vg-oberpoering.de/rathaus, HTML)
https://www.gemeinde-riekofen.de/robots.txt 200
https://www.aham.de/robots.txt 000 (keine Verbindung, falsche Domain)
https://www.adelzhausen.de/robots.txt 404 (keine robots.txt)
https://www.bad-hindelang.de/robots.txt 200 (-> www.badhindelang.de/robots.txt)
https://www.bergrheinfeld.de/robots.txt 200 (-> bergrheinfeld.de/startseite/robots.txt, HTML-Seite, also keine robots.txt)
https://www.neuburg-inn.de/robots.txt 000 (falsche Domain)
https://vg-oberpoering.de/robots.txt 200
https://bergrheinfeld.de/robots.txt 200 (wieder HTML)
https://www.wattendorf-oberfranken.de/ 200
https://haunsheim.de/ 200
https://www.koednitz.de/ 200
https://vg-oberpoering.de/ 200 (-> /rathaus)
https://www.gemeinde-riekofen.de/ 200
https://www.adelzhausen.de/ 200
https://www.badhindelang.de/ 200
https://bergrheinfeld.de/ 200 (-> /startseite.html)
https://www.gemeinde-aham.de/robots.txt 200
https://www.neuburg-am-inn.de/robots.txt 404
https://www.gemeinde-aham.de/ 200 (-> /startseite-aham)
https://www.neuburg-am-inn.de/ 200
https://www.adelzhausen.de/leben-erleben/freizeit-kultur/veranstaltungskalender/veranstaltung/christkindlmarkt/2026-12-12?cHash=c98f3bff8b2c33d27b38e185d5220773 200
https://www.adelzhausen.de/leben-erleben/freizeit-kultur/veranstaltungskalender 200
https://www.adelzhausen.de/leben-erleben/freizeit-kultur/veranstaltungskalender/ical-download?...eventlist%5D=1499%2C1836...&cHash=e800cb5734d917bb70eb45b905fcba37 200 (text/calendar, 30 VEVENT)
https://modbox.cosmema.de/robots.txt 404
https://modbox.cosmema.de/live/adelzhausen/ 404 (Next.js-404-Seite)
https://www.wattendorf-oberfranken.de/veranstaltungen/index.php 200
https://www.koednitz.de/seite/569472/veranstaltungen.html 200
https://haunsheim.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-01-01 200 (total 88)
https://vg-oberpoering.de/vereine-veranstaltungen 200
https://www.gemeinde-riekofen.de/freizeit-kultur/veranstaltungskalender/ 200
https://www.gemeinde-aham.de/veranstaltungen-aham 200
https://www.badhindelang.de/veranstaltungskalender 200
https://bergrheinfeld.de/veranstaltungen.html 200
https://www.neuburg-am-inn.de/neuburg-erleben/kultur-und-veranstaltungen/veranstaltungskalender 200
https://haunsheim.de/wp-json/tribe/events/v1/events?per_page=50&start_date=2026-10-27 200 (total 22)
https://vg-oberpoering.de/eventleser-3/gneidinger-kirta-11-00-uhr 200
https://vg-oberpoering.de/events-gesamtuebersicht 200
https://www.gemeinde-riekofen.de/media/100726/veranstaltungskalender-2026-2027.pdf 200
https://www.vg-gerzen.de/robots.txt 200
https://www.vg-gerzen.de/Veranstaltungskalender.n18.html 200
https://www.heimat-info.de/robots.txt 200
https://www.heimat-info.de/embeddings/events/v1/?&bgc=%23ffffff&acbc=%23E53640&acfc=%23ffffff&c=2e796382-4871-422a-a097-c22bf1939c70 200 (nur Embed-Bestätigung Aham)
https://marktgemeinde.badhindelang.de/robots.txt 000 (TLS bricht ab)
https://marktgemeinde.badhindelang.de/ 000 (+ ein curl -v Diagnoseversuch, gleiche Ursache)
https://www.badhindelang.de/sitemap-events.xml 200 (107 <loc>)
https://www.badhindelang.de/veranstaltungskalender/veranstaltungen/HIN/cb765894-40eb-4595-af68-026b27fcd375/erlebnis-weihnachtsmarkt-bad-hindelang 200
http://marktgemeinde.badhindelang.de/robots.txt 200 (-> https://www.marktbadhindelang.de/, Startseite)
https://www.marktbadhindelang.de/robots.txt 404
https://www.marktbadhindelang.de/freizeit-kultur/vereine/vereinekalender 200
https://www.neuburg-am-inn.de/.../veranstaltung/sommerfest-der-ff-hoech-fuerstdobl/2027-08-07?cHash=7e0ff3e67d1cff36d1701b8f8cd9e648 200
https://bergrheinfeld.de/veranstaltungen/details.html?tx_news_pi1[action]=detail&tx_news_pi1[controller]=News&tx_news_pi1[news]=561&cHash=f912759c8367d12ccb3dcc5f6164ff8d 200
https://bergrheinfeld.de/fileadmin/user_upload/Downloadcenter/Infomaterial_und_Broschueren/2026_Veranstaltungskalender.pdf 200
https://www.steinfeld-oberfranken.de/robots.txt 200
https://www.vg-trebgast.de/robots.txt 200
https://www.gundelfingen.de/robots.txt 200
https://www.suenching.de/robots.txt 200
https://www.dasing.de/robots.txt 404 (HTML, keine robots.txt; Seite selbst als Startseite ausgewertet)
https://www.steinfeld-oberfranken.de/ 200
https://www.vg-trebgast.de/ 200
https://www.gundelfingen.de/ 200 (-> /startseite)
https://www.suenching.de/ 200
https://www.gundelfingen.de/unsere-gemeinde/aktuelles/veranstaltungskalender 200 (-> /seite-1/suche-none)
https://www.suenching.de/freizeit-kultur/veranstaltungen/veranstaltungskalender/ 200
https://www.steinfeld-oberfranken.de/aktuelles/mitteilungsblatt/ 200 (-> /amtsblatt/index.php)
https://www.steinfeld-oberfranken.de/veranstaltungen/index.php 200
https://daten.verwaltungsportal.de/dateien//publication/3/0/3/3/2/KO_NA_10_2026_web.pdf 200 (Ködnitzer Nachrichten 10/2026, für Dorffest-Beleg)
```

robots.txt-Befunde: wattendorf-oberfranken.de, koednitz.de, steinfeld-oberfranken.de, vg-trebgast.de (alle verwaltungsportal) sperren nur eine Liste benannter Bots, kein `User-agent: *`. haunsheim.de: nur /wp-admin/. gemeinde-riekofen.de, suenching.de (Umbraco): /umbraco/, /bin/ usw. gemeinde-aham.de, vg-gerzen.de: `User-agent: * Disallow:` (alles erlaubt), Facebook/Amazon/Ahrefs gesperrt. badhindelang.de: /fileadmin, /uploads, `*cHash` gesperrt (Achtung: Detailseiten der Events haben kein cHash, Sitemap sitemap-events.xml ausdrücklich gelistet). vg-oberpoering.de: nur /contao/. gundelfingen.de: Bilder und /fileadmin/templates/. heimat-info.de: `Allow: /` (gesperrt /verwaltung, /onboarding, /meine-gemeinden, /app-init). Keine robots.txt: adelzhausen.de, neuburg-am-inn.de, marktbadhindelang.de, dasing.de, bergrheinfeld.de, modbox.cosmema.de.

### Je Gemeinde

#### 21 Wattendorf (VGem Steinfeld)
- Website https://www.wattendorf-oberfranken.de/ : verwaltungsportal.de (35x `verwaltungsportal`, Logo/CSS von layout.verwaltungsportal.de, Fußzeile „gefördert durch die Initiative ‚Bayern vernetzt‘“). Kalender https://www.wattendorf-oberfranken.de/veranstaltungen/index.php : „Keine Veranstaltungen gefunden“.
- VGem https://www.steinfeld-oberfranken.de/ : ebenfalls verwaltungsportal, Kalender /veranstaltungen/index.php ebenfalls „Keine Veranstaltungen gefunden“. Footer-Link http://www.azubi-projekte.de/bayern.
- Feed: keiner gefunden. JSON-LD nicht geprüft (keine Termine vorhanden).
- Amtsblatt: „Mitteilungsblatt der Verwaltungsgemeinschaft Steinfeld“, 14-tägig, Verlag LINUS WITTICH (Link https://www.wittich.de/produkte/zeitungen/2098-mitteilungsblatt-verwaltungsgemeinschaft-steinfeld auf https://www.steinfeld-oberfranken.de/amtsblatt/index.php). PDF-Download nur per POST-Formular (`<form method="post" action="/amtsblatt/index.php#gazette_90698">`), daher nicht abgerufen. Alte PDFs liegen noch unter wattendorf-oberfranken.de/media/... (Websuche).
- Tourismus-Widget: keins gefunden.
- Dorffest-Test: nicht gefunden (Gemeinde- und VGem-Kalender leer; Websuche „Wattendorf Kirchweih 2026“ ohne Treffer; Pressebericht Kreismusikfest infranken.de ohne Datum).
- Klasse: Amtsblatt (einziger Ort mit laufenden Inhalten, Verlag WITTICH; Inhalt nicht geprüft).

#### 22 Aham (VGem Gerzen)
- Website https://www.gemeinde-aham.de/ : `<meta name="generator" content="Open2C - Kinetiqa GmbH - www.kinetiqa.de">`. Kalender https://www.gemeinde-aham.de/veranstaltungen-aham = Seite „Kalender Heimat-Info: Gemeinde Aham“ mit `<iframe id="heimat-info-events" src="https://www.heimat-info.de/embeddings/events/v1/?&bgc=%23ffffff&acbc=%23E53640&acfc=%23ffffff&c=2e796382-4871-422a-a097-c22bf1939c70">` (auch auf der Startseite). Open2C hat zusätzlich `/plugins/eventcalendar/` (CSS) und RSS-Exporte `/export/rss.php?id=1..9` (nicht abgerufen). RIS: ris.komuna.net/gerzen (komuna).
- VGem https://www.vg-gerzen.de/Veranstaltungskalender.n18.html : ebenfalls Open2C, „Kalender Heimat-Info: Gesamte VG Gerzen“, iframe mit VIER `c=`-Parametern (2e796382-4871-422a-a097-c22bf1939c70 = Aham, 3697ccc3-5651-49f4-80df-a6718e954efe, 963c5f24-24c5-4c56-a980-72628ae0f642, 5a8b13d7-2229-4bae-a89d-45417715c9dd). Das Embed nimmt also mehrere Kommunen.
- Heimat-Info-Embed serverseitig gerendert (Nuxt), Text enthält Datum, Veranstalter, Kategorie („Vereine“, „Öffentliches“), Ort.
- Amtsblatt: „Bürgerblatt'l“ (/buergerblatt-aham), Verlag nicht belegt.
- Dorffest-Test: „Ahamer Adventsmarkt mit großer Tombola“, Sa. 28.11.2026, 14:00, Lerchenhofplatz in Aham, Veranstalter „Veranstaltungen Aham“ (im Heimat-Info-Embed, eingebunden auf https://www.gemeinde-aham.de/veranstaltungen-aham). Daneben „Christbaumversteigerung der FFW Aham“ 05.12.2026.
- Klasse: Gemeinde-App (Heimat-Info, eingebunden auf Gemeinde- und VGem-Website).

#### 23 Haunsheim (VGem Gundelfingen a.d.Donau)
- Website https://haunsheim.de/ : WordPress 7.1.3 + Elementor, `wp-content/plugins/the-events-calendar` + `events-calendar-pro`. Kalender https://haunsheim.de/termine/ , iCal https://haunsheim.de/termine/?ical=1 , REST https://haunsheim.de/wp-json/tribe/events/v1/ .
- REST-Probe: 88 Termine ab 01.01.2026, 22 ab 27.10.2026. Event-Felder: all_day, author, categories, cost, cost_details, custom_fields, date, date_utc, description, end_date, end_date_details, excerpt, featured, global_id, global_id_lineage, hide_from_listings, id, image, is_virtual, modified, modified_utc, organizer, rest_url, show_map, show_map_link, slug, start_date, start_date_details, status, sticky, tags, timezone, timezone_abbr, title, url, utc_end_date, utc_end_date_details, utc_start_date, utc_start_date_details, venue, virtual_url, virtual_video_source, website. venue-Felder: address, author, city, country, date, date_utc, global_id, global_id_lineage, id, modified, modified_utc, province, show_map, show_map_link, slug, stateprovince, status, url, venue, zip. Beispiel: start_date "2026-10-31 00:00:00", utc_start_date "2026-10-30 23:00:00", timezone "Europe/Berlin", all_day true, venue {venue "Ökonomie Haunsheim", address "Hauptstraße 29", city "Haunsheim", zip "89437", country "Deutschland", stateprovince "Bayern"}. Kategorien u. a. Feste, Freizeitaktivität, Sitzung, Märkte, Konzerte, Religion, Turnier, „Geschlossene Gesellschaft“ (Hallenbelegung „Privat“, beim Import ausfiltern). Titel mit HTML-Entities (`&#8211;`).
- VGem: Sitz https://www.gundelfingen.de/ (TYPO3, Extension `hwveranstaltung`, `hwdatenschutz`); Kalender https://www.gundelfingen.de/unsere-gemeinde/aktuelles/veranstaltungskalender zeigt serverseitig keine Einträge, „Haunsheim“ kommt 0x vor.
- Amtsblatt: „Dorfbote“ (https://haunsheim.de/aktuelles/dorfbote/ , Kontakt dorfbote@haunsheim.de laut Websuche), Verlag nicht belegt.
- Dorffest-Test: „Maifeiern in beiden Ortsteilen FFW Haunsheim und FFW Unterbechingen“ 30.04.2026 https://haunsheim.de/termin/maifeiern-in-beiden-ortsteilen-ffw-haunsheim-und-ffw-unterbechingen/ ; „Sonnwenndfeier OGV Haunsheim“ 20.06.2026; kommend „Adventstreff am Mehrgenerationenplatz in Unterbechingen“ 28.11.2026 14:00 https://haunsheim.de/termin/adventstreff-am-mehrgenerationenplatz-in-unterbechingen/ .
- Klasse: Gemeinde-Website.

#### 24 Ködnitz (VGem Trebgast)
- Website https://www.koednitz.de/ : verwaltungsportal (layout.verwaltungsportal.de/14930/…, „Bayern vernetzt“). Seite „Veranstaltungen“ https://www.koednitz.de/seite/569472/veranstaltungen.html ist statisch: Jahres-PDF 2024 (daten2.verwaltungsportal.de/…/Veranstaltungen_2024_2.pdf) und wiederkehrende Stammtische. Kein Kalendermodul.
- VGem https://www.vg-trebgast.de/ : verwaltungsportal, kein Kalenderlink auf der Startseite.
- Feed: keiner.
- Amtsblatt: „Ködnitzer Nachrichten“ (Mitteilungsblatt der Gemeinde Ködnitz, Ausgabe 3 im Oktober 2026), Herausgeber Gemeinde Ködnitz, Druck novaconcept schorsch GmbH, Kulmbach. PDF https://daten.verwaltungsportal.de/dateien//publication/3/0/3/3/2/KO_NA_10_2026_web.pdf , Archiv /veroeffentlichung. Enthält Rubrik „Veranstaltungen von Oktober bis Dezember 2026“.
- Dorffest-Test: „TSV Ködnitz, Weihnachtsmarkt auf der TSV Sportanlage“, Sonntag 06.12.26, 14.00 Uhr (Ködnitzer Nachrichten 10/2026, Link oben). Bericht über Fölschnitzer Zeltkerwa im selben Heft (vergangen). festivalsindeutschland nennt „Kengster Kerwa Ködnitz“ 31.08. bis 04.09.2026 (nur Websuche, Lückenliste).
- Klasse: Amtsblatt (Selbstverlag über verwaltungsportal).

#### 25 Adelzhausen (VGem Dasing)
- Website https://www.adelzhausen.de/ : TYPO3 mit Extensions `communice_base`, `communice_calendar`, `communice_news`, `communice_addresses` (Hersteller communice, s. unten). Kalender https://www.adelzhausen.de/leben-erleben/freizeit-kultur/veranstaltungskalender , Einreichung /…/einreichen.
- Startseite enthält inline `var eventArray = [...]` (30 Objekte), Felder: link, title, start, end, date, humandate, humantime. Beispiel `{"link":"/leben-erleben/freizeit-kultur/veranstaltungskalender/veranstaltung/christkindlmarkt/2026-12-12?cHash=…","title":"Christkindlmarkt","date":"2026-12-12","humandate":"12.12.","humantime":"16:00 - 00:00"}`. Zeitraum 06.11.2026 bis 27.11.2027.
- iCal: Link „Alle Veranstaltungen zu Kalender hinzufügen“ = `/…/veranstaltungskalender/ical-download?tx_communicecalendar_calendar[action]=ical&tx_communicecalendar_calendar[controller]=Event&tx_communicecalendar_calendar[eventlist]=<IDs>&cHash=…`. Probe: PRODID `-//hacksw/handcal//NONSGML v1.0//EN`, Felder UID, DTSTAMP, DTSTART, DTEND, SUMMARY, LOCATION (kein DESCRIPTION, kein TZID, Zeiten floating). Fehler: DTEND oft vor DTSTART (`DTSTART:20261212T160000`, `DTEND:20261212T000000`). Detailseiten ohne JSON-LD; Detail hat Veranstalter (KLJB Adelzhausen), Ort, Kategorien („Vereinsveranstaltungen Adelzhausen“).
- modbox.cosmema.de: Auf adelzhausen.de kein Verweis auf modbox/cosmema/heimat-info gefunden (grep Startseite, Kalender, Detail). Geratene URL https://modbox.cosmema.de/live/adelzhausen/ liefert 404 (Next.js-App, `/_next/static/...`, robots.txt 404). Den genauen Pfad aus der Hauptsession hatte ich nicht; Felder nicht belegt.
- VGem/Markt Dasing https://www.dasing.de/ : ebenfalls communice (43 Treffer), kein eventArray auf der Startseite, „Adelzhausen“ 0x.
- Amtsblatt: nicht belegt.
- Dorffest-Test: „Christkindlmarkt“ 12.12.2026, 16:00, Vorplatz Bürgerhaus, Veranstalter KLJB Adelzhausen https://www.adelzhausen.de/leben-erleben/freizeit-kultur/veranstaltungskalender/veranstaltung/christkindlmarkt/2026-12-12?cHash=c98f3bff8b2c33d27b38e185d5220773 ; außerdem „10-jähriges Jubiläum mit Fahnenweihe Schützenverein Salvatorschützen Adelzhausen“ 24.04.2027.
- Klasse: Gemeinde-Website.

#### 26 Bad Hindelang, Markt (verbandsfrei)
- Gemeinde-Website https://www.marktbadhindelang.de/ (Weiterleitung von http://marktgemeinde.badhindelang.de; https auf marktgemeinde.* bricht beim TLS ab): TYPO3, communice (Cookie-Namen `communice_consent_*`, Inhaltselement `ce-communicecalendar_calendar3`), Matomo `piwik.apps.inixmedia.de`. Vereinskalender https://www.marktbadhindelang.de/freizeit-kultur/vereine/vereinekalender : serverseitig keine Einträge. Sitzungskalender mit Datum in URL. Verweist für Veranstaltungen auf den Tourismus.
- Tourismus https://www.badhindelang.de/veranstaltungskalender : TYPO3, Feratel Deskline TOSC5, `https://resc.deskline.net/DW5/start/ALLGAUHIND/0a348244-18f3-4326-a3df-b2e797b2ec28/index.js`, `web5.deskline.net/dwutility.js`. Sitemap https://www.badhindelang.de/sitemap-events.xml : 107 Event-URLs `/veranstaltungskalender/veranstaltungen/HIN/<uuid>/<slug>`. Detailseite ohne JSON-LD, Inhalt per JS (Deskline), Datum serverseitig nicht vorhanden.
- Amtsblatt: „Gemeindeblatt Bad Hindelang“ (/buergerservice-politik/service/gemeindeblatt-bad-hindelang), Verlag nicht belegt.
- Dorffest-Test: Titel „Erlebnis-Weihnachtsmarkt Bad Hindelang“ in sitemap-events.xml (https://www.badhindelang.de/veranstaltungskalender/veranstaltungen/HIN/cb765894-40eb-4595-af68-026b27fcd375/erlebnis-weihnachtsmarkt-bad-hindelang), Datum nicht belegt (nur per JS). Viehscheid-Seite verlinkt (/bergdoerfer/veranstaltungen-traditionen/viehscheid-allgaeu), Datum nicht geprüft.
- Klasse: Tourismusdatenbank (Feratel Deskline, Kanal ALLGAUHIND).

#### 27 Bergrheinfeld (verbandsfrei)
- Website https://bergrheinfeld.de/ : TYPO3 (Extensions news, powermail, content_element), keine robots.txt (Pfad leitet auf HTML). Veranstaltungen https://bergrheinfeld.de/veranstaltungen.html = tx_news-Liste mit wenigen Einzelmeldungen (Chorissimo 21./22.11.2026, Rathaussturm 13.11.2026, Martinsumzug Garstadt 07.11.2026) plus Meldung „Veranstaltungskalender“ mit Jahres-PDF https://bergrheinfeld.de/fileadmin/user_upload/Downloadcenter/Infomaterial_und_Broschueren/2026_Veranstaltungskalender.pdf . Kein Feed, kein JSON-LD gesehen. Hersteller nicht belegt.
- Amtsblatt: „Amtsblatt / Berger Nachrichten“ (Link auf /rathaus/buergerservice/buergerserviceportal.html), Verlag nicht belegt.
- Tourismus: Links auf https://tourismus.schweinfurt.de/einfach-urlaub/veranstaltungen/index.html (Landkreis-Tourismus) und https://www.fraenkischer-weinfestkalender.de/weinfeste/ , kein Widget eingebunden.
- Dorffest-Test: „Kirchweih“ 21.-24.08.2026, Buki Bergrheinfeld, Festplatz Holderhecke; „Feuerwehrfest“ 18.07.2026 Feuerwehrverein; Schützenfest 01./02.08.2026; Maibaumaufstellen 10.05. und 17.05.2026 (alles im Jahres-PDF oben).
- Klasse: Gemeinde-Website (Jahres-PDF).

#### 28 Oberpöring (VGem Oberpöring)
- www.oberpoering.de leitet auf https://vg-oberpoering.de/rathaus (Gemeinde- und VGem-Website sind dieselbe). Contao (`<meta name="generator" content="Contao Open Source CMS">`). Monatskalender https://vg-oberpoering.de/vereine-veranstaltungen (`?month=YYYYMM`), Liste https://vg-oberpoering.de/events-gesamtuebersicht , Detail `/eventleser-3/<slug>`.
- JSON-LD auf Detailseite (Contao 5 Standard): `{"@type":"Event","name":"Gneidinger Kirta","startDate":"2026-10-25T11:00:00+01:00","url":"/eventleser-3/gneidinger-kirta-11-00-uhr"}` (kein Ort, kein Ende). Achtung: Offset +01:00 am 25.10.2026, das ist der Tag der Zeitumstellung, plausibel. Liste zeigt Spalten Datum & Uhrzeit, Veranstaltung, Ort („-“), Info. Kein iCal-Link gefunden.
- Amtsblatt: nicht belegt.
- Dorffest-Test: „Gneidinger Kirta“ 25.10.2026 11:00 https://vg-oberpoering.de/eventleser-3/gneidinger-kirta-11-00-uhr ; kommend „Christbaumversteigerung, FF Gneiding“ 28.11.2026 19:00, „Adventsbasar Oberpöring“ 21.11.2026 (Gesamtübersicht).
- Klasse: VGem-Kalender.

#### 29 Neuburg a.Inn (verbandsfrei)
- Website https://www.neuburg-am-inn.de/ : TYPO3 mit communice (`ce-communicecalendar_calendar3`, `communice-iconfont`, `window.communice.gtranslate`). Kalender https://www.neuburg-am-inn.de/neuburg-erleben/kultur-und-veranstaltungen/veranstaltungskalender , Detail `/veranstaltung/<slug>/<YYYY-MM-DD>?cHash=`. Startseite verlinkt Termine bis 2029. iCal-Link je Detail (`tx_communicecalendar_calendarshow[action]=ical`), nicht abgerufen. Kein JSON-LD auf Detailseite.
- Amtsblatt: „Gemeindebrief“ / Mitteilungsblatt, PDF unter /fileadmin/Gemeinde/Dateien/Mitteilungsblatt/ (Websuche), Verlag nicht belegt.
- Dorffest-Test: „Sommerfest der FF Höch-Fürstdobl“ 07.08.2027 11:00 bis 08.08.2027 18:00 beim Feuerwehrgerätehaus https://www.neuburg-am-inn.de/neuburg-erleben/kultur-und-veranstaltungen/veranstaltungskalender/veranstaltung/sommerfest-der-ff-hoech-fuerstdobl/2027-08-07?cHash=7e0ff3e67d1cff36d1701b8f8cd9e648 ; außerdem „Wintersonnwendfeuer 2026 des Veteranen- und Kriegerverein Neuburg a.Inn“ 19.12.2026.
- Klasse: Gemeinde-Website.

#### 30 Riekofen (VGem Sünching)
- Website https://www.gemeinde-riekofen.de/ : Umbraco (robots „SEO Checker for Umbraco“), Fußzeile „CMS, © 2026 digitalfabriX“ mit title „akdb.digitalfabriX GmbH“ (AKDB-Tochter). Veranstaltungskalender https://www.gemeinde-riekofen.de/freizeit-kultur/veranstaltungskalender/ = nur PDF „Veranstaltungskalender 2026-2027“ (/media/100726/veranstaltungskalender-2026-2027.pdf). Seite /buergerservice/heimat-info-app/ verlinkt, aber kein Heimat-Info-Embed auf Start- oder Kalenderseite. News-RSS /aktuelles/aktuelle-meldungen/newsrss/ (nicht abgerufen).
- VGem https://www.suenching.de/ : gleiches System (Umbraco, digitalfabriX), Heimat-Info-Link, Kalender ebenfalls PDF (/media/99278/veranstaltungskalender-2026.pdf), kein Embed.
- Amtsblatt: Mitteilungsblätter je Jahr unter /aktuelles/mitteilungsblaetter/ , Verlag nicht belegt.
- Dorffest-Test (PDF): „Glöckerlverein Riekofen: Sonnwendfeier“ Sa. 20.06.2026; „FF Riekofen: Sommerfest am Gerätehaus“ So. 28.06.2026; „Burschenverein Taimering mit Mädchengruppe: Maibaumaufstellen“ 30.04.2026; „Pfarradvent in Riekofen“ 29.11.2026.
- Klasse: Gemeinde-Website (PDF); Heimat-Info laut Hauptsession zusätzlich.

### Hersteller-Merkmale (neu oder mehrfach)
- **communice** (TYPO3-Extensions `communice_base`, `communice_calendar`, `communice_news`, `communice_addresses`; Kalender-Element `ce-communicecalendar_calendar3`; Cookies `communice_consent_*`): Adelzhausen, Neuburg a.Inn, Markt Bad Hindelang, Dasing; Adelzhausen verlinkt außerdem https://www.sielenbach.de/communice-addresses/ortsplan . Zugriff: iCal-Endpunkt `…/ical-download?tx_communicecalendar_calendar[action]=ical&…[controller]=Event&…[eventlist]=<IDs>&cHash=…` (cHash nötig, also Link von der Listenseite nehmen), dazu inline `var eventArray` (link,title,start,end,date,humandate,humantime) auf Seiten mit Kalender-Teaser. Detail-URL enthält Slug und Datum. Betreiber nicht belegt (Bad Hindelang nutzt Matomo bei inixmedia.de; Zusammenhang nicht belegt).
- **verwaltungsportal.de / Azubi-Projekte, Initiative „Bayern vernetzt“**: Wattendorf, VG Steinfeld, Ködnitz, VG Trebgast. Kalendermodul `/veranstaltungen/index.php` in beiden geprüften Fällen leer; Mitteilungsblatt als Publikation auf daten.verwaltungsportal.de, Download teils per POST.
- **Open2C (Kinetiqa GmbH)**: Aham, VG Gerzen; bindet Heimat-Info per iframe ein; eigene RSS-Exporte `/export/rss.php?id=N`.
- **Heimat-Info-Embed mit mehreren `c=`**: VG Gerzen bündelt vier Kommunen in einem iframe.
- **akdb.digitalfabriX (Umbraco)**: Riekofen, Sünching; Kalender nur als PDF.
- **komuna** (RIS): ris.komuna.net/gerzen, ris.komuna.net/badhindelang; nur Ratsinformation.
- **Tribe Events Calendar Pro**: Haunsheim (WordPress), voller REST-Zugang.
- **Contao-Events mit JSON-LD**: VG Oberpöring.
- **Feratel Deskline TOSC5** Kanal ALLGAUHIND: Bad Hindelang Tourismus.

### Anfragen je Host
www.adelzhausen.de 5; vg-oberpoering.de 5 (+1 über Weiterleitung von www.oberpoering.de); bergrheinfeld.de 5 (+1 über www.bergrheinfeld.de); www.steinfeld-oberfranken.de 4; www.neuburg-am-inn.de 4; www.gemeinde-riekofen.de 4; www.badhindelang.de 4 (+1 über www.bad-hindelang.de); marktgemeinde.badhindelang.de 4 (2 TLS-Abbrüche, 1 Diagnose, 1 http-Weiterleitung); haunsheim.de 4; www.wattendorf-oberfranken.de 3; www.suenching.de 3; www.koednitz.de 3; www.gundelfingen.de 3; www.gemeinde-aham.de 3; www.vg-trebgast.de 2; www.vg-gerzen.de 2; www.marktbadhindelang.de 2 (+1 Weiterleitung); www.heimat-info.de 2; modbox.cosmema.de 2; www.dasing.de 1; www.oberpoering.de 1; www.neuburg-inn.de 1 (keine Verbindung); www.aham.de 1 (keine Verbindung); www.bad-hindelang.de 1; www.bergrheinfeld.de 1; daten.verwaltungsportal.de 1. Summe 71.
