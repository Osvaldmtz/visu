-- Collaborators system
-- Allows brand owners to invite team members with access to specific brands

-- Collaborators table
create table collaborators (
  id uuid primary key references auth.users on delete cascade,
  email text not null unique,
  role text not null default 'collaborator' check (role in ('admin', 'collaborator')),
  assigned_brands uuid[] not null default '{}',
  created_at timestamp with time zone default now()
);

alter table collaborators enable row level security;

create index idx_collaborators_email on collaborators(email);

-- Collaborators can read their own row
create policy "Collaborators can read own row"
  on collaborators for select
  using (auth.uid() = id);

-- Brand owners can manage collaborators
create policy "Brand owners can manage collaborators"
  on collaborators for all
  using (
    auth.uid() in (select user_id from brands)
  );

-- ============================================
-- Update RLS policies for brands
-- ============================================
drop policy "Users can manage their brands" on brands;

create policy "Users can access their brands"
  on brands for all
  using (
    auth.uid() = user_id
    or id in (
      select unnest(assigned_brands) from collaborators where id = auth.uid()
    )
  );

-- ============================================
-- Update RLS policies for posts
-- ============================================
drop policy "Users can manage their posts" on posts;

create policy "Users can manage posts of accessible brands"
  on posts for all
  using (
    brand_id in (select id from brands where user_id = auth.uid())
    or brand_id in (
      select unnest(assigned_brands) from collaborators where id = auth.uid()
    )
  );

-- ============================================
-- Update RLS policies for brand_social_accounts
-- ============================================
drop policy "Users can manage their social accounts" on brand_social_accounts;

create policy "Users can manage social accounts of accessible brands"
  on brand_social_accounts for all
  using (
    brand_id in (select id from brands where user_id = auth.uid())
    or brand_id in (
      select unnest(assigned_brands) from collaborators where id = auth.uid()
    )
  );

-- ============================================
-- Update RLS policies for post_topics
-- ============================================
drop policy if exists "Users can manage their post_topics" on post_topics;

create policy "Users can manage post_topics of accessible brands"
  on post_topics for all
  using (
    brand_id in (select id from brands where user_id = auth.uid())
    or brand_id in (
      select unnest(assigned_brands) from collaborators where id = auth.uid()
    )
  );
