# Self-Hosting: raus aus Vercel und Supabase Cloud

## Goal & Context

Der gesamte Betrieb (Web + Datenbank + Auth + Storage + Crons) zieht von
Vercel + Supabase Cloud auf **einen einzigen Hetzner CPX31** (4 vCPU AMD,
8 GB RAM, 160 GB NVMe, ~14 EUR/Monat, Standort Nuernberg/Falkenstein).

**Zwei Treiber, beide belegt:**

1. **Kosten.** Zielzustand: eine Rechnung, ~14-20 EUR/Monat inkl. Backup-Space,
   statt zwei nutzungsabhaengiger Plattform-Rechnungen.
2. **Performance.** MASTERPLAN §3.2 dokumentiert Ø 26,9 s auf der
   Top-PostgREST-Query und Ø 1,2 s pro Scrape-Insert. Ursache ist der RAM:
   Supabase Micro hat ~1 GB, das Working-Set ist groesser. Auf 8 GB passt die
   **komplette 3,2-GB-Datenbank in den Page-Cache**. Der Umzug ist damit kein
   Kosten-Kompromiss, sondern loest den groessten offenen Betriebsbefund mit.

**Gemessener Ist-Zustand (2026-08-26, live gegen prod):**

| Metrik | Wert |
|---|---|
| DB gesamt | 3.207 MB, 121 User-Tabellen |
| `events` (inkl. Indizes/TOAST) | 2.575 MB |
| `venues` / `events_archive` / `poi_activities` | 204 / 142 / 73 MB |
| Groesster Index auf `events` | `events_stale_idx`, 92 MB |
| Postgres-Version (Cloud) | 17.6.1.084 |
| `auth.users` | 56 |
| `storage.objects` | **3 Objekte, 4.469 kB** |
| Realtime-Publication `supabase_realtime` | 7 Tabellen |
| `cron.job` (pg_cron) | 6 Jobs |
| Extensions | `pg_cron`, `pg_net`, `pg_trgm`, `vector` |
| Code-Files mit `@supabase/*` | 155 |
| RLS-Policies / `auth.uid()`-Referenzen | 33 / 74 |
| API-Routes | 107, davon **0 mit Edge-Runtime** |
| Vercel-Crons (vercel.json) | 12 |
| Traffic | ~9.850 Sessions / 30 Tage (~330/Tag) |

**Korrektur zu MASTERPLAN §3.2:** der dort beschriebene 1,22-GB-Embedding-Index
`idx_events_embedding_ivfflat_future` existiert nicht mehr; `events` ist von
3,75 GB auf 2.575 MB geschrumpft. MASTERPLAN ist entsprechend zu aktualisieren.

## Architecture & Data Models

### Gewaehlter Weg: Supabase-Stack selbst hosten (nicht: Rewrite)

Supabase Cloud ist ein Bundle aus Postgres + PostgREST + GoTrue + Storage-API +
Realtime. Genau dieses Bundle laeuft als Docker-Compose auf dem eigenen Server.
`@supabase/supabase-js` spricht PostgREST — zeigt die URL auf die eigene
Instanz, **bleiben alle 155 Files unveraendert**. RLS, `auth.uid()`, die 10 RPCs
und die 87 Migrations funktionieren 1:1 weiter.

Der verworfene Alternativweg (blankes Postgres + `postgres.js`/Drizzle +
Auth.js + RLS-Ersatz in App-Logik) kostet dieselben ~14 EUR/Monat, aber ein
Quartal Arbeit und traegt hohes Regressionsrisiko ueber 107 Routes. Siehe
"Decision Context".

### Zielarchitektur (ein Host)

```
Internet
  └── Cloudflare (free)         TLS, CDN, Caching, DDoS
        └── Caddy               :80/:443, TLS-Fallback, Reverse-Proxy
              ├── lasstreffen.at      → Next.js standalone (systemd, :3000)
              └── db.lasstreffen.at   → Supabase Envoy api-gw (:8000)
                                          ├── /rest/v1   → PostgREST
                                          ├── /auth/v1   → GoTrue
                                          ├── /storage/v1→ Storage-API + imgproxy
                                          └── /realtime/v1→ Realtime
        (nur Caddy bindet oeffentlich; alle Container binden auf 127.0.0.1)

  Postgres 17.6 (Container, Volume auf NVMe)
    ├── pg_cron  → 6 bestehende Jobs (http_post-URLs muessen umgebogen werden)
    └── pg_trgm, vector, pg_net

  systemd-Timer → 12 Cron-Endpoints per curl + CRON_SECRET (Ersatz vercel.json)
  systemd-Timer → pg_dump nach Hetzner Storage Box (offsite)
```

