# Falsche Veranstaltungsorte: Ursachenanalyse und Sanierungsplan

Stand: 2026-09-13, gemessen direkt auf der Prod-DB (Hetzner, `/opt/supabase`),
Grundmenge: 82.405 veröffentlichte künftige Events (`publish_status='published'`,
`start_date >= now()`).

## 1. Kurzfassung

Die falschen Ortsnamen entstehen nicht in den Scrapern, sondern im
**Location-Normalizer** (`src/lib/location-normalizer.ts`) und werden vom
Schreibpfad (`src/lib/db/supabase-sync.ts`) in `location_name` geschrieben.
Der Normalizer sucht in einem GeoNames-Verzeichnis nach *irgendeinem* Wort des
Veranstaltungsortes, das zufällig auch ein Dorf ist, und ersetzt dann den
Ortsnamen durch dieses Dorf: "Haus der Frau" (Linz) wird zu "Haus im Ennstal",
"Martin-Luther-Kirche" (Linz) zu "Hirschegg", "Theater in der Innenstadt"
(Linz) zu "Theater an der Wien", "Franz-Haas-Platz" (Wien) zu "Galtür".
Vier weitere Defekte verstärken das: das GeoNames-Verzeichnis hat
für 59 % der Einträge das **falsche Bundesland** (Mapping-Fehler seit dem
ersten Commit), die PLZ wird aus der falschen Koordinate zurückgerechnet, ein
nächtlicher Lauf normalisiert **alle** Events jede Nacht erneut, und ein
DB-Trigger zementiert die falsche Koordinate per "Master-Koordinate" selbst
dann, wenn der Freigabevertrag sie gerade verworfen hat.

Eventim ist **nicht** verschont: 7.131 der 14.502 österreichischen
Eventim-Events (49 %) tragen statt des Feed-Veranstaltungsorts einen nackten
Ortsnamen, 695 davon heißen "Theater an der Wien", obwohl sie in einem anderen
Bezirk stattfinden. Die Koordinaten aus dem Feed sind dort meist noch richtig,
der angezeigte Name nicht.

Die ursprünglichen Scraper-Werte sind in der DB **nicht** mehr vorhanden
(`raw_events` ist leer, keine `location_name_raw`-Spalte). Sie kommen aber
jede Nacht per Re-Scrape wieder herein. Der Bestand heilt sich deshalb
weitgehend selbst, sobald der Schreibpfad die Quelle nicht mehr überschreibt
und die vergifteten Master-Koordinaten weg sind. Der Plan steht in §6 und §7.

## 2. Belegte Beispiele (16 Quellen, 21 Fälle)

Alle Zeilen live abgefragt; `id` ist der Anfang der Event-UUID.

