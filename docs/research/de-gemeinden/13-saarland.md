# Saarland: Gemeindekalender und Dorffeste (Stand 2026-10-29)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.14`. Methode und Format: Epic-Spec
`fn-28-de-gemeindekalender-dorffeste-in-jeder`. Bundesweite Anbieter stehen in
[00-bundesweit.md](00-bundesweit.md), die Zuordnung jeder Gemeinde in
[01-vollerhebung.md](01-vollerhebung.md) und
[data/vollerhebung-2026-10.csv](data/vollerhebung-2026-10.csv). Hier wird beides nur
verlinkt und um die Landessicht ergänzt.

Arbeitsweise: nur lesende GET-Anfragen und Websuche, keine Konten, keine Formulare,
keine Mails, robots.txt vor jedem Abruf geprüft (für `*` und `ClaudeBot`). Jede Zahl
stammt aus einer eigenen Antwort vom 29.10.2026 oder aus einer verlinkten Seite.
„Eigenangabe“ heißt Aussage des Betreibers, „selbst gezählt“ heißt aus einer
abgerufenen Antwort gezählt, „nicht belegt“ heißt nicht geprüft oder nicht
auffindbar. Alle Anfragen: [13-saarland-anfragen.md](13-saarland-anfragen.md).

Das Saarland hat 52 Gemeinden und keine Gemeindeverbände (Destatis GV-ISys, Stichtag
30.09.2026, laut Ticket), zusammen 1.007.342 Einwohner, davon 13 Gemeinden unter
10.000 Einwohnern (Spalte `ew` der Vollerhebung, Destatis 31.12.2025). Weil es so
wenige sind, wurden **alle 52 Gemeinden** geprüft statt einer Stichprobe.

## Kurzfazit

1. **Die zentrale Quelle des Landes ist die Tourismusdatenbank mein.toubiz der
   Tourismus Zentrale Saarland (TZS).** Laut einer Präsentation der Landeshauptstadt
   ist sie „die zentrale touristische Datenbank des Saarlandes“ und wird „von allen
   saarländischen Landkreisen, einzelnen Kommunen sowie touristischen Leistungsträgern
   eigenständig gepflegt“. Alle 382 Saarland-Termine in destination.one `open-data`
   (Fenster 29.10.2026 bis 28.10.2027) tragen das Schlüsselwort
   `import_source_tta-toubiz` und eine offene Lizenz (CC-BY 271, CC-BY-SA 111). Darin
   stehen Dorf-Weihnachtsmärkte, „Berschweiler Kerb“ und „Feuerwehr Jahresabschluss“.
   destination.one zeigt aber nur einen Teil: Weiskirchen hat in seinem toubiz-Kalender
   29 kommende Termine, destination.one 5; das „Adventsfest Löschbezirk
   Rappweiler-Zwalbach“ fehlt dort.
2. **WITTICH ist im Saarland fast flächendeckend.** Die Zeitungs-Sitemap von wittich.de
   führt für 43 der 52 Gemeinden ein eigenes Amts- oder Mitteilungsblatt (selbst
   gezählt), Medienhaus Föhren „Rheinland-Pfalz + Saarland“. 29 Gemeinden haben einen
   meinOrt-Eintrag (Vollerhebung). Fünf Gemeinden (Riegelsberg, Nalbach, Bous, Freisen,
   Oberthal) haben weder einen lesbaren Gemeindekalender noch einen Treffer in
   destination.one oder einen toubiz-Kalender, wohl aber ein WITTICH-Blatt. Dorffest-Test
   bestanden im PDF der „Oberthaler Nachrichten“ 43/2026 („Lebendiger Adventsmarkt in
   Steinberg-Deckenhardt“). Nutzbar nur per Vereinbarung ([00-bundesweit.md B1](00-bundesweit.md)).
3. **Die Gemeinde-Websites sind zersplittert, mit einem Saarland-Generic:** Die
   Saarbrücker TYPO3-Agentur **one4vision** (Erweiterungen `*14v`, Domain 14v.de)
   betreut 14 der 52 Gemeinde-Websites, 7 davon mit dem Terminmodul `terminplaner14v`.
   Daneben je 3 ionas, 3 Advantic iKISS, 7 The Events Calendar (3 mit lesbarer REST und
   kommenden Terminen), 2 Umbraco-Kalender (robots.txt sperrt die API) und Einzelfälle.
4. **Offene Feeds mit kommenden Terminen gibt es bei 6 von 52 Gemeinden** (ionas
   Merchweiler, Ottweiler, Schwalbach; Tribe-REST Überherrn, St. Ingbert, Tholey),
   serverseitige HTML-Listen mit kommenden Terminen bei weiteren 25. Zusammen 31 von 52
   (59,6 %). 6 Gemeinden zeigen Termine nur über ein toubiz-Widget, 15 haben keinen
   lesbaren Gemeindekalender.
5. **Die Vollerhebung stimmt für das Land im Groben, im Einzelnen nicht.** Sie zählt 48
   von 52 als erreicht. Nachgeprüft: Großrosseln und Mettlach haben keine Tribe-REST
   (404), Bous liefert dort 0 kommende Termine, Nohfelden war nicht erreichbar,
   Losheim am See steht hinter einem Bot-Schutz mit Rechenaufgabe, Saarlouis und Homburg
   sperren ihre Kalender-API per robots.txt, Lebachs Kalender-URL ist ein Ticket-Shop.
6. **Bester Weg fürs Saarland:** zuerst mein.toubiz über die TZS (Lizenz liegt in den
   Daten schon als CC-BY/CC-BY-SA vor, aber nur die exportierte Teilmenge), dann die
   ohnehin geplanten Hersteller-Adapter (ionas, Tribe, iKISS) plus ein Adapter für
   one4vision, dann WITTICH für die Lücke. Mit TZS und WITTICH zusammen wären
   rechnerisch alle 52 Gemeinden abgedeckt; ob jedes Dorffest dort steht, ist offen.

## Vollerhebung der 52 Gemeinden

**Spalten:** Plattform mit Erkennungsmerkmal. Befund = was am 29.10.2026 in der Quelle
stand (kommend = Termine ab 29.10.2026, wo gezählt). d.one = Treffer in destination.one
`open-data`, Saarland, Fenster 29.10.2026 bis 28.10.2027, Feld `city` (Abschnitt
„Abgleich destination.one“). WITTICH = Nummer des Titels auf wittich.de
(`/produkte/zeitungen/<Nr>-<Name>`). VH = Zuordnung der Vollerhebung (Stufe,
Integration); ein Pfeil zeigt die Korrektur aus dieser Prüfung. Einwohner aus der
Vollerhebung.

