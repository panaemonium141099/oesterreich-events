# Berlin: Kieztermine und Stadtteilfeste (Stand 2026-10-29)

Ticket `fn-28-de-gemeindekalender-dorffeste-in-jeder.15`. Methode und Format: Epic-Spec
`fn-28-de-gemeindekalender-dorffeste-in-jeder`. Berlin ist eine Gemeinde mit 12
Bezirken und 97 Ortsteilen, deshalb ist die Stichprobe hier eine von Ortsteilen statt
Gemeinden. Bundesweite Anbieter stehen in [00-bundesweit.md](00-bundesweit.md),
kulturdaten.berlin und destination.one in
[deutschland-event-quellen-2026-10.md](../deutschland-event-quellen-2026-10.md)
(Abschnitte 1 und 9); hier nur die Berliner Sicht.

Arbeitsweise: nur lesende GET-Anfragen und Websuche, keine Konten, keine Formulare,
keine Mails. Jede Zahl stammt aus einer eigenen Antwort vom 28./29.10.2026 oder aus
einer verlinkten Seite. „Selbst gezählt“ heißt aus einer abgerufenen Antwort gezählt.
Unbelegtes steht als „nicht belegt“ da. Alle Anfragen und drei offen gemeldete
Regelabweichungen: [14-berlin-anfragen.md](14-berlin-anfragen.md).

## Kurzfazit

1. **Es gibt in Berlin keine gemeinsame Plattform für Kieztermine.** In der Stichprobe
   von 30 Ortsteilen stehen die lokalen Feste an fünf Arten von Orten: bei
   Stadtteilzentren und Nachbarschaftshäusern (10 von 30 als Hauptfundort), bei
   Vereinen, Veranstaltervereinen und Gewerbegemeinschaften (8), auf den
   Bezirksamtsseiten von berlin.de (5), bei Quartiersmanagement und BENN (4), in
   Kiezblog oder Ortsportal (2). Für Blankenfelde ist kein Fundort belegt (1).
2. **kulturdaten.berlin ist eine Kopie des Landeskalenders von berlin.de.** Der
   Quellcode holt die Bezirksdaten aus `DISTRICT_DATA_API_URL=https://www.berlin.de/land/kalender/json.php?c=`
   (`.env.example` im Repo technologiestiftung/kulturdaten-api), die Datensätze tragen
   `"origin": "bezirkskalender"`. Die Ursprungsquelle ist selbst offen lesbar: 1.749
   Veranstaltungen mit 11.432 kommenden Terminen, Bezirk, Kategorie, Ort mit PLZ und
   Bild mit Copyright. Sie enthält aber laut Eigenbeschreibung nur „Veranstaltungen der
   teilnehmenden Berliner Verwaltungen“: Bibliotheken, Schulen, Kiezklubs. Kiezfeste
   stehen dort selten (in der Stichprobe 1 von 30 Ortsteilen mit kommendem Fest:
   „48. Lichtenrader Lichtermarkt“). Eine Datenlizenz ist nicht belegt.
3. **Die einzige offen lizenzierte Festliste ist die Senatsliste der Straßen- und
   Volksfeste** (berlin.de, JSON, CC BY laut Datenregister): 77 Einträge 2026, davon
   71 in Berlin. Sie trifft 10 von 30 Stichproben-Ortsteilen, ist aber eine
   Veranstalterliste: 32 der 77 Einträge kommen von einer Agentur (Hauptstadt Kultur),
   9 von Family & Friends e.V. Die Schwesterliste Weihnachtsmärkte steht am 29.10.2026
   noch auf 2025.
4. **destination.one deckt Berlin nicht ab.** 0 von 30 Ortsteilen haben dort einen
   Termin, berlinweit steht im Fenster 29.10.2026 bis 28.10.2027 genau ein Event
   („Tag der Deutschen Einheit“).
5. **Das Strukturmuster der Kiezfundorte ist WordPress mit The Events Calendar,** aber
   lückenhaft: In 9 von 30 Ortsteilen ist es bei einem Fundort installiert, aktiv mit
   kommenden Terminen nur bei 2 Trägern (Ball e.V. für Marzahn und Biesdorf, VaV e.V.
   für Neu-Hohenschönhausen). Die anderen Instanzen sind leer, verwaist oder per
   Firewall gesperrt. Feste stehen meist als Blogbeitrag oder Pressemitteilung mit
   Datum im Fließtext.
6. **Kein Weg liefert Feuerwehr-Tage der offenen Tür.** Weder der Landeskalender noch
   eine Senatsliste noch berliner-feuerwehr.de führen sie; in der Stichprobe ist kein
   Tag der offenen Tür einer Freiwilligen Feuerwehr für 2026 belegt.

Folgerung: Für Berlin trägt keine einzelne Integration die Kieztermine. Sofort und
rechtlich sauber geht nur die Senatsliste. Der Landeskalender ist technisch der
beste Einzelzugang, braucht aber eine Nutzungserlaubnis. Für die eigentlichen
Kiezfeste bleibt eine Registry der Stadtteilzentren, QM-Gebiete und Ortsvereine mit
Plugin-Erkennung, wie in [00-bundesweit.md](00-bundesweit.md) für Gemeinde-Websites
vorgesehen.

## Stichprobe

