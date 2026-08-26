#!/usr/bin/env bash
# infra/scripts/deploy.sh — Deploy ohne Vercel (fn-19)
#
#   ./deploy.sh [git-ref]        # default: origin/master
#
# Ersetzt "Push auf master → Vercel baut". Ablauf:
#   1. Neues Release-Verzeichnis aus Git auschecken
#   2. Dort bauen (npm ci + next build, output: 'standalone')
#   3. Symlink /opt/lasstreffen/current umhaengen
#   4. systemctl restart lasstreffen-web
#   5. Health-Check — schlaegt er fehl, Symlink zurueck und Restart
#
# Der Symlink-Tausch macht Rollback zu einem Einzeiler. Das ist der Ersatz
# fuer Vercels "Instant Rollback" und der Grund, warum NICHT in-place gebaut
# wird: ein fehlgeschlagener Build darf die laufende Version nie anfassen.

set -euo pipefail

GIT_REF="${1:-origin/master}"
BASE="/opt/lasstreffen"
REPO="${BASE}/repo"
RELEASES="${BASE}/releases"
CURRENT="${BASE}/current"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RELEASE="${RELEASES}/${STAMP}"
KEEP_RELEASES=5

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mFEHLER:\033[0m %s\n' "$*" >&2; exit 1; }

[[ -d "$REPO/.git" ]] || die "$REPO ist kein Git-Repo. Erst klonen."

PREVIOUS=""
[[ -L "$CURRENT" ]] && PREVIOUS="$(readlink -f "$CURRENT")"

# --- 1) Auschecken ----------------------------------------------------------
log "Fetch + Checkout ${GIT_REF}"
git -C "$REPO" fetch --all --prune --quiet
COMMIT="$(git -C "$REPO" rev-parse "$GIT_REF")"
mkdir -p "$RELEASE"
git -C "$REPO" archive "$COMMIT" | tar -x -C "$RELEASE"
log "Release ${STAMP} @ ${COMMIT:0:8}"

# --- 2) Bauen ---------------------------------------------------------------
cd "$RELEASE"

# Die Build-Zeit-Env MUSS hier vorliegen: NEXT_PUBLIC_*-Variablen werden ins
# Client-Bundle einkompiliert, und next.config.ts leitet aus
# NEXT_PUBLIC_SUPABASE_URL den CSP-connect-src ab (fn-19). Fehlt sie beim
# Build, blockt die CSP im Browser spaeter alle DB-Aufrufe.
set -a
# shellcheck source=/dev/null
source /etc/lasstreffen/web.env
set +a
[[ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]] || die "NEXT_PUBLIC_SUPABASE_URL fehlt in /etc/lasstreffen/web.env"

log "npm ci"
# `npm ci` ist strikt gegen package-lock.json. Genau diese Striktheit hat am
# 19.-20.07. alle Crons lahmgelegt (MASTERPLAN §3.6) — hier bricht sie den
# Deploy ab, statt still eine kaputte Version auszurollen. Gewollt.
npm ci --no-audit --no-fund

log "next build"
npm run build

# standalone-Output zusammensetzen. Next kopiert nur den Server-Code nach
# .next/standalone; static und public muessen daneben.
[[ -f .next/standalone/server.js ]] || die "kein .next/standalone/server.js — ist output:'standalone' gesetzt?"
cp -r .next/static .next/standalone/.next/static
[[ -d public ]] && cp -r public .next/standalone/public
mkdir -p .next/standalone/.next/cache

# --- 3) Umhaengen -----------------------------------------------------------
log "Symlink -> ${RELEASE}/.next/standalone"
ln -sfn "${RELEASE}/.next/standalone" "$CURRENT"
chown -R lasstreffen:lasstreffen "$RELEASE"

log "systemctl restart lasstreffen-web"
systemctl restart lasstreffen-web

# --- 4) Health-Check --------------------------------------------------------
log "Health-Check /api/health"
healthy=0
for i in {1..30}; do
	if curl --silent --fail --max-time 5 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
		healthy=1
		log "gesund nach ${i}s"
		break
	fi
	sleep 1
done

if (( healthy == 0 )); then
	printf '\033[1;31m==> Health-Check fehlgeschlagen — ROLLBACK\033[0m\n'
	if [[ -n "$PREVIOUS" ]]; then
		ln -sfn "$PREVIOUS" "$CURRENT"
		systemctl restart lasstreffen-web
		die "Rollback auf ${PREVIOUS} durchgefuehrt. Release ${STAMP} liegt zur Analyse unter ${RELEASE}."
	fi
	die "Kein vorheriges Release fuer Rollback vorhanden. Dienst ist UNTEN."
fi

# --- 5) Aufraeumen ----------------------------------------------------------
# Aeltere Releases wegwerfen, aber nie das aktuell verlinkte.
cd "$RELEASES"
ls -1dt */ 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))" | while read -r old; do
	old_path="$(readlink -f "$old")"
	[[ "$old_path" == "$(readlink -f "$CURRENT")"* ]] && continue
	log "loesche altes Release ${old}"
	rm -rf "$old"
done

log "Deploy ${STAMP} fertig (${COMMIT:0:8})"
echo
echo "Rollback jederzeit:"
echo "  ln -sfn ${PREVIOUS:-<vorheriges-release>} ${CURRENT} && systemctl restart lasstreffen-web"
