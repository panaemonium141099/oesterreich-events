#!/bin/sh
# Deploy ohne Build auf dem Server: nimmt ein fertig gebautes App-Image von
# stdin entgegen und startet es. Gegenstück zu scripts/deploy/build-image.sh:
# der GitHub-Runner baut, der Server lädt nur noch. Vorher baute
# /opt/app/deploy.sh neben der Datenbank; während der Typprüfung liefen
# Abfragen der Nachtläufe in den Statement-Timeout (MASTERPLAN §3.15).
#
# Aufruf (deploy.yml, Variable DEPLOY_BUILD=runner):
#   docker save lasstreffen-app:latest | gzip | ssh … 'gunzip -c | /opt/app/deploy-image.sh <commit>'
#   /opt/app/deploy-image.sh --rollback      voriges Image wieder starten
#
# Abgeglichen mit /opt/app/deploy.sh (Stand 2026-09-10, gelesen 2026-11-14):
# dieselbe Sperre, dasselbe Aufräumen, derselbe Dienst (`nextjs`, Image
# lasstreffen-app:latest, Container nextjs-app), derselbe Health-Check mit
# Rückfall auf lasstreffen-app:previous. Es entfällt nur `docker compose build`.
set -e

SELF=/opt/app/deploy-image.sh
LOCK=/var/lock/lt-deploy.lock     # dieselbe Sperre wie deploy.sh
LOCK_WAIT=1500
HEALTH_TRIES=45                   # 45 x 2 s = 90 s auf /api/health warten
PRUNE_AT_PCT=70
MIN_FREE_GB=4                     # das Image braucht entpackt rund 2 GB
IMAGE=lasstreffen-app:latest
PREVIOUS=lasstreffen-app:previous

# ── 1) Sperre: nur ein Deploy gleichzeitig (stdin bleibt über exec erhalten) ──
if [ -z "${LT_DEPLOY_LOCK_HELD:-}" ]; then
  if ! flock -n "$LOCK" true 2>/dev/null; then
    echo "Ein anderer Deploy laeuft bereits — warte (max. $((LOCK_WAIT / 60)) min) ..."
  fi
  LT_DEPLOY_LOCK_HELD=1
  export LT_DEPLOY_LOCK_HELD
  exec flock --wait "$LOCK_WAIT" "$LOCK" "$SELF" "$@"
fi

health() {
  i=0
  code=000
  while [ "$i" -lt "$HEALTH_TRIES" ]; do
    code=$(curl -s -m 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/health || echo 000)
    [ "$code" = "200" ] && return 0
    i=$((i + 1))
    sleep 2
  done
  echo "FEHLER: /api/health liefert HTTP $code nach $((i * 2)) s." >&2
  return 1
}

cd /opt/app

# ── Rückweg von Hand ─────────────────────────────────────────────────────
if [ "${1:-}" = "--rollback" ]; then
  docker image inspect "$PREVIOUS" >/dev/null
  docker tag "$PREVIOUS" "$IMAGE"
  docker compose up -d --no-build --force-recreate nextjs
  health
  echo "ROLLBACK OK: $PREVIOUS bedient wieder Traffic."
  exit 0
fi

commit=${1:-unbekannt}

# ── 2) Plattenpflege, läuft auch bei einem gescheiterten Deploy ──────────
prune_disk() {
  docker image prune -f >/dev/null 2>&1 || true
  used=$(df --output=pcent / | tail -1 | tr -dc '0-9')
  if [ "${used:-0}" -ge "$PRUNE_AT_PCT" ]; then
    echo "Platte bei ${used} % (>= ${PRUNE_AT_PCT} %) — leere den Build-Cache komplett."
    docker builder prune -f -a >/dev/null 2>&1 || true
    echo "Platte danach: $(df -h --output=pcent / | tail -1 | tr -d ' ')"
  fi
}
trap prune_disk EXIT

# ── 3) Liegengebliebene Recreate-Backups entfernen (wie deploy.sh) ───────
live_id=$(docker ps -q --filter 'name=^nextjs-app$' | head -1)
docker ps -a --format '{{.ID}} {{.Names}} {{.State}}' \
  | grep -E ' [0-9a-f]{8,64}_nextjs-app ' \
  | while read -r cid cname cstate; do
      if [ "$cid" = "$live_id" ] || [ "$cstate" = "running" ]; then
        echo "WARNUNG: $cname laeuft noch — nicht geloescht (bedient evtl. Traffic)."
      else
        echo "Raeume liegengebliebenes Recreate-Backup auf: $cname ($cid)"
        docker rm -f "$cid" >/dev/null 2>&1 || true
      fi
    done

# ── 4) Platz prüfen, bevor geladen wird ──────────────────────────────────
prune_disk
free_gb=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')
if [ "${free_gb:-0}" -lt "$MIN_FREE_GB" ]; then
  echo "FEHLER: nur ${free_gb} GB frei (< ${MIN_FREE_GB} GB) — Deploy abgebrochen." >&2
  df -h / >&2
  exit 1
fi

# ── 5) Quellstand nachziehen (Skripte und Timer lesen /opt/app/src) ──────
# Gebaut wird hier nichts; der Stand soll nur zum laufenden Image passen.
git -C /opt/app/src fetch -q origin master
git -C /opt/app/src reset -q --hard origin/master

# ── 6) Laufendes Image als Rückfallebene sichern, dann das neue laden ────
rollback_ready=0
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  if docker tag "$IMAGE" "$PREVIOUS" 2>/dev/null; then
    rollback_ready=1
  fi
fi

docker load
docker compose up -d --no-build --force-recreate nextjs

# ── 7) Erst ein antwortender Container ist ein Deploy ────────────────────
if ! health; then
  docker ps -a --filter 'name=nextjs-app' >&2
  docker logs --tail 50 nextjs-app >&2 || true
  if [ "$rollback_ready" = "1" ]; then
    echo "Rolle zurueck auf $PREVIOUS ..." >&2
    if docker tag "$PREVIOUS" "$IMAGE" 2>&1; then
      docker compose up -d --no-build --force-recreate nextjs >&2 || true
    else
      echo "Konnte :previous nicht auf :latest zuruecktaggen." >&2
    fi
    if health; then
      echo "ROLLBACK OK: die alte Version bedient wieder Traffic." >&2
      echo "Der neue Stand ist NICHT live — Ursache fixen und neu deployen." >&2
    else
      echo "ROLLBACK FEHLGESCHLAGEN. Die Seite ist unten und braucht Handanlegen." >&2
    fi
  else
    echo "Kein :previous-Image vorhanden — kein Rollback moeglich." >&2
  fi
  exit 1
fi

echo "Deploy fertig: $commit ($(git -C /opt/app/src log --oneline -1))"
