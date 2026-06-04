# Cloud (Supabase + Stripe) setup

This guide turns the local demo into a multi-user SaaS. Follow the phases in
order. **Phase 1 is required before the app can talk to a backend.**

---

## Phase 1 — Supabase database

1. Create a free account at <https://supabase.com> and click **New project**.
   - Pick a name, a strong database password, and the region closest to you.
   - Wait ~2 minutes for it to provision.

2. In the project, open **SQL Editor → New query**, paste the entire contents
   of [`migrations/0001_initial_schema.sql`](./migrations/0001_initial_schema.sql),
   and click **Run**. This creates all tables, indexes and Row Level Security
   policies.

3. Open **Project Settings → API** and copy two values:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **anon public** key

4. In the project root, create a file named `.env.local` (copy `.env.example`)
   and fill in:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Make sure email/password sign-ups are enabled: **Authentication → Providers
   → Email** (on by default). For quick testing you can also disable
   "Confirm email" under **Authentication → Sign In / Providers**.

After this, the auth screens and data layer (Phase 2) will work.

---

## Phase 2 — Auth & data layer

Handled in the app code: sign-up / login screens and Supabase-backed data
hooks. No extra setup beyond Phase 1.

When a user first logs in with no data, the app offers to **seed a demo
dataset** into their account (the same realistic 6-month sample as the local
demo).

---

## Phase 3 — Free vs Pro gating

- **Free**: dashboard + basic orders table.
- **Pro**: scenario simulator, supplier scorecard, configurable alert
  thresholds, CSV export.

The current plan is read from the `profiles.plan` column.

---

## Phase 4 — Stripe billing

1. Create an account at <https://stripe.com> and grab your **test mode** keys
   from **Developers → API keys**:
   - Publishable key (`pk_test_…`)
   - Secret key (`sk_test_…`)

2. Create a **Product** called "Pro" with a recurring **Price** (e.g. €9/month).
   Copy the Price ID (`price_…`).

3. Add to `.env.local`:

   ```
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
   VITE_STRIPE_PRICE_ID=price_...
   ```

4. Deploy the checkout + webhook Edge Functions (provided under
   `supabase/functions/`) and set their secrets:

   ```
   supabase functions deploy create-checkout-session
   supabase functions deploy stripe-webhook
   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

5. In Stripe, add a webhook endpoint pointing at the deployed
   `stripe-webhook` function URL, listening for
   `checkout.session.completed` and `customer.subscription.*` events.

The webhook updates `subscriptions` and flips `profiles.plan` to `pro` on a
successful payment.

---

## Environment variables summary

| Variable | Phase | Where to find it |
|----------|-------|------------------|
| `VITE_SUPABASE_URL` | 1 | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | 1 | Supabase → Settings → API |
| `VITE_STRIPE_PUBLISHABLE_KEY` | 4 | Stripe → Developers → API keys |
| `VITE_STRIPE_PRICE_ID` | 4 | Stripe → Products → Pro price |
| `STRIPE_SECRET_KEY` | 4 | Stripe (Edge Function secret) |
| `STRIPE_WEBHOOK_SECRET` | 4 | Stripe webhook (Edge Function secret) |
