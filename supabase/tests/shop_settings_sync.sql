-- Run after all migrations as postgres in a disposable Supabase test database.
begin;

do $$
declare
  shop_a uuid := gen_random_uuid();
  shop_b uuid := gen_random_uuid();
  saved public.shop_settings;
begin
  insert into auth.users (id) values (shop_a), (shop_b);
  insert into public.shop_settings (user_id, settings, updated_at) values
    (shop_a, '{"shopName":"Original"}', '2026-01-01'),
    (shop_b, '{"shopName":"Other shop","updatedAt":"legacy"}', '2026-01-01');

  perform set_config('request.jwt.claim.sub', shop_a::text, true);
  set local role authenticated;

  update public.shop_settings set settings = '{"shopName":"Original","updatedAt":2000}' where user_id = shop_a;
  if (select settings ->> 'updatedAt' from public.shop_settings where user_id = shop_a) <> '2000' then
    raise exception 'Legacy settings without a version could not be upgraded';
  end if;

  -- Reproduce an older request arriving after another computer saved newer settings.
  insert into public.shop_settings (user_id, settings, updated_at)
    values (shop_a, '{"shopName":"Stale","updatedAt":1000}', '2025-01-01')
    on conflict (user_id) do update set settings = excluded.settings, updated_at = excluded.updated_at;
  select * into strict saved from public.shop_settings where user_id = shop_a;
  if saved.settings ->> 'shopName' <> 'Original' or saved.updated_at <> '2026-01-01'::timestamptz then
    raise exception 'Stale settings overwrote the newer row';
  end if;

  -- Default settings have version zero even when the upload's row timestamp is newer.
  insert into public.shop_settings (user_id, settings, updated_at)
    values (shop_a, '{"shopName":"","updatedAt":0}', '2027-01-01')
    on conflict (user_id) do update set settings = excluded.settings, updated_at = excluded.updated_at;
  if (select settings ->> 'shopName' from public.shop_settings where user_id = shop_a) <> 'Original' then
    raise exception 'Delayed default settings erased the shop profile';
  end if;

  update public.shop_settings set settings = '{"shopName":"Newer","updatedAt":3000}' where user_id = shop_a;
  if (select settings ->> 'shopName' from public.shop_settings where user_id = shop_a) <> 'Newer' then
    raise exception 'Newer settings were rejected';
  end if;

  update public.shop_settings set settings = '{"shopName":"Same version","updatedAt":3000}' where user_id = shop_a;
  if (select settings ->> 'shopName' from public.shop_settings where user_id = shop_a) <> 'Same version' then
    raise exception 'Equal-version settings were rejected';
  end if;

  update public.shop_settings set settings = '{"shopName":"Missing version"}' where user_id = shop_a;
  update public.shop_settings set settings = '{"shopName":"Invalid version","updatedAt":"later"}' where user_id = shop_a;
  if (select settings ->> 'shopName' from public.shop_settings where user_id = shop_a) <> 'Same version' then
    raise exception 'Unversioned settings overwrote a versioned row';
  end if;

  perform set_config('request.jwt.claim.sub', shop_b::text, true);
  update public.shop_settings set settings = '{"shopName":"Other shop","updatedAt":1000}' where user_id = shop_b;
  if (select settings ->> 'updatedAt' from public.shop_settings where user_id = shop_b) <> '1000' then
    raise exception 'Legacy settings with a malformed version could not be upgraded';
  end if;
  perform set_config('request.jwt.claim.sub', shop_a::text, true);

  if exists (select 1 from public.shop_settings where user_id = shop_b) then
    raise exception 'Row-level security exposed another shop';
  end if;
  update public.shop_settings set settings = '{"shopName":"Unauthorized","updatedAt":4000}' where user_id = shop_b;
  if found then
    raise exception 'Row-level security allowed editing another shop';
  end if;

  begin
    insert into public.shop_settings (user_id, settings) values (gen_random_uuid(), '{"updatedAt":4000}');
    raise exception 'Row-level security allowed inserting for another shop';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;
