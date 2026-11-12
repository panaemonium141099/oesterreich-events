# fn-31-start-von-lasstreffende-eine-codebasis.10 Event-URLs für DE: PLZ, Post-Ort, Sitemap

## Description
Event-URLs für DE: fünfstellige PLZ, Post-Ort aus `plz-de.json`, kein Rückfall auf `0000-at`.

**Size:** M
**Files:** `src/lib/utils/slugify.ts`, `src/scripts/build-plz-ort-slugs.ts`, `src/lib/utils/plz-ort-slugs-de.generated.ts` (neu, erzeugt), `package.json` (`build:stammdaten:de`), `src/lib/events/event-detail-loaders.ts`, `src/lib/seo/sitemap-events-shard.ts`, `src/__tests__/lib/utils/slugify.test.ts`

## Approach
- `resolveEventUrlPrefix` (`slugify.ts:343`): PLZ-Muster (`:354`, `:243`) und Post-Ort-Tabelle (`plzOrtSlug`, `:362`, `:379`) je Land über die Site bzw. das Land der Zeile. Die AT-Hauptstadt-Tabelle (`:150`) gilt nur für AT.
- `build-plz-ort-slugs.ts:45` erzeugt die DE-Tabelle aus `data/plz-de.json` (Zugriff über `src/lib/location/plz-reference-de.ts`); Großkunden-PLZ liefern keinen Ort.
- DE ohne PLZ: Amts-PLZ und Name der Gemeinde aus `gemeinde_key`. Ohne Gemeinde gibt es keine URL-Vorsilbe: die Zeile ist nicht indexierbar und fehlt in der Sitemap (`sitemap-events-shard.ts`, Schwelle `quality_score >= 40` bei `:95` bleibt).
- `parseSlugArray` (`event-detail-loaders.ts:418`) prüft die PLZ-Form nicht, bleibt also; Dubletten-Weiterleitungen (`:63` bis `:503`) dürfen nie auf ein Event des anderen Landes zeigen.
- Bundle-Größe: die DE-Tabelle darf nicht ins AT-Client-Bundle (Import nur serverseitig oder je Land getrennt).

## Key context
- AT-URLs dürfen sich nicht ändern: bestehende URL-Tests sind die Absicherung, dazu ein Schnappschuss-Test über 200 echte AT-Zeilen aus einer Fixture.
## Acceptance
- [ ] AT: alle bestehenden URL-Tests und der Schnappschuss unverändert grün
- [ ] DE: URL mit fünfstelliger PLZ und Post-Ort; Fälle ohne PLZ über die Gemeinde; ohne Gemeinde keine URL und kein Sitemap-Eintrag
- [ ] Keine erzeugte DE-URL enthält `0000` oder `-at/`
- [ ] Dubletten-Weiterleitung bleibt im Land der Site (Test)
- [ ] DE-Tabelle nicht im AT-Client-Bundle
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
