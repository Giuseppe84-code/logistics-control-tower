import { services } from './runtime.ts'
import { HttpError } from './handlers.ts'

function configure() {
  Deno.env.set('SUPABASE_URL', 'https://project.example.invalid')
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'fixture-only-not-a-real-key')
  Deno.env.set('STRIPE_SECRET_KEY', 'fixture-only-not-a-real-key')
  Deno.env.set('STRIPE_PRICE_ID', 'price_configured')
  Deno.env.set('APP_URL', 'https://app.example.invalid')
}
function assert(value: unknown, message: string): void {
  if (!value) throw new Error(message)
}
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })

Deno.test('runtime verifies Auth and uses mapped customer, configured price and retry-safe checkout', async () => {
  configure()
  const original = globalThis.fetch
  const requests: { body: string; key: string | null }[] = []
  let history: { id: string; status: string }[] = []
  let confirmed = true
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init), url = new URL(request.url)
    if (url.pathname === '/auth/v1/user') {
      assert(request.headers.get('authorization') === 'Bearer fixture-token', 'Bearer token must be verified by Auth')
      return json({ id: 'verified-user', email: 'verified@example.invalid', email_confirmed_at: confirmed ? '2026-01-01T00:00:00Z' : null })
    }
    if (url.pathname === '/rest/v1/profiles') {
      assert(url.searchParams.get('id') === 'eq.verified-user', 'Profile must belong to the verified user')
      return json({ stripe_customer_id: 'cus_mapped' })
    }
    if (url.pathname === '/v1/subscriptions') {
      assert(url.searchParams.get('customer') === 'cus_mapped', 'Subscription lookup must use the stored mapping')
      return json({ object: 'list', data: history, has_more: false, url: '/v1/subscriptions' })
    }
    if (url.pathname === '/v1/checkout/sessions') {
      requests.push({ body: await request.text(), key: request.headers.get('idempotency-key') })
      return json({ id: 'cs_fixture', url: 'https://checkout.stripe.com/fixture' })
    }
    throw new Error(`Unexpected provider request: ${url.pathname}`)
  }
  try {
    const api = services()
    const request = new Request('https://function.example.invalid', { headers: { authorization: 'Bearer fixture-token' } })
    const user = await api.authenticate(request)
    assert(user.id === 'verified-user', 'Server identity must come from Auth')
    await Promise.all([api.checkout(user), api.checkout(user)])
    assert(requests.length === 2 && requests[0].key && requests[0].key === requests[1].key, 'Concurrent retries must share an idempotency key')
    assert(requests[0].body === requests[1].body, 'Idempotent requests must retain identical parameters')
    const params = new URLSearchParams(requests[0].body)
    assert(params.get('customer') === 'cus_mapped', 'Wrong checkout customer')
    assert(params.get('line_items[0][price]') === 'price_configured', 'Wrong configured price')
    assert(params.get('success_url') === 'https://app.example.invalid/dashboard?upgraded=1', 'Wrong return destination')
    assert(params.get('subscription_data[trial_period_days]') === '14', 'First subscription must get the trial')
    history = [{ id: 'sub_old', status: 'canceled' }]
    await api.checkout(user)
    assert(requests[2].key !== requests[0].key, 'Later subscription must use a new attempt')
    assert(!new URLSearchParams(requests[2].body).has('subscription_data[trial_period_days]'), 'Returning subscriber must not get a repeat trial')
    history = [{ id: 'sub_existing', status: 'past_due' }]
    let blocked = false
    try { await api.checkout(user) } catch (error) { blocked = error instanceof HttpError && error.status === 409 }
    assert(blocked && requests.length === 3, 'Existing subscription must use the portal, not a new checkout')
    confirmed = false
    blocked = false
    try { await api.authenticate(request) } catch (error) { blocked = error instanceof HttpError && error.status === 401 }
    assert(blocked, 'Unconfirmed accounts must not access privileged billing actions')
  } finally { globalThis.fetch = original }
})
