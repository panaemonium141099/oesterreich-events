# Start von lasstreffen.de: eine Codebasis, zwei Domains

## Goal & Context
Die DE-Pipeline aus fn-29 läuft: laut Auftrag (Stand 12.11.2026) rund 214.000
DE-Events in der Datenbank, 4.729 von 10.749 deutschen Gemeinden mit kommendem
Termin, DE-Nachtlauf täglich grün. Die Website zeigt Deutschland bewusst nicht
(`SITE_COUNTRY`), und fn-29 schließt den Start von lasstreffen.de ausdrücklich aus
(Boundaries: „Kein Start von lasstreffen.de (Domain, Routing, SEO)“). Dieses Epic
bringt Deutschland online: lasstreffen.de zeigt nur deutsche Events, lasstreffen.at
bleibt unverändert österreichisch.

Leitlinien (verbindlich für jeden Task):
1. **Ein System.** Dieselbe Codebasis, dieselbe Datenbank, dieselben Module. Was
   heute fest österreichisch ist, wird länderfähig. Es entsteht kein zweiter
   Seitenbaum, kein Fork, keine DE-Sonderlogik neben der AT-Logik.
2. **lasstreffen.at darf sich nicht ändern.** Jede Stufe ist für AT ein
   Nullsummen-Umbau: gleiche URLs, gleiche Canonicals, gleiches JSON-LD, gleiche
   Abfragepläne oder bessere. Beleg je Stufe durch Vorher/Nachher-Vergleich.
3. **Keine Vermutungen.** Die Zahlen aus dem Auftrag (214.000, 4.729, 174.000
   kommende DE-Events, Platte 92 bis 95 %) werden im ersten Task gegen Prod
   nachgemessen (`count: 'planned'`, MVs oder indexierte Pfade, nie `count exact`).
4. **Qualität vor Menge.** Auf .de erscheint nur, was der Freigabevertrag
   freigibt und was einen belegten Ort hat. Indexiert wird gestuft (siehe
   Edge Cases, SEO).

### Belegter Ist-Zustand (im Code nachgeprüft am 12.11.2026, Worktree-Stand c52a692c)
1. **Land ist eine Compile-Konstante.** `src/lib/site-country.ts:15`
   (`export const SITE_COUNTRY = 'AT' as const`). 154 Fundstellen in 58 Dateien
   unter `src` ohne Tests (mit Tests 198 in 66). Der Wächter
   `src/__tests__/lib/site-country-guard.test.ts` erzwingt `'AT'` und prüft, dass
   jede Lesestelle auf `events` ein `country` in derselben Anweisung trägt
   (Ausnahmeliste mit Begründung).
2. **DB-Objekte filtern fest auf `'AT'`:** MV `event_map_points`
   (`supabase/migrations/20261006120000_map_points_vienna_days.sql:51`),
   `event_stats_cache` und `event_counts_for_stats`
   (`20261029200200_stats_country_total.sql:34`), sieben Artist-Funktionen
   (`20261008100000_nur_oesterreich_artist_rpcs.sql`: sechs `match_*` plus
   `get_artist_appearances`). Nur `search_event_ids` nimmt Länder als Parameter.
   Es gibt in Prod keinen Index mit `country`: `idx_events_country` wurde am
   2026-07-07 gelöscht (`20260707115800_perf_drop_unused_indexes.sql`), die
   Ersatz-Migration `20261112160000_events_country_indexes.sql` aus PR #467
   (Commit d164b1c6) ist laut Commit-Text noch nicht in Prod ausgeführt.
3. **Kein DE-Ortsmodell für die Ausspielung.** `events.bundesland` (CHECK auf
   neun AT-Länder) und `events.district` (FK) bleiben für DE leer
   (`writesAustrianRegionColumns`, `src/lib/location/ortsdaten.ts:131`). Das Land
   steht nur in `location_resolution.gemeinde.bundesland`, ohne Index; die
   Entscheidung trägt Name, PLZ, Land und Kreisname, aber keinen Schlüssel
   (`LocationDecision.gemeinde`, `src/lib/location/types.ts:91`). `/api/events`
   filtert Regionen über die beiden AT-Spalten (`route.ts:347` bis 359). Hubs
   kennen nur AT (`src/lib/landing-slugs.ts`, `src/lib/gemeinden/data.ts`);
   `src/lib/gemeinden/de.ts` hat keinen Leser in `src/app` (Leser: Resolver,
   DE-Adapter, drei Skripte). Event-URLs: `resolveEventUrlPrefix`
   (`src/lib/utils/slugify.ts`) erkennt nur vierstellige PLZ und fällt für DE auf
   `0000-at` zurück.
