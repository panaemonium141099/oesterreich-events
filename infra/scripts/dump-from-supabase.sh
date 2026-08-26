#!/usr/bin/env bash
# infra/scripts/dump-from-supabase.sh — Cloud-Dump fuer den Umzug (fn-19)
#
#   SUPABASE_DB_URL='postgresql://...' ./dump-from-supabase.sh [ziel-verzeichnis]
#
# Erzeugt DREI getrennte Dumps. Das ist kein Overkill, sondern zwingend:
#
#   1. public.dump   — Schema + Daten. Das ist "unsere" Anwendung: 121
#                      Tabellen, 2 MVs, 49 Funktionen, 33 RLS-Policies.
#   2. auth.dump     — NUR DATEN (56 User). GoTrue legt seine Tabellen beim
#                      ersten Start selbst an und fuehrt eigene Migrationen
#                      aus. Wuerde man das Schema mitdumpen, kollidiert der
#                      Restore mit GoTrues Migrationsstand — der haeufigste
#                      Fehler bei dieser Migration.
#   3. storage.dump  — NUR DATEN (3 Objekte). Gleiche Begruendung wie auth:
#                      storage-api bringt sein Schema selbst mit.
#
# BEWUSST NICHT gedumpt: extensions, graphql, graphql_public, pgbouncer,
# realtime, vault, supabase_functions, supabase_migrations, _analytics,
# cron, net. Die legt der supabase/postgres:17.6.1.136-Container selbst an.
# Sie mitzunehmen erzeugt Versionskonflikte, keinen Mehrwert.
#
# VORAUSSETZUNG: pg_dump >= 17 (Quelle laeuft auf 17.6.1.084).
#   Ubuntu:  apt install postgresql-client-17
# Ein aelterer Client bricht mit "server version mismatch" ab — das ist gut so.
#
# VERBINDUNG: Die Direktverbindung db.<ref>.supabase.co ist bei neueren
# Projekten nur ueber IPv6 erreichbar. Wenn der Host kein IPv6 hat, den
# Session-Pooler nehmen (Port 5432, NICHT 6543 — Transaction-Mode kann kein
# pg_dump). Beide Strings stehen im Supabase-Dashboard unter
# Project Settings → Database → Connection string.

