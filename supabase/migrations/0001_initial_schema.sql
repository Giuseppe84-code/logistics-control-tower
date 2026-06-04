-- ============================================================================
-- Logistics Control Tower — initial Supabase schema
-- ----------------------------------------------------------------------------
-- Multi-tenant relational schema. Every business table carries a user_id that
-- references auth.users, and Row Level Security (RLS) guarantees each user can
-- only read/write their own rows. This mirrors the in-browser Dexie schema so
-- the KPI logic stays unchanged.
-- ============================================================================

-- ─── Extensions ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Enums ──────────────────────────────────────────────────────────────────
create type plan_tier as enum ('free', 'pro');
create type order_status as enum ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
create type shipment_status as enum ('in_transit', 'delivered', 'delayed', 'lost');
create type supplier_status as enum ('active', 'inactive');
create type supplier_order_status as enum ('pending', 'confirmed', 'shipped', 'received', 'cancelled');

-- ============================================================================
-- profiles — one row per auth user, holds the current plan tier
-- ============================================================================
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  plan        plan_tier not null default 'free',
  created_at  timestamptz not null default now()
);

-- Automatically create a profile row when a new auth user signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- subscriptions — Stripe subscription state, kept in sync by a webhook
-- ============================================================================
create table subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  status                  text,            -- active, canceled, past_due, …
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  unique (user_id)
);

-- ============================================================================
-- Business tables (mirror of the relational data model)
-- ============================================================================

create table suppliers (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  country           text not null,
  lead_time_days    int not null,
  reliability_score numeric(4,3) not null,   -- 0..1
  status            supplier_status not null default 'active',
  created_at        timestamptz not null default now()
);

create table products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  sku         text not null,
  name        text not null,
  category    text not null,
  unit_cost   numeric(12,2) not null,
  unit_price  numeric(12,2) not null
);

create table inventory (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  product_id          uuid not null references products (id) on delete cascade,
  warehouse_location  text not null,
  quantity_on_hand    int not null,
  reorder_point       int not null,
  reorder_quantity    int not null,
  last_updated        timestamptz not null default now()
);

create table orders (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users (id) on delete cascade,
  customer_name            text not null,
  customer_region          text not null,
  order_date               timestamptz not null,
  requested_delivery_date  timestamptz not null,
  status                   order_status not null,
  total_value              numeric(12,2) not null
);

create table order_lines (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  order_id      uuid not null references orders (id) on delete cascade,
  product_id    uuid not null references products (id) on delete cascade,
  qty_ordered   int not null,
  qty_fulfilled int not null,
  unit_price    numeric(12,2) not null
);

create table shipments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  order_id            uuid not null references orders (id) on delete cascade,
  carrier             text not null,
  tracking_number     text not null,
  shipped_date        timestamptz not null,
  estimated_delivery  timestamptz not null,
  actual_delivery     timestamptz,
  shipping_cost       numeric(12,2) not null,
  status              shipment_status not null
);

create table supplier_orders (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  supplier_id        uuid not null references suppliers (id) on delete cascade,
  product_id         uuid not null references products (id) on delete cascade,
  quantity           int not null,
  order_date         timestamptz not null,
  expected_delivery  timestamptz not null,
  actual_delivery    timestamptz,
  unit_cost          numeric(12,2) not null,
  status             supplier_order_status not null
);

create table alert_thresholds (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  otif_min                 numeric not null default 90,
  fill_rate_min            numeric not null default 95,
  cycle_time_max           numeric not null default 7,
  inventory_turnover_min   numeric not null default 4,
  stock_out_rate_max       numeric not null default 5,
  avg_shipping_cost_max    numeric not null default 80
);

-- ─── Helpful indexes (mirror the Dexie indexes) ─────────────────────────────
create index on suppliers (user_id);
create index on products (user_id);
create index on inventory (user_id, product_id);
create index on orders (user_id, status, order_date);
create index on order_lines (user_id, order_id);
create index on shipments (user_id, order_id, status);
create index on supplier_orders (user_id, supplier_id, product_id);

-- ============================================================================
-- Row Level Security — each user only sees their own rows
-- ============================================================================
alter table profiles         enable row level security;
alter table subscriptions    enable row level security;
alter table suppliers        enable row level security;
alter table products         enable row level security;
alter table inventory        enable row level security;
alter table orders           enable row level security;
alter table order_lines      enable row level security;
alter table shipments        enable row level security;
alter table supplier_orders  enable row level security;
alter table alert_thresholds enable row level security;

-- profiles: a user may read and update only their own profile.
create policy "own profile read"   on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);

-- subscriptions: read-only for the owner (writes happen via the service role in the webhook).
create policy "own subscription read" on subscriptions for select using (auth.uid() = user_id);

-- Business tables: full CRUD for the owner. One reusable pattern per table.
do $$
declare t text;
begin
  foreach t in array array[
    'suppliers','products','inventory','orders','order_lines',
    'shipments','supplier_orders','alert_thresholds'
  ]
  loop
    execute format(
      'create policy "owner all" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t
    );
  end loop;
end $$;
