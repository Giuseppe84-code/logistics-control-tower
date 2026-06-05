import { supabase } from './supabase'

const PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID as string

export async function startCheckout(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const origin = window.location.origin
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: {
      priceId: PRICE_ID,
      userId: session.user.id,
      userEmail: session.user.email,
      successUrl: `${origin}/dashboard?upgraded=1`,
      cancelUrl: `${origin}/dashboard`,
    },
  })

  if (error) throw new Error(error.message)
  if (!data?.url) throw new Error('No checkout URL returned')

  window.location.href = data.url
}