| Quelle | id | Event | Quelle sagt (Adresse) | Wir zeigen | Was passiert ist |
|---|---|---|---|---|---|
| boudicca:linz termine | `ecc396ef` | Tag der offenen Tür im **Haus der Frau** | Volksgartenstraße 18, 4020 Linz | **Haus im Ennstal**, PLZ 8970, Steiermark, Pin in der Steiermark | Wort "Haus" → Dorf "Haus" (D1); PLZ aus der falschen Koordinate (D4); Master-Trigger hält den Pin (D5) |
| oeticket | `bd22715c` | Andreas Ferner, **Haus im Puls** | Neusiedl am See, 7100 | **Haus im Ennstal**, Pin Steiermark | D1 + D5 |
| Eventim (DE) | `03b8a3d4` | Dschungelbuch, Graf-Zeppelin-Haus | Olgastr. 20, 88045 Friedrichshafen | **Haus im Ennstal**, Pin Steiermark, veröffentlicht | D1; deutsche PLZ hat keine Gegenprobe (D9) |
| boudicca:linz termine | `49bf87f6` | Wohlsang Vokalensemble, **Martin-Luther-Kirche** | Johann-Konrad-Vogel-Straße 1, 4020 Linz | **Hirschegg**, PLZ 6991, Vorarlberg | GeoNames-Alternativname "Kirche" für das Dorf Hirschegg (D1b); Quelle per Seitenabruf verifiziert |
| Eventim (AT) | `2276b1f7` | Bolschoi Don Kosaken, Kath. Kirche Strasshof (laut oeticket-Slug) | Pestalozzi Str. 62, 2231 | **Hirschegg** | D1b; "Kath. Kirche Strasshof" reproduziert Hirschegg, der Venue-Schutz greift nur bei "Kirche" am Wortanfang |
| Eventim (AT) | `011a7cd0` | Die Schöne und das Biest, **Tiroler Landestheater** | Rennweg 3, 6020 Innsbruck | **Tirol**, Pin am Landes-Mittelpunkt (47,25/11,33) | Base-Name-Index; Master-Trigger überschreibt sogar die Feed-Koordinate (D5) |
| Eventim (AT) | `009855df` | On the Edge 2026 | Petersplatz 1, 1010 Wien | **Theater an der Wien** | Base-Name-Index "theater" (D1c); 695 Eventim-Events insgesamt |
| Eventim (AT) | `24dffec5` | Filzmaier & Wolf, **Sommerarena Baden** | Arenaweg, 2500 Baden | **Baden** | Wort "Baden" → Stadt Baden; Veranstaltungsort verloren (D1) |
| boudicca:theaterinderinnenstadt | `28a11fd4` | Evil Dead, **Theater in der Innenstadt** | Museumstraße 7a, 4020 Linz | **Theater an der Wien**, PLZ 1010, Wien, Pin Wien | D1c (18 von 18 Events dieser Quelle) |
| gemeinde-registry | `1baa978b` | Striezelspiel, Marktgemeinde **Berg** (NÖ) | Hauptstraße 23, 2413 Berg | **Berg im Drautal**, Kärnten, Pin Kärnten | Bundesland-ID-Mismatch → Bevölkerungs-Fallback (D3) |
| burgenland.info | `ab0bdf89` | Sternwanderung Dreiländereck | Mittereck 19, 8383 St. Martin/Raab | **Berg**, Pin bei Pettenbach OÖ (193 km) | Bundesland-Tausch im GeoNames-Verzeichnis (D2) |
| mozarteum-salzburg | `bd0c0ee9` | Relational Textiles | Salzburg (Stadt) | **Salzburg**, PLZ 5500 Bischofshofen, Pin Landes-Mittelpunkt | Nächster Treffer zum Bundesland-Zentroid ist der ADM1-Eintrag statt der Stadt (D2/D6); 37 von 38 ph-salzburg-Events ebenso |
| boudicca:kupfticket | `9b37511e` | Pitztaler Jazzherbst, Handwerksmühle Ritzenried | Ritzenried 107, 6474 (Tirol) | Name und Pin richtig, aber **PLZ 7535, Burgenland** | PLZ aus einem Text-Treffer zurückgerechnet, obwohl die Scraper-Koordinate behalten wurde (D4) |
| falter | `18a38ba1` | Erik Schmidt, **Galerie Krinzinger** | Seilerstätte 16, 1010 Wien | Pin in **Kärnten** (46,61/13,26), 294 km | Ortswort aus Titel/Beschreibung wird zur Koordinate (D7) |
| gem2go | `171cc258` | Imkerstammtisch, St. Leonhard b. Freistadt (OÖ) | Pfarrgasse 4 | **Schwarz**, Bundesland **Tirol**, Pin Tirol (325 km) | D1 + Bundesland aus falscher Koordinate |
| boudicca:kupfticket | (Ukukha Amanzi) | Kinderkonzert, **Franz-Haas-Platz** | Franz-Haas-Platz, 1110 Wien | **Galtür**, PLZ 6563, Tirol | Alternativname "Platz" für Galtür (D1b), reproduziert; Quelle per JSON-LD verifiziert |
| neusiedlersee.com | `4619add9` | Kidical Mass Eisenstadt, Quelle: "TP: Franz Schubert-Platz" | 7000 Eisenstadt | **Galtür**, Pin Tirol (487 km) | Dasselbe Muster; der heutige Code macht daraus "Platz" (Weiler in Kärnten), die gespeicherte Variante stammt aus einem früheren Nachtlauf über den bereits ersetzten Namen |
| veranstaltungskalender.net | `e1fa3ce8` | Kidical Mass 12.0 Klagenfurt | 9020 Klagenfurt | **Schützen**, Pin NÖ (182 km) | D1 |
| feratel-deskline | `44530c97` | Ökumenischer Berggottesdienst, Gipfelkreuz Hündle (Allgäu, DE) | (keine Adresse) | PLZ **2163**, **Niederösterreich** | Scraper liefert deutsche Feratel-Events als AT; PLZ per Text-Treffer (D4, D10) |
| kultur-graz | `feecc1ae` | Lisz Hirn, Literaturhaus Graz | Elisabethstraße 30, 8010 | location_name "- Literaturhaus  - Lesung/Vortrag", Pin OÖ (208 km) | Scraper schreibt Kategorietext in den Ort (D10), Normalizer findet darin ein Ortswort (D7) |
| mariazell.gv.at | `c3e2c8dc` | Christof Spörk, **Theaterstadl Mariazell** | (Quelle: "Theaterstadl Mariazell") | **Werfen** | Scraper greift falschen Text ab (D10); "Lassen", "Klaus an der Pyhrnbahn" analog |
| meinbezirk | `bafd125a` | After-Work Führung, Innsbruck | (keine Adresse) | **Tirol**, PLZ **8692** (Steiermark) | D1c + D4 |

