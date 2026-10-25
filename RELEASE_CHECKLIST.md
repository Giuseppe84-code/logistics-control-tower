# Release acceptance gate

Status: release candidate; no authorization to publish or take live payments is
implied by a passing build or a Vercel deployment.

## Automated gates
- [ ] Clean checkout on Node 24.22.1: `npm ci --ignore-scripts`, `npm run check`.
- [ ] `npm audit` reports no unresolved findings (document any future accepted risk).
- [ ] Generate the archive from the exact reviewed commit; repeat generation and
      compare SHA-256. Check RELEASE.json and the file inventory.
- [ ] Run `npm run verify:archive -- release/logistics-control-tower-1.0.0.zip`.

## Required hosted staging acceptance (record date, commit, project and evidence)
Use isolated staging Supabase and Stripe sandbox accounts. Never record keys,
JWTs, portal URLs, customer personal data or payment details in this checklist.
- [ ] Install every migration on a new project, deploy all four functions, set
      secrets and configure Auth/site URLs and Stripe Portal using SETUP.md.
- [ ] Two confirmed users: login/logout, own profile/data only; attempts to change
      plan/customer IDs or request another user's billing portal fail.
- [ ] New checkout: configured price, correct customer, 14-day first trial, matching
      subscription row and Pro access. Repeat subscription/checkout is handled.
- [ ] Trial expiry/renewal, failed payment, recovery, cancellation at period end and
      immediate cancellation converge to the documented state. No duplicate charge.
- [ ] Replay events; deliver old events after new ones; transient database/provider
      failures retry and recover. Old cancellation does not revoke a newer plan.
- [ ] Portal works for the mapped customer and returns to this installation.
- [ ] Optional Resend: verified sender, own user recipient, correct application URL,
      repeated visits do not resend. With email disabled, core app still works.
- [ ] Verify dashboard/orders/scenarios/CSV on desktop and mobile; distinguish sample
      data and illustrative scenario results from actual operational measurements.
- [ ] Review email confirmation, redirect URLs, retention/privacy, recovery/backups,
      provider costs and tax setup before enabling real SaaS subscriptions. Stripe
      Tax, if used, requires the appropriate active registrations; it is not enabled
      automatically by this template.

## Commercial approval
- [ ] Seller identity/rights to original code and screenshots verified; dependency
      notices checked. License, single-seat variant and current listing agree.
- [ ] Price, actual refund policy and support terms approved; no production-ready,
      guaranteed install-time or lifetime-update claims added without evidence.
- [ ] Uploaded file matches the accepted ZIP checksum; test the Gumroad download.

Local database tests use PostgreSQL via PGlite with a minimal Supabase Auth fixture;
they do not test the hosted Auth gateway, provider account configuration, email
sender verification, actual charges, or deployed infrastructure.
