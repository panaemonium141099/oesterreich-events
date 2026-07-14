-- Telemetrie-Fix (Befund Run 29305622984): recordSourceRun schreibt
-- status 'error'/'timeout', der CHECK erlaubte nur success/failed/partial
-- → supabase-js wirft nicht (Error im Result-Objekt), alle Fehler-/
-- Timeout-Zeilen wurden seit P2 STILL verworfen. Zusätzlich ließ der FK
-- auf sources(source_name) Telemetrie für nicht registrierte Scraper
-- still scheitern — Telemetrie darf nie an Registrierung hängen.
ALTER TABLE public.source_runs DROP CONSTRAINT source_runs_status_check;
ALTER TABLE public.source_runs ADD CONSTRAINT source_runs_status_check
  CHECK (status = ANY (ARRAY['success','failed','partial','error','timeout']));
ALTER TABLE public.source_runs DROP CONSTRAINT source_runs_source_name_fkey;
