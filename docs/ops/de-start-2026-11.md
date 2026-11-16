# lasstreffen.de: Betrieb der zweiten Seite (fn-31.15)

Stand 16.11.2026. Eine Codebasis, eine Datenbank, zwei Images: `lasstreffen-app`
(Österreich) und `lasstreffen-app-de` (Deutschland). Land und Domain stehen im
Build fest (`SITE_COUNTRY`, `src/lib/site/`).

## Was wo läuft

| Teil | lasstreffen.at | lasstreffen.de |
|---|---|---|
| Image | `lasstreffen-app:latest` (+ `:previous`) | `lasstreffen-app-de:latest` (kein `:previous`) |
| Compose-Dienst, Container | `nextjs`, `nextjs-app` | `nextjs-de`, `nextjs-app-de` |
| Port am Server | 127.0.0.1:3000 | 127.0.0.1:3001 |
| Speichergrenze | 2,5 GB | 1,5 GB |
| Deploy | Job `deploy` in `deploy.yml` | Job `deploy-de`, nur mit Repo-Variable `DEPLOY_DE=on` |
| ISR-Wächter | `lt-isr-guard.timer` | `lt-isr-guard-de.timer` (Grenze 3 GB) |
| Mitternachts-Neubau | `lt-cron@revalidate-landing.timer` | `lt-cron-de@revalidate-landing.timer` |
| Caddy | `lasstreffen.at`, `www` | `lasstreffen.de`, `www`, Vorschau `deutschland.lasstreffen.at` (noindex) |
| Bot-Log | `/data/bot-access.log` | `/data/bot-access-de.log` |
| Auswertung | `analytics_events.site = 'AT'` | `analytics_events.site = 'DE'` |

Beide Container lesen `/opt/app/.env.master`; der Dienst `nextjs-de`
überschreibt `SITE_COUNTRY`, `NEXT_PUBLIC_SITE_URL` und schaltet Werbung ab.
Timer, die Mails senden oder Daten pflegen (Erinnerungen, Newsletter, Outreach,
Feratel, SEO), laufen nur gegen Port 3000: sie arbeiten auf der gemeinsamen
Datenbank und dürfen nicht doppelt laufen.

## Deploy

`deploy.yml` baut nach dem AT-Deploy das DE-Image im Runner
(`scripts/deploy/build-image.sh` mit `SITE_COUNTRY=DE`) und schickt es an
`/opt/app/deploy-image.sh --site de <commit>`. Dieselbe Sperre wie AT
(`/var/lock/lt-deploy.lock`), nie zwei Starts zugleich. Ein roter DE-Deploy
lässt AT unberührt.

Abschalten: Repo-Variable `DEPLOY_DE` löschen oder auf `off`. Der Container
läuft dann mit dem letzten Image weiter.

## Caddy

Der Schutz der Website (Rate-Limits, Bot-Sperren, Log) steht als Baustein
`(lt_site)` einmal in der Caddyfile und wird je Seite eingebunden:

```
lasstreffen.at { import lt_site nextjs-app:3000 site bot-access.log }
lasstreffen.de { import lt_site nextjs-app-de:3000 de bot-access-de.log }
```

Argumente: Ziel-Container, Präfix der Rate-Limit-Zonen (je Seite eigene
Zähler), Log-Datei. Vor dem Umbau geprüft: die Route für `lasstreffen.at` ist
in der übersetzten Konfiguration (`caddy adapt`) gleich geblieben, bis auf die
internen Gruppennummern. Sicherung: `Caddyfile.bak-2026-11-16`.

Neu laden nach einer Änderung:

```bash
docker exec supabase-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec supabase-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

## Domain umziehen (offen, braucht den Registrar)

`lasstreffen.de` liegt bei den Nameservern `ns1/ns2.yoursrs.com` und zeigt auf
185.253.212.22 (16.11.2026), nicht auf den Server. Schritte:

1. Zone `lasstreffen.de` in Cloudflare anlegen (gleiches Konto wie .at).
2. Beim Registrar die Nameserver auf die zwei von Cloudflare genannten umstellen.
3. In der Zone: `A lasstreffen.de → 157.180.42.4` und `CNAME www → lasstreffen.de`,
   beide über den Proxy. Regeln wie bei .at (`docs/ops/cloudflare/cf-setup.py`).
4. Caddy holt das Zertifikat selbst, sobald die Domain auf den Server zeigt.
5. Google Search Console: Property `lasstreffen.de` anlegen,
   `https://lasstreffen.de/sitemap.xml` einreichen.

Bis dahin ist die Seite unter `https://deutschland.lasstreffen.at` zu sehen.
Diese Adresse sendet `X-Robots-Tag: noindex, nofollow`; Canonical und Sitemap
nennen schon `lasstreffen.de`.

## Rückwege

- **DE-Container aus:** `cd /opt/app && docker compose stop nextjs-de`, Variable
  `DEPLOY_DE` löschen. Caddy antwortet auf den DE-Hosts dann 502, .at läuft weiter.
- **Voriger DE-Stand:** den vorigen Commit neu deployen (kein `:previous` für .de).
- **Caddy:** `cp Caddyfile.bak-2026-11-16 Caddyfile`, dann neu laden.
- **Skripte:** `deploy-image.sh`, `isr-guard.sh`, `watchdog.sh`,
  `docker-compose.yml` haben je eine Kopie `.bak-2026-11-16` in `/opt/app`.

## Platte

Vor dem Start 86 % belegt (75 GB), am 16.11. um 13:24 erreichte sie 90 % und
der Wächter erzeugte den AT-Container neu. Das DE-Image kommt dazu. Der
Build-Cache (13,7 GB, aus der Zeit, als der Server selbst baute) lässt sich mit
`docker builder prune -a` nicht leeren. Beobachten: `df -h /`,
`/var/log/lt-isr-guard.log`.
