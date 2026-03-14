import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const statements = [
  `create table if not exists brands (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users not null,
    name text not null,
    logo_url text,
    primary_color text default '#7C3DE3',
    industry text,
    ig_handle text,
    fb_page text,
    late_api_key text,
    created_at timestamp with time zone default now()
  )`,
  `create table if not exists posts (
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
  )`,
  `alter table brands enable row level security`,
  `alter table posts enable row level security`,
  `create policy if not exists "Users can manage their brands" on brands for all using (auth.uid() = user_id)`,
  `create policy if not exists "Users can manage their posts" on posts for all using (brand_id in (select id from brands where user_id = auth.uid()))`,
];

for (const sql of statements) {
  const { error } = await supabase.rpc('exec_sql', { query: sql }).maybeSingle();
  if (error && !error.message.includes('already exists')) {
    console.log(`Note: ${error.message.slice(0, 80)}`);
  }
}

// Test: try inserting into brands to verify table exists
const { error: testErr } = await supabase.from('brands').select('id').limit(1);
if (testErr) {
  console.log('brands table check:', testErr.message);
} else {
  console.log('brands table: OK');
}

const { error: testErr2 } = await supabase.from('posts').select('id').limit(1);
if (testErr2) {
  console.log('posts table check:', testErr2.message);
} else {
  console.log('posts table: OK');
}
