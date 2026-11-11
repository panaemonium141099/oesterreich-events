# Mecklenburg-Vorpommern: alle Anfragen und Rohnotizen (27.10.2026)

Anhang zu [06-mecklenburg-vorpommern.md](06-mecklenburg-vorpommern.md). Teil 1 sind die
Anfragen der Hauptsession, Teile 2 bis 4 die Rohnotizen der drei Prüfgruppen (je 10
Stichprobengemeinden) unverändert bis auf ersetzte Gedankenstriche. Nur lesende GETs,
keine Konten, keine Formulare, keine Mails.

## 1. Hauptsession

| # | Anfrage | Status |
|---|---|---|
| 1 | destatis.de `AuszugGV3QAktuell.xlsx` (Gemeindeverzeichnis 30.09.2026) | 200, 1.872.608 Byte |
| 2 | meta.et4.de `/robots.txt` | 404 (keine Regeln) |
| 3 | meta.et4.de `search/?experience=open-data&type=Event&template=ET2014A.json&limit=1&q=city:"Satow"` (Syntaxprobe) | 200, `overallcount: 0` |
| 4 bis 33 | meta.et4.de gleiche Abfrage mit `q=city:"<Gemeinde>"` für alle 30 Stichprobengemeinden, 2 s Abstand | 30 × 200, jeweils `overallcount: 0` |
| 34 | www.auf-nach-mv.de `/robots.txt` | 200 |
| 35 | www.auf-nach-mv.de `/portal/frontend/sitemaps/tmv/de.xml` | 200, 9.728 URLs, davon 3.154 `/veranstaltungssuche/e-…` |
| 36 | www.auf-nach-mv.de `/veranstaltungssuche/e-188-wustrower-tonnenabschlagen` | 200 |
| 37 | www.auf-nach-mv.de `/veranstaltungssuche/e-wittenburger-weihnachtsmarkt` | 200 |
| 38 | www.auf-nach-mv.de `/veranstaltungssuche/e-loddiner-hafenfest` | 200 |
| 39 | heimatinfo-api-platform.azurewebsites.net `/communes/search` | 200, 648 Kommunen |
| 40 | heimatinfo-api-platform.azurewebsites.net `/communes/46645253-a194-4bbe-bea2-2bf23d1990a0/events` (Amt Demmin-Land) | 200, 3 Termine |
| 41 | www.advantic.de `/robots.txt` | 200 |
| 42 | www.advantic.de `/Referenzen/Alle-Kundenwebsites/` | 200, 861 Kartenpunkte |
| 43 | www.digitale-doerfer.de `/wp-json/wp/v2/portfolio_category?per_page=100` | 200 |
| 44 | www.digitale-doerfer.de `/wp-json/wp/v2/portfolio?portfolio_category=123` | 404 `rest_no_route` |
| 45 | www.digitale-doerfer.de `/portfolio_category/mecklenburg-vorpommern/` | 200 |
| 46 | api.tourismus.mv `/fileadmin/Media/Landestourismuskonzeption/Session_5_OK.pdf` (WebFetch) | 200 |
| 47 | packagist.org `/packages/se7enxweb/cjw_tmv` (WebFetch) | 200 |
| 48 bis 50 | GitHub API `repos/se7enxweb/cjw_tmv` (Dateibaum, `settings/cjw_tmv.ini.append.php`, `classes/cjwtmvclient.php`) | 200 |
| 51 | www.feratel.at News „10 becomes 1“ (WebFetch) | 200 |

An meta.et4.de gingen damit 32 Anfragen, mehr als die übliche Handvoll je Host; Grund ist
der Pflichtabgleich je Stichprobengemeinde aus der Spec. Dazu 6 Websuchen.


## 2. Rohnotizen Gruppe a

### fn-28.7 MV Gruppe a: Rohnotizen (Stand 2026-10-27)

Downloads: lokaler Scratchpad der Gruppe a (nicht im Repo)
User-Agent: `Mozilla/5.0 (compatible; lasstreffen-research/1.0)`, nur GET.

#### Anfragen (URL, Status)

##### www.amt-demmin-land.de (3)
- /robots.txt 200: Disallow / nur für Bot-Liste (dotbot, AhrefsBot, GPTBot ...), `Crawl-delay: 10` für ClaudeBot/Bingbot u. a.; keine Regel für `*`. Gleiche Datei wie bei Malchow und Röbel (verwaltungsportal-Standard).
- / 200: 32x `verwaltungsportal`, `layout.verwaltungsportal.de`, `admin.verwaltungsportal.de`. Kein Veranstaltungslink im Menü sichtbar; Ratsinfo `amt-demmin-land.sitzung-mv.de`.
- /veranstaltungen/index.php 200: verwaltungsportal-Kalender. Filter „Alle Orte“ enthält nur `3048 Verchen`. Rubriken Disco & Party, Familie, Kinder, Senioren, Sonstiges, Sport. Einträge: Bürgermeister-und Gemeinderatssprechstunde (monatlich), Kinderweihnachtsfeier 10.12.2026, Seniorenweihnachtsfeier 16.12.2026. Detail-URL-Muster `/veranstaltungen/2614814/2026/11/02/bürgermeister-und-gemeinderatssprechstunde.html`. „Schönfeld“ 0 Treffer. Kein iCal/RSS-Link (nur `ical.min.js`).
- Amtsblatt: auf Startseite kein Link; Websuche ohne Treffer. Nicht belegt.

##### www.amt-malchow.de (5)
- /robots.txt 200 (wie Demmin-Land).
- / 200: verwaltungsportal (38x). Menü „Veranstaltungen“: „Kulturelle Höhepunkte“ → https://www.visit-malchow.de/themen/veranstaltungshoehepunkte ; „Veranstaltungskalender“ → https://www.visit-malchow.de/aktivitaeten/veranstaltungen#/malchow-de/?widgetToken=ErUYHXYrvG8.& ; „Volksfest“ → /verzeichnis/objekt.php?mandat=130221.
- /seite/179243/fünfseen.html 200: Ortsteile Adamshoffnung, Petersdorf, Lenz-Süd, Grüssow, Neu-Grüssow, Rogeez, Kogel, Satow, Satow-Hütte. Text: Rogeez „Hier findet alljährlich das Dorffest statt“ (kein Datum); Feuerwehr organisiert „Zahlreiche Veranstaltungen“.
- /amtsblatt/index.php 200: Titel „Amtsblatt“, Brotkrumen „Malchower Tageblatt“. Ausgaben 2026 Nr. 1 bis 11 (Nr. 11/2026 vom 10.10.2026, 4914 kB). Download nur per POST-Formular (`form gazette_90646`, hidden `hash`) → nicht abgerufen (nur GET erlaubt). Verlag auf der Seite nicht genannt: nicht belegt.
- /veranstaltungen/index.php 200: „Keine Veranstaltungen gefunden“ (verwaltungsportal-Kalender leer).

##### www.visit-malchow.de (2)
- /robots.txt 200: `user-agent:* disallow:/contao/ /_contao/`.
- /aktivitaeten/veranstaltungen 200: Contao; Widget `<script src="https://tmvwhl.infomaxnet.de/action/widget?token=ErUYHXYrvG8.&containerId=malchow-events">` → TMV-Widget (infomax). Widget-JS nicht abgerufen.

##### www.amt-roebel-mueritz.de (5)
- /robots.txt 200 (wie Demmin-Land).
- / 200: verwaltungsportal (40x), Text „noLis“ 1x (Kontext nicht geprüft). Menü „Veranstaltungen“ → https://www.stadt-roebel.de/veranstaltungen . Amtsblatt-Seite /seite/144632/müritzanzeiger.html (nicht abgerufen, Kontingent).
- /seite/332314/fincken.html 200: Bauleitplanseite (Brotkrumen Aktuelles > Lfd. Bauleitplanverfahren > Fincken), keine Termine.
- /seite/780793/südmüritz.html 200: dito.
- /veranstaltungen/index.php 200: verwaltungsportal-Kalender, Orte im Filter nur `13810 Bollewick`, `14773 Röbel/Müritz`. Rubriken u. a. „Märkte & Feste“ (10). Einträge Bollewick/Röbel (Traditioneller Adventsmarkt 28. bis 29.11. und 05. bis 06.12.2026, Flohmarkt in der Scheune ...). Fincken/Südmüritz nur im Menü (Visitenkarten `/verzeichnis/visitenkarte.php?mandat=119600` Fincken, `205751` Südmüritz, `119623` OT Ludorf, `119631` OT Vipperow).

##### stadt-roebel.de (2)
- /robots.txt 200: WordPress-Standard (`/wp-admin/`, `/?s=`, `/search/`).
- /veranstaltungen/ 200: WordPress 7.1.3; Liste mit 70 `imx-agenda-item`, Klasse `imxplatform-cust-tmv` (infomax imx, Kunde TMV). Attribute `data-search="<titel> <ort>, <gemeinde>"`, Klassen `imx-agenda-item__title/__time/__short/__meta/__category`. Detail `/veranstaltungen/<slug>-<id>` (z. B. /veranstaltungen/altmecklenburger-weihnachtsmarkt-127603, Schloss Priborn). Orte: Röbel/Müritz 53, Priborn 5, Wredenhagen 3, Bollewick 2. Fincken/Südmüritz: 0 Events (Ludorf nur Menüpunkt „Dorfkirche Ludorf“). Kein Feed-Link.

