import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req: Request) => {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    return new Response(`Webhook error: ${err}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.client_reference_id
    const customerId = typeof session.customer === 'string' ? session.customer : null

    let trialEndsAt: string | null = null
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null
    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId)
      trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null
    }

    if (userId) {
      await supabase
        .from('profiles')
        .update({
          plan: 'pro',
          ...(customerId ? { stripe_customer_id: customerId } : {}),
          ...(trialEndsAt ? { trial_ends_at: trialEndsAt } : {}),
        })
        .eq('id', userId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const userId = (sub.metadata as Record<string, string>)?.userId
    if (userId) {
      await supabase.from('profiles').update({ plan: 'free' }).eq('id', userId)
    }
  }

  return new Response('ok', { status: 200 })
})
