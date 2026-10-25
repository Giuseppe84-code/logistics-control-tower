# Installation and backend configuration

Use an isolated staging project and Stripe sandbox first. Node 24.22.1 is pinned
in .nvmrc; `npm ci --ignore-scripts` installs the pinned Deno executable too.
The source is a configurable developer starter, not a configured hosted service.

## 1. New Supabase project

Create your own Supabase project. Enable email/password Auth and keep email
confirmation enabled. Configure the production Site URL and allowed auth redirect
URLs for your own deployment; use a separate project for local/staging data.

Apply **every SQL file in supabase/migrations in filename order**, once each.
Use the SQL Editor, wrapping each file in BEGIN/COMMIT, or the Supabase CLI's
migration workflow for a new linked project. The files are:

1. 0001_initial_schema.sql — base tables, Auth signup profile trigger and RLS.
2. 0002_add_trial_ends_at.sql — customer mapping and trial columns used by the app.
3. 20261024164950_harden_billing_and_tenant_access.sql — client read-only profiles,
   explicit grants, tenant-consistent foreign keys and service-only billing RPCs.
4. 20261025141741_restrict_legacy_billing_access.sql — remove the obsolete SQL
   welcome-email trigger and restrict legacy internal function/table permissions.

Do not apply only 0001. Do not rerun all migrations on an existing installation.
The hardening migration deliberately fails on duplicate Stripe customer mappings
or cross-tenant references; repair ownership manually before applying it.

### Existing-installation preflight

Back up the database and first test the upgrade against a staging copy. Confirm
which migrations were applied. Before applying the hardening migration, inspect:

```sql
select stripe_customer_id, count(*) from profiles
where stripe_customer_id is not null group by stripe_customer_id having count(*)>1;
select 'inventory' as relation, count(*) from inventory c join products p on p.id=c.product_id where c.user_id<>p.user_id
union all select 'order_lines/order',count(*) from order_lines c join orders p on p.id=c.order_id where c.user_id<>p.user_id
union all select 'order_lines/product',count(*) from order_lines c join products p on p.id=c.product_id where c.user_id<>p.user_id
union all select 'shipments',count(*) from shipments c join orders p on p.id=c.order_id where c.user_id<>p.user_id
union all select 'supplier_orders/supplier',count(*) from supplier_orders c join suppliers p on p.id=c.supplier_id where c.user_id<>p.user_id
union all select 'supplier_orders/product',count(*) from supplier_orders c join products p on p.id=c.product_id where c.user_id<>p.user_id;
```

Duplicate mappings must return no rows and every cross-tenant count must be zero.
Treat customer IDs as private operational data; do not paste query results publicly.
Reconcile existing subscribers from Stripe before enabling new billing code. Old
Checkout flows relied on metadata instead of a pre-persisted customer mapping;
confirm profiles.stripe_customer_id identifies the correct owner. Existing
unmapped customers are intentionally ignored by the new webhook. Replay a current
subscription event after correcting each verified mapping.

If duplicate customer mappings block the full upgrade, the standalone
20261025141741_restrict_legacy_billing_access.sql can be applied first through
the SQL Editor in a transaction. It preserves existing records, plans and customer
IDs while making billing tables read-only to clients and removing the legacy
on_profile_created_send_welcome trigger. The internal trigger functions remain
defined for recovery, with public/client execution revoked. Signup still creates
a profile; welcome email resumes only through the configured authenticated
endpoint and updated frontend. This limited step does not secure the old deployed
HTTP handlers or complete the billing upgrade.

Do not clear duplicate mappings or assign them to an arbitrary user. Verify the
customer against the correct Stripe account and mode, including historical
subscription metadata and confirmed account ownership. A customer missing from
one test account is not evidence that it can safely be deleted. Once ownership
is reconciled, apply the full hardening migration and align migration history
before using automated CLI upgrades on that existing project.

## 2. Browser environment

Copy .env.example to .env.local and supply your own:

- VITE_SUPABASE_URL — project URL.
- VITE_SUPABASE_ANON_KEY — publishable or legacy anon public key.

Only public browser configuration belongs here. Never prefix a service-role,
Stripe or Resend secret with VITE_. The client no longer accepts a Stripe price,
customer/user ID, recipient or redirect URL for billing calls.

The application automatically creates synthetic sample data for an empty account.
Remove/replace the demo seeding call in src/App.tsx before connecting live operations.
No ERP connector, business-data import workflow or forecasting validation is included.

