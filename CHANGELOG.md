# Changelog

## 1.0.0 — release candidate (not yet published)

- Restored a single-seat commercial source license and consistent package versions.
- Verified server-side user identity for checkout, portal and optional welcome mail.
- Moved Stripe price and redirect configuration to backend secrets.
- Added retry-safe checkout creation and retained portal access for overdue accounts.
- Made profiles read-only to clients and added tenant-consistent foreign keys.
- Added atomic subscription/plan synchronization, duplicate event tracking,
  per-user leases and retryable failures. Only active or unexpired trialing
  subscriptions for the configured price grant Pro; past_due/unpaid/paused do not.
- Added current Stripe state reconciliation for delayed subscription/invoice events.
- Added a configurable authenticated welcome email on first signed-in visit.
- Updated vulnerable dependencies and pinned Node and package dependency versions.
- Added database isolation, billing boundary, signature and packaging regression tests.
- Added deterministic source packaging, checksums and clean-archive verification.

Includes KPI dashboard, orders, supplier scorecard, scenario simulator, CSV export,
per-user data and UI feature gating. Demo data is synthetic. The scenario model
is illustrative, not a validated operational forecasting model.

Hosted Supabase/Stripe/Resend acceptance checks remain required before publication;
see RELEASE_CHECKLIST.md. No production-readiness certification is implied.
