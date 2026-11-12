#!/bin/bash
# lt-watchdog — Server-Wächter für lasstreffen.at (läuft alle 15 min via systemd).
#
# Prüft 9 Punkte (Health, Container, Platte, RAM, Timer, Backup, Postgres,
# pg_cron, GitHub-Workflows). Bei Problemen: Mail via Brevo an ALERT_EMAIL —
# mit Dedup (gleiche Problemlage wird max. alle 6 h erneut gemailt) und
# Entwarnungs-Mail, sobald wieder alles grün ist.
#
# Stufe 2 (optional): Ist die Claude-CLI installiert und authentifiziert
# (`claude setup-token` einmalig auf dem Server), hängt der Wächter eine
# KI-Diagnose der Logs an die Alarm-Mail an. Ohne CLI läuft alles normal.
#
# Aufruf:  watchdog.sh            # normaler Prüflauf
#          watchdog.sh --test     # erzwingt einen Test-Alarm (Mail-Probe)
set -u

ENV=/opt/app/.env.master
STATE=/var/lib/lt-watchdog
mkdir -p "$STATE"

get() { grep -E "^$1=" "$ENV" | head -1 | cut -d= -f2-; }
BREVO_KEY=$(get BREVO_API_KEY)
TO=$(get ALERT_EMAIL)
FROM=$(get EMAIL_FROM)
FROM_NAME=$(get EMAIL_FROM_NAME)
GH_TOKEN=$(get GITHUB_TOKEN)

ISSUES=()

# ── 1) Health-Endpoint ───────────────────────────────────────────────────
# Lokal gegen den Container: von außen weist die eigene Bot-Sperre die
# Rechenzentrums-IP des Servers mit 403 ab. Das stand bis 2026-11-12 als
# Fehlalarm in jeder Mail.
code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/health || echo 000)
[ "$code" = "200" ] || ISSUES+=("Health-Endpoint der App (127.0.0.1:3000/api/health) liefert HTTP $code")

# ── 2) Container ─────────────────────────────────────────────────────────
unhealthy=$(docker ps --filter health=unhealthy --format '{{.Names}}' | tr '\n' ' ')
[ -n "${unhealthy// }" ] && ISSUES+=("Unhealthy Container: $unhealthy")
running=$(docker ps -q | wc -l)
[ "$running" -lt 12 ] && ISSUES+=("Nur $running Container laufen (erwartet: 12+)")

# ── 3) Platte (die Lehre vom 01.09.: 22GB Build-Cache -> Postgres-PANIC) ─
usep=$(df / --output=pcent | tail -1 | tr -dc '0-9')
[ "$usep" -ge 80 ] && ISSUES+=("Platte bei ${usep}% — bitte anschauen (docker system df?)")

# ── 4) RAM ───────────────────────────────────────────────────────────────
avail=$(free -m | awk '/^Mem:/{print $7}')
[ "$avail" -lt 400 ] && ISSUES+=("Nur noch ${avail} MB RAM verfügbar")

# ── 5) Fehlgeschlagene lt-Units ──────────────────────────────────────────
failed=$(systemctl --failed --no-legend 'lt-*' 2>/dev/null | awk '{print $2}' | tr '\n' ' ')
[ -n "${failed// }" ] && ISSUES+=("Fehlgeschlagene systemd-Units: $failed")

# ── 6) Backup-Alter (nächtlicher pg_dump 02:20, Toleranz 26h) ────────────
newest=$(find /var/backups -name 'lasstreffen-*.dump' -mmin -1560 2>/dev/null | head -1)
[ -z "$newest" ] && ISSUES+=("Kein DB-Backup jünger als 26 Stunden in /var/backups")

# ── 7) Postgres ──────────────────────────────────────────────────────────
if ! docker exec supabase-db pg_isready -U supabase_admin -q 2>/dev/null; then
  ISSUES+=("Postgres antwortet nicht (pg_isready failed)")
else
  panics=$(docker logs supabase-db --since 20m 2>&1 | grep -c 'PANIC' || true)
  [ "${panics:-0}" -gt 0 ] && ISSUES+=("Postgres-PANIC in den letzten 20 Minuten — Logs prüfen!")
fi

# ── 8) pg_cron-Fehler der letzten Stunde ─────────────────────────────────
cronfails=$(docker exec supabase-db psql -U supabase_admin -d postgres -tAc \
  "select count(*) from cron.job_run_details where start_time > now() - interval '1 hour' and status not in ('succeeded','running')" 2>/dev/null || echo '?')
if [ "$cronfails" = "?" ]; then
  ISSUES+=("pg_cron-Status nicht abfragbar")
elif [ "$cronfails" != "0" ]; then
  ISSUES+=("$cronfails fehlgeschlagene pg_cron-Jobs in der letzten Stunde")
fi