4. **Keine Multi-Domain-Logik.** `src/middleware.ts`, `next.config.ts` und
   `src/i18n/routing.ts` haben keine Host-Weiche. „lasstreffen.at“ steht 248-mal
   in 100 Dateien unter `src` ohne Tests und Blog-Inhalte (mit beiden 471 in 294).
   Zentrale Stellen: `SITE_ORIGIN` in `src/lib/site-url.ts:3`, `SITE_URL` in `src/lib/seo/canonical.ts:22`,
   `SITEMAP_BASE_URL` in `src/lib/seo/sitemap-xml.ts:12`, `src/app/robots.ts`,
   `src/app/[locale]/layout.tsx` (metadataBase, OpenGraph `de_AT`, JSON-LD
   `inLanguage: 'de-AT'`, Organization). hreflang fest `de-AT`
   (`bilingualAlternates`), `addressCountry: 'AT'` fest u. a. in
   `aktivitaet/[slug]`, `kuenstler/[slug]`, `venues/[id]`. „Österreich“ steht
   81-mal in `messages/de.json` und in 31 Komponenten und Seiten.
5. **Recht.** `src/app/[locale]/quellen/page.tsx` nennt GeoNames und
   OpenStreetMap, aber weder BKG VG250 (dl-de/by-2-0) noch Destatis, Eventfrog
   oder die deutschen Gemeindekalender. Impressum (§ 5 ECG), AGB
   (österreichisches Recht, Gerichtsstand Eisenstadt, § 14 KSchG) und Datenschutz
   sind auf Österreich geschrieben.
6. **Betrieb.** Ein Hetzner-Server trägt Datenbank, Website-Container und Build
   (`deploy.yml` ruft `/opt/app/deploy.sh`, MASTERPLAN §3.15: der Build bremst
   die Datenbank bis zum Statement-Timeout). Eventfrog-DE läuft ohne Bilder
   (`EVENTFROG_IMAGES: 'off'`, `scrape-events-de.yml:126`).

## Architecture & Data Models

### A. Site-Konfiguration: eine Stelle
Neues Modul `src/lib/site/` (ersetzt `site-country.ts`, das als Re-Export
bestehen bleibt, bis alle Leser umgezogen sind):

```ts
interface SiteConfig {
  country: 'AT' | 'DE';           // Filter jeder öffentlichen events-Abfrage
  domain: string;                 // 'lasstreffen.at' | 'lasstreffen.de'
  url: string;                    // 'https://lasstreffen.at'
  brand: string;                  // 'LassTreffen.at' | 'LassTreffen.de'
  hreflang: 'de-AT' | 'de-DE';
  ogLocale: 'de_AT' | 'de_DE';
  locales: readonly ('de' | 'en')[];
  timeZone: 'Europe/Vienna' | 'Europe/Berlin';
  features: Record<SiteFeature, boolean>;   // siehe C
  legal: { impressum: ...; gerichtsstand: ...; kontakt: ... };  // Inhalt vom Nutzer
}
```

Quelle ist genau eine Umgebungsvariable `SITE_COUNTRY` (Standard `AT`), gelesen
zur **Build-Zeit** und über `next.config.ts` auch dem Client-Bundle mitgegeben.
Je Land entsteht aus demselben Commit ein eigenes Image, je Domain läuft ein
Container. Begründung in „Decision Context“. Kein Modul außerhalb von
`src/lib/site/` kennt eine Domain oder ein Land als Literal; alle 154
`SITE_COUNTRY`-Leser und die Domain-Literale lesen die Konfiguration.

### B. Datenmodell: Regionsspalten für beide Länder
Entscheidung: **eigene Spalten statt JSON-Pfad und statt Aufweichen der
AT-Spalten.** Neue, länderneutrale Spalten auf `events`, vom einen Schreibweg
(`src/lib/db/supabase-sync.ts`) aus der Ortsentscheidung gefüllt:

| Spalte | Inhalt AT | Inhalt DE |
|---|---|---|
| `region_id` text | Bundesland-ID (wie `bundesland`) | Land-ID aus `laender-de.ts` (`bayern`, …) |
| `kreis_key` text | politischer Bezirk (Kennziffer, 3 Stellen) | Kreisschlüssel (5 Stellen, `GemeindeDe.kreisKey`) |
| `gemeinde_key` text | Gemeindekennziffer (5 Stellen) | AGS (8 Stellen) |

