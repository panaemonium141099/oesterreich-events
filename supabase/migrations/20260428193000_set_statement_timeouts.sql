-- Statement timeouts per role — the SYSTEMATIC fix for "Supabase outage
-- aborts the build/site".
--
-- Without this, any individual query — be it from middleware, a page
-- handler, the Vercel build pre-render, or a script — could hang
-- indefinitely waiting for Supabase. The default Postgres
-- `statement_timeout` is 0 (unlimited). When Supabase has compute
-- saturation we observed queries hanging until the **CALLER's** budget
-- ran out: 25s for Vercel middleware → 504, 60s for Next.js static-page
-- generation → build abort, infinite for ad-hoc scripts.
--
-- The right place to fix this is at the database. With per-role
-- statement_timeout set, Postgres itself aborts any query that exceeds
-- the limit and returns a clear `statement_timeout` error. Caller code
-- gets a fast, well-defined failure to handle (we already have
-- timeout-protect/retry shells in middleware, page handlers, the
-- enrich script…) instead of a silent hang.
--
-- Budget rationale:
--   anon          8s — anonymous traffic includes Googlebot. We want
--                       SEO-grade pages to either render fast or fail
--                       fast so the cache layer doesn't store a
--                       half-rendered timeout.
--   authenticated 8s — user-facing dashboards. Above this is "broken"
--                       UX anyway; better to surface an error than
--                       freeze the page.
--   service_role  60s — backend scripts (scrape, enrich, calculate
--                       scores). Long-running batch updates are
--                       legit here. The bulk_update_event_scores RPC
--                       finishes well under this budget.
--
-- Idempotent: ALTER ROLE … SET overwrites. Re-running this migration
-- is a no-op.

ALTER ROLE anon          SET statement_timeout = '8s';
ALTER ROLE authenticated SET statement_timeout = '8s';
ALTER ROLE service_role  SET statement_timeout = '60s';

-- Sanity check — note: Supabase reads are routed through PostgREST
-- which uses `authenticator` as the connection role; that role
-- delegates to anon/authenticated based on the JWT. Setting on the
-- target roles is the right move, but explicit SETs on `authenticator`
-- would be no-ops (it just delegates).
