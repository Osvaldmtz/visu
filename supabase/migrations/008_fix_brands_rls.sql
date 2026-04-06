-- Fix: ensure brands RLS policy exists
-- If migration 007 partially failed (dropped old policy but didn't create new one),
-- the brands table would have RLS enabled with NO policies, blocking all access.

-- Drop both possible policy names (old and new) to ensure clean state
drop policy if exists "Users can manage their brands" on brands;
drop policy if exists "Users can access their brands" on brands;

-- Recreate the correct policy for brands
create policy "Users can access their brands"
  on brands for all
  using (
    auth.uid() = user_id
    or id in (
      select unnest(assigned_brands) from collaborators where id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
  );

-- Also ensure posts policy exists
drop policy if exists "Users can manage their posts" on posts;
drop policy if exists "Users can manage posts of accessible brands" on posts;

create policy "Users can manage posts of accessible brands"
  on posts for all
  using (
    brand_id in (select id from brands where user_id = auth.uid())
    or brand_id in (
      select unnest(assigned_brands) from collaborators where id = auth.uid()
    )
  );

-- Also ensure social accounts policy exists
drop policy if exists "Users can manage their social accounts" on brand_social_accounts;
drop policy if exists "Users can manage social accounts of accessible brands" on brand_social_accounts;

create policy "Users can manage social accounts of accessible brands"
  on brand_social_accounts for all
  using (
    brand_id in (select id from brands where user_id = auth.uid())
    or brand_id in (
      select unnest(assigned_brands) from collaborators where id = auth.uid()
    )
  );

-- Also ensure post_topics policy exists
drop policy if exists "Users can manage their post_topics" on post_topics;
drop policy if exists "Users can manage post_topics of accessible brands" on post_topics;

create policy "Users can manage post_topics of accessible brands"
  on post_topics for all
  using (
    brand_id in (select id from brands where user_id = auth.uid())
    or brand_id in (
      select unnest(assigned_brands) from collaborators where id = auth.uid()
    )
  );
