import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { seedDatabase } from './db/seed'
import { DashboardPage } from './pages/DashboardPage'
import { OrdersPage } from './pages/OrdersPage'
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

export default function App() {
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    seedDatabase().then(() => setSeeded(true))
  }, [])

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
                <NavItem to="/scenario" label="Scenario" />
              </nav>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!seeded ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Initializing database…</p>
              </div>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/scenario" element={<ScenarioPage />} />
            </Routes>
          )}
        </main>
      </div>
    </BrowserRouter>
  )
}