##### www.altentreptow.de = Amt Treptower Tollensewinkel (7, eine über Kontingent für Feldprobe)
- /robots.txt 200: `Disallow: /cache/ /output/ /suche.phtml /suchen.phtml /redirect.phtml /showobject.phtml`.
- / 200: iKISS (`Advantic`, 100x `ikiss`, `data-ikiss-mfid`). Gemeindeseiten `/Amt-Gemeinden/Gemeinden-von-H-Z/Kriesow/`, `/…/T%C3%BCtzpatz/`. Kalender `/Freizeit-Tourismus/Veranstaltungen/`, Amtskurier `/Verwaltung/Amtskurier/`.
- /Freizeit-Tourismus/Veranstaltungen/ 200: ca. 27 Termine, darunter Dorftermine anderer Amtsgemeinden: „Laternenumzug in Grapzow“, „Herbstfeuer in Weltzin“, „Halloween in Grischow“, „Nacht und Nebelmarkt in Pripsleben“, „Frauenfrühstück in Grapzow“. Kriesow/Tützpatz: 0 Treffer. Detail-URL-Muster `/Freizeit-Tourismus/Veranstaltungen/<Titel>.php?object=tx,4357.4.1&ModID=11&FID=2973.1157.1&NavID=2973.14&bn=1`.
- /Amt-Gemeinden/Gemeinden-von-H-Z/Kriesow/ 200: Text zu OT Borgfeld (Kirche), keine Termine.
- /Amt-Gemeinden/Gemeinden-von-H-Z/T%C3%BCtzpatz/ 200: keine Termine.
- /Verwaltung/Amtskurier/ 200: PDFs Jan. bis Okt. 2026 („Amtskurier Oktober 2026 … PDF, 5.4 MB“); Text „LINUS WITTICH Medien KG dankt für Ihren Hinweis“, Mail logistik@wittich-sietow.de → Verlag LINUS WITTICH (Sietow).
- Detail …/Laternenumzug-in-Grapzow.php?…FID=2973.1157.1 200 (Feldprobe): Titel „Laternenumzug in Grapzow“, Text „Herzliche Einladung zum jährlichen Laternenumzug in Grapzow.“, `Datum: 06.11.2026`, `Veranstaltungsort: Grapzow`. Kein JSON-LD. iCal-Link `/output/options.php?ModID=11&call=ical&ext=ics&La=1&FID=2973.1157.1` liegt unter `/output/` = per robots.txt gesperrt, nicht abgerufen.

