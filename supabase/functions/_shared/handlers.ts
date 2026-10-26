export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export interface VerifiedUser { id: string; email: string }
export interface BillingEvent { id: string; type: string; created: number; customerId: string | null }
export interface Services {
  authenticate: (request: Request) => Promise<VerifiedUser>
  checkout: (user: VerifiedUser) => Promise<string>
  portal: (user: VerifiedUser) => Promise<string>
  welcome: (user: VerifiedUser) => Promise<boolean>
  verifyEvent: (body: string, signature: string) => Promise<BillingEvent>
  synchronize: (event: BillingEvent) => Promise<void>
}
export function userHandler(action: 'checkout' | 'portal' | 'welcome', services: Services, appUrl: string) {
  const origin = new URL(appUrl).origin
  const headers = {
    'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin',
  }
  return async (request: Request): Promise<Response> => {
    try {
      if (request.headers.get('origin') && request.headers.get('origin') !== origin) throw new HttpError(403, 'Origin not allowed')
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
      if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed')
      const user = await services.authenticate(request)
      let body: unknown
      try { body = JSON.parse((await request.text()) || '{}') } catch { throw new HttpError(400, 'Invalid JSON') }
      // Identity, price, recipient and redirect URLs are resolved on the server.
      if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).length) throw new HttpError(400, 'This endpoint accepts an empty object only')
      const result = action === 'welcome' ? { sent: await services.welcome(user) } : { url: await services[action](user) }
      return new Response(JSON.stringify(result), { headers })
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500
      return new Response(JSON.stringify({ error: error instanceof HttpError ? error.message : 'Service temporarily unavailable' }), { status, headers })
    }
  }
}
export function webhookHandler(services: Services) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const signature = request.headers.get('stripe-signature')
    if (!signature) return new Response('Missing signature', { status: 400 })
    let event: BillingEvent
    try { event = await services.verifyEvent(await request.text(), signature) }
    catch { return new Response('Invalid signature', { status: 400 }) }
    try { await services.synchronize(event); return new Response('ok') }
    catch { return new Response('Synchronization failed; retry required', { status: 503 }) }
  }
}