### Image-Pins (verifiziert gegen supabase/supabase master, 2026-08-26)

| Service | Image |
|---|---|
| db | `supabase/postgres:17.6.1.136` |
| rest | `postgrest/postgrest:v14.12` |
| auth | `supabase/gotrue:v2.189.0` |
| realtime | `supabase/realtime:v2.102.3` |
| storage | `supabase/storage-api:v1.60.4` |
| imgproxy | `darthsim/imgproxy:v3.30.1` |
| meta | `supabase/postgres-meta:v0.96.6` |
| studio | `supabase/studio:2026.08.03-sha-022b374` |
| api-gw | `envoyproxy/envoy:v1.39.0` |

`supabase/edge-runtime` und `supabase/supavisor` werden **nicht** deployt:
keine Edge Functions im Repo, und ein einzelner Next.js-Prozess braucht keinen
externen Connection-Pooler (PgBouncer-Rolle uebernimmt Postgres direkt bei
`max_connections=200`).

Cloud-DB ist 17.6.1.084, Image ist 17.6.1.136 — gleiche Major/Minor-Linie,
`pg_dump`/`pg_restore` sind kompatibel.

### RAM-Budget CPX31 (8 GB)

| Posten | Reserviert |
|---|---|
| Postgres `shared_buffers` | 2 GB |
| Postgres work_mem/maintenance/Verbindungen | ~1 GB |
| Next.js (standalone, 1 Prozess) | ~1 GB |
| Realtime (Elixir/BEAM) | ~0,5 GB |
| PostgREST + GoTrue + Storage + imgproxy + meta | ~0,5 GB |
| OS + Docker + Page-Cache fuer 3,2 GB DB | Rest (~3 GB) |

Studio laeuft nur on demand (`--profile admin`), nicht dauerhaft.

**Scraping bleibt vorerst in GitHub Actions.** Das Repo ist public, Actions-
Minuten kosten also nichts (MASTERPLAN §5), und die ~144 Scraper mit
Puppeteer-core wuerden auf 4 vCPU mit der Web-Auslieferung um CPU konkurrieren.
Die Actions-Jobs bekommen lediglich neue DB-Credentials. Ein spaeterer Umzug
der Pipeline auf den Server (oder eine zweite CX22) ist eine eigene
Entscheidung, nicht Teil dieses Epics.

## API Contracts

Es aendern sich **keine** applikatorischen Contracts — nur Adressen und Secrets.

| Env-Var | Vorher | Nachher |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://booljdtrktpotsenbnut.supabase.co` | `https://db.lasstreffen.at` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cloud-JWT | neu signiert mit eigenem `JWT_SECRET` |
| `SUPABASE_SERVICE_ROLE_KEY` | Cloud-JWT | neu signiert mit eigenem `JWT_SECRET` |
| `SUPABASE_JWT_SECRET` | Cloud-Secret | eigenes 40-Zeichen-Secret |
| `SUPABASE_URL` | Cloud | `https://db.lasstreffen.at` |

`anon` und `service_role` sind bei Supabase HS256-JWTs mit `role`-Claim und
langer Laufzeit, signiert mit `JWT_SECRET`. Self-hosted werden sie einmalig neu
erzeugt; PostgREST/GoTrue/Storage teilen dasselbe Secret. **Konsequenz:** alle
56 bestehenden Sessions werden ungueltig, die User muessen sich neu einloggen.
Bei 56 Usern akzeptabel; wird in der Cutover-Kommunikation erwaehnt.

Zusaetzlich in `next.config.ts`:
- `images.remotePatterns`: `**.supabase.co` bleibt (Alt-URLs in der DB) **plus**
  neuer Eintrag `db.lasstreffen.at`.
- `output: 'standalone'` fuer ein schlankes systemd-Deployment.

Google-OAuth: In der Google Cloud Console muss
`https://db.lasstreffen.at/auth/v1/callback` als autorisierter Redirect-URI
ergaenzt werden (der Supabase-Cloud-URI bleibt bis zum Cutover bestehen).

## Edge Cases & Constraints

- **ISR-Cache liegt auf Platte.** Next.js standalone schreibt den ISR-Cache
  ins Dateisystem. Bei genau einem Prozess ist das korrekt; `revalidateTag`/
  `revalidatePath` (19 Fundstellen) funktionieren. Waechst das je auf mehrere
  Instanzen, braucht es einen geteilten Cache-Handler — heute nicht.
