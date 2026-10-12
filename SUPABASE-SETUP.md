# MADHURAVANA — Supabase production setup

This package is ready for Supabase Auth + Postgres + Realtime.

## 1. Create the Supabase project
Create a project at https://supabase.com/ and open SQL Editor.

## 2. Run the database setup
Open `supabase-setup.sql` and run it in the SQL Editor.

It creates:
- `products`
- `orders`
- `admin_users`
- RLS policies
- Realtime publication entries
- starter products

RLS is enabled so public visitors can read products and create COD online orders, while only admin users can read/update/delete orders and manage products.

## 3. Create the admin login
In Supabase Dashboard:
Authentication → Users → Add user

Create the owner's email + password.

Copy that user's UUID. Then run:

```sql
insert into public.admin_users (user_id)
values ('PASTE_AUTH_USER_UUID_HERE');
```

The admin page then uses Supabase Auth email/password. There is no production admin password hard-coded in the frontend.

## 4. Add the project keys
Copy:

`supabase-config.example.js`

to:

`supabase-config.js`

Then set:

```js
window.MADHURAVANA_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  key: "YOUR_PUBLISHABLE_OR_ANON_KEY"
};
```

Use the browser-safe publishable/anon key only. NEVER put a `service_role` key in this website.

## 5. Realtime behavior

### Stock
Admin changes a product's stock in the admin panel → Supabase `products` updates → the public site receives the Realtime event → product availability refreshes automatically.

### Orders
Customer on Phone A submits COD order → order is inserted into Supabase `orders` → authenticated admin on Phone/PC B receives the Realtime event → Online Orders updates without manually refreshing.

### Order status
Admin changes Order Placed / Processing / Shipped / Out for Delivery / Delivered / Cancelled → Supabase updates the row.

## 6. Deploy
Deploy the whole `madhuravana-premium` folder to Vercel, Netlify, GitHub Pages, or another static host.

Do NOT open the HTML directly with `file://` for production testing. Use the deployed HTTPS URL (or a local web server).

## Important
Supabase Auth + RLS are the security boundary. The browser contains only the public publishable/anon key, which is expected. Never expose the service-role key.
