import type { ReactNode } from 'react'

interface ProGateProps {
  isPro: boolean
  onUpgrade: () => void
  children: ReactNode
  feature?: string
}

export function ProGate({ isPro, onUpgrade, children, feature }: ProGateProps) {
  if (isPro) return <>{children}</>

  return (
    <div className="flex items-center justify-center py-16">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 flex flex-col items-center text-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-2xl">
          🔒
        </div>
        <h3 className="text-lg font-semibold text-slate-100">
          {feature ?? 'This'} is a Pro feature
        </h3>
        <p className="text-sm text-slate-400">
          Upgrade to Pro to unlock advanced analytics, supplier scorecards, scenario
          planning, configurable alert thresholds and CSV exports.
        </p>
        <button
          onClick={onUpgrade}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors"
        >
          Upgrade to Pro
        </button>
      </div>
    </div>
  )
}
