# DE-Adapter cEasy (fn-29.15, Prüfstand 2026-10-30)

cEasy ist das kommunale CMS der hitcom new media GmbH, Veranstaltungsmodul `cVeka`.
Der Adapter `de-ceasy` (`src/lib/scrapers/de/CeasyDeScraper.ts`, Parser `ceasy.ts`)
liest die Trefferliste des Moduls für alle Registry-Einträge mit Merkmal `ceasy`
(102 Gemeinden, 98 mit URL, je Website eine Gemeinde; 92 in Baden-Württemberg). Er
steht in `DE_SCRAPERS`, nicht im Nachtlauf (fn-29.18). Abrufe über
`BaseScraper.fetchHtml`, robots.txt je Website, mindestens 1 s Pause. Teil von
fn-29.15 (kleinere Hersteller); cmcitymedia entfällt dort (Lizenz nötig).

## Befunde und Umsetzung

| Befund | Beleg | Umsetzung |
|---|---|---|
| Zwei Darstellungen derselben Daten | Kasten `cVeka_box_*` (Weil im Schönbuch, Jettingen), Streifen `cVeka_stripes_*` mit `useXsl=STRIPES` (Schwaikheim, Bollschweil, Denkingen) | beide gelesen |
| Liste trägt Titel, Termin-ID, Datum, Uhrzeit, Ort, Veranstalter, Anrisstext, Vorschaubild; die Detailseite trägt dasselbe als JSON-LD | Weil im Schönbuch „Hobbykünstlermarkt“: JSON-LD `startDate 2027-11-07T11:00`, Liste 11:00 bis 17:00 Uhr | nur Listenseiten; Stichprobe gegen das JSON-LD geprüft |
| Uhrzeit ist Freitext | „mittwochs von 09.00-11.00 Uhr und donnerstags …“, „Gruppe A: 09:00 Uhr“, „Uhrzeit wird noch bekannt gegeben!“, „18:30 UhrEinlass ab 17:45 Uhr“ (Auswertung aller Listen der 98 Seiten) | Uhrzeit nur, wenn die Zeile mit ihr beginnt (auch „ab“, „von“, „um“, „ca.“), sonst ganztägig |
| Jahr zweistellig, mehrtägig mit beiden Daten | „Sa., 31.10.26“; Kirchheim unter Teck „Fr., 30.10.26 - Mo., 02.11.26“ | `20JJ`; mehrtägig ganztägig bis zum letzten Tag |
| Ort mit Adresse in eigenen Zeilen oder hinter Komma | Schwaikheim „Begegnungsstätte / Kirchgasse 1 / 71409 Schwaikheim“; Weinstadt „Weingut Knauß, Nolten 2, 71384 Weinstadt“ | Name, Straße, PLZ und Ort getrennt; die Adresse geht in den Resolver |
| Mailadresse im Feld Veranstalter | Denkingen „mediathek(at)denkingen.de“ | kein Veranstalter |
| Folgeseiten 5 bis 20 Treffer je Seite | Bollschweil `limit=5`, Jettingen `limit=8` | „nächste Seite“ mit `limit=50`; der Server rechnet `offset` weiter, Termine über die ID einmal; höchstens 20 Folgeseiten |
| Registry nennt oft eine Unterseite ohne Liste | Giengen „Veranstaltungsraeme-mieten“, Oberkochen „Auszeichnungen-und-Ehrungen“, Bückeburg „Veranstaltungen“ | Kalender aus den Termin-Links der Seite (`…/Veranstaltungskalender/Veranstaltung?…&id=N` → `…/Veranstaltungskalender`), sonst genau ein Link „…/Veranstaltungskalender“ |

Ohne Liste blieben 12 Registry-Seiten (Bad Urach, Hechingen, Herrsching, Holzkirchen,
Meßkirch, Oberkochen, Römerstein, Rottweil, Schongau, Tuttlingen,
Höhenkirchen-Siegertsbrunn u. a.: Kalender als Kachel- oder Monatsansicht oder auf
einer anderen Plattform), 1 von robots.txt gesperrt (Freudenstadt „Kinos“), 1 nicht
lesbar. Reutlingen hat mehr als 20 Folgeseiten; die Liste beginnt heute, spätere
Termine rücken in den folgenden Nächten nach.

`source_id` = `ceasy-<Host>-<Termin-ID>` (die ID gilt je Termin, auch bei Serien).

## Ergebnis

Geliefert 8.853, verworfen 58 (`start_in_past` 53, `garbage_title` 5), geschrieben
8.795, öffentlich 8.572, Quarantäne 223 (`municipal_service` 137, `start_too_far_ahead`
68, `placeholder_location` 19).

| Prüfung | cEasy | Grenze (AT) |
|---|---|---|
| sichtbare Gemeinde-Dienste | 0 | 0 |
| Müll-Titel | 0,0 % | 0,1 % |
| ohne Uhrzeit | 12,6 % | 61,1 % |
| sichtbar ohne Koordinaten | 0,0 % | 0,1 % |
| Dubletten in der Quelle | 0,1 % | 1,1 % |

Stichprobe (30 öffentliche Zeilen) gegen das JSON-LD der Detailseiten: 30 von 30 Titel,
Datum, Uhrzeit und Gemeinde korrekt (auch ganztägig: „Vereinsabend mit Fachvortrag“
Herrenberg, „Sonntagsskikurs“ Oberhaching; „Stäffelestour Quer durch Stuttgart“ aus
Weinstadt liegt in Stuttgart).

## Dorffest-Probe gegen die Quellseite

| Termin | Adapter | Quellseite (JSON-LD) |
|---|---|---|
| Strandfest der Musikkapelle Bodman | 11.07.2027 11:00, Uferanlagen Bodman, Bodman-Ludwigshafen | `2027-07-11T11:00`, Uferanlagen Bodman, Bodman-Ludwigshafen |
| Hornberger Bärenmarkt | 20.11.2026 13:00, Bärenplatz, Hornberg | `2026-11-20T13:00`, Bärenplatz, Hornberg |

## Offen

* Öffentliche Sitzungen (Gemeinderat, Ortschaftsrat, Ausschüsse) bleiben wie in
  Österreich sichtbar; Entscheidung offen (gilt für AT und DE gemeinsam).
* Die 12 Kalender in Kachel- oder Monatsansicht liest der Adapter nicht.
