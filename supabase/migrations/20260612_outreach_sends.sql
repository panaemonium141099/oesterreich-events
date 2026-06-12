-- Outreach-Agent Slice 4 — sends log.
create table if not exists outreach_sends (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references outreach_prospects(id) on delete cascade,
  draft_id uuid references outreach_drafts(id) on delete set null,
  to_email text not null,
  subject text,
  sent_at timestamptz not null default now(),
  sent_by uuid,
  resend_id text,
  status text not null default 'sent' check (status in ('sent','bounced','replied','opted_out','failed')),
  reply_at timestamptz,
  opt_out_at timestamptz
);
create index if not exists outreach_sends_prospect_idx on outreach_sends (prospect_id);
alter table outreach_sends enable row level security;
