create table if not exists campaign_reports (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null,
  platform text not null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  conversions bigint not null default 0,
  spend_cents bigint not null default 0,
  revenue_cents bigint not null default 0,
  ctr numeric(6,4) not null default 0,
  roas numeric(8,4) not null default 0,
  period_start date null,
  period_end date null,
  raw_response jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_campaign_reports_campaign_id on campaign_reports(campaign_id);
