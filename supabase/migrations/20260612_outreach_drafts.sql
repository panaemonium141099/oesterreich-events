-- Outreach-Agent Slice 3 — drafts table.
create table if not exists outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references outreach_prospects(id) on delete cascade,
  subject text not null,
  body text not null,
  model text,
  version int not null default 1,
  edited_by_user boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists outreach_drafts_prospect_idx on outreach_drafts (prospect_id);

alter table outreach_drafts enable row level security;
