import { describe, it, expect, vi } from 'vitest'
import { HttpError, userHandler, webhookHandler, type Services } from '../supabase/functions/_shared/handlers'
import { selectSubscription, synchronizeCustomer, type SubscriptionState, type SyncStore } from '../supabase/functions/_shared/subscriptions'

const verified = { id: 'verified-user-A', email: 'a@example.invalid' }
const event = { id: 'evt_fixture', type: 'invoice.payment_failed', created: 100, customerId: 'cus_fixture' }
function services(): Services {
  return { authenticate: vi.fn(async () => verified), checkout: vi.fn(async () => 'https://checkout.stripe.com/test'),
    portal: vi.fn(async () => 'https://billing.stripe.com/test'), welcome: vi.fn(async () => true),
    verifyEvent: vi.fn(async () => event), synchronize: vi.fn(async () => {}) }
}
function request(body: unknown = {}, origin = 'https://app.example.invalid') {
  return new Request('https://function.example.invalid', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
}
describe('billing authorization boundary', () => {
  for (const action of ['checkout', 'portal', 'welcome'] as const) {
    it(`${action} uses the verified caller only`, async () => {
      const deps = services()
      expect((await userHandler(action, deps, 'https://app.example.invalid')(request())).status).toBe(200)
      expect(deps[action]).toHaveBeenCalledWith(verified)
    })
    it(`${action} rejects client-controlled identity, price, recipient and redirects`, async () => {
      for (const body of [{ userId: 'victim' }, { priceId: 'cheap' }, { email: 'victim@example.invalid' }, { returnUrl: 'https://evil.invalid' }]) {
        const deps = services()
        expect((await userHandler(action, deps, 'https://app.example.invalid')(request(body))).status).toBe(400)
        expect(deps[action]).not.toHaveBeenCalled()
      }
    })
  }
  it('rejects invalid credentials before privileged operations', async () => {
    const deps = services(); deps.authenticate = vi.fn(async () => { throw new HttpError(401, 'Authentication required') })
    expect((await userHandler('portal', deps, 'https://app.example.invalid')(request())).status).toBe(401)
    expect(deps.portal).not.toHaveBeenCalled()
  })
  it('rejects other origins and unsupported methods', async () => {
    const deps = services(), handler = userHandler('checkout', deps, 'https://app.example.invalid')
    expect((await handler(request({}, 'https://evil.invalid'))).status).toBe(403)
    expect((await handler(new Request('https://function.invalid'))).status).toBe(405)
    expect(deps.authenticate).not.toHaveBeenCalled()
  })
  it('does not expose provider error details', async () => {
    const deps = services(); deps.portal = async () => { throw new Error('internal account details') }
    const response = await userHandler('portal', deps, 'https://app.example.invalid')(request())
    expect(response.status).toBe(500); expect(await response.text()).not.toContain('internal account')
  })
})
describe('webhook acknowledgements', () => {
  it('rejects invalid signatures before database writes', async () => {
    const deps = services(); deps.verifyEvent = async () => { throw new Error('invalid') }
    expect((await webhookHandler(deps)(new Request('https://function.invalid', { method: 'POST', headers: { 'stripe-signature': 'bad' }, body: '{}' }))).status).toBe(400)
    expect(deps.synchronize).not.toHaveBeenCalled()
  })
  it('returns a retryable failure when database synchronization fails', async () => {
    const deps = services(); deps.synchronize = async () => { throw new Error('database down') }
    expect((await webhookHandler(deps)(new Request('https://function.invalid', { method: 'POST', headers: { 'stripe-signature': 'fixture' }, body: '{}' }))).status).toBe(503)
  })
})
function subscription(status: string, id = 'sub_new', created = 200): SubscriptionState {
  return { id, customerId: 'cus_fixture', status, created, priceIds: ['price_fixture'], currentPeriodEnd: 400, trialEnd: 300 }
}
describe('canonical subscription state', () => {
  it('retains a current subscription when an old one is canceled', () => {
    expect(selectSubscription([subscription('canceled', 'sub_old', 100), subscription('active')], 'price_fixture', 250)?.id).toBe('sub_new')
  })
  it('ignores unrelated products and handles expired trials', () => {
    expect(selectSubscription([subscription('active')], 'other_price', 250)).toBeNull()
    expect(selectSubscription([subscription('trialing'), subscription('active', 'sub_active', 100)], 'price_fixture', 350)?.id).toBe('sub_active')
  })
  for (const type of ['invoice.paid', 'invoice.payment_failed', 'customer.subscription.updated', 'customer.subscription.deleted']) {
    it(`reconciles ${type} from Stripe after acquiring the lock`, async () => {
      const store: SyncStore = { begin: vi.fn(async () => ({ status: 'claimed', user_id: 'u', token: 't' })), finish: vi.fn(async () => {}), abort: vi.fn(async () => {}) }
      const list = vi.fn(async () => [subscription('past_due')])
      await synchronizeCustomer({ ...event, type }, store, list, 'price_fixture')
      expect(list).toHaveBeenCalledWith('cus_fixture')
      expect(store.finish).toHaveBeenCalledWith('u', 't', expect.objectContaining({ type }), expect.objectContaining({ status: 'past_due' }))
      expect(store.begin).toHaveBeenCalledBefore(list)
    })
  }
  it('deduplicates without contacting Stripe, and retries concurrent claims', async () => {
    const store: SyncStore = { begin: async () => ({ status: 'duplicate' }), finish: vi.fn(async () => {}), abort: vi.fn(async () => {}) }
    const list = vi.fn(async () => [])
    await synchronizeCustomer(event, store, list, 'price_fixture'); expect(list).not.toHaveBeenCalled()
    store.begin = async () => ({ status: 'busy' })
    await expect(synchronizeCustomer(event, store, list, 'price_fixture')).rejects.toThrow('busy')
  })
  it('releases a failed claim without marking the event processed', async () => {
    const store: SyncStore = { begin: async () => ({ status: 'claimed', user_id: 'u', token: 't' }), finish: vi.fn(async () => { throw new Error('db down') }), abort: vi.fn(async () => {}) }
    await expect(synchronizeCustomer(event, store, async () => [], 'price_fixture')).rejects.toThrow('db down')
    expect(store.abort).toHaveBeenCalledWith('u', 't')
  })
})