Alle drei nullable, ohne CHECK und ohne FK auf AT-Tabellen (ein DE-Wert darf nie
wieder einen Schreib-Batch abweisen, siehe `postgrest_batch_fk_loss`). Gültigkeit
sichern Schreibweg und Wächter-Test gegen die Stammdateien.

- `LocationDecision.gemeinde` bekommt den Schlüssel (`key`) und `kreisKey`
  (Versionssprung der Entscheidung). Für AT liefert ihn
  `src/lib/gemeinden/data.ts`, für DE `src/lib/gemeinden/de.ts`, gewählt über
  `ortsdatenFor(country)`. Keine neue Ortstabelle, keine Kopie der Stammdaten in
  der Datenbank.
- **Leser in diesem Epic:** Die DE-Seite liest nur die neuen Spalten. Die
  AT-Seite liest weiter `bundesland` und `district`. Ein einziger Helfer
  (`regionFilter(site, params)`) weiß, welche Spalte gilt. Der Umzug der
  AT-Leser auf die neuen Spalten ist ein eigener Folgeschritt (Boundaries); die
  Spalten werden für AT ab sofort mitgeschrieben, damit dieser Schritt später
  ohne Backfill geht.
- **Backfill DE (rund 214.000 Zeilen, vorher nachmessen):** rein aus der
  gespeicherten Entscheidung (`location_resolution.gemeinde`: Name, PLZ, Land,
  Kreis) gegen `gemeinden-de.json`, ohne neuen Resolver-Lauf und ohne
  Netzabrufe. Blättern nach id (`forEachPageById`), Schreib-Batches ≤ 500,
  `.in()` ≤ 200, wiederaufsetzbar, nicht während Deploy oder Nachtlauf. Mehrere
  gleichnamige Gemeinden im selben Land ohne passende PLZ bleiben NULL und werden
  gezählt (Bericht als Artefakt), nie geraten. Kein Fix-Skript: der Backfill ist
  dieselbe Ableitung wie im Schreibweg, als Funktion geteilt.
- **Indizes** (eigene Migrationsdatei, `CREATE INDEX CONCURRENTLY` plus `ANALYZE`
  per psql, Muster `20260724121000_poi_activities_indexes.sql`), partiell auf
  veröffentlichte Zeilen: `(country, start_date)` (aus PR #467, dort schon
  vorbereitet), `(country, region_id, start_date)`, `(gemeinde_key, start_date)`,
  `(kreis_key, start_date)`. Vor dem Anlegen: Größenabschätzung gegen den freien
  Plattenplatz (Abschnitt F).

### C. Feature-Matrix je Site
Nicht jede Säule von .at hat DE-Inhalte. `SiteConfig.features` schaltet Routen
und Navigation; eine abgeschaltete Route antwortet 404 und steht in keiner
Sitemap. Vorschlag für den Start (Entscheidung 4 des Nutzers):

| Feature | .at | .de zum Start | Grund |
|---|---|---|---|
| Startseite, /entdecken, Karte, Suche, Event-Detail | an | an | Kern |
| Land-Hubs, Gemeinde-Hubs | an | an | SEO-Kern, aus DE-Stammdaten |
| Bezirk bzw. Kreis-Hubs | an | aus | Stufe 2, erst nach Messung der Gemeinde-Hubs |
| Blog, Festivals, Saison-Guides | an | aus | Inhalte sind österreichisch kuratiert |
| Aktivitäten, OSM-Sektion, Viator, Booking | an | aus | `poi_activities`/`osm_pois` führen nur AT |
| Künstler-Wand, /kuenstler/[slug] | an | aus | Abfragen und RPCs AT-fest, Stufe 2 |
| Studenten, Thema-Hubs | an | aus | AT-Städte und AT-Kuratierung |
| /fuer-firmen, Boost, Tipp des Tages bezahlt | an | aus | Vertragsrecht offen (Entscheidung 2) |
| Login, Merken, Social, Newsletter, Mails | an | aus | Entscheidung 5 |
| /en | an | aus | Übersetzungs-Kontingent (Gemini) ist geteilt |

Die Startseite (fn-30) rendert auf .de nur Sektionen, deren Datenquelle es für
DE gibt (Programm heute, Wochenende, Regionen, Karte); Sektionen ohne Quelle
entfallen, sie bleiben nicht leer stehen.

