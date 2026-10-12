-- MADHURAVANA Supabase setup
-- Run this entire script in Supabase SQL Editor.
-- Then create one Auth user in Authentication -> Users and add that user's UUID to admin_users.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  weight text not null,
  price numeric(12,2) not null check (price >= 0),
  description text not null default '',
  in_stock boolean not null default true,
  amazon_url text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  customer_name text not null,
  phone text not null,
  products jsonb not null,
  total numeric(12,2) not null check (total >= 0),
  payment_method text not null default 'Cash on Delivery',
  address jsonb not null default '{}'::jsonb,
  order_type text not null default 'ONLINE' check (order_type in ('ONLINE','OFFLINE')),
  order_date text,
  order_time text,
  status text not null default 'Order Placed',
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists products_updated_at_idx on public.products(updated_at desc);

alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

-- Helper used by policies. SECURITY DEFINER avoids exposing admin membership rows to the public.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Admin membership table: an authenticated admin can confirm their own membership.
drop policy if exists "admin_users_self_read" on public.admin_users;
create policy "admin_users_self_read"
on public.admin_users for select
to authenticated
using (user_id = (select auth.uid()));

grant select on public.admin_users to authenticated;

-- Products: everyone may read; only admins may write.
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read"
on public.products for select
to anon, authenticated
using (true);

drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert"
on public.products for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update"
on public.products for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete"
on public.products for delete
to authenticated
using ((select public.is_admin()));

-- Orders: customers can create COD orders without signing in.
-- Only admins can read/change orders.
drop policy if exists "orders_public_insert" on public.orders;
create policy "orders_public_insert"
on public.orders for insert
to anon, authenticated
with check (order_type = 'ONLINE');

drop policy if exists "orders_admin_read" on public.orders;
create policy "orders_admin_read"
on public.orders for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update"
on public.orders for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "orders_admin_delete" on public.orders;
create policy "orders_admin_delete"
on public.orders for delete
to authenticated
using ((select public.is_admin()));

grant select on public.products to anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, update, delete on public.orders to authenticated;

-- Realtime
alter table public.products replica identity full;
alter table public.orders replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.products;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
end $$;

-- Seed products. These are safe to run repeatedly.
insert into public.products (id,name,weight,price,description,in_stock,amazon_url)
values
('MH001','MADHURAVANA Pure Honey','250g',299,'A beautiful everyday jar of naturally golden honey, ideal for morning rituals, tea and recipes.',true,''),
('MH002','MADHURAVANA Pure Honey','500g',499,'Our balanced everyday size for homes that love keeping a little more golden goodness close.',true,''),
('MH003','MADHURAVANA Pure Honey','1kg',899,'A generous family jar made for regular use, gifting and those who simply love honey.',true,'')
on conflict (id) do nothing;
