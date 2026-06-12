-- Outreach-Agent Slice 6 — mentions/backlink monitoring.
create table if not exists outreach_mentions (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  domain text not null,
  kind text not null default 'mention' check (kind in ('backlink','mention')),
  source text not null check (source in ('referrer','search')),
  first_seen timestamptz not null default now(),
  is_new boolean not null default true,
  created_at timestamptz not null default now(),
  unique (domain, source)
);
create index if not exists outreach_mentions_new_idx on outreach_mentions (is_new);

alter table outreach_mentions enable row level security;
