-- Apply after 0001 and 0002, on both new and existing installations.
-- Fail on duplicate customer mappings or cross-tenant references: do not silently
-- rewrite existing billing ownership. Run the preflight in SETUP.md first.
alter table public.profiles add column if not exists welcome_email_sent_at timestamptz;
create unique index profiles_stripe_customer_unique on public.profiles(stripe_customer_id)
  where stripe_customer_id is not null;

-- Profiles contain server-owned entitlements and billing identifiers. No client writes.
drop policy if exists "own profile update" on public.profiles;
revoke all on public.profiles, public.subscriptions from anon, authenticated;
grant select on public.profiles, public.subscriptions to authenticated;
grant all on public.profiles, public.subscriptions to service_role;
grant usage on schema public to authenticated, service_role;
do $$
declare t text;
begin
  foreach t in array array['suppliers','products','inventory','orders','order_lines','shipments','supplier_orders','alert_thresholds'] loop
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, email) values(new.id, new.email);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Ownership must also match across foreign keys, not just on each visible row.
alter table public.suppliers add constraint suppliers_tenant_key unique(id,user_id);
alter table public.products add constraint products_tenant_key unique(id,user_id);
alter table public.orders add constraint orders_tenant_key unique(id,user_id);
alter table public.inventory add constraint inventory_product_tenant_fk foreign key(product_id,user_id) references public.products(id,user_id) on delete cascade;
alter table public.order_lines add constraint lines_order_tenant_fk foreign key(order_id,user_id) references public.orders(id,user_id) on delete cascade;
alter table public.order_lines add constraint lines_product_tenant_fk foreign key(product_id,user_id) references public.products(id,user_id) on delete cascade;
alter table public.shipments add constraint shipments_order_tenant_fk foreign key(order_id,user_id) references public.orders(id,user_id) on delete cascade;
alter table public.supplier_orders add constraint supplier_orders_supplier_tenant_fk foreign key(supplier_id,user_id) references public.suppliers(id,user_id) on delete cascade;
alter table public.supplier_orders add constraint supplier_orders_product_tenant_fk foreign key(product_id,user_id) references public.products(id,user_id) on delete cascade;

-- A short per-user lease serializes canonical Stripe reads and database writes.
create table public.billing_sync_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null,
  event_id text not null,
  locked_until timestamptz not null
);
create table public.billing_webhook_events (
  event_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_created bigint not null,
  processed_at timestamptz not null default now()
);
alter table public.billing_sync_locks enable row level security;
alter table public.billing_webhook_events enable row level security;
revoke all on public.billing_sync_locks, public.billing_webhook_events from public, anon, authenticated;
grant all on public.billing_sync_locks, public.billing_webhook_events to service_role;

-- Invoker functions are service-role-only; no client-callable privileged RPC.
create function public.begin_billing_sync(p_customer_id text, p_event_id text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_user uuid; v_lock public.billing_sync_locks; v_token uuid;
begin
  if exists(select 1 from public.billing_webhook_events where event_id=p_event_id) then
    return jsonb_build_object('status','duplicate');
  end if;
  select id into v_user from public.profiles where stripe_customer_id=p_customer_id;
  if v_user is null then return jsonb_build_object('status','unmapped'); end if;
  insert into public.billing_sync_locks(user_id,token,event_id,locked_until)
    values(v_user,gen_random_uuid(),p_event_id,'-infinity') on conflict(user_id) do nothing;
  select * into v_lock from public.billing_sync_locks where user_id=v_user for update;
  if v_lock.locked_until > clock_timestamp() then return jsonb_build_object('status','busy'); end if;
  -- Recheck after locking: a concurrent request may have just completed the event.
  if exists(select 1 from public.billing_webhook_events where event_id=p_event_id) then
    return jsonb_build_object('status','duplicate');
  end if;
  v_token := gen_random_uuid();
  update public.billing_sync_locks set token=v_token, event_id=p_event_id, locked_until=clock_timestamp()+interval '60 seconds' where user_id=v_user;
  return jsonb_build_object('status','claimed','user_id',v_user,'token',v_token);
end;
$$;

create function public.finish_billing_sync(
  p_user_id uuid, p_token uuid, p_event_id text, p_event_created bigint,
  p_subscription_id text, p_status text, p_period_end timestamptz, p_trial_end timestamptz
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_lock public.billing_sync_locks; v_customer text;
begin
  select * into v_lock from public.billing_sync_locks where user_id=p_user_id for update;
  if not found or v_lock.token<>p_token or v_lock.event_id<>p_event_id or v_lock.locked_until<=clock_timestamp() then
    raise exception 'Billing lease expired or replaced';
  end if;
  select stripe_customer_id into strict v_customer from public.profiles where id=p_user_id;
  insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,status,current_period_end)
    values(p_user_id,v_customer,p_subscription_id,p_status,p_period_end)
    on conflict(user_id) do update set stripe_customer_id=excluded.stripe_customer_id,
      stripe_subscription_id=excluded.stripe_subscription_id,status=excluded.status,current_period_end=excluded.current_period_end;
  update public.profiles set
    plan=(case when p_subscription_id is not null and (p_status='active' or (p_status='trialing' and p_trial_end>clock_timestamp())) then 'pro' else 'free' end)::public.plan_tier,
    trial_ends_at=p_trial_end
    where id=p_user_id;
  insert into public.billing_webhook_events(event_id,user_id,stripe_created) values(p_event_id,p_user_id,p_event_created);
  update public.billing_sync_locks set locked_until='-infinity' where user_id=p_user_id;
end;
$$;

create function public.abort_billing_sync(p_user_id uuid,p_token uuid) returns void
language sql security invoker set search_path = '' as $$
  update public.billing_sync_locks set locked_until='-infinity' where user_id=p_user_id and token=p_token;
$$;
revoke execute on function public.begin_billing_sync(text,text) from public,anon,authenticated;
revoke execute on function public.finish_billing_sync(uuid,uuid,text,bigint,text,text,timestamptz,timestamptz) from public,anon,authenticated;
revoke execute on function public.abort_billing_sync(uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_billing_sync(text,text) to service_role;
grant execute on function public.finish_billing_sync(uuid,uuid,text,bigint,text,text,timestamptz,timestamptz) to service_role;
grant execute on function public.abort_billing_sync(uuid,uuid) to service_role;
