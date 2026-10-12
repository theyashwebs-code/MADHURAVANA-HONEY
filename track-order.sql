-- MADHURAVANA order tracking. Run once in Supabase -> SQL Editor.
-- Customers can look up ONE order only if they know both its ID and phone number.
-- Returns just first name, city, items, total and status (never the full address or phone).
create or replace function public.track_order(p_id text, p_phone text)
returns table (id text, status text, order_date text, order_time text, total numeric,
               products jsonb, customer_name text, city text)
language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.order_date, o.order_time, o.total, o.products,
         split_part(trim(o.customer_name), ' ', 1), o.address->>'city'
  from public.orders o
  where upper(o.id) = upper(trim(p_id))
    and o.order_type = 'ONLINE'
    and right(regexp_replace(o.phone, '\D', '', 'g'), 10) = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
  limit 1;
$$;
revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;
