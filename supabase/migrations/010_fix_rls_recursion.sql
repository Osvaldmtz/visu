-- Fix: infinite recursion in RLS policies
-- brands policy → queries collaborators → collaborators policy queries brands → loop
-- Solution: SECURITY DEFINER functions bypass RLS, breaking the cycle.

-- ============================================
-- Helper functions (bypass RLS)
-- ============================================

-- Returns brand IDs assigned to a collaborator (bypasses collaborators RLS)
create or replace function get_collaborator_brand_ids(user_uuid uuid)
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(assigned_brands, '{}')
  from collaborators
  where id = user_uuid;
$$;

-- Checks if a user owns at least one brand (bypasses brands RLS)
create or replace function is_brand_owner(user_uuid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from brands where user_id = user_uuid);
$$;

-- ============================================
-- Brands policies
-- ============================================
drop policy if exists "Users can manage their brands" on brands;
drop policy if exists "Users can access their brands" on brands;
drop policy if exists "Users can manage own brands" on brands;
drop policy if exists "Users can update own brands" on brands;
drop policy if exists "Users can delete own brands" on brands;

create policy "Users can access their brands"
  on brands for select
  using (
    auth.uid() = user_id
    or id = any(get_collaborator_brand_ids(auth.uid()))
  );

create policy "Users can manage own brands"
  on brands for insert
  with check (auth.uid() = user_id);

create policy "Users can update own brands"
  on brands for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own brands"
  on brands for delete
  using (auth.uid() = user_id);

-- ============================================
-- Collaborators policies
-- ============================================
drop policy if exists "Collaborators can read own row" on collaborators;
drop policy if exists "Brand owners can manage collaborators" on collaborators;

create policy "Collaborators can read own row"
  on collaborators for select
  using (auth.uid() = id);

create policy "Brand owners can manage collaborators"
  on collaborators for all
  using (is_brand_owner(auth.uid()));

-- ============================================
-- Posts policies
-- ============================================
drop policy if exists "Users can manage their posts" on posts;
drop policy if exists "Users can manage posts of accessible brands" on posts;

create policy "Users can manage posts of accessible brands"
  on posts for all
  using (
    brand_id in (select id from brands where user_id = auth.uid())
    or brand_id = any(get_collaborator_brand_ids(auth.uid()))
  );

-- ============================================
-- Social accounts policies
-- ============================================
drop policy if exists "Users can manage their social accounts" on brand_social_accounts;
drop policy if exists "Users can manage social accounts of accessible brands" on brand_social_accounts;

create policy "Users can manage social accounts of accessible brands"
  on brand_social_accounts for all
  using (
    brand_id in (select id from brands where user_id = auth.uid())
    or brand_id = any(get_collaborator_brand_ids(auth.uid()))
  );

-- ============================================
-- Post topics policies
-- ============================================
drop policy if exists "Users can manage their post_topics" on post_topics;
drop policy if exists "Users can manage post_topics of accessible brands" on post_topics;

create policy "Users can manage post_topics of accessible brands"
  on post_topics for all
  using (
    brand_id in (select id from brands where user_id = auth.uid())
    or brand_id = any(get_collaborator_brand_ids(auth.uid()))
  );
