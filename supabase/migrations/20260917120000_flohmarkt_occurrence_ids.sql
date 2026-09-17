-- flohmarkt.at (boudicca:flohmarkt): Bestand an das neue Vorkommen-Modell
-- angleichen. Gehört zu src/lib/scrapers/flohmarkt-occurrences.ts.
--
-- Anlass (2026-09-17): Beschwerde Rotes Kreuz Hollabrunn. flohmarkt.at führt
-- einen wiederkehrenden Markt als EINEN Eintrag mit wanderndem Datum, die
-- restlichen Termine nur als Text in der Beschreibung, die Uhrzeit nur als
-- "8-14 Uhr" in der Adresszeile. Boudicca vergibt für jeden Stand eine neue
-- UUID, also entstand bei uns pro Woche eine neue Zeile, die die Terminliste
-- und die Uhrzeit dieser Woche einfror. Google indexierte die Zeile vom
-- 26.08. ("8-14 Uhr", Liste bis 14.10.), obwohl der Veranstalter längst
-- 10-17 Uhr und andere Termine gemeldet hatte.
--
-- Datenmigration, KEIN Schema. Idempotent: jeder Schritt filtert auf den
-- alten Zustand. Ausführen per psql auf dem Server (nicht über PostgREST):
--   cd /opt/supabase && docker compose exec -T db psql -U supabase_admin -d postgres -f -
--
-- WICHTIG: Schritt 3 muss VOR dem ersten Scrape-Lauf mit dem neuen Scraper
-- durch sein (scrape-events.yml, 03:17 UTC) — sonst legt der Lauf jede
-- künftige flohmarkt.at-Zeile unter der neuen Kennung ein zweites Mal an.

BEGIN;

-- ── 1. Beschreibung: Datums-Kopfzeile und Terminliste entfernen ───────────
-- Auf einer Einzelseite ist die Kopfzeile redundant und die Liste nach einer
-- Woche falsch. Gleiche Regeln wie stripFlohmarktScheduleBlock() im Code.
UPDATE events
   SET description = NULLIF(btrim(
         regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(
                 description,
                 'Dieser Markt findet noch an folgenden Tagen statt:?.*?(eventuell weitere Termine wurden vom Veranstalter noch nicht gemeldet!?|$)',
                 '', 'i'),
               '^\s*(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s+\d{1,2}\.\s*(Jänner|Jaenner|Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}(\s*[-–]\s*(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s+\d{1,2}\.\s*(Jänner|Jaenner|Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4})?[ \t]*\n',
               '', 'i'),
             '[ \t ]+', ' ', 'g'),
           '[ \t]*\n[ \t\n]*', E'\n', 'g'),
         E' \n\t'), '')
 WHERE source_name = 'boudicca:flohmarkt'
   AND (
     description ~* 'Dieser Markt findet noch an folgenden Tagen statt'
     OR description ~* '^\s*(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s+\d{1,2}\.\s*\w+\s+\d{4}'
   );

-- ── 2. Ende aus dem Uhrzeitbereich nachtragen ─────────────────────────────
-- Boudicca liefert für Eintages-Märkte kein Ende; der Text hat es ("8-14
-- Uhr"). Nur dort, wo der Beginn des Bereichs mit der gespeicherten Startzeit
-- übereinstimmt (2.150 von 2.152 Zeilen am 2026-09-17) — sonst wäre der
-- Bereich nicht der des Markttags.
WITH parsed AS (
  SELECT id, start_date,
         regexp_match(description, '(?<![0-9.:])(\d{1,2})(?:[:.](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[:.](\d{2}))?\s*Uhr', 'i') AS m
    FROM events
   WHERE source_name = 'boudicca:flohmarkt' AND end_date IS NULL
), derived AS (
  SELECT id,
         (start_date AT TIME ZONE 'Europe/Vienna')::date AS tag,
         extract(hour   FROM start_date AT TIME ZONE 'Europe/Vienna')::int AS start_h,
         extract(minute FROM start_date AT TIME ZONE 'Europe/Vienna')::int AS start_m,
         m[1]::int AS ph, coalesce(m[2], '0')::int AS pm,
         m[3]::int AS eh, coalesce(m[4], '0')::int AS em
    FROM parsed WHERE m IS NOT NULL
)
UPDATE events e
   SET end_date = (d.tag + make_interval(hours => d.eh, mins => d.em)) AT TIME ZONE 'Europe/Vienna'
  FROM derived d
 WHERE e.id = d.id
   AND d.ph = d.start_h AND d.pm = d.start_m
   AND d.eh <= 24 AND d.em < 60
   AND (d.eh * 60 + d.em) > (d.ph * 60 + d.pm);

-- ── 3. Stabile Kennung für künftige Termine ───────────────────────────────
-- Neu: source_id = 'flohmarkt:<letztes Pfadsegment der Detailseite>:<Wiener
-- Tag>'. Der nächtliche Lauf trifft damit die bestehenden Zeilen. Kollisionen
-- (gleicher Markt, gleicher Tag, zwei Boudicca-UUIDs — entstehen, wenn der
-- Veranstalter den Titel ändert; am 2026-09-17 zwei Paare) werden zum
-- Duplikat der jüngsten Zeile.
CREATE TEMP TABLE flohmarkt_rekey ON COMMIT DROP AS
  SELECT id, created_at,
         'flohmarkt:' || regexp_replace(source_url, '^.*/veranstaltung/', '') || ':'
           || to_char(start_date AT TIME ZONE 'Europe/Vienna', 'YYYY-MM-DD') AS new_id
    FROM events
   WHERE source_name = 'boudicca:flohmarkt'
     AND start_date >= now()
     AND source_id NOT LIKE 'flohmarkt:%'
     AND source_url LIKE '%/veranstaltung/%'
     AND publish_status IS DISTINCT FROM 'duplicate';

CREATE TEMP TABLE flohmarkt_ranked ON COMMIT DROP AS
  SELECT id, new_id,
         row_number() OVER (PARTITION BY new_id ORDER BY created_at DESC, id) AS rn,
         first_value(id) OVER (PARTITION BY new_id ORDER BY created_at DESC, id) AS keeper
    FROM flohmarkt_rekey;

UPDATE events e
   SET publish_status = 'duplicate', duplicate_of = r.keeper
  FROM flohmarkt_ranked r
 WHERE e.id = r.id AND r.rn > 1;

UPDATE events e
   SET source_id = r.new_id
  FROM flohmarkt_ranked r
 WHERE e.id = r.id AND r.rn = 1
   AND NOT EXISTS (SELECT 1 FROM events x WHERE x.source_name = e.source_name AND x.source_id = r.new_id);

COMMIT;
