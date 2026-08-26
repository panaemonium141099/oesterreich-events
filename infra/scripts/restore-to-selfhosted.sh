#!/usr/bin/env bash
# infra/scripts/restore-to-selfhosted.sh — Gegenstueck zu dump-from-supabase.sh
#
#   ./restore-to-selfhosted.sh <dump-verzeichnis>
#
# REIHENFOLGE IST KRITISCH. Der Stack muss VORHER einmal gelaufen sein, damit
# GoTrue und storage-api ihre Schemas angelegt und migriert haben:
#
#   cd /opt/supabase/docker && docker compose up -d && sleep 60
#
# Erst danach dieses Skript. Wer zuerst restored und dann den Stack startet,
# bekommt Migrations-Kollisionen im auth-Schema.

set -euo pipefail

DUMP_DIR="${1:?usage: restore-to-selfhosted.sh <dump-verzeichnis>}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
export PGHOST PGPORT PGUSER PGDATABASE
: "${PGPASSWORD:?PGPASSWORD nicht gesetzt (= POSTGRES_PASSWORD aus der .env)}"

# 4 vCPU → 3 parallele Restore-Jobs. Der vierte Kern bleibt fuer Postgres
# selbst und die uebrigen Container.
JOBS="${RESTORE_JOBS:-3}"

for f in public.dump auth-data.dump storage-data.dump; do
	[[ -f "$DUMP_DIR/$f" ]] || { echo "FEHLER: $DUMP_DIR/$f fehlt" >&2; exit 1; }
done

echo "==> Ziel: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
psql --no-psqlrc --quiet --command 'select version();'

# --- Sicherung gegen versehentliches Ueberschreiben -------------------------
existing="$(psql --no-psqlrc --quiet --tuples-only --no-align --command \
	"select count(*) from pg_stat_user_tables where schemaname='public';")"
if [[ "$existing" != "0" ]]; then
	echo "WARNUNG: public enthaelt bereits ${existing} Tabellen."
	read -r -p "Wirklich fortfahren und ueberschreiben? (tippe: JA) " ans
	[[ "$ans" == "JA" ]] || { echo "Abgebrochen."; exit 1; }
fi

# --- Extensions VOR dem Restore ---------------------------------------------
# public.dump enthaelt Spalten vom Typ `vector` und Indizes auf `gin_trgm_ops`.
# Fehlt die Extension, scheitert der Restore mittendrin und hinterlaesst eine
# halb gefuellte DB — der unangenehmste aller Zustaende.
echo "==> Extensions anlegen ..."
psql --no-psqlrc --quiet <<'SQL'
create extension if not exists pg_trgm;
create extension if not exists vector;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
SQL

# --- 1) public: Schema + Daten ---------------------------------------------
# --no-owner: die Cloud-Rollen (supabase_admin etc.) existieren hier anders.
# --if-exists --clean: idempotent, ein zweiter Lauf ist gefahrlos.
echo "==> Restore public (das dauert am laengsten, ~2,5 GB in 'events') ..."
pg_restore \
	--dbname="$PGDATABASE" \
	--jobs="$JOBS" \
	--no-owner \
	--no-privileges \
	--clean --if-exists \
	--verbose \
	"$DUMP_DIR/public.dump" \
	2>"$DUMP_DIR/restore-public.log" || {
		echo "Restore public meldete Fehler — Log pruefen:"
		echo "  $DUMP_DIR/restore-public.log"
		echo "Hinweis: Meldungen zu nicht existierenden Rollen oder zu"
		echo "'extension \"...\" already exists' sind erwartbar und harmlos."
		grep -c '^pg_restore: error' "$DUMP_DIR/restore-public.log" || true
	}

# --- 2) auth: nur Daten -----------------------------------------------------
# --disable-triggers: die auth-Tabellen haben FKs untereinander; ohne das
# scheitert der Insert an der Reihenfolge.
echo "==> Restore auth-Daten (56 User) ..."
pg_restore \
	--dbname="$PGDATABASE" \
	--data-only \
	--no-owner \
	--disable-triggers \
	--verbose \
	"$DUMP_DIR/auth-data.dump" \
	2>"$DUMP_DIR/restore-auth.log" || {
		echo "Restore auth meldete Fehler — Log: $DUMP_DIR/restore-auth.log"
	}

# --- 3) storage: nur Daten --------------------------------------------------
echo "==> Restore storage-Daten (3 Objekte) ..."
pg_restore \
	--dbname="$PGDATABASE" \
	--data-only \
	--no-owner \
	--disable-triggers \
	--verbose \
	"$DUMP_DIR/storage-data.dump" \
	2>"$DUMP_DIR/restore-storage.log" || {
		echo "Restore storage meldete Fehler — Log: $DUMP_DIR/restore-storage.log"
	}

# --- 4) Nacharbeiten --------------------------------------------------------
echo "==> MVs befuellen ..."
# MVs kommen aus dem Dump als Definition, aber je nach Dump-Zeitpunkt leer.
# Ohne diesen Refresh liefert die Karte (/api/events/map-points) nichts.
psql --no-psqlrc <<'SQL'
refresh materialized view public.event_stats_cache;
refresh materialized view public.event_map_points;
SQL

echo "==> ANALYZE (Planner-Statistiken) ..."
# Ohne frische Statistiken waehlt der Planner nach einem Restore reihenweise
# Seq-Scans — die Seite waere danach langsamer als vorher und man wuerde den
# Umzug faelschlich fuer die Ursache halten.
psql --no-psqlrc --quiet --command 'analyze;'

cat <<'EOF'

============================================================================
Restore fertig. JETZT VERIFIZIEREN, nicht hoffen:

  node infra/scripts/verify-migration.mjs <dump-verzeichnis>

Danach manuell:
  - pg_cron-Jobs aus pgcron-jobs.txt neu anlegen (URLs umbiegen,
    send-reminders-hourly weglassen)
  - Storage-Dateien kopieren (3 Objekte) — siehe infra/README.md
  - Google-OAuth-Redirect-URI in der Cloud Console ergaenzen:
    https://db.lasstreffen.at/auth/v1/callback
============================================================================
EOF
