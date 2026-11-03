# Abnahme fn-29: Dorffeste je Land, Abdeckung, Quartalslauf (Stand 2026-11-03)

Abnahme des Epics fn-29 (DE-Gemeinde-Registry, Gemeindekalender). Maßstab ist der
Qualitätsvertrag DE im Epic-Spec: Titel, Datum und Uhrzeit wie die Quelle, nie ein falscher
Ort sichtbar, Bild der Quelle mit Bildnachweis und Link auf die Termin-Detailseite.
Datenstand: Prod-Datenbank (api.lasstreffen.at) am 03.11.2026 nach dem Nachtlauf
41612655661, nur lesend; Quellseiten einmal je Termin abgerufen (robots.txt, Adapter-UA).

## Kurzfazit

1. **Stichprobe: 67 Dorffeste aus 14 Ländern gegen die Quellseite geprüft** (je fünf, Berlin
   zwei, Hamburg und Bremen ohne Dorffest im Gemeindekalender, siehe Stadtstaaten). Titel 66 von 67,
   Datum 66 von 67, Uhrzeit 65 von 67, Ort 66 von 67, Bild 34 von 35 richtig. Fünf Befunde,
   davon drei im Adapter behoben mit Golden-Test (PR #435: MEC Uhrzeit und Dublette, ionas
   Anlagezeit, Platzhalterbilder), zwei offen (berlin.de führt Brandenburger Termine, Heede
   klebt den Verein an den Titel). Nach #435: Datum 67, Uhrzeit 66, Bild 35 von 35.
2. **Abdeckung: 2.773 von 10.749 Gemeinden (25,8 %) haben mindestens einen sichtbaren
   kommenden Termin, Ziel 7.503 (69,8 %) ist nicht erreicht.** Im Nachtlauf zugeordnet sind
   7.168 Gemeinden, davon haben 2.217 einen sichtbaren Termin aus ihrem eigenen Adapter.
   Die Lücke ist zum größten Teil belegt (Abschnitt 2): verwaltungsportal liest erst rund
   75 von 752 Websites je Nacht, 456 ionas-Gemeinden haben keinen bestätigten Feed (davon
   112 in Hessen auf einem ekom21-Server, der von hier nicht antwortet), Kalender laden per
   Skript oder führen keine kommenden Termine.
3. **Quartalslauf eingerichtet** (`.github/workflows/vollerhebung-de.yml`, Skripte in
   [vollerhebung/](vollerhebung/), neu mit Drossel je Server). Erste Wiederholung am 03.11.:
   unter den 10.380 Gemeinden, die beide Male erreichbar waren, 32 mehr erreicht (9.416);
   roh 88,1 % statt 89,0 %, weil 188 Gemeinden diesmal nicht erreichbar waren (Abschnitt 3,
   Matrix und Diff in [01-vollerhebung.md](01-vollerhebung.md) Abschnitt 9).
4. **Nebenbefund behoben:** Der Abdeckungsschritt des Nachtlaufs lief am 03.11. in den
   Statement-Timeout (Seiten per OFFSET); er liest jetzt nach `id` (PR #435, lokal gegen
   Prod 210.440 Termine in 60 s).

## 1. Dorffest-Stichprobe

### Methode

* Alle sichtbaren kommenden DE-Termine der 19 Nachtlauf-Adapter (`DE_NACHTLAUF`) gelesen:
  82.519 Zeilen. Dorffeste über den Titel (Feuerwehrfest, Kirchweih, Kerwe, Kirmes, Kerb,
  Schützenfest, Maifest, Weinfest, Winzerfest, Weihnachtsmarkt, Adventsmarkt,
  Christkindlmarkt, Dorffest, Dorfweihnacht); Fahrten zum Markt, Aufbau, Versammlungen und
  Feiern nicht. Im November überwiegen Advents- und Weihnachtsmärkte; Schützenfeste,
  Kirchweih und Weinfeste stehen schon für 2027 in den Kalendern.
* Je Land fünf Termine per Zufall (Seed 20261103), möglichst aus verschiedenen Adaptern.
* Je Termin die Quellseite (`source_url`) einmal abgerufen und Titel, Datum, Uhrzeit, Ort und
  Bild verglichen; bei Kalendern, die per Skript laden (ionas, Events Manager), das iCal der
  Quelle. Datum und Uhrzeit in Europe/Berlin; „ohne Uhrzeit“ heißt ganztägig.
* Bild: dieselbe Datei oder eine Größenvariante auf der Seite bzw. im Feed, Bildnachweis =
  Website der Quelle (`image_credit`), Link = `source_url`. Ohne Bild: die Quelle hat keins
  oder es fiel als Logo/Platzhalter weg. Hat die Quelle keine eigene Seite je Termin (ionas
  ohne Bildordner, Listen des allgemeinen Parsers), verlinkt `source_url` die Kalenderseite;
  so steht es in der Tabelle.
* Prüf-Abrufe mit einem UA, der „Bot“ enthält, bekommen von iKISS-Servern ein nginx-404, mit
  dem Adapter-UA 200; alle Belege unten mit dem Adapter-UA.

### Befunde

