import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { AlertThresholds } from '../types'

const DEFAULT_THRESHOLDS: AlertThresholds = {
  id: 'thresholds',
  otif_min: 90,
  fillRate_min: 95,
  cycleTime_max: 7,
  inventoryTurnover_min: 4,
  stockOutRate_max: 5,
  avgShippingCost_max: 80,
}

export function useAlertThresholds() {
  const thresholds = useLiveQuery(() => db.alertThresholds.get('thresholds'))

  async function updateThresholds(updates: Partial<Omit<AlertThresholds, 'id'>>) {
    await db.alertThresholds.put({ ...(thresholds ?? DEFAULT_THRESHOLDS), ...updates })
  }

  return { thresholds: thresholds ?? DEFAULT_THRESHOLDS, updateThresholds }
}