Für alle Fälle mit bekanntem Quellwert wurde der Normalizer lokal nachgestellt
(`normalizeEventLocation()` mit dem Scraper-Wert) und reproduziert die
Ausgabe deterministisch, z. B.:

```
"Haus der Frau"              → Haus im Ennstal   | normalized | 47.411,13.768 | plz=8970
"Martin-Luther-Kirche"       → Hirschegg         | normalized | 47.348,10.171 | plz=6991
"Franz-Haas-Platz"           → Galtür            | normalized | 46.967,10.183 | plz=6563
"Theater in der Innenstadt"  → Theater an der Wien | normalized | 48.199,16.364 | plz=1010
"Salzburg" (bl=salzburg)     → Salzburg          | normalized | 47.417,13.250 | plz=5500
"Berg" (plz 8383, steiermark)→ Berg              | normalized | 47.933,14.050
"Musikheim Hof"              → Hof               | normalized | 46.967,15.750
"Turnsaal Hall"              → Hall bei Admont
"Kulturhaus Stein"           → Stein an der Donau
"Kleiner Saal"               → Kleiner (Weiler in der Steiermark)
"Stadt Wels"                 → Stadt (Weiler in Kärnten)
"Gasthaus Wagner"            → Name bleibt, Pin aber beim Weiler "Wagner" in Tirol
```

## 3. Ausmaß

| Messgröße | Wert |
|---|---|
| Live-Events, deren `location_name` exakt ein GeoNames-Ortsname ist | 47.257 (57 %) |
| davon mit Straßenadresse (Veranstaltungsort mit hoher Wahrscheinlichkeit verloren) | ~21.000 (Eventim 5.591, gemeinden-generic 5.800, gem2go 3.658, gemeinde-registry 4.145, linz termine 505, landestheater linz 371, kupfticket 344, eventfrog 270, …) |
| Harte, messbare Widersprüche (Name ≠ Pin, Adress-PLZ ≠ Pin oder PLZ-Spalte ≠ Pin, jeweils > 15/25 km) | ~5.500 (Eventim 1.457, gem2go 1.067, gemeinden-generic 917, feratel 559, gemeinde-registry 521, kupfticket 156, meinbezirk 152, linz termine 131, …) |
| Ein Ortsname, der über ≥ 3 Bundesländer verstreut ist (kann kein Ort sein) | 1.630 Events unter 44 Namen: "Haus im Ennstal" 242, "Haus" 242, "Hof bei Salzburg" 96, "Hof" 84, "Riegler" 81, "Hirschegg" 80, "Weg" 65, "Bad" 55, "Stadt" 48, "Galtür" 43, "Rotes Kreuz" 23, "Kleiner" 22, "Wagner" 20, … |
| Eventim AT: nackter Ortsname statt Feed-Venue | 7.131 von 14.502 (49 %); "Theater an der Wien" mit PLZ ≠ 1060: 695 |
| Eventim DE/CH: veröffentlicht mit Pin in Österreich | u. a. "Riegler" (Bremen) 67, "Gasteig" (München) 55, "Bonner Weihnachtscircus" 37, "Haus im Ennstal" 38, "Hof bei Salzburg" (Mainz) 23, "Hall in Tirol" (Köln) 18 |
| Live-Events, deren Pin eine `geonames`-Master-Koordinate ist | 46.230 (56 %) über 2.896 Master-Einträge |
| `location_master_coords` insgesamt / davon Quelle `geonames` | 7.275 / 5.266 (davon 260 `review`); `review` über alle Quellen 422 |
| Pin vorhanden, aber `geocoding_confidence IS NULL` (Trigger hat nach `drop_coordinates` wieder eingesetzt) | 1.982 |
| Adress-PLZ ≠ `postal_code`-Spalte | 2.033 (345 in einem anderen PLZ-Gebiet) |
| `geocoding_confidence`-Verteilung | scraper 60,5 %, verified 13,7 %, normalized 13,5 %, NULL 4,5 %, exact 3,4 %, from_description 1,3 %, from_title 1,2 %, gemeinde-registry 1,1 %, gemini 0,8 % |
| `data/geonames-at.json`: Einträge mit falschem Bundesland | 20.370 von 34.331 (59 %) |
| `PLZ_COORDINATES` (Hint-Tabelle) | 273 von ~2.200 österreichischen PLZ |
| `raw_events` (Rohschicht) | 0 Zeilen; `venue_id` gesetzt bei 102 Live-Events; `venues` hat 312.983 Zeilen mit Koordinaten (ungenutzt) |

