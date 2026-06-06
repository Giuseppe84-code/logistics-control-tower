# Gumroad Product Listing — Copy & Paste Guide

> This file is for YOUR EYES ONLY. Copy each section into the Gumroad product editor.
> Delete this file before sharing the repo with customers.

---

## PRODUCT NAME (keep under 60 chars)

```
Logistics Control Tower — React + Supabase SaaS Starter Kit
```

---

## TAGLINE / SHORT DESCRIPTION (shown under the title)

```
A production-ready multi-tenant SaaS dashboard for supply chain teams.
Built with React 18, TypeScript, Supabase, Stripe and Tailwind CSS —
skip months of boilerplate and ship your own logistics SaaS today.
```

---

## SUGGESTED PRICE

- **$79 USD** (individual developer, single seat)
- Optional: add a **$149 team tier** (up to 5 seats) via Gumroad Variants

---

## FULL DESCRIPTION (paste into the Gumroad "Description" field — Markdown supported)

```markdown
## What you get

A complete, working SaaS application you can clone, configure and deploy
in under an hour. Every line of code is yours to read, modify and build on.

---

### Live demo
🔗 https://logistics-control-tower-mu.vercel.app

Sign up for a free account — the workspace seeds six months of realistic
logistics data automatically. No CSV uploads needed.

---

### What's included

**Full source code (React 18 + TypeScript + Vite)**
- Public landing page with pricing section
- Email/password authentication (Supabase Auth)
- Free vs Pro feature gating
- KPI dashboard with 6 supply chain metrics and trend charts
- Searchable/filterable orders table
- Supplier scorecard with bar charts
- What-if scenario simulator (demand, cost, reliability)
- CSV export
- Configurable alert thresholds (persisted per user)
- Account page with Stripe Customer Portal integration

**Supabase backend**
- Complete SQL migration (tables, indexes, RLS policies, triggers)
- 4 Edge Functions: Stripe Checkout, Stripe Webhook, Portal Session, Welcome Email
- Row Level Security — every user only sees their own data

**Stripe billing (ready to use)**
- Checkout session flow (Free → Pro upgrade)
- Webhook handler that updates the subscription and upgrades the user
- Customer Portal for self-service cancellation

**Resend email integration**
- Welcome email sent automatically on registration

**Deployment configs**
- `vercel.json` for Vercel (SPA routing)
- `netlify.toml` for Netlify

**Documentation**
- Step-by-step setup guide (`supabase/SETUP.md`)
- Commented `.env.example` with every variable explained

---

### Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | React 18, TypeScript, Tailwind CSS, Recharts |
| Backend | Supabase (Postgres + Auth + Edge Functions + RLS) |
| Payments | Stripe Checkout + Customer Portal + Webhooks |
| Email | Resend |
| Deploy | Vercel / Netlify |

---

### Who is this for?

- **Indie hackers** who want a production-grade SaaS base without spending weeks on auth, billing and data infrastructure
- **Freelancers** building custom logistics/operations dashboards for clients
- **Developers** who want a real-world reference for Supabase + Stripe integration
- **Portfolio builders** who want a technically impressive project to show employers

---

### What you can build with it

Adapt this template for any **metrics or operations dashboard** SaaS:
- Fleet management KPIs
- Warehouse performance tracker
- Procurement analytics platform
- Any niche supply chain vertical

Change the KPIs, rename the domain objects, add your own data sources — the
architecture handles multi-tenancy, billing and auth out of the box.

---

### FAQs

**Do I need to know Supabase or Stripe?**
Basic familiarity helps, but the setup guide walks you through every step.
The whole backend can be configured from the Supabase and Stripe dashboards
without writing a line of SQL or server code.

**Can I use this for client projects?**
Yes. The commercial license allows unlimited personal and commercial projects.

**Can I resell this template?**
No. Reselling or redistributing the source code as a template is not permitted
by the license.

**Do you offer refunds?**
Due to the digital nature of the product, refunds are not available once the
download is accessed. Please review the live demo before purchasing.

**Will this be updated?**
Yes — all future updates are free for existing customers.

---

### Support

Found a bug or need help with setup? Email: ulisseposta@outlook.it
Response within 48 hours on business days.
```

---

## WHAT TO INCLUDE IN THE ZIP DOWNLOAD

Before zipping, make sure to:
1. **Delete this file** (`GUMROAD_LISTING.md`)
2. Verify `.env.example` has no real keys
3. Verify `.gitignore` excludes `.env.local`
4. Run `npm run build` to confirm the code compiles clean

Files to include in the zip:
```
logistics-control-tower/
├── src/
├── supabase/
├── docs/
├── .env.example
├── .gitignore
├── LICENSE
├── README.md
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── vercel.json
├── netlify.toml
└── vite.config.ts
```

---

## GUMROAD PRODUCT SETTINGS

| Setting | Value |
|---------|-------|
| Product type | Digital product |
| File format | .zip |
| Call to action | "Get the source code" |
| Category | Development Tools |
| Tags | react, supabase, stripe, saas, typescript, dashboard, logistics, starter-kit |
| Refund policy | No refunds (digital product) |
| License key | Enable (1 per purchase) |
| Ratings | Enable |
