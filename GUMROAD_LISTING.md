# Seller-only draft — excluded automatically from the customer ZIP

## Product
Logistics Control Tower — React + Supabase Starter Kit

Suggested launch price: **USD 79, one named developer seat**. Do not offer a team
variant with this license. This is a proposal, not a valuation or revenue promise.

## Description draft
A configurable logistics dashboard source-code starter for developers. Includes
React/TypeScript frontend, six KPI calculations, orders search/filtering, supplier
scorecard, illustrative scenarios, CSV export and per-user Supabase data.

Includes Supabase Auth, SQL migrations and RLS, server-verified Stripe Checkout
and Customer Portal integration, subscription synchronization and optional Resend
welcome email after the first authenticated visit. The email requires your own
verified sender and configuration. Free/Pro gating in the interface is not a
source-code licensing/DRM system.

You receive source code, migrations, tests, setup instructions and SPA deployment
configs. You must create and configure your own Supabase, Stripe and optional
Resend accounts. Hosting, provider fees, taxes, credentials, installation work
and data integrations are not included. Allow time to configure and test your
installation; no setup-time guarantee is offered.

The included dataset is synthetic. Live business-data ingestion, ERP connectors
and a validated forecasting engine are not included. Each account is a separate
workspace; shared organization workspaces, team management and SSO are not included.

The single-seat license allows unlimited personal and client applications.
Client operation/source delivery and additional developer seats are explained in
LICENSE. Reselling this as a source template is prohibited. Third-party licenses
continue to apply. You are buying a license, not exclusive ownership.

Support: contact the seller through your receipt for reproducible defects. Do
not send secrets or personal/customer data through public GitHub issues. No
response-time SLA, update cadence or future-feature commitment is included.
Maintenance updates may be provided for this release line; future major versions
may be separate purchases.

Refunds: use the policy actually configured on your Gumroad account and display
it before checkout. Mandatory consumer rights and Gumroad's own refund/dispute
rules apply. Do not promise that accessing the download removes every refund right.

## Publishing procedure
1. Complete every blocking item in RELEASE_CHECKLIST.md on a fresh staging stack.
2. Record the tested commit and approve the matching license/listing/screenshots.
3. From a clean checkout: `npm ci`, `npm run check`, `npm audit`.
4. `npm run package:release -- --ref HEAD`.
5. `npm run verify:archive -- release/logistics-control-tower-1.0.0.zip`.
6. Upload ONLY that ZIP. Keep its SHA-256, source commit and acceptance evidence.
7. Confirm the checkout policy, single-seat variant and file download before launch.

Enable Gumroad license keys only if useful for purchase records. The application
does not contain a seat-activation or license-key verification system.