Die ~5.500 sind eine Untergrenze: gezählt wurde nur, was sich ohne den
Rohwert widerlegen lässt. Der Verlust des Veranstaltungsortsnamens
(Tabelle Zeile 2) ist um ein Vielfaches größer, aber ohne Rohwert nur
statistisch belegbar.

## 4. Die Kette (wo genau es bricht)

```
Scraper ──ScrapedEvent{location_name, address, plz?, bundesland?, lat?/lng?}──▶ supabase-sync.toSupabaseRow()
                                                                                    │
                                    resolveCoordinates() ──▶ normalizeEventLocation()  ◀── D1 D2 D3 D6 D7
                                         │  "Always update location name if normalizer found a canonical one"
                                         │  locationName = normalized.location_name          ◀── D1 (Namensüberschreibung)
                                         │  postalCode  = normalized.postal_code (pickPlz)  ◀── D4
                                         ▼
                                    scoreAndAdmit()  (drop_coordinates / use_coordinate_region)
                                         ▼
                                    UPSERT events ──▶ BEFORE-Trigger trg_apply_master_coords  ◀── D5
                                                       (setzt lat/lng aus location_master_coords, auch wenn App sie gerade genullt hat)

jede Nacht (scrape-pipeline.ts):
  normalize-locations.ts  → normalizeEventLocation() auf ALLEN Events, schreibt location_name  ◀── D1 nochmal, mit bereits kaputter PLZ
  fix-geocoding.ts        → normalizeEventLocation() → Koordinaten                              ◀── D1/D7
  fix-duplicate-coords.ts → pro (location_name, plz) Master via GeoNames → 'verified'         ◀── D5 (Zirkelschluss)
```

Der Freigabevertrag (`src/lib/quality/admission.ts`, fn-24) prüft nur
Bundesland-Label gegen Koordinate. Er greift nicht, wenn (a) der Scraper kein
Bundesland liefert (kupfticket, Eventim-DE, fueruns), (b) PLZ und Koordinate
beide aus derselben falschen Auflösung stammen (D4) oder (c) er zwar
`drop_coordinates` verhängt, der Trigger die Koordinate aber wieder einsetzt
(D5). `fix-geocoding.ts` erwähnt im Kopf selbst "the old word-matching bug",
behandelt aber nur Symptome, der Wort-Abgleich ist weiter aktiv.

## 5. Die Defekte im Einzelnen

