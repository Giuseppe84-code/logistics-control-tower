-- Safe to apply to an existing installation before billing ownership is repaired.
-- This migration preserves customer mappings, plans and business records.
drop policy if exists "own profile update" on public.profiles;
revoke all on public.profiles, public.subscriptions from public, anon, authenticated;
grant select on public.profiles, public.subscriptions to authenticated;
grant all on public.profiles, public.subscriptions to service_role;

-- The app's authenticated welcome endpoint replaces the old SQL HTTP trigger.
-- Keep the function definition for recovery, but remove its automatic invocation.
drop trigger if exists on_profile_created_send_welcome on public.profiles;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, email) values(new.id, new.email);
  return new;
end;
$$;

do $$
declare function_name text; target regprocedure;
begin
  foreach function_name in array array[
    'public.handle_new_user()',
    'public.trigger_welcome_email()',
    'public.rls_auto_enable()'
  ] loop
    target := to_regprocedure(function_name);
    if target is not null then
      execute format('revoke all on function %s from public, anon, authenticated', target);
    end if;
  end loop;
end;
$$;