### D. Ortsmodell auf der Seite (DE)
- **Hubs:** `/[land]` (16 Länder, IDs aus `laender-de.ts`) und
  `/gemeinde/[slug]` aus `gemeinden-de.json`. Slugs wie bei AT zur Laufzeit als
  `{plz}-{name}` (`src/lib/gemeinden/data.ts`), für DE mit der Amts-PLZ; Wächter-Test
  auf Eindeutigkeit über alle Gemeinden.
  `landing-slugs.ts` und die Hub-Loader lesen Länder und Gemeinden über eine
  Schnittstelle je Land (Erweiterung von `ortsdatenFor`), nicht über
  AT-Konstanten.
- **Event-URLs:** `/events/{plz}-{ort}/{datum}/{slug}` gilt auch für DE mit
  fünfstelliger PLZ und dem Post-Ort aus `plz-de.json`. `resolveEventUrlPrefix`
  und der Routen-Parser (`event-detail-loaders.ts`) wählen PLZ-Länge und
  Post-Ort über die Site. Ohne PLZ: Amts-PLZ und Name der Gemeinde aus
  `gemeinde_key`. Ohne Gemeinde: kein `0000-at` und kein Ersatzwert, die Zeile
  ist auf .de nicht indexierbar und steht in keiner Sitemap (sie hat laut
  Freigabevertrag ohnehin keinen belegten Ort, `no_position`).
- **JSON-LD und Texte:** `addressCountry`, `inLanguage`, OpenGraph-Locale und
  alle „Österreich“-Texte kommen aus der Site (Nachrichten-Datei mit
  Site-Platzhaltern oder Überlagerung je Land, eine Technik für alle Texte).

### E. Datenbank-Objekte länderfähig
- `event_map_points`: Spalte `country` in die MV, Region aus `region_id`;
  `event_map_points_payload` je Land eine Zeile; `/api/events/map-points`
  liefert die Zeile der Site. Ob eine columnar-Gesamtlieferung für DE trägt, ist
  eine Messfrage (Abschnitt F, Edge Cases).
- `event_stats_cache` und `event_counts_for_stats`: je Land ein Datensatz
  (Parameter bzw. Schlüssel `country`), `country_total` je Land.
- Artist-Funktionen: Parameter `p_country` mit Standard `'AT'`, damit jeder
  bestehende Aufrufer unverändert bleibt. Das Matching selbst bleibt im
  AT-Lauf (`AT_ONLY_STEPS`); auf .de ist die Künstler-Säule zum Start aus.
- Jede geänderte oder neu angelegte Funktion bekommt ihre Rechte ausdrücklich
  (`GRANT EXECUTE` nur wo öffentlich nötig; Wächter
  `security-definer-grants.test.ts`), danach `NOTIFY pgrst, 'reload schema'`.
- pg_cron-Refreshes bleiben je Objekt ein Job; Laufzeit vorher/nachher messen.

### F. Betrieb und Kapazität
- **Build nicht mehr auf dem Datenbank-Server.** Zwei Images je Deploy auf dem
  Server würden das belegte Problem aus MASTERPLAN §3.15 verdoppeln. Die Images
  entstehen in GitHub Actions (Matrix `SITE_COUNTRY: [AT, DE]`, gleiche
  Commit-SHA), der Server zieht sie nur. Das schließt zugleich den offenen
  Punkt (1) aus §3.15.
- **Kapazitätsaussage als eigener, erster Betriebs-Task** (nur lesend, per SSH
  und SQL): RAM und Swap je Container, Größe des Writable-Layers (ISR-Cache),
  freie Platte, Größe der `events`-Indizes, Dauer und Größe von
  `event_map_points` heute. Daraus eine belegte Aussage: trägt der Server
  (4 vCPU, 8 GB laut Auftrag) einen zweiten Website-Container plus MV und
  Indizes, ja oder nein, mit Zahlen. Ohne Ja kein DE-Container auf diesem
  Server (Entscheidung 6).
- **Reverse Proxy und Cloudflare:** Caddy-Site-Block für lasstreffen.de und
  www, eigene Cloudflare-Zone mit denselben Regeln (`cf-setup.py` nimmt die
  Zone als Parameter), Bot-Sperren und Rate-Limits gelten je Host,
  Traffic-Audit zählt je Domain.
- **Wärmen und Wächter je Container:** `revalidate-landing`-Timer, Warm-on-Start
  (`src/instrumentation.ts`), ISR-Guard und Health-Check laufen je Container;
  `deploy.yml` revalidiert beide.
- **Bilder Eventfrog-DE:** bleiben aus, bis die Kapazitätsaussage Plattenplatz
  belegt (laut CLAUDE.md rund 11.200 Bilder, 0,9 GB). Karten ohne Bild müssen
  auf .de ordentlich aussehen (Platzhalter-Gestaltung wie auf .at).

