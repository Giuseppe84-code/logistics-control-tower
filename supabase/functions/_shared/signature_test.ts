import Stripe from 'npm:stripe@23.0.1'
import { services } from './runtime.ts'

Deno.test('real Stripe signature verification rejects tampering', async () => {
  Deno.env.set('SUPABASE_URL', 'https://project.example.invalid')
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'fixture-only-not-a-real-key')
  Deno.env.set('STRIPE_SECRET_KEY', 'fixture-only-not-a-real-key')
  const secret = 'fixture-only-signing-secret'
  Deno.env.set('STRIPE_WEBHOOK_SECRET', secret)
  const body = JSON.stringify({ id: 'evt_fixture', type: 'invoice.paid', created: 100, data: { object: { customer: 'cus_fixture' } } })
  const signature = await new Stripe('fixture-only-not-a-real-key').webhooks.generateTestHeaderStringAsync({ payload: body, secret })
  const api = services()
  const event = await api.verifyEvent(body, signature)
  if (event.customerId !== 'cus_fixture') throw new Error('Customer mapping failed')
  let rejected = false
  try { await api.verifyEvent(body.replace('cus_fixture', 'cus_tampered'), signature) } catch { rejected = true }
  if (!rejected) throw new Error('Tampered event was accepted')
})
