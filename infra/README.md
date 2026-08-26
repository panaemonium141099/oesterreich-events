# infra/ — Self-Hosting-Runbook (fn-19)

Umzug von **Vercel + Supabase Cloud** auf **einen Hetzner CPX31**.
Spec: `.flow/specs/fn-19-self-hosting-raus-aus-vercel-und-supabase.md`

---

## Warum

Zwei Gruende, beide gemessen (2026-08-26, live gegen prod):

1. **Kosten** — eine Rechnung statt zwei nutzungsabhaengiger Plattformen.
   Ziel: ~17 EUR/Monat (CPX31 ~14 EUR + Storage Box BX11 ~3,20 EUR).
2. **Performance** — Supabase Micro hat ~1 GB RAM bei **3.207 MB Datenbank**.
   Daher die Ø 26,9 s auf der Top-Query und Ø 1,2 s pro Scrape-Insert aus
   MASTERPLAN §3.2. Auf 8 GB passt die komplette DB in den Page-Cache.

Der Umzug ist damit kein Kosten-Kompromiss — er loest den groessten offenen
Betriebsbefund gleich mit.

### Gewaehlter Weg

Der Supabase-Stack (Postgres + PostgREST + GoTrue + Storage + Realtime) laeuft
selbst gehostet. `NEXT_PUBLIC_SUPABASE_URL` zeigt auf `db.lasstreffen.at`,
dadurch bleiben **alle 155 Files mit `@supabase/*` unveraendert**, ebenso die
33 RLS-Policies, 74 `auth.uid()`-Referenzen, 10 RPCs und 87 Migrations.

Der Alternativweg (Rewrite auf `postgres.js`/Drizzle + Auth.js) kostet dasselbe
und wurde verworfen — Begruendung in der Spec unter "Decision Context".

---

## Dateien

| Datei | Zweck |
|---|---|
| `docker-compose.override.yml` | Overlay auf das offizielle `supabase/docker`-Setup: alles auf `127.0.0.1`, RAM-Limits, Studio nur on demand, `functions`/`supavisor` aus |
| `postgres/tuning.conf` | Postgres fuer 8 GB RAM (`shared_buffers=2GB`) |
| `Caddyfile` | TLS + Reverse-Proxy fuer `lasstreffen.at` und `db.lasstreffen.at` |
| `systemd/lasstreffen-web.service` | Next.js standalone als Dienst |
| `cron/lasstreffen.crontab` | Ersatz fuer die 12 `crons` aus `vercel.json` (in **UTC**) |
| `scripts/gen-keys.mjs` | JWT_SECRET + anon/service_role Keys erzeugen |
| `scripts/dump-from-supabase.sh` | Cloud-Dump (public / auth-data / storage-data getrennt) |
| `scripts/restore-to-selfhosted.sh` | Gegenstueck dazu |
| `scripts/verify-migration.mjs` | **Beweist**, dass der Restore vollstaendig war |
| `scripts/run-cron.sh` | Cron-Invoker mit Retry, Lock, Log und Alert |
| `scripts/backup.sh` | Taegliches Offsite-Backup + Integritaetspruefung |
| `scripts/deploy.sh` | Build + atomarer Symlink-Tausch + Rollback |

---

## Ablauf

Der Cutover ist bewusst **kein Big Bang**. Phase 1–4 laufen, waehrend
Vercel und Supabase normal weiterlaufen. Erst Phase 5 ist der Umschaltpunkt.

### Phase 1 — Server aufsetzen

```bash
# Hetzner CPX31, Ubuntu 24.04 LTS, Standort Nuernberg oder Falkenstein.
# SSH-Key beim Erstellen hinterlegen — nie Passwort-Login.

adduser --system --group --home /opt/lasstreffen lasstreffen
mkdir -p /opt/lasstreffen/{repo,releases} /etc/lasstreffen \
         /var/lib/lasstreffen/{postgres,storage} \
         /var/log/{lasstreffen,caddy} /var/backups/lasstreffen

# Haertung
ufw default deny incoming && ufw allow OpenSSH && ufw allow 80,443/tcp && ufw enable
apt install -y fail2ban unattended-upgrades postgresql-client-17 caddy \
               rsync curl git ca-certificates
systemctl enable --now fail2ban

# Docker
curl -fsSL https://get.docker.com | sh

# SSH haerten: PasswordAuthentication no, PermitRootLogin prohibit-password
```

Node 22 installieren (`engines.node = 22.x` in `package.json` — Node 24 ist
laut CLAUDE.md lokal auffaellig, in Prod bewusst 22).

### Phase 2 — Secrets erzeugen

