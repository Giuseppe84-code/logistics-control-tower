// Single seam for Stripe checkout. Phase 4 will wire this to a real
// Stripe Checkout session. For now it is intentionally not configured.
export async function startCheckout(): Promise<void> {
  console.warn('startCheckout called but billing is not configured yet.')
  throw new Error('Billing is not configured yet. Stripe integration coming soon.')
}
