-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Accounts Table
-- Represents the account owner (Wing customer).
create table if not exists accounts (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  stripe_customer_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Subscriptions Table
-- Relates an account to a Stripe subscription.
create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references accounts(id) on delete cascade not null,
  external_subscription_id text unique not null, -- Was stripe_subscription_id
  provider text not null check (provider in ('stripe', 'microsoft')), -- New field
  plan text not null check (plan in ('free', 'pro', 'team')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
  current_period_end timestamptz not null,
  price_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (account_id) -- Enforce max 1 active subscription per account
);

-- 3. Licences Table
-- Keys for add-in / devices / internal users.
create table if not exists licences (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references accounts(id) on delete cascade not null,
  key text unique not null, -- JWT signed by backend
  plan text, -- Optional override or cache of subscription plan
  expires_at timestamptz,
  revoked boolean default false,
  created_at timestamptz default now()
);

-- 4. Usage Monthly Table
-- Aggregated usage per account and month for billing and limits.
create table if not exists usage_monthly (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid references accounts(id) on delete cascade not null,
  yyyymm int not null, -- e.g., 202512
  requests_count int default 0,
  tokens_used bigint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (account_id, yyyymm)
);

-- 5. Webhook Events Table
-- Idempotency and audit trail for Stripe events.
create table if not exists webhook_events (
  id text primary key, -- Stripe event ID
  type text not null,
  received_at timestamptz default now(),
  payload jsonb
);

-- Indexes for performance
create index if not exists idx_accounts_email on accounts(email);
create index if not exists idx_accounts_stripe_customer_id on accounts(stripe_customer_id);
create index if not exists idx_subscriptions_external_subscription_id on subscriptions(external_subscription_id);
create index if not exists idx_licences_key on licences(key);
create index if not exists idx_usage_monthly_account_yyyymm on usage_monthly(account_id, yyyymm);

-- RLS Policies (Optional - Basic Setup)
alter table accounts enable row level security;
alter table subscriptions enable row level security;
alter table licences enable row level security;
alter table usage_monthly enable row level security;
alter table webhook_events enable row level security;

-- Simple policy: Service role has full access (default in Supabase), 
-- Users can only see their own data if we implement auth.uid() mapping later.
-- For now, we assume backend service role access for these critical tables.
