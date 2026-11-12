# fn-31-start-von-lasstreffende-eine-codebasis.15 Betrieb der zweiten Domain: Container, Caddy, Cloudflare, Auswertung

## Description
Betrieb der zweiten Domain: Container, Caddy, Cloudflare, Timer, Auswertung je Domain. Braucht die Entscheidungen 1 (Domain) und 6 (Server) und das Ja aus der Kapazitätsaussage.

**Size:** M
**Files:** `docs/ops/cloudflare/cf-setup.py`, `docs/ops/server/README.md`, `docs/ops/cloudflare-proxy-2026-10.md`, Caddy-Vorlage unter `docs/ops/server/`, `src/components/Analytics/*`, `src/app/api/analytics/*`, `src/lib/seo/snapshot.ts`, `docs/ops/server/watchdog.sh`

## Approach
- Caddy: Site-Block für lasstreffen.de und www mit denselben Schnipseln (`client_ip`, Sperrlisten, Rate-Limits), Upstream `nextjs-app-de`.
- Cloudflare: eigene Zone, `cf-setup.py` nimmt die Zone als Parameter, Token um die Zone erweitern.
- Timer je Container: `revalidate-landing`, ISR-Guard, Health; Warm-on-Start läuft schon je Container.
- Auswertung: `analytics_events` je Domain trennbar (vorhandenes Feld prüfen, sonst eines ergänzen), Traffic-Audit je Domain, GSC-Property und `GSC_SITE_URL` je Site, Sitemap einreichen.
- Mapbox: Kontingent und eine URL-Beschränkung des Tokens, falls gesetzt, prüfen.
- AdSense und Affiliate bleiben aus, bis Entscheidung 7 vorliegt.
- Alles Serverseitige als Schritt-für-Schritt-Anleitung im Repo; ausführen darf es nur der Nutzer oder eine ausdrückliche Freigabe.

## Key context
- Cloudflare-Fallen stehen in `docs/ops/cloudflare-proxy-2026-10.md` (IP-gefiltertes Token, `curl -4`).
- Der Watchdog darf nicht über die eigene Bot-Sperre prüfen (403-Fehlalarm, PR #467).
## Acceptance
- [ ] lasstreffen.de und www antworten über Cloudflare und Caddy mit 200, Health grün
- [ ] Timer und ISR-Guard laufen für beide Container, Alarm-Mails nennen die Domain
- [ ] Pageviews je Domain getrennt auswertbar, Traffic-Audit je Domain
- [ ] GSC-Property für .de angelegt, Sitemap eingereicht
- [ ] Anleitung im Repo deckt jeden Serverschritt und den Rückweg
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
