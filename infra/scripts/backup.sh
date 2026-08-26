#!/usr/bin/env bash
# infra/scripts/backup.sh — taegliches Offsite-Backup (fn-19)
#
# Laeuft per /etc/cron.d/lasstreffen taeglich 02:30 UTC, also VOR dem
# Scrape-Fenster (03:17).
#
# Mit dem Umzug von Supabase Cloud faellt das managed Backup weg. Ab hier gilt:
# ein Backup, das nie zurueckgespielt wurde, ist kein Backup. Deshalb gehoert
# restore-drill.sh zur selben Routine — siehe unten.
#
# Ziel ist eine Hetzner Storage Box (BX11, ~3,20 EUR/Monat, 1 TB). Damit
# bleibt die Gesamtrechnung bei ~17 EUR/Monat.
#
# Voraussetzung: /etc/lasstreffen/backup.env mit
#   PGPASSWORD=...
#   BACKUP_REMOTE=u123456@u123456.your-storagebox.de:/home/backups/lasstreffen
#   ALERT_EMAIL=...

set -euo pipefail

# shellcheck source=/dev/null
source /etc/lasstreffen/backup.env

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="/var/backups/lasstreffen"
LOG="/var/log/lasstreffen/backup.log"
RETENTION_LOCAL_DAYS=3
RETENTION_REMOTE_DAYS=14

export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-postgres}"

mkdir -p "$WORK_DIR" "$(dirname "$LOG")"

