# Bundesweite Gemeinde-Plattformen und Verlage (Querschnitt, Stand 2026-10-27)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.1`. Gesucht ist das deutsche
Gegenstück zu gem2go: Anbieter, über die viele kleine Gemeinden ihre Veranstaltungen
veröffentlichen, sodass eine Integration viele Gemeinden liefert. Ausgangslage und
Tourismus/Ticketing-Quellen: `docs/research/deutschland-event-quellen-2026-10.md`.

Arbeitsweise: nur lesend, keine Konten, keine Formulare, keine Mails. Jede Zahl unten
stammt aus einer eigenen Antwort vom 27.10.2026 oder aus einer verlinkten Seite;
„Eigenangabe“ heißt Werbeaussage des Betreibers, „selbst gezählt“ heißt aus einer
abgerufenen Liste gezählt. Was sich nicht belegen ließ, steht als „nicht belegt“ da.
Alle Anfragen mit Statuscode: [00-bundesweit-anfragen.md](00-bundesweit-anfragen.md).
Die Länder-Tickets verlinken hierher und ergänzen nur die Landessicht.

## Kurzfazit

1. **Es gibt kein deutsches gem2go, aber eine Handvoll Hersteller mit zentraler
   Schnittstelle.** Drei Anbieter liefern mit einem Zugriffsweg die Termine vieler
   Gemeinden in festen Feldern: **Heimat-Info** (offene JSON-API, 648 Kommunen selbst
   gezählt, Schwerpunkt Bayern), **cm city media Cross7** (eine JSON-API für alle
   Kundenseiten, Eigenangabe „Über 450 Kunden“, BW/BY/HE) und **NOLIS** (iCal mit
   Kommune/Ort/Veranstalter, Eigenangabe „über 450 Kommunen“, Niedersachsen belegt).
   In allen dreien sind Feuerwehr-, Schützen- und Weihnachtsmarkt-Termine belegt.
2. **Die WITTICH-Gruppe ist der größte Einzelhebel und nur per Vereinbarung
   erreichbar.** Zu ihr gehören meinOrt (2.197 Orte selbst gezählt, Eigenangabe
   „Über 2.500“), Heimat-Info (Cosmema WITTICH GmbH), die WordPress-Gemeindeseiten
   „townhall“ (spiegeln Heimat-Info) und die LINUS-WITTICH-Amtsblätter. meinOrt und
   das Redaktionssystem sind per robots.txt gesperrt. Ein Gespräch mit WITTICH ist
   die wichtigste Einzelanfrage dieses Epics.
3. **Amtsblatt-Verlage veröffentlichen fast nur PDF.** Ausnahme ist **NUSSBAUM**
   (BW, Eigenangabe „>380 Städte und Gemeinden“) mit strukturierten Event-Seiten und
   Tages-Sitemaps; die robots.txt sperrt aber KI-Crawler ausdrücklich und eine Lizenz
   fehlt. Primo und Riedel: nur E-Paper.
4. **Standard-Kalender-Plugins helfen in der Breite wenig, sind aber billig.** In
   einer Abfrage von 181 erreichbaren Startseiten kleiner Gemeinden hatten 12 ein
   Plugin mit offenem Feed (The Events Calendar 7, Modern Events Calendar 3, JEvents 1,
   iCagenda 1). Ein Plugin-Detektor ist trotzdem sinnvoll, weil er ohne Parser je
   Gemeinde auskommt. TYPO3 und Contao haben Feeds nur nach Konfiguration; an keiner
   geprüften Gemeinde war einer verlinkt.
5. **destination.one deckt Dorffeste nur punktuell ab.** Im Fenster 28.10.2026 bis
   27.10.2027 tragen 6 Events „Feuerwehrfest“, 34 „Schützenfest“, 101 „Kirchweih“ im
   Titel (von 34.725). Von 20 Beispielgemeinden dieses Berichts haben 5 dort
   mindestens einen Termin. Die Gemeinde-Quellen sind also echte Ergänzung, keine
   Doppelung.
6. **Lizenz ist überall der Engpass.** Keiner der starken Kandidaten hat eine offene
   Datenlizenz. Einzige offen lizenzierte Festdaten in dieser Recherche: Rhein-Kreis
   Neuss/Grevenbroich (CC0, Volks- und Heimatfeste mit Koordinaten).

## Übersicht

Bewertung „Generic“: hoch = eine Integration liefert viele Gemeinden in festen Feldern;
mittel = einheitlich, aber Lücken (nur HTML, wenige Gemeinden, gekürzt); niedrig =
kein strukturierter Zugang oder kaum Gemeinden.

| Anbieter | Klasse | Betreiber | Gemeinden (Beleg) | Länder (belegt) | Zugriff | Lizenz/AGB | Generic |
|---|---|---|---|---|---|---|---|
| Heimat-Info | App/Plattform | Cosmema WITTICH GmbH | 648 Kommunen (selbst gezählt, API) | v. a. BY, dazu HE, NRW, einzelne | offene JSON-API | keine Regel für Dritte | hoch |
| Cross7 | Kommunal-CMS | cm city media GmbH (SV Gruppe) | „Über 450 Kunden“ (Eigenangabe) | BY, HE, BW | öffentliche JSON-API | nicht belegt | hoch |
| NOLIS CMS | Kommunal-CMS | NOLIS GmbH | „über 450 Kommunen“, alle Produkte (Eigenangabe) | NI | iCal je Kommune | nicht belegt | hoch |
| meinOrt | Verlag/App | LW Medien GmbH (WITTICH) | 2.197 Orte (selbst gezählt), „Über 2.500“ (Eigenangabe) | RP u. a. | keiner offen (robots) | nicht ausgewertet | hoch mit Vertrag, sonst keiner |
| NUSSBAUM | Verlag | NUSSBAUM Medien St. Leon-Rot | „>380 Städte und Gemeinden“ (Eigenangabe) | BW | Tages-Sitemaps + JSON-LD | keine; KI-Crawler gesperrt | hoch technisch, Lizenz offen |
| Advantic iKISS | Kommunal-CMS | Advantic GmbH | 299 Gebietskörperschaften (selbst gezählt, Referenzkarte) | BY, NI, SH, MV, RP, ST, BB, HE, NW, SL, BW | einheitliches HTML | nicht belegt | mittel bis hoch |
| termine-regional.de | Aggregator | NetzWerkstatt GmbH & Co. KG | nicht belegt | bundesweit (Eigenangabe) | Export/API gegen Entgelt | Vertrag | prüfen |
| Komm.ONE Online-Suite | Kommunal-CMS | Komm.ONE | nicht belegt (12 Referenzen < 10.000 EW) | BW | RSS mit hCalendar | nicht belegt | mittel |
| StadtLandNews | Dorfplattform | Smartes Land GmbH | 64 kommende Events NI | NI | The Events Calendar REST | nicht belegt | mittel |
| regioactive.de | Aggregator | Leitmotiv Online Medien | nicht belegt | bundesweit | JSON-LD je Seite | nur mit Genehmigung | mittel |
| Standard-Plugins | CMS-Erweiterung | diverse | 12 von 181 Startseiten | RP, HE u. a. | REST, iCal, RSS | Gemeinde-Websites | mittel (billig) |
| net-com active-City | Kommunal-CMS | net-Com | „Über 200 Verwaltungen“ (Eigenangabe) | NW | nur HTML | nicht belegt | niedrig bis mittel |
| Crossiety | Dorfplattform | Crossiety AG, Zürich | „170+“ in CH/DE/LI (Eigenangabe) | HE, NW | HTML, nur Teil öffentlich | keine Regel für Dritte | niedrig bis mittel |
| ClubDesk | Vereinssoftware | ClubDesk (CH) | „20.000 Vereine“ (Eigenangabe) | nicht belegt | iCal je Verein | nicht belegt | mittel, keine zentrale Liste |
| DorfPages | Dorfplattform | Smartes Land GmbH | 49 Domains (selbst gezählt) | NW, RP | WP-REST ohne Termindatum | nicht belegt | niedrig |
| Smart Village App | App | Smart Village Solutions SVS GmbH | „37 … gelauncht“ (Eigenangabe) | BB | GraphQL nur mit OAuth | Code GPL-3.0, Inhalte nicht belegt | niedrig |
| myheimat (PEIQ) | Leserreporter | Marketing- & Sales-Service Augsburg | nicht belegt | DE | JSON-LD | AGB verbieten Crawler und Datenbanken | niedrig |
| Primo-Verlag | Verlag | Primo-Verlag Anton Stähle | 65 Blätter (selbst gezählt) | BW | nur E-Paper | entfällt | niedrig |
| Riedel-Verlag | Verlag | RIEDEL GmbH & Co. KG | 127 Titel in 120 Orten (selbst gezählt) | SN, TH, ST | nur PDF per Mail-Link | entfällt | niedrig |
| LFV Bayern Website-Kit | Feuerwehr | Landesfeuerwehrverband Bayern | nicht belegt | BY | HTML, Kalender leer | entfällt | niedrig |
| festivalsindeutschland.de | Festverzeichnis | Christophe Contard EI | 18.523 Seiten (selbst gezählt) | DE | JSON-LD | AGB untersagen Nutzung der Datenbank | nur Lückenliste |
| ekom21, AKDB, KDO, regio iT, GSB, Sitepark, SixCMS | Kommunal-IT | diverse | nicht belegt | | kein Veranstaltungsmodul mit Export belegt | | niedrig |

