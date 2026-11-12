#!/usr/bin/env bash
# Nimmt ein fertig gebautes App-Image entgegen und startet es. Gegenstück zu
# scripts/deploy/build-image.sh: der GitHub-Runner baut, der Server lädt nur.
# Auf dem Server baut dann nichts mehr neben der Datenbank (MASTERPLAN §3.15).
#
# VORLAGE. Vor dem Einspielen gegen /opt/app/deploy.sh prüfen: Verzeichnis der
# Compose-Datei, Name des Images, Health-Adresse und das Aufräumen der Platte
# müssen dem entsprechen, was deploy.sh heute tut (siehe README.md).
#
# Aufruf auf dem Server (deploy.yml):
#   gunzip -c | /opt/app/deploy-image.sh <commit>     Image von stdin laden und starten
#   /opt/app/deploy-image.sh --rollback               voriges Image wieder starten
#
# Das Image heißt wie bisher (Standard lasstreffen-app:latest), die
# Compose-Datei bleibt unverändert; nur `build` entfällt.
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/app}
IMAGE=${IMAGE:-lasstreffen-app:latest}
PREVIOUS=${IMAGE%:*}:previous
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3000/api/health}

cd "$APP_DIR"

start() {
  # --no-build: die Compose-Datei nennt noch einen Build-Kontext, gebaut wird
  # hier aber nie. --force-recreate: gleicher Tag, neues Image.
  docker compose up -d --no-build --force-recreate
  for i in $(seq 1 40); do
    if curl -fsS -o /dev/null "$HEALTH_URL"; then
      echo "Health ok nach $((i * 3)) s"
      return 0
    fi
    sleep 3
  done
  echo "Health-Check nach 120 s nicht grün: $HEALTH_URL" >&2
  return 1
}

if [ "${1:-}" = "--rollback" ]; then
  docker image inspect "$PREVIOUS" >/dev/null
  docker tag "$PREVIOUS" "$IMAGE"
  start
  echo "Zurück auf das vorige Image."
  exit 0
fi

commit=${1:-unbekannt}

# Das laufende Image als Rückweg behalten, bevor der Tag überschrieben wird.
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker tag "$IMAGE" "$PREVIOUS"
fi

# Das Image kommt als `docker save`-Strom über stdin.
docker load

if ! start; then
  echo "Neues Image startet nicht, zurück auf das vorige." >&2
  if docker image inspect "$PREVIOUS" >/dev/null 2>&1; then
    docker tag "$PREVIOUS" "$IMAGE"
    start || true
  fi
  exit 1
fi

# Verwaiste Schichten älterer Images entfernen; `previous` trägt einen Tag und bleibt.
docker image prune -f >/dev/null

echo "Deploy fertig: $commit"
df -h / | awk 'NR==2 { print "Platte: " $5 }'
