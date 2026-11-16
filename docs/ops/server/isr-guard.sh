#!/usr/bin/env bash
# ISR-Cache-Waechter fuer lasstreffen.at
#
# Problem (10.09.2026): Next.js legt den ISR-Cache im Writable-Layer des
# nextjs-app-Containers ab (kein Volume in docker-compose.yml). Bei ~280k
# Event-Detailseiten waechst der um mehrere GB pro Stunde; am 10.09. lief die
# 75-GB-Platte damit auf 100 % und Postgres ging in den Crash-Loop
# ('could not write to file pg_wal/xlogtemp: No space left on device').
#
# Fix: Liegt der Writable-Layer ueber LAYER_MAX_GB, wird der Container neu
# erzeugt. Das verwirft den kompletten Writable-Layer (= den ISR-Cache),
# laesst den Build-Output im Image unangetastet und kostet 6-17 s Downtime.
# Danach zusaetzlich der Build-Cache, der laut Betriebserfahrung nur mit '-a'
# weicht.
#
# Fehlkonstruktion bis 17.10.2026: Der Waechter mass die GESAMTE Platten-
# belegung (Schwelle 70 %), konnte aber nur den Writable-Layer freigeben.
# Als die Platte durch anderes dauerhaft ueber 70 % lag (Envoy-Access-Log
# 14,2 GB ohne Rotation, 18,8 GB Images), erzeugte er den Container ab dem
# 06.10. alle 15 Minuten neu — 95 Recreates am Tag, 77 % -> 76 % und zurueck.
# Im Caddy-Log fielen 96 % der 502-Antworten (1.844 von 1.918 in 48 h) in
# die 40 s nach einem Recreate ("connect: connection refused" / "lookup
# nextjs-app ... server misbehaving").
#
# Regel seit 17.10.2026: Massgeblich ist der Writable-Layer des Containers
# (docker inspect -s, SizeRw) — genau der Platz, den ein Recreate freigibt.
# Liegt die Platte ueber SCHWELLE, aber der Layer darunter, hilft kein
# Recreate: dann nur ein Logeintrag (hoechstens alle 6 h), die Ursache liegt
# woanders. Notbremse: ab 90 % Platte reicht ein Layer von 2 GB.
#
# Zweite Seite (fn-31, 2026-11-16): derselbe Waechter laeuft je Container.
# Ohne Angaben prueft er nextjs-app (lasstreffen.at); lt-isr-guard-de.service
# setzt CONTAINER=nextjs-app-de SERVICE=nextjs-de PORT=3001.
set -u

CONTAINER=${CONTAINER:-nextjs-app}
SERVICE=${SERVICE:-nextjs}
PORT=${PORT:-3000}

SCHWELLE=${SCHWELLE:-70}          # Platten-Prozent, ab dem gewarnt wird
LAYER_MAX_GB=${LAYER_MAX_GB:-8}   # Writable-Layer, ab dem neu erzeugt wird
NOTBREMSE_PCT=${NOTBREMSE_PCT:-90}
NOTBREMSE_LAYER_GB=${NOTBREMSE_LAYER_GB:-2}
LOG=/var/log/lt-isr-guard.log
COMPOSE=/opt/app/docker-compose.yml
STATE=/var/lib/lt-isr-guard/$CONTAINER
mkdir -p "$STATE"

log() { echo "$(date '+%F %T') [$CONTAINER] $*" >> "$LOG"; }

layer_bytes() { docker inspect -s --format '{{.SizeRw}}' "$CONTAINER" 2>/dev/null || echo 0; }
human() { numfmt --to=iec "${1:-0}" 2>/dev/null || echo "${1:-0}B"; }

usep=$(df / --output=pcent | tail -1 | tr -dc '0-9')
rw_bytes=$(layer_bytes)
rw_gb=$(( ${rw_bytes:-0} / 1073741824 ))

recreate=0
if [ "$rw_gb" -ge "$LAYER_MAX_GB" ]; then
  recreate=1
elif [ "$usep" -ge "$NOTBREMSE_PCT" ] && [ "$rw_gb" -ge "$NOTBREMSE_LAYER_GB" ]; then
  recreate=1
fi

if [ "$recreate" = 0 ]; then
  if [ "$usep" -ge "$SCHWELLE" ]; then
    now=$(date +%s)
    last=$(cat "$STATE/warned" 2>/dev/null || echo 0)
    if [ $((now - last)) -ge 21600 ]; then
      log "WARNUNG: Platte bei ${usep}% (Schwelle ${SCHWELLE}%), Container-Layer aber nur $(human "$rw_bytes") (Grenze ${LAYER_MAX_GB} GB) — kein Recreate, die Belegung liegt woanders (docker system df; du -sh /var/lib/docker/containers/*)"
      echo "$now" > "$STATE/warned"
    fi
  fi
  exit 0
fi

log "Container-Layer bei $(human "$rw_bytes") (Grenze ${LAYER_MAX_GB} GB), Platte ${usep}% — raeume ISR-Cache ab"
before=$(df -h / | awk 'NR==2{print $4}')

# flock teilt sich den Lock mit deploy.sh, damit kein Deploy dazwischenfunkt.
if ! flock -w 600 /var/lock/lt-deploy.lock \
     docker compose -f "$COMPOSE" up -d --force-recreate --no-build "$SERVICE" >>"$LOG" 2>&1; then
  log "FEHLER: Recreate fehlgeschlagen"
  exit 1
fi

docker builder prune -f -a >>"$LOG" 2>&1 || true

# Health-Gate: bis zu 90 s auf die App warten, bevor Entwarnung geloggt wird.
ok=0
for _ in $(seq 1 18); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' -m 10 http://127.0.0.1:$PORT/api/health)" = "200" ]; then
    ok=1; break
  fi
  sleep 5
done

after=$(df -h / | awk 'NR==2{print $4}')
usep2=$(df / --output=pcent | tail -1 | tr -dc '0-9')
rw2=$(human "$(layer_bytes)")
if [ "$ok" = 1 ]; then
  log "OK: Layer $(human "$rw_bytes") -> ${rw2}, Platte ${usep}% -> ${usep2}%, frei ${before} -> ${after}, App antwortet mit 200"
else
  log "WARNUNG: Layer $(human "$rw_bytes") -> ${rw2}, Platte ${usep}% -> ${usep2}%, aber /api/health antwortet nicht mit 200"
fi