# ── 9) GitHub-Workflows (letzter Lauf je kritischem Workflow) ────────────
for wf in scrape-events.yml import-eventim.yml blog-autowriter.yml deploy.yml; do
  concl=$(curl -s -m 20 -H "Authorization: Bearer $GH_TOKEN" \
    "https://api.github.com/repos/panaemonium141099/oesterreich-events/actions/workflows/$wf/runs?per_page=1" \
    | python3 -c 'import json,sys
r = json.load(sys.stdin).get("workflow_runs", [])
print((r[0]["conclusion"] or "running") if r else "none")' 2>/dev/null || echo unknown)
  case "$concl" in
    success|running|none|unknown) ;;
    *) ISSUES+=("GitHub-Workflow $wf: letzter Lauf endete mit '$concl'") ;;
  esac
done

# ── Testmodus ────────────────────────────────────────────────────────────
if [ "${1:-}" = "--test" ]; then
  ISSUES+=("TESTALARM — der Wächter kann Mails verschicken. Diese Meldung darf ignoriert werden.")
fi

# ── Mailversand (Brevo API) ──────────────────────────────────────────────
send_mail() { # $1=subject  $2=body
  SUBJ="$1" BODY="$2" MAILTO="$TO" MAILFROM="$FROM" MAILFROMNAME="${FROM_NAME:-lasstreffen Wächter}" BREVO="$BREVO_KEY" python3 - <<'PY'
import json, os, urllib.request
payload = {
    "sender": {"email": os.environ["MAILFROM"], "name": os.environ["MAILFROMNAME"]},
    "to": [{"email": os.environ["MAILTO"]}],
    "subject": os.environ["SUBJ"],
    "textContent": os.environ["BODY"],
}
req = urllib.request.Request(
    "https://api.brevo.com/v3/smtp/email",
    data=json.dumps(payload).encode(),
    headers={"api-key": os.environ["BREVO"], "Content-Type": "application/json"},
)
print(urllib.request.urlopen(req, timeout=20).status)
PY
}

NOW=$(date +%s)
HOST=$(hostname)
STAMP=$(date -u '+%Y-%m-%d %H:%M UTC')

if [ ${#ISSUES[@]} -eq 0 ]; then
  # Alles grün — falls vorher Alarm aktiv war: Entwarnung schicken.
  if [ -f "$STATE/active" ]; then
    rm -f "$STATE/active"
    send_mail "✅ lasstreffen-Server: Entwarnung" \
"Alle Prüfungen wieder grün ($STAMP, $HOST).

Der zuvor gemeldete Zustand hat sich aufgelöst." >/dev/null 2>&1 || true
  fi
  exit 0
fi

# Gleiche Lage = gleiche Meldungen ohne ihre Zahlen. Mit Zahlen wechselte
# der Hash bei jedem Prozentpunkt der Platte (90 bis 95 % im Stundentakt des
# ISR-Schutzes) und der 6-h-Schutz griff nie: 189 Mails in drei Tagen
# (10. bis 12.11.2026), die Berichte der Pipelines gingen darin unter.
HASH=$(printf '%s\n' "${ISSUES[@]}" | sed -E 's/[0-9]+/N/g' | md5sum | cut -d' ' -f1)
LAST_HASH=$(sed -n 1p "$STATE/active" 2>/dev/null || true)
LAST_TS=$(sed -n 2p "$STATE/active" 2>/dev/null || echo 0)
if [ "$HASH" = "$LAST_HASH" ] && [ $((NOW - LAST_TS)) -lt 21600 ]; then
  exit 0  # gleiche Lage, letzte Mail < 6h her — nicht fluten
fi

BODY="Der Wächter hat um $STAMP auf $HOST Folgendes gefunden:

$(printf ' • %s\n' "${ISSUES[@]}")

Schnell-Checks:
  ssh root@157.180.42.4
  df -h /  ·  docker ps  ·  systemctl --failed
  docker logs supabase-db --since 30m | grep -iE 'panic|fatal'
GitHub: https://github.com/panaemonium141099/oesterreich-events/actions"

# Stufe 2: Claude-Diagnose, falls CLI vorhanden und authentifiziert.
if command -v claude >/dev/null 2>&1; then
  DIAG=$(cd /opt/app && timeout 240 claude -p --max-turns 8 \
    "Du bist der Server-Wächter von lasstreffen.at (Hetzner, Docker: Supabase-Stack + Next.js in /opt/supabase und /opt/app). Diese Probleme wurden erkannt:
$(printf '%s\n' "${ISSUES[@]}")
Untersuche die Ursache mit Lesebefehlen (docker logs, journalctl, df, systemctl status — NICHTS verändern!) und antworte mit max. 10 Zeilen auf Deutsch: Ursache, Schweregrad (kritisch/kann warten), empfohlene Aktion." 2>/dev/null | tail -c 2500 || true)
  [ -n "$DIAG" ] && BODY="$BODY

── Claude-Diagnose ─────────────────────────
$DIAG"
fi

if send_mail "⚠️ lasstreffen-Server: ${#ISSUES[@]} Problem(e)" "$BODY" >/dev/null 2>&1; then
  printf '%s\n%s\n' "$HASH" "$NOW" > "$STATE/active"
else
  # Mail fehlgeschlagen -> nicht als versendet markieren, nächster Lauf probiert erneut
  logger -t lt-watchdog "Alarm-Mail konnte nicht versendet werden (${#ISSUES[@]} Issues)"
  exit 1
fi
