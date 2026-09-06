-- Event-Inserate: öffentlich eingereichte Veranstaltungen ("Event inserieren"
-- im Footer). Eine Zeile pro Formular-Absendung.
--
-- WARUM EINE EIGENE TABELLE STATT DIREKT IN `events`
-- ──────────────────────────────────────────────────
-- Ein Inserat ist erst nach manueller Freigabe eine Veranstaltung. Läge es
-- schon vorher in `events`, müsste jede der ~40 Lesestellen einen weiteren
-- Status-Filter tragen, und die nächtliche Pipeline (Scoring, Dedup,
-- Kategorisierung, Archivierung) würde über unbestätigte Fremdeingaben
-- laufen. Ausserdem überschreibt der Score-Lauf `publish_status`
-- (siehe src/lib/quality/score-event.ts) — ein "wartet auf Freigabe" wäre
-- dort nicht stabil zu halten.
--
-- Bei der Freigabe schreibt /api/admin/event-submissions/[id] eine echte
-- `events`-Zeile und hinterlegt deren id hier in `event_id`. Die
-- Einreichung bleibt als Nachweis stehen (wer hat was wann eingereicht) —
-- rechtlich relevant, weil der Inserent die Rechte an Text und Bild
-- zusichert (siehe `rights_confirmed`).
--
-- ZUGRIFF
-- ───────
-- Inserenten sind NICHT eingeloggt. Der Insert läuft über die Service-Role
-- in der API-Route (umgeht RLS), genau wie bei `business_leads`
-- (20260610_business_leads.sql). Öffentliches Lesen ist gesperrt.
--
-- Anwendung auf Prod (Hetzner, /opt/supabase):
--   docker compose exec -T db psql -U supabase_admin -d postgres < <datei>
-- Der NOTIFY am Ende ist Pflicht — ohne Schema-Reload liefert PostgREST
-- die neue Tabelle trotz Migration nicht aus.

set statement_timeout = '5min';

-- ───────────────────────────────────────────────────────────────
-- 1) Tabelle
-- ───────────────────────────────────────────────────────────────
create table if not exists public.event_submissions (
  id                uuid primary key default gen_random_uuid(),

  -- ── Bearbeitungsstatus ────────────────────────────────────────
  status            text not null default 'pending'
                      check (status in ('pending', 'approved', 'rejected')),

  -- ── Veranstaltungsdaten (Eingabe des Inserenten) ──────────────
  title             text not null,
  description       text,
  category          text,
  -- Als Instant gespeichert. Die API rechnet die eingegebene
  -- Wiener Ortszeit über src/lib/pipeline/normalize-date.ts um; naive
  -- Zeitstempel hätten sonst je nach Serverzone den falschen Kalendertag
  -- (bekannter Altbestand-Fehler, siehe MASTERPLAN).
  start_date        timestamptz not null,
  end_date          timestamptz,
  is_all_day        boolean not null default false,
  location_name     text,
  address           text,
  postal_code       text,
  bundesland        text,
  price_text        text,
  ticket_url        text,
  image_url         text,
  -- Öffentliche Seite der Veranstaltung; wird bei Freigabe zu
  -- events.source_url und erfüllt damit die Quellen-Attribution.
  event_url         text,
  organizer         text,

  -- ── Inserent ──────────────────────────────────────────────────
  submitter_type    text not null default 'company'
                      check (submitter_type in ('company', 'person')),
  company           text,
  contact_name      text not null,
  email             text not null,
  phone             text,
  website           text,
  message           text,
  -- Bestätigung, dass der Inserent die Rechte an Text/Bild hält.
  rights_confirmed  boolean not null default false,

  -- ── Freigabe ──────────────────────────────────────────────────
  reviewed_by       uuid references auth.users (id) on delete set null,
  reviewed_at       timestamptz,
  review_note       text,
  -- Gesetzt bei Freigabe: die daraus entstandene Veranstaltung.
  -- ON DELETE SET NULL, damit das Löschen eines Events die
  -- Einreichungs-Historie nicht mitreisst.
  event_id          uuid references public.events (id) on delete set null,

  -- ── Technisches ───────────────────────────────────────────────
  user_agent        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Arbeitsliste im Admin: "offene zuerst, neueste oben".
create index if not exists event_submissions_status_idx
  on public.event_submissions (status, created_at desc);

-- ───────────────────────────────────────────────────────────────
-- 2) updated_at automatisch mitführen
-- ───────────────────────────────────────────────────────────────
create or replace function public.touch_event_submissions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists event_submissions_touch_updated_at on public.event_submissions;
create trigger event_submissions_touch_updated_at
  before update on public.event_submissions
  for each row execute function public.touch_event_submissions_updated_at();

-- ───────────────────────────────────────────────────────────────
-- 3) RLS — kein öffentlicher Zugriff.
--    Inserts ausschliesslich über die Service-Role-API-Route;
--    lesen/ändern/löschen nur admin/god.
-- ───────────────────────────────────────────────────────────────
alter table public.event_submissions enable row level security;

drop policy if exists "event_submissions_admin_select" on public.event_submissions;
drop policy if exists "event_submissions_admin_update" on public.event_submissions;
drop policy if exists "event_submissions_admin_delete" on public.event_submissions;

create policy "event_submissions_admin_select" on public.event_submissions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'god')
    )
  );

create policy "event_submissions_admin_update" on public.event_submissions
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'god')
    )
  );

create policy "event_submissions_admin_delete" on public.event_submissions
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'god')
    )
  );

-- ───────────────────────────────────────────────────────────────
-- 4) Schema-Cache reloaden
-- ───────────────────────────────────────────────────────────────
notify pgrst, 'reload schema';
select pg_sleep(0.5);
notify pgrst, 'reload schema';

-- ───────────────────────────────────────────────────────────────
-- 5) Verifikation
-- ───────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'event_submissions'
      and column_name  = 'rights_confirmed'
  ) then
    raise exception 'event_submissions table missing or incomplete';
  end if;
end
$$;