set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL nicht gesetzt (postgresql://...)}"

OUT_DIR="${1:-./supabase-dump-$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$OUT_DIR"

echo "==> Ziel: $OUT_DIR"

# --- Vorflug: Client-Version pruefen ---------------------------------------
client_major="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"
if (( client_major < 17 )); then
	echo "FEHLER: pg_dump ist Version ${client_major}, benoetigt >= 17." >&2
	exit 1
fi
echo "==> pg_dump Version ${client_major} OK"

# --- Vorflug: Baseline-Zeilenzahlen festhalten -----------------------------
# Diese Datei ist die Referenz fuer verify-migration.mjs NACH dem Restore.
# Ohne sie ist "der Restore hat funktioniert" eine Behauptung, keine Aussage.
echo "==> Baseline-Zeilenzahlen werden erfasst (kann 1-2 min dauern)"
psql "$SUPABASE_DB_URL" --no-psqlrc --quiet --tuples-only --no-align \
	--field-separator=$'\t' \
	--command "
	  select schemaname || '.' || relname || E'\t' || n_live_tup
	  from pg_stat_user_tables
	  where schemaname in ('public','auth','storage')
	  order by 1;
	" >"$OUT_DIR/baseline-rowcounts.tsv"
echo "    $(wc -l <"$OUT_DIR/baseline-rowcounts.tsv") Tabellen erfasst"

# Zusaetzlich die Objekte, die pg_stat_user_tables NICHT zeigt.
psql "$SUPABASE_DB_URL" --no-psqlrc --quiet --tuples-only --no-align \
	--command "
	  select 'policies=' || (select count(*) from pg_policies where schemaname='public')
	       || ' functions=' || (select count(*) from pg_proc p
	            join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
	       || ' matviews=' || (select count(*) from pg_matviews where schemaname='public')
	       || ' indexes=' || (select count(*) from pg_indexes where schemaname='public')
	       || ' cronjobs=' || (select count(*) from cron.job);
	" >"$OUT_DIR/baseline-objects.txt"
cat "$OUT_DIR/baseline-objects.txt"

# --- 1) public: Schema + Daten ---------------------------------------------
# -Fc = custom format: komprimiert, und pg_restore kann daraus selektiv und
# parallel (-j) wiederherstellen. Bei 2,5 GB in `events` ist das der
# Unterschied zwischen Minuten und einer Stunde.
echo "==> Dump public (Schema + Daten) ..."
pg_dump "$SUPABASE_DB_URL" \
	--format=custom \
	--schema=public \
	--no-owner \
	--no-privileges \
	--no-publications \
	--no-subscriptions \
	--quote-all-identifiers \
	--verbose \
	--file="$OUT_DIR/public.dump" \
	2>"$OUT_DIR/public.dump.log"
echo "    $(du -h "$OUT_DIR/public.dump" | cut -f1)"

# --- 2) auth: NUR Daten -----------------------------------------------------
echo "==> Dump auth (nur Daten, 56 User) ..."
pg_dump "$SUPABASE_DB_URL" \
	--format=custom \
	--schema=auth \
	--data-only \
	--no-owner \
	--no-privileges \
	--quote-all-identifiers \
	--file="$OUT_DIR/auth-data.dump" \
	2>"$OUT_DIR/auth-data.dump.log"
echo "    $(du -h "$OUT_DIR/auth-data.dump" | cut -f1)"

# --- 3) storage: NUR Daten --------------------------------------------------
echo "==> Dump storage (nur Daten, 3 Objekte) ..."
pg_dump "$SUPABASE_DB_URL" \
	--format=custom \
	--schema=storage \
	--data-only \
	--no-owner \
	--no-privileges \
	--quote-all-identifiers \
	--file="$OUT_DIR/storage-data.dump" \
	2>"$OUT_DIR/storage-data.dump.log"
echo "    $(du -h "$OUT_DIR/storage-data.dump" | cut -f1)"

# --- 4) pg_cron-Jobdefinitionen als lesbares SQL ----------------------------
# cron.job wird NICHT mitgedumpt (eigenes Schema, vom Container verwaltet).
# Wir exportieren die 6 Jobs als Klartext, damit sie nach dem Restore bewusst
# neu angelegt werden koennen — inklusive der noetigen URL-Korrekturen.
echo "==> Exportiere pg_cron-Jobs ..."
psql "$SUPABASE_DB_URL" --no-psqlrc --quiet --tuples-only --no-align \
	--command "select jobid, schedule, active, command from cron.job order by jobid;" \
	>"$OUT_DIR/pgcron-jobs.txt"
cat "$OUT_DIR/pgcron-jobs.txt"

cat <<'EOF'

============================================================================
Dump fertig.

NAECHSTE SCHRITTE — in dieser Reihenfolge:

  1. Stack auf dem Server hochfahren (docker compose up -d), damit GoTrue und
     storage-api ihre EIGENEN Schemas anlegen und migrieren. ERST DANN
     restoren, sonst kollidieren die auth-Daten mit einem leeren Schema.

  2. restore-to-selfhosted.sh laufen lassen.

  3. verify-migration.mjs gegen baseline-rowcounts.tsv laufen lassen.

  4. pgcron-jobs.txt durchgehen und die Jobs manuell neu anlegen. Dabei:
       - die http_post-URLs von *.vercel.app auf https://lasstreffen.at
         umbiegen
       - den Job `send-reminders-hourly` NICHT wieder anlegen. Er ist
         redundant zum taeglichen Cron send-reminders (08:00) und traegt
         ein Doppelversand-Risiko (MASTERPLAN §3.2 B).
       - `refresh-event-stats-cache` lief alle 5 min mit Ø 17,5 s und 41
         Fails/Tag. Auf 30 min stellen (so steht es auch in CLAUDE.md) —
         auf 8 GB RAM sollte der Refresh ohnehin drastisch schneller werden.
============================================================================
EOF
