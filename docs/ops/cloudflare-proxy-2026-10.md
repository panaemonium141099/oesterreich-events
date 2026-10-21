# Cloudflare (Free) als Proxy vor lasstreffen.at (Oktober 2026)

Stand: Plan geschrieben 2026-10-17, vor jeder Änderung. Jeder Schritt hat
einen Rückweg. Was hier als „geprüft“ steht, wurde am Live-System oder in der
Cloudflare-Doku nachgelesen, nichts davon ist angenommen.

## 1. Warum

AdSense ist seit 16.09.2026 wegen ungültiger Zugriffe eingeschränkt. Drei
Bot-Wellen wurden nacheinander einzeln in Caddy gesperrt (AWS-Headless-Farm
per UA, Tencent-Farm per Rechenzentrums-Netzen, Baidu-Render-Crawler
Chrome/99 aus 116.179.33.x per UA und Netz). Caddy sieht nur die eigene
Site; Cloudflare bewertet Clients über Millionen Sites (TLS-Fingerprint,
IP-Reputation, JS-Detections) und stellt unbekannten Automaten eine
Challenge, bevor sie Next.js, Postgres und AdSense erreichen.

## 2. Ist-Stand (gemessen 2026-10-17)

- DNS bei Internex (ns1-4.internex.at), TTL 3600. Zone (per dig gegen
  ns1.internex.at, AXFR verweigert, deshalb per Einzelabfrage):

  | Name | Typ | Wert | Zweck |
  |---|---|---|---|
  | lasstreffen.at | A | 157.180.42.4 | Website (Caddy auf Hetzner) |
  | www.lasstreffen.at | CNAME | lasstreffen.at | Caddy leitet auf Apex um |
  | api.lasstreffen.at | A | 157.180.42.4 | Supabase-API (Envoy hinter Caddy), apikey-Header |
  | neu.lasstreffen.at | A | 157.180.42.4 | Vorschau, noindex |
  | flights.lasstreffen.at | A | 157.180.42.4 | Altlast, kein Caddy-Site-Block (erst im Internex-Editor gesehen, 2026-10-21) |
  | lasstreffen.at | MX 10 | mail.lasstreffen.at | Ziel existiert nicht (Altlast, unverändert übernehmen) |
  | lasstreffen.at | TXT | brevo-code:136d683d506a145222964bc7ba7ebf9d | Brevo-Domainverifizierung |
  | lasstreffen.at | TXT | google-site-verification=yaXJSoHMatdzCq5abG9_Hz1_3uBlCMejRBcPOUOBe90 | Search Console |
  | _dmarc.lasstreffen.at | TXT | v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com | DMARC |
  | brevo1._domainkey | CNAME | b1.lasstreffen-at.dkim.brevo.com | DKIM Brevo |
  | brevo2._domainkey | CNAME | b2.lasstreffen-at.dkim.brevo.com | DKIM Brevo |

  Kein AAAA, kein CAA, kein SPF-TXT.
- Caddy v2.11.4 (Image `lasstreffen/caddy-ratelimit:2.11`, Container
  `supabase-caddy`, Caddyfile `/opt/supabase/volumes/proxy/caddy/Caddyfile`
  als `/etc/caddy`). Zertifikate Let's Encrypt (lasstreffen.at gültig bis
  29.11.2026, Erneuerung ab ~30.10.). Rate-Limits mit `key {client_ip}`,
  Bot-Sperren über `remote_ip`-Listen `dc-ranges.caddy` (10.159 Netze) und
  `verified-bots.caddy` (724 Netze), wöchentlich per `lt-dc-ranges.timer`.
  Cloudflare-Netze (14 IPv4, 6 IPv6) überschneiden sich mit keiner der
  beiden Listen (per ipaddress.overlaps geprüft).
- Serverseitige Aufrufe der eigenen Domain: nur `watchdog.sh`
  (`https://lasstreffen.at/api/health`, alle 15 min). `lt-cron@*`,
  `deploy.sh`, `isr-guard.sh` gehen auf `127.0.0.1:3000`. GitHub Actions
  rufen nur `api.lasstreffen.at` (bleibt DNS-only) und SSH.
