import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { email } = await req.json()
    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS },
      })
    }

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border:1px solid #334155;border-radius:16px;overflow:hidden">
        <tr><td style="background:#1e40af;padding:32px;text-align:center">
          <div style="display:inline-block;width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;line-height:48px;text-align:center;font-size:16px;font-weight:700;color:#fff">LCT</div>
          <h1 style="margin:16px 0 4px;color:#fff;font-size:22px;font-weight:700">Welcome to Logistics Control Tower</h1>
          <p style="margin:0;color:#bfdbfe;font-size:14px">Your supply chain KPI dashboard is ready</p>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 16px;color:#cbd5e1;font-size:15px">Hi there,</p>
          <p style="margin:0 0 24px;color:#cbd5e1;font-size:15px">Your workspace has been set up automatically with 6 months of realistic logistics data. Here's what you can explore:</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:10px 0;border-bottom:1px solid #334155">
              <span style="color:#60a5fa;font-weight:600;font-size:14px">📊 Dashboard</span>
              <span style="color:#94a3b8;font-size:13px;display:block;margin-top:2px">6 KPIs: OTIF, Fill Rate, Cycle Time, Inventory Turnover, Stock-outs, Shipping Cost</span>
            </td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #334155">
              <span style="color:#60a5fa;font-weight:600;font-size:14px">📦 Orders</span>
              <span style="color:#94a3b8;font-size:13px;display:block;margin-top:2px">Filter, sort and search across all your orders</span>
            </td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #334155">
              <span style="color:#34d399;font-weight:600;font-size:14px">🏭 Supplier Scorecard <span style="font-size:10px;background:#1d4ed8;color:#bfdbfe;border-radius:4px;padding:1px 6px;vertical-align:middle">PRO</span></span>
              <span style="color:#94a3b8;font-size:13px;display:block;margin-top:2px">On-time rates, delays and spend per supplier</span>
            </td></tr>
            <tr><td style="padding:10px 0">
              <span style="color:#34d399;font-weight:600;font-size:14px">🔮 Scenario Simulator <span style="font-size:10px;background:#1d4ed8;color:#bfdbfe;border-radius:4px;padding:1px 6px;vertical-align:middle">PRO</span></span>
              <span style="color:#94a3b8;font-size:13px;display:block;margin-top:2px">Model demand shocks and see the KPI impact instantly</span>
            </td></tr>
          </table>
          <div style="margin:28px 0;text-align:center">
            <a href="https://logistics-control-tower-mu.vercel.app/dashboard" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px">Open Dashboard →</a>
          </div>
          <p style="margin:0;color:#64748b;font-size:12px;text-align:center">Logistics Control Tower · Built with Supabase &amp; Stripe</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Logistics Control Tower <onboarding@resend.dev>',
        to: [email],
        subject: 'Welcome to Logistics Control Tower',
        html,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(data))

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
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
