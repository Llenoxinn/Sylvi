-- Sylvi shop accounts: custom packages and settings per signed-in shop.
-- Customer photos are never stored here.

create table if not exists public.shop_packages (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  items jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_packages_user_idx on public.shop_packages (user_id);

create table if not exists public.shop_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  settings jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shop_packages enable row level security;
alter table public.shop_settings enable row level security;

create policy "Shops read their packages" on public.shop_packages
  for select using (auth.uid() = user_id);
create policy "Shops add packages" on public.shop_packages
  for insert with check (auth.uid() = user_id);
create policy "Shops edit their packages" on public.shop_packages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Shops delete their packages" on public.shop_packages
  for delete using (auth.uid() = user_id);

create policy "Shops read their settings" on public.shop_settings
  for select using (auth.uid() = user_id);
create policy "Shops save their settings" on public.shop_settings
  for insert with check (auth.uid() = user_id);
create policy "Shops update their settings" on public.shop_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
