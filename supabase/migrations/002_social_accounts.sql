-- Migration: Remove late_api_key, add tiktok_handle, create brand_social_accounts
-- Visu now handles Late API internally — no per-brand keys needed.

-- Add tiktok_handle column
alter table brands add column if not exists tiktok_handle text;

-- Drop late_api_key column
alter table brands drop column if exists late_api_key;

-- Create brand_social_accounts table for Late platform account mapping
create table if not exists brand_social_accounts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands not null,
  platform text not null,
  account_id text,
  handle text,
  created_at timestamp with time zone default now()
);

alter table brand_social_accounts enable row level security;

create policy "Users can manage their social accounts"
  on brand_social_accounts for all
  using (brand_id in (select id from brands where user_id = auth.uid()));

create index if not exists idx_social_brand on brand_social_accounts(brand_id);