- Next.js liest die Client-IP aus dem ersten Eintrag von `X-Forwarded-For`
  (`src/lib/rate-limit.ts`, `/api/analytics`, `/api/events/[id]/interact`).

## 3. Cloudflare-Fakten, die den Plan bestimmen (Doku gelesen 2026-10-17)

- **Bot Fight Mode (Free)** stellt erkannten Automaten rechenintensive
  Challenges, schaltet JS-Detections zwingend ein und **lässt sich nicht
  per WAF-Regel überspringen** („you cannot bypass or skip Bot Fight Mode
  using WAF custom rules or Page Rules“). Einzige Ausnahme: „will not
  trigger if an IP Access rule matches the request first“. Deshalb bekommt
  der eigene Server 157.180.42.4 eine IP-Access-Regel „Allow“.
  Verified Bots sind laut Doku „historically excluded in default bot
  configurations across all plans“; das wird nach dem Cutover mit der
  Search-Console-URL-Prüfung belegt, nicht angenommen.
- **`cf.threat_score` ist dauerhaft 0** („Now, the threat score is always
  0“; „we do not recommend creating rules based on the threat score“).
  Eine „Managed Challenge bei niedrigem Traffic-Score“ ist auf Free nicht
  mehr baubar. Ersatz, mit denselben Mitteln (WAF Custom Rules, Free: 5
  Regeln, Operatoren ohne Regex): Managed Challenge für Clients mit
  Chrome-Build unter 140 (alle drei Wellen fuhren veraltete Builds; echte
  Nutzer mit altem Browser lösen die Challenge einmal) und für
  nicht-verifizierte Clients aus China (Herkunft der Baidu-Welle), jeweils
  mit `not cf.client.bot` und ohne robots.txt.
- **Security Level** ist nur noch der Schalter für „Under Attack“, bleibt
  aus.
- **ACME:** Cloudflare schreibt zu Always Use HTTPS „This process does not
  impact certificate validation“. Ob Let's Encrypt HTTP-01 durch den Proxy
  samt Bot Fight Mode funktioniert, wird direkt nach dem Cutover mit einem
  Wegwerf-Hostnamen (`cf-test.lasstreffen.at`, proxied) belegt: Caddy muss
  dafür ein neues Zertifikat bekommen. Scheitert das: DNS-01 über
  `caddy-dns/cloudflare` (Image neu bauen) oder Cloudflare Origin CA.
- **Cache:** Cloudflare cacht standardmäßig nur bekannte statische
  Dateiendungen, nie HTML. Zusätzlich zwei Cache Rules: „Eligible“ nur für
  `/_next/static/*`, `/_next/image*`, `/icons/*`, `/images/*`,
  `/favicon*`; alles andere „Bypass“. Damit kann keine RSC-/HTML-Antwort
  (Vary auf RSC-Header, personalisierte Cookies) am Edge landen.
- **Email Address Obfuscation** (Free-Default an) schreibt `@`-Adressen im
  HTML um und wird abgeschaltet (RSC-Payload, Impressum). Rocket Loader
  bleibt aus. Browser Integrity Check bleibt im Default (an).

## 4. Schritte

### Schritt A: Caddy vorbereiten (vor dem Cutover, gefahrlos)

Solange kein Cloudflare-Netz verbindet, ist `client_ip` gleich `remote_ip`;
die Änderung ist vor dem Cutover wirkungslos und danach notwendig.

1. Backup `Caddyfile.bak-2026-10-17-vor-cloudflare`.
2. Neues Skript `/opt/app/update-cf-ranges.py`: lädt
   `https://www.cloudflare.com/ips-v4` und `ips-v6`, schreibt bei
   plausibler Größe (mind. 10 IPv4-, 3 IPv6-Netze) atomar
   `cf-trusted-proxies.caddy` mit `trusted_proxies static <Netze>`.
   Wrapper `update-cf-ranges.sh` (validate, reload, sonst alte Datei
   zurück), `lt-cf-ranges.timer` täglich 04:20 UTC.
