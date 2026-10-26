# Release acceptance gate

Status: **NO-GO for sale**. A passing build, downloadable source archive or Vercel
Ready status does not approve publication, backend deployment or live payments.
All unchecked required gates below remain blocking. Keep PR 16 in draft until
acceptance evidence has been reviewed; merge alone is not commercial approval.

## Evidence and scope

Repository baseline verified on 25 October 2026:
`114c5165bde6b684c1a8cb440570e2caebb2fe35` (53 Vitest tests, 2 Deno tests,
four Edge Function type checks and production build). Successful push run:
https://github.com/Giuseppe84-code/logistics-control-tower/actions/runs/40202511274
Candidate SHA-256: `9e377905b34052a673d2f771e3050045db61c011dc090bb08a1bf60e5a42f9e2`.
This is historical evidence only: any source/documentation change creates a new
candidate commit and checksum and requires a matching successful push run.

For each gate keep a private record with gate ID, PASS/FAIL/BLOCKED/N/A, operator,
date/time, candidate commit, frontend deployment ID, backend function revisions,
Supabase project, Stripe account/mode, expected/actual result and sanitized proof.
Record event IDs and ownership decisions privately. Never commit keys, JWTs,
customer personal data, checkout/portal URLs or payment details. An unchecked gate
or missing proof means BLOCKED, not PASS. Optional email may be N/A only with the
disabled-path test passed and the listing describing it as optional.

| Order | Gate / responsibility | Execution surface | Completion criterion |
| --- | --- | --- | --- |
| 1 | R1–R3 / repository maintainer | Git checkout + Actions | Exact candidate tests, audit, archive verification pass |
| 2 | H1 / Supabase and Stripe owners | Database + correct Stripe account/mode | Backup, ownership reconciliation and migration preflight pass |
| 3 | H2 / Supabase, Stripe and hosting owners | Supabase + Stripe + Vercel (or chosen host) | Full backend and matching frontend deployed/configured |
| 4 | H3–H7 / acceptance operator | Isolated hosted staging | Auth, isolation, billing, retries, email/core app pass |
| 5 | C1–C3 / seller | Rights/terms review + Gumroad | Accurate listing, accepted screenshots, exact downloaded ZIP |
| 6 | Decision / seller and release reviewer | Private acceptance record | All required gates PASS and explicit launch approval |

## Repository gates (executable without provider dashboard access)

- [ ] **R1** On a clean exact candidate checkout, Node 24.22.1:
      `npm ci --ignore-scripts`, `npm run check`, `npm audit --audit-level=low`.
      Record the successful push run for this SHA, not an older or PR merge run.
- [ ] **R2** Generate from that commit with `npm run package:release -- --ref HEAD`;
      repeat and compare SHA-256. Review RELEASE.json, allowlist, dependency
      notices and file inventory. Hash equality alone does not prove acceptance.
- [ ] **R3** Verify the inner project ZIP with independently approved values:
      `npm run verify:archive -- release/logistics-control-tower-1.0.0.zip --expected-commit FULL_SHA --expected-sha256 ZIP_SHA256`.
      Both placeholders must be replaced with the exact approved lowercase hashes.
      This checks identity before installation, then fresh extraction/install,
      empty Deno cache, tests, type checks and production build. The GitHub outer
      artifact wrapper is not the sale ZIP. Artifacts expire after 14 days; retain
      or regenerate from the exact commit and recompare the approved checksum.

## Hosted gates (require authorized provider access)

Historical progress on 25 October 2026: the standalone
`restrict_legacy_billing_access` migration was applied and verified on the
existing project; client billing writes/internal trigger execution were denied,
the obsolete SQL welcome trigger removed and records/plans preserved. This does
not secure old deployed HTTP handlers or demonstrate the complete billing stack.
Two profiles share a customer ID absent from the connected Stripe test account.
Supabase dashboard project access and Vercel team access were unavailable; secrets,
full migration and new handler deployment remain unverified. Do not repeat or
claim these actions completed based on local tests.

- [ ] **H1 — Existing upgrade safety:** back up and test restore to a staging copy;
      record migration history. Reconcile disputed mappings against the correct
      Stripe account AND test/live mode, subscription history and verified owner.
      Do not clear IDs, assign an arbitrary owner or treat a missing test customer
      as permission to delete. Run `supabase/verification/billing-preflight.sql`
      with database-owner visibility: all seven counts zero. Apply the full
      hardening migration only after the reconciliation; align history after the
      out-of-order legacy mitigation. Also install every migration on a fresh
      isolated project and verify signup there. Fresh-project success does not
      prove the existing-project upgrade.
