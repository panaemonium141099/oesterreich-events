# fn-18-freizeitaktivitaeten-poi-bestand.4 Gemeinde-Hub-Sektion Freizeit & Ausfluege + Event-Cross-Links

## Description
Sichtbarkeit in bestehenden Flaechen: Gemeinde-Hub-Sektion + beidseitige Event<->Aktivitaet-Verlinkung.

**Size:** S/M
**Files:** src/app/[locale]/gemeinde/[slug]/page.tsx, src/components/Activities/NearbyActivitiesSection.tsx, Event-Detail-Integration (src/components/Events/v4/ — kleine Andockstelle)

## Approach
- loadNearbyActivitiesCached analog loadNearbyEventsCached (gemeinde/[slug]/page.tsx:85-116): unstable_cache + bboxAround + haversineKm, Radius via getCityHub(...)?.radiusKm ?? 10.
- Sektion "Freizeit & Ausfluege" mit Kategorie-Chips, rendert nur bei >=3 Aktivitaeten; Platzierung nach dem Event-Grid (:387-424).
- Event-Detail: "In der Naehe erleben"-Block (max 3, <=10 km) mit Links auf /aktivitaet/*; umgekehrt zeigt die Aktivitaetsseite (Task 3) bereits Events in der Naehe — Links pruefen.
- Koordinations-Hinweis: fn-13 wird dieselbe Hub-Datei anfassen — PR klein halten, im PR-Text vermerken.
## Acceptance
- [ ] Gemeinde-Hub zeigt Sektion ab >=3 Aktivitaeten (Beispiel-Gemeinde mit Bestand dokumentiert), sonst nicht
- [ ] Event-Detailseite zeigt bis zu 3 Aktivitaeten <=10 km mit funktionierenden Links
- [ ] Interne Verlinkung beidseitig (Aktivitaet -> Events in der Naehe existiert aus Task 3)
- [ ] Kein zusaetzlicher Query-Roundtrip pro Request ohne Cache (unstable_cache-Nachweis analog Events-Loader)
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