```bash
node infra/scripts/gen-keys.mjs
```

Die Ausgabe geht in **drei getrennte Speicher** — das ist derselbe Fallstrick,
den CLAUDE.md unter „Deployment" schon fuer Vercel/GitHub beschreibt:

1. `/opt/supabase/docker/.env` — Docker-Stack
2. `/etc/lasstreffen/web.env` — Next.js (`chmod 640`, `root:lasstreffen`)
3. GitHub-Actions-Secrets — Scrape-Pipeline + Eventim-Import

Dazu die bestehenden Secrets aus der Vercel-Env uebernehmen: `CRON_SECRET`,
`GEMINI_API_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `BREVO_API_KEY`,
`RESEND_API_KEY`, `TWILIO_*`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `VAPID_*`,
`EVENTIM_FEED_*`, `UNSUBSCRIBE_SECRET`, `GOOGLE_INDEXING_API_SA_KEY` usw.

> **Merker aus MASTERPLAN:** Das Eventim-Feed-Passwort stand bis 08.07. im
> Klartext in der public History. Der Umzug ist der richtige Moment, es bei
> Eventim rotieren zu lassen.

### Phase 3 — Stack hochfahren

```bash
git clone --depth 1 https://github.com/supabase/supabase /tmp/supabase
mkdir -p /opt/supabase && cp -r /tmp/supabase/docker /opt/supabase/
cd /opt/supabase/docker
cp .env.example .env          # dann mit den Werten aus Phase 2 fuellen
ln -s /opt/lasstreffen/infra/docker-compose.override.yml docker-compose.override.yml

docker compose up -d
sleep 60                       # GoTrue + storage-api legen ihre Schemas an
docker compose ps              # alle Container "healthy"?
```

> **Reihenfolge ist kritisch.** GoTrue und storage-api migrieren beim ersten
> Start ihre eigenen Schemas. Wer zuerst restored und dann startet, bekommt
> Migrations-Kollisionen im `auth`-Schema. Das ist der haeufigste Fehler bei
> dieser Migration.

**Image-Pins pruefen.** Vor jedem `git pull` im Upstream gegen die Liste in
`docker-compose.override.yml` diffen. Ein Postgres-Major-Sprung im Upstream
wuerde das Daten-Volume unbrauchbar machen.

### Phase 4 — Daten migrieren und verifizieren

```bash
# Auf dem Server, Verbindungsstring aus dem Supabase-Dashboard
# (Project Settings → Database → Connection string).
# Bei fehlendem IPv6: Session-Pooler nehmen, Port 5432 — NICHT 6543.
export SUPABASE_DB_URL='postgresql://postgres:...@...:5432/postgres'
./infra/scripts/dump-from-supabase.sh /var/backups/lasstreffen/migration

export PGPASSWORD='<POSTGRES_PASSWORD>'
./infra/scripts/restore-to-selfhosted.sh /var/backups/lasstreffen/migration

node infra/scripts/verify-migration.mjs /var/backups/lasstreffen/migration
```

`verify-migration.mjs` prueft Zeilenzahlen aller 121 Tabellen gegen die
Baseline, RLS-Policies, Funktionen, MVs, Indizes, die 10 RPCs, Extensions,
Auth-User und ob RLS tatsaechlich **aktiv** ist. Exit 1 = nicht abgenommen.

> `pg_restore` meldet Fehler auf stderr und laeuft trotzdem weiter. Ein
> Restore, der 118 von 121 Tabellen gefuellt hat, sieht im Terminal aus wie
> ein Erfolg. Deshalb ist das Skript kein Optional.

Danach von Hand:

- **pg_cron-Jobs** aus `pgcron-jobs.txt` neu anlegen. Dabei die
  `http_post`-URLs auf `https://lasstreffen.at` umbiegen,
  `send-reminders-hourly` **weglassen** (redundant zum taeglichen Cron,
  Doppelversand-Risiko, MASTERPLAN §3.2 B) und `refresh-event-stats-cache`
  von 5 auf 30 Minuten stellen.
- **Storage-Dateien** (3 Objekte, 4,5 MB) aus dem Supabase-Dashboard
  herunterladen und nach `/var/lib/lasstreffen/storage/` legen.
- **Google-OAuth**: In der Cloud Console
  `https://db.lasstreffen.at/auth/v1/callback` als Redirect-URI ergaenzen.
  Den Supabase-Cloud-URI stehen lassen, bis der Parallelbetrieb vorbei ist.

### Phase 5 — Web + Cutover