- [ ] **H2 — Deployment/configuration:** use SETUP.md to deploy all four functions
      and their shared code from the candidate. Record function revisions and
      migration history. Privately verify required secrets are configured and
      functional, account/mode/price/currency/interval agree, APP_URL and Auth
      Site URL/allowed confirmation and recovery redirects match the deployment,
      and Customer Portal is enabled in the same account/mode. Verify webhook
      destination, SDK-compatible API version, signing secret and required event
      types. Frontend VITE values point to this same Supabase project; browser
      assets contain no backend secrets. Check deep links on the chosen host.
      Record backup/recovery and a safe disable-billing/redeploy plan; do not undo
      ownership reconciliation by restoring arbitrary stale mappings.
- [ ] **H3 — Hosted Auth and isolation:** new signup creates exactly one free
      profile; confirmation email/link succeeds and confirmed login/logout works.
      Unconfirmed, missing, invalid or expired JWT requests cannot invoke user
      billing/email operations. Two confirmed users A/B cannot read or mutate
      each other's records across all business tables, profiles or subscriptions;
      cross-tenant FK insertion fails. Client plan/customer-ID writes and internal
      billing RPC calls fail. Forged user/customer/price/recipient/redirect payloads
      are rejected, including B's portal attempt; errors expose no secrets. This
      must exercise hosted HTTP/Auth/RLS, not only a SQL role transaction.
- [ ] **H4 — Checkout and portal:** in Stripe sandbox, A's first subscription uses
      the configured recurring price and correct server-owned customer, grants a
      14-day trial and converges via webhook to the expected subscription row,
      trial end and Pro UI after refresh. Double-click/retry does not create two
      subscriptions/charges. Existing non-terminal subscription gets 409 and uses
      Portal, including when overdue; a returning canceled subscriber gets no
      second trial. Portal returns to this installation and only A's customer.
      A browser success redirect alone is not payment or entitlement evidence.
- [ ] **H5 — Lifecycle:** use controlled sandbox time/test clocks where supported
      and record the exact scenario. Active and unexpired trialing with the
      configured price give Pro; expired trial, past_due, unpaid, paused,
      incomplete and canceled give Free. Test renewal, failed invoice/payment
      action, successful recovery, period-end cancellation (Pro until Stripe
      stops reporting active), and immediate cancellation (Free after sync).
      Record Stripe state, database state and UI convergence for each; inspect
      invoices/subscriptions for duplicates. Never use live charges for this gate.
- [ ] **H6 — Webhook resilience:** invalid/missing signatures fail with no database
      changes. Replay a committed event: acknowledged, one receipt, unchanged
      result. Deliver old events after newer ones, including old cancellation
      after a new active subscription: current canonical state wins. In isolated
      staging inject a recoverable provider/database failure and concurrent/busy
      lease: retryable 503, no false processed receipt or partial entitlement;
      restore service and resend through Stripe, observing successful convergence
      and no duplicate charge. Record how each failure was induced/restored.
- [ ] **H7 — Email and app:** either verify Resend sender/domain and own confirmed
      recipient, application link, normal repeat suppression and retry after send
      failure, or record email N/A and demonstrate the unset-secret path leaves
      core app functional. Supabase confirmation/recovery email remains required
      independently of optional Resend. Check dashboard/orders/scenarios/CSV on
      desktop and mobile using synthetic data and current screenshots; label
      scenarios as illustrative and remove demo seeding before live operations.

Before real SaaS subscriptions (separate from selling the starter ZIP), review
privacy/retention, provider costs, recovery/backups and tax configuration. Stripe
Tax is not enabled automatically and requires appropriate active registrations.
Auth leaked-password protection was disabled at the historical inspection; record
the chosen setting and limitations. Authenticated GraphQL schema visibility is
not proof of a data leak and does not replace the isolation checks.

## Commercial gates (seller decisions and Gumroad access)

- [ ] **C1:** verify seller identity, rights/provenance of code and screenshots,
      dependency notices, one named developer seat and consistency of LICENSE,
      listing and actual Gumroad variant. Public repository availability does not
      prove exclusive ownership; do not claim exclusivity.
- [ ] **C2:** approve actual source price, refund/support policy and contact route;
      match Gumroad settings and buyer-visible copy. No production-ready,
      guaranteed install-time, SLA or lifetime-update promises without evidence.
      Replace illustrative screenshots with accepted-commit captures and review
      them. Describe buyer-owned provider setup/fees and optional email clearly.
- [ ] **C3:** upload only the accepted inner ZIP to a draft product; test the actual
      buyer download and verify with BOTH approved commit and SHA-256 (R3).
      Confirm license/variant, terms and delivered contents match the listing.
      Record a new checksum and repeat acceptance for any replacement candidate.
- [ ] **Launch decision:** review all evidence, record explicit GO and obtain the
      seller's publication approval before making the product public. No live
      payment or publication is authorized by this checklist.

Local SQL tests use PGlite with a minimal Auth fixture; provider runtime tests use
mocked HTTP responses and signature tests use the real SDK. These establish local
behavior, not hosted account configuration, verified delivery or real payments.
