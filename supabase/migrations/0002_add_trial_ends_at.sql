-- Add trial_ends_at to profiles so the app can show a trial countdown banner.
-- stripe_customer_id was added manually in production; add it here too for schema completeness.
alter table profiles
  add column if not exists stripe_customer_id text,
  add column if not exists trial_ends_at      timestamptz;
