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
3. From a clean checkout: `npm ci --ignore-scripts`, `npm run check`, `npm audit --audit-level=low`.
4. `npm run package:release -- --ref HEAD`.
5. `npm run verify:archive -- release/logistics-control-tower-1.0.0.zip --expected-commit FULL_SHA --expected-sha256 ZIP_SHA256` (replace both placeholders from the approved record).
6. Upload ONLY that ZIP. Keep its SHA-256, source commit and acceptance evidence.
7. Keep the product draft; verify its actual download with the same approved commit
   and SHA-256, confirm policy/variant, then obtain explicit publication approval.

Alternatively, download the verified candidate from the successful GitHub Actions
push run for the exact reviewed commit. Extract the outer GitHub artifact and use
the inner project ZIP with its .sha256 file. Artifacts expire after 14 days; the
same commit can be packaged again. Do not upload GitHub's outer artifact wrapper.

Enable Gumroad license keys only if useful for purchase records. The application
does not contain a seat-activation or license-key verification system.
