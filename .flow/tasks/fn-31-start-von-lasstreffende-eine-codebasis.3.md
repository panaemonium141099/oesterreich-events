# fn-31-start-von-lasstreffende-eine-codebasis.3 SEO-Kern aus der Site: Canonical, hreflang, Sitemap, robots, JSON-LD

## Description
SEO-Kern liest Domain, hreflang und Land aus der Site. Dazu ein Vergleichsskript, das belegt, dass sich für AT nichts ändert, und ein Wächter gegen neue Domain-Literale.

**Size:** M
**Files:** `src/lib/seo/canonical.ts`, `src/lib/seo/sitemap-xml.ts`, `src/lib/seo/event-jsonld.ts`, `src/app/robots.ts`, `src/app/[locale]/layout.tsx`, `src/app/opengraph-image.tsx`, `src/app/llms-full.txt/route.ts`, `src/lib/seo/indexnow.ts`, `src/scripts/seo-vergleich.ts` (neu), `src/__tests__/lib/domain-literal-guard.test.ts` (neu)

## Approach
- `bilingualAlternates` (`canonical.ts:37`): hreflang-Schlüssel aus der Site (`de-AT` bzw. `de-DE`).
- `layout.tsx:124` bis 235: metadataBase, OpenGraph-Locale, `inLanguage`, Organization-JSON-LD aus der Site.
- `addressCountry` in JSON-LD aus der Site (`event-jsonld.ts`, `venues/[id]`, `kuenstler/[slug]`, `aktivitaet/[slug]`).
- Vergleichsskript: holt eine feste Liste von mindestens 30 URLs (Startseite, Hubs, Event-Seiten, Sitemaps, robots.txt) von zwei Basis-URLs und vergleicht Canonical, hreflang, JSON-LD, Sitemap-Einträge. Lauf vor und nach dem Umbau, Ergebnis in den PR.
- Wächter nach dem Muster `site-country-guard.test.ts`: kein `lasstreffen.at`, `'de-AT'`, `de_AT`, `addressCountry: 'AT'` außerhalb `src/lib/site/` und einer begründeten Ausnahmeliste. Die Ausnahmeliste startet mit allen heutigen Fundstellen außerhalb des SEO-Kerns; Task 4 baut sie ab.
- Canonical-Wächter: keine erzeugte URL zeigt auf die andere Domain.

## Key context
- Canonical nie ins Layout (Vorfall 2026-09-04, Kommentar in `canonical.ts`).
- Kein hreflang zwischen Event- und Regionsseiten der beiden Domains.
## Acceptance
- [ ] SEO-Kern ohne Domain-, hreflang- und Länder-Literal
- [ ] Vergleichsskript zeigt für AT keine Abweichung (Ausgabe im PR)
- [ ] Mit `SITE_COUNTRY=DE`: Canonical, Sitemap-Basis, robots und JSON-LD zeigen lasstreffen.de, `de-DE`, `DE`
- [ ] Domain-Wächter grün, Ausnahmeliste mit Begründung je Eintrag
- [ ] Canonical-Wächter grün für beide Länder
## Done summary
SEO-Kern liest Domain, hreflang, Marke und Land aus getSite(). Domain-Waechter mit Altbestandsliste (99 Dateien) und Canonical-Waechter, beide auch mit SITE_COUNTRY=DE. Vergleichsskript seo-vergleich.ts; Vorher-Schnappschuss von Prod (43 Seiten, 38 mit 200) liegt vor, der Vergleich nach dem Deploy steht aus. opengraph-image und llms-full.txt bleiben fuer fn-31.4 (Texte).
## Evidence
- Commits: 2bcc0687
- Tests: npx vitest run (volle Suite, lokal nur die drei Windows-Faelle rot), SITE_COUNTRY=DE: site, site-country-guard, domain-literal-guard (21 gruen)
- PRs: