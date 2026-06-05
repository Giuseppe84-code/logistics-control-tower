import { useNavigate } from 'react-router-dom'

const KPIS = [
  { name: 'OTIF Rate', desc: 'On-Time In-Full delivery performance' },
  { name: 'Order Cycle Time', desc: 'Average days from order to delivery' },
  { name: 'Fill Rate', desc: 'Percentage of orders fully fulfilled' },
  { name: 'Inventory Turnover', desc: 'How efficiently stock is consumed' },
  { name: 'Stock-out Rate', desc: 'SKUs at zero inventory' },
  { name: 'Avg Shipping Cost', desc: 'Cost per shipment in EUR' },
]

const FEATURES = [
  {
    icon: '📊',
    title: 'Live KPI Dashboard',
    desc: '6 supply chain KPIs with trend charts, configurable alert thresholds, and 6 months of historical data.',
  },
  {
    icon: '📦',
    title: 'Orders Table',
    desc: 'Filter, sort and search across all orders by status, region and customer. Export to CSV.',
  },
  {
    icon: '🏭',
    title: 'Supplier Scorecard',
    desc: 'On-time delivery rate, average delay, lead time and spend per supplier — with visual bar chart.',
  },
  {
    icon: '🔮',
    title: 'Scenario Simulator',
    desc: 'Model demand shocks, shipping cost changes and supplier reliability drops. See the KPI impact instantly.',
  },
]

const FREE_FEATURES = [
  'KPI Dashboard (6 metrics)',
  'Orders table with filters',
  'Up to 200 orders displayed',
  '6 months of seed data',
]

const PRO_FEATURES = [
  'Everything in Free',
  'Supplier Scorecard',
  'Scenario Simulator',
  'CSV export (orders + suppliers)',
  'Configurable alert thresholds',
]

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                LCT
              </div>
              <span className="text-slate-100 font-semibold text-sm">Logistics Control Tower</span>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-4 py-2 transition-colors"
            >
              Sign in
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6">
          Supply Chain KPI Dashboard
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
          Your distribution centre
          <br />
          <span className="text-blue-400">under control</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
          A multi-tenant SaaS dashboard built for supply chain and logistics professionals.
          Track KPIs, monitor suppliers, model scenarios — all in one place.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate('/login?signup=1')}
            className="w-full sm:w-auto text-base font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl px-8 py-3.5 transition-colors"
          >
            Get started free
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto text-base font-medium text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl px-8 py-3.5 transition-colors"
          >
            Sign in
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800">
        <h2 className="text-2xl font-bold text-white text-center mb-12">Everything you need to run your DC</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-sm font-semibold text-slate-100 mb-2">{f.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* KPIs */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800">
        <h2 className="text-2xl font-bold text-white text-center mb-4">6 KPIs tracked out of the box</h2>
        <p className="text-slate-500 text-center text-sm mb-10">Seed data is generated automatically on first login — no CSV uploads needed.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {KPIS.map((k, i) => (
            <div key={k.name} className="flex items-start gap-3 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <span className="text-blue-500 font-bold text-sm mt-0.5">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p className="text-sm font-semibold text-slate-200">{k.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{k.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800">
        <h2 className="text-2xl font-bold text-white text-center mb-12">Simple pricing</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Free */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-1">Free</p>
            <p className="text-4xl font-bold text-white mb-1">€0</p>
            <p className="text-xs text-slate-500 mb-6">forever</p>
            <ul className="space-y-2 mb-8">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="text-emerald-400 text-xs">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate('/login?signup=1')}
              className="w-full text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg py-2.5 transition-colors"
            >
              Get started
            </button>
          </div>

          {/* Pro */}
          <div className="bg-blue-600/10 border border-blue-500/30 rounded-2xl p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest text-blue-300 bg-blue-600 rounded-full px-3 py-1">
              Popular
            </div>
            <p className="text-sm font-semibold text-blue-300 uppercase tracking-wide mb-1">Pro</p>
            <p className="text-4xl font-bold text-white mb-1">€9</p>
            <p className="text-xs text-slate-500 mb-6">per month</p>
            <ul className="space-y-2 mb-8">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="text-blue-400 text-xs">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate('/login?signup=1')}
              className="w-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg py-2.5 transition-colors"
            >
              Start free, upgrade anytime
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs">LCT</div>
            <span className="text-sm text-slate-500">Logistics Control Tower</span>
          </div>
          <a
            href="https://github.com/Giuseppe84-code/logistics-control-tower"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            GitHub →
          </a>
        </div>
      </footer>
    </div>
  )
}
