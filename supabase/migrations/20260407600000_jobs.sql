create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  status text not null default 'queued',
  source text not null default 'openclaw',
  site_id uuid null,
  input jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  current_step text null,
  progress integer not null default 0,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  error_message text null,
  retry_count integer not null default 0,
  worker_id text null
);
create index if not exists idx_jobs_status on jobs(status);
create index if not exists idx_jobs_type on jobs(type);
create index if not exists idx_jobs_site_id on jobs(site_id);
create index if not exists idx_jobs_created_at on jobs(created_at desc);

create table if not exists job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  step text not null,
  status text not null,
  message text null,
  payload jsonb not null default '{}'::jsonb,
  progress integer null,
  duration_ms integer null,
  sequence integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_job_events_job_id on job_events(job_id);
create index if not exists idx_job_events_job_sequence on job_events(job_id, sequence);
