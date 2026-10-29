-- Compare the settings version: untouched defaults use a current updated_at on upload.
create or replace function public.guard_shop_settings_update()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if (case when jsonb_typeof(new.settings -> 'updatedAt') = 'number'
      then (new.settings ->> 'updatedAt')::numeric else 0 end) <
     (case when jsonb_typeof(old.settings -> 'updatedAt') = 'number'
      then (old.settings ->> 'updatedAt')::numeric else 0 end) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_shop_settings_update on public.shop_settings;
create trigger guard_shop_settings_update before update on public.shop_settings
  for each row execute function public.guard_shop_settings_update();