- **25 `export const revalidate`-Seiten + 66 `export const dynamic`** muessen
  nach dem Cutover stichprobenartig auf Cache-Verhalten geprueft werden; ohne
  Vercels Edge-Cache uebernimmt Cloudflare, das `Cache-Control` anders behandelt.
- **`private, no-store` fuer eingeloggte User** (MASTERPLAN §3.2 C) bleibt
  bestehen — der Umzug behebt das nicht, macht es aber unkritisch, weil die
  DB-Antwortzeiten einbrechen.
- **`next/og` / `ImageResponse`** (16 Fundstellen) braucht self-hosted die
  Satori-WASM aus dem Next-Bundle; im standalone-Output enthalten, aber nach
  Cutover explizit zu verifizieren.
- **`next/image`** (26 Files) optimiert self-hosted per `sharp` auf der CPU.
  Bei ~330 Sessions/Tag unkritisch; Cloudflare cached die Resultate.
- **pg_net-Jobs zeigen auf Vercel-URLs.** Die 6 pg_cron-Jobs enthalten
  `http_post`-Aufrufe gegen `*.vercel.app`/`lasstreffen.at`. Nach Cutover
  umbiegen. Dabei den in MASTERPLAN §3.2 B markierten **redundanten
  `send-reminders-hourly`-Job loeschen** (Doppelversand-Risiko gegen den
  taeglichen Cron).
- **Kein managed Backup mehr.** Taeglicher `pg_dump -Fc` auf eine Hetzner
  Storage Box (~3,20 EUR/Monat, BX11) mit 14 Tagen Retention. **Ein Restore
  muss vor dem Cutover einmal vollstaendig durchgespielt werden** — ein
  ungetestetes Backup ist kein Backup. Das ist Abnahmekriterium, nicht Kuer.
- **Single Point of Failure.** Ein Host, keine HA. Bei ~330 Sessions/Tag und
  SEO als einzigem Kanal ist ein mehrstuendiger Ausfall aergerlich, aber nicht
  existenzbedrohend. Bewusst akzeptiert.
- **Du wirst DBA/Sysadmin.** Unattended-upgrades, fail2ban, UFW, Docker-Image-
  Updates und Postgres-Minor-Updates sind ab Cutover deine Aufgabe.
- **Kein Rollback nach DNS-Wechsel ohne Datenverlust.** Sobald Schreibzugriffe
  auf der neuen DB landen, ist ein Zurueck auf Supabase Cloud nur mit
  Rueck-Dump moeglich. Deshalb: Read-Only-Fenster waehrend des finalen Dumps.
- **Storage ist trivial** (3 Objekte, 4,5 MB) — Kopie per Skript, kein S3-Sync.

## Acceptance Criteria

- [ ] CPX31 provisioniert, gehaertet (SSH-Key-only, UFW, fail2ban,
      unattended-upgrades), Docker + Compose installiert.
- [ ] Supabase-Stack laeuft mit den oben gepinnten Images; alle Container
      binden auf `127.0.0.1`, nur Caddy ist oeffentlich erreichbar.
- [ ] Postgres auf 8 GB getunt (`shared_buffers=2GB`,
      `effective_cache_size=5GB`, `max_connections=200`).
- [ ] Voller Dump aus Supabase Cloud inkl. `auth`-, `storage`- und
      `public`-Schema eingespielt; Zeilenzahlen aller 121 Tabellen stimmen
      mit der Quelle ueberein (Vergleichsskript).
- [ ] 33 RLS-Policies aktiv, `auth.uid()` liefert im Self-Hosted-Stack
      denselben Wert (verifiziert per Testquery mit User-JWT).
- [ ] Alle 10 RPCs (`search_event_ids`, `bulk_update_event_scores`,
      `apply_master_coords_bulk`, `match_*`, ...) antworten korrekt.
- [ ] Beide MVs (`event_stats_cache`, `event_map_points`) existieren und
      refreshen; pg_cron-Jobs laufen, `send-reminders-hourly` ist geloescht,
      pg_net-URLs zeigen auf lasstreffen.at.
- [ ] 56 Auth-User migriert; Google-OAuth-Login und Email/Password-Login
      funktionieren beide gegen die eigene GoTrue-Instanz.
- [ ] 3 Storage-Objekte uebertragen und ueber `db.lasstreffen.at/storage/v1`
      abrufbar.
