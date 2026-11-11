#!/usr/bin/env python3
"""Täglicher Traffic-Prüflauf (seit 2026-10-23): findet Bot-Schwärme in
analytics_events, pflegt EINE Cloudflare-WAF-Regel ("auto: …") mit den
auffälligen Browser-Kennungen und mailt den Bericht.

Läuft auf dem Server als /opt/app/traffic-audit.py (Timer lt-traffic-audit,
täglich 05:35 UTC). Kopie im Repo: docs/ops/cloudflare/traffic-audit.py.

Warum deterministisch: Jede Bot-Welle seit 09/2026 (AWS-Headless, Tencent,
Baidu-Render, Residential-Chromium) hatte dieselbe Signatur in den eigenen
Daten, lange bevor jemand hinsah. Signaturen je User-Agent über 24 h:
  R  rotierend: fast jede Pageview eine neue IP, Referrer leer, nachts aktiv
  F  Farm:      viele Pageviews je IP, Referrer leer
Menschen haben einen Nachtanteil (0-5 Uhr Wien) um 3 %, Bots 15-25 %; ein
Anteil Google-Referrer von >= 10 % gilt als menschlich und schützt vor
Fehltreffern. Deklarierte Bots (bot|crawl|spider …) regelt Caddy, nicht
diese Regel.

Cloudflare Free erlaubt 5 WAF-Custom-Rules; vier belegt cf-setup.py, die
fünfte gehört diesem Skript (Beschreibung beginnt mit "auto:"; cf-setup.py
lässt sie stehen). Aktion "challenge" (interaktiv): die Managed Challenge
bestand ein echtes Chromium am 23.10. Bedingung Referer leer, damit
Besucher aus Google nie eine Challenge sehen. Kennungen verfallen nach
EXPIRE_DAYS ohne Treffer.

Aufruf: traffic-audit.py [--dry-run] [--mail] [--hours 24]
  --dry-run  nichts an Cloudflare ändern, nur Bericht (Stdout)
  --mail     Bericht per Brevo an ALERT_EMAIL (sonst nur Stdout)
"""
import argparse
import datetime as dt
import json
import os
import re
import socket
import subprocess
import sys
import urllib.error
import urllib.request

ENV = "/opt/app/.env.master"
TOKEN_FILE = "/root/.cloudflare-token"
STATE_DIR = "/var/lib/lt-traffic-audit"
STATE_FILE = os.path.join(STATE_DIR, "state.json")
LOG_FILE = "/var/log/lt-traffic-audit.log"
ZONE = "962399ba2ed7d14167caf40733fdee2d"
API = "https://api.cloudflare.com/client/v4"
AUTO_PREFIX = "auto:"
AUTO_DESCRIPTION = (AUTO_PREFIX + " Traffic-Audit — Browser-Kennungen mit Bot-Signatur "
                    "(rotierende IPs oder Farm, Referrer leer, nachts aktiv); interaktive Challenge")

# Schwellen (24 h je User-Agent)
MIN_PV = 300          # darunter kein Urteil
ROT_IPS_PER_PV = 0.85 # R: Anteil neuer IPs je Pageview
FARM_PV_PER_IP = 8.0  # F: Pageviews je IP
NOREF_SHARE = 0.85    # beide: Anteil Pageviews ohne Referrer
NIGHT_SHARE = 0.12    # R: Anteil 0-5 Uhr Wien (Menschen ~0.03)
HUMAN_GOOGLE_SHARE = 0.10
EXPIRE_DAYS = 7
MAX_UAS = 20          # Ausdruck bleibt unter Cloudflares 4-KB-Grenze
DECLARED_BOT = re.compile(r"bot|crawl|spider|slurp|preview|fetch|scrap|python|curl|wget|http", re.I)

# IPv4 erzwingen (Token ist auf 157.180.42.4 gefiltert, Server geht sonst IPv6 raus)
_orig = socket.getaddrinfo
socket.getaddrinfo = lambda *a, **k: [r for r in _orig(*a, **k) if r[0] == socket.AF_INET]

SEP = "\x1f"


