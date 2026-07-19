# fn-18-freizeitaktivitaeten-poi-bestand.3 /api/activities + Detailseite /aktivitaet/[slug] + Sitemap + /quellen

## Description
Oeffentliche Ausspielung: Cursor-paginierte API, ISR-Detailseite unter [locale] mit E13-Canonical-Regel, Sitemap-Split (Index + Kind-Sitemaps), Quellen-Attribution.

**Size:** M
**Files:** src/app/api/activities/route.ts, src/app/[locale]/aktivitaet/[slug]/page.tsx, src/components/Activities/{ActivityHero,ActivityFacts,OpenNowBadge,ActivityMap}.tsx, src/app/sitemap.xml/route.ts (wird Index), src/app/sitemap-core.xml/route.ts, src/app/sitemap-events.xml/route.ts, src/app/sitemap-activities.xml/route.ts, src/app/[locale]/quellen/page.tsx

## Approach
- API: Cursor-Muster aus src/app/api/events/route.ts:668-691 (Tiebreaker id), Filter bundesland/gemeinde/tag, nur visible=true, count 'planned' — nie exact (Micro!).
- Detailseite: ISR-Muster src/app/[locale]/events/[...slug]/page.tsx — revalidate=3600, dynamicParams=true + leeres generateStaticParams, setRequestLocale Pflicht, KEIN cookies()/auth im RSC-Pfad; generateMetadata (canonical/OG) + JSON-LD (TouristAttraction bzw. LocalBusiness).
- E13 /en-Regel: solange keine EN-Uebersetzung existiert rendert /en/aktivitaet/* DE-Content mit canonical auf die DE-URL, OHNE hreflang-Paar; Sitemap enthaelt nur DE-URLs (canonical/hreflang-Muster der Event-Detailseite spiegeln).
- Noindex-Gate (Epic E7): Beschreibung >=200 Zeichen ODER (Bild + Oeffnungszeiten), sonst robots noindex — Muster events page.tsx:44-74. Gate-Funktion in src/lib/activities/ (pur, getestet).
- OpenNowBadge: Client-Komponente, berechnet aus opening_times jsonb in Europe/Vienna (Epic E8).
- Slug-Resolver: exakter Match, sonst shortid-Suffix-Lookup -> 301 (Epic E5); duplicate_of-Rows -> 301 auf kanonische Row.
- Bilder: Hotlink Deskline-CDN mit onerror-Fallback; Copyright/Author aus images jsonb sichtbar rendern (Attribution-Pflicht, Memory event_source_attribution_legal).
- Sitemap-Split (Epic E12, verbindlich): /sitemap.xml wird <sitemapindex> und verweist auf sitemap-core.xml (Statisch/Hubs/Themen/Studenten/Venues — bestehende Bloecke dorthin verschieben), sitemap-events.xml (bestehende Event-Logik inkl. MAX_EVENTS-Cap) und sitemap-activities.xml (NUR indexierbare Aktivitaeten, 1000er-Batches). Jede Kind-Datei <50k URLs. Nach Deploy: Sitemap in GSC neu einreichen (im PR-Text vermerken).
- /quellen: Eintrag "Feratel Deskline Infrastruktur-POIs" (separat vom Events-Eintrag).
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
- [ ] /en/aktivitaet/<slug> liefert canonical auf die DE-URL und kein hreflang-Paar (E13-Test im HTML)
- [ ] Noindex-Gate: Thin-POI liefert robots noindex, content-reicher POI nicht (Unit-Test + Stichprobe im HTML)
- [ ] /api/activities paginiert per Cursor, haelt Filter ein, liefert nur visible, kein exact count
- [ ] /sitemap.xml ist ein gueltiger <sitemapindex> auf sitemap-core/-events/-activities; Event- und Hub-URLs vollstaendig umgezogen (Diff der URL-Menge vorher/nachher dokumentiert); sitemap-activities enthaelt nur indexierbare URLs; jede Kind-Datei <50k
- [ ] Slug-Resolver: alter/abweichender Slug mit gueltiger Shortid -> 301; duplicate_of-Row -> 301 auf kanonische URL
- [ ] /quellen um Deskline-POI-Eintrag ergaenzt
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