3. `update-dc-ranges.py`: Listen als `client_ip` statt `remote_ip`
   ausgeben (bestehende Dateien per sed umgestellt, der Timer schreibt sie
   künftig so).
4. Caddyfile: globaler Block
   `servers { import cf-trusted-proxies.caddy; client_ip_headers CF-Connecting-IP X-Forwarded-For }`;
   `@baidu_net` von `remote_ip` auf `client_ip`. Der Supabase-Block
   (`not remote_ip private_ranges 157.180.42.4/32`) bleibt, weil
   api.lasstreffen.at DNS-only bleibt.
5. `caddy validate`, `caddy reload`, danach `curl -I https://lasstreffen.at`
   200 und ein 403-Test gegen `@baidu_render_ua` (UA Chrome/99).

Rückweg: `cp Caddyfile.bak-2026-10-17-vor-cloudflare Caddyfile && caddy reload`.

### Schritt B: Cloudflare-Zone anlegen (braucht Cloudflare-Konto)

Per API (Token mit Zone:Read, DNS:Edit, Zone Settings:Edit, Zone WAF:Edit,
Firewall Services:Edit, Bot Management:Edit, Cache Rules:Edit) oder im
Dashboard:

1. Zone `lasstreffen.at`, Plan Free, Typ „full“. Cloudflare nennt zwei
   Nameserver (`*.ns.cloudflare.com`), diese Werte gehen an den User.
2. DNS-Records aus Abschnitt 2 anlegen. Proxied (orange): nur `@` (A) und
   `www` (CNAME). DNS-only (grau): `api`, `neu`, MX, TXT, DKIM-CNAMEs.
3. SSL/TLS: `ssl = strict` (Full strict), `always_use_https = on`,
   `min_tls_version = 1.2`, `tls_1_3 = on`, `automatic_https_rewrites = on`.
4. `email_obfuscation = off`, `rocket_loader = off`, `brotli = on`,
   `http3 = on`, `ipv6 = on` (Cloudflare beantwortet AAAA selbst; Caddy
   erreicht Cloudflare nur über IPv4, das ist richtig so).
5. Bot Fight Mode an (`PUT /zones/{id}/bot_management {"fight_mode": true}`),
   `ai_bots_protection` auf „disabled“ (robots.txt und Caddy regeln KI-Crawler
   selbst; Caddy lässt GPTBot/Claude/Perplexity bewusst zu).
6. IP Access Rule: Allow 157.180.42.4 (Watchdog, Crons, Container-Egress).
7. WAF Custom Rules (Phase `http_request_firewall_custom`), alle mit
   `not cf.client.bot and http.request.uri.path ne "/robots.txt"`:
   - Managed Challenge: `http.user_agent contains "Chrome/"` und Build < 140
     (als `contains`-Liste „Chrome/4“ … „Chrome/9“, „Chrome/10“ … „Chrome/13“).
   - Managed Challenge: `ip.src.country eq "CN"`.
   - Block: `http.user_agent contains "Chrome/99.0.4844.51"` (bekannte Welle,
     Caddy gibt dasselbe 403; doppelte Schicht ist Absicht).
8. Cache Rules: Eligible für die statischen Pfade aus Abschnitt 3 (Edge-TTL
   „respect origin“), Bypass für alles andere.

Rückweg vor dem Nameserver-Wechsel: Zone löschen, nichts ist live.

#### Stand Schritt B (ausgeführt 2026-10-21 per API, Skript `docs/ops/cloudflare/cf-setup.py`)

Zone-ID `962399ba2ed7d14167caf40733fdee2d`, Account `d3d4ab2e3819ff7f3144e45f00c81b2e`,
Plan Free, Status pending. Nameserver: **cortney.ns.cloudflare.com** und
**jacob.ns.cloudflare.com**. Alle 10 Records, 13 Einstellungen, Bot Fight
Mode (braucht `enable_js: true` im selben PUT, sonst 10400), IP-Access-Allow
157.180.42.4, 3 WAF-Regeln und 2 Cache-Regeln sind angelegt und
zurückgelesen. Token liegt IP-gefiltert in `/root/.cloudflare-token`; der
Server geht per IPv6 raus, API-Aufrufe deshalb immer mit IPv4 (`curl -4`).
Der Proxy ist erst nach der Delegation aktiv: vor dem Wechsel antwortet
Cloudflares Nameserver mit der Origin-IP.

