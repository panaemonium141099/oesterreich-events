#!/usr/bin/env python3
"""Richtet die Cloudflare-Zone lasstreffen.at ein (idempotent).
Plan: docs/ops/cloudflare-proxy-2026-10.md im Repo. Token: /root/.cloudflare-token
(IP-gefiltert auf 157.180.42.4, deshalb IPv4 erzwingen)."""
import json, socket, sys, urllib.request, urllib.error

# IPv4 erzwingen (Token-IP-Filter kennt nur 157.180.42.4)
_orig = socket.getaddrinfo
socket.getaddrinfo = lambda *a, **k: [r for r in _orig(*a, **k) if r[0] == socket.AF_INET]

TOKEN = open("/root/.cloudflare-token").read().strip()
ZONE = "962399ba2ed7d14167caf40733fdee2d"
API = "https://api.cloudflare.com/client/v4"
ORIGIN = "157.180.42.4"


def cf(method, path, body=None):
    req = urllib.request.Request(API + path, method=method,
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.load(r)
    except urllib.error.HTTPError as e:
        d = json.load(e)
    if not d.get("success"):
        print(f"  FEHLER {method} {path}: {d.get('errors')}")
    return d


def step(title):
    print(f"\n== {title}")


# ---------------------------------------------------------------- DNS
step("DNS-Records")
want = [
    dict(type="A", name="lasstreffen.at", content=ORIGIN, proxied=True, comment="Website (Caddy auf Hetzner)"),
    dict(type="CNAME", name="www", content="lasstreffen.at", proxied=True, comment="Caddy leitet auf Apex um"),
    dict(type="A", name="api", content=ORIGIN, proxied=False, comment="Supabase-API, DNS-only (apikey-Clients, Pipelines)"),
    dict(type="A", name="neu", content=ORIGIN, proxied=False, comment="Vorschau, noindex"),
    dict(type="MX", name="lasstreffen.at", content="mail.lasstreffen.at", priority=10, comment="aus Internex uebernommen (Ziel existiert nicht)"),
    dict(type="TXT", name="lasstreffen.at", content='"brevo-code:136d683d506a145222964bc7ba7ebf9d"'),
    dict(type="TXT", name="lasstreffen.at", content='"google-site-verification=yaXJSoHMatdzCq5abG9_Hz1_3uBlCMejRBcPOUOBe90"'),
    dict(type="TXT", name="_dmarc", content='"v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com"'),
    dict(type="CNAME", name="brevo1._domainkey", content="b1.lasstreffen-at.dkim.brevo.com", proxied=False),
    dict(type="CNAME", name="brevo2._domainkey", content="b2.lasstreffen-at.dkim.brevo.com", proxied=False),
]
existing = cf("GET", f"/zones/{ZONE}/dns_records?per_page=100").get("result") or []


def fq(n):
    return n if n.endswith("lasstreffen.at") else n + ".lasstreffen.at"


for w in want:
    name = fq(w["name"])
    match = [e for e in existing if e["type"] == w["type"] and e["name"] == name
             and e["content"].strip('"') == w["content"].strip('"')]
    if match:
        print(f"  vorhanden: {w['type']} {name} -> {w['content']}")
        continue
    body = dict(w)
    body["name"] = name
    body.setdefault("ttl", 1)
    d = cf("POST", f"/zones/{ZONE}/dns_records", body)
    r = d.get("result") or {}
    print(f"  angelegt: {r.get('type')} {r.get('name')} -> {r.get('content')} proxied={r.get('proxied')}")

# ---------------------------------------------------------------- Settings
step("Zone-Einstellungen")
settings = [
    ("ssl", "strict"), ("always_use_https", "on"), ("min_tls_version", "1.2"), ("tls_1_3", "on"),
    ("automatic_https_rewrites", "on"), ("email_obfuscation", "off"), ("rocket_loader", "off"),
    ("brotli", "on"), ("http3", "on"), ("ipv6", "on"), ("browser_check", "on"),
    ("development_mode", "off"), ("hotlink_protection", "off"),
]
for key, val in settings:
    d = cf("PATCH", f"/zones/{ZONE}/settings/{key}", {"value": val})
    print(f"  {key} = {(d.get('result') or {}).get('value')}  (soll {val})")

# ---------------------------------------------------------------- Bot Fight Mode
step("Bot Fight Mode")
d = cf("PUT", f"/zones/{ZONE}/bot_management",
       {"fight_mode": True, "enable_js": True, "ai_bots_protection": "disabled", "crawler_protection": "disabled"})
print("  ", json.dumps(d.get("result")))

# ---------------------------------------------------------------- IP Access Rule
step("IP-Access-Regel: Allow eigener Server")
rules = cf("GET", f"/zones/{ZONE}/firewall/access_rules/rules?per_page=100").get("result") or []
if any(r["configuration"]["value"] == ORIGIN and r["mode"] == "whitelist" for r in rules):
    print("  vorhanden")
else:
    d = cf("POST", f"/zones/{ZONE}/firewall/access_rules/rules",
           {"mode": "whitelist", "configuration": {"target": "ip", "value": ORIGIN},
            "notes": "Eigener Server 157.180.42.4: Watchdog, Crons, Container-Egress (Bot Fight Mode greift sonst)"})
    print("  angelegt:", (d.get("result") or {}).get("id"))

# ---------------------------------------------------------------- WAF Custom Rules
step("WAF Custom Rules")
old_chrome = " or ".join(f'http.user_agent contains "Chrome/{p}"'
                         for p in ["4", "5", "6", "7", "8", "9", "10", "11", "12", "13"])
guard = 'not cf.client.bot and http.request.uri.path ne "/robots.txt"'
waf_rules = [
    {"description": "Block: Baidu-Render-Crawler Chrome/99.0.4844.51 (Welle 10/2026, Caddy gibt dasselbe 403)",
     "expression": '(http.user_agent contains "Chrome/99.0.4844.51" and http.request.uri.path ne "/robots.txt")',
     "action": "block", "enabled": True},
    {"description": "Managed Challenge: Chrome-Build unter 140 ohne verifizierten Bot (alle Bot-Wellen fuhren veraltete Builds)",
     "expression": f"(({old_chrome}) and {guard})",
     "action": "managed_challenge", "enabled": True},
    {"description": "Managed Challenge: nicht verifizierte Clients aus China (Herkunft der Baidu-Welle)",
     "expression": f'(ip.src.country eq "CN" and {guard})',
     "action": "managed_challenge", "enabled": True},
    # 2026-10-23: echtes Chromium 151 ueber Residential-Proxys (jede Pageview
    # neue IP, ~4.300/Tag, 90 % auf /en, Referer immer leer) kam durch Bot
    # Fight Mode und loeste ad_request aus. Menschen erreichen /en fast nur
    # ueber Google (Referer gesetzt); Direktaufrufe bekommen die unsichtbare
    # Managed Challenge. RSC-/Prefetch-Requests tragen einen Referer.
    # 18:46 UTC als managed_challenge angelegt; die Welle bestand sie (danach
    # kamen ihre Pageviews mit sich selbst als Referrer = Challenge-Umleitung).
    # Seit 18:54 UTC interaktive Challenge: ein Klick, cf_clearance-Cookie.
    {"description": "Interaktive Challenge: Direktaufruf (ohne Referer) einer /en-Seite ohne verifizierten Bot (Residential-Proxy-Welle 10/2026)",
     "expression": f'(starts_with(http.request.uri.path, "/en/") and http.request.method eq "GET" and http.referer eq "" and {guard})',
     "action": "challenge", "enabled": True},
]
# Die fuenfte Regel (Free-Plan-Limit) pflegt /opt/app/traffic-audit.py
# ("auto: ..."), sie bleibt beim PUT erhalten.
live = (cf("GET", f"/zones/{ZONE}/rulesets/phases/http_request_firewall_custom/entrypoint").get("result") or {}).get("rules", [])
auto_rules = [{k: r[k] for k in ("description", "expression", "action", "enabled") if k in r}
              for r in live if r.get("description", "").startswith("auto:")]
d = cf("PUT", f"/zones/{ZONE}/rulesets/phases/http_request_firewall_custom/entrypoint", {"rules": waf_rules + auto_rules})
for r in (d.get("result") or {}).get("rules", []):
    print(f"  {r['action']:18} {r['description'][:70]}")

# ---------------------------------------------------------------- Cache Rules
step("Cache Rules")
static = ('starts_with(http.request.uri.path, "/_next/static/") or starts_with(http.request.uri.path, "/_next/image")'
          ' or starts_with(http.request.uri.path, "/icons/") or starts_with(http.request.uri.path, "/images/")'
          ' or starts_with(http.request.uri.path, "/favicon")')
cache_rules = [
    {"description": "Bypass: alles ausser statischen Pfaden (HTML/RSC/API nie am Edge cachen)",
     "expression": f"(not ({static}))", "action": "set_cache_settings",
     "action_parameters": {"cache": False}, "enabled": True},
    {"description": "Eligible: /_next/static, /_next/image, /icons, /images, /favicon (Edge-TTL wie Origin)",
     "expression": f"({static})", "action": "set_cache_settings",
     "action_parameters": {"cache": True, "edge_ttl": {"mode": "respect_origin"}}, "enabled": True},
]
d = cf("PUT", f"/zones/{ZONE}/rulesets/phases/http_request_cache_settings/entrypoint", {"rules": cache_rules})
for r in (d.get("result") or {}).get("rules", []):
    print(f"  cache={r['action_parameters'].get('cache')}  {r['description'][:70]}")

# ---------------------------------------------------------------- Kontrolle
step("Kontrolle (zurueckgelesen)")
z = cf("GET", f"/zones/{ZONE}").get("result") or {}
print("  zone:", z.get("status"), z.get("name_servers"), (z.get("plan") or {}).get("name"))
for e in cf("GET", f"/zones/{ZONE}/dns_records?per_page=100").get("result") or []:
    print(f"  dns: {e['type']:5} {e['name']:32} {e['content'][:60]:60} proxied={e['proxied']}")
allset = {s["id"]: s["value"] for s in cf("GET", f"/zones/{ZONE}/settings").get("result") or []}
print("  settings:", {k: allset.get(k) for k, _ in settings})
print("  bot_management:", json.dumps(cf("GET", f"/zones/{ZONE}/bot_management").get("result")))
