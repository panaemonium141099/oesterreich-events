#!/usr/bin/env bash
# infra/scripts/run-cron.sh — Ersatz fuer Vercels Cron-Invoker (fn-19)
#
#   run-cron.sh <name>
#
# Ruft https://lasstreffen.at/api/cron/<name> mit dem CRON_SECRET auf, genau so
# wie Vercel es getan hat (`Authorization: Bearer ${CRON_SECRET}` — siehe
# src/app/api/cron/expire-boosts/route.ts:31 ff.).
#
# Warum ein Skript und nicht direkt curl im crontab:
#   - Secret bleibt aus der world-readable /etc/cron.d-Datei raus
#   - Timeout, damit ein haengender Endpoint nicht ewig laeuft
#   - Retry, weil ein Deploy-Neustart sonst einen Lauf verschluckt
#   - Ueberlappungsschutz (flock): warm-cache laeuft stuendlich und zieht
#     limit=3000-Payloads; zwei parallele Laeufe wuerden die DB unnoetig treffen
#   - Log + Alert, sonst merkt niemand, dass ein Cron seit Wochen tot ist
#     (genau das ist auf Vercel passiert: seo-daily-snapshot war seit 29.04.
#      tot, MASTERPLAN §3.3)

set -euo pipefail

JOB="${1:?usage: run-cron.sh <job-name>}"

# CRON_SECRET, optional ALERT_EMAIL. chmod 600, root:root.
# shellcheck source=/dev/null
source /etc/lasstreffen/cron.env

BASE_URL="${CRON_BASE_URL:-https://lasstreffen.at}"
URL="${BASE_URL}/api/cron/${JOB}"
LOG_DIR="/var/log/lasstreffen"
LOG="${LOG_DIR}/cron-${JOB}.log"
LOCK="/var/lock/lasstreffen-cron-${JOB}.lock"
TIMEOUT="${CRON_TIMEOUT:-600}"
RETRIES=2

mkdir -p "$LOG_DIR"

log() { printf '%s %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" >>"$LOG"; }

alert() {
	local msg="$1"
	log "ALERT: ${msg}"
	# Best effort — ein fehlgeschlagener Alert darf den Exit-Code nicht
	# ueberschreiben.
	if [[ -n "${ALERT_EMAIL:-}" ]] && command -v mail >/dev/null 2>&1; then
		printf '%s\n\nLog: %s\n' "$msg" "$LOG" |
			mail -s "[lasstreffen] cron ${JOB} failed" "$ALERT_EMAIL" || true
	fi
}

run() {
	local attempt=$1 http_code body tmp
	tmp="$(mktemp)"
	trap 'rm -f "$tmp"' RETURN

	http_code="$(
		curl --silent --show-error \
			--max-time "$TIMEOUT" \
			--output "$tmp" \
			--write-out '%{http_code}' \
			--header "Authorization: Bearer ${CRON_SECRET}" \
			--header 'User-Agent: lasstreffen-cron/1.0' \
			"$URL" 2>>"$LOG"
	)" || http_code="000"

	# Antwort kappen — manche Endpoints geben lange Reports zurueck.
	body="$(head -c 2000 "$tmp" | tr -d '\r')"

	if [[ "$http_code" == "200" ]]; then
		log "OK   ${JOB} (attempt ${attempt}) http=${http_code} ${body}"
		return 0
	fi

	log "FAIL ${JOB} (attempt ${attempt}) http=${http_code} ${body}"
	return 1
}

main() {
	log "START ${JOB} -> ${URL}"

	local attempt=1
	while (( attempt <= RETRIES + 1 )); do
		if run "$attempt"; then
			exit 0
		fi
		if (( attempt <= RETRIES )); then
			# 30 s reichen, um einen systemctl-restart des Web-Service
			# zu ueberbruecken.
			sleep 30
		fi
		(( attempt++ ))
	done

	alert "cron ${JOB} nach $((RETRIES + 1)) Versuchen fehlgeschlagen (${URL})"
	exit 1
}

# Ueberlappungsschutz. -n = nicht warten: laeuft der Vorgaenger noch, ist der
# Endpoint zu langsam fuer seinen Takt — das gehoert geloggt, nicht gequeued.
exec 9>"$LOCK"
if ! flock -n 9; then
	log "SKIP ${JOB} — vorheriger Lauf haelt noch den Lock"
	exit 0
fi

main
