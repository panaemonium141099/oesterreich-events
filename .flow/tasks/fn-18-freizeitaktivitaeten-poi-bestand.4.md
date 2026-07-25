## Description
Sichtbarkeit in bestehenden Flaechen: Gemeinde-Hub-Sektion + Cross-Links in BEIDE Richtungen (dieser Task besitzt beide: Event-Detail -> Aktivitaeten UND Aktivitaets-Detail -> Events in der Naehe).

**Size:** S/M
**Files:** src/app/[locale]/gemeinde/[slug]/page.tsx, src/components/Activities/NearbyActivitiesSection.tsx, src/components/Activities/NearbyEventsSection.tsx (Inhalt des Task-3-ActivityExtrasSlot), Event-Detail-Integration (src/components/Events/v4/ — kleine Andockstelle), messages/de.json (+ en.json DE-Fallback; gleiche i18n-Regel wie Task 3)

## Approach
- loadNearbyActivitiesCached analog loadNearbyEventsCached (gemeinde/[slug]/page.tsx:85-116): unstable_cache + bboxAround + haversineKm, Radius via getCityHub(...)?.radiusKm ?? 10.
  <!-- Updated by plan-sync: fn-18.1 revoked den anon/authenticated-SELECT auf poi_activities und stellt die View poi_activities_public bereit. loadNearbyEventsCached nutzt den SERVICE_ROLE-Client (gemeinde/[slug]/page.tsx:61-64) -> loadNearbyActivitiesCached liest analog die Basistabelle poi_activities direkt; die Public-View ist auf diesem Server-Pfad nicht noetig. -->

- Gemeinde-Hub: Sektion "Freizeit & Ausfluege" mit Kategorie-Chips, rendert nur bei >=3 Aktivitaeten; Platzierung nach dem Event-Grid (:387-424).
- **Hub-Indexierungs-Gate erweitern (bewusste SEO-Entscheidung):** Der bestehende noindex-Gate der Hub-Seite (<3 Events -> noindex) wird zu (Events >= 3 ODER Aktivitaeten >= 3) -> indexierbar. ACHTUNG: der Gate lebt in generateMetadata (robots), nicht nur im Page-Body — BEIDE Stellen muessen die kombinierte Regel nutzen.
- **Strukturierte Daten im Mixed-Modell (verbindlich):** die Hub-Seite baut heute Place + ItemList + Breadcrumb + FAQ rein aus Events. Neue Regel: Event-ItemList nur wenn Events vorhanden (nie leere ItemList); bei Aktivitaeten >= 3 zusaetzlich eine eigene Aktivitaeten-ItemList (Links auf /aktivitaet/*); FAQ-Copy folgt denselben 4 Faellen wie die Meta-Copy (event-only, activity-only, kombiniert, leer). Der activity-only-Fall darf kein event-bezogenes JSON-LD/FAQ mehr emittieren.
- **Mixed-Content-Modell fuer Hub-Metadata + Copy (4 Faelle, verbindlich):** generateMetadata-Title/Description und Hero-/Empty-State-Text werden auf gemischten Content umgestellt: (a) Events>=3 & Aktivitaeten<3 -> wie heute (Event-Copy); (b) Events<3 & Aktivitaeten>=3 -> Aktivitaets-Copy ("Freizeitaktivitaeten & Ausflugsziele in X"), KEIN "Aktuell keine Events"-Fallback als Hauptinhalt; (c) beide >=3 -> kombinierte Copy (Events + Freizeit); (d) beide <3 -> heutiges Verhalten inkl. noindex. Der "Aktuell keine Events"-Hinweis bleibt nur als kleiner Sektionshinweis, nie als Seiten-Empty-State wenn Aktivitaeten da sind. **Experiment-Overrides (resolveExperimentForScope('gemeinde',...)):** werden NUR im event-only-Fall (a) angewandt; in den Faellen (b)/(c) sind Experiment-Title/Heading-Overrides deaktiviert, damit stale event-only-Varianten die neue Mixed-Copy nicht ueberschreiben (Contract-Erweiterung der Experimente ist Follow-up).
- Event-Detail: "In der Naehe erleben"-Block (max 3 Aktivitaeten, <=10 km) mit Links auf /aktivitaet/*.
- Aktivitaets-Detailseite: "Events in der Naehe"-Block (max 3, <=10 km, nur future Events) — implementiert als Inhalt der von Task 3 bereitgestellten leeren Slot-Komponente src/components/Activities/ActivityExtrasSlot.tsx; page.tsx der Aktivitaetsseite wird in diesem Task NICHT angefasst.
- Koordinations-Hinweis: fn-13 wird dieselbe Hub-Datei anfassen — PR klein halten, im PR-Text vermerken.

## Acceptance
- [ ] Gemeinde-Hub zeigt Sektion ab >=3 Aktivitaeten (Beispiel-Gemeinde mit Bestand dokumentiert), sonst nicht
- [ ] Event-Detailseite zeigt bis zu 3 Aktivitaeten <=10 km mit funktionierenden Links
- [ ] Aktivitaets-Detailseite zeigt bis zu 3 kommende Events <=10 km (nur future) mit funktionierenden Links
- [ ] Jede neue Sektion laedt ueber genau EINEN unstable_cache-Loader; wiederholte Renders (Page + generateMetadata) mit identischen Args loesen keine doppelten DB-Queries aus (Spy-/Log-Nachweis analog Events-Loader)
- [ ] Hub-Gate in BEIDEN Stellen (generateMetadata robots + Page-Rendering): Gemeinde mit <3 Events aber >=3 Aktivitaeten liefert KEIN robots:noindex im Metadata-HTML; Gemeinde mit <3 Events und <3 Aktivitaeten bleibt noindex (beide Zweige im HTML geprueft)
- [ ] Mixed-Content-Copy getestet: Fall (b) zeigt Aktivitaets-Title/-Description und keinen "keine Events"-Seiten-Empty-State; Fall (c) kombinierte Copy
- [ ] JSON-LD im activity-only-Fall geprueft (HTML): keine leere/event-only ItemList und kein Event-FAQ; Aktivitaeten-ItemList vorhanden

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
