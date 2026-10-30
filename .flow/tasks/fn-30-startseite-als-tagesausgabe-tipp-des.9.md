# fn-30-startseite-als-tagesausgabe-tipp-des.9 Doku, EXPLAIN gegen Prod, Build-Statik-Check und Screenshots

## Description
## Ziel
Abschluss: Dokumentation, Prod-Prüfungen und Verifikation der gesamten Tagesausgabe. Größe S.

## Kontext
- CLAUDE.md: Eintrag `src/app/page.tsx` (Pfad `src/app/[locale]/page.tsx`, Sektionen der
  Tagesausgabe, `PersonalizedMatches` weg), `src/app/api/me/landing/route.ts` (`followedLive`,
  `followedNames`), Eventim-Absatz (`event_artists`: geschrieben nach dem Event-Upsert von
  `syncEventArtists` in `src/lib/db/event-artists-sync.ts`, Künstler als Nebenergebnis
  `EventimArtistsByEvent` von `parseEventimFeed`, alle Feed-Länder; ein Fehler im
  Künstler-Schritt macht `import-eventim.ts` mit Exit 1 und die Cron-Route mit 500 rot, der
  Event-Import bleibt gültig), `fuer-firmen`-Zeile (Tipp des Tages über
  `/api/admin/landing-feature`, `kind='sponsored'`), „Bekannte Issues“ Karten-Badges-Absatz
  streichen, API-Rechte-Absatz um `event_artists`-Policy ergänzen.
  <!-- Updated by plan-sync: fn-30.2 Schreibmodul und Fehlerverhalten des Künstler-Schritts -->
  Stand nach Task 4: Client-Personalisierung der Landing läuft über `ArtistsLive`
  (`src/components/Landing/v4/ArtistsLive.tsx`, holt `/api/me/landing` nur mit sb-Cookie,
  Folgen/Entfolgen über `/api/artists/follow`) statt `PersonalizedMatches`. `followedLive`
  (Form `LandingArtistLive`) baut der reine Helfer `src/lib/v4/followed-live.ts`
  (ilike-Vorauswahl auf `event_artists.artist_name`, Abgleich in JS); `followedNames` sind
  normalisiert. `normalizeArtistName`/`stripDiacritics` liegen jetzt client-sicher in
  `src/lib/artists/normalize-name.ts` (Re-Export aus `artist-matching.ts`). Die Kachel
  verspricht keine Mails, weil Künstler-Alert-Mails standardmäßig aus sind (`RESEND_API_KEY`
  + `channel_email`); MASTERPLAN/CLAUDE.md nicht anders formulieren. `savedEventIds`,
  `artistMatchEventIds`, `lineupMatchEventIds` und `matches` liefert die Route weiter, nach
  Task 6 ohne Leser.
  <!-- Updated by plan-sync: fn-30.4 ArtistsLive, followed-live.ts, normalize-name.ts -->
- MASTERPLAN §10.2 (Badges-Satz streichen, `followedLive`), §7.2 (Tipp des Tages als
  Boost-Platz, Kennzeichnung „Anzeige“), Ops-Notiz Cron 00:05.
  Stand nach Task 7: §7.2 (Absatz „Tipp des Tages“) und §10.2 Punkt 5 (Mitternacht und
  Buchungen: `revalidateLanding()` aus `src/lib/landing/revalidate-landing.ts`,
  `GET /api/cron/revalidate-landing`, Timer 00:05 Europe/Vienna, `landing_features.kind`,
  `/admin/boost`) sind schon geschrieben; hier nur prüfen, nicht neu schreiben. Offen in §10.2
  bleiben der Badges-Satz und `followedLive`.
  Ops, noch offen: systemd-Timer `lt-cron@revalidate-landing.timer` auf Hetzner
  (`OnCalendar=*-*-* 00:05:00 Europe/Vienna`, curl mit Bearer `CRON_SECRET` auf
  `127.0.0.1:3000/api/cron/revalidate-landing`); einrichten lassen oder im PR als offen nennen.
  `vercel.json` hat keine Crons mehr. Für CLAUDE.md: die Cron-Route in den Betriebs-Abschnitt.
  <!-- Updated by plan-sync: fn-30.7 hat §7.2 und §10.2 Punkt 5 schon geschrieben, Timer offen -->
- `docs/design/landing-redesign/README.md`: Zeile „Implementiert: PR #…, Datum“.
- EXPLAIN der Künstler-Rotation und des Programm-Pools gegen Prod (nur lesend, über MCP oder
  Dashboard), Ergebnis im PR.
  Abfrageformen aus `src/lib/v4/get-landing-data.ts` (Task 3): Rotation (Label `artists`) =
  `events` mit `artists:event_artists!inner(...)`, `country = 'AT'`,
  `publish_status = 'published' OR duplicate_of IS NOT NULL`, `start_date` von jetzt bis
  Beginn Wiener Tag + 7, `ORDER BY event_score DESC LIMIT 120` (danach Primaries per
  `.in('id', …)`); Programm (Label `program`) = `events` published, `country`, `start_date`
  von 17:00 Wien bis Ende Wiener Tag, `ORDER BY event_score DESC LIMIT 60`. Auswahl-Logik
  in `src/lib/v4/landing-picks.ts`, Karten-URL in `src/lib/v4/map-static-url.ts` (für den
  CLAUDE.md-Eintrag der Landing).
  <!-- Updated by plan-sync: fn-30.3 tatsächliche Abfrageformen und Dateien der Datenschicht -->
- Voraussetzung: die drei Migrationen aus Task 1 (`20261029200000_event_artists.sql`,
  `20261029200100_landing_features_kind.sql`, `20261029200200_stats_country_total.sql`) liegen
  nur als Dateien vor und sind in Prod noch nicht ausgeführt; vor EXPLAIN und Prod-Checks im
  Dashboard/MCP ausführen, danach `NOTIFY pgrst, 'reload schema'`. Ops-Nachtrag zur
  `event_artists`-Policy steht schon in `docs/ops/funktionsrechte-prod-stand-2026-10-08.md`.
  <!-- Updated by plan-sync: fn-30.1 lieferte Migrationen nur als Datei, Prod-Ausführung offen -->
  Solange `20261029200000_event_artists.sql` in Prod fehlt, endet jeder Eventim-Import
  (`import-eventim.yml` alle 6 h, `/api/cron/eventim`) wegen des Künstler-Schritts rot; die
  Kachel „Diese Woche live“ und `followedLive` bleiben leer, bis danach ein Import gelaufen ist.
  <!-- Updated by plan-sync: fn-30.2 Künstler-Schritt rot bis Migration in Prod -->
- `next build && next start`: `x-nextjs-cache: HIT` auf `/` und `/en`; Screenshots Desktop
  1440 und Handy 390 für `/`, `/entdecken`, `/wien`; `/admin/boost` Buchung und 409.
  Offen aus Task 8 (kein Dev-Server im Worktree): Sichtprüfung der Regal-Spur
  (`ShelfTrack`, `.v4-shelf-track`) auf `/entdecken`, `/wien`, `/thema/<slug>`, `/studenten`:
  rechte Spurkante = Inhaltskante per `getBoundingClientRect`, erste Karte bündig, Fokusring
  nicht abgeschnitten, Handy-Verlauf bei `data-more`, kein horizontales Scrollen; Screenshots
  in den PR.
  <!-- Updated by plan-sync: fn-30.8 Sichtprüfung der Spur offen, hier nachzuholen -->
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
