-- Keep deletion records so another computer cannot upload a stale package again.
alter table public.shop_packages add column if not exists deleted_at timestamptz;

create or replace function public.guard_shop_package_update()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if old.deleted_at is not null and new.deleted_at is null then
    return null;
  end if;
  if new.deleted_at is null and new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_shop_package_update on public.shop_packages;
create trigger guard_shop_package_update before update on public.shop_packages
  for each row execute function public.guard_shop_package_update();

-- NOT VALID preserves old records; new writes must have the expected container shape.
alter table public.shop_packages add constraint shop_package_items_array
  check (case when jsonb_typeof(items) = 'array' then jsonb_array_length(items) between 1 and 20 else false end) not valid;
alter table public.shop_settings add constraint shop_settings_object
  check (jsonb_typeof(settings) = 'object') not valid;