log() { printf '%s %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$LOG"; }

fail() {
	log "FEHLER: $*"
	if [[ -n "${ALERT_EMAIL:-}" ]] && command -v mail >/dev/null 2>&1; then
		printf 'Backup fehlgeschlagen: %s\n\nLog:\n%s\n' "$*" "$(tail -30 "$LOG")" |
			mail -s '[lasstreffen] BACKUP FEHLGESCHLAGEN' "$ALERT_EMAIL" || true
	fi
	exit 1
}

log "=== Backup ${STAMP} start ==="

# --- Dump ------------------------------------------------------------------
# Gleiche Aufteilung wie beim Umzug: public vollstaendig, auth/storage nur
# Daten. So ist ein Restore auf einen frisch aufgesetzten Stack identisch zum
# dokumentierten Migrationsweg — kein zweites, ungetestetes Verfahren.
DUMP_DIR="${WORK_DIR}/${STAMP}"
mkdir -p "$DUMP_DIR"

pg_dump --format=custom --schema=public --no-owner --no-privileges \
	--no-publications --no-subscriptions \
	--file="${DUMP_DIR}/public.dump" || fail "pg_dump public"

pg_dump --format=custom --schema=auth --data-only --no-owner --no-privileges \
	--file="${DUMP_DIR}/auth-data.dump" || fail "pg_dump auth"

pg_dump --format=custom --schema=storage --data-only --no-owner --no-privileges \
	--file="${DUMP_DIR}/storage-data.dump" || fail "pg_dump storage"

# Baseline mitschreiben — damit ein spaeterer Restore mit
# verify-migration.mjs ueberpruefbar ist, ohne die Quelle zu brauchen.
psql --no-psqlrc --quiet --tuples-only --no-align --field-separator=$'\t' \
	--command "select schemaname||'.'||relname||E'\t'||n_live_tup
	           from pg_stat_user_tables
	           where schemaname in ('public','auth','storage') order by 1;" \
	>"${DUMP_DIR}/baseline-rowcounts.tsv" || fail "baseline"

psql --no-psqlrc --quiet --tuples-only --no-align \
	--command "select 'policies=' || (select count(*) from pg_policies where schemaname='public')
	     || ' functions=' || (select count(*) from pg_proc p join pg_namespace n
	          on n.oid=p.pronamespace where n.nspname='public')
	     || ' matviews=' || (select count(*) from pg_matviews where schemaname='public')
	     || ' indexes=' || (select count(*) from pg_indexes where schemaname='public')
	     || ' cronjobs=' || (select count(*) from cron.job);" \
	>"${DUMP_DIR}/baseline-objects.txt" || fail "baseline-objects"

# --- Storage-Dateien (3 Objekte, 4,5 MB) ------------------------------------
if [[ -d /var/lib/lasstreffen/storage ]]; then
	tar -czf "${DUMP_DIR}/storage-files.tar.gz" -C /var/lib/lasstreffen storage ||
		fail "tar storage"
fi

# --- Plausibilitaet: leerer Dump ist schlimmer als kein Dump ---------------
# Ein pg_dump kann mit Exit 0 zurueckkommen und trotzdem fast nichts
# enthalten (z.B. wenn die DB gerade neu initialisiert wurde). 500 MB ist
# konservativ: public.dump liegt bei ~3,2 GB Rohdaten komprimiert deutlich
# darueber.
size_bytes="$(stat -c %s "${DUMP_DIR}/public.dump")"
if (( size_bytes < 500 * 1024 * 1024 )); then
	fail "public.dump ist nur $((size_bytes / 1024 / 1024)) MB — zu klein, Dump verdaechtig"
fi
log "public.dump: $((size_bytes / 1024 / 1024)) MB"

# --- Integritaet: laesst sich der Dump ueberhaupt lesen? -------------------
# pg_restore --list scheitert bei abgeschnittenen oder korrupten Archiven.
# Billiger Check, faengt genau den Fall ab, den man sonst erst im Notfall merkt.
pg_restore --list "${DUMP_DIR}/public.dump" >/dev/null || fail "public.dump ist korrupt"
pg_restore --list "${DUMP_DIR}/auth-data.dump" >/dev/null || fail "auth-data.dump ist korrupt"
log "Archiv-Integritaet OK"

# --- Offsite ---------------------------------------------------------------
if [[ -n "${BACKUP_REMOTE:-}" ]]; then
	# --remove-source-files bewusst NICHT: lokale Kopie bleibt als
	# schneller Restore-Pfad, siehe RETENTION_LOCAL_DAYS.
	rsync --archive --compress --partial \
		-e 'ssh -p 23 -o StrictHostKeyChecking=accept-new' \
		"${DUMP_DIR}" "${BACKUP_REMOTE}/" ||
		fail "rsync nach ${BACKUP_REMOTE}"
	log "offsite: ${BACKUP_REMOTE}/${STAMP}"
else
	log "WARNUNG: BACKUP_REMOTE nicht gesetzt — Backup liegt NUR auf demselben Host."
	log "         Bei Plattendefekt oder Server-Verlust ist es mit weg."
fi

# --- Retention -------------------------------------------------------------
find "$WORK_DIR" -maxdepth 1 -type d -name '20*' -mtime "+${RETENTION_LOCAL_DAYS}" \
	-exec rm -rf {} + || true

if [[ -n "${BACKUP_REMOTE:-}" ]]; then
	remote_host="${BACKUP_REMOTE%%:*}"
	remote_path="${BACKUP_REMOTE#*:}"
	ssh -p 23 "$remote_host" \
		"find '${remote_path}' -maxdepth 1 -type d -name '20*' -mtime +${RETENTION_REMOTE_DAYS} -exec rm -rf {} +" \
		|| log "WARNUNG: Remote-Retention fehlgeschlagen"
fi

log "=== Backup ${STAMP} fertig ==="

# ---------------------------------------------------------------------------
# RESTORE-DRILL
#
# Dieses Skript beweist NICHT, dass ein Restore funktioniert — nur, dass ein
# lesbares Archiv existiert. Der echte Beweis ist:
#
#   1. Leere Datenbank anlegen:
#        createdb -h 127.0.0.1 -U postgres restore_drill
#   2. PGDATABASE=restore_drill infra/scripts/restore-to-selfhosted.sh \
#        /var/backups/lasstreffen/<STAMP>
#   3. PGDATABASE=restore_drill node infra/scripts/verify-migration.mjs \
#        /var/backups/lasstreffen/<STAMP>
#   4. dropdb restore_drill
#
# EINMAL VOR DEM CUTOVER (Abnahmekriterium fn-19) und danach quartalsweise.
# Dauer protokollieren — im Ernstfall willst du wissen, ob du von 20 Minuten
# oder von 3 Stunden Ausfall ausgehen musst.
# ---------------------------------------------------------------------------
