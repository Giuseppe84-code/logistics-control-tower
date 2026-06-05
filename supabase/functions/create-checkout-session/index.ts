import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CheckoutBody {
  priceId: string
  userId: string
  userEmail: string
  successUrl: string
  cancelUrl: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY not configured')

    const stripe = new Stripe(secretKey, { apiVersion: '2024-04-10' })

    const { priceId, userId, userEmail, successUrl, cancelUrl } =
      await req.json() as CheckoutBody

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      customer_email: userEmail,
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: { metadata: { userId } },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
