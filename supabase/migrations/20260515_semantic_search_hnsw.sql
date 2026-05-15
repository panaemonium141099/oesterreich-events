-- ────────────────────────────────────────────────────────────────────────
-- Semantic Search: HNSW migration (Phase 4.3 follow-up)
-- ────────────────────────────────────────────────────────────────────────
--
-- Problem (2026-05-15): /api/search/semantic returns 503
-- "canceling statement due to statement timeout".
--
-- Ursache: events-Tabelle ist auf ~26k Einträge gewachsen. Der bestehende
-- ivfflat-Index (idx_events_embedding_cosine, 50 lists, gebaut für ~50k
-- mit probes=1) ist nach vielen INSERTs aus den Scrapern degeneriert.
-- Mit den zusätzlichen WHERE-Filtern (start_date, price_tier) wechselt
-- der Planner regelmäßig auf seq-scan über 26k × 1536-dim Vectors —
-- das knallt in den Supabase Statement-Timeout (~8s).
--
-- Fix:
--   1. HNSW-Index parallel anlegen (skaliert besser bei wachsender
--      Tabelle, kein REINDEX nötig nach Inserts).
--   2. Statement-Timeout für die RPC selbst auf 15s setzen (Backstop
--      falls der Planner doch mal eine schlechte Strategie wählt).
--   3. Alten ivfflat-Index erst NACH dem HNSW-Build droppen — bis
--      dahin nutzt der Planner ihn als Fallback.
--
-- Beide Index-Operationen laufen CONCURRENTLY, damit live-Inserts
-- aus dem Scraper nicht blockieren.

-- 1. Statement-Timeout für lange Index-Builds raufsetzen.
set statement_timeout = '30min';

-- 2. HNSW-Index erstellen.
--
-- m = 16            → Anzahl der ausgehenden Verbindungen pro Node
-- ef_construction = 64  → Such-Tiefe beim Bau (höher = besser, langsamer)
-- Beide sind die pgvector-Defaults; gut genug für 26k Vektoren.
create index concurrently if not exists idx_events_embedding_hnsw
  on events
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 3. Alten ivfflat-Index droppen.
drop index concurrently if exists idx_events_embedding_cosine;

-- 4. RPC mit Statement-Timeout-Backstop neu erstellen.
--
-- Sollte der Planner trotzdem mal in den seq-scan kippen (z.B. wenn die
-- WHERE-Filter nahezu alle Rows behalten), gibt er nach 15s auf und der
-- Client bekommt einen sauberen 503 statt eines stillen Hangs.
create or replace function search_events_semantic(
  query_embedding vector(1536),
  match_limit int default 20,
  min_similarity real default 0.0,
  filter_after_date timestamptz default null,
  filter_max_price_tier text default null
)
returns table (
  id uuid,
  title text,
  similarity real
)
language sql
stable
set statement_timeout = '15s'
as $$
  select
    e.id,
    e.title,
    (1 - (e.embedding <=> query_embedding))::real as similarity
  from events e
  where e.embedding is not null
    and (filter_after_date is null or e.start_date >= filter_after_date)
    and (
      filter_max_price_tier is null
      or (filter_max_price_tier = 'gratis' and e.price_tier in ('gratis'))
      or (filter_max_price_tier = 'günstig' and e.price_tier in ('gratis','günstig'))
      or (filter_max_price_tier = 'mittel' and e.price_tier in ('gratis','günstig','mittel'))
    )
    and (1 - (e.embedding <=> query_embedding)) >= min_similarity
  order by e.embedding <=> query_embedding
  limit match_limit;
$$;

-- 5. Sanity check
do $$
declare
  total int;
  with_emb int;
begin
  select count(*) into total from events;
  select count(*) into with_emb from events where embedding is not null;
  raise notice 'HNSW migration done. Events total: %  with embedding: %  (% pending)', total, with_emb, total - with_emb;
end $$;
