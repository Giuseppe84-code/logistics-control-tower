import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(),
  single: vi.fn(), create: vi.fn(), createClient: vi.fn(),
}))
vi.mock('jsr:@supabase/functions-js/edge-runtime.d.ts', () => ({}))
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: mocks.createClient,
}))
vi.mock('https://esm.sh/stripe@14?target=deno', () => ({
  default: class {
    billingPortal = { sessions: { create: mocks.create } }
  },
}))

let handler: (req: Request) => Promise<Response>
vi.stubGlobal('Deno', {
  env: { get: (name: string) => ({
    STRIPE_SECRET_KEY: 'test-secret', SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
  })[name] },
  serve: (fn: typeof handler) => { handler = fn },
})
await import('./index.ts')

const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
const returnUrl = 'https://example.com/account'
const request = (body: object, authorization: string | null = 'Bearer alice-token') =>
  new Request('https://example.com/portal', {
    method: 'POST', headers: authorization ? { Authorization: authorization } : {},
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockReturnValue({ auth: { getUser: mocks.getUser }, from: mocks.from })
  mocks.getUser.mockResolvedValue({ data: { user: { id: alice } }, error: null })
  mocks.from.mockReturnValue({ select: mocks.select })
  mocks.select.mockReturnValue({ eq: mocks.eq })
  mocks.eq.mockReturnValue({ single: mocks.single })
  // Two tenants exist: the query decides which customer's ID is returned.
  mocks.single.mockImplementation(async () => ({ data: {
    stripe_customer_id: mocks.eq.mock.lastCall?.[1] === alice ? 'cus_alice' : 'cus_bob',
  } }))
  mocks.create.mockResolvedValue({ url: 'https://billing.stripe.com/test' })
})

const expectNoBillingAccess = () => {
  expect(mocks.from).not.toHaveBeenCalled()
  expect(mocks.create).not.toHaveBeenCalled()
}

describe('portal tenant boundary (mocked Auth, database and Stripe)', () => {
  it.each([null, 'Basic alice-token', 'Bearer '])('rejects missing/malformed bearer %s', async auth => {
    expect((await handler(request({ userId: alice, returnUrl }, auth))).status).toBe(401)
    expect(mocks.getUser).not.toHaveBeenCalled()
    expectNoBillingAccess()
  })

  it('rejects invalid/expired JWT even with a matching body identity', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Invalid JWT') })
    expect((await handler(request({ userId: alice, returnUrl }))).status).toBe(401)
    expect(mocks.getUser).toHaveBeenCalledWith('alice-token')
    expectNoBillingAccess()
  })

  it('fails closed when Auth returns no user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect((await handler(request({ returnUrl }))).status).toBe(401)
    expectNoBillingAccess()
  })

  it('rejects Alice requesting Bob even when Bob has a customer', async () => {
    expect((await handler(request({ userId: bob, returnUrl }))).status).toBe(403)
    expect(mocks.getUser).toHaveBeenCalledWith('alice-token')
    expectNoBillingAccess()
  })

  it.each([true, false])('opens only the verified user customer (legacy userId: %s)', async legacy => {
    const response = await handler(request({ ...(legacy ? { userId: alice } : {}), returnUrl }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ url: 'https://billing.stripe.com/test' })
    expect(mocks.getUser).toHaveBeenCalledWith('alice-token')
    expect(mocks.from).toHaveBeenCalledWith('profiles')
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith('id', alice)
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ customer: 'cus_alice', return_url: returnUrl })
  })

  it('also rejects Bob requesting Alice', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: bob } }, error: null })
    expect((await handler(request({ userId: alice, returnUrl }, 'Bearer bob-token'))).status).toBe(403)
    expectNoBillingAccess()
  })

  it('does not open a portal for a user without a customer', async () => {
    mocks.single.mockResolvedValue({ data: null })
    expect((await handler(request({ returnUrl }))).status).toBe(500)
    expect(mocks.eq).toHaveBeenCalledWith('id', alice)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('keeps CORS preflight unauthenticated without billing access', async () => {
    const response = await handler(new Request('https://example.com/portal', { method: 'OPTIONS' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('authorization')
    expectNoBillingAccess()
  })
})