## API Contracts
- **`getSite(): SiteConfig`** (Server und Client, synchron, ohne `headers()`
  oder `cookies()`, damit ISR-Shells statisch bleiben).
- **`/api/events`**: Parameter bleiben `bundesland(s)` und `district(s)`; neu
  `gemeinde` (Schlüssel). Der Länderfilter kommt immer aus der Site und ist von
  außen nicht wählbar (kein `country`-Parameter). `regionFilter` bildet die
  Parameter je Site auf Spalten ab: AT auf `bundesland`/`district`, DE auf
  `region_id`/`kreis_key`. Unbekannte Regions-ID der Site: 400, nie ein
  ungefiltertes Ergebnis. Antwortfelder kommen um `region_id`, `kreis_key`,
  `gemeinde_key` dazu, bestehende Felder bleiben.
- **`/api/events/map-points`**: liefert den Snapshot der Site, Format unverändert.
- **`search_event_ids`**: Aufrufer übergeben `[site.country]`.
- **`event_counts_for_stats(p_country text default 'AT')`**, Artist-Funktionen
  mit `p_country text default 'AT'`.
- **SEO-Helfer:** `deOnlyAlternates`, `bilingualAlternates`, Sitemap-Builder
  und `robots.ts` nehmen Basis-URL und hreflang aus der Site. Sitemap-Index je
  Domain; auf .de ohne `sitemap-activities.xml`.
- **Ortsschnittstelle je Land:** `ortsdatenFor(country)` wird um das erweitert,
  was die Seite braucht (Länderliste, Gemeinde nach Slug und Schlüssel, Post-Ort
  zur PLZ), statt dass `src/app` Stammdateien direkt liest.
- **Build:** `SITE_COUNTRY=DE npm run build` baut die DE-Seite; `npm test`
  läuft in CI für beide Werte (mindestens Wächter, Site, SEO, URL-Tests).

## Edge Cases & Constraints
- **Supabase Micro:** kein `count exact`, keine breiten Scans auf `events`
  (rund 435.000 Zeilen laut MASTERPLAN §3.15). Jede neue DE-Abfrage braucht
  einen indexierten Pfad und einen `EXPLAIN`-Beleg im PR. PostgREST-Grenzen:
  1000 Zeilen je Antwort, `.in()` ≤ 200, Schreib-Batches ≤ 500.
- **AT-Abfragepläne:** Mit DE-Zeilen in denselben Indizes verwarfen AT-Abfragen
  bis zu 131.129 DE-Zeilen je Aufruf (Commit d164b1c6). Die Index-Migration aus
  PR #467 ist Voraussetzung für dieses Epic und wird zuerst in Prod ausgeführt.
- **DE im AT-Rechteck und umgekehrt:** Regions- und Umkreisfilter ersetzen nie
  den Länderfilter (1.007 DE-Events im AT-Rechteck, Prod 2026-10-07). Der
  Wächter bleibt, prüft aber gegen die Site statt gegen `'AT'`.
- **Grenzgemeinden und Dubletten über Länder:** Ein Event steht in genau einem
  Land (`country` der Zeile). Dubletten-Weiterleitungen über die Landesgrenze
  (`event-detail-loaders.ts`, heute „DE-Dublette leitet auf das AT-Original“)
  dürfen nie auf die andere Domain oder auf ein nicht ausgespieltes Event zeigen.
- **Eventim CH** bleibt auf keiner der beiden Seiten sichtbar.
- **Namensgleiche Gemeinden** (Backfill und Slugs): nie raten, NULL bzw.
  Kreis-Zusatz; Zahl der offenen Fälle im Bericht.
- **Großkunden-PLZ und Ortsteile:** Post-Ort der URL nur aus `plz-de.json`
  (`orteGemeinde`), Großkunden-PLZ liefern keinen Ort.
- **Zeitzone:** Europe/Berlin und Europe/Vienna haben dieselben Regeln; die
  Wiener-Tag-Helfer (`vienna-day.ts`) rechnen für .de richtig. Sie werden nicht
  umbenannt oder dupliziert, die Site nennt die Zone nur für Anzeige und JSON-LD.
- **Karte:** Für .at trägt ein columnar-Gesamtsnapshot. Für laut Auftrag
  174.000 kommende DE-Events ist das unbelegt. Der Task misst Größe (roh und
  gzip), Refresh-Dauer und Ladezeit; reißt der Snapshot das gemessene AT-Niveau
  deutlich, braucht .de eine Kachelung nach Ausschnitt, die dann für beide
  Länder gilt (ein System). Mapbox-Kosten und Kontingent je Domain prüfen
  (Static-Bild der Startseite; eine URL-Beschränkung des Tokens, falls gesetzt, um .de ergänzen).