def env(key):
    try:
        for line in open(ENV, encoding="utf-8"):
            if line.startswith(key + "="):
                return line[len(key) + 1:].strip().strip('"')
    except FileNotFoundError:
        pass
    return ""


def log(msg):
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    line = f"{stamp} {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def psql(sql):
    out = subprocess.run(
        ["docker", "exec", "-i", "supabase-db", "psql", "-U", "postgres", "-d", "postgres",
         "-At", "-F", SEP, "-v", "ON_ERROR_STOP=1"],
        input=sql, capture_output=True, text=True, timeout=300)
    if out.returncode != 0:
        raise RuntimeError("psql: " + out.stderr.strip()[:500])
    return [row.split(SEP) for row in out.stdout.splitlines() if row]


def load_rows(hours):
    sql = f"""
with e as (
  select user_agent, event_type, ip_hash, referrer, page,
         (created_at at time zone 'Europe/Vienna') lt
  from analytics_events
  where created_at >= now() - interval '{int(hours)} hours'
    and event_type in ('page_view', 'ad_request')
)
select coalesce(user_agent, ''),
  count(*) filter (where event_type = 'page_view') pv,
  count(distinct ip_hash) filter (where event_type = 'page_view') ips,
  count(*) filter (where event_type = 'page_view' and coalesce(referrer, '') = '') noref,
  count(*) filter (where event_type = 'page_view' and referrer ilike '%google.%') gref,
  count(*) filter (where event_type = 'page_view' and page like '/en/%') en,
  count(*) filter (where event_type = 'page_view' and extract(hour from lt) < 6) night,
  count(*) filter (where event_type = 'ad_request') adreq,
  count(distinct ip_hash) filter (where event_type = 'ad_request') adips
from e
group by 1
order by pv desc;
"""
    rows = []
    for r in psql(sql):
        ua, *nums = r
        pv, ips, noref, gref, en, night, adreq, adips = (int(x) for x in nums)
        rows.append(dict(ua=ua, pv=pv, ips=ips, noref=noref, gref=gref, en=en,
                         night=night, adreq=adreq, adips=adips))
    return rows


def classify(r):
    """Gibt 'R', 'F' oder None zurück."""
    if r["pv"] < MIN_PV or not r["ua"] or DECLARED_BOT.search(r["ua"]):
        return None
    pv = r["pv"]
    if r["gref"] / pv >= HUMAN_GOOGLE_SHARE:
        return None
    if r["noref"] / pv < NOREF_SHARE:
        return None
    if r["ips"] / pv >= ROT_IPS_PER_PV and r["night"] / pv >= NIGHT_SHARE:
        return "R"
    if r["ips"] and pv / r["ips"] >= FARM_PV_PER_IP:
        return "F"
    return None


def caddy_blocks(hours):
    """Zählt Caddy-403 der letzten Stunden aus /data/bot-access.log (Top-UAs)."""
    try:
        out = subprocess.run(["docker", "exec", "supabase-caddy", "sh", "-c",
                              "tail -c 20000000 /data/bot-access.log"],
                             capture_output=True, text=True, timeout=120).stdout
    except (subprocess.SubprocessError, OSError):
        return 0, []
    since = dt.datetime.now(dt.timezone.utc).timestamp() - hours * 3600
    total, by_ua = 0, {}
    for line in out.splitlines():
        try:
            j = json.loads(line)
        except ValueError:
            continue
        if j.get("status") != 403 or j.get("ts", 0) < since:
            continue
        total += 1
        ua = j.get("request", {}).get("headers", {}).get("User-Agent", [""])[0][:80]
        by_ua[ua] = by_ua.get(ua, 0) + 1
    top = sorted(by_ua.items(), key=lambda kv: -kv[1])[:5]
    return total, top


