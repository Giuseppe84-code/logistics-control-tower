export interface SubscriptionState {
  id: string; customerId: string; status: string; created: number
  priceIds: string[]; currentPeriodEnd: number | null; trialEnd: number | null
}
export function selectSubscription(subscriptions: SubscriptionState[], priceId: string, now = Date.now() / 1000) {
  const grantsPro = (sub: SubscriptionState) => sub.status === 'active' || (sub.status === 'trialing' && (sub.trialEnd ?? 0) > now)
  return subscriptions.filter(sub => sub.priceIds.includes(priceId))
    .sort((a, b) => Number(grantsPro(b)) - Number(grantsPro(a)) || b.created - a.created || a.id.localeCompare(b.id))[0] ?? null
}
export const subscriptionEvents = new Set([
  'checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed',
  'invoice.paid', 'invoice.payment_failed', 'invoice.payment_action_required',
])
export interface SyncStore {
  begin: (customerId: string, eventId: string) => Promise<{ status: string; user_id?: string; token?: string }>
  finish: (userId: string, token: string, event: { id: string; created: number }, state: SubscriptionState | null) => Promise<void>
  abort: (userId: string, token: string) => Promise<void>
}
export async function synchronizeCustomer(
  event: { id: string; type: string; created: number; customerId: string | null },
  store: SyncStore, list: (customerId: string) => Promise<SubscriptionState[]>, priceId: string,
) {
  if (!subscriptionEvents.has(event.type) || !event.customerId) return
  const claim = await store.begin(event.customerId, event.id)
  if (claim.status === 'duplicate' || claim.status === 'unmapped') return
  if (claim.status !== 'claimed' || !claim.user_id || !claim.token) throw new Error('Billing synchronization busy')
  try {
    // Fetch canonical state AFTER acquiring a per-user lease, never the delayed event payload.
    await store.finish(claim.user_id, claim.token, event, selectSubscription(await list(event.customerId), priceId))
  } catch (error) {
    await store.abort(claim.user_id, claim.token).catch(() => {})
    throw error
  }
}