## A. Gemeinde-Apps und Dorfplattformen

### A1. Heimat-Info

* **Betreiber:** Cosmema WITTICH GmbH, Gaimersheim (§ 1 der Nutzungsbedingungen,
  https://www.heimat-info.de/nutzungsbedingungen). wittich.de nennt Cosmema WITTICH
  den digitalen Partner der Kommunen in der WITTICH-Gruppe.
* **Gemeinden:** `GET https://heimatinfo-api-platform.azurewebsites.net/communes/search`
  lieferte 648 Einträge (alle `status: Published`), davon 97 mit `parentCommuneId`
  (Untereinheiten). Nach erster PLZ-Ziffer: 8 → 237, 9 → 368, 5 → 21, 6 → 9, Rest
  einzeln. 105 Kommunen führen den Kalender extern (`externalEventsCalendarUrl`, meist
  `modbox.cosmema.de`), dort liefert die API keine Termine.
* **Zugriff:** offene REST-API, `apiBase` steht öffentlich in
  `window.__NUXT__.config.public.apiBase`. Termine je Kommune:
  `GET {apiBase}communes/{communeId}/events` mit Headern `accept: application/json`,
  `callertype: web`. Zusätzlich je Gemeinde ein Einbettungs-Widget
  `https://www.heimat-info.de/embeddings/events/v1/?c=<UUID>`, dessen Server-HTML
  `__NUXT_DATA__` mit Terminen und den Vereinen als Veranstalter trägt. iCal/RSS:
  nicht gefunden.
* **Felder (Probe Leinach, 29 Termine, selbst nachgeprüft):** `id`, `organizationId`,
  `title`, `content` (HTML), `contentPreview`, `createdOn`, `status`, `type`,
  `startDate`, `endDate` (UTC), `location` (Freitext), `externalId`, `visibleUntil`,
  `scheduledPublishDate`, `attachments[]`. Kommune: `id`, `name`, `slug`,
  `postalcodes`, `longitude`, `latitude`, `parentCommuneId`, `calendarIntegration`.
  Keine Koordinaten am Termin. Vereine im Widget mit `name`, `street`, `postalcode`,
  `city`, `websiteUrl`.
* **Lizenz/robots:** Nutzungsbedingungen regeln nur die Rechte der Einstellenden
  gegenüber dem Anbieter (§ 3 Abs. 5), nicht die Weiterverwendung durch Dritte.
  robots.txt erlaubt `/`, sperrt `/verwaltung`, `/onboarding`, `/meine-gemeinden`,
  `/app-init`, `/maintenance`; der API-Host hat keine robots.txt (404).
* **Gemeinde-Beispiele:** Leinach (BY)
  https://heimatinfo-api-platform.azurewebsites.net/communes/692a3da4-2425-476e-957b-cc2aa5e0269f/events ;
  Dietzhölztal (HE)
  https://heimatinfo-api-platform.azurewebsites.net/communes/cdc17ac6-17ca-4a74-b2f0-54899b41018d/events ;
  Buxheim (BY) Widget https://www.heimat-info.de/embeddings/events/v1/?c=9c8075fe-092f-444c-8b3a-5830d27c3eb4 ;
  Dormitz (BY) spiegelt die Termine als WordPress-Typ `events_heimatinfo`.
* **Dorffest-Test:** „Leinacher Waldweihnacht“ 05.12.2026
  https://www.heimat-info.de/veranstaltungen/008ac421-3c1c-407a-955d-20882f7f285a ;
  in Leinach außerdem „Fahrzeugsegnung“ der Feuerwehr, „Siedlerfest“, Königsfeier der
  SG Diana; in Dormitz „Halloween bei der Feuerwehr Dormitz“.
* **Nächster Schritt:** Datennutzung bei Cosmema WITTICH anfragen (zusammen mit
  meinOrt, siehe B1). Technisch reicht ein Lauf `communes/search` plus je Kommune
  `events`; Rate-Limit nicht belegt. Klären, was `modbox.cosmema.de` ist.

### A2. Digitale Dörfer, heute Smartes Land (StadtLandNews, DorfPages, StadtLand.Funk)

* **Betreiber:** „Die Lösungen der Digitalen Dörfer werden ab sofort durch die
  Smartes Land GmbH bereitgestellt“ (digitale-doerfer.de); die App DorfFunk heißt
  inzwischen StadtLand.Funk (https://smartesland.de/).
* **Gemeinden:** 196 Portfolio-Einträge (selbst gezählt aus
  `/wp-json/wp/v2/portfolio_category`, Seite zuletzt 2024 geändert): BY 92, NW 51,
  RP 20, HE 7, MV 7, SL 6, SH 4, NI 3, BW 2, SN 2, TH 1.
* **StadtLandNews:** WordPress mit The Events Calendar, `GET
  https://niedersachsen.stadtlandnews.com/wp-json/tribe/events/v1/events` lieferte
  `total: 64` kommende Termine, viele davon Ortsratssitzungen. Felder wie
  in D1. Dorffest-Test: „Spuk im Gerätehaus … Schandelah Feuerwehrgerätehaus“
  https://niedersachsen.stadtlandnews.com/event/spuk-im-geraetehaus-am-31-oktober-an-17-uhr-in-schandelah-feuerwehrgeraetehaus/ ,
  „Laternenumzug Kleinburgwedel“.
* **DorfPages:** 49 eigene WordPress-Domains (z. B. godelheim.de, leiwen.de,
  mertesdorf.de), Plugin `lsvr-events`; `/wp-json/wp/v2/lsvr_event` liefert das
  Veranstaltungsdatum nicht (nur Veröffentlichungsdatum). Dorffest-Test:
  „Schützenfest“ https://godelheim.de/veranstaltungen/schuetzenfest/ .
* **StadtLand.Funk (App):** keine öffentliche Ansicht, keine API-Doku gefunden.
* **Lizenz:** Registrierungs- und Nutzungsbedingungen verlinkt, nicht ausgewertet;
  offene Inhaltslizenz nicht belegt. robots.txt jeweils WordPress-Standard.
* **Gemeinde-Beispiele:** Godelheim (NW, Ortsteil Höxter), Langelsheim (NI)
  https://niedersachsen.stadtlandnews.com/event/der-ortsrat-hahausen-tagt-5/ ,
  Hagen im Bremischen (NI)
  https://niedersachsen.stadtlandnews.com/event/einwohnerversammlung-albstedt/ .
* **Nächster Schritt:** Über den Plugin-Detektor (D1) automatisch mitnehmen; bei
  Smartes Land nach einer Partnerschnittstelle für StadtLand.Funk fragen.

### A3. Crossiety

* **Betreiber:** Crossiety AG, Zürich. Eigenangabe „170+“ Digitale Dorfplätze in
  CH, DE und LI (https://www.crossiety.ch/); deutscher Anteil nicht belegt.
* **Zugriff:** einheitliches HTML `https://crossiety.app/dorfplatz/{slug}/agenda`,
  Karten `<xs-card-v2>` mit Attributen `data-id`, `startDate`, `endDate`, `allDay`,
  `url` (`/event_cards/{id}`), `image`. Nur ein Teil ist öffentlich („Mehr Beiträge
  sind für Crossiety-Mitglieder sichtbar“), die Liste nennt keinen Ort, aber Vorname
  und Initial der Ersteller. Crossiety importiert selbst aus Eventfrog und Guidle.
* **Lizenz/robots:** Nutzungsbedingungen regeln Dritte nicht; robots.txt sperrt nur
  `/admin`.
* **Gemeinde-Beispiele:** Diemelstadt (HE), Borchen (NW), Vöhl (HE), je
  `https://crossiety.app/dorfplatz/<slug>/agenda`.
* **Dorffest-Test:** nicht bestanden (nächstliegend „Aseler Geschenketruhe“, Vöhl).
* **Nächster Schritt:** keiner vor den Kandidaten mit höherer Bewertung.

### A4. Smart Village App

* **Betreiber:** Smart Village Solutions SVS GmbH. Eigenangabe „37 Städte, Gemeinden
  und Landkreise haben ihre Apps schon gelauncht“ (https://smart-village.app/),
  Referenzliste überwiegend Brandenburg.
* **Zugriff:** je Instanz eigener GraphQL-Server, Code offen (GPL-3.0,
  https://github.com/smart-village-solutions/smart-village-app-mainserver), aber
  `before_action :doorkeeper_authorize!` verlangt ein OAuth-Token. Felder laut Schema
  `event_record_type.rb`: `title`, `dates`, `addresses`, `location`, `organizer`,
  `price_informations`, `categories`, `recurring`, `data_provider`.
* **Gemeinde-Beispiele:** Falkenberg (Elster), Michendorf, Amt Neuzelle (alle BB,
  nur App-Store-Einträge, keine Web-Ansicht).
* **Dorffest-Test:** nicht möglich. **Nächster Schritt:** keiner; die Instanzen
  importieren laut Repos aus Upstream-Quellen wie der TMB-Datenbank.

### A5. Weitere Apps (nur Suchtreffer, nicht geprüft)

OrtsApp (apicodo), inixmedia, meinegemeinde.digital, net-com KommunalApp/KreisApp,
Gemeinde24: Kommunenzahl jeweils nicht belegt. „Hallo Gemeinde“, „Dorf.App“, „LOLA“,
„Nolis Bürger-App“: keine belastbaren Treffer.

## B. Amtsblatt- und Mitteilungsblatt-Verlage

### B1. LINUS WITTICH Medien mit meinOrt

* **Betreiber:** LINUS WITTICH Medien KG (Amtsblätter); meinOrt unter „©LW Medien
  GmbH“. Eigenangaben: meinort.de „Über 2.500 Orte sind bereits mit dabei“;
  wittich.de „Bereits mehr als 1.000 Kommunen vertrauen auf Lösungen wie kommunale
  Homepages, Bürger-Apps …“ (Cosmema WITTICH). Selbst gezählt: 2.197 Ortslinks auf
  https://meinort.de/orte-list .
* **Länder:** Standorte RP, SL, BY/Odenwald, Nord-, Ost- und Mittelhessen,
  BB/SN/ST, TH, Chiemgau, MV/SH, NI (wittich.de). Ortsnamen der Liste überwiegend RP.
* **Zugriff:** kein öffentlicher Feed. Ortsseiten leiten auf `/welcome?ort=…`, die
  robots.txt sperrt `Disallow: /*?*`; Termine lädt die Web-App sessionabhängig über
  `/get_next_events`. Redaktionssystem `cmsweb.wittich.de` mit `Disallow: /` und
  ausdrücklicher Sperre für ClaudeBot, GPTBot u. a. Amtsblätter nur als PDF
  (`epaper.wittich.de/frontend/catalogs/{id}/{n}/pdf/complete.pdf`).
* **Felder:** nicht belegt (kein erlaubter Abruf).
* **Lizenz:** AGB auf wittich.de regeln nur Anzeigen und Druck; meinort.de/agb lädt
  den Text clientseitig, nicht ausgewertet.
* **Gemeinde-Beispiele:** https://meinort.de/561-Leiwen , https://meinort.de/1000-Saffig ,
  https://meinort.de/10-Kobern-Gondorf ; VG Altenahr (RP) Amtsblatt Nr. 31/2026
  https://epaper.wittich.de/frontend/catalogs/548559/2/pdf/complete.pdf .
* **Dorffest-Test:** im Amtsblatt Altenahr „Bartholomäuskirmes in Liers“
  (24.08.2026) und „Feuerwehrfest Lantershofen 1./2.8.2026“, nur als PDF-Text.
* **Nächster Schritt:** Ein Gespräch mit WITTICH für meinOrt, Heimat-Info und die
  townhall-Seiten zusammen: gibt es einen Partner-Export (JSON/iCal) aus cmsweb, und
  unter welcher Lizenz. Keine technische Umgehung der Sperren.

### B2. NUSSBAUM Medien (nussbaum.de, früher lokalmatador.de)

* **Betreiber:** NUSSBAUM Medien St. Leon-Rot GmbH & Co. KG
  (https://www.nussbaum.de/impressum); lokalmatador.de leitet auf nussbaum.de um.
  Eigenangabe „>380 Städte und Gemeinden sind in unserem Verbreitungsgebiet“
  (https://www.nussbaum-medien.de/unternehmen/ueber-uns), nur BW. Wie viele davon
  Termine online stellen: nicht belegt.
* **Zugriff:** Sitemap-Index https://services.www.nussbaum.de/sitemap.xml mit
  Tages-Sitemaps `sitemap_event_JJJJ-MM-TT.xml` (26.10.2026: 43 Event-URLs mit
  `lastmod`); Detailseiten `https://www.nussbaum.de/entdecken/events/{slug}-{id}`
  serverseitig mit JSON-LD. Listen laufen über `/api/`, gesperrt.
* **Felder (Probe):** JSON-LD `name`, `startDate`, `endDate`, `location.address`
  (`streetAddress`, `postalCode`, `addressLocality`), `isAccessibleForFree`;
  Next-Payload `timeslots` (`day`, `startTime`, `endTime`), `coordinates` (`lat`,
  `lon`), `taxonomies`, `source`, `sourceId`. Im JSON-LD steht beim `startDate` ein
  `Z`, gemeint ist Ortszeit, und nur der erste Termin; für einen Import `timeslots`.
* **Lizenz/robots:** keine Nutzungsbedingungen gefunden. robots.txt (selbst
  nachgeprüft): `Crawl-delay: 10`, `Disallow: /api/` u. a.; ClaudeBot, GPTBot,
  anthropic-ai, CCBot, Google-Extended u. a. `Disallow: /` mit der Begründung
  Serverlast.
* **Gemeinde-Beispiele (BW):** Profile Dürnau
  https://www.nussbaum.de/entdecken/profile/gemeinde-duernau-206604 , Freudental
  https://www.nussbaum.de/entdecken/profile/gemeinde-freudental-123270 , Drackenstein
  https://www.nussbaum.de/entdecken/profile/gemeinde-drackenstein-14835 .
* **Dorffest-Test:** „Kunsthandwerklicher Weihnachtsmarkt in Erbstetten“
  (Burgstetten), 14./15.11.2026
  https://www.nussbaum.de/entdecken/events/kunsthandwerklicher-weihnachtsmarkt-in-erbstetten-50379 .
* **Nächster Schritt:** Lizenz oder Partner-Feed bei NUSSBAUM anfragen. Ohne Zusage
  nichts abrufen (ausdrücklicher Wille des Betreibers gegen automatisierte Abrufe
  außerhalb von Suchmaschinen).

### B3. Primo-Verlag und Riedel-Verlag

* **Primo-Verlag Anton Stähle (Stockach, BW):** 65 Einträge in der Abo-Auswahl
  https://mitteilungsblatt.primo-stockach.de/leser/ (selbst gezählt, Ortsteile
  einzeln). Nur E-Paper in der App „my eBlättle“, kein Online-Kalender. Beispiele:
  Krauchenwies, Böttingen, Mahlstetten, Wutach.
* **RIEDEL GmbH & Co. KG (SN, TH, ST):** 127 Titel in 120 Orten auf
  https://www.riedel-verlag.de/de/aktuelle-ausgaben (selbst gezählt), Ausgaben nur
  per Mail-Link. Beispiele: Altmittweida, Belgershain, Gersdorf.
* **Dorffest-Test:** in beiden nicht möglich. **Nächster Schritt:** keiner
  technisch. Die Riedel-Liste ist eine Liste kleiner Gemeinden mit eigenem Blatt
  für die Stichproben in Sachsen und Thüringen.

### B4. Sonstige Verlagsportale

* **myheimat.de (PEIQ):** Event-URLs wie meinbezirk.at
  (`/event/{ort}/c-{kat}/{slug}_e{id}`, JSON-LD). AGB https://www.myheimat.de/s/agb
  untersagen Robots/Crawler und das Einlesen in Datenbanken. Entfällt.
* **wochenblatt-reporter.de:** kein Event-Modul (`/event` 404).
* **lokalkompass.de:** leitet auf wvw-anzeigenblaetter.de, kein Event-Portal mehr,
  nicht WITTICH.

## C. Kommunale CMS-Hersteller und IT-Dienstleister

### C1. cm city media Cross7

* **Betreiber:** cm city media GmbH, Ulm (https://www.cmcitymedia.de/module);
  Übernahme durch den Schwäbischen Verlag (SV Gruppe) laut
  https://www.advant-beiten.com/aktuelles/advant-beiten-beraet-schwaebischen-verlag-bei-der-uebernahme-der-cm-city-media-gmbh .
  Eigenangabe „Über 450 Kunden“ (https://www.cmcitymedia.de/); keine Kundenliste.
* **Zugriff:** Die Gemeindeseiten laden Termine im Browser aus einer zentralen,
  schlüsselfreien API:
  `https://api.cross-7.de/public/calendar/{ID}/events?pageNumber=1&pageSize=20&from=<ISO>&sortType=time&sortDirection=ascending`,
  `{ID}` = `data-c7-page` im Script-Tag `components.cross-7.de/v2/components.esm.js`
  jeder Gemeindeseite. Paginierung `pageNumber`, `totalPages`, `totalCount`,
  `hasNextPage`.
* **Felder (Probe Meitingen, selbst nachgeprüft):** `items[]` mit `fromDate`,
  `fromTime`, `untilDate`, `untilTime`, `addresses[]` (`type`, `building`, `street`,
  `houseNumber`, `zipCode`, `city`), `name`, `teaserText`, `teaserPictureUrl`,
  `categoryNames[]`, `link` (`targetId`, `slug`), `created`. Keine Koordinaten.
* **Erkennung:** `data-c7-page`, `components.cross-7.de`, `<c7-calendar-default>`,
  Pfade `/fileadmin/Dateien/Cross7/`, Generator TYPO3.
* **Lizenz/robots:** API ohne robots.txt (404), Nutzungsbedingungen nicht belegt.
  Meitingen: „Die Einladungstexte werden von den jeweiligen Veranstaltern zur
  Verfügung gestellt“.
* **Gemeinde-Beispiele:** Markt Meitingen (BY, ID 784, 57 Termine)
  https://www.meitingen.de/freizeit-kultur/veranstaltungen/veranstaltungskalender ;
  Trendelburg (HE, ID 334)
  https://www.trendelburg.de/kultur-und-tourismus/veranstaltungskalender ;
  Obermarchtal (BW, ID 19) https://www.obermarchtal.de/kultur/veranstaltungen ;
  Amtzell (BW, ID 3956), Hüttlingen (BW, ID 2686).
* **Dorffest-Test:** „19. Reutlingendorfer Weihnachtsmarkt“ 29.11.2026, Obermarchtal
  (`?c7-item=948190`); „3. Weihnachtsmarkt des TSV Hassia 1904 Gottsbüren e.V.“ in
  der Schützenhalle Gottsbüren, Trendelburg. In Obermarchtal stehen auch
  Müllabfuhrtermine im Kalender: Kategoriefilter nötig.
* **Nächster Schritt:** API-Nutzung bei cm city media anfragen; Kundenseiten über
  das Merkmal `components.cross-7.de` in den Länder-Stichproben sammeln, IDs nicht
  durchzählen.

### C2. NOLIS CMS

* **Betreiber:** NOLIS GmbH, Nienburg/Weser. Eigenangabe „begleitet NOLIS über 450
  Kommunen deutschlandweit“ (https://www.nolis.de/, alle Produkte); Zahl der Websites
  mit Veranstaltungsmodul nicht belegt.
* **Zugriff:** iCal der ganzen Liste über den Link „vCalendar exportieren“:
  `/veranstaltungen/veranstaltungen.ical?…&selected_kommune=<ID>&…&beginn=JJJJMMTThhmmss&ende=…`.
  Nur mit vollständigem Parametersatz kommen alle Termine (gekürzt: 1 Termin).
  Selbst nachgeprüft: Bruchhausen-Vilsen 70 VEVENT im Fenster 27.10. bis 26.11.2026.
  Termin-IDs werden zwischen Samtgemeinden eines Landkreises geteilt, die Parameter
  `portal_all` und `verband` deuten auf kreisweite Abfragen (nicht getestet).
* **Felder (Probe, PRODID `-//NOLIS GmbH//NOLIS-Manager Kalender V3.5//DE`):**
  `DTSTART`, `DTEND`, `SUMMARY`, `DESCRIPTION`, `LOCATION`, `URL`, `CATEGORIES`,
  `GEO` (in der Probe teils `0;0`), `LAST-MODIFIED`, `X-ID`, `X-KOMMUNE`,
  `X-KOMMUNE-ID`, `X-ORT`, `X-ORT-ID`, `X-ORGANIZER`, `X-SCHLAGWORTE`,
  `X-KURZBESCHREIBUNG`, `X-SERIENCONTAINER`. Zeiten in UTC.
* **Erkennung:** `<meta name="author" content="NOLIS GmbH">`, URLs
  `/regional/veranstaltungen/<slug>-<terminID>-<kommuneID>.html`, Schriften von
  `fonts.nol-is.de`.
* **Lizenz/robots:** robots.txt (sg-mittelweser.de, bruchhausen-vilsen.de) lässt
  `/veranstaltungen/` und `/regional/` frei; Nutzungsbedingungen nicht geprüft.
* **Gemeinde-Beispiele (NI):** SG Mittelweser (21550)
  https://www.sg-mittelweser.de/regional/veranstaltungen/sucheplus.html ;
  SG Bruchhausen-Vilsen (21890)
  https://www.bruchhausen-vilsen.de/regional/veranstaltungen/rubrik/uebersicht-884-0.html?layout=2 ;
  SG Grafschaft Hoya (21520) https://www.grafschaft-hoya.de/ ; SG Steimbke (21580).
* **Dorffest-Test:** „Laternenfest“ von Förderverein und Jugendfeuerwehr Husum
  https://www.sg-mittelweser.de/regional/veranstaltungen/laternenfest-915147835-21550.html ;
  „Bosseltour mit Grünkohlessen Leese“, `X-ORGANIZER:Schützenverein Leese`.
* **Nächster Schritt:** kreisweite Abfrage testen (ein Feed je Landkreis);
  Kundenseiten über die Merkmale sammeln; Ort über `X-ORT` und Resolver, nicht `GEO`.

### C3. Advantic iKISS

* **Betreiber:** Advantic GmbH, Lübeck und Fürth. Referenzkarte
  https://www.advantic.de/Referenzen/Alle-Kundenwebsites/ (`window.ikiss_geodata`,
  862 Einträge mit `Name`, `linkurl`): davon 299 Hauptauftritte von
  Gebietskörperschaften (selbst gezählt: Stadt 119, Gemeinde 67, Landkreis 45, Amt
  21, Kreis 14, Samtgemeinde 10, Verbandsgemeinde 7 u. a.). Elf Länder in der Liste.
* **Zugriff:** einheitliches HTML-Modul `ModID=11`; Detail
  `/index.php?object=tx,<Mandant>.<Seite>.1&ModID=11&FID=<Mandant>.<TerminID>.1`.
  Kein Listen-Feed. iCal je Termin unter `/output/…call=ical`, aber `/output/` ist in
  robots.txt gesperrt (nicht abgerufen). Advantic nennt eine API „je nach
  Rechtevergabe“ und eine bidirektionale Schnittstelle zu termine-regional.de
  (https://www.advantic.de/CMS-iKISS/Schnittstellen/).
* **Felder (HTML, Probe Pfatter):** `ul.result-list.veranstaltungen`,
  `div.result-list_object[data-ikiss-mfid]`, `h3.result-list_object-title`,
  `span.result-list_object-topic` (Kategorie und Ort), `<time datetime="…">`,
  Detailzeilen „Datum:“, „Uhrzeit:“, „Veranstaltungsort:“. Kein JSON-LD.
* **Erkennung:** `<meta name="designer" content="Advantic GmbH">`,
  `/output/js/ikiss/basic.min.js`, `data-ikiss-mfid`, Parameter `ModID=`, `FID=`.
  Zeichensatz teils ISO-8859-15.
* **Gemeinde-Beispiele:** Pfatter (BY)
  https://www.pfatter.de/Freizeit-und-Kultur/Veranstaltungskalender/ ; Walsdorf (BY)
  https://walsdorf.de/Freizeit-Tourismus/Veranstaltungen/ ; Uelvesbüll (SH)
  https://www.uelvesbuell.de/Uelvesb%C3%BCll/Veranstaltungen/ .
* **Dorffest-Test:** „SG Hubertus, Hubertusfeier 135 Jahre SG Pfatter“, Kategorie
  „Fest“
  https://www.pfatter.de/index.php?object=tx,4257.394.1&ModID=11&FID=4257.5615.1 ;
  „Wintermarkt Dorfgemeinschaft Erlau“, Walsdorf; „FF Geisling, Aktivenessen und
  Jubilarfeier“.
* **Nächster Schritt:** Die Referenzkarte ist eine fertige Kandidatenliste. Bei
  Advantic nach einem freigegebenen JSON-Export fragen; parallel prüfen, ob
  termine-regional.de die iKISS-Termine gebündelt liefert (C6).

### C4. Komm.ONE Online-Suite (BW)

* **Betreiber:** Komm.ONE, Produkt „Online-Suite“ (https://www.online-suite.de/cms).
  ITEOS ging laut Ratsunterlagen 2018 in der Fusion auf, aus der Komm.ONE entstand;
  die Umbenennung selbst ist nicht belegt. Gesamtzahl der Kunden nicht belegt;
  Referenzseite nennt 12 „Kommunen bis 10.000 Einwohner“.
* **Zugriff:** RSS 2.0 mit hCalendar unter `/site/<Mandant>/zmrss/<nodeID>/rss.xml`,
  funktioniert auch unverlinkt. Gekürzt (Dauchingen 5 Items, HTML-Liste 12).
* **Felder:** `title` (Datum im Titel), `link`, `content:encoded` mit
  `div.zmItem.vevent`, `h3.summary`, `span.dtstart title="JJJJ-MM-TT"`, `span.uhr`,
  `div.zmOrt`; `<generator>dvv-Zusatzmodule</generator>`.
* **Erkennung:** `<meta name="generator" content="dvv-Mastertemplates …">`, Klassen
  `zm-eliste`, `zmitem`.
* **robots:** `Crawl-delay: 30` (biederbach.de), RSS-Pfad frei.
* **Gemeinde-Beispiele:** Biederbach
  https://www.biederbach.de/site/Biederbach/zmrss/825233/rss.xml ; Dauchingen
  https://www.dauchingen.de/site/Dauchingen-2022/zmrss/19702868/rss.xml ; Ihringen
  https://www.ihringen.de/start .
* **Dorffest-Test:** „Weihnachtsmarkt Fischerzunft in Oberwinden“ (Biederbach);
  „Weihnachtsmarkt“ von Gemeinde und Vereinen am Dorfplatz Dauchingen.
* **Nächster Schritt:** Item-Limit des RSS klären, sonst HTML-Liste; Kundenzahl bei
  Komm.ONE erfragen.

### C5. net-com active-City und weitere IT-Dienstleister

* **active-City (Modul SPECTACULUM):** Eigenangabe „Über 200 Verwaltungen im In- und
  Ausland“ (https://www.net-com.de/active-City-2.htm). Nur HTML, Klassen
  `spectaculum_teaser_object`, `event_date_from`, `event_place_ort`; Erkennung
  HTML-Kommentar „Generated with active-City“. Beispiel Westerkappeln (NW)
  https://www.gemeinde-westerkappeln.de/Fuer-Buerger/Kultur/Veranstaltungskalender.htm ;
  Hasbergen und Felsberg nur als Referenzlogo. Dorffest-Test nicht bestanden.
* **ekom21 cms21, AKDB komXcms, KDO-CMS, regio iT/nextgov iT, GSB, Sitepark, SixCMS:**
  kein Veranstaltungsmodul mit Export und keine Gemeinde-Probe belegt. Die AKDB-Zahl
  „mehr als 1.300 Kommunen“ betrifft das Bürgerservice-Portal, nicht Websites.
  Kommunix ist Fachsoftware für das Ausländerwesen, kein CMS.

### C6. termine-regional.de (Aggregator hinter iKISS)

* **Betreiber:** NetzWerkstatt GmbH & Co. KG, „EDITH-Terminkalender“
  (https://www.termine-regional.de/startseite). Bietet „Datenexport“ und
  „Bidirektionaler Datenaustausch per API“ nach Region und Inhalt, Preise auf Anfrage
  (https://www.termine-regional.de/kunden/homepage-integration). robots.txt sperrt nur
  `/typo3/`. Zahl der Gemeinden: nicht belegt; Nutzungsrechte-Seite nicht gelesen.
* **Nächster Schritt:** Angebot und Nutzungsrechte anfragen; vorher in den
  Länder-Stichproben zählen, wie viele Gemeinden dort vorkommen.

## D. Kalender-Erweiterungen in Open-Source-CMS

Befund aus 238 abgefragten Startseiten kleiner Gemeinden (181 mit 200): Die meisten
nutzen Hersteller-Baukästen (komuna/Cosmema „townhall“, DigiPublica/Neos,
cmcitymedia, ionas, auctores, dvv-Mastertemplates, SIQUANDO, Jimdo, Wix). 12 hatten
ein Standard-Plugin mit offenem Feed. Anteil: 12 / 181 = 6,6 %; die Auswahl der
Startseiten ist keine Zufallsstichprobe, der Wert gilt nur für diese Abfrage.

### D1. WordPress

| Erweiterung | Feed (Standardpfad) | Standard an | Erkennung im HTML | Gemeinde-Belege |
|---|---|---|---|---|
| The Events Calendar | REST `/wp-json/tribe/events/v1/events` (`per_page`, `start_date`; Antwort `events`, `total`, `next_rest_url`); iCal `<Kalender-Slug>/?ical=1` | an allen 4 geprüften Gemeinden ohne Zusatzkonfiguration 200; Abschaltbarkeit nicht belegt | `wp-content/plugins/the-events-calendar/`, `tribe-events-v2-…`, `<link rel="alternate" type="text/calendar" …?ical=1>` | Waldems https://gemeinde-waldems.de/events/ , Hainfeld https://www.hainfeld.de/termine/ , Plaidt https://plaidt.de/veranstaltungen/ , Irmtraut https://irmtraut.de/events/?ical=1 |
| Modern Events Calendar | RSS `/events/feed/` mit Namensraum `mec:` (`mec:startDate`, `mec:startHour`, `mec:endDate`, `mec:category`); REST `/wp-json/wp/v2/mec-events` ohne Termin | RSS ohne Konfiguration 200 | `plugins/modern-events-calendar-lite/`, `mec-frontend-style-css` | Ettringen https://ettringen.de/events/feed/ , Niederzissen https://niederzissen.de/veranstaltungstermine/ , Echternacherbrück (Merkmal) |
| Events Manager | iCal `/events.ics` laut Doku https://wp-events-plugin.com/docs-v1/event-ical-feeds/ | laut Doku immer | `plugins/events-manager/`, Klassen `em-` | an keiner Gemeinde belegt |
| EventON | kein Listen-Feed belegt | | `plugins/eventON/`, `evo_`, `evcal_` | Ürzig https://www.uerzig.de/veranstaltungen/ (AJAX) |
| All-in-One Event Calendar | nicht belegt | | `ai1ec` | nicht belegt |

Echte REST-Felder The Events Calendar (Waldems, Plaidt, Hainfeld): `id`, `title`,
`description`, `start_date`, `end_date`, `utc_start_date`, `timezone`, `all_day`,
`cost`, `categories`, `tags`, `venue` (`venue`, `address`, `city`, `zip`), `organizer`,
`image`, `url`, `modified`. iCal: `DTSTART;TZID=Europe/Berlin`, `SUMMARY`, `LOCATION`,
`CATEGORIES`.

Dorffest-Test: „Feuerwehrfest“ 11.07.2026, Venue Feuerwehr Plaidt (REST Plaidt);
„Handwerklicher Advents- und Weihnachtsmarkt in Hainfeld“ 21.11.2026; „Weihnachtsmarkt
der Vereine“ Ettringen (MEC).

Hersteller-Baukasten **townhall** (komuna/Cosmema, WordPress + JetEngine): offene
WP-REST mit Typ `events_heimatinfo` (Spiegel von Heimat-Info, Termin nur im
Fließtext). Erkennung `plugins/townhall`, `cosmema-captcha`. Gemeinden u. a. Dormitz,
Hetzles, Kleinsendelbach, Leinach. Heimat-Info direkt ist der bessere Weg (A1).

### D2. TYPO3

| Extension | Feed laut Doku | Standard an | Erkennung | Gemeinde-Belege |
|---|---|---|---|---|
| calendarize | Templates `Feed.ics`, `Feed.xml`, `Feed.atom` im Repo (https://github.com/lochmueller/calendarize) | nein, kein typeNum im Standard-TypoScript | `typo3conf/ext/calendarize`, Klassen `calendarize-item`, Parameter `tx_calendarize_calendar[…]` | Gönnheim https://www.goennheim.de/termine/aktuelle-veranstaltungen |
| sf_event_mgt | RSS über eigenen typeNum, Beispiel `?type=9918` (https://docs.typo3.org/p/derhansen/sf_event_mgt/8.3/en-us/ForAdministrators/RssFeed/Index.html) | nein | `tx_sfeventmgt_pievent[…]` | in der Abfrage nicht vorgekommen |
| news (auch eventnews) | iCal über typeNum, Beispiel `?type=9819` (https://docs.typo3.org/p/georgringer/news/12.0/en-us/Tutorials/BestPractice/ICalendar/Index.html) | nein | `tx_news_pi1[…]` | Ehrenberg (Rhön) https://www.ehrenberg-rhoen.de/ , Oberzissen https://www.oberzissen.de/termine |
| events2 | kein Feed; Detailseite mit JSON-LD `@type: Event` | | `tx_events2_events[…]` | Lindenfels https://www.lindenfels.de/kalender/ |
| cal | ICS-TypoScript mit „DEPRECATION WARNING“ | veraltet | | nicht gesehen |

Ab TYPO3 v12 liegen Assets unter `/_assets/<hash>/`, der Extension-Name fehlt dann;
Erkennung nur über Klassen und Parameternamen. Weil Feeds fehlen, ist bei TYPO3 die
HTML-Liste oder das JSON-LD der Detailseite der Weg. TYPO3-Kalenderkarten
(`.calendarize-item`) liest lasstreffen.at schon (`calendarize-card.ts`).
Dorffest-Test TYPO3: „Mörlenbacher Kerwe 2026“, Festzug 30.08.2026
https://www.moerlenbach.de/gemeinde-leben/freizeit-tourismus/events/kerwe (cmcitymedia,
Fließtext, 10.200 EW knapp über der Grenze).

### D3. Contao

* **Feed:** RSS 2.0/Atom nur, wenn im Backend unter Kalender angelegt; „The alias of a
  feed is used as the file name“
  (https://docs.contao.org/5.x/manual/en/core-extensions/calendar/calendar-management/).
  Der Pfad `share/<alias>.xml` steht dort nicht und ist damit nicht belegt. Kein iCal
  im Core.
* **Erkennung:** `<meta name="generator" content="Contao Open Source CMS">`, Module
  `mod_eventlist`, `mod_eventreader`, Klassen `event layout_upcoming`.
* **Gemeinde-Belege:** Neufraunhofen (BY)
  https://www.neufraunhofen.de/veranstaltungskalender.html (93 Termine), Modautal
  (HE) https://www.modautal.de/kalender , Deidesheim (RP)
  https://www.deidesheim.de/veranstaltungen.html ; an keiner ein Feed.
* **Dorffest-Test:** „Kirta-Essen / Helfer-Fest SVN“ 08.11.2026 und
  „Adventsmarkt Neufraunhofen“ 06.12.2026.

### D4. Joomla

| Erweiterung | Feed | Erkennung | Beleg |
|---|---|---|---|
| JEvents | RSS `index.php?option=com_jevents&task=modlatest.rss&format=feed&type=rss&Itemid=<n>&modid=0` (200); iCal-Export `task=icals.export&format=ical` antwortete 403 | `option=com_jevents`, `/eventdetail/<id>/` | Ahrbrück https://www.gemeinde-ahrbrueck.de/index.php/termine (nur Platzhalter) |
| iCagenda | RSS über Menüeintrag `?format=feed&type=rss` (200); kein Listen-iCal | `media/com_icagenda/`, `ic-next-date` | Rhens https://www.rhens.de/leben-in-rhens/veranstaltungen |
| DPCalendar | iCal `index.php?option=com_dpcalendar&task=ical.download&format=raw&id=<ID>` (https://joomla.digital-peak.com/documentation/dpcalendar/introduction/subscribe-to-calendars) | `com_dpcalendar` | an keiner Gemeinde belegt |

Allgemein `<meta name="generator" content="Joomla! - Open Source Content Management">`.
Dorffest-Test Joomla: nicht bestanden (Rhens: Wochenmarkt, Möhnensitzung).

### D5. Erkennungsregeln für die Länder-Stichproben

Je Gemeinde-Startseite einmal abrufen und in dieser Reihenfolge prüfen:

1. `components.cross-7.de` / `data-c7-page` → Cross7-API (C1)
2. `heimat-info.de/embeddings` oder `events_heimatinfo` → Heimat-Info (A1)
3. `NOLIS GmbH` / `fonts.nol-is.de` → NOLIS-iCal (C2)
4. `content="Advantic GmbH"` / `data-ikiss-mfid` → iKISS (C3)
5. `dvv-Mastertemplates` → Komm.ONE-RSS (C4)
6. `plugins/the-events-calendar` → Tribe-REST; `modern-events-calendar` → `/events/feed/`
7. `com_jevents`, `com_icagenda` → Joomla-RSS
8. `resc.deskline.net/DW5` → Feratel Deskline (in lasstreffen.at schon angebunden)
9. `Generated with active-City`, `calendarize`, `tx_news`, `events2`, Contao `mod_eventlist` → nur HTML
10. „Amtsblatt“, „Mitteilungsblatt“, `epaper.wittich.de`, `nussbaum.de`, `meinort` → Verlag (B)

## E. Landkreis- und Regionalkalender

| Kreis | Land | Software (belegt) | destination.one | Zugriff |
|---|---|---|---|---|
| Landkreis Cham https://www.landkreis-cham.de/aktuelles-nachrichten/veranstaltungskalender/ | BY | Seitentext: Daten „mittels der Tourismus-Plattform Destination.One“ | ja (Text) | JS-Widget |
| Landkreis München https://veranstaltungen.landkreis-muenchen.de/region/ | BY | TYPO3 + „Powered by RCE-Event.de“ | nein | Server-HTML |
| Kreis Bergstraße https://www.kreis-bergstrasse.de/aktuelles-veroeffentlichungen/veranstaltungsfinder/ | HE | ionas + RCE-Event | nein | JS-Liste |
| Landkreis Kusel https://www.landkreis-kusel.de/aktuelles/termine-und-veranstaltungen/ | RP | ionas, „Feratel TOSC5 Komponente“ | nein | Feratel-Widget |
| Landkreis Haßberge https://www.hassberge.de/veranstaltungskalender.html | BY | eigene Anwendung `events.hassberge.de` | nein | JS |
| Kreis Höxter https://www.kreis-hoexter.de/aktuelles/veranstaltungen | NW | regiogate | nein | Detail `?ev[id]=` |
| Rhein-Kreis Neuss https://opendata.rhein-kreis-neuss.de/ | NW | Opendatasoft, Datensatz „Grevenbroich: Volks- und Heimatfeste 2026“, CC0 (https://ckan.open.nrw/dataset/grevenbroich-volks-und-heimatfeste-2026-ne) | nein | JSON/CSV/GeoJSON |

Felder Grevenbroich: `monat`, `stadtteil`, `veranstaltung`, `datum`, `informationen`,
`kirmesplatz` (`lat`, `lon`), 22 Einträge. Dorffest-Test: „Kirmes“ Münchrath
08.05. bis 11.05.2026 mit Koordinate. Landkreis Roth veröffentlicht einen jährlichen
Kirchweihkalender als PDF. Kreiskalender sind in der Stichprobe fast alle JS-Widgets
ohne verlinkten Feed; RCE-Event (zweimal) ist ein weiterer Hersteller, dessen
Gemeindezahl nicht belegt ist. **Nächster Schritt:** In den Länder-Tickets je Kreis
Software notieren; RCE-Event als Kandidat führen, wenn er mehrfach auftaucht.

## F. Vereins-, Feuerwehr- und Festplattformen

* **LFV Bayern Website-Kit** (`*.feuerwehren.bayern`): 60 € einmalig plus 60 € im
  Jahr je Feuerwehr (https://feuerwehren.bayern/fragen-antworten/), Zahl nicht belegt.
  Beispiel https://chammuenster.feuerwehren.bayern/terminkalender/ ohne Einträge,
  kein Feed. Niedrig.
* **ClubDesk:** „so wie 20.000 Vereine auch“ (https://www.clubdesk.de/), Termine je
  Verein als iCal abonnierbar (https://www.clubdesk.de/de/vereinskalender), keine
  zentrale Liste. Nur wenn ein Verein gezielt fehlt.
* **Vereinsplaner** („15.000+ Vereine im DACH-Raum“), **VereinOnline**, **FWportal**:
  interne Terminverwaltung, kein öffentlicher Kalender belegt.
* **festivalsindeutschland.de:** 18.523 Festseiten in der Sitemap (selbst gezählt),
  davon im Slug 1.279 Kirchweih/Kerwe/Kirmes/Kirta/Kerb, 1.037 Schützenfest, 925
  Weihnachtsmarkt/Advent, 483 Weinfest, 324 Feuerwehr, 247 Dorffest, 75 Maifest. AGB
  (https://www.festivalsindeutschland.de/agb): jede unautorisierte Nutzung der
  Datenbank untersagt. Nur als Lückenliste: welches Dorf welches Fest hat, dann die
  Gemeinde- oder Vereinsquelle suchen. Beispiel
  https://www.festivalsindeutschland.de/festival/kirchweih-adelsdorf .
* **regioactive.de** (Leitmotiv Online Medien, Mannheim): bundesweite Eventdatenbank,
  JSON-LD (`name`, `startDate` mit Offset, `location.address`, `image`); AGB 2.3
  sieht Nutzung „auf regioactive.de und Seiten von Kooperationspartnern“ vor,
  Impressum verlangt schriftliche Genehmigung. Dorffest-Test: „3. Großdeubener
  Weihnachtsmarkt“ der Freiwilligen Feuerwehr, Böhlen
  https://www.regioactive.de/markt/3-grossdeubener-weihnachtsmarkt-boehlen-freiwillige-feuerwehr-grossdeuben-2026-12-05-v9w4X1PZwn .
  Beispiele Böhlen, Vreden, Rüdesheim (`/events/{ortId}/{slug}/…`).
* **Nordkurier** (MV): eigenes Erfassungswerkzeug für Vereine, Kalender-URL nicht
  belegt, KI-Crawler gesperrt.
* **Nicht nutzbar oder nicht erreichbar:** kirchweih.de (offline), kirmes.de,
  feuerwehr-homepage.de, vereinsseite.de (keine Verbindung), marktcom.de (nur
  Flohmärkte), weinfeste.de (leer), eventbaser.de, kulturkurier.de. Deutscher
  Schaustellerbund nennt „10.000 Volksfeste“ (https://www.dsbev.de/), ohne
  Verzeichnis. Schützenbund-Portale: nicht recherchiert.

## G. Abgleich destination.one

**Festarten im Titel**, `experience=open-data`, Fenster 28.10.2026 bis 27.10.2027,
`q=title:<Wort>` (ganzes Wort, Komposita wie „Herbstweinfest“ fehlen, also
Untergrenze). Freitext `q=<Wort>` ist unscharf (Kerwe frei 5.177, im Titel 10) und
wurde deshalb nicht verwendet.

| Titelwort | Events | Titelwort | Events |
|---|---|---|---|
| (alle) | 34.725 | Weihnachtsmarkt | 1.025 |
| Kirchweih | 101 | Weinfest | 37 |
| Kirmes | 32 | Schützenfest | 34 |
| Kerwe | 10 | Sommerfest | 21 |
| Kirta | 6 | Dorffest | 13 |
| Kärwa | 0 | Feuerwehrfest | 6 |
| Maifest | 3 | Straßenfest | 3 |

Einschränkung: Viele Dorffeste 2027 sind im Oktober 2026 noch nicht erfasst; ein
Fenster mit vergangenen Terminen taugt nicht, weil destination.one sie entfernt
(27.10.2025 bis 27.10.2026: nur 6.520 Events gesamt).

**Beispielgemeinden dieses Berichts**, `q=city:"<Gemeinde>"`, gleiches Fenster:

| Gemeinde | Quelle hier | destination.one | Gemeinde | Quelle hier | destination.one |
|---|---|---|---|---|---|
| Meitingen | Cross7 | 0 | Leinach | Heimat-Info | 0 |
| Trendelburg | Cross7 | 4 | Dietzhölztal | Heimat-Info | 0 |
| Obermarchtal | Cross7 | 0 | Plaidt | Tribe | 0 |
| Amtzell | Cross7 | 0 | Waldems | Tribe | 0 |
| Bruchhausen-Vilsen | NOLIS | 2 | Hainfeld | Tribe | 0 |
| Pfatter | iKISS | 52 | Ettringen | MEC | 5 |
| Walsdorf | iKISS | 0 | Neufraunhofen | Contao | 0 |
| Biederbach | Komm.ONE | 0 | Burgstetten | NUSSBAUM | 0 |
| Dauchingen | Komm.ONE | 0 | Böhlen | regioactive | 2 |
| Godelheim | DorfPages | 0 | Diemelstadt | Crossiety | 0 |

5 von 20 mit mindestens einem Treffer. Die Gemeinden sind nach Quellenfund gewählt,
nicht zufällig; repräsentativ wird der Wert erst in den Länder-Stichproben.
Pfatter zeigt dieselben Vereinstermine (z. B. „FF Griesau, Christbaumversteigerung“)
in beiden Quellen, dort greift der bestehende Dedup. Ortsfilter `city:` liefert
Treffer, `zip:` brach nach zwei Abrufen mit leerer Antwort ab und ist nicht belegt.

## H. Priorisierte Liste

Bewertet nach Datenqualität vor Menge, dann nach Gemeinden je Integration, dann
nach Rechtslage.

| # | Integration | Gemeinden (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | Heimat-Info JSON-API | 648 Kommunen | Titel, Start/Ende, Freitext-Ort, Vereine als Veranstalter, keine Koordinaten | keine Regel für Dritte | Anfrage Cosmema WITTICH (mit 2), danach Dry-Run |
| 2 | WITTICH meinOrt / cmsweb | 2.197 Orte | nicht belegt | gesperrt, nur Vertrag | gleiche Anfrage wie 1 |
| 3 | Cross7-API | „Über 450 Kunden“ | Datum, Uhrzeit, Adresse mit PLZ, Kategorie | nicht belegt | Anfrage cm city media; Kunden über Merkmal sammeln |
| 4 | NOLIS-iCal | „über 450 Kommunen“ (alle Produkte) | Kommune, Ort, Veranstalter, Schlagworte; GEO lückenhaft | nicht belegt | kreisweite Abfrage testen; Nutzungsbedingungen lesen |
| 5 | Plugin-Detektor (Tribe, MEC, Joomla-RSS) | 12 von 181 Startseiten | Tribe sehr gut (Venue, Zeitzone), MEC gut | Gemeinde-Websites, je Seite prüfen | Detektor-Regeln D5 in den Länder-Stichproben anwenden |
| 6 | NUSSBAUM | „>380“ BW-Gemeinden | Koordinaten, Zeitfenster, Kategorie | KI-Crawler gesperrt, keine Lizenz | Lizenz/Feed anfragen, sonst nichts |
| 7 | iKISS bzw. termine-regional.de | 299 Gebietskörperschaften | HTML einheitlich, iCal gesperrt | nicht belegt; termine-regional entgeltlich | Advantic nach Export fragen, termine-regional Angebot |
| 8 | Komm.ONE-RSS | nicht belegt (BW) | hCalendar, gekürzt | nicht belegt | Item-Limit klären |
| 9 | regioactive | nicht belegt | JSON-LD gut | Kooperation vorgesehen | Kooperationszugang anfragen, Überschneidung mit Eventfrog messen |
| 10 | Rhein-Kreis Neuss Open Data | Grevenbroich, Neuss | Festliste mit Koordinaten | CC0 | Mini-Import erst nach gemessener Lücke |
| | Nicht weiter verfolgen | | | | Primo, Riedel, myheimat, Smart Village App, LFV-Kit, Crossiety, festivalsindeutschland (nur Lückenliste) |

**Abdeckung**, nur als Anteil einer Abfrage: Plugin mit offenem Feed 12 / 181 = 6,6 %
der abgerufenen Startseiten. Für Heimat-Info, Cross7 und NOLIS liegt keine
Zufallsstichprobe vor; ihren Anteil messen die Länder-Tickets mit den Merkmalen aus D5.

## Was der User selbst tun muss

1. Cosmema WITTICH / LW Medien: Datennutzung Heimat-Info und meinOrt (ein Gespräch).
2. cm city media: Nutzung der öffentlichen Cross7-Kalender-API.
3. NOLIS: Nutzung der iCal-Exporte der Kundenseiten, Kundenliste.
4. NUSSBAUM Medien: Lizenz oder Partner-Feed.
5. Optional: Advantic (Export), NetzWerkstatt termine-regional.de (Angebot),
   Leitmotiv regioactive (Kooperation).

## Lücken und offene Punkte

* Kundenlisten von Cross7 und NOLIS sind nicht öffentlich; Zahlen nur Eigenangabe.
* Nutzungsbedingungen von Cross7, NOLIS, termine-regional.de, Smartes Land und
  meinOrt nicht gelesen bzw. nicht auffindbar.
* RCE-Event (Landkreise München, Bergstraße), ionas/Chamaeleon, komuna, DigiPublica,
  cEasy (hitcom) und „hw“-TYPO3 tauchten auf, Gemeindezahl und Export nicht geprüft.
* Schützenbund-Portale und Landesfeuerwehrverbände außerhalb Bayerns nicht recherchiert.
