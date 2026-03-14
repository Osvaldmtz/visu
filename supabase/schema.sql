-- Visu database schema
-- Run this in Supabase SQL Editor

create table brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  logo_url text,
  logo_light_url text,
  logo_dark_url text,
  primary_color text default '#7C3DE3',
  industry text,
  ig_handle text,
  fb_page text,
  late_api_key text,
  secondary_color text,
  font_family text default 'Inter',
  active_layouts int[] default '{0,1,2,3}',
  logo_storage_path text,
  created_at timestamp with time zone default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands not null,
  layout int not null default 0,
  image_url text,
  caption text,
  title text,
  status text not null default 'DRAFT',
  scheduled_at timestamp with time zone,
  published_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- RLS policies
alter table brands enable row level security;
alter table posts enable row level security;

create policy "Users can manage their brands"
  on brands for all
  using (auth.uid() = user_id);

create policy "Users can manage their posts"
  on posts for all
  using (brand_id in (select id from brands where user_id = auth.uid()));

-- Indexes
create index idx_brands_user on brands(user_id);
create index idx_posts_brand on posts(brand_id);
create index idx_posts_status on posts(status);
