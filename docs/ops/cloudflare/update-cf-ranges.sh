#!/bin/bash
# Taeglich: Cloudflare-Netze fuer Caddys trusted_proxies neu laden, pruefen,
# neu laden. Bei ungueltiger Konfiguration die alte Liste zurueckholen.
set -u
D=/opt/supabase/volumes/proxy/caddy
F=$D/cf-trusted-proxies.caddy
[ -f "$F" ] && cp "$F" /tmp/cf-trusted-proxies.caddy.prev
python3 /opt/app/update-cf-ranges.py || exit 1
if docker exec supabase-caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  docker exec supabase-caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
else
  [ -f /tmp/cf-trusted-proxies.caddy.prev ] && cp /tmp/cf-trusted-proxies.caddy.prev "$F"
  echo "Validierung fehlgeschlagen, alte Cloudflare-Liste wiederhergestellt" >&2
  exit 1
fi
