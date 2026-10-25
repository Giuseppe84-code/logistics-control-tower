import Stripe from 'npm:stripe@23.0.1'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { HttpError, type Services, type VerifiedUser } from './handlers.ts'
import { synchronizeCustomer, type SubscriptionState, type SyncStore } from './subscriptions.ts'

function required(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} is not configured`)
  return value
}
export function appUrl(): string {
  const url = new URL(required('APP_URL'))
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('APP_URL must be an HTTPS origin')
  return url.origin
}
export function services(): Services {
  const admin = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  const stripeClient = () => new Stripe(required('STRIPE_SECRET_KEY'), { maxNetworkRetries: 1, timeout: 10000 })
  const check = <T>(result: { data: T; error: unknown }): T => {
    if (result.error) throw new Error('Database operation failed')
    return result.data
  }
  const customerFor = async (user: VerifiedUser, create: boolean): Promise<string> => {
    const profile = check(await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).single())
    if (!profile) throw new Error('Profile not found')
    if (profile.stripe_customer_id) return profile.stripe_customer_id
    if (!create) throw new HttpError(409, 'No billing account exists yet')
    const customer = await stripeClient().customers.create({ email: user.email }, { idempotencyKey: `lct-customer-${user.id}` })
    check(await admin.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id).is('stripe_customer_id', null))
    const saved = check(await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).single())
    if (!saved?.stripe_customer_id) throw new Error('Customer mapping was not persisted')
    return saved.stripe_customer_id
  }
  const store: SyncStore = {
    begin: async (customer, event) => check(await admin.rpc('begin_billing_sync', { p_customer_id: customer, p_event_id: event })),
    finish: async (user, token, event, state) => {
      check(await admin.rpc('finish_billing_sync', {
        p_user_id: user, p_token: token, p_event_id: event.id, p_event_created: event.created,
        p_subscription_id: state?.id ?? null, p_status: state?.status ?? 'none',
        p_period_end: state?.currentPeriodEnd ? new Date(state.currentPeriodEnd * 1000).toISOString() : null,
        p_trial_end: state?.trialEnd ? new Date(state.trialEnd * 1000).toISOString() : null,
      }))
    },
    abort: async (user, token) => { check(await admin.rpc('abort_billing_sync', { p_user_id: user, p_token: token })) },
  }
  return {
    authenticate: async request => {
      const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1]
      if (!token) throw new HttpError(401, 'Authentication required')
      const { data, error } = await admin.auth.getUser(token)
      if (error || !data.user?.email || !data.user.email_confirmed_at || data.user.is_anonymous) throw new HttpError(401, 'A verified account is required')
      return { id: data.user.id, email: data.user.email }
    },
    checkout: async user => {
      const stripe = stripeClient()
      const customer = await customerFor(user, true)
      const history: Stripe.Subscription[] = []
      for await (const subscription of stripe.subscriptions.list({ customer, status: 'all', limit: 100 })) history.push(subscription)
      if (history.some(sub => !['canceled', 'incomplete_expired'].includes(sub.status))) throw new HttpError(409, 'Manage your existing subscription in the billing portal')
      const origin = appUrl()
      const price = required('STRIPE_PRICE_ID')
      // Stable across double clicks/retries; a later subscription history starts a new attempt.
      const fingerprint = JSON.stringify([customer, price, origin, history.map(sub => sub.id).sort()])
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint))
      const idempotencyKey = `lct-checkout-${Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('')}`
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription', customer, line_items: [{ price, quantity: 1 }],
        success_url: `${origin}/dashboard?upgraded=1`, cancel_url: `${origin}/account`,
        ...(history.length === 0 ? { subscription_data: { trial_period_days: 14 } } : {}),
        // One flow label, retained on retries so Stripe's idempotency body stays identical.
        integration_identifier: 'lct-checkout-zrkdaxeb',
      }, { idempotencyKey })
      if (!session.url) throw new Error('Missing checkout URL')
      return session.url
    },
    portal: async user => (await stripeClient().billingPortal.sessions.create({ customer: await customerFor(user, false), return_url: `${appUrl()}/account` })).url,
    verifyEvent: async (body, signature) => {
      const event = await stripeClient().webhooks.constructEventAsync(body, signature, required('STRIPE_WEBHOOK_SECRET'), undefined, Stripe.createSubtleCryptoProvider())
      const object = event.data.object as unknown as { customer?: string | { id: string } | null }
      return { id: event.id, type: event.type, created: event.created, customerId: typeof object.customer === 'string' ? object.customer : object.customer?.id ?? null }
    },
    synchronize: async event => {
      await synchronizeCustomer(event, store, async customer => {
        const subscriptions: SubscriptionState[] = []
        for await (const sub of stripeClient().subscriptions.list({ customer, status: 'all', limit: 100 })) subscriptions.push({
          id: sub.id, customerId: customer, status: sub.status, created: sub.created,
          priceIds: sub.items.data.map(item => item.price.id),
          currentPeriodEnd: sub.items.data.length ? Math.max(...sub.items.data.map(item => item.current_period_end)) : null,
          trialEnd: sub.trial_end,
        })
        return subscriptions
      }, required('STRIPE_PRICE_ID'))
    },
    welcome: async user => {
      const key = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('EMAIL_FROM')
      if (!key || !from) return false
      const profile = check(await admin.from('profiles').select('welcome_email_sent_at').eq('id', user.id).single())
      if (!profile) throw new Error('Profile not found')
      if (profile.welcome_email_sent_at) return false
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `lct-welcome-${user.id}` },
        body: JSON.stringify({ from, to: [user.email], subject: 'Welcome to Logistics Control Tower', text: `Your account is ready. Open your dashboard: ${appUrl()}/dashboard. Demo data, when enabled, is synthetic.` }),
      })
      if (!response.ok) throw new Error('Email provider rejected the request')
      check(await admin.from('profiles').update({ welcome_email_sent_at: new Date().toISOString() }).eq('id', user.id))
      return true
    },
  }
}
