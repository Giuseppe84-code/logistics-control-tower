import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth, isPro } from './contexts/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { ProGate } from './components/ui/ProGate'
import { startCheckout } from './lib/billing'
import { hasData, seedCloudData } from './lib/seedCloud'
import { DashboardPage } from './pages/DashboardPage'
import { OrdersPage } from './pages/OrdersPage'
import { SuppliersPage } from './pages/SuppliersPage'
import { ScenarioPage } from './pages/ScenarioPage'

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm">{label}</p>
      </div>
    </div>
  )
}

function FullScreenSpinner({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm">{label}</p>
      </div>
    </div>
  )
}

function AuthenticatedApp() {
  const { profile, user, signOut } = useAuth()
  const pro = isPro(profile)
  const [seeding, setSeeding] = useState(true)

  useEffect(() => {
    let active = true
    async function setup() {
      if (!user) return
      try {
        const exists = await hasData(user.id)
        if (!exists) {
          await seedCloudData(user.id)
        }
      } catch (err) {
        console.error('Workspace setup failed', err)
      } finally {
        if (active) setSeeding(false)
      }
    }
    setup()
    return () => {
      active = false
    }
  }, [user])

  function handleUpgrade() {
    startCheckout().catch(() => alert('Stripe coming soon'))
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950">
        {/* Header */}
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  LCT
                </div>
                <div>
                  <span className="text-slate-100 font-semibold text-sm">Logistics Control Tower</span>
                  <span className="ml-2 text-xs text-slate-500 hidden sm:inline">Distribution Center KPIs</span>
                </div>
              </div>
              <nav className="flex items-center gap-1">
                <NavItem to="/dashboard" label="Dashboard" />
                <NavItem to="/orders" label="Orders" />
                <NavItem to="/suppliers" label="Suppliers" />
                <NavItem to="/scenario" label="Scenario" />
              </nav>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 hidden md:inline">{profile?.email ?? user?.email}</span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 border ${
                    pro
                      ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
                      : 'text-slate-300 bg-slate-700/40 border-slate-600'
                  }`}
                >
                  {pro ? 'Pro' : 'Free'}
                </span>
                {!pro && (
                  <button
                    onClick={handleUpgrade}
                    className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    Upgrade to Pro
                  </button>
                )}
                <button
                  onClick={() => signOut()}
                  className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {seeding ? (
            <Spinner label="Setting up your workspace…" />
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route
                path="/suppliers"
                element={
                  <ProGate isPro={pro} onUpgrade={handleUpgrade} feature="Supplier Scorecard">
                    <SuppliersPage />
                  </ProGate>
                }
              />
              <Route
                path="/scenario"
                element={
                  <ProGate isPro={pro} onUpgrade={handleUpgrade} feature="Scenario Simulator">
                    <ScenarioPage />
                  </ProGate>
                }
              />
            </Routes>
          )}
        </main>
      </div>
    </BrowserRouter>
  )
}

function Root() {
  const { loading, session } = useAuth()

  if (loading) return <FullScreenSpinner label="Loading…" />
  if (!session) return <LoginPage />
  return <AuthenticatedApp />
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  )
}
