# fn-18-freizeitaktivitaeten-poi-bestand.3 /api/activities + Detailseite /aktivitaet/[slug] + Sitemap + /quellen

## Description
Oeffentliche Ausspielung: Cursor-paginierte API, ISR-Detailseite unter [locale], Sitemap-Sektion, Quellen-Attribution.

**Size:** M
**Files:** src/app/api/activities/route.ts, src/app/[locale]/aktivitaet/[slug]/page.tsx, src/components/Activities/{ActivityHero,ActivityFacts,OpenNowBadge,ActivityMap}.tsx, src/app/sitemap.xml/route.ts, src/app/[locale]/quellen/page.tsx

## Approach
- API: Cursor-Muster aus src/app/api/events/route.ts:668-691 (Tiebreaker id), Filter bundesland/gemeinde/tag, count 'planned' — nie exact (Micro!).
- Detailseite: ISR-Muster src/app/[locale]/events/[...slug]/page.tsx — revalidate=3600, dynamicParams=true + leeres generateStaticParams, setRequestLocale Pflicht, KEIN cookies()/auth im RSC-Pfad; generateMetadata (canonical/OG) + JSON-LD (TouristAttraction bzw. LocalBusiness).
- Noindex-Gate (Epic E7): Beschreibung >=200 Zeichen ODER (Bild + Oeffnungszeiten), sonst robots noindex — Muster events page.tsx:44-74. Gate-Funktion in src/lib/activities/ (pur, getestet).
- OpenNowBadge: Client-Komponente, berechnet aus opening_times jsonb in Europe/Vienna (Epic E8).
- Slug-Resolver: exakter Match, sonst shortid-Suffix-Lookup -> 301 (Epic E5).
- Bilder: Hotlink Deskline-CDN mit onerror-Fallback; Copyright/Author aus images jsonb sichtbar rendern (Attribution-Pflicht, Memory event_source_attribution_legal).
- Sitemap: eigene Aktivitaeten-Sektion in src/app/sitemap.xml/route.ts (Muster Gemeinde-Block :172-187, 1000er-Batches); NUR indexierbare (Gate) URLs; Kapazitaet beachten (MAX_EVENTS=45000 nahe 50k-Limit) -> ggf. separate Route /sitemap-activities.xml.
- /quellen: Eintrag "Feratel Deskline Infrastruktur-POIs" (separat vom Events-Eintrag).
## Acceptance
- [ ] /aktivitaet/<slug> rendert das Mountaincart-Fulseck-Beispiel korrekt (Saison-Zeiten, Karte, Topics als Tags, Quelle + Bild-Copyright)
- [ ] Noindex-Gate: Thin-POI liefert robots noindex, content-reicher POI nicht (Unit-Test + Stichprobe im HTML)
- [ ] /api/activities paginiert per Cursor, haelt Filter ein, kein exact count
- [ ] Sitemap enthaelt nur indexierbare Aktivitaets-URLs; Gesamt-Sitemap bleibt unter 50k URLs pro Datei
- [ ] Slug-Resolver: alter/abweichender Slug mit gueltiger Shortid -> 301 auf kanonische URL
- [ ] /quellen um Deskline-POI-Eintrag ergaenzt
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
