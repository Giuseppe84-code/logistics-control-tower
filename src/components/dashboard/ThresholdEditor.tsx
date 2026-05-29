import { useState } from 'react'
import type { AlertThresholds } from '../../types'

interface ThresholdEditorProps {
  thresholds: AlertThresholds
  onUpdate: (updates: Partial<Omit<AlertThresholds, 'id'>>) => void
}

interface FieldDef {
  key: keyof Omit<AlertThresholds, 'id'>
  label: string
  unit: string
  step: number
}

const FIELDS: FieldDef[] = [
  { key: 'otif_min', label: 'OTIF min', unit: '%', step: 1 },
  { key: 'fillRate_min', label: 'Fill Rate min', unit: '%', step: 1 },
  { key: 'cycleTime_max', label: 'Cycle Time max', unit: 'days', step: 0.5 },
  { key: 'inventoryTurnover_min', label: 'Inventory Turnover min', unit: '×/yr', step: 0.5 },
  { key: 'stockOutRate_max', label: 'Stock-out Rate max', unit: '%', step: 1 },
  { key: 'avgShippingCost_max', label: 'Avg Shipping Cost max', unit: '€', step: 5 },
]

export function ThresholdEditor({ thresholds, onUpdate }: ThresholdEditorProps) {
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState<Omit<AlertThresholds, 'id'>>({ ...thresholds })

  function handleSave() {
    onUpdate(local)
    setOpen(false)
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-1.5 transition-colors"
      >
        Configure Thresholds
      </button>

      {open && (
        <div className="mt-3 bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-4">Alert Thresholds</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {FIELDS.map(f => (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">{f.label} ({f.unit})</span>
                <input
                  type="number"
                  step={f.step}
                  value={local[f.key]}
                  onChange={e => setLocal(prev => ({ ...prev, [f.key]: parseFloat(e.target.value) }))}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 w-full"
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg px-4 py-1.5 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-200 text-sm rounded-lg px-4 py-1.5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
