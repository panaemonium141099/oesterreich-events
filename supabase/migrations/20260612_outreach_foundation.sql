-- Outreach-Agent Slice 1 — foundation tables (prospects + suppression).
create table if not exists outreach_prospects (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,            -- normalized, the dedupe key
  kind text not null default 'warm' check (kind in ('warm','gemeinde','media','cold')),
  org_name text,
  website text,
  email text,
  contact_url text,
  bundesland text,
  source_event_ids uuid[] default '{}',
  personalization jsonb default '{}'::jsonb,
  status text not null default 'discovered'
    check (status in ('discovered','enriched','drafted','approved','sent','replied','linked','bounced','skipped')),
  discovered_via text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists outreach_prospects_status_idx on outreach_prospects (status);
create index if not exists outreach_prospects_kind_idx on outreach_prospects (kind);

create table if not exists outreach_suppression (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  email text,
  reason text not null check (reason in ('opt_out','manual','own','bounce')),
  added_at timestamptz not null default now()
);

-- Never contact our own domain.
insert into outreach_suppression (domain, reason)
values ('lasstreffen.at', 'own')
on conflict (domain) do nothing;

-- service-role only (admin + crons use service role); no public RLS access.
alter table outreach_prospects enable row level security;
alter table outreach_suppression enable row level security;
