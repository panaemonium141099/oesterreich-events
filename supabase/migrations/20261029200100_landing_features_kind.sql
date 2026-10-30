-- landing_features: Art des Pins und Sponsorname (fn-30, Tipp des Tages).
--
-- Bisher waren alle Pins gleich (Saison-Karte). Die Tagesausgabe unterscheidet:
--   * sponsored: bezahlter „Tipp des Tages“, genau eine Buchung je Wiener
--     Kalendertag (die Admin-API weist Überschneidungen mit 409 ab). Die Karte
--     trägt sichtbar „Anzeige“ plus sponsor_name (§ 26 MedienG, § 6 ECG,
--     „Gesponsert“ genügt nicht), deshalb ist sponsor_name bei sponsored
--     Pflicht.
--   * editorial: redaktioneller Pin, speist wie bisher die Saison-Karte.
-- Bestehende Zeilen sind redaktionelle Pins → editorial. Default für neue
-- Zeilen ebenfalls editorial; sponsored setzt der Admin ausdrücklich.
--
-- Ops: nach dem Ausführen im Dashboard/MCP
--   NOTIFY pgrst, 'reload schema';
-- damit PostgREST die neuen Spalten kennt (sonst 400 „column does not exist“
-- beim Insert über /api/admin/landing-feature).

alter table public.landing_features
  add column if not exists kind text not null default 'editorial',
  add column if not exists sponsor_name text;

-- Bestand ausdrücklich auf editorial setzen: vor dieser Migration gab es
-- keine sponsored-Buchung, jede vorhandene Zeile ist ein redaktioneller Pin.
-- (ADD COLUMN ... DEFAULT füllt den Bestand zwar schon, die Zeile macht die
-- Absicht lesbar und hält, falls die Spalte vorher ohne Default angelegt war.)
update public.landing_features set kind = 'editorial';

alter table public.landing_features
  drop constraint if exists landing_features_kind_check;
alter table public.landing_features
  add constraint landing_features_kind_check
  check (kind in ('sponsored', 'editorial'));

alter table public.landing_features
  drop constraint if exists landing_features_sponsor_name_check;
alter table public.landing_features
  add constraint landing_features_sponsor_name_check
  check (kind <> 'sponsored' or sponsor_name is not null);

-- Tipp-Abfrage: aktive sponsored-Buchung für den heutigen Tag.
create index if not exists landing_features_kind_active_idx
  on public.landing_features (kind, starts_at, ends_at);

notify pgrst, 'reload schema';