##### amt-woldegk (www.amt-woldegk.de → www.amt.windmuehlenstadt-woldegk.de) (5)
- /robots.txt 200 (nach Weiterleitung): `*`: Disallow /10, /email/, /*/email/, /cgi-bin/; MJ12bot/SemrushBot gesperrt.
- / 200: Skripte `tpl.mmcdn.de` (`manet-stadt`, `klaro-manet`), Fußzeile „mvp.de: Urlaub in Mecklenburg-Vorpommern“ → CMS von manet (Schwerin), mvp.de-Verbund. Menü „Veranstaltungskalender“ → /events-termine/. Seiten /ortsrecht/voigtsdorf/, /freizeit-sport/feuerwehren/ffw-voigtsdorf/.
- /events-termine/ 200: „Veranstaltungen in Woldegk und Umland“, Abschnitt `terminkalender`, Einträge mit Microdata `itemtype=http://schema.org/Event`, `itemprop=startDate` (content `2026-10-30`), `itemprop=name`, hCalendar-Klassen `vevent`, `dtstart`, `summary`, `data-event-id='385055'`, `short_description` („Freitag, 30. Oktober 2026 - Altes Gemeindehaus Strasburg - Kinoabend …“). Inhalte überwiegend Strasburg (Uckermark), Bilder teils `cdn.reservix.com`. Voigtsdorf 0. Kein Feed-Link.
- /der-landbote/ 200: Amtszeitung „Der Landbote“, letzte 5 Ausgaben als PDF (`/assets/99892/2026_10_Woldegk_kl.pdf`, `https://a.mmcdn.de/assets/99834/3474_Woldegk_39_26_ow.pdf`). Verlag auf Seite nicht genannt: nicht belegt.
- /freizeit-sport/feuerwehren/ffw-voigtsdorf/ 200: Adresse Dorfstraße 36, Überschrift „Termine“ ohne Einträge.

##### www.amt-guestrow-land.de (6)
- /robots.txt 200: Joomla-Standard (administrator, api, components, modules, plugins, tmp ...).
- / 200: `generator content="MYOB"`, Joomla (`com_content`, `com_finder`).
- /gemeinden/veranstaltungen.html 200: „Veranstaltungen in den Gemeinden … Termine …, die uns gemeldet wurden“; Unterseiten je Gemeinde `/gemeinden/veranstaltungen/veranstaltungen-<gemeinde>.html` (14 Gemeinden).
- /gemeinden/veranstaltungen/veranstaltungen-mistorf.html 200: Monatsblöcke, Felder `Wann:` / `Was:` / `Wo:`. Einträge u. a. 10.01.2026 Preisskat (Vereinshaus Goldewin), 07.03.2026 Frauentagsparty (Goldewiner Kulturtreff), 20.06.2026 14:00 bis 18:00 „Tag der offenen Tür bei der Freiwilligen Feuerwehr“ (Feuerwehrgerätehaus), 25.07.2026 Reitertag + Flohmarkt, **02.10.2026 18:00 „Herbstfeuer“, Wo: Sportplatz**.
- /gemeinden/veranstaltungen/veranstaltungen-muehl-rosin.html 200: gleiche Struktur; **03.04.2026 18:00 „Osterfeuer“, Wo: Herrenhaus Koitendorf**; 30.10.2026 Halloweenparty (Jugendclub, Neue Schule); 17.01.2026 Neujahrsempfang (Bölkower Bauernstuben).
- /bekanntmachungen/amtsanzeiger.html 200: „Amtsanzeiger“/„Amtskurier“, erscheint am 1. Mittwoch im Monat, Auflage 4430; „Die Verlag + Druck Linus Wittich KG ist für Satz, Druck, Herausgabe und die Verteilung … zuständig“. PDFs `/images/pdf/Amtsanzeiger/2026/01-26.pdf` usw.

##### www.muehlrosin.de (3)
- /robots.txt 200: WordPress-Standard.
- / 200: WordPress 7.1.3, Plugins bst-dsgvo-cookie, contact-form-7; Links /termine/, /tc-termine/.
- /termine/ 200: „Feste, Veranstaltungen und Höhepunkte in der Gemeinde Mühl Rosin für 2026“, Freitext je Zeile „DD.MM.YYYY Ort: Uhrzeit Titel“ (z. B. 31.10.2026 Mühlenbacher Landmarkt: ab 16:00 Halloween-Party; 08.12.2026 Seniorenweihnachtsfeier). Kein Kalender-Plugin, kein Feed.

##### www.gemeinde-satow.de (4)
- /robots.txt 200: `disallow:/contao/ /_contao/`.
- / 200: `generator Contao Open Source CMS`; Ratsinfo ratsinfo.gemeinde-satow.de.
- /veranstaltungen 200: Contao `mod_eventlist`, Monatsfilter Jan. 2026 bis Juni 2027; Einträge u. a. Oktoberfeuer Satow, Herbstfeuer Reinshagen, Herbstfeuer der Feuerwehr Radegast, Tüffelfest in der Kirchruine, Flohmarkt Heiligenhagen. Kein iCal/RSS-Link.
- /veranstaltungen/herbstfeuer-der-feuerwehr-radegast 200 (Feldprobe): JSON-LD `@type: Event`, `name` „Herbstfeuer der Feuerwehr Radegast“, `startDate` `2026-10-10T17:00:00+02:00`, `location` {`@type: Place`, `name` „Gerätehaus Radegast“, `address` {`@type: PostalAddress`, `description` „An der Eiche 4, 18239 Satow OT Radegast“}}, `url`. HTML: „Datum: 10.10.2026, 17:00 Uhr“, „Ort: …“.

##### schoenfeld-trittelwitz.de (Gemeinde Schönfeld, aus de.wikipedia) (6 erfolgreich, 2 Fehlversuche)
- https://www.schoenfeld-trittelwitz.de/robots.txt und / : Status 000 (keine Verbindung).
- http://www.schoenfeld-trittelwitz.de/ → https://schoenfeld-trittelwitz.de/ 200 (vor erfolgreichem robots-Abruf, Reihenfolge-Fehler).
- /robots.txt 404 (keine Regeln).
- Startseite: `generator Incomedia WebSite X5 Pro 2026.1.1`, Menü termine.html, feuerwehr.html, vereine.html. Text „Schönfeld besteht aus den Orten Schönfeld und Trittelwitz“.
- /termine.html 200: Text nur „KlönKaffeeSurfer jeden 2. Montag im Monat“, Termine als Bilder.
- /images/K800_Hoffest.jpg 200 (32 kB, gelesen): Plakat „Familien-Hofflohmarkt, Samstag, 11.04.2026, 10-17 Uhr, In Schönfeld Dorfstraße 48“, Hüpfburg, Imbiss, Kuchenbasar.
- /images/841918ABF1982C0A36141FD7748EE018.png 200: Schriftzug „Trittelwitz“ (Menügrafik).
- /feuerwehr.html 200: FF „Ostufer Kummerower See“ (seit 2017, Gemeinden Meesiger, Verchen, Schönfeld), keine Termine.

##### ludorf.online (2)
- /robots.txt 200: `User-agent: * Disallow: /`. Fehler meinerseits: Startseite im selben Befehl trotzdem abgerufen (200, 3 kB): Sedo-Parkseite. Domain ist keine Ortsteilseite mehr.

##### Landkreise
- www.lk-mecklenburgische-seenplatte.de (3): robots 200 (iKISS-Standard wie Altentreptow, `/output/` gesperrt); / 200 iKISS (`Advantic`, 16x `data-ikiss-mfid`); /Landkreis/Kultur/ 200: Unterseiten KulturHerbst, KunstOffen, Kunstsymposium, kein Veranstaltungskalender. Kreiskalender nicht gefunden.
- www.landkreis-rostock.de (4, Crawl-delay 15 eingehalten): robots 200 `Crawl-delay: 15`, `Disallow: /admin`; / 200 `generator GeoCMS Version:5.52.00 brain-SCC GmbH`; /de/veranstaltungen.html 200: Liste (9 Event-Links), Filter today/tomorrow/weekend, Link „Veranstaltung melden“ (/de/veranstaltung-melden.html), kein Feed; Detail /de/veranstaltung/event/129411,1295/blues-for-friends-30-10-2026.html 200: Abschnitte Beschreibung, Eintritt, Ticket-Link, „Veranstaltungsort(e)“ (Name, PLZ Ort, Straße, Telefon, Mail, Web), „Veranstalter“, „Vorverkaufsort(e)“; kein JSON-LD, kein iCal. Inhalte: Theater Güstrow, Kreisveranstaltungen; Satow/Mistorf/Mühl Rosin 0.

##### de.wikipedia.org (7)
- /robots.txt 200 (`/w/` und `/api/` gesperrt → nur /wiki/-Seiten).
- Schönfeld_(bei_Demmin): Weblink http://www.schoenfeld-trittelwitz.de/ . Fünfseen, Fincken, Kriesow: keine Gemeinde-Website im Artikel. Südmüritz: ludorf.online (geparkt), Amts-Visitenkarte. Tützpatz: www.altentreptow.de.

#### Websuchen (ohne Treffer zu Festen)
Schönfeld Dorffest/Feuerwehr 2026; Fünfseen Rogeez Dorffest 2026; Fincken Website/Dorffest; Fincken Dammwolde Jaebetz Feste; Südmüritz Vipperow Ludorf Dorffest 2026 (nur Sitzungsprotokolle roebelmueritz.sitzung-mv.de: Dorffest Vipperow 2025 ohne Datum); Tützpatz 2026 Feste; Kriesow Borgfeld Feste (Protokoll altentreptow.sitzung-mv.de: FF Kriesow 1961 gegründet, „feiert im nächsten Jahr ihr 65-jähriges Bestehen“, ohne Datum); Voigtsdorf Dorffest (nur Nordkurier-Altartikel, nicht abgerufen); Mistorf, Mühl Rosin; Amtsblätter Demmin-Land, Müritzanzeiger, Malchower Tageblatt (alle ohne Verlagsbeleg); Kreiskalender MSE und LK Rostock.

#### Anfragen je Host
www.amt-demmin-land.de 3 · www.amt-malchow.de 5 · www.visit-malchow.de 2 · www.amt-roebel-mueritz.de 5 · stadt-roebel.de 2 · www.altentreptow.de 7 · www.amt-woldegk.de/www.amt.windmuehlenstadt-woldegk.de 5 · www.amt-guestrow-land.de 6 · www.muehlrosin.de 3 · www.gemeinde-satow.de 4 · schoenfeld-trittelwitz.de 6 (+2 ohne Verbindung) · ludorf.online 2 · www.lk-mecklenburgische-seenplatte.de 3 · www.landkreis-rostock.de 4 · de.wikipedia.org 7. Nicht abgerufen: meinort.de, meta.et4.de, cmsweb.wittich.de, nordkurier.de, auf-nach-mv.de, epaper.wittich.de, tmvwhl.infomaxnet.de.

## 3. Rohnotizen Gruppe b

### fn-28.7 MV, Gruppe b: Rohnotizen (Stand 2026-10-27)

User-Agent aller curl-Abrufe: `Mozilla/5.0 (research; lasstreffen.at)`. Downloads in
lokaler Scratchpad der Gruppe b (nicht im Repo),
Anfragelog im lokalen Scratchpad.

#### Anfragen (URL, Status)

| Zeit | URL | Status |
|---|---|---|
| 19:12:06 | https://www.amt-mecklenburgische-schweiz.de/robots.txt | 200 |
| 19:12:07 | https://www.amt-rostocker-heide.de/robots.txt | 404 (keine robots.txt) |
| 19:12:09 | https://www.schwaan.de/robots.txt | 200 (Yoast, `Disallow:` leer) |
| 19:12:09 | https://www.amt-altenpleen.de/robots.txt | 200 |
| 19:12:10 | https://www.amt-barth.de/robots.txt | 200 (nur `User-agent: *`) |
| 19:12:11 | https://www.amt-bergen-auf-ruegen.de/robots.txt | 000 (Host antwortet nicht) |
| 19:12:11 | https://www.amt-franzburg-richtenberg.de/robots.txt | 200 |
| 19:12:12 | https://www.amt-gadebusch.de/robots.txt | 000 (Host antwortet nicht) |
| 19:12:12 | https://www.lk-vr.de/robots.txt | 200 |
| 19:12:13 | https://www.nordwestmecklenburg.de/robots.txt | 200 (`Crawl-delay: 15`, `Disallow: /admin`) |
| 19:12:29 | https://www.amt-mecklenburgische-schweiz.de/ | 200 (NOLIS-Hinweisseite „Weiter zur Startseite“) |
| 19:12:30 | https://www.amt-rostocker-heide.de/ | 200 |
| 19:12:31 | https://www.amt-altenpleen.de/ | 200 |
| 19:12:33 | https://www.amt-barth.de/ | 200 |
| 19:12:33 | https://www.amt-franzburg-richtenberg.de/ | 200 |
| 19:12:56 | https://www.amt-mecklenburgische-schweiz.de/portal/startseite.html | 200, Umleitung auf `/?ruri=...vs=1` (Hinweisseite) |
| 19:13:15 | https://www.amt-mecklenburgische-schweiz.de/portal/startseite.html?vs=1 | 200 (ohne Cookie-Annahme, Set-Cookie `s_naviID=0` ignoriert) |
| 19:13:47 | https://www.amt-mecklenburgische-schweiz.de/regional/veranstaltungen/sucheplus.html?titel=Veranstaltungen&vs=1 | 200 |
| 19:14:03 | https://www.amt-mecklenburgische-schweiz.de/amt-gemeinden/gemeinden/gemeinde-warnkenhagen/?vs=1 | 200 |
| 19:14:04 | https://www.amt-mecklenburgische-schweiz.de/bekanntmachungen/bekanntmachungsblaetter/2026/?vs=1 | 200 |
| 19:14:30 | https://www.amt-rostocker-heide.de/amt-rostocker-heide/Veranstaltungskalender-Amt-Rostocker-Heide/ | 200 |
| 19:14:57 | https://www.amt-rostocker-heide.de/roevershagen/Startseite-Roevershagen/ | 200 |
| 19:14:58 | https://www.amt-rostocker-heide.de/Mitteilungsblatt/ | 200 |
| 19:15:18 | https://www.amt-rostocker-heide.de/export/sites/arh/Mitteilungsblatt/Mitteilungsblaetter-2026/07-2026-web.pdf | 200 (4,9 MB) |
| 19:16:34 | https://www.amt-schwaan.de/robots.txt | 000 (Host antwortet nicht) |
| 19:16:35 | https://www.schwaan.de/ | 200 |
| 19:17:10 | https://www.schwaan.de/amt-schwaan/die-gemeinden/vorbeck/ | 200 |
| 19:17:11 | https://www.schwaan.de/amtsreport/ | 200 |
| 19:18:17 | http://www.ffw-vorbeck-kambs.de/robots.txt | 404 |
| 19:18:18 | http://www.ffw-vorbeck-kambs.de/ | 200 (Meta-Refresh auf feuerwehr-vorbeck-kambs.de) |
| 19:18:38 | http://www.feuerwehr-vorbeck-kambs.de/robots.txt | 200 (WordPress-Standard) |
| 19:18:39 | http://www.feuerwehr-vorbeck-kambs.de/ | 200 |
| 19:18:49 | https://feuerwehr-vorbeck-kambs.de/evants-u-a/ | 200 |
| 19:19:02 | https://schwaan.de/wp-content/uploads/seiten/Schwaan_13-03-26.pdf | 200 (2,1 MB) |
| 19:19:30 | https://www.amt-altenpleen.de/veranstaltungen/index.php | 200 |
| 19:20:05 | https://www.amt-altenpleen.de/veranstaltungen/2989769/2026/11/28/weihnachts-t%C3%B6pfermarkt-am-28.-november-2026-in-hohendorf.html | 200 |
| 19:20:06 | https://www.amt-altenpleen.de/veranstaltungen/index.php?rubrik=0&ort=20215 | 200 (Filter Preetz) |
| 19:20:43 | https://www.amt-altenpleen.de/veranstaltungen/index.php?rubrik=0&ort=18777 | 200 (Filter Groß Mohrdorf) |
| 19:21:09 | https://www.amt-barth.de/aktuell/veranstaltungen/ | 200 |
| 19:21:11 | https://www.amt-barth.de/gemeinden/divitz-spoldershagen/ | 200 |
| 19:21:26 | https://tmvwhl.infomaxnet.de/robots.txt | 200 (`Crawl-delay: 5`, `Disallow: /admin/ /ServiceInterface/ /data/`) |
| 19:21:27 | https://tmvwhl.infomaxnet.de/amt-barth-de/?widgetToken=uSlpg-mT6Qo.& | 200 (Abstand zur robots.txt nur 1 s, Crawl-delay 5 hier nicht eingehalten) |
| 19:22:04 | https://tmvwhl.infomaxnet.de/amt-barth-de/?form=search&widgetToken=uSlpg-mT6Qo.&searchType=search&dateWithout%5B%5D=1&query=Spoldershagen | 200, keine Treffer |
| 19:22:20 | dito `query=Barth` (Gegenprobe) | 200, Treffer je Tag |
| 19:22:45 | https://amt-bergen-auf-ruegen.de/robots.txt | 000 |
| 19:22:46 | https://www.stadt-bergen-auf-ruegen.de/robots.txt | 200 (`Disallow: /cache/ /output/ /suche.phtml /suchen.phtml /redirect.phtml`) |
| 19:22:46 | https://www.gadebusch.de/robots.txt | 200 (gleiche Datei wie Meckl. Schweiz) |
| 19:23:03 | https://www.stadt-bergen-auf-ruegen.de/ | 200 |
| 19:23:04 | https://www.lk-vr.de/ | 200 |
| 19:23:16 | https://www.nordwestmecklenburg.de/ | 200 |
| 19:23:18 | https://www.gadebusch.de/portal/startseite.html?vs=1 | 200 |
| 19:23:35 | https://www.gadebusch.de/regional/veranstaltungen/uebersicht.html?titel=Veranstaltungen&vs=1 | 200 |
| 19:23:55 | https://www.gadebusch.de/veranstaltungen/veranstaltungen.ical?…&selected_kommune=28390&…&beginn=20260101000000&ende=20261231235959&… | 200, 16 VEVENT |
| 19:24:21 | https://www.gadebusch.de/amt-gemeinden/kneese/?vs=1 | 200 |
| 19:24:43 | https://www.stadt-bergen-auf-ruegen.de/Amt-Bergen-auf-R%C3%BCgen/Patzig/ | 200 |
| 19:24:44 | https://www.stadt-bergen-auf-ruegen.de/Amt-Bergen-auf-R%C3%BCgen/Amtsbote-des-Amtes/ | 200 |
| 19:25:46 | https://www.stadt-bergen-auf-ruegen.de/Stadtleben/Veranstaltungen/ | 200 |
| 19:25:47 | https://gemeinde-patzig.de/robots.txt | 404 |
| 19:25:48 | https://www.patzig.de/robots.txt | 000 |
| 19:26:26 | https://www.stadt-bergen-auf-ruegen.de/Stadtleben/Veranstaltungen/index.php?ModID=11&object=tx,3331.4.1&La=1&NavID=2597.96&text=Patzig&kuo=1&sfvort=1&sfreg=1&sfort=1&bn=1 | 200, „keine Veranstaltungen gefunden“ |
| 19:26:40 | https://www.amt-franzburg-richtenberg.de/veranstaltungen/index.php | 200 |
| 19:27:08 | https://www.amt-franzburg-richtenberg.de/amtsblatt/index.php | 200 |
| 19:27:09 | https://www.amt-franzburg-richtenberg.de/seite/875049/die-offizielle-app-des-amtes-franzburg-richtenberg.html | 200 |
| 19:27:10 | https://www.amt-franzburg-richtenberg.de/seite/737923/papenhagen.html | 200 |
| 19:28:13 | https://www.lk-vr.de/Willkommen/Veranstaltungen/ | 200 |
| 19:29:07 | https://www.nordwestmecklenburg.de/de/veranstaltungen_im_landkreis.html | 200 nach Umleitung auf https://www.kultur-nwm.de/ (curl -L folgte, robots.txt von kultur-nwm.de erst danach gelesen; erlaubt alles außer /wp-admin/) |
| 19:29:20 | https://www.kultur-nwm.de/robots.txt | 200 |
| 19:29:36 | https://www.kultur-nwm.de/veranstaltungen-2026/ | 200, 144 Detail-Links |
| 19:29:38 | https://www.kultur-nwm.de/wp-json/wp/v2/types | 200 |
| 19:29:55 | https://www.kultur-nwm.de/wp-json/wp/v2/veranstaltungen?per_page=1 | 200 |

Nicht abgerufen: `/output/options.php?call=ical…` auf stadt-bergen-auf-ruegen.de (robots `Disallow: /output/`),
`/redirect.phtml?…url_fid=3331.250.1` („Internetseite der Gemeinde Patzig“, robots `Disallow: /redirect.phtml`),
epaper.wittich.de, meinort.de, nordkurier.de (nur als Suchtreffer gesehen).

#### Websuchen (WebSearch)
„Amt Mecklenburgische Schweiz Warnkenhagen Veranstaltungen“; „Amt Rostocker Heide Rövershagen
Veranstaltungskalender“; „Amt Schwaan Vorbeck Gemeinde Veranstaltungen“; „Amt Altenpleen Groß
Mohrdorf Preetz Veranstaltungen“; „Warnkenhagen Dorffest 2026 …“; „Rövershagen Dorffest 2026 …“;
„Gemeinde Vorbeck Schwaan Dorffest Website“; „Amt Bergen auf Rügen Gemeinde Patzig Website“;
„Amt Gadebusch Gemeinde Kneese Veranstaltungen“; „Spoldershagen Tonnenabschlagen 2026“;
„"Gemeinde Patzig" Rügen Veranstaltungen Dorffest“; „gemeinde-patzig.de“; „Amt Altenpleen Amtsblatt
Wittich“; „Amt Barth Amtsblatt …“; „Gadebusch Amtsblatt …“; „Weitenhagen Gemeinde Dorffest 2026“
(Treffer betrafen Weitenhagen im Amt Landhagen, VG, falsche Gemeinde); „Divitz Dorffest 2026 …“;
„Papenhagen Grimmen Dorffest …“; „Kneese Kittlitz Brückenfest 3. Oktober 2026“; „"Groß Mohrdorf"
Gemeinde Homepage …“; „"Warnkenhagen" Gemeinde Homepage …“. Keine eigene Gemeinde-Website für
Warnkenhagen, Rövershagen, Vorbeck, Groß Mohrdorf, Preetz, Divitz-Spoldershagen, Patzig,
Papenhagen, Weitenhagen, Kneese gefunden (Wikipedia-Infoboxen nennen jeweils die Amts-Domain).

#### Je Amt: Merkmale und Proben

##### Amt Mecklenburgische Schweiz (Warnkenhagen)
* Startseite ist eine NOLIS-Hinweisseite (`#nolis_header`, `#nolis_forward_top`), Link „Zur aufgerufenen
  Seite“ = `?vs=1`. Mit `?vs=1` volle Seite: `fonts.nol-is.de`, `NOLIS` im Code, Report-To
  `https://report.nol-is.de`, RSS `https://www.amt-mecklenburgische-schweiz.de/portal/rss.xml`.
* Veranstaltungen: https://www.amt-mecklenburgische-schweiz.de/regional/veranstaltungen/sucheplus.html
  Text: „Es wurden keine Veranstaltungen für diese Einstellungen gefunden.“ Kalender existiert, ist leer.
  vCalendar-Link auf leerer Liste nicht vorhanden; NOLIS-iCal nach C2 grundsätzlich möglich (Kommune-ID
  25920 aus URLs `…-900000020-25920.html`), nicht getestet, da leer.
* Gemeindeseite Warnkenhagen (Bildergalerie Thünengut, Tellow, Bürgerhaus Gottin), keine Termine.
* Bekanntmachungsblatt: 14-täglich als PDF, „Bekanntmachungsblatt Nr. 21/26 vom 24.10.2026“, Copyright
  „Amt Mecklenburgische Schweiz“, https://www.amt-mecklenburgische-schweiz.de/bekanntmachungen/bekanntmachungsblaetter/2026/ .
  Verlag nicht belegt (PDF nicht geöffnet).
* Dorffest Warnkenhagen: nicht gefunden (Amtskalender leer, Gemeindeseite, Websuche).

##### Amt Rostocker Heide (Rövershagen)
* Pfade `/export/sites/arh/…` (OpenCms-typisches Exportmuster), Generator-Meta fehlt; Hersteller nicht belegt.
* Kalender https://www.amt-rostocker-heide.de/amt-rostocker-heide/Veranstaltungskalender-Amt-Rostocker-Heide/ :
  händisch gepflegte Absätze `<div class="absatz_content"><p><strong>TT.MM.JJJJ - Titel</strong><br/>Text</p>`,
  kein Feed, kein JSON-LD. Probe: „30.10.2026 - Oktoberfeuer mit Laternenumzug in Mönchhagen“,
  „07.11.2026 - Plattdeutscher Nachmittag mit LandZeit in Rövershagen e.V.“, „03.12.2026 - Es wird
  gebastelt mit LandZeit in Rövershagen e.V.“, „28.11.2026 - Adventsmarkt in Blankenhagen“.
  Gemeindetermine aller fünf Gemeinden drin, nur zukünftige.
* Mitteilungsblatt monatlich als PDF https://www.amt-rostocker-heide.de/Mitteilungsblatt/ ;
  Anzeigen über Klatschmohn Verlag (http://www.klatschmohn.de/home/). PDF 07/2026 Impressum:
  „Herstellung: KLATSCHMOHN Verlag, Druck + Werbung GmbH“.
* Dorffest-Beleg: Mitteilungsblatt 07/2026, Bürgermeister Jörg Gensich, Gemeinde Rövershagen:
  „Abschließend die herzliche Einladung zu unserem diesjährigen Dorffest am 11.7.“ Nachmittagsprogramm
  15.00 Uhr, Kinderdisco 17.00 Uhr, Abendprogramm 20.00 Uhr.
  https://www.amt-rostocker-heide.de/export/sites/arh/Mitteilungsblatt/Mitteilungsblaetter-2026/07-2026-web.pdf
  (Dorffest 3.7./4.7.2026 in einer weiteren Amtsgemeinde, Seniorenhinweis, im selben Heft.)
* Rövershagen-Seiten liegen unter /roevershagen/ (FFW, Freizeit- und Kulturverein, Sportverein).

##### Amt Schwaan (Vorbeck)
* Amt und Stadt teilen https://www.schwaan.de/ (WordPress, Divi-CSS, Plugins add-search-to-menu,
  cookie-notice, ditty-news-ticker, wp-accessibility; RSS /feed/ nur News). Kein Veranstaltungskalender.
  amt-schwaan.de antwortet nicht.
* Vorbeck: https://www.schwaan.de/amt-schwaan/die-gemeinden/vorbeck/ , Stammdaten, Link FFW
  www.ffw-vorbeck-kambs.de, keine Termine. App-Hinweis „Amt Schwaan-App“ mit Bild `mein_ort-1-150x150.jpg`
  (https://www.schwaan.de/wp-content/uploads/seiten/Amt%20Schwaan-App.pdf), also meinOrt (WITTICH).
* Amtsblatt „Schwaaner Amtsreport“, 9 Ausgaben 2026 + aktuelle vom 16.10.2026,
  https://www.schwaan.de/amtsreport/ ; Impressum der Ausgabe 13.03.2026: „Herausgeber + Verlag:
  LINUS WITTICH Medien KG“, „Druck: Druckhaus Wittich“. Vorbeck/Kambs im Heft 03/2026 nicht erwähnt.
* FFW Vorbeck/Kambs: https://feuerwehr-vorbeck-kambs.de/ (WordPress 7.1.3), Seite „Events u.a.“ zuletzt
  2023 (Osterfeuer 2023 auf dem Dorfplatz, Amtsausscheid 2023). Facebook jfwvorbeckkambs verlinkt.
* Dorffest 2026: nicht gefunden.

##### Amt Altenpleen (Groß Mohrdorf, Preetz)
* verwaltungsportal: 75 × `verwaltungsportal`, `layout.verwaltungsportal.de/13588`. robots.txt sperrt nur
  benannte Bots (u. a. GPTBot), `Crawl-delay: 10` für Bingbot/ClaudeBot u. a., keine Regel für `*`.
* Liste https://www.amt-altenpleen.de/veranstaltungen/index.php , GET-Filter `rubrik`, `ort`, `suchbegriff`.
  Orte: 18777 „Groß Mohrdorf OT“, 18782 Klausdorf, 18206 Ortsteil Altenpleen, 20215 Preetz, 20219 Prohn.
  Rubriken u. a. 10 „Märkte & Feste“. Kein iCal/RSS. Eingebettetes JSON (Kalender-Widget):
  `{"startDate":"2026-11-28","endDate":"2026-11-28","title":"Wintermarkt in Schmedshagen am 28. November 2026"}`.
* Detail JSON-LD (Probe Töpfermarkt): `@type: Event`, `name`, `description`, `startDate`
  `2026-11-28T14:00:00+0100`, `image`, `location` `{"@type":"Place","name":""}` (leer).
* Filter Groß Mohrdorf: „Weihnachts-TÖPFERMARKT am 28. November 2026 in Hohendorf“
  https://www.amt-altenpleen.de/veranstaltungen/2989769/2026/11/28/weihnachts-t%C3%B6pfermarkt-am-28.-november-2026-in-hohendorf.html
* Filter Preetz: „Wintermarkt in Schmedshagen am 28. November 2026“
  https://www.amt-altenpleen.de/veranstaltungen/2991083/2026/11/28/wintermarkt-in-schmedshagen-am-28.-november-2026.html
  (beide Filterseiten zeigen zusätzlich dieselben drei Termine Halloween/Landkino/Disco, vermutlich
  ortsunabhängige Teaserbox; nicht belegt).
* Weitere: Lampionumzug Prohn 07.11.2026, Lichterfest Altenpleen 14.11.2026, Weihnachtsmarkt 12.12.2026.
* Amtsblatt: auf der Startseite nicht verlinkt, Websuche ohne Ergebnis: nicht belegt.
* Kindertag Groß Mohrdorf 31.05.2026 nur bei festivalsindeutschland
  (https://www.festivalsindeutschland.de/festival/kindertag-gross-mohrdorf), dort „im Veranstaltungskalender
  des Amtes“; im Amtskalender heute nicht mehr sichtbar (nur Zukunft).

##### Amt Barth (Divitz-Spoldershagen)
* TYPO3 (`generator content="TYPO3 CMS"`), tx_news für Bekanntmachungen/Aktuelles, tx_kesearch.
* Veranstaltungen https://www.amt-barth.de/aktuell/veranstaltungen/ = iframe
  `https://tmvwhl.infomaxnet.de/amt-barth-de/?widgetToken=uSlpg-mT6Qo.&` (TMV-Widget auf infomax,
  CSS-Klassen `-IMXEVNT-…`, CSS `28_amt-barth…css`). GET-Suchformular: `form=search`, `widgetToken`,
  `searchType`, `dateWithout[]`, `date`, `dateFrom`, `dateTo`, `timeFrom`, `eventSerieId`, `criterionId`,
  `query`. Standard 14 Tage, 47 bis 66 Termine je Tag (Region, nicht nur Amt). Termine per JS nachgeladen.
  Suche „Spoldershagen“: keine Treffer; „Barth“: Treffer. Kein Feed gefunden; `/data/` und
  `/ServiceInterface/` per robots gesperrt.
* Gemeindeseite https://www.amt-barth.de/gemeinden/divitz-spoldershagen/ : „Höhepunkte sind das
  alljährlich … stattfindende Kinderfest sowie das Dorffest“; „Tonnenabschlagen. Dieses alljährlich zu
  Pfingsten stattfindende Fest ist inzwischen auch in unserer Gemeinde zu einer festen Tradition geworden“;
  Traktor-Treffen Martenshagen seit 2005. Kein Datum 2026.
* Amtsblatt: nicht belegt.

##### Amt Bergen auf Rügen (Patzig)
* Amtsseiten auf https://www.stadt-bergen-auf-ruegen.de/Amt-Bergen-auf-R%C3%BCgen/ ; Advantic iKISS
  (`content="Advantic GmbH"`, 126 × `data-ikiss-mfid`). amt-bergen-auf-ruegen.de antwortet nicht.
* Kalender https://www.stadt-bergen-auf-ruegen.de/Stadtleben/Veranstaltungen/ (ModID=11), „Es wurden
  227 Veranstaltungen gefunden“, Kategorie u. a. „Feste“. iCal `/output/options.php?call=ical&ext=ics…`
  liegt unter robots-gesperrtem `/output/`. Suche `text=Patzig`: „Es wurden leider keine Veranstaltungen
  gefunden.“
* Patzig-Seite: Text, Ortsteile Veikvitz, Woorke; externer Link „Internetseite der Gemeinde Patzig“ über
  gesperrtes `/redirect.phtml`, Ziel nicht ermittelt.
* „Amtsbote des Amtes“: PDFs nur bis Nr. 01-2020 auf der Seite. Verlag nicht belegt.
* Websuche: Oldtimertreffen Patzig (Förderverein FFW) 31.05.2025 nur bei festivalsindeutschland, kein 2026.
* Dorffest 2026: nicht gefunden.

##### Amt Franzburg-Richtenberg (Papenhagen, Weitenhagen)
* verwaltungsportal (`layout.verwaltungsportal.de/18090`), robots wie Altenpleen.
* Liste https://www.amt-franzburg-richtenberg.de/veranstaltungen/index.php , Orte-Filter nur Anglerverein
  Velgast, Buchholz, Glewitz, Kleingartenverein, Leyerhofer Park, Richtenberg; Monatsfilter `monat=JJJJ-MM`.
  22 Termine (u. a. Herbstfeuer in Leyerhof 31.10.2026, Gemeinde-Weihnachtsfeier in Glewitz 05.12.2026),
  keiner aus Papenhagen oder Weitenhagen.
* App: „Die offizielle App des Amtes Franzburg-Richtenberg“, Google Play
  `de.verwaltungsportal.amtfranzburgrichtenberg`, Apple id6748531497 (verwaltungsportal baut auch Apps).
* Amtsblatt monatlich, Redaktion im Amt (Frau Dörre-Filter), Termine bis Oktober 2026 gelistet,
  https://www.amt-franzburg-richtenberg.de/amtsblatt/index.php ; Archiv-PDFs im HTML nicht verlinkt
  (vermutlich JS), Verlag nicht belegt.
* Papenhagen-Seite (Grußwort Bürgermeister Andy Lemke, Ortsteile), keine Termine. Weitenhagen-Seite
  wegen Anfragegrenze nicht abgerufen.
* Dorffest Papenhagen/Weitenhagen: nicht gefunden.

##### Amt Gadebusch (Kneese)
* https://www.gadebusch.de/ , NOLIS (`fonts.nol-is.de`, gleiche robots.txt wie Meckl. Schweiz,
  Hinweisseiten-Mechanik `?vs=1`), Kommune-ID 28390. amt-gadebusch.de antwortet nicht.
* Liste https://www.gadebusch.de/regional/veranstaltungen/uebersicht.html , vCalendar-Link
  `/veranstaltungen/veranstaltungen.ical?zeitauswahl=1&…&selected_kommune=28390&…&beginn=…&ende=…`.
  Abruf mit beginn 20260101, ende 20261231: 16 VEVENT, alle ab 27.10.2026 (Vergangenes kommt nicht).
  PRODID `-//NOLIS GmbH//NOLIS-Manager Kalender V3.5//DE`. Feldnamen der Probe: CATEGORIES CLASS
  CONTACT CREATED DESCRIPTION DTEND DTSTAMP DTSTART GEO LAST-MODIFIED LOCATION PRIORITY STATUS SUMMARY
  UID URL X-CATEGORIES X-GEO-PROJECTION X-ID X-KOMMUNE X-KOMMUNE-ID X-KURZ-DETAIL X-KURZBESCHREIBUNG
  X-LOCATION-ID X-LOCATION-OWNER X-NOLISEXPORT X-ORGANIZER X-ORT X-ORT-ID X-SERIENCONTAINER.
  Probe: `SUMMARY:Halloween Special Night im Rauchhaus Möllin`, `LOCATION:Rauchhaus Möllin, Möllin 12,
  14, 19205 Gadebusch`, `X-ORT:Gadebusch`, `X-KOMMUNE:Amt Gadebusch`. 5 der 16 sind Gremiensitzungen
  (`CATEGORIES:Politische Sitzungen`), u. a. „4. Sitzung der Gemeindevertretung Kneese am 10.11.2026“.
* Kneese-Seite https://www.gadebusch.de/amt-gemeinden/kneese/ : „Auf dieser Brücke findet daher in
  jedem Jahr am 3.Oktober … ein gemeinsames Fest der beiden Nachbargemeinden statt“ (Kneese und
  Kittlitz/SH). Datum 2026 nicht separat belegt. Externe Links u. a. map-one.eu/Gadebusch.
* Amtsblatt: nicht belegt (Websuche ohne Treffer, Startseite ohne Amtsblatt-Link).

#### Kreiskalender
* **Vorpommern-Rügen** https://www.lk-vr.de/Willkommen/Veranstaltungen/ : Advantic iKISS
  (`<meta name="author" content="Advantic Systemhaus GmbH">`, `data-ikiss-mfid`, ModID=11). „Es wurden
  21 Termine gefunden“, Inhalte Messe, Gleichstellung, Beratung (vocatium, Mädelsflohmarkt Ribnitz).
  Filter Veranstaltungsort, Region (u. a. Insel Rügen). Kein Dorffest, keine Gemeindetermine der
  Stichprobe. iKISS-iCal läge unter `/output/` (robots-gesperrt).
* **Nordwestmecklenburg**: https://www.nordwestmecklenburg.de/ (Generator „GeoCMS Version:5.51.05
  brain-SCC GmbH“). Link „Veranstaltungen im Landkreis“ leitet auf https://www.kultur-nwm.de/ um
  (WordPress, Kulturportal des Landkreises). Custom Post Type `veranstaltungen` (REST
  `/wp-json/wp/v2/veranstaltungen`), Jahresseiten `/veranstaltungen-2021/` … `/veranstaltungen-2026/`
  (144 Einträge 2026), Formular „Veranstaltung anmelden“. REST-Probe: Felder `id, date, modified, slug,
  status, type, link, title, content, excerpt, featured_media, template, meta, categories, tags,
  class_list, acf`; `acf` leer, also kein Veranstaltungsdatum im REST (nur Veröffentlichungsdatum).
  Festbeispiele 2026: „30. Münzfest Gadebusch“, „Großes Kinderfest in Gadebusch“, „Herbstmarkt
  Gadebusch“, „30. Festwoche im Kirchspiel Diedrichshagen mit Kreiserntedankfest 2026“, „Mittelalterfest
  1000 Jahre Standort Kirche Mummendorf“. Kneese: 0 Treffer.
* Landkreis Rostock: nicht geprüft (nicht beauftragt).

#### Hinweise zur Regeltreue
* tmvwhl.infomaxnet.de: zweite Anfrage 1 s nach robots.txt trotz `Crawl-delay: 5`.
* nordwestmecklenburg.de-Link folgte per Umleitung auf kultur-nwm.de, bevor dessen robots.txt gelesen
  war (robots erlaubt den Pfad).
* amt-mecklenburgische-schweiz.de: 7 Anfragen (eine davon führte nur auf die Hinweisseite).
* Keine Cookies gesetzt oder angenommen, keine Formulare abgeschickt außer GET-Suchen/Filtern.

## 4. Rohnotizen Gruppe c

### fn-28.7 MV, Gruppe c: Rohnotizen (Stand 2026-10-27)

Arbeitsverzeichnis Downloads: lokaler Scratchpad der Gruppe c (nicht im Repo) (log.txt = Anfrageprotokoll).
Werkzeug: curl (UA "Mozilla/5.0 (research; lasstreffen.at)", `--ssl-no-revoke`), einmal WebFetch, WebSearch.

#### Anfragen (URL, Status)

##### Domainfindung (fehlgeschlagene Hosts)
- https://www.amt-am-peenestrom.de/robots.txt 000 (TLS: Zertifikat passt nicht, SEC_E_WRONG_PRINCIPAL); http 500; https ohne www 000. Amt läuft auf wolgast.de (Hauptsatzung, Suchtreffer https://www.wolgast.de/fileadmin/Dateien/Buergerservice/Ortsrecht/Amt%20Am%20Peenstrom/FD%20Service/Hauptsatzung_Amt_Am_%20Peenestrom.pdf).
- https://www.amtusedom-sued.de/robots.txt 000 (TLS-Handshake), amtusedom-sued.de 000, www.amt-usedom-sued.de 000. Echte Domain www.amtusedom.de (Suchtreffer Bekanntmachungen).
- https://www.wittenburg.de/robots.txt 000; http://www.wittenburg.de/robots.txt 200 nach Umleitung auf http://213.178.84.156 (leer); HEAD http://www.wittenburg.de/ 302 auf IP. Echte Domain www.amt-wittenburg.de (museum.de-Eintrag laut Suche).
- https://www.hintersee-online.de/robots.txt 000; http 301 auf http://www.amt-am-stettiner-haff.de/gemeinden/hintersee/robots.txt (Domain leitet auf Amtsseite).

##### robots.txt
- www.amt-am-stettiner-haff.de 200: `User-agent: *`, nur /fileadmin/template|css|js|fonts, /typo3*, /uploads gesperrt.
- amt-anklam-land.info 200: nur /wp-admin/; Sitemap amt-anklam-land.de. amt-anklam-land.de/robots.txt 000 (Verbindung abgelehnt).
- www.amt-hagenow-land.de 200: `*` sperrt nur Kontakt/Suche/allris-tmp; WebCopier, HTTrack ganz gesperrt.
- www.amt-parchimer-umland.de 200 (verwaltungsportal-Standard): `Disallow: /` nur für benannte Bots (dotbot, AhrefsBot, GPTBot, Bytespider, meta-externalagent u. a.); Crawl-delay 10 für Baiduspider, Yandex, Slurp, Bingbot, ClaudeBot; keine Regel für `*`.
- veranstaltungen.amt-crivitz.de 200: identische verwaltungsportal-Datei.
- www.amt-crivitz.de 200: `*` sperrt /externe_nutzer/, /system/, /html5video/, `*/bWFpb*`.
- www.kreis-vg.de, www.kreis-lup.de, www.amt-wittenburg.de 200 (iKISS-Standard): `*` sperrt /cache/, /output/, /suche.phtml, /suchen.phtml, /redirect.phtml. Folge: iCal-Export `/output/options.php?call=ical...` ist per robots gesperrt.
- www.wolgast.de 200: nur /typo3/, /typo3_src/.
- www.amtusedom.de 200: sperrt /wp-admin/, /amtsblatt/, /wp-content/, /wp-includes/, /xmlrpc.php, /wp-.
- www.amt-ssl.de 200: `Allow: /`.
- gemeinde-pinnow.orts.app 200: `*` sperrt /click/, /content/pdf/, /app/; CCBot, Google-Extended, FacebookBot, Omgili ganz gesperrt; Yandex Crawl-delay 60.
- usedom.de 200: `Allow: /`, `Disallow: *.pdf`.
- hafen-ziemitz.de/robots.txt 200 liefert Fehlerseite „PHP version not supported“ (keine Regeln).

##### Startseiten und Kalender
| URL | Status | Befund |
|---|---|---|
| https://www.wolgast.de/ | 200 | TYPO3 (generator „TYPO3 CMS“, `/_assets/`), Links /veranstaltungen/, /amt-am-peenestrom/sauzin/, Amtsbote |
| https://www.wolgast.de/veranstaltungen/ | 200 | kein Server-HTML-Inhalt; `<script type="module" src="https://newpages.destination.one/web-components.js">`, Attribute `data-experience="wolgast"`, `data-base-path="/veranstaltungen/"`, `data-router-mode="history"`, `data-template="wlan"`, `data-language="de"` |
| https://www.wolgast.de/amt-am-peenestrom/sauzin/ | 200 | Ortsbeschreibung Sauzin/Ziemitz, keine Termine; externe Links sauziner-dorfkrug.de, hafen-ziemitz.de, hof-jaddatz.de |
| https://www.wolgast.de/buergerservice/weitere-dienste/amtsbote/ | 200 | „Der Amtsbote am Peenestrom“, Fristen 2026, PDFs `/fileadmin/Dateien/Buergerservice/Amtsbote/2026/3475_Wolgast_<NN>_26_oW.pdf` |
| https://www.wolgast.de/fileadmin/Dateien/Buergerservice/Amtsbote/2026/3475_Wolgast_42_26_oW.pdf | 200 (3,1 MB) | Jahrgang 22 Nr. 10, 16.10.2026, „Amtliche Bekanntmachungen des Amtes Am Peenestrom und der Gemeinden … Sauzin (mit Ziemitz)“; Verlag im Text nicht lesbar (Impressum vermutlich Bild); kein Sauzin-Termin |
| https://www.amt-am-stettiner-haff.de/ | 200 | TYPO3 (generator, `typo3conf/ext/bootstrap_package`), Termine als `tx_ttnews` (`/aktuelles/veranstaltungen/veranstaltung-einzelansicht/datum/JJJJ/MM/TT/?tx_ttnews[tt_news]=<id>`) |
| https://www.amt-am-stettiner-haff.de/aktuelles/veranstaltungen/ | 200 | Liste 5 Seiten (`/seite/<n>/`); Eintrag „Dorfkino mit "Spaziergang nach Syrakus", Hintersee“ 30.10.2026, Multiples Haus, 19.30 Uhr; Format „Titel, Ort“ + Datum + „Ort \| Beginn“ |
| https://www.amt-am-stettiner-haff.de/aktuelles/veranstaltungen/seite/3/ | 200 | u. a. „Weihnachtsmarkt Münkebude“ 20.12.2026, „Silvesterparty, Altwarp“; kein Hintersee-Fest |
| https://www.amt-am-stettiner-haff.de/gemeinden/hintersee/ | 200 | Ortsseite, Mail buergermeister@hintersee-online.de, Facebook https://www.facebook.com/fenngemeinde.hintersee/ , Box „Veranstaltungen in der Region“ |
| https://www.amt-am-stettiner-haff.de/fileadmin/mediapool_amt_stettin/dokumente/pdf/aktuelles/amtsblatt/2026/Ausgabe-01-2026.pdf | 404 | URL aus Suchtreffer, nicht mehr vorhanden |
| https://amt-anklam-land.de/ | 200 | WordPress 7.1.3 + Elementor/Elementor Pro, 3d-flipbook-dflip-lite; Links /amtsblatt/, /iven/, /feed/ (WP-News-RSS); kein Kalender-Plugin |
| https://amt-anklam-land.de/iven/ | 000 (curl, zweimal, Verbindung abgelehnt); WebFetch ok | Iven: 182 EW, BM Jörg Beweries; Links Satzungen, Sonstiges, sessionnet.owl-it.de; „kein Veranstaltungs- oder Terminkalender erkennbar“ |
| https://amt-anklam-land.de/amtsblatt/ | 000 | nicht abrufbar |
| https://www.amtusedom.de/ | 200 | WordPress 7.1.3, Theme GeneratePress, ml-slider; kein Kalender; Feeds `/?feed=rss2` (News), `https://usedomsued.sitzung-mv.de/public/rss/sifuture` (Sitzungen); Menü „Usedomer Amtsblatt“ (?page_id=898) |
| https://www.amtusedom.de/?page_id=74 | 200 | Gemeinde Korswandt (OT Ulrichshorst, BM Kai Handke), keine Termine |
| https://www.amtusedom.de/?page_id=898 | 000 (zweimal, „Could not connect“) | Amtsblatt-Seite nicht abrufbar |
| https://www.amt-hagenow-land.de/ | 200 | NOLIS (`fonts.nol-is.de`, 453× „nolis“); `/portal/rss.xml` (News), kein Veranstaltungsmenü |
| https://www.amt-hagenow-land.de/amt-gemeinden/huelseburg/ | 200 | OT Hülseburg, Presek; nur Bekanntmachungen (Gemeindevertretersitzungen 26.08./30.09.2026); keine Termine |
| https://www.amt-hagenow-land.de/leben-freizeit/freizeit/ | 200 | kein Kalender |
| https://www.amt-hagenow-land.de/portal/seiten/der-hagenower-kommunalanzeiger-900000037-28990.html?rubrik=900000002 | 200 | „Hagenower Kommunalanzeiger“, monatlich, Verlag „WITTICH Medien KG“ Sietow, Link https://www.wittich.de/produkte/zeitungen/3495-hagenower-kommunalanzeiger ; nächste Ausgabe 13.11.2026 |
| https://www.amt-parchimer-umland.de/ | 200 | verwaltungsportal (`layout.verwaltungsportal.de/26/`), Text „Mecklenburg-Vorpommern vernetzt“ |
| https://www.amt-parchimer-umland.de/veranstaltungen/index.php | 200 | 46 Termine, Ortsfilter: Barkow, Domsühl, Grebbin, Groß Godems, Herzberg, Matzlow, Parchim, Severin; „Veranstaltung kostenlos melden“; Zölkow nicht im Filter |
| https://www.amt-parchimer-umland.de/verzeichnis/objekt.php?mandat=38755 | 200 | Zölkow (OT Groß Niendorf, Hof Grabow, Kladrum, Zölkow); Box „Veranstaltungen“: „12. E-Dartturnier“ 14.11.2026 und „Gemeinde Kinderweihnachtsfeier“ 05.12.2026 (beide Förderverein FFw Zölkow, ehem. Turnhalle Kladrum), Links /veranstaltungen/2860607/… und /veranstaltungen/2860616/2026/12/05/gemeinde-kinderweihnachtsfeier.html |
| https://www.amt-parchimer-umland.de/amtsblatt/index.php | 200 | Amtsblatt Amt Parchimer Umland, Nr. 10/2026 vom 23.10.2026; Verlag auf der Seite nicht genannt |
| https://www.amt-ssl.de/ | 200 | SIQUANDO Pro (generator „SIQUANDO Pro (#6434-9438)“) |
| https://www.amt-ssl.de/wasistlos/veranstaltungen/ | 200 | SIQUANDO-Kalenderabsatz (`ngpluginparagraphcalendar`, Klasse `paragraphcalendar`), 209 Einträge, kein Feed, kein JSON-LD; Zeilenformat „TT.MM.JJJJ: HH:MM - HH:MM Ort · Venue · Titel“; „Hier Veranstaltung anmelden“; Kuhlen-Wendorf: „Tanztee“ Bernsteinschloss Wendorf 28.10./18.11./09.12.2026, „Pferdemärchen im Schlossressort“ 12.12.2026 |
| https://www.amt-ssl.de/kuhlen-wendorf/ | 200 | 10 OT (Gustävel, Holdorf, Holzendorf, Kuhlen, Müsselmow, Nutteln, Tessin, Weberin, Wendorf, Zaschendorf), FF Gustävel und Wendorf; keine Termine, keine eigene Website verlinkt |
| https://www.amt-ssl.de/das-amt/amtsblatt/ | 200 | Amtsblatt-PDFs `/amtsblatt/2026_01.pdf` bis `2026_10.pdf`, Datei „Jahreskalender_Linus_2026.pdf“ |
| https://www.amt-ssl.de/amtsblatt/2026_09.pdf | 200 (5,6 MB) | „Amtsblatt Sternberger Seenlandschaft“ Nr. 09/2026 vom 12.09.2026; Impressum „Herausgeber, Druck und Verlag: LINUS WITTICH Medien KG“; kein Kuhlen-Wendorf-Fest |
| https://www.amt-crivitz.de/ | 200 | OpenCms-Pfadmuster `/export/sites/crivitz/_conf/system/` (Herstellername nicht im HTML) |
| https://www.amt-crivitz.de/kultur-freizeit-und-urlaub/veranstaltungen/ | 200 | verweist auf https://veranstaltungen.amt-crivitz.de/ , kreis-lup.de, auf-nach-mv.de, schwerin.de |
| https://www.amt-crivitz.de/das-amt/aktuelles/crivitzer-amtsbote/ | 200 | „Crivitzer Amtsbote“, Verlag Linus Wittich Medien KG, Online-Tool `https://meinwittich.wittich.de/user/register` |
| https://veranstaltungen.amt-crivitz.de/ | 200 | verwaltungsportal (`layout.verwaltungsportal.de/21566/`), 20 Termine |
| https://veranstaltungen.amt-crivitz.de/veranstaltungen/index.php | 200 | 142 Termin-Links; Ortsfilter u. a. Pinnow, Plate; Rubriken (Märkte & Feste, Kinder …); „Veranstaltung kostenlos melden“ |
| https://veranstaltungen.amt-crivitz.de/veranstaltungen/2985108/2026/11/07/herbstfeuer-mit-laternenumzug.html | 200 | JSON-LD siehe unten |
| https://www.amt-wittenburg.de/ | 200 | Advantic iKISS (`content="Advantic GmbH"`, `data-ikiss-mfid`); RSS `/media/rss/veranstaltungen.xml`, `/media/rss/bekannntmachungen.xml` |
| https://www.amt-wittenburg.de/media/rss/veranstaltungen.xml | 200 | RSS 2.0, ISO-8859-15, `<generator>IKISS</generator>`, 22 Items |
| https://www.amt-wittenburg.de/Verwaltung-Aktuelles/Stadt-und-Landbote/ | 200 | „Wittenburger Stadt- und Landbote“, seit 01/2023 LINUS WITTICH Medien KG |
| https://www.kreis-vg.de/ | 200 | iKISS (`data-ikiss-mfid`) |
| https://www.kreis-vg.de/Leben/Veranstaltungskalender/ | 200 | iKISS ModID=11, „80 Veranstaltungen“, fast nur Theater Anklam und Schulungstermine Gesundheitszeugnis; keiner der Orte Sauzin/Hintersee/Iven/Korswandt; iCal `/output/options.php?call=ical&ext=ics&kuo=1&ModID=11` (robots-gesperrt); „Veranstaltung eintragen“ |
| https://www.kreis-lup.de/ (→ index.php) | 200 | iKISS (`content="Advantic GmbH"`) |
| https://www.kreis-lup.de/Leben-im-Landkreis/Freizeit-und-Kultur/Veranstaltungen/ | 200 | iKISS ModID=11, „1475 Veranstaltungen“, „alle Termine exportieren“ (iCal unter /output/, robots-gesperrt); Regionsfilter „Meckl. Schwerin, Ostseeküste, Seenplatte“; enthält auch Orte außerhalb LUP (Schwerin, Grevesmühlen); Datenquelle nicht belegt |
| https://www.kreis-lup.de/…/Gest%C3%BCtsf%C3%BChrung-bei-den-Bernsteinreitern.php?…FID=3378.738310.1 | 404 mit Inhalt | Felder „Datum“, „Uhrzeit“, „Ort: Schlossallee 1, 19412 Wendorf“, „Termin exportieren“; kein JSON-LD, keine itemprops |
| https://gemeinde-pinnow.orts.app/ (→ ?SSOC=1) | 200 | SPA, Inhalte per JS; `meta author/publisher = Gemeinde Pinnow`; Impressum-JSON nennt Hosting „apicodo AG, Große Bleiche 15, 55116 Mainz“; Menü „Kalender“ → /events; RSS `https://gemeinde-pinnow.orts.app/Newsfeed` |
| https://gemeinde-pinnow.orts.app/events | 200 | gleiche SPA-Hülle, keine Termine im HTML, kein JSON-LD |
| https://gemeinde-pinnow.orts.app/Newsfeed | 200 | RSS 2.0, 100 Items; Felder `title`, `link`, `guid`, `pubDate`, `dc:creator`, `category`, `description`, `content:encoded`; Termindatum nur im Slug/Text |
| https://usedom.de/veranstaltungen (→ /usedom-erleben/events) | 200 | Next.js + Drupal JSON:API (`jsonapi/…`, `drupal_internal__id`), eigene Eventerfassung (`events/event-anmelden`), Termine nur clientseitig; Korswandt 0 Treffer im HTML |
| https://hafen-ziemitz.de/ | 200 | Hafen-Website, „letzte Aktualisierung am 25.01.2021“, keine Termine |

