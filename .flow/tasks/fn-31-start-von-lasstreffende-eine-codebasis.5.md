# fn-31-start-von-lasstreffende-eine-codebasis.5 Feature-Matrix: Routen, Navigation, Sitemap je Site

## Description
Feature-Matrix der Site schaltet Routen, Navigation und Sitemap-Teile. Auf .de sind zum Start nur Events, Karte, Suche, Land- und Gemeinde-Hubs und die Rechtsseiten an.

**Size:** M
**Files:** `src/lib/site/features.ts` (neu), Layouts der abgeschalteten Bereiche unter `src/app/[locale]/` (blog, festivals, aktivitaeten, aktivitaet, artists, kuenstler, studenten, thema, fuer-firmen, feed, messages, groups, memories, friends, saved, gemerkt, plan, plans, calendar, profile, settings, notifications, spotify-matches, widget, event-inserieren, join, wo-ist-was-los), `src/components/` Navigation (V4TopNav, Footer), `src/app/sitemap.xml/route.ts`, `src/app/sitemap-core.xml/route.ts`, `src/i18n/routing.ts`, `src/__tests__/lib/site-features.test.ts`

## Approach
- Eine Zuordnung Pfadpräfix zu Feature an einer Stelle; ein Helfer `requireFeature(feature)` ruft `notFound()` im Layout bzw. in der Seite des Bereichs. API-Routen abgeschalteter Säulen antworten 404.
- Navigation und Footer zeigen nur Links eingeschalteter Features.
- `routing.locales` aus der Site (.de ohne `en`); `alternateLinks` der Middleware ausschalten, falls hreflang von Hand gesetzt wird.
- Sitemap-Index ohne Teile abgeschalteter Features.
- Test über die Matrix: jede Route eines abgeschalteten Features ist in keiner Navigation und keiner Sitemap.

## Key context
- Die Matrix ist Entscheidung 4 des Nutzers; Standard ist der Vorschlag aus Abschnitt C der Epic-Spec. Sie muss durch eine Änderung an einer Stelle umstellbar sein.
- Auf .at ist jedes Feature an: kein Verhalten ändert sich.
## Acceptance
- [ ] `SITE_COUNTRY=DE`: abgeschaltete Bereiche antworten 404 (Seite und API), stehen in keiner Navigation und keiner Sitemap
- [ ] `SITE_COUNTRY=AT`: alle Routen, Navigation und Sitemap-Index unverändert
- [ ] .de hat kein `/en`
- [ ] Ein Feature umschalten ändert genau eine Zeile
## Done summary
Feature-Matrix in SiteConfig.features, Pfade in src/lib/site/features.ts. Middleware antwortet 404 fuer abgeschaltete Saeulen und fuer /en ohne Englisch; Navigation, Footer, Sitemap-Index und Kern-Sitemap filtern ueber isPathEnabled. AT hat alles an und wird nicht geprueft. Offen: /auth/callback liegt ausserhalb des Middleware-Matchers und wird nicht gesperrt; routing.locales bleibt aus Typgruenden unveraendert, /en sperrt die Middleware.
## Evidence
- Commits: bdac854a
- Tests: npx vitest run (4625 gruen, lokal nur die drei Windows-Faelle rot), SITE_COUNTRY=DE: site, guards, site-features gruen
- PRs: