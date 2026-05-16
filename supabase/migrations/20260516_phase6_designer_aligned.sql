-- ─────────────────────────────────────────────────────────────────
-- Phase 6 — Plan-Wizard nach v4-Designer (mit Unterkunft als Erweiterung)
-- ─────────────────────────────────────────────────────────────────
--
-- Designer-konformes Schema. Zentrale Konzepte:
--
--   • tickets_status / arrival_status / accommodation_status
--     Enum: open (default) | done | skip | later
--       open  = User hat noch nichts entschieden (Wizard wirft Step ein)
--       done  = abgeschlossen ("schon gekauft" / "Route gespeichert")
--       skip  = aktiv übersprungen ("nicht nötig" / Free-Event etc.)
--       later = "Später entscheiden" — bleibt unentschieden, Reminder feuert
--
--   • arrival_mode: auto | oeffis | fuss | fahrrad (oder null wenn nicht
--     gewählt). Match exakt die 4 Transport-Mode-Cards aus dem Designer.
--
--   • arrival_from: text — z.B. "Wien Hbf". Wird in ÖBB-Scotty-Deep-Link
--     als Start verwendet wenn mode=oeffis.
--
--   • accommodation_city: text — meist auto-derived vom Event, kann
--     überschrieben werden. Wird in booking.com-Deep-Link verwendet.
--
--   • reminder_7d / 1d / 3h: separate booleans (drei Toggles aus Step 03).
--     Default alle TRUE — User schaltet ab, was er nicht braucht.
--
-- Alte Phase-6-Felder (needs_arrival, arrival_mode, needs_accommodation
-- — nie commited in master) werden hier defensiv gedropped.

alter table plans drop column if exists needs_arrival;
alter table plans drop column if exists arrival_mode;
alter table plans drop column if exists needs_accommodation;

alter table plans
  add column if not exists tickets_status text not null default 'open'
    check (tickets_status in ('open','done','skip','later')),
  add column if not exists arrival_status text not null default 'open'
    check (arrival_status in ('open','done','skip','later')),
  add column if not exists arrival_mode text
    check (arrival_mode is null or arrival_mode in ('auto','oeffis','fuss','fahrrad')),
  add column if not exists arrival_from text,
  add column if not exists accommodation_status text not null default 'open'
    check (accommodation_status in ('open','done','skip','later')),
  add column if not exists accommodation_city text,
  add column if not exists reminder_7d boolean not null default true,
  add column if not exists reminder_1d boolean not null default true,
  add column if not exists reminder_3h boolean not null default true;