```bash
git clone <repo> /opt/lasstreffen/repo
cp infra/systemd/lasstreffen-web.service /etc/systemd/system/
cp infra/Caddyfile /etc/caddy/Caddyfile
cp infra/cron/lasstreffen.crontab /etc/cron.d/lasstreffen
chmod 644 /etc/cron.d/lasstreffen
systemctl daemon-reload
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy

./infra/scripts/deploy.sh origin/master
```

**Smoke-Test gegen die Server-IP, bevor DNS umgestellt wird** (`/etc/hosts`
lokal eintragen):

- [ ] Landing, `/entdecken`, ein Event-Detail, eine Gemeinde-Seite
- [ ] Karte → `/api/events/map-points` liefert Punkte (MV befuellt?)
- [ ] Smart-Suche (Gemini-Intent), Concierge-SSE-Stream
- [ ] Ein Blog-Post inkl. Affiliate-Ticket-Box
- [ ] Login: **Google-OAuth und Email/Password** gegen eigene GoTrue-Instanz
- [ ] `/api/health`
- [ ] Browser-Konsole: **keine CSP-Verstoesse** — der haeufigste Cutover-Fehler
      (siehe `next.config.ts`, fn-19-Block)
- [ ] Ein Bild aus Storage laedt ueber `db.lasstreffen.at/storage/v1`

**Restore-Drill** — Abnahmekriterium, nicht Kuer:

```bash
createdb -h 127.0.0.1 -U postgres restore_drill
PGDATABASE=restore_drill ./infra/scripts/restore-to-selfhosted.sh /var/backups/lasstreffen/migration
PGDATABASE=restore_drill node infra/scripts/verify-migration.mjs /var/backups/lasstreffen/migration
dropdb -h 127.0.0.1 -U postgres restore_drill
```

Dauer protokollieren. Im Ernstfall willst du wissen, ob du von 20 Minuten
oder 3 Stunden Ausfall ausgehst.

**Erst dann** der Umschaltpunkt:

1. TTL der DNS-Records auf 300 s senken, **24 h vorher**.
2. Kurzes Read-Only-Fenster: Vercel-Deployment pausieren, GitHub-Actions-
   Workflows deaktivieren, pg_cron in der Cloud abschalten.
3. Delta-Dump ziehen und einspielen (`restore-to-selfhosted.sh` ist idempotent).
4. `verify-migration.mjs` erneut.
5. DNS umstellen — `db.lasstreffen.at` **grau** (DNS only), `lasstreffen.at`
   erst grau, nach gruenem Smoke-Test auf orange mit SSL-Modus
   „Full (strict)".
6. GitHub-Actions-Secrets auf die neue DB umstellen, Workflows reaktivieren.
7. `vercel.json` aus dem Repo entfernen.

### Phase 6 — Nachlauf

**14 Tage Parallelbetrieb.** Vercel-Projekt und Supabase-Projekt
`booljdtrktpotsenbnut` bleiben als Notausgang stehen. Erst danach kuendigen
bzw. loeschen.

Nachmessen, nicht annehmen:

- TTFB der Landing (anonym, Cache-Hit) gegen den Vercel-Wert von vorher.
- `log_min_duration_statement = 1000` — die Slow-Query-Liste sollte nach dem
  RAM-Sprung fast leer sein. Ist sie es nicht, ist das ein eigener Befund.
- Cache-Verhalten der 25 `export const revalidate`-Seiten unter Cloudflare.

Dann `docs/MASTERPLAN.md` §3 und `CLAUDE.md` („Betrieb", „Deployment") auf die
neue Architektur ziehen.

---

## Bekannte Grenzen — bewusst akzeptiert

- **Single Point of Failure.** Ein Host, kein HA. Bei ~330 Sessions/Tag
  vertretbar, aber ein Plattendefekt heisst Ausfall bis zum Restore. Genau
  deshalb ist der Restore-Drill Pflicht.
- **Du bist ab jetzt DBA und Sysadmin.** Docker-Images, Postgres-Minors,
  TLS, Kernel-Updates.
- **Kein einfacher Rueckweg nach dem DNS-Wechsel.** Sobald Schreibzugriffe auf
  der neuen DB landen, geht zurueck nur per Rueck-Dump. Deshalb das
  Read-Only-Fenster.
- **ISR-Cache liegt auf Platte** und funktioniert nur bei genau einem
  Next.js-Prozess. Mehrere Instanzen braeuchten einen geteilten Cache-Handler.
- **Scraping bleibt in GitHub Actions.** Repo ist public, Actions kosten
  nichts, und die ~144 Puppeteer-Scraper wuerden auf 4 vCPU mit der
  Web-Auslieferung um CPU konkurrieren. Nur die DB-Credentials aendern sich.