- **SEO, gestuft:** Eine neue Domain mit sechsstellig vielen dünnen
  Event-Seiten ist ein belegtes Risiko (Spam-Updates 2026 trafen
  Event-Detailseiten von .at, Memory `traffic_decline_spam_updates_2026`).
  Stufe 1: Startseite, Land-Hubs, Gemeinde-Hubs über einer Mindestzahl kommender
  Events und Event-Seiten über der Qualitätsschwelle der AT-Sitemap in der
  Sitemap, alles andere `noindex`. Stufen danach nur mit GSC-Zahlen. Kein
  hreflang zwischen Event- und Regionsseiten der beiden Domains (andere Inhalte,
  keine Sprachvarianten); nur Startseite und länderneutrale Seiten dürfen sich
  als `de-AT`/`de-DE` gegenseitig nennen.
- **Canonical:** nie im Layout (Vorfall 2026-09-04), immer je Seite aus der Site.
  Eine .de-Seite darf nie auf .at kanonisieren und umgekehrt; Wächter-Test.
- **Quellen-Attribution:** Jede Event-Detailseite zeigt `source_name` und
  `source_url` (Pflicht, auch auf .de), Bilder mit `image_credit`
  (`/bildnachweis`).
- **Affiliate:** Eventim-Links kommen fertig aus dem Feed (`evoLink` mit
  `affiliate=J70`). Ob J70 Verkäufe über eventim.de vergütet, ist unbelegt und
  vor dem Start bei Eventim zu klären (Entscheidung 7). AdSense: .de muss im
  Konto freigeschaltet sein, vorher keine Anzeigen-Slots auf .de.
- **Analytics:** `analytics_events` muss je Domain auswertbar sein (Feld oder
  eindeutig ableitbar), der tägliche Traffic-Audit und der GSC-Snapshot
  (`GSC_SITE_URL`) laufen je Domain.
- **Auth:** Supabase Auth kennt eine `SITE_URL`; Mails und OAuth-Rückwege
  zeigen heute auf .at. Solange Login auf .de aus ist, entsteht kein Bedarf.
  Wird Login eingeschaltet, sind Redirect-Liste, Mail-Vorlagen und Cookies je
  Domain eigene Arbeit (Boundaries).
- **Deploy-Reihenfolge:** Migrationen sind abwärtskompatibel (neue Spalten
  nullable, Funktionsparameter mit Standardwert), sodass der alte AT-Container
  nach der Migration weiterläuft. Nie Backfill, Indexbau oder Ventil-Freigabe
  während eines Deploys.
- **Texte:** keine Gedankenstriche in sichtbaren Texten, auch nicht in den
  neuen DE-Texten.

## Acceptance Criteria
- [ ] Bestandsaufnahme mit Quelle im Epic nachgetragen: DE-Events gesamt,
      kommend, veröffentlicht, mit Koordinaten, mit `location_resolution.gemeinde`
      (jeweils `planned` oder MV, Datum der Messung).
- [ ] `SITE_COUNTRY`, Domain, hreflang, Marke stehen an genau einer Stelle
      (`src/lib/site/`). Wächter: kein Literal `lasstreffen.at`, `'de-AT'`,
      `addressCountry: 'AT'` oder `country = 'AT'` außerhalb der Site und einer
      begründeten Ausnahmeliste (Blog-Inhalte, Rechtstexte, Tests).
- [ ] Länder-Wächter läuft für `SITE_COUNTRY=AT` und `=DE` grün; jede
      öffentliche Lesestelle auf `events` filtert das Land der Site.
- [ ] AT unverändert: für eine feste Liste von mindestens 30 URLs (Startseite,
      Hubs, Event-Seiten, Sitemaps, robots.txt) sind Canonical, hreflang,
      JSON-LD und Sitemap-Einträge vor und nach dem Umbau gleich
      (Vergleichsskript, Ergebnis im PR).
- [ ] Spalten `region_id`, `kreis_key`, `gemeinde_key` existieren, der Sync
      schreibt sie für AT und DE (Golden-Tests mit echten DE- und AT-Fällen),
      ein DE-Wert weist keinen Batch ab.
- [ ] Backfill DE gelaufen; Bericht nennt gefüllte Zeilen, NULL-Zeilen je
      Ursache und Laufzeit. Anteil der kommenden, veröffentlichten DE-Events mit
      `gemeinde_key` ist gemessen und im Epic dokumentiert.
