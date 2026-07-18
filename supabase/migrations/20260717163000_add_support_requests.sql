create table wing.support_requests (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  category text not null check (category in ('support', 'commercial', 'privacy', 'billing', 'other')),
  subject text not null check (char_length(subject) between 1 and 160),
  message text not null check (char_length(message) between 1 and 5000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_requests_status_created_at_idx
  on wing.support_requests(status, created_at desc);

alter table wing.support_requests enable row level security;
revoke all on table wing.support_requests from anon, authenticated;
grant select, insert, update on table wing.support_requests to service_role;
