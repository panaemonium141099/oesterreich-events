# fn-18-freizeitaktivitaeten-poi-bestand.1 Fundament: poi_activities-Migration + Activity-Lib (Mapping/Slug/Gemeinde/Preis)

## Description
Fundament fuer alle weiteren Slices: DB-Migration fuer `poi_activities` plus pure Library-Module (testbar ohne Netz/DB).

**Size:** M
**Files:** supabase/migrations/<ts>_poi_activities.sql, supabase/migrations/<ts>_poi_activities_indexes.sql (separat, erst nach Bulk-Load anwenden!), src/lib/activities/taxonomy.ts, src/lib/activities/slug.ts, src/lib/activities/gemeinde-match.ts, src/lib/activities/price-hint.ts, src/__tests__/lib/activities/*

## Approach
- Migration analog supabase/migrations/20260424_activities_delete_policy.sql-Stil: Tabelle laut Epic-Spec-Schema (E1), UNIQUE(source, source_id), RLS public-read, KEINE GIN/trgm-Indizes in der Basis-Migration (Epic E-Praxis: Indizes erst nach Initial-Load, zweite Migration).
- ACHTUNG: Tabellenname `poi_activities` — `activities` ist die Social-Feed-Tabelle (Namens-Kollision, Epic E1).
- taxonomy.ts: kuratierte Deskline-Topic-Whitelist -> bestehende TAGS-Werte (read-only-Import der Typen aus enrichment-taxonomy.ts erlaubt, Datei selbst NICHT aendern — fn-14-Konflikt, Epic E3). Whitelist muss Action/Freizeit/Familie/Baeder/Kultur abdecken (Kartsport/Kartbahn, Sommerrodelbahn, Hochseilgarten, Klettersteig, Freibad, Museum, ...); Gastro/Shops/Weingueter/E-Ladestationen -> nicht importieren. Unmapped Topics -> skip + Log-Liste.
- slug.ts: slugify(name) + shortid(source_id); Slug wird beim Insert fixiert, nie regeneriert (Epic E5).
- gemeinde-match.ts: nearest-Haversine gegen ALL_GEMEINDEN (src/lib/gemeinden/data.ts, haversineKm wiederverwenden) (Epic E4).
- price-hint.ts: deterministischer Euro-Regex mit Anti-Patterns (Jahreszahlen "ab 2018", Hausnummern, kW-Angaben) — kein KI-Enrichment.
## Acceptance
- [ ] Basis-Migration + separate Index-Migration liegen in supabase/migrations/ (Anwendung via Dashboard dokumentiert im Migrations-Header)
- [ ] enrichment-taxonomy.ts unveraendert (git diff leer fuer die Datei)
- [ ] Vitest: Topic-Mapping (inkl. unmapped->skip), Slug-Stabilitaet + Kollisionsfreiheit, Gemeinde-Match (Testfaelle mit echten Koordinaten, z.B. Mountaincart Fulseck -> Dorfgastein), Euro-Regex inkl. Anti-Patterns
- [ ] Whitelist-Review: mindestens 30 gemappte Topics, dokumentiert in taxonomy.ts-Kommentarkopf
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