- [ ] Indizes angelegt, `EXPLAIN` der Kernabfragen (Liste je Land, je Gemeinde,
      Startseite, Sitemap) für AT und DE im PR; keine läuft in den
      Statement-Timeout, keine AT-Abfrage ist langsamer als vorher.
- [ ] `event_map_points`, `event_stats_cache`, `event_counts_for_stats` liefern
      je Land; Refresh-Dauer und Payload-Größe für AT und DE gemessen und
      dokumentiert; AT-Werte nicht schlechter als vorher.
- [ ] `SITE_COUNTRY=DE npm run build` läuft durch; die DE-Seite zeigt in Liste,
      Karte, Suche, Hubs, Detailseiten und Sitemaps kein einziges AT- oder
      CH-Event (Test gegen Prod-Daten, lokal oder im Staging-Container).
- [ ] DE-Event-URL: fünfstellige PLZ und Post-Ort aus `plz-de.json`, kein
      `0000-at` und kein `-at` in irgendeiner .de-Sitemap (Test über die
      erzeugte Sitemap).
- [ ] Land-Hubs für alle 16 Länder und Gemeinde-Hubs erreichbar; Slugs
      eindeutig (Wächter); Hubs unter der Mindestzahl sind `noindex` und nicht
      in der Sitemap.
- [ ] Abgeschaltete Features antworten auf .de mit 404, stehen in keiner
      Navigation und in keiner Sitemap (Test über die Feature-Matrix).
- [ ] Canonical-Wächter: keine .de-Seite kanonisiert auf .at und umgekehrt.
- [ ] `/quellen` auf .de nennt GeoNames (CC BY 4.0), BKG VG250 (dl-de/by-2-0),
      Destatis, Eventfrog, OpenStreetMap und die Gemeindekalender mit der
      jeweils geforderten Namensnennung; Wortlaut vom Nutzer freigegeben.
- [ ] Impressum, Datenschutz und Nutzungsbedingungen für .de liegen vom Nutzer
      freigegeben vor; ohne Freigabe geht .de nicht online.
- [ ] Kapazitätsaussage mit Messwerten liegt vor und der Nutzer hat über den
      Server entschieden (Entscheidung 6).
- [ ] Images entstehen außerhalb des Datenbank-Servers; ein Deploy während der
      Nachbearbeitung löst keinen Lesefehler mehr aus (ein beobachteter Lauf).
- [ ] lasstreffen.de und www antworten über Cloudflare und Caddy mit 200;
      Health, Warm-on-Start, `revalidate-landing` und ISR-Guard laufen für
      beide Container; Alarm-Mails nennen die Domain.
- [ ] Analytics und Traffic-Audit trennen die Domains; GSC-Property für .de
      angelegt, Sitemap eingereicht.
- [ ] `npm test` grün (beide Länder), `CLAUDE.md` und `docs/MASTERPLAN.md`
      (neuer Abschnitt Deutschland) nachgezogen.

## Boundaries
- Keine neuen Datenquellen und keine Adapter-Arbeit (fn-29, fn-28).
- Kein Umzug der AT-Leser von `bundesland`/`district` auf die neuen Spalten und
  kein Entfernen der AT-Spalten, CHECKs oder FKs.
- Keine Schweiz, keine dritte Domain.
- Zum Start auf .de nicht: Blog, Festivals, Aktivitäten, Künstler, Studenten,
  Thema-Hubs, Kreis-Hubs, /en, Login, Social, Newsletter, Mails,
  Veranstalter-Pakete, Outreach (jeweils eigene Epics nach dem Start).
- Keine rechtliche Bewertung durch Claude: Rechtstexte und Lizenz-Wortlaute
  liefert oder gibt der Nutzer frei.
- Kein KI-Enrichment und keine KI-Texte für Hubs (MASTERPLAN §6).
- Keine Weiterleitung von .at auf .de nach Standort oder Sprache
  (Google-Richtlinie, wie `localeDetection: false`).
- Eventfrog-DE-Bilder einschalten ist kein Teil des Starts.