#### Feldproben

**verwaltungsportal JSON-LD (Crivitz, Plate):**
```
{"@type":"Event","name":"Herbstfeuer mit Laternenumzug","description":"","startDate":"2026-11-07T17:30:00+0100",
 "image":["https://fotos.verwaltungsportal.de/events/2/9/8/5/1/0/8/Herbstfeuer_Plate.webp"],
 "location":{"@type":"Place","name":"Pfarrscheune Plate","address":{"@type":"PostalAddress","streetAddress":"Störstraße 1","postalCode":"19086","addressLocality":"Plate","addressCountry":"DE"},"url":".../verzeichnis/mandat.php?mandat=186651&kategorie=1350"},
 "organizer":{"@type":"Organization","name":"Freunde der FFW Plate e.V.","address":{...,"postalCode":"19086","addressLocality":"Plate"},"url":".../verzeichnis/mandat.php?mandat=193890&kategorie=6022"}}
```
Anders als die Gedern-Probe im Vorbericht C7: hier mit Straße, PLZ, Ort und Veranstalter.

**iKISS-RSS (Wittenburg):** `title`, `link` (`…/Erlebnis-Tourismus/Veranstaltungen/<slug>.php?ModID=11&FID=3627.<id>.1`), `description` beginnt mit Datum/Zeit/Ort im Freitext: „11.12.2026 bis 13.12.2026 : Der Weihnachtsmarkt zieht um …“, „29.10.2026 ab 19:00 Uhr in St. Bartholomäuskirche, Kirchenplatz, 19243 Wittenburg: …“. Kein pubDate je Item, keine Struktur für Ort.