# ---------------------------------------------------------------- Cloudflare
def cf(method, path, body=None):
    token = open(TOKEN_FILE).read().strip()
    req = urllib.request.Request(API + path, method=method,
                                 headers={"Authorization": "Bearer " + token,
                                          "Content-Type": "application/json"},
                                 data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            d = json.load(resp)
    except urllib.error.HTTPError as e:
        d = json.load(e)
    if not d.get("success"):
        raise RuntimeError(f"Cloudflare {method} {path}: {d.get('errors')}")
    return d["result"]


def cf_expression(uas):
    quoted = " ".join('"' + ua.replace("\\", "\\\\").replace('"', '\\"') + '"' for ua in uas)
    return (f"(http.user_agent in {{{quoted}}} and http.referer eq \"\" "
            f"and not cf.client.bot and http.request.uri.path ne \"/robots.txt\")")


def cf_sync_rule(uas, dry_run):
    """Hält genau eine Regel mit AUTO_PREFIX; leer -> Regel deaktiviert."""
    ruleset = cf("GET", f"/zones/{ZONE}/rulesets/phases/http_request_firewall_custom/entrypoint")
    auto = [r for r in ruleset.get("rules", []) if r.get("description", "").startswith(AUTO_PREFIX)]
    if len(auto) > 1:
        raise RuntimeError(f"{len(auto)} auto-Regeln vorhanden, erwartet höchstens eine")
    enabled = bool(uas)
    expression = cf_expression(uas) if uas else cf_expression(["traffic-audit: leer"])
    body = {"description": AUTO_DESCRIPTION, "expression": expression,
            "action": "challenge", "enabled": enabled}
    current = auto[0] if auto else None
    unchanged = (current and current["expression"] == expression
                 and current["enabled"] == enabled and current["action"] == "challenge")
    if unchanged:
        return "unverändert"
    if dry_run:
        return "Trockenlauf: " + ("Regel würde angelegt" if not current else "Regel würde geändert")
    if current:
        cf("PATCH", f"/zones/{ZONE}/rulesets/{ruleset['id']}/rules/{current['id']}", body)
        return "Regel geändert"
    cf("POST", f"/zones/{ZONE}/rulesets/{ruleset['id']}/rules", body)
    return "Regel angelegt"


# ---------------------------------------------------------------- Bericht/Mail
def send_mail(subject, body):
    key, to, sender = env("BREVO_API_KEY"), env("ALERT_EMAIL"), env("EMAIL_FROM")
    if not (key and to and sender):
        log("Mail übersprungen: BREVO_API_KEY/ALERT_EMAIL/EMAIL_FROM fehlen in .env.master")
        return False
    payload = {"sender": {"email": sender, "name": env("EMAIL_FROM_NAME") or "lasstreffen Traffic-Audit"},
               "to": [{"email": to}], "subject": subject, "textContent": body}
    req = urllib.request.Request("https://api.brevo.com/v3/smtp/email",
                                 data=json.dumps(payload).encode(),
                                 headers={"api-key": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.status < 300


def pct(a, b):
    return f"{(100.0 * a / b):.0f} %" if b else "–"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--mail", action="store_true")
    ap.add_argument("--hours", type=int, default=24)
    args = ap.parse_args()
    os.makedirs(STATE_DIR, exist_ok=True)
    today = dt.date.today().isoformat()

    rows = load_rows(args.hours)
    total_pv = sum(r["pv"] for r in rows)
    total_adreq = sum(r["adreq"] for r in rows)
    total_adips = sum(r["adips"] for r in rows)  # Näherung (IPs je UA addiert)
    night_all = sum(r["night"] for r in rows)

    try:
        state = json.load(open(STATE_FILE))
    except (OSError, ValueError):
        state = {}

    flagged = []
    for r in rows:
        sig = classify(r)
        if not sig:
            continue
        r["sig"] = sig
        flagged.append(r)
        s = state.get(r["ua"], {"first": today, "pv_max": 0})
        s.update(last=today, pv_max=max(s.get("pv_max", 0), r["pv"]), sig=sig)
        state[r["ua"]] = s

    # Verfall: EXPIRE_DAYS ohne Treffer
    cutoff = (dt.date.today() - dt.timedelta(days=EXPIRE_DAYS)).isoformat()
    expired = [ua for ua, s in state.items() if s.get("last", "") < cutoff]
    for ua in expired:
        del state[ua]
    active = sorted(state.items(), key=lambda kv: kv[1].get("last", ""), reverse=True)[:MAX_UAS]
    active_uas = [ua for ua, _ in active]

    try:
        action = cf_sync_rule(active_uas, args.dry_run)
    except Exception as e:  # Bericht trotzdem schicken
        action = f"FEHLER Cloudflare: {e}"

    if not args.dry_run:
        json.dump(state, open(STATE_FILE, "w"), indent=1, ensure_ascii=False)

    blocks, block_top = caddy_blocks(args.hours)

    # Verdächtige Anzeigen-Anforderungen: jede von einer anderen IP, ohne Referrer
    ad_susp = [r for r in rows if r["adreq"] >= 10 and r["adips"] >= 0.9 * r["adreq"]
               and r["pv"] and r["noref"] / r["pv"] >= NOREF_SHARE and r["gref"] / r["pv"] < HUMAN_GOOGLE_SHARE]

    lines = [f"Traffic-Audit lasstreffen.at — letzte {args.hours} h bis {dt.datetime.now(dt.timezone.utc):%Y-%m-%d %H:%M} UTC",
             "",
             f"Pageviews {total_pv} · Nachtanteil (0-5 Uhr Wien) {pct(night_all, total_pv)}",
             f"Anzeigen-Anforderungen {total_adreq} von ~{total_adips} IPs"
             f" ({(total_adreq / total_adips):.2f} je IP)" if total_adips else f"Anzeigen-Anforderungen {total_adreq}",
             f"Caddy-Sperren (403) {blocks}" + (": " + ", ".join(f"{n}× {ua[:40]}" for ua, n in block_top) if block_top else ""),
             ""]
    if flagged:
        lines.append(f"AUFFÄLLIG ({len(flagged)} Kennungen) — Cloudflare: {action}")
        for r in flagged:
            lines.append(f"  [{r['sig']}] pv {r['pv']} · IPs {r['ips']} · ohne Referrer {pct(r['noref'], r['pv'])}"
                         f" · Google {pct(r['gref'], r['pv'])} · nachts {pct(r['night'], r['pv'])}"
                         f" · /en {pct(r['en'], r['pv'])} · ad_request {r['adreq']}")
            lines.append(f"      {r['ua']}")
    else:
        lines.append(f"Keine Kennung über den Schwellen — Cloudflare: {action}")
    lines.append("")
    lines.append(f"Aktive Kennungen in der auto-Regel ({len(active_uas)}, Verfall nach {EXPIRE_DAYS} Tagen ohne Treffer):")
    for ua, s in active:
        lines.append(f"  seit {s.get('first')} · zuletzt {s.get('last')} · max {s.get('pv_max')} pv · [{s.get('sig')}] {ua[:100]}")
    if expired:
        lines.append(f"Verfallen: {len(expired)}")
    if ad_susp:
        lines.append("")
        lines.append("Anzeigen-Anforderungen mit Bot-Muster (je IP eine, ohne Referrer):")
        for r in ad_susp:
            lines.append(f"  ad_request {r['adreq']} von {r['adips']} IPs · pv {r['pv']} · {r['ua'][:90]}")
    lines.append("")
    lines.append("Schwellen: pv>=%d; R: IPs/pv>=%.2f & nachts>=%.0f %%; F: pv/IP>=%.0f; beide: ohne Referrer>=%.0f %%, Google<%.0f %%"
                 % (MIN_PV, ROT_IPS_PER_PV, NIGHT_SHARE * 100, FARM_PV_PER_IP, NOREF_SHARE * 100, HUMAN_GOOGLE_SHARE * 100))
    lines.append("Skript: /opt/app/traffic-audit.py · Log: /var/log/lt-traffic-audit.log · Doku: docs/ops/cloudflare-proxy-2026-10.md")
    report = "\n".join(lines)
    print(report)
    log(f"pv={total_pv} adreq={total_adreq} flagged={len(flagged)} active={len(active_uas)} cloudflare={action}")

    if args.mail:
        subject = (f"🛡️ Traffic-Audit: {len(flagged)} Kennung(en) auffällig" if flagged
                   else "✅ Traffic-Audit: sauber") + f" · ad_request {total_adreq}"
        try:
            ok = send_mail(subject, report)
            log(f"mail={'ok' if ok else 'fehlgeschlagen'}")
        except Exception as e:
            log(f"mail FEHLER: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
