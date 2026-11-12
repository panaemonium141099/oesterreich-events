# fn-31-start-von-lasstreffende-eine-codebasis.2 Site-Konfiguration: Land und Domain an einer Stelle (Build-Zeit)

## Description
Land und Domain an genau einer Stelle. Neues Modul `src/lib/site/` mit `getSite(): SiteConfig` (Land, Domain, URL, Marke, hreflang, OG-Locale, Locales, Zeitzone, Features). Quelle ist `SITE_COUNTRY` zur Build-Zeit, Standard `AT`.

**Size:** M
**Files:** `src/lib/site/index.ts`, `src/lib/site/sites.ts` (neu), `src/lib/site-country.ts`, `src/lib/site-url.ts`, `src/lib/seo/canonical.ts`, `next.config.ts`, `Dockerfile`, `.env.example`, `src/__tests__/lib/site.test.ts`, `src/__tests__/lib/site-country-guard.test.ts`, `.github/workflows/tests.yml`

## Approach
- `SITE_COUNTRY` wird in `next.config.ts` über `env` ins Bundle gegeben (Client und Server gleich). Im Code nur als Literal `process.env.SITE_COUNTRY` lesen, ein dynamischer Zugriff wird nicht eingesetzt.
- `src/lib/site-country.ts` bleibt als Re-Export (`SITE_COUNTRY = getSite().country`), damit die 58 Leser unverändert bleiben. Der Typ wird `'AT' | 'DE'`.
- `SITE_ORIGIN` (`src/lib/site-url.ts:3`) und `SITE_URL` (`src/lib/seo/canonical.ts:22`) lesen die Site. `NEXT_PUBLIC_SITE_URL` bleibt als Übersteuerung für lokale Entwicklung.
- Unbekannter Wert in `SITE_COUNTRY` bricht den Build mit klarer Meldung ab.
- `Dockerfile`: `ARG SITE_COUNTRY=AT` neben den vorhandenen ARGs (Zeilen 13 bis 39).
- Wächter: `site-country-guard.test.ts:60` prüft nicht mehr `'AT'`, sondern dass der Wert aus der Site kommt; Muster der Datei beibehalten.
- CI: `tests.yml` führt die Site-, Wächter- und SEO-Tests zusätzlich mit `SITE_COUNTRY=DE` aus.

## Key context
- Next.js setzt nur das Literal `process.env.X` ein; ISR-Seiten backen den Build-Wert ein (ein Image je Domain).
- Kein `headers()` oder `cookies()` in `getSite()`.
## Acceptance
- [ ] `getSite()` liefert AT ohne Variable und DE mit `SITE_COUNTRY=DE`; unbekannter Wert wirft
- [ ] `SITE_COUNTRY`, `SITE_ORIGIN`, `SITE_URL` kommen aus der Site, alle bisherigen Importe funktionieren unverändert
- [ ] `npm test` grün mit Standard und die Site- und Wächter-Tests grün mit `SITE_COUNTRY=DE`
- [ ] AT-Verhalten unverändert: Typprüfung und volle Suite ohne angepasste Erwartungen außer dem Wächter
- [ ] CI führt den DE-Lauf aus
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