| Gemeinde | AGS | EW | Plattform | Link | Befund 29.10.2026 | d.one | WITTICH | VH |
|---|---|---|---|---|---|---|---|---|
| Saarbrücken | 10041100 | 182.859 | eigener Stadtkalender | https://www.saarbruecken.de/leben_in_saarbruecken/veranstaltungskalender | Liste 180 Tage, Kategorien „Kirmes“, „Weihnachtsmarkt“ | 88 | nein | E |
| Friedrichsthal | 10041511 | 10.090 | TYPO3, one4vision | https://www.friedrichsthal.de/aktuelles-termine/veranstaltungen | 4 Termine in der Seitenliste, z. B. „Halloween for Kids bei den Pfadfindern“ | 1 | nein | E |
| Großrosseln | 10041512 | 7.844 | WordPress, The Events Calendar | https://www.grossrosseln.de/freizeit/veranstaltungen/ | HTML „5 Veranstaltungen gefunden“; REST 404 (`rest_no_route`) | 2 | nein | A tribe → B Tribe-HTML |
| Heusweiler | 10041513 | 18.385 | TYPO3, tx_news | https://www.heusweiler.de/kultur-freizeit/veranstaltungen/ | 6 Kulturtermine der Gemeinde (Rathauskonzerte u. a.) | 1 | 128 | B |
| Kleinblittersdorf | 10041514 | 10.734 | TYPO3, one4vision, toubiz-Widget | https://www.kleinblittersdorf.de/nachrichten-aktuelles/veranstaltungen-termine | Termine nur per Widget (eigener toubiz-Token) | 0 | nein | C |
| Püttlingen | 10041515 | 18.314 | TYPO3, one4vision (`addressaddon14v`) | https://www.puettlingen.de/rathaus-service/aktuell/veranstaltungen | Vereinsliste bis Juli 2027, „Weihnachtsmarkt der Chorgemeinschaft Fidelio“ | 1 | 160 | E |
| Quierschied | 10041516 | 12.757 | TYPO3, one4vision; ticket-regional | https://www.quierschied.de/freizeit-kultur-tourismus/kultur-veranstaltungen/qltur-programm | nur Programm des Kulturhauses Q.lisse (Ticketverkauf) | 1 | 787 | E → kein Gemeindekalender |
| Riegelsberg | 10041517 | 14.255 | TYPO3 | https://www.riegelsberg.eu/freizeit-kultur/konzerte-events | Textseiten, keine Terminliste | 0 | 162 | E → kein Kalender |
| Sulzbach/Saar | 10041518 | 16.191 | Advantic iKISS | https://www.stadt-sulzbach.de/Veranstaltungen/Veranstaltungskalender/ | 7 Termine; iCal-Export unter `/output/` per robots.txt gesperrt | 2 | 196 | B |
| Völklingen | 10041519 | 40.565 | TYPO3, one4vision (`addressaddon14v`), tx_news | https://www.voelklingen.de/kultur-sport-freizeit/veranstaltungskalender | Stadttermine, „Völklinger Mondscheinmarkt“ 06.11.2026 | 6 | nein | B |
| Beckingen | 10042111 | 15.406 | WordPress, eigenes Theme | https://www.beckingen.de/tourismus-und-kultur/veranstaltungen/ | Jahreskalender aller Ortsteile auf einer Seite, 336 Einträge 2026/27 | 2 | 103 | E |
| Losheim am See | 10042112 | 16.415 | nicht belegt | https://www.losheim.de/veranstaltungen/ | Weiterleitung auf `/challenge`: „BUNKERWEB … PROOF-OF-WORK“, nicht gelesen | 18 | 141 | E → gesperrt |
| Merzig | 10042113 | 31.341 | WordPress, toubiz-Widget | https://www.merzig.de/veranstaltungskalender/ | Termine nur per Widget (eigener Token); Tourismusseite merzig-saarschleifenland.de ebenfalls toubiz | 1 | 147 | C |
| Mettlach | 10042114 | 12.478 | WordPress, toubiz-Widget (Startseiten-Slider mit TZS-Token) | https://www.mettlach.de/mettlach-erleben/veranstaltungen/ | Termine per toubiz-Widget; Tribe-Merkmal, aber REST 404 | 0 | 148 | A tribe → C toubiz |
| Perl | 10042115 | 9.405 | Contao | https://perl.saarland/veranstaltungen.html | Seite ohne Termine im HTML, „Veranstaltungsmelder“ | 13 | 158 | M |
| Wadern | 10042116 | 16.415 | TYPO3, one4vision (`terminplaner14v`) | https://www.wadern-saarschleifenland.de/ | Gemeindeseite verweist auf Tourismusseite mit toubiz und Feratel | 4 | 175 | R → C toubiz |
| Weiskirchen | 10042117 | 6.522 | TYPO3, one4vision `terminplaner14v` mit toubiz-Daten serverseitig | https://www.weiskirchen.de/tourismus-wirtschaft/freizeit/veranstaltungen | 29 kommende, „Adventsfest Löschbezirk Rappweiler-Zwalbach“ 12.12.2026 | 5 | 181 | C |
| Eppelborn | 10043111 | 16.611 | WordPress, eigene PHP-Liste `dienste.eppelborn.de` | https://dienste.eppelborn.de/Termine/Termin_liste.php | 39 Datumsangaben, „Mittelalterlicher Weihnachtsmarkt Dirmingen“ 28./29.11.2026 | 11 | 116 | E |
| Illingen | 10043112 | 15.932 | nicht belegt | https://www.illingen.de/ | kein Kalenderlink (wie Vollerhebung) | 1 | 129 | R |
| Merchweiler | 10043113 | 10.081 | ionas | https://www.merchweiler.de/unsere-gemeinde/veranstaltungskalender/ | `events.json` 167 Termine, 23 kommende; „Lichter Nikolausmarkt“ 28.11.2026 | 1 | 146 | A |
| Neunkirchen | 10043114 | 46.896 | nicht belegt | https://www.neunkirchen.de/ | kein Kalenderlink (wie Vollerhebung) | 13 | nein | R |
| Ottweiler | 10043115 | 14.177 | ionas | https://www.ottweiler.de/bildung-kultur/sonderveranstaltungen/ | `events.json` 14 Termine, 1 kommender („Adventsmarkt“ 27.11.2026) | 1 | 157 | A |
| Schiffweiler | 10043116 | 15.832 | TYPO3, one4vision `terminplaner14v` | https://www.schiffweiler.de/aktuelles-veranstaltungen/termine | Vereinstermine, „Gemeinsamer Weihnachtsmarkt“ 28./29.11.2026 | 5 | 167 | B |
| Spiesen-Elversberg | 10043117 | 13.078 | TYPO3, one4vision `terminplaner14v` | https://www.spiesen-elversberg.de/nachrichten-haupt/veranstaltungen/ | Vereinstermine mit Veranstalter und Ort, Eröffnung des Adventsmarktes 28.11.2026 | 2 | 195 | B |
| Dillingen/Saar | 10044111 | 21.295 | WordPress (Agentur-Theme `fbo-dillingen`) | https://www.dillingen-saar.de/freizeit-kultur/veranstaltungen/ | „30 Veranstaltungen gefunden“, JSON-LD vorhanden | 34 | 111 | E |
| Lebach | 10044112 | 19.269 | TYPO3, events2 | https://www.lebach.de/kultur-und-bildung/veranstaltungen | events2-Liste, Ortsauswahl mit allen Stadtteilen; Ticket-Shop nur für Saalveranstaltungen | 1 | 138 | B events2 (VH-Link war ticket-regional) |
| Nalbach | 10044113 | 9.106 | TYPO3 | https://www.nalbach.de/tourismus/veranstaltungen | keine Termine, Verweis auf die meinOrt-App | 0 | 149 | M |
| Rehlingen-Siersburg | 10044114 | 14.889 | TYPO3, events2 | https://www.rehlingen-siersburg.de/kultur-freizeit/veranstaltungen | events2, Termin auf der Startseite verlinkt (`/details/1794848400/…`) | 2 | 161 | B |
| Saarlouis | 10044115 | 37.675 | Umbraco, Kalender per `/umbraco/api/veranstaltungen/getall` | https://www.saarlouis.de/leben-in-saarlouis/veranstaltungen/ | Liste per API, robots.txt `Disallow: /umbraco/`, nicht gelesen | 34 | 901 | E → gesperrt |
| Saarwellingen | 10044116 | 13.590 | TYPO3, one4vision, tx_news | https://www.saarwellingen.de/kultur-und-tourismus/kultur/veranstaltungen/aktuelle-veranstaltungen | Liste mit Veranstalter und Ort; Seite „Kirmessen“: eine Kirmes je Ortsteil | 10 | 166 | E → B tx_news |
| Schmelz | 10044117 | 16.869 | TYPO3, tx_news | https://www.schmelz.de/freizeit-tourismus/veranstaltungskalender | „Kirmes Limbach“ 07. bis 10.11.2026, „Limbacher Kirmesmontag Frühschoppen“ | 2 | 168 | B |
| Schwalbach | 10044118 | 17.940 | ionas | https://www.schwalbach-saar.de/de/leben-in-schwalbach/veranstaltungen/ | `events.json` 71 Termine, 10 kommende; „Schwalbacher Adventszauber“ | 1 | 169 | A |
| Überherrn | 10044119 | 12.089 | WordPress, The Events Calendar | https://ueberherrn.de/events/ | REST `total: 24`, „Weihnachtsmarkt im historischen Ortskern von Berus“ | 1 | 174 | A |
| Wadgassen | 10044120 | 17.987 | hitcom, Widget `disgovery-list-widget` | https://www.wadgassen.de/veranstaltung | Liste nur per JS mit verschlüsseltem Parameter | 1 | 176 | R |
| Wallerfangen | 10044121 | 9.211 | TYPO3, tx_news | https://www.wallerfangen.de/gemeinde/veranstaltungen/ | 2 Einträge, „Anmeldung Nikolausmarkt Wallerfangen 05.-06.12.2026“ | 0 | 179 | B |
| Bous | 10044122 | 7.334 | WordPress, The Events Calendar | https://www.bous.de/veranstaltungen/ | REST `total: 0`, HTML „keine anstehenden Veranstaltungen“, 35 vergangene | 0 | 107 | A → leer |
| Ensdorf | 10044123 | 6.833 | Advantic iKISS | https://www.gemeinde-ensdorf.de/Freizeit-Tourismus/Veranstaltungen/ | 9 Termine, „Ensdorfer Weihnachtsmarkt“ 05./06.12.2026 | 1 | 115 | B |
| Bexbach | 10045111 | 17.730 | TYPO3, one4vision `terminplaner14v` | https://www.bexbach.de/aktuelles/veranstaltungen/veranstaltungskalender | „Kerb Niederbexbach“ 06. bis 09.11.2026, Adventsmarkt PWV | 4 | nein | B |
| Blieskastel | 10045112 | 19.935 | TYPO3, one4vision (`addressaddon14v`), tx_news | https://www.blieskastel.de/stadt/aktuelles/veranstaltungen-der-stadt-blieskastel | 12 Datumsangaben (Stadttermine); Vereinsseite „keine gemeldeten Termine“ | 10 | 105 | M → B tx_news |
| Gersheim | 10045113 | 6.191 | WordPress, toubiz-Widget | https://gersheim.de/events/ | Termine nur per Widget (eigener Token) | 22 | 120 | C |
| Homburg | 10045114 | 43.412 | Umbraco, gleiche API wie Saarlouis | https://www.homburg.de/veranstaltungen/ | Kategorie „Alle (457)“; API per robots.txt gesperrt, nicht gelesen | 36 | nein | E → gesperrt |
| Kirkel | 10045115 | 10.104 | TYPO3, one4vision `terminplaner14v`, eventnews | https://www.kirkel.de/aktuelles-termine/veranstaltungskalender | Vereinstermine mit Ort und Veranstalter (Naturfreunde, Förderverein Limbacher Mühle) | 11 | 135 | B |
| Mandelbachtal | 10045116 | 10.719 | verwaltungsportal.de | https://www.mandelbachtal.de/veranstaltungen/index.php | Liste leer, AJAX-Monat November 2026 leer | 3 | 143 | B → leer |
| St. Ingbert | 10045117 | 35.209 | WordPress, The Events Calendar | https://www.st-ingbert.de/kultur-tourismus/veranstaltungen/ | REST `total: 55`, „Weihnachtsmarkt Oberwürzbach“ 05.12.2026 | 9 | nein | A |
| Freisen | 10046111 | 8.093 | WordPress | https://www.freisen.de/wp-content/uploads/2026/03/Veranstaltungskalender-2026-Internet-24.03.2026.pdf | nur PDF-Jahreskalender je Ortsteil, „Musikalisches Dorffest“, „Kirmes“ | 0 | 117 | M → PDF |
| Marpingen | 10046112 | 10.243 | WordPress, toubiz-Widget | https://marpingen.de/ | Termine nur per Widget (eigener Token) | 11 | 144 | C |
| Namborn | 10046113 | 7.028 | Advantic iKISS | https://www.namborn.de/Leben-Wohnen/Veranstaltung/ | 1 Termin („Tanztee für Jung und Alt“) | 0 | 150 | B |
| Nohfelden | 10046114 | 9.874 | The Events Calendar (laut Vollerhebung) | https://www.nohfelden.de/ | nicht erreichbar: TLS-Verbindung bricht ab, http leitet auf https | 1 | 152 | A → nicht erreichbar |
| Nonnweiler | 10046115 | 8.399 | TYPO3, one4vision, tx_news | https://www.nonnweiler.de/mgh/veranstaltungen/ | Mehrgenerationenhaus-Termine (38 Datumsangaben), „Adventskaffee“ 13.12.2026 | 1 | 153 | B |
| Oberthal | 10046116 | 6.045 | hallogemeinde.de (Nuxt) | https://www.oberthal.de/aktuelles/termine | Termine nur per JS | 0 | 154 | E → JS |
| St. Wendel | 10046117 | 25.365 | WordPress (Oxygen), eigene Liste | https://www.sankt-wendel.de/veranstaltungen | serverseitige Liste mit JSON-LD, „Nikolausmarkt“ 01.12.2026 | 4 | 170 | E |
| Tholey | 10046118 | 12.325 | WordPress, The Events Calendar | https://www.tholey.de/veranstaltung/ | REST `total: 27`, Vereinstermine, „Konzert im Advent … LYRA Hasborn-Dautweiler“ | 2 | 172 | A |

## Nachprüfung der Vollerhebung

Die Vollerhebung ordnet zu: A 10, B 15, C 5, D 0, E 14, V 0, M 4, R 4 (92 % erreicht).
Die Einzelprüfung ergibt:

| Befund | Gemeinden | k von 52 |
|---|---|---|
| offener Feed mit kommenden Terminen (ionas `events.json`/`event.ics`, Tribe-REST) | Merchweiler, Ottweiler, Schwalbach, Überherrn, St. Ingbert, Tholey | 6 |
| serverseitige HTML-Liste mit kommenden Terminen (Hersteller oder eigen) | Saarbrücken, Friedrichsthal, Großrosseln, Heusweiler, Püttlingen, Sulzbach, Völklingen, Beckingen, Weiskirchen, Eppelborn, Schiffweiler, Spiesen-Elversberg, Dillingen, Lebach, Rehlingen-Siersburg, Saarwellingen, Schmelz, Wallerfangen, Ensdorf, Bexbach, Blieskastel, Kirkel, Namborn, Nonnweiler, St. Wendel | 25 |
| Termine nur über toubiz (Widget mit Token Dritter oder Verweis auf Tourismusseite) | Kleinblittersdorf, Merzig, Mettlach, Gersheim, Marpingen, Wadern | 6 |
| kein lesbarer Gemeindekalender | Quierschied (nur Ticketprogramm), Riegelsberg, Losheim (Bot-Schutz), Perl, Illingen, Neunkirchen, Nalbach, Saarlouis (robots), Wadgassen (JS), Bous (leer), Homburg (robots), Mandelbachtal (leer), Freisen (nur PDF), Nohfelden (nicht erreichbar), Oberthal (JS) | 15 |

