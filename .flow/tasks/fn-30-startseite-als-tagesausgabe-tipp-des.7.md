# fn-30-startseite-als-tagesausgabe-tipp-des.7 Admin: Tipp des Tages buchen (kind, sponsor_name, Wiener Tag, 409, revalidate) + Cron revalidate-landing

## Description
## Ziel
Admin bucht den Tipp des Tages für einen Wiener Kalendertag; ISR wird nach Änderungen und um
Mitternacht erneuert. Größe M.

## Kontext
- `src/app/api/admin/landing-feature/route.ts`: Body `{eventId, featured, until?, note?}`,
  Rollencheck admin/god, Upsert `onConflict 'event_id'` (89-102), Delete bei `featured:false`,
  `revalidatePath('/[locale]','page')` (28-30). `starts_at` ist heute immer `now()`.
- Neu: Body `{eventId, kind: 'sponsored'|'editorial', sponsorName?, day?: 'YYYY-MM-DD',
  until?, note?}`. `sponsored`: Pflichtfelder `sponsorName` und `day`; `starts_at`/`ends_at` =
  00:00/24:00 des Tages in Europe/Vienna (`viennaDayRange` aus `src/lib/utils/event-time.ts`);
  liegt für diesen Tag schon eine `sponsored`-Zeile eines anderen Events vor → 409 mit
  Hinweis auf das belegte Event. `editorial`: wie bisher (Fenster `until`).
- Validierung: Event muss `published`, `country = SITE_COUNTRY` und am Buchungstag nicht
  vorbei sein; sonst 422.
- Schema aus Task 1 (`supabase/migrations/20261029200100_landing_features_kind.sql`): `kind`
  Default `editorial` (die Route verlässt sich bis zu diesem Task auf den Default), Checks
  `landing_features_kind_check` und `landing_features_sponsor_name_check` (sponsored ohne
  `sponsor_name` scheitert in der DB mit 23514, die Route prüft vorher auf 400), Index
  `landing_features_kind_active_idx (kind, starts_at, ends_at)` für die 409-Prüfung. Typ in
  `src/types/database.ts` (`kind: 'sponsored' | 'editorial'`). Migration in Prod noch nicht
  ausgeführt; ohne sie antwortet PostgREST auf `kind`/`sponsor_name` mit 400.
  <!-- Updated by plan-sync: fn-30.1 Migrationsname, Constraint-/Indexnamen, Prod-Ausführung offen -->
- `/admin/boost` (`src/app/[locale]/admin/boost/page.tsx:59-70, 169-176, 323-376`): Felder
  Art (Anzeige/Redaktion), Sponsorname, Tag; Liste zeigt aktive und künftige Buchungen mit
  Status (aktiv, geplant, abgelaufen, Event nicht mehr sichtbar). Client-Helfer
  `setLandingFeature` in `src/lib/admin/boost.ts:37` erweitern. Texte „Saison-Karte“ anpassen.
- Cron: `GET /api/cron/revalidate-landing` mit Bearer `CRON_SECRET` (Muster der bestehenden
  `/api/cron/*`-Routen), ruft `revalidatePath` für `/` und `/en`. Zeitplan 00:05 Wien über die
  `lt-cron@`-Timer auf Hetzner (nur Ops-Notiz, kein Server-Zugriff in diesem Task) bzw.
  `vercel.json`-Cron, falls dort noch Crons laufen.

**Files:** `src/app/api/admin/landing-feature/route.ts`, `src/lib/admin/boost.ts`,
`src/app/[locale]/admin/boost/page.tsx`, `src/app/api/cron/revalidate-landing/route.ts`
(neu), `src/__tests__/api/admin-landing-feature.test.ts` (neu oder erweitern),
`docs/MASTERPLAN.md` (Ops-Notiz Cron).
## Acceptance
- [ ] POST mit `kind='sponsored'`, `sponsorName`, `day` legt eine Zeile mit Wiener
      Tagesgrenzen an; zweite Buchung desselben Tages für ein anderes Event → 409 (Test).
- [ ] `sponsored` ohne `sponsorName` oder `day` → 400; Event nicht published, nicht AT oder
      vorbei → 422 (Test).
- [ ] `editorial` verhält sich wie bisher; bestehende Pins bleiben Saison-Picks.
- [ ] `/admin/boost` zeigt Art, Sponsor, Tag und Status je Buchung und kann künftige Tage buchen.
- [ ] `/api/cron/revalidate-landing` verlangt den Bearer, revalidiert `/` und `/en`
      (Test mit gemocktem `revalidatePath`); MASTERPLAN nennt den 00:05-Timer.
- [ ] `npm test` grün.
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
