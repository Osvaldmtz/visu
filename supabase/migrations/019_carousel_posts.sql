-- Carousel posts table: multi-slide posts for Instagram/Facebook carousels
create table carousel_posts (
  id uuid default gen_random_uuid() primary key,
  brand_id uuid not null references brands(id) on delete cascade,
  caption text not null default '',
  status text not null default 'DRAFT'
    check (status in ('DRAFT','APPROVED','SCHEDULED','PUBLISHED','DISCARDED')),
  format text not null default 'square',
  scheduled_at timestamptz,
  published_at timestamptz,
  qstash_message_id text,
  slides jsonb not null default '[]',
  image_urls text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table carousel_posts enable row level security;

create policy "Users can manage carousel posts of accessible brands"
  on carousel_posts for all
  using (
    brand_id in (select id from brands where user_id = auth.uid())
    or brand_id = any(get_collaborator_brand_ids(auth.uid()))
  );

create index idx_carousel_posts_brand on carousel_posts(brand_id);
create index idx_carousel_posts_status on carousel_posts(status);