Korrekturen gegenüber der CSV: Großrosseln, Mettlach, Bous, Nohfelden (je A tribe)
liefern über die Tribe-REST nichts. Lebachs `event_url` zeigt auf ticket-regional.de,
der Gemeindekalender ist events2 auf lebach.de. Wadern (R) verweist auf die
toubiz-Tourismusseite. Blieskastel (M) und Saarwellingen (E) haben eine
tx_news-Terminliste. Losheim, Saarlouis und Homburg sind nur mit Zustimmung lesbar.

## Generics

### G1. mein.toubiz Saarland (Tourismus Zentrale Saarland)

* **Betreiber und Rolle:** Tourismus Zentrale Saarland GmbH, Digital-Management. Folie
  18 der Präsentation „Tourismusstrategie Region & Landeshauptstadt Saarbrücken“
  (https://tourismusstrategie.saarbruecken.de/media/download-6842a2d1329f9):
  „‚mein.toubiz‘ ist die zentrale touristische Datenbank des Saarlandes“; gepflegt
  „von allen saarländischen Landkreisen, einzelnen Kommunen sowie touristischen
  Leistungsträgern“; Kommunen „können die Daten auch für eigene Webseiten nutzen“;
  Schaubild „Distribution an Dritte“. Ansprechpartner laut Folie: Digital-Management der TZS
  (Name und Mail auf Folie 18). Software toubiz der land in sicht AG (Widget-Host `mein.toubiz.de`).
* **Gemeinden (belegt):** 6 von 52 binden ein toubiz-Widget ein (Kleinblittersdorf,
  Merzig, Mettlach, Weiskirchen, Gersheim, Marpingen), Wadern verweist auf die
  toubiz-Tourismusseite wadern-saarschleifenland.de. Mettlachs Startseiten-Slider
  benutzt denselben Token wie urlaub.saarland (Endung `…tsFD5W`), die übrigen fünf
  eigene Tokens. Die Widgets filtern über toubiz-Orts-UUIDs (z. B. Weiskirchen über
  `clientIncludingManaged: 'current'`, Merzig `cities:['187e7683-…']`). Wie viele
  Gemeinden selbst in mein.toubiz pflegen, ist nicht belegt.
* **Zugriff:** Die Widgets rufen `https://mein.toubiz.de/api/v1/event` mit Header
  `X-Api-Token` (wie in [08-hessen.md G4](08-hessen.md)); die Tokens gehören den
  Gemeinden bzw. der TZS und wurden nicht benutzt. Ohne Token lesbar sind:
  (a) destination.one `open-data` als exportierte Teilmenge (Abschnitt „Abgleich“),
  (b) bei Weiskirchen die serverseitige Liste des one4vision-Moduls `terminplaner14v`,
  das toubiz-Daten mit toubiz-Kategorie-UUIDs (`data-identifier`) ausliefert (Klassen
  `tb-event-list-item`, `tb-event-title`, `data-item="event-<id>"`).
* **Felder (Probe Weiskirchen-HTML):** Kategorie, Titel, Ort, Wochentag, Datum, Uhrzeit,
  Preis, Merker „Tipp“, Detail-URL
  `/tourismus-wirtschaft/freizeit/veranstaltungen/veranstaltung/detail/<slug>`.
  Felder der toubiz-API selbst: nicht belegt (nicht abgerufen).
* **Lizenz/robots:** In destination.one tragen alle 382 Saarland-Termine
  `license` CC-BY (271) oder CC-BY-SA (111) mit `licenseurl` auf creativecommons.org.
  Ob die nicht exportierten toubiz-Termine (Weiskirchen 24 von 29) lizenziert sind, ist
  nicht belegt; das Merziger Widget fragt ausdrücklich mit `unlicensed: true`.
  robots.txt urlaub.saarland: nur `Disallow: /neos/`.
* **Dorffest-Test:** bestanden. Weiskirchen „Adventsfest Löschbezirk Rappweiler-Zwalbach“
  12.12.2026
  https://www.weiskirchen.de/tourismus-wirtschaft/freizeit/veranstaltungen/veranstaltung/detail/adventsfest-loeschbezirk-rappweiler-zwalbach
  (nicht in destination.one); über destination.one „Berschweiler Kerb“ (Marpingen,
  id 101252966), „Adventsmarkt in Medelsheim“ (Gersheim, 101148908).
* **Nächster Schritt:** TZS um einen eigenen toubiz-Zugang bzw. Export aller
  saarländischen Termine bitten, mit Lizenzangabe je Datensatz und der Frage, welche
  Kommunen selbst pflegen. Bis dahin destination.one `open-data` mit Lizenzfilter
  CC-BY/CC-BY-SA importieren.

### G2. WITTICH: Amtsblätter und meinOrt

Anbieter, AGB und Datenweg: [00-bundesweit.md A1/B1](00-bundesweit.md). Landessicht:

* **Amtsblätter:** Die Zeitungs-Sitemap von wittich.de (`?sitemap=zeitungen`, zwei
  Seiten, 1.051 Titel-URLs, selbst gezählt) enthält Titel für 43 saarländische
  Gemeinden, Nummern 103 bis 196 plus 787 (Quierschied) und 901 (Saarlouis), z. B.
  https://www.wittich.de/produkte/zeitungen/154-oberthaler-nachrichten ,
  https://www.wittich.de/produkte/zeitungen/103-amtsblatt-beckingen ,
  https://www.wittich.de/produkte/zeitungen/181-ab-gemeinde-weiskirchen . Ohne
  WITTICH-Titel: Saarbrücken, Friedrichsthal, Großrosseln, Kleinblittersdorf,
  Völklingen, Neunkirchen, Bexbach, Homburg, St. Ingbert. Ob jeder Titel noch erscheint,
  ist nicht geprüft (Sitemap, keine Ausgabenliste). Medienhaus laut Navigation von
  wittich.de: „Föhren, Rheinland-Pfalz + Saarland“.
* **Zugriff:** E-Paper je Titel `https://epaper.wittich.de/frontend/mvc/catalog/by-name/<Nr>/newest`
  (liefert `catalogId`), PDF `https://epaper.wittich.de/frontend/catalogs/<catalogId>/1/pdf/complete.pdf`.
  robots.txt von epaper.wittich.de ist leer. Probe Oberthal Nr. 43/2026 vom 23.10.2026:
  `catalogId=554894`, PDF 6,3 MB, Text mit `pdftotext` lesbar, gegliedert nach
  Ortsteilen („Mitteilungen des Ortsvorstehers Gronig“ usw.).
* **meinOrt:** 29 der 52 Gemeinden haben einen meinOrt-Eintrag (Spalte `meinort_ort`
  der Vollerhebung, Abgleich über Ortsnamen). Nalbach verlinkt die meinOrt-App selbst
  statt eines Kalenders. Keine Termine abgerufen (AGB IV.9).
* **Lizenz:** AGB LINUS WITTICH IV.9 verbieten den Abzug ohne schriftliche Zustimmung,
  IV.4 erlaubt die Weitergabe von Veranstaltungshinweisen an Dritte
  ([00-bundesweit.md B1](00-bundesweit.md)).
* **Dorffest-Test:** bestanden, nur als PDF-Text: „Oberthaler Nachrichten“ 43/2026,
  Inhaltsverzeichnis „Lebendiger Adventsmarkt in Steinberg-Deckenhardt“, „Gemeinsame
  Martinsfeier mit Gronig am 11.11.26“, „Oktoberfest im St. Stephanus“.
* **Nächster Schritt:** Im WITTICH-Gespräch das Saarland ausdrücklich nennen (43
  Amtsblätter, 29 meinOrt-Orte): meinOrt-JSON statt PDF, weil es Adresse und Datum
  getrennt führt.

### G3. one4vision TYPO3 (Saarland-Agentur)

* **Betreiber:** one4vision GmbH, Saarbrücken (www.14v.de leitet auf www.one4vision.de;
  Seitentext: „Im Bereich Content Management System haben wir uns als TYPO3 Agentur
  Saarland seit über 15 Jahren unter den führenden Anbietern in der Region etabliert.“).
  Kundenliste nicht belegt.
* **Gemeinden (selbst gezählt, Merkmal):** 14 von 52 Websites tragen `matomo.14v.de`
  oder Erweiterungen mit Endung `14v` (`addressaddon14v`, `terminplaner14v`,
  `cookie_banner14v`, `imagecredits14v`): Friedrichsthal, Kleinblittersdorf, Püttlingen,
  Quierschied, Völklingen, Wadern, Weiskirchen, Schiffweiler, Spiesen-Elversberg,
  Saarwellingen, Bexbach, Blieskastel, Kirkel, Nonnweiler. Das Terminmodul
  `terminplaner14v` haben 7: Kleinblittersdorf, Wadern, Weiskirchen, Schiffweiler,
  Spiesen-Elversberg, Bexbach, Kirkel.
* **Zugriff:** kein Feed gefunden; serverseitiges HTML. Zwei Ausprägungen:
  (a) toubiz-Darstellung (Weiskirchen, siehe G1), (b) eigene Termine im
  tx_news/eventnews-Muster: `div.event-list`, `p.event_tag` (Datum), `p.event_zeit`,
  `div.event-info` mit Veranstalter (`fa-info-circle`) und Ort (`fa-map-marker-alt`),
  Detail `/…/veranstaltungen/detail/<slug>/` (Spiesen-Elversberg); Kirkel
  `div.event-list-dateWrapper`, `span.news-list-date`, `div.event-infos` mit
  „Veranstaltungsort:“ und „Veranstalter:“; Bexbach Detail-Slug mit Startzeit
  `…/details/kerb-niederbexbach-202611061900`. Schiffweiler bietet „zu Kalender
  hinzufügen“ je Termin und eine Druckansicht `?type=98`.
* **robots.txt:** bei Kirkel, Schiffweiler, Weiskirchen, Saarwellingen gleich: nur
  `/typo3/`, `/typo3conf/`, `/typo3temp/`, `/uploads/`, `/fileadmin/_processed_/` u. a.
  gesperrt; Listen und Details frei. Nutzungsbedingungen: nicht belegt.
* **Dorffest-Test:** bestanden. „Kerb Niederbexbach“ 06. bis 09.11.2026
  https://www.bexbach.de/aktuelles/veranstaltungen/veranstaltungskalender/details/kerb-niederbexbach-202611061900 ;
  Schiffweiler „Gemeinsamer Weihnachtsmarkt“; Püttlingen „Weihnachtsmarkt der
  Chorgemeinschaft Fidelio Püttlingen und des Obst- und Gartenbauverein Püttlingen“
  https://www.puettlingen.de/rathaus-service/aktuell/veranstaltungen/detail/weihnachtsmarkt-der-chorgemeinschaft-fidelio-puettlingen-und-des-obst-und-gartenbauverein-puettlingen .
* **Nächster Schritt:** ein HTML-Adapter für beide Ausprägungen; bei one4vision nach
  einem Export (iCal/JSON) für die Kommunen fragen. Weil die Listen den Veranstalter
  führen, sind Vereinsfeste gut erkennbar.

### G4. ionas

Zugriff und Felder wie in [01-vollerhebung.md](01-vollerhebung.md) Abschnitt 3 und
[08-hessen.md G1](08-hessen.md). Landessicht:

* **Gemeinden:** 3 von 52 (Merchweiler, Ottweiler, Schwalbach).
* **Probe:** `events.json` Merchweiler 167 Termine (14.01.2025 bis 11.04.2027), 23 ab
  29.10.2026; Ottweiler 14, davon 1 kommend (die Seite heißt „Sonderveranstaltungen“);
  Schwalbach 71, davon 10 kommend. Merchweiler `event.ics`: 167 VEVENT,
  `PRODID:-//IONAS//TVM//DE`, `X-LOCALITY` 152, `X-POSTAL-CODE` 152,
  `X-STREET-ADDRESS` 149, `X-ORGANIZER-NAME` 59.
* **Dorffest-Test:** „Lichter Nikolausmarkt“ 28.11.2026 und „Adventsfeier OT
  Wemmetsweiler“ 06.12.2026 in
  https://www.merchweiler.de/kalender/termine/events.json?weekends=false&tagMode=ALL .
* **Nächster Schritt:** im bundesweiten ionas-Adapter mitnehmen.

### G5. The Events Calendar (WordPress)

* **Gemeinden:** Merkmal bei 7 von 52; REST mit kommenden Terminen bei 3: Überherrn
  (`total: 24`), St. Ingbert (`total: 55`), Tholey (`total: 27`). Bous REST
  `total: 0`; Großrosseln und Mettlach REST 404 (`rest_no_route`), Großrosseln liefert
  die Liste als HTML; Nohfelden nicht erreichbar.
* **Felder:** wie [00-bundesweit.md D1](00-bundesweit.md), in der Probe zusätzlich
  `venue.city` mit Ortsteil (Tholey: „Hasborn-Dautweiler“).
* **Dorffest-Test:** „Weihnachtsmarkt im historischen Ortskern von Berus“ 05.12.2026
  https://ueberherrn.de/event/weihnachtsmarkt-im-historischen-ortskern-von-berus-2/ ;
  „Weihnachtsmarkt Oberwürzbach“
  https://www.st-ingbert.de/veranstaltung/weihnachtsmarkt-oberwuerzbach-4/ .
* **Nächster Schritt:** Plugin-Detektor; bei REST 404 auf HTML ausweichen.

### G6. Advantic iKISS

* **Gemeinden:** 3 von 52 (Sulzbach/Saar, Ensdorf, Namborn); Zugriff wie
  [00-bundesweit.md C3](00-bundesweit.md). Sulzbach bietet „Alle Termine exportieren“
  unter `/output/options.php?call=ical…`; robots.txt sperrt `/output/`.
* **Dorffest-Test:** „Ensdorfer Weihnachtsmarkt“ 05./06.12.2026
  https://www.gemeinde-ensdorf.de/Freizeit-Tourismus/Veranstaltungen/Ensdorfer-Weihnachtsmarkt.php?object=tx,3159.364.1&ModID=11&FID=3159.440.1&NavID=3159.14&bn=1 .
* **Nächster Schritt:** im bundesweiten iKISS-Adapter (HTML) mitnehmen.

### G7. Einzelfälle ohne Generic-Wirkung

| System | Gemeinden | Zugang | Dorffest-Beleg |
|---|---|---|---|
| Umbraco-Kalender (gleiche Vorlage, „Designed and Developed by“, Agentur nicht belegt) | Saarlouis, Homburg | `/umbraco/api/veranstaltungen/getall?katId=&search=&ort=&showall=`, robots.txt sperrt `/umbraco/` bzw. die API; nicht abgerufen | nicht geprüft |
| TYPO3 events2 | Lebach, Rehlingen-Siersburg | serverseitige Liste, Detail `/details/<Unix-Zeit>/<Titel>`; Lebach mit Ortsliste aller Stadtteile | Lebach „Große Festveranstaltung im Rahmen des 750-Jahr-Jubiläums“ 07.11.2026 |
| tx_news ohne one4vision | Heusweiler, Schmelz, Wallerfangen | HTML | Schmelz „Kirmes Limbach“ 07. bis 10.11.2026 https://www.schmelz.de/freizeit-tourismus/veranstaltungskalender/details?tx_news_pi1%5Baction%5D=detail&tx_news_pi1%5Bcontroller%5D=News&tx_news_pi1%5Bnews%5D=5155&cHash=ebb672b9d753498ad65eadd0aa5150aa |
| eigener WordPress-Jahreskalender | Beckingen | eine HTML-Seite mit allen Jahren ab 2019, Einträge „Datum / Titel / Wo: Ortsteil/Ort / Wann:“ | „Kirmesmontag in Honzrath“ 23.11.2026, „Koteletten-Essen/Freiwillige Feuerwehr Löschbezirk Hargarten“ 21.11.2026, „Kirmes in Saarfels“ 17.10.2026 |
| eigene PHP-Terminliste | Eppelborn (`dienste.eppelborn.de/Termine/Termin_liste.php`) | HTML, in die Website per iframe eingebunden | „Mittelalterlicher Weihnachtsmarkt Dirmingen“ 28./29.11.2026 |
| eigene WordPress-Listen | Dillingen (Theme `fbo-dillingen`), St. Wendel (Oxygen) | HTML mit JSON-LD | St. Wendel „Nikolausmarkt“ 01.12.2026 |
| PDF-Jahreskalender | Freisen | https://www.freisen.de/wp-content/uploads/2026/03/Veranstaltungskalender-2026-Internet-24.03.2026.pdf, Tabelle Datum, Veranstaltung, Veranstalter, Ort je Ortsteil | „Musikalisches Dorffest“ Musikverein 15.08.2026, „Kirmes“ IG Vereine 26.09.2026, „50 Jahre Jugendfeuerwehr Lbz Freisen“ 03.10.2026 |
| hitcom `disgovery-list-widget` | Wadgassen | Endpunkt `/api/event/list/event-appointment` mit verschlüsseltem `document`-Parameter, nur JS | nicht geprüft |
| hallogemeinde.de (Nuxt) | Oberthal | nur JS (`api/open-modules/…`) | nicht geprüft |
| verwaltungsportal.de | Mandelbachtal | wie [00-bundesweit.md C7](00-bundesweit.md); Liste und AJAX-Monat leer | nicht bestanden (leer) |
| ticket-regional.de (click around GmbH, Trier) | Quierschied, Lebach u. a. als Ticket-Shop | nur Ticketveranstaltungen; robots.txt `Crawl-delay: 20` | nicht bestanden (Lebach: Dinnershow, Konzerte, Convention) |

**eGo-Saar** (Zweckverband elektronische Verwaltung für saarländische Kommunen)
erscheint auf vielen Gemeindeseiten, aber nur mit Formularen (`ego-saar.de/jfs/findform`)
und Wahlpräsentationen (`ego-saar.de/vm_prod/…`); ein Veranstaltungsangebot ist nicht
belegt.

## Dorffest-Test (Übersicht)

| Quelle | Ergebnis | Beleg |
|---|---|---|
| mein.toubiz (über Weiskirchen-HTML) | bestanden | „Adventsfest Löschbezirk Rappweiler-Zwalbach“ 12.12.2026 |
| destination.one `open-data` | bestanden, aber dünn | „Berschweiler Kerb“ (Marpingen), „St. Ingberter Kirmes“, „Feuerwehr Jahresabschluss“ (Gersheim, 101301276), 28 Titel mit „Weihnachtsmarkt“ im Fenster |
| WITTICH-Amtsblatt (PDF) | bestanden | Oberthaler Nachrichten 43/2026: „Lebendiger Adventsmarkt in Steinberg-Deckenhardt“ |
| one4vision TYPO3 | bestanden | „Kerb Niederbexbach“ |
| ionas | bestanden | „Lichter Nikolausmarkt“ Merchweiler |
| The Events Calendar | bestanden | Weihnachtsmarkt Berus (Überherrn) |
| iKISS | bestanden | „Ensdorfer Weihnachtsmarkt“ |
| tx_news (andere) | bestanden | „Kirmes Limbach“ (Schmelz) |
| Beckingen, Eppelborn, Freisen (eigen bzw. PDF) | bestanden | siehe G7 |
| ticket-regional.de | nicht bestanden | nur Saal- und Ticketveranstaltungen |
| verwaltungsportal.de (Mandelbachtal) | nicht bestanden | Liste leer |
| meinOrt | nicht geprüft | AGB IV.9, keine Abrufe |

Auffällig für das Saarland: Kirmes heißt hier Kirmes, Kerb oder Kirb, oft mit
„Kirmesmontag“; Saarwellingen schreibt „nicht nur eine Kirmes, sondern insgesamt drei:
in jedem Ortsteil eine“. Die Feuerwehr tritt als „Löschbezirk“ auf (Weiskirchen,
Beckingen, Freisen); das ist ein gutes Suchwort.

## Abgleich destination.one

Abfrage (ein Abruf, alle Saarland-Termine):
`https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=1000&q=area:"Saarland"&startdate=10/29/2026&enddate=10/28/2027`,
dann lokal nach `city` gezählt. Zusätzlich ein Abruf ohne Zeitfenster mit
`title:Kirmes OR title:Kerb OR title:Kirb OR title:Kerwe OR title:Feuerwehrfest OR title:Dorffest`.

* **Bestand:** 382 Termine (`overallcount`), alle mit `source.value: destination.one`,
  Schlüsselwort `import_source_tta-toubiz`, Lizenz CC-BY 271 und CC-BY-SA 111. Das Ticket
  nennt 452 für alle Termine am 27.10.2026; der Unterschied ist das Zeitfenster.
* **Je Gemeinde:** 43 von 52 Gemeinden mit mindestens einem Treffer. `city` führt den
  Gemeindenamen, der Ortsteil steht im Titel („Adventsmarkt in Medelsheim“, Gersheim).
  Ohne Treffer: Kleinblittersdorf, Riegelsberg, Mettlach, Nalbach, Wallerfangen, Bous,
  Freisen, Namborn, Oberthal. 2 Termine ohne `city`.
* **Festarten im Titel (Fenster):** Weihnachtsmarkt 28, Adventsmarkt 5, Nikolausmarkt 2,
  Feuerwehr 1, Kirmes/Kerb/Kirb 0, Dorffest 0. Ohne Fenster mit Kirmes-Wörtern: 2
  („Berschweiler Kerb“, „St. Ingberter Kirmes“). Die Kirmes-Saison liegt vor dem
  Fenster; 2027er Termine sind im Oktober 2026 noch kaum erfasst.
* **Überschneidung mit Gemeindequellen:** Weiskirchen toubiz-Liste 29 kommend,
  destination.one 5 (alle 5 auch in der Gemeindeliste); Überherrn Tribe 24 gegen 1
  (Weihnachtsmarkt Berus in beiden); St. Ingbert Tribe 55 gegen 9 (Weihnachtsmärkte in
  beiden); Merchweiler ionas 23 gegen 1. destination.one ist eine kleine, offen
  lizenzierte Teilmenge; die Gemeindequellen ergänzen sie, der bestehende Dedup fängt
  die Doppelungen.

## Abdeckung

Vollzählung, keine Hochrechnung: Anteil = k / 52.

| Merkmal | k | Anteil |
|---|---|---|
| destination.one mit mindestens einem Treffer | 43 | 82,7 % |
| WITTICH-Amts- oder Mitteilungsblatt in der Sitemap | 43 | 82,7 % |
| meinOrt-Eintrag (Vollerhebung) | 29 | 55,8 % |
| one4vision-Merkmal | 14 | 26,9 % |
| offener Feed mit kommenden Terminen | 6 | 11,5 % |
| serverseitige HTML-Liste mit kommenden Terminen | 25 | 48,1 % |
| Feed oder HTML-Liste zusammen | 31 | 59,6 % |
| Termine nur über toubiz | 6 | 11,5 % |
| kein lesbarer Gemeindekalender | 15 | 28,8 % |
| davon ohne destination.one-Treffer und ohne toubiz | 5 (Riegelsberg, Nalbach, Bous, Freisen, Oberthal) | 9,6 % |
| davon mit WITTICH-Blatt | 5 von 5 | |
| Gemeinden ohne jede der Quellen Gemeindekalender, toubiz, destination.one, WITTICH | 0 | 0 % |

## Priorisierte Integrationsliste Saarland

Bewertet nach Datenqualität vor Menge, dann Gemeinden je Integration, dann Rechtslage.

| # | Integration | Gemeinden (Beleg) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|
| 1 | destination.one `open-data`, Saarland | 43 von 52 mit Treffern, 382 Termine | gut, Koordinaten, Kategorie; Teilmenge von toubiz | CC-BY / CC-BY-SA je Datensatz | ohnehin geplanter Import; Namensnennung und Share-Alike umsetzen |
| 2 | mein.toubiz über die TZS | Landesdatenbank; 6 Gemeinden zeigen ihre Termine nur dort; Weiskirchen 29 statt 5 Termine | gut (Kategorie, Ort, Preis, Zeiten) | nur nicht exportierter Teil ungeklärt | Anfrage TZS Digital-Management: Zugang zu allen Saarland-Terminen und Lizenz je Datensatz |
| 3 | ionas, Tribe-REST, iKISS | 3 + 3 + 3 | sehr gut bis gut | Gemeinde-Websites; iKISS-iCal per robots gesperrt | bundesweite Adapter, Saarland mitnehmen |
| 4 | one4vision-HTML | 14 Websites, 7 mit `terminplaner14v` | gut: Datum, Zeit, Ort, Veranstalter | robots frei, Bedingungen nicht belegt | ein Adapter; one4vision nach Export fragen |
| 5 | Einzel-HTML (Beckingen, Eppelborn, Dillingen, St. Wendel, events2, tx_news) | 10 | Beckingen und Eppelborn mit vielen Dorfterminen | Gemeinde-Websites | allgemeiner Parser (Stufe E) mit Registry-URL aus der Tabelle oben |
| 6 | WITTICH Amtsblätter / meinOrt | 43 / 29 | PDF bzw. JSON | nur mit Zustimmung | Teil des bundesweiten WITTICH-Gesprächs; für 5 Gemeinden einziger Weg |
| | Nicht weiter verfolgen | | | | ticket-regional.de (Ticketing), verwaltungsportal Mandelbachtal (leer), eGo-Saar (kein Kalender) |

## Lücken

* Losheim am See (Bot-Schutz), Saarlouis und Homburg (API per robots.txt gesperrt)
  haben Kalender, die nur mit Zustimmung der Gemeinde lesbar sind. Saarlouis und Homburg
  haben dafür 34 und 36 destination.one-Termine.
* Nohfelden war am 29.10.2026 nicht erreichbar (TLS-Fehler bei curl und Python, WebFetch
  „unable to verify the first certificate“); erneut prüfen.
* Wadgassen und Oberthal laden Termine nur per JavaScript, Wadgassen mit verschlüsseltem
  Parameter. Ohne Browser oder Absprache kein Zugang.
* Die toubiz-Termine der fünf Widget-Gemeinden außer Weiskirchen sind ohne eigenen Token
  nicht zählbar; ihr Inhalt ist nicht belegt.
* Riegelsberg, Nalbach, Bous, Freisen und Oberthal bleiben ohne WITTICH beim heutigen
  Stand ohne Termine (Freisen nur als PDF-Jahreskalender).
* Ortsteile: Die Quellen nennen Ortsteile im Titel (destination.one), im Feld „Wo:“
  (Beckingen), in `venue.city` (Tholey) oder als Ortsauswahl (Lebach). Die Zahl der
  saarländischen Ortsteile ist hier nicht erhoben; die Zuordnung braucht den
  DE-Resolver (`orteGemeinde` in `data/plz-de.json`).
* Ob toubiz und WITTICH alle Dorffeste führen, zeigt nur ein Abgleich mit einer
  Jahresliste, z. B. dem Freisener PDF gegen toubiz, nach Zugang.

## Erkennungsregeln, Ergänzung zu 00-bundesweit D5

* `matomo.14v.de`, `typo3conf/ext/*14v` → one4vision; `terminplaner14v` mit
  `tb-event-list-item` → toubiz-Daten serverseitig, sonst `event-list`/`event_tag` bzw.
  `event-list-dateWrapper`.
* `toubiz-widget` mit `base-uri="https://mein.toubiz.de"` → toubiz (Saarland: TZS),
  Orts-UUID aus `serialized-configuration` notieren, Token nicht benutzen.
* `import_source_tta-toubiz` in destination.one → Herkunft TZS-toubiz.
* `/umbraco/api/veranstaltungen/getall` → Umbraco-Kalender, robots.txt prüfen.
* `disgovery-list-widget` → hitcom, nur JS; `hallogemeinde_icon-font`, „Erstellt von
  hallogemeinde.de“ → hallogemeinde, nur JS.
* Weiterleitung auf `/challenge` mit „BUNKERWEB“ → Bot-Schutz, nicht umgehen.

## Anfragen

239 Anfragen am 29.10.2026, nur GET, auf 106 Hosts; Liste mit URL und Status:
[13-saarland-anfragen.md](13-saarland-anfragen.md). Je Gemeinde-Host höchstens 8
Anfragen (robots.txt, Startseite, Kalenderseite, Nachprüfung, Feed, Wiederholung bei
TLS-Fehlern). Weitere:

| Host | Anfragen | Zweck |
|---|---|---|
| meta.et4.de | 2 | Saarland-Bestand im Fenster, Kirmes-Wörter ohne Fenster |
| www.urlaub.saarland | 3 | robots.txt, Startseite, Veranstaltungsseite |
| www.wittich.de | 8 | robots.txt (3), Amtsblätter, Zeitung online lesen, Sitemap, zwei Zeitungs-Sitemaps |
| epaper.wittich.de | 4 | robots.txt (2), E-Paper Oberthal, PDF 43/2026 |
| www.ticket-regional.de | 1 | robots.txt |
| www.14v.de / one4vision.de | 2 | robots.txt, Startseite |
| tourismusstrategie.saarbruecken.de | 1 | Präsentation (WebFetch) |
| Websuche | 4 | TZS/toubiz, ticket-regional, Lizenz |

Nicht abgerufen: toubiz-API (Token Dritter), meinOrt-Termine, Umbraco-APIs von
Saarlouis und Homburg (robots.txt), iKISS-`/output/` (robots.txt), Losheim hinter dem
Bot-Schutz, Wadgassen- und Oberthal-Endpunkte.