**tt_news (Stettiner Haff):** Liste „Titel, Ortsname“ / Datum / „Venue \| Beginn: HH.MM Uhr“; Datum auch in Detail-URL.

**SIQUANDO-Kalender (Amt SSL):** Kopfzeile „28.10.2026: 14:00 - 17:00 Wendorf (19412) · Bernsteinschloss · Tanztee“, darunter Ort, Adresse „Schlossallee 1, 19412 Kuhlen- Wendorf“, Freitext.

#### Dorffest-Test
- Plate: „Herbstfeuer mit Laternenumzug“ 07.11.2026, Pfarrscheune Plate, Freunde der FFW Plate e.V. https://veranstaltungen.amt-crivitz.de/veranstaltungen/2985108/2026/11/07/herbstfeuer-mit-laternenumzug.html ; außerdem „24. Plater Adventsmarkt“ 29.11.2026 (Liste index.php).
- Pinnow: „650 Jahre Godern: Ein Tag, zwei Feste und 5300 Tage Gemeinde Pinnow!“ am 5. Juli (Slug), Strand Godern, RSS-pubDate 17.06.2026 https://gemeinde-pinnow.orts.app/am-5-juli-am-strand-in-godern-650-jahre-godern-ein-tag-zwei-feste-und-5300-tage-gemeinde-pinnow_X1vI ; „Kürbisfest“ 1. Oktober, Bürgerhaus https://gemeinde-pinnow.orts.app/am-1-oktober-um-14-uhr-im-buergerhaus-kuerbisfest_y4FI . Im Amtskalender Crivitz nur Kino, Kita, Lesung.
- Wittenburg: „Wittenburger Weihnachtsmarkt auf der Bürgerwiese“ 11.12. bis 13.12.2026 https://www.amt-wittenburg.de/Erlebnis-Tourismus/Veranstaltungen/Wittenburger-Weihnachtsmarkt-auf-der-B%C3%BCrgerwiese.php?ModID=11&FID=3627.396.1 ; „Martinstag in Wittenburg“ 11.11.2026 (Umzug mit Laternen).
- Zölkow: keine typische Festart; nächster Treffer „Gemeinde Kinderweihnachtsfeier“ Förderverein FFw Zölkow, 05.12.2026 https://www.amt-parchimer-umland.de/veranstaltungen/2860616/2026/12/05/gemeinde-kinderweihnachtsfeier.html .
- Hintersee: nicht gefunden (Amtskalender Seite 1 und 3, Ortsseite). Einziger Ortstermin „Dorfkino“ 30.10.2026.
- Kuhlen-Wendorf: nicht gefunden (Amtskalender SSL, Ortsseite, Amtsblatt 09/2026). Nur Tanztee/Pferdemärchen Bernsteinschloss bzw. Reithalle Wendorf.
- Sauzin: nicht gefunden (wolgast.de Ortsseite, Amtsbote 10/2026, Websuche, hafen-ziemitz.de). destination.one-Widget „wolgast“ nicht abgefragt (meta.et4.de gesperrt laut Auftrag).
- Iven: nicht gefunden (Amtsseite per WebFetch, Websuche). Websuche nennt ein Erntefest Iven im Amtsblatt Oktober 2018 (https://amt-anklam-land.info/wp-content/uploads/2021/03/Amtsblatt-Oktober-2018.pdf), zu alt.
- Korswandt: nicht gefunden (Amtsseite, usedom.de-HTML, Websuche).
- Hülseburg: nicht gefunden (Amtsseite NOLIS, Freizeit-Seite, Websuche); Kommunalanzeiger nicht geöffnet.

#### Amtsblätter
- Am Peenestrom: „Der Amtsbote am Peenestrom“, PDFs auf wolgast.de; Verlag laut Suchtreffer Bibliothekskatalog Linus Wittich KG Sietow (https://www.bibkat.de/wolgast/medium/der-amtsbote-2024-0454/ , nicht selbst geöffnet); im PDF nicht lesbar.
- Am Stettiner Haff: „Amtliches Mitteilungsblatt“ (/buergerservice/mitteilungsblatt/); Verlag 2026 nicht belegt (Suchzusammenfassung: 2024 Schibri-Verlag, Druck Wittich; Vertrag Ende 2025 neu ausgeschrieben).
- Anklam-Land: Amtsblatt unter https://amt-anklam-land.de/amtsblatt/ (nicht abrufbar); 2014 laut Suchtreffer LINUS WITTICH; aktuell nicht belegt.
- Usedom-Süd: „Usedomer Amtsblatt“ (https://www.amtusedom.de/?page_id=898, nicht abrufbar); Verlag nicht belegt.
- Hagenow-Land: „Hagenower Kommunalanzeiger“, WITTICH Medien KG.
- Parchimer Umland: „Amtsblatt“ https://www.amt-parchimer-umland.de/amtsblatt/index.php ; Verlag nicht belegt.
- Sternberger Seenlandschaft: „Amtsblatt Sternberger Seenlandschaft“, LINUS WITTICH Medien KG (Impressum 09/2026).
- Wittenburg: „Wittenburger Stadt- und Landbote“, LINUS WITTICH Medien KG seit 2023.
- Crivitz: „Crivitzer Amtsbote“, Linus Wittich Medien KG.

#### Websuche (Auswahl)
- Amt Am Peenestrom = wolgast.de; Usedom-Süd = amtusedom.de; Amt SSL = amt-ssl.de; Wittenburg = amt-wittenburg.de; Pinnow = gemeinde-pinnow.orts.app (Treffer https://gemeinde-pinnow.orts.app/file/b619aea8-7922-4f2c-bcb9-cd2c431ad5af).
- `site:orts.app Gemeinde`: keine Treffer; Gemeindezahl der Plattform nicht belegt.
