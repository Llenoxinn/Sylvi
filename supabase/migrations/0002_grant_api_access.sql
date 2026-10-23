-- Newer Supabase projects don't grant API roles access to tables created in SQL.
-- Signed-in shops need these; the row-level policies in 0001 still limit each
-- shop to its own rows. Guests (anon) never touch these tables.

grant select, insert, update, delete on public.shop_packages to authenticated;
grant select, insert, update on public.shop_settings to authenticated;