**Ziehung (reproduzierbar):** Grundgesamtheit sind alle 97 Ortsteile aus dem WFS
„ALKIS Berlin Ortsteile“ (`https://gdi.berlin.de/services/wfs/alkis_ortsteile`,
Layer `alkis_ortsteile:ortsteile`, Lizenz dl-de-zero-2.0, Abruf 29.10.2026), Schlüssel
Feld `sch`. Die Liste nach `sch` sortiert, dann
`random.Random(28015).sample(liste, 30)` (Python 3.14), Seed 28015 = fn-28, Ticket 15.
Anders als in den Flächenländern gibt es keine Einwohnergrenze: Alle Ortsteile sind
Teil derselben Gemeinde, und nur 15 der 97 Ortsteile haben unter 10.000 Einwohner
(selbst gezählt in T11; Schlachtensee steht dort mit Fußnote und ist nicht
mitgezählt). Eine Grenze würde nur Dorfkerne am Stadtrand ziehen. Lichterfelde zählt
in der Spalte Senat über den Ludwig-Beck-Platz (PLZ 12203, Ortsteil Lichterfelde laut
https://berlin.kauperts.de/Strassen/Ludwig-Beck-Platz-12203-Berlin). Einwohner: Amt für Statistik Berlin-Brandenburg,
Statistischer Bericht A I 5 hj 1/26, Tabelle T11, Stand 30.06.2026
(https://download.statistik-berlin-brandenburg.de/7cb89e083c1ea02d/4e03c8e1693a/SB_A01-05-00_2026h01_BE.xlsx).
Zufällig nicht gezogen wurden Friedrichshain-Kreuzberg und Neukölln.

**Spalten:** Fundort = Hauptfundort-Klasse (wo die meisten lokalen Feste stehen).
d.one = Treffer bei destination.one `open-data`, `q=city:"<Ortsteil>"`, Fenster
29.10.2026 bis 28.10.2027, nur Treffer in Berlin gezählt. Senat = Ortsteil hat 2026
mindestens einen Eintrag in der Senatsliste Straßen- und Volksfeste. Fest = am
Hauptfundort ist ein lokales Fest 2026 mit Datum belegt (Belege im Abschnitt
Dorffest-Test und in den Anmerkungen).

| Nr | Ortsteil | Schlüssel | EW | Fundort | CMS/Plattform | Link | Struktur | Fest | Senat | d.one |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Tiergarten | 110000010104 | 16.200 | Nachbarschaftszentrum (Kiez-Zentrum Villa Lützow) | TYPO3, FullCalendar | https://www.kiez-zentrum-villa-luetzow.de/aktuelles/ | JSON nur per POST | nein | nein | 0 |
| 2 | Gesundbrunnen | 110000010106 | 95.369 | Kiezblog (Weddingweiser) | WordPress, ics-calendar, Daten aus Airtable | https://weddingweiser.de/kalender/ | ICS (373 ab 29.10.) | ja | nein | 0 |
| 3 | Blankenburg | 110000030303 | 6.778 | Ortsportal dorfanger-blankenburg.de | eigenes CMS, Google Kalender | https://dorfanger-blankenburg.de/cms/veranstaltungskalender | Google-ICS | ja | nein | 0 |
| 4 | Pankow | 110000030307 | 68.877 | Bezirksamt (Pressemitteilungen) | berlin.de (imperia) | https://www.berlin.de/ba-pankow/aktuelles/pressemitteilungen/2026/ | RSS, Datum im Text | ja | ja | 0 |
| 5 | Blankenfelde | 110000030308 | 2.092 | nirgends belegt | (Stadtgut Blankenfelde e.V., WordPress, seit 2023 still) | https://stadtgut-blankenfelde.de/verein/feste/ | keine Termine | nein | nein | 0 |
| 6 | Buch | 110000030309 | 17.423 | Stadtteilzentrum (Albatros gGmbH) | TYPO3, Monats-PDF | https://albatros.social/angebote/standorte/stadtteilzentrum-buch/ | PDF | nein | nein | 0 |
| 7 | Französisch Buchholz | 110000030310 | 21.969 | Ortsteilverein (Bürgerverein) | WordPress, The Events Calendar leer | https://buergerverein-franzoesisch-buchholz.de/events/ | RSS der Beiträge | ja | nein | 0 |
| 8 | Charlottenburg | 110000040401 | 130.053 | Veranstalterverein (Family & Friends e.V.) | Duda | https://www.family-and-friends-ev.de/blog | RSS, Datum im Titel | ja | ja | 0 |
| 9 | Wilmersdorf | 110000040402 | 100.806 | Bezirksamt (Pressemitteilungen) | berlin.de (imperia) | https://www.berlin.de/ba-charlottenburg-wilmersdorf/aktuelles/pressemitteilungen/2026/ | RSS | nein | nein | 0 |
| 10 | Westend | 110000040405 | 41.274 | Veranstalterverein (Family & Friends e.V.) | Duda | https://www.family-and-friends-ev.de/blog | RSS, Datum im Titel | ja | ja | 0 |
| 11 | Halensee | 110000040407 | 15.933 | Standortgemeinschaft (Westfälische Straße e.V.) | WordPress, Elementor, Post Type `events` | https://diewestfaelische.berlin/veranstaltungen/ | WP-REST ohne Datumsfelder | ja | nein | 0 |
| 12 | Staaken | 110000050504 | 47.523 | Quartiersmanagement Heerstraße Nord | WordPress | https://qm-heerstr-nord.de/aktuelles/ | RSS (nur News) | ja, ohne Festtag | nein | 0 |
| 13 | Kladow | 110000050506 | 16.459 | Gewerbegemeinschaft (GG Havelbogen e.V.) | WordPress, Elementor | https://havelbogen.de/category/termine/ | RSS mit 0 Items | nein | nein | 0 |
| 14 | Hakenfelde | 110000050507 | 36.782 | Stadtteilladen (Gemeinwesenverein Haselhorst) | WordPress, Post Type `offer` | https://gwv-haselhorst.de/gruppen-veranstaltungen-kurse/ | HTML | nein | nein | 0 |
| 15 | Lichterfelde | 110000060602 | 85.020 | Stadtteilzentrum (Stadtteilzentrum Steglitz e.V.) | WordPress, The Events Calendar leer | https://www.stadtteilzentrum-steglitz.de/veranstaltungen/ | TEC-REST, 0 kommende | ja | ja | 0 |
| 16 | Lankwitz | 110000060603 | 44.735 | Stadtteilzentrum (Stadtteilzentrum Steglitz e.V.) | wie Nr. 15 | wie Nr. 15 | wie Nr. 15 | nein | nein | 0 |
| 17 | Schöneberg | 110000070701 | 125.700 | Bezirksamt (Veranstaltungen, Nachbarschafts-Newsletter) | berlin.de | https://www.berlin.de/ba-tempelhof-schoeneberg/aktuelles/veranstaltungen/ | HTML | ja | ja | 0 |
| 18 | Lichtenrade | 110000070706 | 53.002 | Bezirksamt (Lichtermarkt, Newsletter Lichtenrade) | berlin.de | https://www.berlin.de/ba-tempelhof-schoeneberg/aktuelles/veranstaltungen/lichtenrader-lichtermarkt/ | HTML; Lichtermarkt auch im Landeskalender | ja | ja | 0 |
| 19 | Johannisthal | 110000090904 | 23.030 | Bezirksamt (KIEZKLUB Rathaus Johannisthal) | berlin.de | https://www.berlin.de/ba-treptow-koepenick/politik-und-verwaltung/aemter/amt-fuer-soziales/kiezklubs/kiezklub-rathaus-johannisthal/artikel.759849.php | HTML-Monatsprogramm | ja | nein | 0 |
| 20 | Altglienicke | 110000090906 | 34.460 | BENN Altglienicke und Bezirks-Pressemitteilungen | TYPO3; kiezbund.de WordPress + TEC verwaist | https://www.benn-altglienicke.de/ | Feed nicht belegt | ja | ja | 0 |
| 21 | Oberschöneweide | 110000090909 | 25.794 | Kiezverein (SchöneVibes Kollektiv e.V.) | WordPress, Sugar Calendar Lite | https://schoenevibes.de/termine/ | RSS, WP-REST `sc_event` | ja | nein | 0 |
| 22 | Müggelheim | 110000090914 | 6.993 | Heimatverein (Müggelheimer Heimatverein e.V.) | statisches HTML, Google Kalender | https://www.mueggelheimer-heimatverein.de/term_googlecal.shtml | Google-ICS | ja | ja | 0 |
| 23 | Marzahn | 110000101001 | 120.683 | Stadtteilzentrum (Ball e.V.) | WordPress, The Events Calendar | https://ball-ev-berlin.de/?tribe_events_cat=marzahn | TEC-REST, iCal | ja | ja | 0 |
| 24 | Biesdorf | 110000101002 | 31.076 | Stadtteilzentrum (Ball e.V.) | wie Nr. 23 | https://ball-ev-berlin.de/?tribe_events_cat=biesdorf | TEC-REST, iCal | nein | ja | 0 |
| 25 | Friedrichsfelde | 110000111101 | 58.614 | Stadtteilzentrum (pad gGmbH) | WordPress, The Events Calendar | https://stadtteilzentrum-friedrichsfelde.de/aktuelles/#veranstaltungen | TEC-REST, iCal (0 kommende am 29.10.) | ja | nein | 0 |
| 26 | Malchow | 110000111106 | 612 | Naturschutzverein über Umweltkalender Berlin | Joomla, iframe aus umweltkalender-berlin.de | https://www.umweltkalender-berlin.de/partner1242/1242,1243/ | HTML | ja | nein | 0 |
| 27 | Neu-Hohenschönhausen | 110000111109 | 59.968 | Stadtteilzentrum (VaV e.V.) | WordPress, WPBakery, The Events Calendar | https://vav-lichtenberg.de/aktuelles/ | iCal, JSON-LD je Termin; REST per robots gesperrt | ja | nein | 0 |
| 28 | Reinickendorf | 110000121201 | 86.136 | Quartiersmanagement Letteplatz | Joomla, DPCalendar | https://www.qm-letteplatz.de/aktuelles/veranstaltungen | Microdata Event (14) | ja | nein | 0 |
| 29 | Wittenau | 110000121209 | 25.773 | BENN Wittenau-Süd | TYPO3, calendarize | https://www.wittenau-sued.de/mitmachen/kalender | HTML (15) | nein | nein | 0 |
| 30 | Borsigwalde | 110000121211 | 7.057 | Stadtteilzentrum (Immanuel Albertinen Diakonie) | TYPO3, Termine per JS aus Träger-API | https://beratung.immanuel.de/unsere-standorte/berlin/borsigwalde | API per robots (`Disallow: /*?`) nicht abrufbar | nein | nein | 0 |

**Anmerkungen (Auswahl, Rohbefunde je Ortsteil in den Abruflisten):**
* Gesundbrunnen: Die vier QM-Gebiete (Badstraße, Brunnenstraße, Soldiner Straße,
  Pankstraße) laufen auf derselben Vorlage mit The Events Calendar Pro, REST, iCal und
  RSS antworteten aber mit 403 (NinjaFirewall). Der Weddingweiser übernimmt QM-Termine
  und hat das größte Einzelangebot der Stichprobe: `https://weddingweiser.de/events.ics`
  mit 688 Terminen vom 29.09.2026 bis 27.01.2027, davon 373 ab 29.10.2026, davon 130
  mit PLZ 13355, 13357 oder 13359 (selbst gezählt in Durchgang A).
* Blankenburg: Das ICS ist ein Gemeinschaftskalender (Kirchengemeinde, SG Blankenburg,
  Jugendfeuerwehr, Freizeitstätte, Netzwerk für Blankenburg), 2.318 Termine, 18
  Einzeltermine ab 29.10.2026. Es enthält auch Termine anderer Ortsteile.
* Müggelheim: Das Google-ICS mischt Feste mit Raumbelegungen (49 von 60 Terminen ab
  29.10. sind Vermietungen oder privat); ein Import bräuchte eine Titelfilterung.
* Kladow, Hakenfelde, Lankwitz: Feste 2026 nur bei festivalsindeutschland.de oder in
  einem inzwischen gelöschten Artikel (berlinecho.de, 410); an den Fundorten nicht
  belegt.
* Borsigwalde: Die Träger-API (`immanuelalbertinen.de/api/v1/eventteaser`,
  `instituteId`) bedient alle Standorte des Trägers, ist per robots.txt aber nicht
  abrufbar.
* Berliner Woche: `www.berliner-woche.de` leitet per 301 auf
  `www.morgenpost.de/berliner-woche/` um; morgenpost.de sperrt anthropic-ai, ClaudeBot
  und Claude-Web per robots.txt. Ob dort Ortsteiltermine stehen, ist nicht belegt.
* Lokalblätter mit Terminteil: Bucher Bote (Joomla, JEvents, Kalender 2026 leer),
  Müggelheimer Bote (nur Monats-PDF).

## Generics

### G1. Landeskalender berlin.de (Ursprung von kulturdaten.berlin)

* **Betreiber:** Land Berlin, Portal berlin.de (Betrieb BerlinOnline GmbH laut
  https://www.berlin.de/wir-ueber-uns/impressum/). Inhalt laut Seite: „Veranstaltungen
  der teilnehmenden Berliner Verwaltungen“ (https://www.berlin.de/land/kalender/index.php).
* **Zugriff:** `https://www.berlin.de/land/kalender/json.php?c=<Kalender>`, offen, ohne
  Key; RSS `index.php?rss&c=22`. `c=22` liefert den Gesamtkalender, `c=6` den Bezirk
  Mitte (165 Veranstaltungen, 164 davon auch in `c=22`), `c=13` Treptow-Köpenick (14,
  alle in `c=22`). robots.txt sperrt nur `/land/kalender/print/` und `qrcode.php`.
* **Menge (selbst gezählt, `c=22`, 29.10.2026):** 1.749 Veranstaltungen, alle mit
  kommendem Termin, 11.432 kommende Termine von 29.10.2026 bis 06.02.2028. Je Bezirk:
  Pankow 253, Steglitz-Zehlendorf 222, Mitte 220, Charlottenburg-Wilmersdorf 186,
  Lichtenberg 166, Tempelhof-Schöneberg 152, Marzahn-Hellersdorf 124,
  Friedrichshain-Kreuzberg 113, Spandau 104, Neukölln 102, Reinickendorf 84,
  Treptow-Köpenick 23. Häufigste Kategorien: Kinder, Jugendliche 492; Freizeit, Sport
  320; Bildung, Schule 319. „Feste, Events“ 95, „Tag der offenen Tür“ 43 (fast nur
  Schulen), „Weihnachtszeit, Jahreswechsel“ 33. 1.362 Veranstaltungen mit Bild, 1.539
  als kostenlos markiert. Der Kalender führt nur künftige Termine: Laut Durchgang A
  werden Einträge nach dem Termin auf das Folgejahr umgeschrieben (Osterfeuer Buch,
  Kulturvolk Sommerfest zeigen 2027), vergangene Ausgaben sind dort nicht belegbar.
* **Felder (echte Antwort):** Wurzel `bezirke`, `kategorien`, `barrierefreiheit`,
  `veranstalter`, `veranstaltungsorte`, `events`. Je Event `event_id`,
  `event_titel_de` (und `_en`, `_fr`, `_ru`, `_tr`), `event_beschreibung_de`,
  `event_veranstalter_id`, `event_veranstaltungsort_id`, `event_email`,
  `event_homepage`, `event_bezirk_id`, `event_datei` (Bild-URL),
  `event_datei_copyright`, `event_last_mod` (Unixzeit), `event_ist_gratis`,
  `event_ist_wochenmarkt`, `event_ist_ueberregional`, `kategorie_ids`, `termine{}` mit
  `tag_von`, `tag_bis`, `uhrzeit_von`, `uhrzeit_bis`, `uhrzeit_von_nutzen`,
  `uhrzeit_bis_nutzen`, `letztes_vorkommen`. Ort: `name`, `strasse`, `hausnummer`,
  `plz`, `ort`, `bezirk_id` (424 von 443 Orten mit PLZ). Keine Koordinaten, kein
  Ortsteil, Zeiten als Wandzeit ohne Zone.
* **Ortsteile der Stichprobe:** Termine mit Ortsteilname in Titel, Ortsname oder
  Straße (Untergrenze): Schöneberg 60, Marzahn 40, Lichtenrade 25, Buch 15 (nur
  Ortsname), Lankwitz 15, Pankow 13, Charlottenburg 6, Biesdorf 4, Tiergarten 3,
  Johannisthal 3, Reinickendorf 3, Wilmersdorf 2, Kladow 2, je 1 Lichterfelde,
  Müggelheim, Malchow, Neu-Hohenschönhausen; 0 in 13 Ortsteilen. Ein lokales Fest
  darunter: nur „48. Lichtenrader Lichtermarkt“ (Lichtenrade).
* **kulturdaten.berlin:** API v2 liefert am 29.10.2026 `totalCount: 12414`
  (`/api/events?startDate=2026-10-29`), Datensätze mit `"origin": "bezirkskalender"`
  und `originObjectID`. Der Harvester `/admin/harvest/baevents-bezirkskalender` liest
  `json.php?c=` für eine Liste von Kalender-IDs (Quellcode, siehe Kurzfazit). Für uns
  ist der direkte Abruf beim Landeskalender die bessere Quelle (Bezirk, Kategorie,
  PLZ, Bild-Copyright in einer Antwort), sofern die Nutzung geklärt ist.
* **Lizenz/AGB:** keine Datenlizenz belegt; der Datensatz steht nicht im Datenregister
  (Suche `kalender`, `termine`, `kulturdaten`: 0 Treffer). Impressum der
  Senatskanzlei: „Die Nutzung der Inhalte ist nur im Rahmen der gesetzlichen
  Bestimmungen zulässig.“ (https://www.berlin.de/rbmskzl/impressum/artikel.15254.php).
  robots.txt von berlin.de erlaubt automatischen Abruf nur mit eindeutiger
  User-Agent-Kennung und unter Beachtung der Regeln (Kopfkommentar der Datei).
* **Bewertung:** eine Integration für alle 12 Bezirke, saubere Felder, aber
  Verwaltungsangebot statt Kiezfeste; Treptow-Köpenick nutzt den Kalender kaum.

### G2. Senatslisten Straßen- und Volksfeste, Weihnachtsmärkte

* **Betreiber:** Senatsverwaltung für Wirtschaft, Energie und Betriebe, Seiten auf
  berlin.de; im Datenregister als „Berliner und Brandenburger Straßen- und Volksfeste“
  (Lizenz `cc-by`, geändert 19.10.2026) und „Berliner und Brandenburger
  Weihnachtsmärkte“ (`cc-by`, geändert 20.11.2025).
* **Zugriff:** `https://www.berlin.de/sen/web/service/maerkte-feste/strassen-volksfeste/index.php/index/all.json?q=`
  und `.../weihnachtsmaerkte/index.php/index/all.json?q=`, offen.
* **Felder (echte Antwort):** Volksfeste `id`, `bezirk`, `bezeichnung`, `strasse`,
  `plz`, `von`, `bis` (TT.MM.JJJJ), `zeit` (Freitext), `veranstalter`, `mail`, `www`,
  `barrierefreiheit`, `bemerkungen`. Weihnachtsmärkte `id`, `bezirk`, `name`,
  `strasse`, `plz_ort`, `von`, `bis`, `oeffnungszeiten`, `veranstalter`, `email`,
  `www`, `barrierefreiheit`, `bemerkungen`.
* **Menge (selbst gezählt):** Volksfeste 77 Einträge, Termine 27.02. bis 14.11.2026, 6
  davon in Brandenburg, 5 enden am oder nach dem 29.10.2026. Veranstalter: Hauptstadt
  Kultur 32, Family & Friends e.V. 9, Kunsthand-Berlin 6. Weihnachtsmärkte 48
  Einträge, alle aus 2025 (01.11. bis 20.12.2025); das Feld `bezirk` mischt Bezirke
  und Ortsteile („Wedding“, „Tegel“, „Friedrichshain“), `von` enthält teils mehrere
  Daten mit Zeilenumbruch.
* **Ortsteile der Stichprobe mit Eintrag 2026:** 10 von 30 (Pankow, Charlottenburg,
  Westend, Lichterfelde, Schöneberg, Lichtenrade, Altglienicke, Müggelheim, Marzahn,
  Biesdorf).
* **Lizenz:** CC BY laut Datenregister, also mit Namensnennung nutzbar.
* **Bewertung:** klein, aber sofort nutzbar; erfasst vor allem die von Agenturen
  angemeldeten Straßenfeste, kaum Vereins- und Kirchenfeste.

### G3. Bezirksamtsseiten auf berlin.de

* **Was:** Pressemitteilungen je Bezirk (RSS), Veranstaltungsseiten, Programme der
  bezirklichen Kiezklubs (Treptow-Köpenick: 11 laut Pressemitteilung 2025,
  Durchgang B), Nachbarschafts-Newsletter (Tempelhof-Schöneberg: 7 Nachbarschaften,
  HTML-Archiv ohne RSS), Portal „Hallo Kiez“ (berlin.de/stk-mitte, zehn
  Stadtteilkoordinationen in Mitte).
* **Stichprobe:** Hauptfundort in 5 von 30 (Pankow, Wilmersdorf, Schöneberg,
  Lichtenrade, Johannisthal); ein Fest 2026 mit Datum ist dort belegt für 6 von 30
  (Pankow, Schöneberg, Lichtenrade, Johannisthal, Altglienicke, Wittenau).
* **Zugriff:** HTML und RSS auf berlin.de, einheitliches Seitengerüst (imperia), das
  Festdatum steht aber im Fließtext oder Titel der Mitteilung. Treptow-Köpenick hat
  zusätzlich `.../aktuelles/veranstaltungen/index.php/rss`.
* **Lizenz:** wie G1, nicht belegt.
* **Bewertung:** verlässlich, aber Text statt Daten; nur als Zusatzquelle mit
  Datumserkennung.

### G4. WordPress mit The Events Calendar bei Trägern

* **Stichprobe:** an einem Fundort installiert in 9 von 30 Ortsteilen (Gesundbrunnen,
  Französisch Buchholz, Lichterfelde, Lankwitz, Altglienicke, Marzahn, Biesdorf,
  Friedrichsfelde, Neu-Hohenschönhausen). Mit kommenden Terminen am 29.10.2026: Ball
  e.V. (eine Instanz mit Ortsteil-Kategorien, 889 kommende Termine trägerweit, selbst
  gezählt in Durchgang C) und VaV e.V. Leer oder verwaist: Stadtteilzentrum Steglitz
  (0 kommende), kiezbund.de (letzter Termin 10.12.2024), Bürgerverein Französisch
  Buchholz (0 Termine 2026), STZ Friedrichsfelde (0 kommende am Abruftag). Gesperrt:
  QM-Vorlage in Gesundbrunnen (403), VaV `/wp-json/` (robots.txt, iCal erlaubt).
* **Zugriff und Felder:** wie in [00-bundesweit.md](00-bundesweit.md) für The Events
  Calendar beschrieben (`/wp-json/tribe/events/v1/events`, `?ical=1`); der Ort je
  Termin erlaubt die Ortsteilzuordnung.
* **Lizenz:** je Website, nicht belegt.
* **Bewertung:** billig über den Plugin-Detektor aus 00-bundesweit, inhaltlich aber
  überwiegend Kurse und Beratung; Feste sind wenige Einträge.

### G5. Öffentliche Google-Kalender als ICS

* **Stichprobe:** 2 von 30 (Blankenburg, Müggelheim), beide Ortsteile mit Dorfkern.
  Zugriff über die öffentliche `basic.ics`-Adresse des eingebetteten Kalenders.
* **Bewertung:** vollständigste Ortsquelle, wo vorhanden, aber gemischter Inhalt
  (Gottesdienste, Training, Raumvermietung) und keine Kategorien; braucht eine
  Titel-Positivliste. Lizenz: je Verein, nicht belegt.

### G6. Träger und Veranstalter mit mehreren Ortsteilen

Belegt aus der Stichprobe: Ball e.V. (Marzahn, Biesdorf), VaV e.V.
(Neu-Hohenschönhausen, Lichtenberg), Stadtteilzentrum Steglitz e.V. (Lichterfelde,
Lankwitz, Steglitz, Marienfelde), Albatros gGmbH (Standortlisten für 13 Bezirke,
Programme als PDF), Gemeinwesenverein Haselhorst (Haselhorst, Hakenfelde), Gemeinwesenverein
Heerstraße Nord (QM, BENN Staaken), Lebenswelt gGmbH (zwei Orte in Reinickendorf),
Immanuel Albertinen Diakonie (zentrale Event-API, gesperrt), Family & Friends e.V.
(Feste in Westend, Charlottenburg, Lichterfelde, Lichtenrade; RSS mit Datum im Titel,
108 Beiträge) und die Agentur Hauptstadt Kultur (32 Einträge der Senatsliste, Website
ohne Termine). Nur Family & Friends liefert für mehrere Ortsteile Feste über einen
einzigen Feed.

### G7. Umweltkalender Berlin

Berlinweite Partnerplattform für Umwelt- und Naturvereine (Grüne Liga, TYPO3,
Partner-URLs `/partner<ID>/`). In der Stichprobe 1 von 30 (Malchow, Martinsbasar
14.11.2026). HTML, kein ICS gefunden, Lizenz nicht belegt.

### Geprüft, für Kieztermine nicht geeignet

* **destination.one `open-data`:** 0 von 30 Ortsteilen, `area:"Berlin"` 1 Event.
* **BerlinOnline-Redaktion (berlin.de/events, berlin.de/weihnachtsmarkt):** 76
  Weihnachtsmarkt-Seiten 2026 (selbst gezählt) mit Kiezmärkten wie „Altglienicker
  Adventsmarkt“ (06.12.2026) und „Lichtermarkt an der Christuskirche Oberschöneweide“;
  Volksfeste nur als Auswahl („Es wird kein Anspruch auf Vollständigkeit erhoben“, RSS
  mit 15 Items). JSON-LD nur rudimentär (`Festival` mit Datum, beim Weihnachtsmarkt
  ohne Datum), Daten im HTML-Block „Auf einen Blick“. Inhalte laut Impressum
  „redaktionell durch die BerlinOnline GmbH gepflegt“ und urheberrechtlich geschützt.
  Nur per Vereinbarung.
* **Planbare Ereignisse im Straßenland (WFS, dl-de-zero-2.0):** 8.541 Einträge mit
  Ortsteil, aber ohne Titel; 8.496 sind Baustellen, 45 „sonstige Ereignisse“ ohne Namen.
* **festivalsindeutschland.de:** in der Stichprobe häufig mit Berliner Festen, aber
  AGB untersagen die Nutzung der Datenbank ([00-bundesweit.md](00-bundesweit.md)); in
  der Stichprobe mehrere falsche Termine (Buchholzer Festtage, Ortsfest Blankenburg)
  und ein Eintrag mit `addressCountry: "ES"`. Nur Lückenliste.
* **Berliner Woche / Morgenpost:** robots.txt sperrt Claude-Agenten, nicht geprüft.
* **visitBerlin:** Veranstaltungstipps ohne Event-JSON-LD auf der Übersicht; Partner
  des DZT-Graphen, Event-Menge ohne Key nicht belegt.
* **Evangelische Kirche Berlin-Brandenburg (EKBO):** nicht unter den fünf Instanzen von
  evangelische-termine.de im Quellenbericht; ob EKBO-Gemeinden einen gemeinsamen
  Kalender haben, ist nicht belegt.

## Dorffest-Test

| Quelle | Festart | Belegtes Beispiel |
|---|---|---|
| G1 Landeskalender | Weihnachtsmarkt | „48. Lichtenrader Lichtermarkt“, 29.11.2026, `event_id` 287458, Kategorien Feste, Events und Weihnachtszeit |
| G1 Landeskalender | Weihnachtsmarkt | „Spandauer Weihnachtsmarkt“, ab 23.11.2026, `event_id` 131989 |
| G1 Landeskalender | Laternenumzug | „Gemeinsamer Laternenumzug durch Marzahn-NordWest“, 11.11.2026, `event_id` 295823 |
| G1 Landeskalender | Feuerwehrfest | kein Treffer für „Feuerwehr“ unter den kommenden Terminen |
| G2 Senatsliste Volksfeste | Dorf-/Angerfest | „Müggelheimer Angerfest“ 05.06.2026 (`id` 86), „Buckower Dorfangerfest“ 10.07.2026 (`id` 98) |
| G2 Senatsliste Volksfeste | Weinfest | „39. Wein- und Winzerfest rund um den Lichtenrader Dorfteich“, 11.09.2026 (`id` 158) |
| G2 Senatsliste Weihnachtsmärkte | Weihnachtsmarkt | „27. Alt-Kaulsdorfer Weihnachtsmarkt“, 06.12.2025; „Adventsbasar im Lübarser Pfarrgarten“, 30.11.2025 (Ausgabe 2025) |
| G3 Bezirksamt | Stadtteilfest | „Fest an der Panke“, 12. und 13.09.2026, https://www.berlin.de/ba-pankow/aktuelles/pressemitteilungen/2026/pressemitteilung.1711804.php |
| G3 Bezirksamt | Kiezfest | „Kiezfest Nahariyastraße“, 05.06.2026, https://www.berlin.de/ba-tempelhof-schoeneberg/aktuelles/newsletter/newsletter-fuer-ihre-nachbarschaft/newsletter-lichtenrade/newsletter.1676479.php |
| G4 The Events Calendar | Stadtteilfest | „Oktoberfest an der Südspitze“, 09.10.2026 (Ball e.V., Marzahn) |
| G5 Google-ICS | Dorffest | „Fest auf dem Dorfanger / Ortsfest“ 11. bis 13.09.2026 und „Kirchweihfest“ 21.06.2026 (Blankenburg) |
| G5 Google-ICS | Weihnachtsmarkt | Adventsmarkt Müggelheim, 28.11.2026 (Heimatverein) |
| G6 Family & Friends (RSS) | Straßenfest | „Sommerfest in der Leonhardtstraße“, 22.08.2026, https://www.family-and-friends-ev.de/22-august-sommerfest-in-der-leonhardtstrasse |
| G7 Umweltkalender | Martinsmarkt | Martinsbasar, 14.11.2026, Naturhof Malchow |
| Weddingweiser (ICS) | Stadtteilfest | „Stadt Land Panke Festival“, 12.09.2026, https://weddingweiser.de/das-sind-die-highlights-beim-stadt-land-panke-festival/ |
| QM Letteplatz (DPCalendar) | Kiezfest | „Lettefest“, 18.09.2026, https://www.qm-letteplatz.de/aktuelles/neues-aus-dem-kiez/bunt-lebendig-und-froehlich-das-lettefest-2026 |
| destination.one | alle | kein Berliner Treffer |
| Feuerwehr (alle Quellen) | Tag der offenen Tür | in keiner Quelle für 2026 belegt; die Jugendfeuerwehr Blankenburg steht nur mit Übungsabenden im Blankenburger ICS |

## Abgleich destination.one

`https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&startdate=10/29/2026&enddate=10/28/2027&q=city:"<Ortsteil>"`
für alle 30 Ortsteile: 0 Treffer in Berlin. Namensgleiche Orte außerhalb (Blankenburg
(Harz) 21, Buch am Wald 3) zählen nicht. `q=area:"Berlin"` liefert 1 Event,
`q=city:"Berlin"` 32, davon 31 in Brandenburg („Neuenhagen bei Berlin“, „Bernau bei
Berlin“). Ergebnis: 0 von 30 = 0 %.

## Abdeckung (nur Stichprobenanteil)

Formel: Anteil = Ortsteile mit Merkmal / 30.

| Merkmal | Ortsteile | Anteil |
|---|---|---|
| destination.one mit Treffer | 0 | 0 % |
| Landeskalender (G1) mit kommendem lokalem Fest | 1 | 3 % |
| Senatsliste Volksfeste 2026 (G2) mit Eintrag | 10 | 33 % |
| Fest 2026 auf Bezirksamtsseiten (G3) belegt | 6 | 20 % |
| Hauptfundort mit Terminen in fester Struktur (ICS, TEC, Microdata, JSON-LD): Gesundbrunnen, Blankenburg, Oberschöneweide, Müggelheim, Marzahn, Biesdorf, Friedrichsfelde, Neu-Hohenschönhausen, Reinickendorf | 9 | 30 % |
| Fest 2026 am Hauptfundort belegt | 20 | 67 % |
| Fest 2026 irgendwo belegt (ohne festivalsindeutschland) | 23 | 77 % |
| G1 oder G2 (beide stadtweit) mit lokalem Fest | 10 | 33 % |

Die Stichprobe fällt in den Oktober: Der Landeskalender zeigt nur künftige Termine,
Sommerfeste sind dort deshalb nicht messbar. Die Senatsliste ist die einzige Quelle
mit dem ganzen Jahr.

## Priorisierte Integrationsliste Berlin

| # | Integration | Zugriff | Ortsteile (Stichprobe) | Datenqualität | Rechtslage | Nächster Schritt |
|---|---|---|---|---|---|---|
| 1 | Senatsliste Straßen- und Volksfeste plus Weihnachtsmärkte (G2) | JSON, offen | 10 von 30 | Datum, Straße, PLZ, Veranstalter, Freitextzeit; Brandenburg-Zeilen filtern | CC BY | Mini-Importer mit Namensnennung; Weihnachtsmärkte ab Aktualisierung (Datenregister zuletzt 20.11.2025) |
| 2 | Landeskalender berlin.de (G1), statt kulturdaten.berlin | JSON, offen | 1 von 30 mit Fest, Termine in 17 | sehr gut strukturiert; Inhalt Verwaltung und Bibliotheken; Kategorie „Feste, Events“ als Filter | nicht belegt | Nutzungserlaubnis beim Land Berlin anfragen (durch den User), dabei die Kalender-IDs der Bezirke erfragen |
| 3 | Registry Berliner Kiezfundorte mit Plugin-Detektor (G4, G5, DPCalendar, calendarize) | TEC-REST, iCal, ICS, Microdata | 9 von 30 strukturiert | gemischt, viel Kursprogramm; Titelfilter nötig | je Website, nicht belegt | Liste der Stadtteilzentren, QM-Gebiete und BENN-Standorte zusammenstellen, Detektor aus 00-bundesweit darüber laufen lassen; calendarize über `calendarize-card.ts` |
| 4 | Einzelfeeds mit Mehrfachwirkung: Weddingweiser-ICS, Family & Friends-RSS | ICS, RSS | 2 bzw. 4 Ortsteile (Gesundbrunnen; Charlottenburg, Westend, Lichterfelde, Lichtenrade) | ICS gut; RSS mit Datum nur im Titel | nicht belegt | Erlaubnis bei den Betreibern anfragen (durch den User), sonst nur als Registry-Einträge |
| 5 | Bezirksamts-Pressemitteilungen (G3) | RSS je Bezirk | 6 von 30 | Datum im Fließtext | nicht belegt, wie G1 | zusammen mit Nr. 2 anfragen; nur als Ergänzung mit Datumserkennung |
| 6 | BerlinOnline-Weihnachtsmarktredaktion | HTML | Kiezmärkte in mehreren Ortsteilen | gut gepflegt, Felder im HTML | urheberrechtlich geschützt | nur per Vereinbarung mit BerlinOnline (durch den User) |

**Lücken:**
* Feuerwehr-Tage der offenen Tür: keine Quelle; in Berlin gibt es Freiwillige
  Feuerwehren (laut Suche z. B. Blankenfelde, Wittenau, Heiligensee), aber keine
  zentrale Terminliste. Nicht weiter belegt.
* Kirchengemeinden: Kirchweih- und Gemeindefeste stehen nur in Ortskalendern wie
  Blankenburg; ein EKBO-Kalender ist nicht belegt.
* Ortsteile ohne aktive Website (Blankenfelde, Buch, Tiergarten) und mit Festen nur
  in gelöschten Artikeln (Kladow, Hakenfelde, Lankwitz).
* Berliner Woche: durch robots.txt nicht prüfbar.
* Ortsteilzuordnung: Keine stadtweite Quelle liefert den Ortsteil. Die Zuordnung
  ginge über Venue-Adresse und die ALKIS-Ortsteilflächen (dl-de-zero-2.0); das gehört
  in das Stammdaten-Epic für Deutschland, nicht in dieses Ticket.

## Anfragen

Vollständige Liste mit Statuscodes und Regelabweichungen:
[14-berlin-anfragen.md](14-berlin-anfragen.md).