### D1: Wort-für-Wort-Abgleich ersetzt den Veranstaltungsort durch ein Dorf
`normalizeLocation()`, Schritt 3b (`location-normalizer.ts` ~Z. 511 ff.):
Jedes Wort ≥ 3 Zeichen des Ortsnamens wird einzeln gegen den GeoNames-Index
geprüft, der erste Treffer gewinnt, `canonicalName` ist der Dorfname.
`supabase-sync.ts` (`resolveCoordinates`, Kommentar "Always update location
name") schreibt diesen Namen in `location_name`. Die Wortreihenfolge
entscheidet: "Stadt Wels" → "Stadt" (Weiler), weil "stadt" vor "wels" geprüft
wird. Der Venue-Prefix-Schutz (`isVenueName`) kennt "Theater", "Kirche",
"Hotel", aber nicht "Kulturhaus", "Pfarrheim", "Musikheim", "Turnsaal",
"Festplatz", "Volksheim", "Theaterstadl", und schützt ohnehin nur den Namen,
nicht die Koordinate (2b `extractCityFromVenueName` akzeptiert Weiler mit
Bevölkerung 0: "Gasthaus Wagner" → Pin beim Weiler Wagner).

- **D1b, Alternativnamen:** der Index enthält *alle* GeoNames-Alternativnamen
  ohne Sprach- oder Plausibilitätsfilter. Belegt: Hirschegg hat den
  Alternativnamen "Kirche", Galtür "Platz", Riegler "Fritz", Klaus an der
  Pyhrnbahn "Klaus". Schritt 3 zerlegt Namen an Bindestrichen und prüft die
  Teile von hinten: "Martin-Luther-Kirche" → "Kirche" → Hirschegg,
  "Franz-Haas-Platz" → "Platz" → Galtür. Damit werden Kirchen zu Hirschegg
  (80 Live-Events aus 10 Quellen) und Plätze zu Galtür (43 Events).
- **D1c, Base-Name-Index:** Namen werden zusätzlich ohne geografischen Zusatz
  indiziert ("Theater an der Wien" → "theater", "Haus im Ennstal" → "haus").
  Schritt 3 (Compound-Parts) streift bei "Theater in der Innenstadt" die
  Endung " in der Innenstadt" ab, sucht "theater" und findet das Theater an
  der Wien. Betroffen: jedes "Theater …", jedes "Haus …".
- Seit: 2026-04-04 (`f5f47e6`, `048c218`), nächtlich auf allen Events seit
  2026-04-10 (`6eb784b`).

### D2: GeoNames-Verzeichnis mit vertauschten Bundesländern
`src/scripts/build-geonames-db.ts`, `ADMIN1_MAP`: `04 → Steiermark`,
`05 → Tirol`, `06 → Oberösterreich`, `07 → Salzburg`. Richtig ist nach
GeoNames `04 = Oberösterreich, 05 = Salzburg, 06 = Steiermark, 07 = Tirol`.
Belegt an der Datei: Graz steht unter "Oberösterreich", Linz unter
"Steiermark", Innsbruck unter "Salzburg", Salzburg unter "Tirol". Folge in
`disambiguate()`: Der Bundesland-Filter wählt bei mehrdeutigen Namen genau die
Kandidaten aus dem *falschen* Bundesland ("Berg" für ein Steiermark-Event →
Weiler bei Pettenbach OÖ; "Pichling" für Linz → Pichling bei Köflach). Seit
dem ersten Commit (`11aae5f`, 2026-04-03).

### D3: Bundesland-IDs passen nicht zusammen
Die DB und `bundeslandToId()` verwenden `oberoesterreich`, `niederoesterreich`,
`kaernten`. Der Normalizer vergleicht per `includes()` gegen die
JSON-Schreibweise `Oberösterreich`, `Niederösterreich`, `Kärnten` und die
`BL_CENTROIDS`-Tabelle kennt nur `oberösterreich`/`oberosterreich`. Für drei
Bundesländer gibt es damit weder Filter noch Hint; `disambiguate()` fällt auf
"größte Bevölkerung irgendwo in Österreich" zurück. Genau so wird die
Marktgemeinde Berg (NÖ) zu "Berg im Drautal".

### D4: PLZ, Bundesland und Bezirk werden aus der falschen Koordinate abgeleitet
`pickPlz()` → `resolveNearestGemeindePlz(lat, lng)`: Liefert der Scraper keine
PLZ, wird sie aus der Koordinate des GeoNames-Treffers zurückgerechnet, und
zwar auch dann, wenn die Koordinate gar nicht übernommen wird ("PLZ is
orthogonal to coord confidence", `resolveCoordinates`). Aus der PLZ folgen
`bundesland` (Freigabevertrag) und `district` (`districtFromPlz`). Der
Datensatz ist danach in sich konsistent falsch, und der Freigabevertrag kann
den Widerspruch nicht mehr sehen. Belegt: kupfticket Ritzenried (Pin richtig,
PLZ 7535/Burgenland), Feratel Allgäu (PLZ 2163/NÖ). Die Hint-Tabelle
`PLZ_COORDINATES` kennt nur 273 PLZ, ländliche PLZ liefern also nie einen
Hint und `extractPostalCodeFromText` verwirft sie.

### D5: Master-Koordinaten und Trigger zementieren den Fehler
`fix-duplicate-coords.ts` bildet pro `(location_name, postal_code)` eine
"verifizierte" Master-Koordinate; Stufe 4 der Lookup-Kette ist wieder
`normalizeEventLocation()` mit dem bereits ersetzten Namen. Die Validierung
"≤ 100 km zum Cluster-Schwerpunkt" vergleicht gegen Koordinaten, die aus
demselben Fehler stammen (Zirkelschluss). 5.266 der 7.275 Master sind so
entstanden; 46.230 Live-Events liegen auf ihnen. Der Trigger
`trg_apply_master_coords` (BEFORE INSERT OR UPDATE OF location_name,
postal_code, latitude, longitude) setzt die Master-Koordinate, ohne
`geocoding_confidence` anzufassen. Wenn der Freigabevertrag `drop_coordinates`
verhängt (App schreibt lat/lng = NULL), füllt der Trigger sie wieder auf:
1.982 Live-Events mit Pin, aber `geocoding_confidence IS NULL`. Belegt:
Eventim "Ambach" Götzis → Pin in NÖ (456 km), Tiroler Landestheater → Pin am
Tirol-Zentroid trotz Feed-Koordinate.

### D6: Landes-Mittelpunkt schlägt Stadt
`getHint()` nutzt den geografischen Bundesland-Mittelpunkt; `disambiguate()`
nimmt den *nächsten* Kandidaten zum Hint. Für "Salzburg" liegt der
ADM1-Eintrag (Land, 47,42/13,25) näher am Hint als die Stadt (47,80/13,04).
Ergebnis: Salzburg-Stadt-Events ohne PLZ landen bei Bischofshofen (PLZ 5500).
Analog "Tirol" für das Tiroler Landestheater.

### D7: Ortswörter aus Titel und Beschreibung werden Koordinaten
`extractPlaceFromText()` (Stufen 3/4) liefert `from_title` /
`from_description` (2.046 Live-Events) und überschreibt bei Venue-Namen sogar
mit Label `normalized`. Falter-Events mit vollständiger Wiener Adresse (die
Adress-Stufe scheitert, weil ohne Komma und PLZ keine "Stadt" extrahiert wird)
bekommen Pins in Vorarlberg, Tirol oder Kärnten aus einem Wort der
Beschreibung.

### D8: Der Rohwert wird nirgends aufbewahrt
`raw_events` ist leer, `normalized_event_candidates` ebenso; es gibt keine
`location_name_raw`-Spalte. Jeder Upsert schreibt `resolved.locationName`. Der
Originalname ist nur durch Re-Scrape rekonstruierbar. Zusätzlich fließen Name
und PLZ in den unveränderlichen `slug` und den URL-Präfix
(`/events/{plz}-{ort}/{datum}/{slug}`): `…-haus-im-ennstal`,
`…-berg-im-drautal` stehen jetzt in indexierten URLs.

### D9: Ausland
`getBundeslandFromPLZ()` mappt fünfstellige deutsche PLZ nach erster Ziffer
(89231 → steiermark); der Freigabevertrag prüft `coords_outside_declared_country`
nur für `country='AT'`. Eventim-DE-Events, deren Venue per D1 eine
österreichische Koordinate bekommt, sind damit publiziert und sichtbar
(Riegler/Bremen 67, Gasteig/München 55, …). Feratel liefert Allgäu-Events
(Steibis, Thalkirchdorf) mit `bundesland` aus der Regions-Konfiguration als AT.

### D10: Scraper-seitige Fehler (klein, aber echt)
- `KulturGrazScraper`: nimmt den ersten "passenden" Textblock als Ort, dadurch
  Kategorietexte und Foto-Credits in `location_name` (52 von 315 Events
  auffällig).
- `MariazellScraper` (mariazell.gv.at): "Text nach `<br>` im Datums-Absatz"
  ist oft Fließtext ("Werfen Sie…", "Lassen Sie…") oder der Künstlername
  ("Klaus …"); der Normalizer macht daraus Werfen, Lassen, Klaus an der
  Pyhrnbahn.
- `MeinBezirkScraper`: ohne Venue-Element bleibt das Bundesland als Ort
  ("Tirol"), plus PLZ 8692 aus D4.
- `FeratelScraper`: deutsche Regionen im Feed werden als AT importiert.

## 6. Nachhaltige Lösung

Leitsatz: **Der Name kommt von der Quelle und wird nie ersetzt. Koordinaten
kommen aus Adresse + PLZ oder aus einem Venue-Register, nie aus dem Raten
über Wörter.** GeoNames darf nur noch eine Frage beantworten: "Welche
Gemeinde ist mit diesem *Stadtnamen* gemeint?" (für Hub-Zuordnung), mit
PLZ/Bundesland-Sperre.

### Stufe 1: Blutung stoppen (1 Tag, ohne Architekturänderung)

1. `supabase-sync.ts`, `resolveCoordinates()`: `locationName` bleibt
   `event.location_name`. Der kanonische Gemeindename wandert, falls gewünscht,
   in ein eigenes Feld (`place_name`), nie in `location_name`.
2. `pickPlz()`-Backfill nur noch, wenn die Koordinate selbst übernommen wurde
   **und** aus Scraper/Registry stammt. Keine PLZ aus Text- oder Namenstreffern.
3. `scrape-pipeline.ts`: den `normalize`-Schritt (`normalize-locations.ts`,
   Kopfkommentar "One-time migration") aus dem Nachtlauf nehmen.
4. `fix-duplicate-coords.ts`: Stufe "GeoNames" aus der Lookup-Kette streichen;
   `classifyResult` gegen die **Adress-PLZ** statt gegen bestehende
   Event-Koordinaten prüfen. Alle Master mit `source='geonames'` sowie
   `confidence='review'` löschen (5.428 Zeilen).
5. Trigger `apply_master_coords()`: nicht feuern, wenn die App bewusst
   `latitude IS NULL AND geocoding_confidence IS NULL` schreibt (Ergebnis des
   Freigabevertrags), und beim Setzen `geocoding_confidence='master'`
   mitschreiben, damit die Herkunft sichtbar bleibt. Mittelfristig den Trigger
   ganz durch die App-seitige Auflösung ersetzen (ein BEFORE-Trigger, der
   Fachentscheidungen kippt, ist nicht debugbar; genau das hat D5 verursacht).
6. `build-geonames-db.ts`: `ADMIN1_MAP` korrigieren, `geonames-at.json` neu
   bauen; Alternativnamen nur übernehmen, wenn sie sich vom Namen nur durch
   Diakritika/Transliteration unterscheiden (kein "Kirche", "Platz", "Fritz").
7. Normalizer: Bundesland überall über `bundeslandToId()` vergleichen;
   Schritt 3b (Wort-für-Wort) und den Base-Name-Index für `location_name`
   entfernen; Titel/Beschreibungs-Extraktion (`from_title`,
   `from_description`) nicht mehr als Koordinatenquelle verwenden;
   `extractCityFromVenueName` nur Gemeinden (Registry), keine Weiler.
8. Regressionstests aus den 20 realen Fällen dieses Berichts (Haus der Frau
   bleibt Haus der Frau; Kirche St. Andrä ≠ Hirschegg; Theater in der
   Innenstadt ≠ Theater an der Wien; "Salzburg" = Stadt; Berg/8383 nicht in
   OÖ; Ritzenried behält PLZ 6474).

### Stufe 2: Ortsauflösung neu bauen (3 bis 5 Tage)

Ein `resolveEventLocation()` mit expliziten Stufen und gespeicherter Herkunft:

| Stufe | Quelle | Bedingung | confidence |
|---|---|---|---|
| 0 | Scraper-Koordinate | im Land plausibel; falls Adress-PLZ bekannt: ≤ 30 km vom Gemeinde-Zentroid, sonst abwerten | `scraper` |
| 1 | `venues` + `venue_aliases` (312 k Einträge, heute 102 Verknüpfungen) | `name_normalized` + PLZ oder Stadt stimmen | `venue` (+ `venue_id`) |
| 2 | Strukturiertes Geocoding der **Adresse** (Straße + PLZ + Ort), Nominatim structured / `geocode_cache`, Nachtbudget | Adresse mit Straße vorhanden | `address` |
| 3 | Gemeinde-Zentroid aus PLZ (vollständige PLZ→Gemeinde-Tabelle statt 273 Einträge) | PLZ vom Scraper oder aus der Adresse | `gemeinde-centroid` (UI: "Ortsmitte") |
| 4 | Stadtname → Gemeinde via GeoNames/Registry, nur PPL/ADM3 mit Bundesland-Sperre | nur wenn 0 bis 3 leer | `place-name` |

Kein Fallback aus Titel, Beschreibung oder Einzelwörtern. Wer keine Stufe
erreicht, bekommt keine Koordinate und geht nach `needs_review` (das
existiert schon).

Schema: `location_name_raw` und `address_raw` (unverändert vom Scraper),
`place_name` (aufgelöste Gemeinde), `geocoding_input` (was geocodiert wurde).
Damit ist der Rohwert nie wieder weg und jede Koordinate erklärbar.

### Stufe 3: Wächter

- Die drei Audit-Signale aus §3 (Name ≠ Pin, Adress-PLZ ≠ Pin, PLZ-Spalte ≠
  Pin) als Kennzahl in den Pipeline-Report; Schwellwert in den lt-watchdog.
- Konsistenzregel im Freigabevertrag: `postal_code` darf nie aus einer
  Koordinate stammen, deren `confidence` nicht `scraper`/`venue`/`address`
  ist; `country <> 'AT'` schließt österreichische PLZ/Bundesland aus.
- Scraper-Fixes (D10): KulturGraz-Ortsextraktion, Mariazell-Standort, MeinBezirk
  ohne Venue → `location_name = NULL` statt Bundesland, Feratel-Regionen mit
  `country='DE'` überspringen oder als DE kennzeichnen.
- MASTERPLAN §6 Punkt 3 ("GeoNames-Location-Normalizer bleibt") revidieren.

## 7. Bestand hochziehen

Der entscheidende Umstand: Alle Quellen liefern ihre Live-Events **jede
Nacht erneut** (Upsert auf `(source_name, source_id)`). Sobald der
Schreibpfad die Quelle respektiert, stellt der nächste Vollauf den richtigen
Namen für jedes Event wieder her, das noch auf seiner Quelle steht. Was der
Re-Scrape **nicht** von allein heilt: Koordinaten mit gleichem
Confidence-Label (`shouldOverwriteCoords` überschreibt bei gleichem Rang
nicht), abgeleitete PLZ/Bundesland/Bezirk und alles, was der Trigger aus den
Master-Koordinaten wieder einsetzen würde. Deshalb in dieser Reihenfolge:

1. **Sicherung:** Snapshot von `id, location_name, address, postal_code,
   bundesland, district, latitude, longitude, geocoding_*` aller künftigen
   Events nach `data/backups/` (Muster `coord-backup-*.json`), plus Export der
   `location_master_coords`.
2. **Code aus Stufe 1 deployen** (PR auf master, Nachtlauf noch nicht laufen
   lassen).
3. **Master-Koordinaten bereinigen:** `source='geonames'` und
   `confidence='review'` löschen; die übrigen (nominatim/openai/venues/
   known_venues/geocode_cache) behalten, wenn ihre Koordinate ≤ 30 km vom
   Zentroid ihrer PLZ liegt, sonst ebenfalls löschen.
4. **Abgeleitete Felder zurücksetzen** (nur künftige Events):
   - `latitude/longitude/geocoding_confidence/geocoding_source = NULL`, wenn
     `geocoding_confidence IN ('normalized','exact','from_title',
     'from_description','verified','gemini')` **oder** `IS NULL` mit
     gesetzter Koordinate **oder** die Koordinate mit einer gelöschten
     Master-Koordinate identisch ist und > 30 km von der Adress-/PLZ-Gemeinde
     entfernt liegt;
   - `postal_code = NULL`, wenn sie von der Adress-PLZ abweicht oder die
     Quelle nie eine PLZ liefert (kupfticket, linz termine, feratel,
     meinbezirk, gem2go, fueruns, falter) und der Wert nicht in der Adresse
     vorkommt;
   - `bundesland`/`district` werden vom Freigabevertrag bzw. `districtFromPlz`
     beim Upsert neu gesetzt.
5. **Vollständiger Re-Scrape** (alle 10 Shards + Eventim-Import, einmalig
   außerhalb des Zeitplans): stellt `location_name` wieder her, füllt die
   genullten Koordinaten aus Scraper-Koordinaten (Eventim, Feratel, Gemeinde
   mit Koordinaten) und danach über die neue Auflösung (Stufe 2, oder bis
   dahin Adress-Geocoding + PLZ-Zentroid).
6. **Rest ohne Quelle:** Events, die nicht mehr auf ihrer Quelle stehen,
   behalten den degradierten Namen; Koordinate aus Adresse/PLZ, Flag
   `location_degraded=true`; sie laufen mit dem Datum ohnehin aus.
7. **Scoring/Freigabe/Dedup** für die betroffenen IDs neu laufen lassen
   (Eventim-DE-Events verlieren ihren AT-Pin und fallen aus Karte und
   AT-Hubs).
8. **Kontrolle:** Audit-Signale müssen auf nahe 0 fallen, "Ortsname über ≥ 3
   Bundesländer" auf 0; die 19 IDs aus §2 einzeln prüfen.
9. **URLs/SEO (Entscheidung nötig):** `slug` ist bewusst unveränderlich; die
   falschen Namen bleiben im Slug ("…-haus-im-ennstal"). Die PLZ im
   URL-Präfix ändert sich bei der Korrektur; der Catch-all muss alte Präfixe
   per 301 auf die neue URL führen (prüfen, ob die `(slug, datum)`-Suche das
   heute schon abdeckt). Option: Slugs nur für Events regenerieren, die
   jünger als 14 Tage sind und noch nicht in der GSC auftauchen.

Aufwand gesamt: Stufe 1 ein Tag, Backfill eine bis zwei Nächte, Stufe 2 eine
Woche, Scraper-Fixes ein bis zwei Tage.

## 8. Offene Entscheidungen

1. Trigger `trg_apply_master_coords` behalten (mit Guard) oder abschaffen?
   Empfehlung: abschaffen, Master-Tabelle nur noch als Cache der App.
2. Eventim-DE/CH-Events: weiter importieren (mit `country='DE'`, nicht auf
   AT-Karte/Hubs) oder im Import verwerfen?
3. Gemeinde-Events ohne Venue: "Ortsmitte" als Pin mit sichtbarem Hinweis
   (heute stillschweigend) oder keine Koordinate?
4. Slug-Regeneration für junge Events ja/nein.

## Anhang: Messmethode

Direkt per SSH auf der Hetzner-DB (`docker compose exec db psql`), mit
`data/geonames-at.json` und `data/gemeinden-registry/*.json` als temporärem
Schema (`_loc_audit`, nach der Messung wieder gelöscht):

- Signal A: `location_name` ist ein GeoNames-PPL/ADM3-Name und alle Einträge
  dieses Namens liegen > 15 km vom Pin.
- Signal B: Adresse enthält eine vierstellige PLZ aus der Registry, deren
  Zentroid > 25 km vom Pin liegt.
- Signal C: `postal_code`-Zentroid > 25 km vom Pin.
- Streuung: pro `location_name` Anzahl verschiedener `bundesland`-Werte.
- Master-Zuordnung: Join `location_master_coords` über
  `normalize_location_name(location_name)` + `postal_code` und Koordinaten-
  Gleichheit (< 0,0005°).

Normalizer-Nachstellung lokal mit `npx tsx` gegen
`normalizeEventLocation()` aus dem Repo-Stand `2818fbd`.