| Befund | Beleg | Ursache | Stand |
|---|---|---|---|
| Uhrzeit eine Stunde zu spät | Nr. 24 Hohen Viecheln „Adventsmarkt“: DB 15:00, Seite 14:00 bis 18:00 | MEC-JSON-LD sagt `15:00+01:00`, die Anzeige derselben Seite 14:00 | behoben (#435): Einzeltermine nehmen die angezeigte Uhrzeit, Golden-Test mit der Detailseite |
| Termin doppelt sichtbar | Nr. 51 Pegau „Weihnachtsmarkt & Adventsmesse“: Zeile 28. bis 29.11. und Zeile 29.11. | MEC-Liste wiederholt den laufenden Markt am letzten Tag ohne Ende | behoben (#435): Eintrag, dessen Tag ein früherer derselben Seite abdeckt, ist derselbe Termin |
| Anlagezeit als Uhrzeit | Nachbarn von Nr. 6 (Ahorn): „Martinsumzug Witzmannsberg“ 15:20, „Volkstrauertag“ 15:21, „Dorfweihnacht Schorkendorf“ 15:23 … | Quelle trägt die Minute der Anlage als Beginn (`CREATED:20251218T142026Z`, `DTSTART:…T152000`) | behoben (#435): gleiche Minute wie die Anlage an anderem Tag = ganztägig; in 128 anderen Fixture-Terminen kein Treffer |
| Platzhalterbild sichtbar | Nr. 36 Plettenberg: `typo3conf/ext/citko_events3/…/no-image-dummy.jpg`; DB-weit rund 35 Zeilen | Datei nennt sich Platzhalter, die Drei-Termine-Regel greift bei kleinen Listen nicht | behoben (#435); dazu 160 Zeilen, bei denen TYPO3-JSON-LD die Terminseite selbst als Bild nennt, und PDF/DOCX als Bild |
| Ort falsch | Nr. 12 „Weihnachtsmarkt der tausend Sterne in Cottbus“ steht unter Berlin | berlin.de führt unter `/tourismus/brandenburg/` Brandenburger Termine; der Kalenderort Berlin gilt, weil der Termin keinen Ort nennt. Drei von 34 sichtbaren berlin.de-Zeilen (Cottbus, Rheinsberg, TransVocale in Frankfurt (Oder)) | **offen.** Eine Titelregel „in X, X ferner als 30 km“ träfe 171 sichtbare Zeilen, fast alle richtige Ortsteile („in Langeln“ bei Nordharz, „in Schönau“ bei Georgenthal): verworfen. Weg: Kalender-URL der Registry auf eine Berliner Liste ohne Brandenburg-Rubrik, oder die Detailseite als Ortsbeleg lesen |
| Titel falsch | Nr. 30 Heede: „Musikverein HeedeVerlosung auf dem Heeder Weihnachtsmarkt“ | Titelzelle `<b>Musikverein Heede</b><br>Verlosung …`; `nameText` liest `<br>` ohne Trenner | **offen.** Der Fix ändert die `source_id` der Listenzeilen (ID aus dem Titel) und braucht `previous_source_id`; nur Heede belegt (12 Zeilen) |

Kleinere Abweichungen ohne Verstoß gegen den Vertrag: fehlende Endzeit bei Nr. 42, 58, 66
(Beginn richtig); Folgetermine nur im Beschreibungstext (Nr. 20 Wetter); Nr. 43
Püttlingen: die Detailseite antwortet 404, die Liste führt den Termin weiter (Fehler der
Quelle; der Rückzug würde den Termin auf den 404-Beleg hin zurückziehen, obwohl er
stattfindet). Pegau (Nr. 51) zeigt 15:00 nur in der Anzeige, das JSON-LD ist ganztägig:
der Termin bleibt ganztägig (offen, wie bei Rhens im MEC-Bericht).

### Stadtstaaten

* **Berlin:** zwei Weihnachtsmärkte, mehr gibt der Kalender nicht her. Berlin hat einen
  Kalender (berlin.de, Stufe E, allgemeiner Parser), aber keine Dorffeste im Sinn der
  Abnahme; 34 sichtbare Zeilen, meist Konzerte und Festivals. Ein Befund (Cottbus).
* **Hamburg und Bremen:** kein Dorffest. Hamburg hat keinen Gemeindekalender im Nachtlauf;
  die einzige Hamburger Zeile kommt aus dem Kalender von Glinde (Schleswig-Holstein,
  Ausflug zum Internationalen Seegerichtshof, Ort richtig). Bremen und Bremerhaven haben
  laut Vollerhebung keinen erreichbaren Kalender (Stufe R); die zwei Bremer Zeilen sind ein
  Konzert in Bremen aus dem Kalender von Schiffdorf (Ort richtig). Die Stadtstaaten kommen
  über Stadt-, Tourismus- und Ticketing-Quellen, nicht über Gemeindekalender
  ([01-vollerhebung.md](01-vollerhebung.md) Abschnitt 1).

### Ergebnis je Termin

Spalte „Prüfung“: „wie die Quelle“ heißt Titel, Datum, Uhrzeit und Ort stimmen mit der
Quellseite überein, das Bild (falls vorhanden) ist das der Seite bzw. des Feeds.
Nummern 1 bis 5 Baden-Württemberg, 6 bis 10 Bayern, 11 bis 12 Berlin, dann je fünf in der
Reihenfolge der Tabelle.

| # | Land | Termin (Quellseite) | Adapter | Datum, Uhrzeit (DB) | Ort (DB) | Bild | Prüfung |
|---:|---|---|---|---|---|---|---|
| 1 | Baden-Württemberg | [Feuerwehrfest](https://www.weinsberg.de/kalender/2027/mai-2027/2027-05-16-feuerwehrfest/) | ionas | 16.05.2027 10:00 bis 11:00 | Feuerwehr Weinsberg | ja, weinsberg.de | Ende 11:00 aus dem iCal der Quelle, Seite sagt „ab 10:00 Uhr“ |
| 2 | Baden-Württemberg | [Grafenauer Weihnachtsmarkt](https://www.gemeindegrafenau.de/freizeit-kultur/veranstaltungen/termine/248/grafenauer-weihnachtsmarkt) | hwveranstaltung | 05.12.2026 11:00 | Dätzinger Schloss, Grafenau | nein | wie die Quelle |
| 3 | Baden-Württemberg | [Adventsmarkt der Ev. Kirchengemeinde Lomersheim und örtlichen Gruppen, Vereinen und Engagierten](https://www.muehlacker.de/stadt/veranstaltungen/termine/5718555124.php) | weblication | 05.12.2026 14:00 bis 19:30 | Lomersheim, Mühlacker | nein | wie die Quelle |
| 4 | Baden-Württemberg | [Adventsmarkt](https://meissenheim.de/event/adventsmarkt-2/) | tribe | 29.11.2026 | Kirchplatz, Kürzell, Meißenheim | nein | wie die Quelle |
| 5 | Baden-Württemberg | [Wertheimer Weihnachtsmarkt](https://www.wertheim.de/site/Wertheim2023/node/2715403/zmdetail_2644045958/WertheimerWeihnachtsmarkt.html?nodeID=2644045958) | kommone | 03.12.2027 bis 05.12.2027 | Innenstadt, Wertheim | nein | wie die Quelle |
| 6 | Bayern | [Dorfweihnacht Witzmannsberg](https://www.ahorn.de/aktuelles/veranstaltungen/) | ionas | 06.12.2026 | Dorfmitte Witzmannsberg, Ahorn | nein | Termin richtig (Quelle ohne Uhrzeit); Nachbartermine derselben Quelle trugen die Anlagezeit als Uhrzeit: **behoben** (#435) |
| 7 | Bayern | [Weihnachtsmarkt am 12.12.2026](https://www.pliening.de/Vereins-Veranstaltungen-im-Buergerhaus.o750.html?detailevent=5535) | open2c | 12.12.2026 14:00 bis 22:00 | am Parkplatz Bürgerhaus, Pliening | nein | wie die Quelle |
| 8 | Bayern | [Velburger Weihnachtsmarkt](https://www.velburg.de/freizeit-tourismus/veranstaltungen/veranstaltungskalender/548/velburger-weihnachtsmarkt) | hwveranstaltung | 12.12.2026 | Stadtplatz Velburg | nein | drei Tage 11. bis 13.12. je eine Zeile, ganztägig wie die Quelle |
| 9 | Bayern | [Adventsmarkt des SSV Markt Rettenbach auf dem Marktplatz](https://www.markt-rettenbach.de/de/veranstaltungen/termine/Adventsmarkt-des-SSV-Markt-Rettenbach-auf-dem-Marktplatz-1.php?splitId=23&from=2026-11-28%2016:00:00&to=) | weblication | 28.11.2026 16:00 | Markt Rettenbach | nein | wie die Quelle |
| 10 | Bayern | [Weihnachtsmarkt](https://www.hirschau.de/freizeit/veranstaltungen/detail?weihnachtsmarkt-4959&showTeasertextTop=0&showAttrBottom=0&selectedDate=Sonntag,%2029.11.2026,%2014:00%20Uhr) | digipublica | 29.11.2026 14:00 bis 19:00 | Hirschau | nein | wie die Quelle |
| 11 | Berlin | [Historischer Weihnachtsmarkt auf dem RAW-Gelände](https://www.berlin.de/weihnachtsmarkt/5983209-3496862-historischer-weihnachtsmarkt-auf-dem-raw.html) | allgemein | 12.11.2026 bis 22.12.2026 | Berlin | ja, berlin.de | wie die Quelle |
| 12 | Berlin | [Weihnachtsmarkt der tausend Sterne in Cottbus](https://www.berlin.de/tourismus/brandenburg/veranstaltungen/7800078-3479097-weihnachtsmarkt-der-tausend-sterne-in-co.html) | allgemein | 23.11.2026 bis 23.12.2026 | Berlin | ja, berlin.de | **Ort falsch**: Markt in Cottbus (Brandenburg) steht unter Berlin, berlin.de führt Brandenburger Termine: **offen** |
| 13 | Brandenburg | [Lebuser Weihnachtsmarkt](https://www.amt-lebus.de/veranstaltungen/2993106/2026/12/05/lebuser-weihnachtsmarkt) | verwaltungsportal | 05.12.2026 14:00 bis 18:00 | Pfarrkirche Lebus | ja, amt-lebus.de | wie die Quelle |
| 14 | Brandenburg | [Adventsmarkt](https://www.oranienburg.de/Rathaus-Service/Aktuelles/Veranstaltungen/Adventsmarkt-.php?object=tx,2967.4.1&ModID=11&FID=2967.8066.1&NavID=2967.14&sfreg=1&bn=1) | ikiss | 05.12.2026 14:00 bis 17:00 | Oranienburger Kleiderkammer e. V. | ja, oranienburg.de | wie die Quelle |
| 15 | Brandenburg | [Adventsmarkt in Liebätz](https://www.nuthe-urstromtal.de/kultur-freizeit/veranstaltungskalender/) | ionas | 28.11.2026 14:00 bis 18:00 | Liebätz, Nuthe-Urstromtal | nein | gegen das iCal geprüft (Seite lädt per Skript) |
| 16 | Brandenburg | [19. Borkheider Weihnachtsmarkt im Waldbad](https://borkheide.eu/event/19-borkheider-weihnachtsmarkt-im-waldbad/) | tribe | 12.12.2026 15:00 bis 20:00 | Naturbad Borkheide e.V. | ja, borkheide.eu | wie die Quelle |
| 17 | Brandenburg | [Adventsmarkt](https://www.gross-kreutz.de/gemeinde/aktuelle-veranstaltungen-termine/207-adventsmarkt-5.html) | icagenda | 28.11.2026 | Groß Kreutz (Havel) | nein | wie die Quelle |
| 18 | Hessen | [Weihnachtsmarkt Altkönig-Stift](https://www.kronberg.de/kultur-freizeit-tourismus/freizeit/veranstaltungskalender/) | ionas | 27.11.2026 15:00 bis 18:00 | Altkönig-Stift, Kronberg im Taunus | ja, kronberg.de | gegen das iCal geprüft (Seite lädt per Skript) |
| 19 | Hessen | [Ronneburgs kleinster Weihnachtsmarkt](https://www.ronneburg.eu/freizeit-tourismus/veranstaltungskalender/1520/ronneburgs-kleinster-weihnachtsmarkt) | hwveranstaltung | 05.12.2026 17:00 bis 23:00 | DGH "Türmchen", OT Altwiedermus, Ronneburg | nein | wie die Quelle |
| 20 | Hessen | [Weihnachtsmarkt / Glühweinanstich](https://www.wetter-hessen.de/Freizeit/Freizeitaktivit%C3%A4ten/Veranstaltungen/Weihnachtsmarkt-Gl%C3%BChweinanstich-.php?object=tx,3510.9.1&ModID=11&FID=3510.477.1&NavID=2322.46&sfvort=1&sfreg=1&bn=1&max=500) | ikiss | 26.11.2026 18:00 bis 22:00 | Frankenberger Straße 9, Wetter (Hessen) | nein | Folgetermine 03., 10., 17.12. nur im Beschreibungstext, nicht übernommen |
| 21 | Hessen | [Birkenauer Weihnachtsmarkt](https://www.birkenau.de/veranstaltungen/veranstaltung/birkenauer-weihnachtsmarkt) | communice | 12.12.2026 16:00 bis 13.12.2026 20:00 | Birkenau | nein | wie die Quelle |
| 22 | Hessen | [Holdesser Weihnachtsmarkt](https://hohenstein-hessen.de/termin/holdesser-weihnachtsmarkt/) | tribe | 05.12.2026 16:00 bis 23:00 | Alte Schule Holzhausen, Hohenstein | ja, hohenstein-hessen.de | wie die Quelle |
| 23 | Mecklenburg-Vorpommern | [Adventsmarkt der Kita Pusteblume Roggow](https://www.rerik.de/veranstaltungen/details/1796124283.html) | typo3 | 29.11.2026 11:00 bis 16:00 | Haus der Begegnung "Kösterschün", Rerik | ja, rerik.de | wie die Quelle |
| 24 | Mecklenburg-Vorpommern | [Adventsmarkt in Hohen Viecheln](https://www.mein-bad-kleinen.de/events/adventsmarkt-in-hohen-viecheln-2/) | mec | 28.11.2026 15:00 bis 19:00 | Hohen Viecheln | nein | **Uhrzeit falsch**: 15:00 statt 14:00 (JSON-LD weicht von der Anzeige ab): **behoben** (#435) |
| 25 | Mecklenburg-Vorpommern | [Wittenburger Weihnachtsmarkt auf der Bürgerwiese](https://www.amt-wittenburg.de/Erlebnis-Tourismus/Veranstaltungen/Wittenburger-Weihnachtsmarkt-auf-der-B%C3%BCrgerwiese.php?ModID=11&FID=3627.396.1) | ikiss | 11.12.2026 bis 13.12.2026 | Bürgerwiese Wittenburg | ja, amt-wittenburg.de | wie die Quelle |
| 26 | Mecklenburg-Vorpommern | [Adventsmarkt Samtens](https://www.amt-westruegen.de/veranstaltungen/2870050/2026/11/28/adventsmarkt-samtens) | verwaltungsportal | 28.11.2026 14:00 bis 22:00 | Dorfplatz Samtens | nein | wie die Quelle |
| 27 | Mecklenburg-Vorpommern | [Adventsmarkt](https://www.krakow-am-see.de/de/veranstaltungskalender/termine/2745353623.php) | weblication | 05.12.2026 14:00 bis 18:00 | Krakow am See | nein | wie die Quelle |
| 28 | Niedersachsen | [Historischer Weihnachtsmarkt](https://www.bad-zwischenahn.de/de/veranstaltungen/termine/100714579.php?splitId=69&from=2026-11-29%2012:00:00&to=2026-11-29%2018:00:00) | weblication | 29.11.2026 12:00 bis 18:00 | Bad Zwischenahn | nein | wie die Quelle |
| 29 | Niedersachsen | [Weihnachtsmarkt](https://www.emlichheim.de/kalender/kalender/2026/2026-11-28-weihnachtsmarkt/) | ionas | 28.11.2026 14:00 bis 29.11.2026 18:00 | Haus Ringerbrüggen, Emlichheim | ja, emlichheim.de | wie die Quelle |
| 30 | Niedersachsen | [Musikverein HeedeVerlosung auf dem Heeder Weihnachtsmarkt](https://www.heede-ems.de/index.php/aktuell/termine-veranstaltungen.html) | allgemein | 06.12.2026 14:00 | Heede | ja, heede-ems.de | **Titel falsch**: „Musikverein HeedeVerlosung …“, Verein und Titel ohne Trenner: **offen** |
| 31 | Niedersachsen | [Adventsmarkt 2026](https://www.koenigslutter.de/Unsere-Stadt/Veranstaltungen/Adventsmarkt-2026.php?object=tx,4073.4.1&ModID=11&FID=4073.358.1&NavID=4073.520&sfodddrt=1&sfvort=1&sfreg=1&sfort=1&bn=1) | ikiss | 11.12.2026 14:30 | Rund um die Stadtkirche, Königslutter am Elm | ja, koenigslutter.de | wie die Quelle |
| 32 | Niedersachsen | [419. Lohner Schützenfest](https://www.lohne.de/Kultur-Freizeit/Veranstaltungen.htm/Veranstaltungen/Schuetzenfest-Lohne.html) | activecity | 10.07.2027 10:00 | Schützenplatz, Lohne (Oldenburg) | ja, lohne.de | wie die Quelle |
| 33 | Nordrhein-Westfalen | [Familien Weihnachtsmarkt Unna](https://kultur-in-unna.de/veranstaltung/familien-weihnachtsmarkt-unna/2026-12-06/) | tribe | 06.12.2026 11:30 | Unnaer Innenstadt | ja, kultur-in-unna.de | wie die Quelle |
| 34 | Nordrhein-Westfalen | [Weihnachtsmarkt Vellern](https://www.beckum.de/kalender/veranstaltungen/12-dezember/2026-12-19-weihnachtsmarkt-vellern/) | ionas | 19.12.2026 14:00 bis 20.12.2026 20:00 | Beckum | ja, beckum.de | wie die Quelle |
| 35 | Nordrhein-Westfalen | [Weihnachtsmarkt im Klostergarten der Steyler Missionare am 1. Advent](https://www.sankt-augustin.de/veranstaltungen/weihnachtsmarkt-im-klostergarten-der-steyler-missionare-am-1-advent-2/?occurrence=2026-11-29&time=1795946400) | mec | 29.11.2026 | Klostergarten der Steyler Missionare, Sankt Augustin | ja, sankt-augustin.de | wie die Quelle |
| 36 | Nordrhein-Westfalen | [Adventsmarkt bei Manuela´s Landmarkt](https://www.plettenberg.de/freizeit/freizeit/veranstaltungen/veranstaltungsdetails?tx_citkoevents3_list%5Baction%5D=single&tx_citkoevents3_list%5Bevent_id%5D=370319&cHash=1cf72e3af63c4a53fcd4b413e7f5057a) | allgemein | 28.11.2026 12:00 bis 18:00 | Plettenberg | ja, plettenberg.de | **Bild falsch**: Platzhalter `no-image-dummy.jpg`: **behoben** (#435) |
| 37 | Nordrhein-Westfalen | [Pavenstädter Weihnachtsmarkt](https://www.guetersloh.de/de/veranstaltungen/termine/10460-16616.php?splitId=25&from=2026-11-28%2015:00:00&to=2026-11-28%2022:00:00) | weblication | 28.11.2026 15:00 bis 22:00 | Gütersloh | ja, guetersloh.de | wie die Quelle |
| 38 | Rheinland-Pfalz | [Weihnachtsmarkt der Partnerstädte](https://www.speyer.de/de/kalender/veranstaltungen-kultur/2026-12-12-weihnachtsmarkt-der-partnerstaedte/) | ionas | 13.12.2026 11:00 bis 18:00 | Maxi99, Speyer | ja, speyer.de | wie die Quelle |
| 39 | Rheinland-Pfalz | [Saarburger Christkindlmarkt](https://www.saarburg.de/kalender/saarburger-christkindlmarkt-2) | tribe | 11.12.2026 bis 13.12.2026 | Buttermarkt, Saarburg | ja, saarburg.de | wie die Quelle |
| 40 | Rheinland-Pfalz | [Alsenzer Weihnachtsmarkt](https://www.alsenz.de/veranstaltungen/2677036/2026/12/05/alsenzer-weihnachtsmarkt) | verwaltungsportal | 05.12.2026 bis 06.12.2026 | Rathausplatz am Alten Rathaus Alsenz | nein | wie die Quelle |
| 41 | Rheinland-Pfalz | [Weihnachtsmarkt 2026](https://weidingen-eifel.de/events/weihnachtsmarkt-2026) | eventsmanager | 12.12.2026 13:00 bis 23:00 | DGH Weidingen | nein | wie die Quelle |
| 42 | Rheinland-Pfalz | [Weihnachtsmarkt in Flußbach](https://flussbach.de/event/weihnachtsmarkt-in-flussbach-2/) | allgemein | 21.11.2026 13:00 | Flußbach | nein | Ende 21:00 fehlt |
| 43 | Saarland | [9. Garagen-Weihnachtsmarkt](https://www.puettlingen.de/rathaus-service/aktuell/veranstaltungen/detail/9-garagen-weihnachtsmarkt) | allgemein | 28.11.2026 15:00 bis 22:00 | Püttlingen | nein | Detailseite antwortet 404, die Liste führt den Termin weiter (28.11. 15:00 bis 22:00): Fehler der Quelle |
| 44 | Saarland | [Ensdorfer Weihnachtsmarkt](https://www.gemeinde-ensdorf.de/Freizeit-Tourismus/Veranstaltungen/Ensdorfer-Weihnachtsmarkt.php?object=tx,3159.364.1&ModID=11&FID=3159.440.1&NavID=3159.14&bn=1) | ikiss | 05.12.2026 15:00 bis 06.12.2026 19:00 | Marktplatz Ensdorf | nein | wie die Quelle |
| 45 | Saarland | [Weihnachtsmarkt Rentrisch](https://www.st-ingbert.de/veranstaltung/weihnachtsmarkt-rentrisch-3/) | tribe | 05.12.2026 | St. Ingbert | nein | wie die Quelle |
| 46 | Saarland | [Adventsmarkt](https://www.ottweiler.de/bildung-kultur/sonderveranstaltungen/) | ionas | 27.11.2026 bis 29.11.2026 | Ottweiler | ja, ottweiler.de | gegen das iCal geprüft (Seite lädt per Skript) |
| 47 | Saarland | [Weinfest in der Burg Bucherbach](https://www.puettlingen.de/rathaus-service/aktuell/veranstaltungen/detail/weinfest-in-der-burg-bucherbach-6) | allgemein | 23.07.2027 bis 24.07.2027 | Püttlingen | nein | wie die Quelle |
| 48 | Sachsen | [Weihnachtsmarkt Groitzsch](https://groitzsch.de/freizeit-kultur-tourismus/veranstaltungen/event/269:weihnachtsmarkt-groitzsch) | allgemein | 05.12.2026 15:00 bis 06.12.2026 20:00 | Groitzsch | nein | wie die Quelle |
| 49 | Sachsen | [Weihnachtsmarkt Roßwein](https://www.rosswein.de/event/weihnachtsmarkt-rosswein-2/) | tribe | 28.11.2026 | Marktplatz Roßwein | nein | wie die Quelle |
| 50 | Sachsen | [Dorfweihnacht am 28.11.2026 in Rothnaußlitz](https://www.demitz-thumitz.de/veranstaltung-ausfuehrlich/dorfweihnacht-am-28-11-2026-in-rothnausslitz.html) | typo3 | 28.11.2026 | Demitz-Thumitz | ja, demitz-thumitz.de | wie die Quelle |
| 51 | Sachsen | [Pegauer Weihnachtsmarkt & Adventsmesse](https://www.stadt-pegau.de/veranstaltungen/pegauer-weihnachtsmarkt-adventsmesse/) | mec | 29.11.2026 | Markt, Pegau | ja, stadt-pegau.de | **doppelt sichtbar** (28. bis 29.11. und noch einmal 29.11.): **behoben** (#435); Uhrzeit 15:00 nur in der Anzeige, JSON-LD ganztägig: **offen** |
| 52 | Sachsen | [Weihnachtsmarkt am 28.11.2026](https://www.deutschneudorf.net/veranstaltungen/2985098/2026/11/28/weihnachtsmarkt-am-28.11.2026) | verwaltungsportal | 28.11.2026 | Deutschneudorf | ja, deutschneudorf.net | wie die Quelle |
| 53 | Sachsen-Anhalt | [Weihnachtsmarkt Ebendorf](https://www.barleben.de/Familie-und-Leben/Freizeit/Veranstaltungskalender/Weihnachtsmarkt-Ebendorf.php?object=tx,4141.4.1&ModID=11&FID=4141.46.1&NavID=4141.15&sfvort=1&sfreg=1&sfort=1&bn=1) | ikiss | 28.11.2026 16:00 | Barleben | ja, barleben.de | wie die Quelle |
| 54 | Sachsen-Anhalt | [Weihnachtsmarkt der Freiwilligen Feuerwehr in Langeln](https://gemeinde-nordharz.de/veranstaltungen/weihnachtsmarkt-der-freiwilligen-feuerwehr-in-langeln) | eventsmanager | 05.12.2026 | Nordharz | nein | gegen das iCal geprüft: 05.12. ohne Uhrzeit |
| 55 | Sachsen-Anhalt | [Weihnachtsmarkt ab 16.30 Uhr am Feuerwehrgerätehaus in Belsdorf](https://www.luftkurortflechtingen.de/veranstaltungskalender.html) | allgemein | 28.11.2026 16:30 | Flechtingen | nein | wie die Quelle |
| 56 | Sachsen-Anhalt | [Weihnachtsmarkt Bootshaus Ahlumer See](https://www.beedorf.de/event/weihnachtsmarkt-bootshaus-ahlumer-see/) | tribe | 05.12.2026 bis 06.12.2026 | Beetzendorf | ja, beedorf.de | wie die Quelle |
| 57 | Sachsen-Anhalt | [Trebitzer Weihnachtsmarkt](https://www.bad-schmiedeberg.de/veranstaltungen/2992394/2026/11/28/trebitzer-weihnachtsmarkt) | verwaltungsportal | 28.11.2026 15:00 | Trebitz, TCV Hof, Bad Schmiedeberg | ja, bad-schmiedeberg.de | wie die Quelle |
| 58 | Schleswig-Holstein | [Rickling: Adventsmarkt](https://www.amt-boostedt-rickling.de/veranstaltungen/veranstaltung/rickling-adventsmarkt) | communice | 21.11.2026 10:30 | Aussengelände "Alte Schule Rickling" | ja, amt-boostedt-rickling.de | Ende 19:00 fehlt |
| 59 | Schleswig-Holstein | [Eröffnung Weihnachtsmarkt](https://www.bad-schwartau.de/Kultur-Natur/Veranstaltungskalender/Er%C3%B6ffnung-Weihnachtsmarkt.php?object=tx,3948.4.1&ModID=11&FID=3948.1286.1&NavID=2327.15&bn=1) | ikiss | 23.11.2026 17:00 | Marktplatz Bad Schwartau | ja, bad-schwartau.de | wie die Quelle |
| 60 | Schleswig-Holstein | [Adventsmarkt Börm](https://kropp.de/veranstaltung/adventsmarkt-boerm/) | tribe | 29.11.2026 | Dörpstreff Börm | ja, kropp.de | wie die Quelle |
| 61 | Schleswig-Holstein | [Amtsfeuerwehrfest](https://www.delingsdorf.de/termine/5945-amtsfeuerwehrfest?nav_pos=19) | allgemein | 21.08.2027 | Delingsdorf | ja, delingsdorf.de | wie die Quelle |
| 62 | Schleswig-Holstein | [Weihnachtsmarkt Busdorf](https://www.busdorf.de/veranstaltungen/2994854/2026/12/05/weihnachtsmarkt-busdorf) | verwaltungsportal | 05.12.2026 14:00 bis 21:00 | „Mittenmang“ in Busdorf | ja, busdorf.de | wie die Quelle |
| 63 | Thüringen | [Heinersdorfer Dorfweihnacht 2026](https://foeritztal.de/veranstaltung/heinersdorfer-dorfweihnacht-2026-3/) | tribe | 13.12.2026 16:00 bis 20:00 | Am Kultursaal Heinersdorf, Föritztal | ja, foeritztal.de | wie die Quelle |
| 64 | Thüringen | [Weihnachtsmarkt](https://www.auengrund.de/veranstaltungen/2853108/2026/12/05/weihnachtsmarkt) | verwaltungsportal | 05.12.2026 17:00 | Crock, Auengrund | ja, auengrund.de | wie die Quelle |
| 65 | Thüringen | [Weihnachtsmarkt Schleusingen](https://oberzentrum-suedthueringen.de/events/weihnachtsmarkt-schleusingen-3/) | mec | 28.11.2026 bis 29.11.2026 | Marktplatz Schleusingen | nein | wie die Quelle |
| 66 | Thüringen | [Greizer Weihnachtsmarkt im Schlossgarten](https://www.greiz.de/tourismus-kultur/veranstaltungskalender/veranstaltung/event-details/2021010?cHash=cf2c5e9d36907cdfa401458e5f6425bad39faf42cb6281d76b8809f2b5a5e862) | allgemein | 12.12.2026 10:00 | Greiz | nein | je Tag 10:00, Ende 20:00 fehlt |
| 67 | Thüringen | [Schützenfest Wendehausen](https://lg-suedeichsfeld.de/events/schuetzenfest-wendehausen/) | eventsmanager | 03.07.2027 bis 05.07.2027 | Schützenhaus, Am Festplatz, Südeichsfeld | nein | wie die Quelle |
## 2. Abdeckung

Gemessen mit dem Report-Schritt des Nachtlaufs (`src/scripts/coverage-report.ts`, Regeln
`src/lib/pipeline/coverage.ts`): eine Gemeinde zählt, wenn sie mindestens einen kommenden
Termin hat, der sichtbar ist oder als Duplikat an einem sichtbaren hängt. Der Schritt war im
Nachtlauf vom 03.11. rot (Statement-Timeout), die Zahlen stammen aus dem Lauf mit dem Fix
aus #435 am 03.11. gegen Prod (210.440 kommende Termine, alle mit Gemeinde in den
Stammdaten gefunden). Zum Vergleich Österreich: 1.847 von 2.092 Gemeinden (88,3 %).

### Je Land (Termine aller Quellen)

| Land | Gemeinden | mit sichtbarem Termin | Anteil |
|---|---:|---:|---:|
| Baden-Württemberg | 1.101 | 602 | 54,7 % |
| Bayern | 2.056 | 565 | 27,5 % |
| Berlin | 1 | 1 | 100,0 % |
| Brandenburg | 413 | 156 | 37,8 % |
| Bremen | 2 | 2 | 100,0 % |
| Hamburg | 1 | 1 | 100,0 % |
| Hessen | 421 | 109 | 25,9 % |
| Mecklenburg-Vorpommern | 724 | 92 | 12,7 % |
| Niedersachsen | 941 | 145 | 15,4 % |
| Nordrhein-Westfalen | 396 | 185 | 46,7 % |
| Rheinland-Pfalz | 2.300 | 397 | 17,3 % |
| Saarland | 52 | 14 | 26,9 % |
| Sachsen | 418 | 115 | 27,5 % |
| Sachsen-Anhalt | 218 | 68 | 31,2 % |
| Schleswig-Holstein | 1.104 | 248 | 22,5 % |
| Thüringen | 601 | 73 | 12,1 % |
| **Deutschland** | **10.749** | **2.773** | **25,8 %** |

Stadtstaaten zählen als eine bzw. zwei Gemeinden und sind über Stadt- und Ticketing-Quellen
abgedeckt, nicht über Gemeindekalender.

### Gegen das Ziel 7.503

Wohin die 10.749 Gemeinden laut Registry gehören (`data/de-gemeinde-registry.json`,
Stand des Nachtlaufs mit 19 Adaptern):

| Gruppe | Gemeinden | mit sichtbarem Termin aus dem eigenen Adapter |
|---|---:|---:|
| im Nachtlauf, eigener Kalender | 6.561 | 2.155 (32,8 %) |
| im Nachtlauf, Kalender des Amts bzw. der VG | 607 | 62 (10,2 %) |
| ohne Adapter, ohne Lizenzhürde (destination.one 133, Deskline 138, GeoCMS 66, regiogate 38, weitere eingebettete 44, contentXXL 33, StadtLandNews 30, Sitepark 29, ILE/lkrg 17, EventON 14, Crossiety 7) | 549 | |
| Lizenzquelle (Heimat-Info 573, NOLIS 535, meinOrt 335, Cross7 178, termine-regional 55, cmcitymedia 38, RCE 38, toubiz 34, outdooractive 31, townhall 28) | 1.845 | |
| Rest: Seite ohne Termine 556, kein Kalenderlink 450, nicht erreichbar 101, robots.txt sperrt 80 | 1.187 | |
| **Summe** | **10.749** | **2.217** |

Das Ziel 7.503 (rund 71 %, Plan fn-29) ist die Menge der Gemeinden mit einem Weg ohne
Lizenzanfrage. Erreicht ist er technisch für 7.168 im Nachtlauf; einen sichtbaren Termin aus
ihrem Kalender haben davon 2.217 (Gemeinden mit Termin nur aus anderen Quellen wie Eventim
oder Eventfrog stecken in den 2.773 oben, nicht hier).

### Je Integration (nur Termine des Adapters der Gemeinde)

| Integration (Adapter) | Gemeinden | sichtbar | nur zurückgehalten | keine kommende Zeile |
|---|---:|---:|---:|---:|
| ionas | 1.271 | 244 | 1 | 1.026 |
| verwaltungsportal | 1.239 | 199 | 0 | 1.040 |
| HTML-Liste (allgemein) | 1.200 | 448 | 3 | 749 |
| per Skript oder Feed (allgemein) | 696 | 24 | 0 | 672 |
| hwveranstaltung | 432 | 335 | 0 | 97 |
| iKISS | 426 | 149 | 0 | 277 |
| The Events Calendar | 378 | 187 | 0 | 191 |
| communice | 350 | 124 | 0 | 226 |
| TYPO3 tx_news | 154 | 7 | 0 | 147 |
| Komm.ONE | 138 | 53 | 1 | 84 |
| Contao | 118 | 53 | 0 | 65 |
| Weblication | 110 | 55 | 0 | 55 |
| cEasy | 102 | 87 | 0 | 15 |
| MEC | 77 | 35 | 0 | 42 |
| JSON-LD (allgemein) | 61 | 52 | 1 | 8 |
| DigiPublica | 61 | 25 | 0 | 36 |
| Open2C | 57 | 35 | 0 | 22 |
| active-City | 56 | 7 | 0 | 49 |
| calendarize | 55 | 16 | 0 | 39 |
| JEvents | 54 | 17 | 2 | 35 |
| Events Manager | 53 | 37 | 0 | 16 |
| DPCalendar | 30 | 8 | 0 | 22 |
| iCagenda | 25 | 10 | 0 | 15 |
| events2 | 17 | 7 | 0 | 10 |
| sf_event_mgt | 8 | 3 | 0 | 5 |
| **Summe** | **7.168** | **2.217** | **8** | **4.943** |

„Nur zurückgehalten“: der Adapter liefert kommende Zeilen mit dieser Gemeinde, aber keine
ist sichtbar (Quarantäne). Fast alle fehlenden Gemeinden haben gar keine kommende Zeile mit
ihrem Namen. Was belegt ist:

* **verwaltungsportal liest noch nicht alles.** 752 Websites auf einem Server, eine zur Zeit
  mit 4 s Pause, rund 75 je Nacht mit Fortsetzungs-Cursor (fn-29.11, Nachtlauf seit 02.11.).
  Nach zwei Nächten sind rund 150 gelesen; die 1.040 fehlenden Gemeinden sinken über die
  nächsten acht Nächte. Kein Fehler, eine Frage der Zeit.
* **ionas: 456 Gemeinden ohne bestätigten Feed** in der Registry (Feed nur nach bestätigtem
  Abruf, fn-29.4); der Adapter liest sie nicht. Von den 273 nicht abgedeckten mit Feed:
  Stichprobe 10 (iCal ab heute ein Jahr): 7 Feeds leer (Mertesheim, Ohlenhard, Mettweiler,
  Igel, Wiesemscheid, Bechhofen, Kadenbach), 3 sind der Kalender der VG mit Terminen anderer
  Ortsgemeinden (Nisterau, Bremberg, Oberstreit), die der Termin nicht nennt: richtig nicht
  zugeordnet (Qualitätsvertrag Punkt 2).
* **Allgemeiner Parser (1.896 Gemeinden):** laut Prüfstand haben 567 Gemeinden kein Datum
  im HTML (Kalender per Skript, Google Calendar sperrt per robots.txt), 281 nur Fließtext
  ohne sicher lesbaren Termin, 163 nur eine Startseite, auf der Termine und Meldungen nicht
  zu trennen sind ([adapter-allgemein.md](adapter-allgemein.md)); diese hält der Parser mit
  Absicht zurück. Für „per Skript“ braucht es je Plattform einen eigenen Weg.
* **Amts- und VG-Kalender (607):** ein Termin gehört nur der Gemeinde, die er nennt; die
  meisten Mitgliedsgemeinden kommen in keinem Termin vor.
* **Kalender ohne kommende Termine:** die Vollerhebung zählt einen Kalender als erreicht,
  auch wenn er dünn ist (Thüringen: 8 von 15 verwaltungsportal-Seiten mit 0 bis 3
  Terminen). Im November sind viele Gemeindekalender bis Jahresende leer.
* **iKISS:** 75 Registry-Einträge ohne Kalender-URL, 88 Kalenderseiten ohne
  Veranstaltungsliste ([adapter-ikiss.md](adapter-ikiss.md)).

Nicht je Gemeinde aufgeschlüsselt ist der Rest der 4.943 (welche Gemeinde leer ist und
welche nicht gelesen wurde); dafür fehlt ein Zähler je Kalender im Nachtlauf (Vorschlag in
Abschnitt 4).

## 3. Quartalslauf der Vollerhebung

**Eingerichtet:** `.github/workflows/vollerhebung-de.yml`, am 2. Tag jedes Quartals 02:41
UTC und per `workflow_dispatch` (Eingabe `limit` für Probeläufe). Der Lauf ruft
`docs/research/de-gemeinden/vollerhebung/run.sh` auf: Gemeinden aus den Destatis-
Stammdaten, Websites aus Wikidata (`sites.py`), drei Durchgänge wie in der Ersterhebung,
Heimat-Info- und meinOrt-Zuordnung aus der vorherigen Erhebung (Lizenzquellen werden nicht
neu geladen), Zuordnung (`classify.py`) und Matrix mit Diff (`diff.py`). Ergebnis: Artefakt
und Zusammenfassung des Laufs, nichts in Datenbank oder Repo; Übernahme und Registry-Bau
von Hand ([01-vollerhebung.md](01-vollerhebung.md) Abschnitt 7).

**Neu gegenüber der Ersterhebung: Drossel je Server** (`drossel.py`). Die Ersterhebung lief
mit 40 Hosts parallel; verwaltungsportal (rund 750 Websites auf einem Server) und GeoCMS
sperren aber bei parallelen Abrufen über ihre Websites hinweg. Jetzt startet je Server-IP
höchstens ein Abruf alle 3 s, bis zu 100 Server gleichzeitig. Die ersten 70 Minuten dieser
Wiederholung liefen noch ohne Drossel (350 verwaltungsportal-Hosts parallel); keine Sperre
beobachtet (345 mit 200), danach mit Drossel fortgesetzt.

**Erste Wiederholung (03.11., lokal, 254 min):** Stufen-Matrix und Diff stehen in
[01-vollerhebung.md](01-vollerhebung.md) Abschnitt 9, die Daten in
[data/vollerhebung-2026-11.csv](data/vollerhebung-2026-11.csv). Kurz:

| | Oktober | November |
|---|---:|---:|
| erreicht A bis M, roh | 9.562 (89,0 %) | 9.465 (88,1 %) |
| nicht erreichbar | 181 | 508 |
| erreicht unter 10.380 Gemeinden, beide Male erreichbar | 9.384 | 9.416 |

Der Rückgang im Rohvergleich ist ein Abrufproblem: 150 Hosts auf dem ekom21-Server
80.69.201.211 (112 hessische Gemeinden, ionas/cms21) antworteten vom ersten Abruf an nicht
(ConnectTimeout), auch bei einem einzelnen Abruf danach. Diese 112 Gemeinden haben in der
Registry keinen bestätigten Feed und im Nachtlauf keinen einzigen Termin; sie sind ein
großer Teil der 456 ionas-Gemeinden ohne Feed (Abschnitt 2). Ob der Server von GitHub aus
antwortet, ist nicht geprüft (Abschnitt 4).


## 4. Offen

* **berlin.de verortet Brandenburger Termine in Berlin** (Stichprobe Nr. 12; 3 von 34
  sichtbaren Zeilen). Weg über die Quelle: Kalender-URL der Registry auf eine Berliner Liste
  ohne Brandenburg-Rubrik, oder Ortsbeleg von der Detailseite.
* **Heede: Verein und Titel ohne Trenner** (Nr. 30). Fix in `nameText` (`<br>` als
  Trenner) zusammen mit `previous_source_id` für die Listenzeilen, deren ID den Titel trägt.
* **MEC: Uhrzeit nur in der Anzeige** bei ganztägigem JSON-LD (Pegau 15:00, Rhens).
* **Zähler je Kalender im Nachtlauf:** gelesen ja/nein, Termine gesamt, davon kommend. Erst
  damit lässt sich jede der 4.943 Gemeinden ohne Termin einer Ursache zuordnen (leer, nicht
  gelesen, gesperrt, nur zurückgehalten).
* **ionas ohne bestätigten Feed (456 Gemeinden):** Feeds prüfen und in der Registry
  nachtragen (`npm run build:registry:de -- --feeds`).
* **Rückzug bei 404 einer Detailseite, die die Liste weiter führt** (Püttlingen Nr. 43): der
  404-Beleg trifft dann einen stattfindenden Termin. Prüfen, ob der Rückzug die Liste als
  Gegenbeleg lesen sollte.
* **ekom21-Server 80.69.201.211** (112 hessische ionas/cms21-Gemeinden): von hier seit dem
  03.11. kein Verbindungsaufbau, Registry ohne Feed. Einmal von GitHub aus prüfen (ein Abruf
  je Website, nacheinander), dann Feeds bestätigen (`build:registry:de -- --feeds`) oder die
  Sperre beim Betreiber klären. Bis dahin die CSV 2026-11 für Hessen nicht in die Registry
  übernehmen.
* **GeoCMS und Sitepark** (fn-29.15, 95 Gemeinden): Server sperren, Neuversuch ab 06.11.
* **Lizenzquellen** (fn-29.19, 1.845 Gemeinden) und Cross7 (fn-29.9, entfällt).
