# fn-31-start-von-lasstreffende-eine-codebasis.11 Hubs für DE: Länder und Gemeinden über eine Ortsschnittstelle

## Description
Hubs für DE: 16 Land-Hubs und Gemeinde-Hubs aus den DE-Stammdaten, über dieselben Routen wie AT.

**Size:** M (Land-Hubs und Gemeinde-Hubs bei Bedarf als zwei PRs)
**Files:** `src/lib/location/ortsdaten.ts` (Schnittstelle für die Seite), `src/lib/landing-slugs.ts`, `src/lib/landing-data.ts`, `src/lib/gemeinden/de.ts`, `src/app/[locale]/[bundesland]/page.tsx` und Kinder, `src/app/[locale]/gemeinde/[slug]/page.tsx`, `src/lib/hubs/gemeinde-hub-content.ts`, `src/app/sitemap-core.xml/route.ts`, Tests

## Approach
- Die Seite liest Länder und Gemeinden über eine Schnittstelle je Land (Erweiterung von `ortsdatenFor`, `ortsdaten.ts:99`): Länderliste, Gemeinde nach Slug, Gemeinde nach Schlüssel. Kein direkter JSON-Import in `src/app` (fn-27-Regel).
- `isValidBundesland` (`landing-slugs.ts:127`) und `getBundeslandName` fragen die Site. `LANDING_CITIES` und `STUDENT_CITIES` bleiben AT (Features auf .de aus).
- Gemeinde-Slug wie AT: `{plz}-{name}` zur Laufzeit (`src/lib/gemeinden/data.ts:30`, `:132`), für DE mit der Amts-PLZ. Wächter auf Eindeutigkeit über alle 10.749 Gemeinden; Kollisionen im Test ausgeben und über einen festen, eingecheckten Zusatz lösen.
- Loader (`loadBundeslandPage`, `loadBundeslandShelves`) filtern DE über `region_id`, Gemeinde-Hubs über `gemeinde_key`.
- Indexierbarkeit: bestehende Regel (`gemeinde/[slug]/page.tsx:277`, unter drei Events und unter drei Aktivitäten ist noindex) gilt für DE nur mit Events; die Mindestzahl ist Entscheidung 8 des Nutzers und steht als Wert in der Site.
- `sitemap-core.xml` (`:204` bis `:212`) nimmt heute jede Gemeinde auf: für DE nur Gemeinden über der Mindestzahl (Zahl je Gemeinde aus einer gruppierten Abfrage über den Index, nie je Gemeinde eine Abfrage).
- Hub-Texte ohne KI; Textbausteine mit „Österreich“ je Site.
- Unterseiten der Land-Hubs (`[filter]`, `[subfilter]`): Kategorie und Zeitfilter funktionieren, Stadt-Unterseiten sind AT.

## Key context
- `dynamicParams = true` mit leerem `generateStaticParams`: Hubs entstehen bei der ersten Anfrage, der Build rendert sie nicht vor.
- fn-28.18 (Abdeckungsmatrix) ist offen; die Hub-Liste hängt nicht daran, nur die Erwartung an die Zahl indexierbarer Hubs.
## Acceptance
- [ ] `SITE_COUNTRY=DE`: `/bayern` und die übrigen 15 Länder antworten 200, ein AT-Bundesland 404; umgekehrt auf AT
- [ ] Gemeinde-Hub zeigt nur Events der Gemeinde (Test mit namensgleichen Gemeinden)
- [ ] Slugs eindeutig (Wächter über alle Gemeinden)
- [ ] Hubs unter der Mindestzahl sind noindex und fehlen in der Sitemap
- [ ] AT-Hubs und AT-Sitemap unverändert (Vergleichsskript aus Task 3)
- [ ] `src/app` importiert keine Stammdatei direkt
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