## Decision Context
- **Build-Konfiguration statt Host-Weiche zur Laufzeit.** Die Seiten sind
  cookie- und headerfreie ISR-Shells (fn-30, GSC-Vorfall 2026-04: `Set-Cookie`
  machte Seiten `private`). Eine Weiche über `headers()` macht jede Seite
  dynamisch; eine Weiche über Middleware-Rewrite verlangt ein zusätzliches
  Pfadsegment durch den ganzen Seitenbaum und verdoppelt den ISR-Cache in einem
  Container, dessen Writable-Layer schon heute überwacht werden muss
  (MASTERPLAN §3.13). Ein Wert zur Build-Zeit hält jede Seite statisch, lässt
  nicht gebrauchte Säulen aus dem DE-Bundle fallen und macht „DE-Event auf .at“
  zu einem Fehler, den der Wächter beim Build findet, nicht ein Request-Header
  zur Laufzeit. Preis: zwei Images und zwei Container, deshalb der Build
  außerhalb des Servers und die Kapazitätsaussage vor dem Start.
- **Eigene Spalten statt JSON-Index.** Ein Ausdrucksindex auf
  `location_resolution->'gemeinde'->>'bundesland'` käme ohne Backfill aus, aber
  die Entscheidung trägt keinen Gemeinde- und Kreisschlüssel, Namen sind nicht
  eindeutig, die MV und die Sitemap bräuchten denselben Ausdruck wörtlich, und
  jede Änderung am JSON-Aufbau bräche den Index still.
- **Neue neutrale Spalten statt Aufweichen von `bundesland`/`district`.** Der
  CHECK und der FK schützen AT (ein FK-Fehler kostete am 07.09.2026 4.801
  Events), und viele AT-Leser behandeln `bundesland` als Menge der neun Länder.
  DE-Werte in diesen Spalten würden jeden dieser Leser zum Risiko machen. Die
  neuen Spalten gelten für beide Länder; dass AT sie in diesem Epic nur
  schreibt und noch nicht liest, ist eine bewusste, befristete Stufe und keine
  zweite Welt.
- **Stammdaten bleiben Dateien.** Hubs und URLs lesen `gemeinden-de.json` und
  `plz-de.json` über `src/lib/gemeinden/` und `src/lib/location/`, wie fn-27 es
  für AT festgelegt hat; keine Gemeindetabelle in der Datenbank.
- **Schmal starten.** Die DE-Daten sind Gemeindekalender, Eventim und
  Eventfrog. Die Säulen, die .at darüber hinaus trägt, sind österreichisch
  kuratiert; sie auf .de leer oder mit AT-Inhalt zu zeigen, wäre schlechter als
  sie wegzulassen.

## Offene Entscheidungen des Nutzers
1. **Domain:** Ist lasstreffen.de registriert und in deinem Zugriff (DNS,
   Cloudflare-Zone)? Soll www auf die Hauptdomain leiten wie bei .at?
2. **Recht (nicht von Claude bewertet):** Wer erstellt oder prüft Impressum,
   Datenschutzerklärung und Nutzungsbedingungen für .de (deutsches Recht,
   Anbieter mit Sitz in Österreich)? Bis zur Freigabe geht .de nicht online.
3. **Lizenz-Wortlaute auf /quellen:** Freigabe der Namensnennungen für GeoNames,
   BKG VG250, Destatis, Eventfrog und Gemeindekalender; dazu die Frage, ob eine
   der Quellen die Ausspielung auf einer zweiten Domain einschränkt (Eventfrog
   API-Bedingungen, Eventim-Vertrag).
4. **Umfang zum Start:** Gilt die Feature-Matrix aus Abschnitt C (nur Events,
   Karte, Suche, Land- und Gemeinde-Hubs), oder soll eine weitere Säule
   (z. B. Künstler aus dem Eventim-Feed) schon zum Start dabei sein?
5. **Login auf .de:** Anonym starten (Empfehlung, Social ist eingefroren) oder
   Login und Merken von Anfang an (dann Auth-Rückwege, Mails und Cookies je
   Domain als eigener Task)?
6. **Server:** Nach der Kapazitätsaussage: zweiter Container auf dem
   bestehenden Server, größerer Server oder eigener Server für die Website?
7. **Geld:** Vergütet Eventim-Affiliate J70 auch eventim.de (bei Eventim
   klären)? AdSense auf .de von Anfang an oder erst nach der Indexierung?
8. **Indexierung:** Gilt der gestufte Start (zuerst Hubs und Event-Seiten über
   der Qualitätsschwelle, Rest `noindex`), und welche Mindestzahl kommender
   Events macht einen Gemeinde-Hub indexierbar?
9. **Marke und Kontakt:** „LassTreffen.de“ als Name, gleiche Gestaltung, und
   welche Kontaktadresse steht auf .de (office@lasstreffen.at oder ein
   Postfach unter .de)?
10. **Eventfrog-DE-Bilder:** einschalten, sobald Plattenplatz belegt ist, oder
    bis nach dem Start aus lassen?