### Schritt C: Nameserver bei Internex umstellen (User)

Der User trägt bei Internex die zwei Cloudflare-Nameserver ein (ersetzt
ns1-4.internex.at). Cloudflare prüft die Delegation automatisch
(Statusmail „active“), die Universal-SSL-Edge-Zertifikate werden dabei
ausgestellt. Vorher: Internex-TTL steht auf 3600, die Umschaltung ist
weltweit innerhalb von Stunden durch (NS-Caches bis 48 h).

Rückweg: Nameserver bei Internex zurück auf ns1-4.internex.at. Die
Internex-Zone bleibt unverändert bestehen und ist sofort wieder
autoritativ; Caddy läuft die ganze Zeit unverändert weiter, weil der
Origin direkt erreichbar bleibt.

### Schritt D: Belege nach dem Cutover

1. `curl -sI https://lasstreffen.at/` zeigt `cf-ray` und `server: cloudflare`.
2. Caddy-Log (`/data/bot-access.log` bzw. Zugriff per `curl` mit
   gesperrtem UA): Feld `client_ip` ist die echte Client-IP, `remote_ip`
   ein Cloudflare-Netz.
3. Search Console URL-Prüfung „Live-URL testen“ auf einer Event-Seite:
   Abruf erfolgreich, kein Challenge-HTML. Zusätzlich Caddy-Log: Googlebot
   mit `client_ip` aus den Google-Netzen.
4. `curl https://lasstreffen.at/api/health` liefert 200 JSON; Watchdog
   bleibt grün (Allow-Regel greift).
5. Event-Seite im Browser: `pagead2.googlesyndication.com/.../adsbygoogle.js`
   im Netzwerk-Log geladen, Konsole ohne CSP-Fehler.
6. Rate-Limit: 125 Seitenabrufe in einer Minute von einem Client
   (Browser-UA) über Cloudflare, ab 121 kommt 429 von Caddy (Beleg, dass
   `{client_ip}` die echte IP zählt und nicht das Cloudflare-Netz).
7. ACME: `cf-test.lasstreffen.at` (proxied) mit Site-Block anlegen, Caddy-Log
   zeigt „certificate obtained“; danach beides wieder entfernen.
8. Bot-Welle: `curl -A "<Chrome/99-UA>"` über Cloudflare bekommt 403
   (Cloudflare-Block oder Caddy); im Cloudflare-Security-Dashboard
   erscheinen Challenges/Blocks.

### Schritt E: Dokumentation

MASTERPLAN Betriebsteil (Abschnitt 3) um den Cloudflare-Stand ergänzen,
dieses Dokument verlinken, CLAUDE.md-Betriebsnotiz. Danach PR auf master.

## 5. Bekannte Nebenwirkungen

- Watchdog (`watchdog.sh`) geht nach dem Cutover über Cloudflare; dank
  IP-Access-Allow ohne Challenge. Bricht die Allow-Regel, meldet er
  „Health-Endpoint liefert HTTP 403“: das ist dann ein echter Befund
  (Cloudflare blockt den Server), kein Fehlalarm.
- Caddy versucht beim Erneuern auch TLS-ALPN-01, das hinter dem Proxy
  scheitert; Caddy fällt selbst auf HTTP-01 zurück. Bleibt der ACME-Beleg
  (D7) aus, wird auf DNS-01 umgestellt, bevor am 30.10. die Erneuerung
  ansteht.
- Cloudflare-Logs sind auf Free nur 24 h im Dashboard sichtbar; die
  Beweislage für Abuse-Meldungen bleibt deshalb das Caddy-Log mit
  `client_ip`.