## 3. Stripe and Edge Functions

Create a Pro product and recurring price in a **Stripe sandbox**. Configure
Customer Portal in that same sandbox, including cancellation behavior. The app
UI's EUR 9/month labels are examples: update LandingPage, AccountPage and App
to match your configured price before taking payments.

Backend secrets, configured privately in Supabase's Edge Function secrets UI:

| Secret | Value |
| --- | --- |
| APP_URL | Exact application origin, e.g. https://your-app.example; HTTP localhost is allowed for development |
| STRIPE_SECRET_KEY | Prefer a restricted Stripe API key with the necessary Customer, Subscription, Checkout and Billing Portal permissions |
| STRIPE_PRICE_ID | The recurring price from this same sandbox/account |
| STRIPE_WEBHOOK_SECRET | Signing secret for this installation's webhook endpoint |
| RESEND_API_KEY | Optional, leave unset when email is disabled |
| EMAIL_FROM | Optional verified Resend sender, e.g. Your App <welcome@your-domain.example> |

SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are backend-only environment variables
provided by hosted Supabase. Local serving needs appropriate local equivalents.
Do not distribute them or commit secret files. Use separate keys and projects for
staging/production; never log credentials or billing portal/session URLs.

Deploy all four functions, including their ../_shared dependencies:

```sh
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook
supabase functions deploy send-welcome-email
```

The committed supabase/config.toml disables the legacy gateway JWT check for these
functions. **The three user endpoints validate the Bearer token with Auth.getUser
and require a confirmed non-anonymous account inside the handler.** The webhook
instead validates Stripe's signature over the raw request body. Do not remove
these handler checks when modifying gateway settings.

Configure a Stripe event destination at:
https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook

Enable:
- checkout.session.completed, checkout.session.async_payment_succeeded
- customer.subscription.created, updated, deleted, paused, resumed
- invoice.paid, invoice.payment_failed, invoice.payment_action_required

The code pins Stripe SDK 23.0.1 and uses its default API version. Configure the
webhook event destination with the same API version recorded by that SDK; verify
in the installed stripe package before upgrades. Re-run signature/type/integration
checks when changing SDK or webhook API version.

Customer ownership is resolved through the unique server-owned profile mapping,
not request fields or editable metadata. A per-user 60-second lease serializes
canonical subscription reads and atomic updates to profiles/subscriptions/event
receipts. A busy/expired lease or provider/database failure returns 503 so Stripe
retries. Replays already committed are acknowledged without applying them again.

Only an active subscription, or an unexpired trialing subscription, containing
the configured price grants Pro. past_due, unpaid, paused, incomplete, expired
trials and canceled subscriptions do not. An end-of-period cancellation keeps
access while Stripe still reports active. Delayed events read current Stripe
state; an old cancellation cannot blindly overwrite a new active subscription.
The first subscription has a 14-day trial; returning subscribers do not get a
second trial. Repeated checkout requests with the same customer, price and
subscription history share a Stripe idempotency key; existing non-terminal
subscriptions must use the portal. Expire outstanding checkouts before changing
price/origin configuration. Configure dunning and tax settings deliberately. Stripe Tax is not
enabled by this template and requires applicable active registrations if used.

## 4. Optional welcome email

Configure RESEND_API_KEY and a verified EMAIL_FROM domain/sender. After the first
authenticated visit, the app calls send-welcome-email with an empty body; the
server sends only to the confirmed user's Auth email. The persisted sent marker
prevents normal repeats; Resend's idempotency key protects concurrent retries.
A send failure is retried on a later authenticated visit. This is not an Auth
signup trigger or a background delivery queue. No pg_net/SQL HTTP trigger is
required. Without the optional secrets the endpoint skips sending.

## 5. Verification and deployment

```sh
npm ci --ignore-scripts
npm run check
npm run dev
npm run build
```

Deno checks and signature tests use npm packages installed locally by npm ci;
no floating esm.sh imports are required. SQL tests use PostgreSQL/PGlite with an
Auth fixture; complete hosted staging checks in RELEASE_CHECKLIST.md separately.
Deploy the frontend using vercel.json or netlify.toml, set the two public VITE_
variables at build time, and verify deep links, Auth confirmation and billing.
A successful frontend build does not validate backend secrets or live services.
