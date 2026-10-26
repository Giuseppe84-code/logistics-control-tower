import { supabase } from './supabase'

async function redirectToBilling(functionName: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke(functionName, { body: {} })
  if (error) throw new Error('Billing is temporarily unavailable. Please try again.')
  if (!data?.url) throw new Error('No billing URL returned')
  const url = new URL(data.url)
  if (url.protocol !== 'https:' || !['checkout.stripe.com', 'billing.stripe.com'].includes(url.hostname)) {
    throw new Error('Invalid billing destination')
  }
  window.location.assign(url.href)
}
export const startPortalSession = () => redirectToBilling('create-portal-session')
export const startCheckout = () => redirectToBilling('create-checkout-session')
