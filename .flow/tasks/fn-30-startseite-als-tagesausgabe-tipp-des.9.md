# fn-30-startseite-als-tagesausgabe-tipp-des.9 Doku, EXPLAIN gegen Prod, Build-Statik-Check und Screenshots

## Description
## Ziel
Abschluss: Dokumentation, Prod-Prüfungen und Verifikation der gesamten Tagesausgabe. Größe S.

## Kontext
- CLAUDE.md: Eintrag `src/app/page.tsx` (Pfad `src/app/[locale]/page.tsx`, Sektionen der
  Tagesausgabe, `PersonalizedMatches` weg), `src/app/api/me/landing/route.ts` (`followedLive`,
  `followedNames`), Eventim-Absatz (`event_artists`), `fuer-firmen`-Zeile (Tipp des Tages über
  `/api/admin/landing-feature`, `kind='sponsored'`), „Bekannte Issues“ Karten-Badges-Absatz
  streichen, API-Rechte-Absatz um `event_artists`-Policy ergänzen.
- MASTERPLAN §10.2 (Badges-Satz streichen, `followedLive`), §7.2 (Tipp des Tages als
  Boost-Platz, Kennzeichnung „Anzeige“), Ops-Notiz Cron 00:05.
- `docs/design/landing-redesign/README.md`: Zeile „Implementiert: PR #…, Datum“.
- EXPLAIN der Künstler-Rotation und des Programm-Pools gegen Prod (nur lesend, über MCP oder
  Dashboard), Ergebnis im PR.
- Voraussetzung: die drei Migrationen aus Task 1 (`20261029200000_event_artists.sql`,
  `20261029200100_landing_features_kind.sql`, `20261029200200_stats_country_total.sql`) liegen
  nur als Dateien vor und sind in Prod noch nicht ausgeführt; vor EXPLAIN und Prod-Checks im
  Dashboard/MCP ausführen, danach `NOTIFY pgrst, 'reload schema'`. Ops-Nachtrag zur
  `event_artists`-Policy steht schon in `docs/ops/funktionsrechte-prod-stand-2026-10-08.md`.
  <!-- Updated by plan-sync: fn-30.1 lieferte Migrationen nur als Datei, Prod-Ausführung offen -->
- `next build && next start`: `x-nextjs-cache: HIT` auf `/` und `/en`; Screenshots Desktop
  1440 und Handy 390 für `/`, `/entdecken`, `/wien`; `/admin/boost` Buchung und 409.
- Analytics: `landing_tip_click`, `landing_map_open`, `landing_artist_follow` kommen in
  `analytics_events` an (Dev-Check gegen die Route).
- fn-19: Abhängigkeit auf fn-30 setzen (`flowctl epic add-dep`).

**Files:** `CLAUDE.md`, `docs/MASTERPLAN.md`, `docs/design/landing-redesign/README.md`.
## Acceptance
- [ ] CLAUDE.md, MASTERPLAN §10.2 und §7.2, README-Status sind aktualisiert und nennen keine
      entfernten Komponenten mehr.
- [ ] EXPLAIN-Ergebnisse (Rotation, Programm) im PR, keine Seq-Scans über `events`.
- [ ] `x-nextjs-cache: HIT` auf `/` und `/en` belegt; Screenshots Desktop/Handy für `/`,
      `/entdecken`, `/wien` im PR.
- [ ] Drei neue `data-track`-Marker erzeugen Zeilen in `analytics_events` (Dev-Check).
- [ ] fn-19 hängt von fn-30 ab; `npm test` grün.
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
