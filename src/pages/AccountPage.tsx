import { useState } from 'react'
import { useAuth, isPro } from '../contexts/AuthContext'
import { startPortalSession } from '../lib/billing'

export function AccountPage() {
  const { profile, user } = useAuth()
  const pro = isPro(profile)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleManageSubscription() {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      await startPortalSession(user.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-200">Account</h2>
        <p className="text-sm text-slate-500 mt-1">Manage your profile and subscription.</p>
      </div>

      {/* Profile */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-300">Profile</h3>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Email</span>
          <span className="text-sm text-slate-200">{profile?.email ?? user?.email}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Plan</span>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide rounded px-2 py-0.5 border ${
              pro
                ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
                : 'text-slate-300 bg-slate-700/40 border-slate-600'
            }`}
          >
            {pro ? 'Pro' : 'Free'}
          </span>
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-slate-300">Subscription</h3>

        {pro ? (
          <>
            <p className="text-sm text-slate-400">
              You are on the <span className="text-emerald-400 font-medium">Pro plan</span> (€9/month).
              You have full access to Supplier Scorecard, Scenario Simulator and CSV export.
            </p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={handleManageSubscription}
              disabled={loading}
              className="self-start text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-lg px-4 py-2 transition-colors"
            >
              {loading ? 'Redirecting…' : 'Manage subscription →'}
            </button>
            <p className="text-xs text-slate-600">
              You will be redirected to the Stripe Customer Portal where you can view invoices, update payment details or cancel your subscription.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-400">
              You are on the <span className="text-slate-300 font-medium">Free plan</span>.
              Upgrade to Pro to unlock Supplier Scorecard, Scenario Simulator and CSV export.
            </p>
            <a
              href="/suppliers"
              className="self-start text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg px-4 py-2 transition-colors"
            >
              Upgrade to Pro — €9/month
            </a>
          </>
        )}
      </div>
    </div>
  )
}