- [ ] Next.js laeuft als systemd-Service, ueberlebt Reboot und Deploy.
- [ ] Alle 12 Cron-Endpoints laufen als systemd-Timer mit `CRON_SECRET`,
      Zeitplaene identisch zu vercel.json; `vercel.json` ist entfernt.
- [ ] Smoke-Test gruen: Landing, /entdecken, Event-Detail, Karte
      (`/api/events/map-points`), Smart-Suche, Blog-Post, Login, `/api/health`.
- [ ] **Restore-Drill bestanden:** Backup von der Storage Box auf eine leere
      DB zurueckgespielt, Zeilenzahlen verifiziert, Dauer protokolliert.
- [ ] TTFB der Landing (anonym, Cache-Hit) nach Cutover nicht schlechter als
      vorher auf Vercel — gemessen, nicht geschaetzt.
- [ ] Supabase-Projekt `booljdtrktpotsenbnut` und das Vercel-Projekt sind
      geloescht/gekuendigt — **erst nach 14 Tagen stabilem Parallelbetrieb**.
- [ ] MASTERPLAN §3 + CLAUDE.md ("Deployment", "Betrieb") auf die neue
      Architektur aktualisiert.

## Boundaries

**Nicht Teil dieses Epics:**

- Umzug der Scrape-Pipeline von GitHub Actions auf den Server. Actions sind
  gratis (public repo) und funktionieren; nur die DB-Credentials aendern sich.
- Rewrite des Datenlayers weg von `@supabase/supabase-js`. Explizit verworfen.
- Aufloesen der Social-Features (DM/Groups/Feed/Memories). Sie sind eingefroren
  (MASTERPLAN §8.6), werden aber **mitmigriert**, nicht abgeschaltet — Realtime
  und Storage sind im Stack ohnehin enthalten und kosten fast nichts.
- Ablosung von Mapbox, Brevo, Resend, Twilio, Stripe, Gemini, OpenAI. Das sind
  externe SaaS-Dienste, kein Vercel/Supabase-Thema.
- Performance-Optimierung einzelner Queries. Der RAM-Sprung erledigt den
  Grossteil; was danach noch langsam ist, ist ein eigenes Epic.
- HA, Load-Balancing, zweiter Host. Bewusst out of scope.

## Decision Context

**Warum Self-Hosting des ganzen Stacks statt Rewrite auf blankes Postgres?**

Der Kostenvorteil ist bei beiden Wegen identisch (~14 EUR/Monat). Der
Unterschied ist reine Migrationsarbeit: 155 Files mit `@supabase/*`, 33
RLS-Policies, 74 `auth.uid()`-Referenzen und 107 API-Routes. Weg A tauscht eine
URL und zwei Keys; Weg B schreibt den kompletten Datenzugriff und die
Authentifizierung neu. Bei einem Ein-Personen-Projekt mit laufendem
SEO-Traffic ist das Regressionsrisiko von Weg B nicht vertretbar.

Weg A ist ausserdem **nicht endgueltig**: GoTrue, Storage und Realtime lassen
sich spaeter einzeln herausloesen, ohne dass der Umzug daran haengt. Wer erst
migriert und dann verschlankt, hat jederzeit ein lauffaehiges System.

**Warum CPX31 (8 GB) und nicht CX32 (7 EUR) oder CPX41 (25 EUR)?**

CX32 (80 GB Platte) wird mit 3,2 GB DB + Dumps + Docker-Images knapp. CPX41
waere die richtige Wahl, wenn die Scraper mit auf die Kiste ziehen — tun sie
in diesem Epic nicht. CPX31 (8 GB / 160 GB) haelt die komplette DB im
Page-Cache und bleibt im Budget.

**Warum Cloudflare davor?**

70 % des Traffics kommt aus Google. Ohne Vercels Edge-Netz wuerde die TTFB
sonst spuerbar steigen, was direkt auf Core Web Vitals und damit auf das
Ranking schlaegt. Cloudflare Free deckt TLS, CDN und Caching ab und kostet
nichts.

**Warum kein Big-Bang-Cutover?**

Der DNS-Wechsel ist der Punkt ohne einfachen Rueckweg. Deshalb: Stack aufbauen
und mit einem Probe-Dump vollstaendig verifizieren, waehrend Vercel/Supabase
weiterlaufen. Erst wenn alle Smoke-Tests gegen die neue Umgebung gruen sind,
kommt ein kurzes Read-Only-Fenster, der finale Delta-Dump und der DNS-Switch.
Alte Umgebung bleibt 14 Tage als Notausgang stehen.
