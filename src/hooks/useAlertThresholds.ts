import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
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

type DBRow = {
  otif_min: number | null
  fill_rate_min: number | null
  cycle_time_max: number | null
  inventory_turnover_min: number | null
  stock_out_rate_max: number | null
  avg_shipping_cost_max: number | null
}

function rowToThresholds(row: DBRow): AlertThresholds {
  return {
    id: 'thresholds',
    otif_min: Number(row.otif_min ?? DEFAULT_THRESHOLDS.otif_min),
    fillRate_min: Number(row.fill_rate_min ?? DEFAULT_THRESHOLDS.fillRate_min),
    cycleTime_max: Number(row.cycle_time_max ?? DEFAULT_THRESHOLDS.cycleTime_max),
    inventoryTurnover_min: Number(row.inventory_turnover_min ?? DEFAULT_THRESHOLDS.inventoryTurnover_min),
    stockOutRate_max: Number(row.stock_out_rate_max ?? DEFAULT_THRESHOLDS.stockOutRate_max),
    avgShippingCost_max: Number(row.avg_shipping_cost_max ?? DEFAULT_THRESHOLDS.avgShippingCost_max),
  }
}

export function useAlertThresholds() {
  const [thresholds, setThresholds] = useState<AlertThresholds>(DEFAULT_THRESHOLDS)

  useEffect(() => {
    let active = true

    async function load() {
      const { data } = await supabase.from('alert_thresholds').select('*').maybeSingle()
      if (!active) return
      if (data) setThresholds(rowToThresholds(data as DBRow))
    }

    load()
    return () => {
      active = false
    }
  }, [])

  async function updateThresholds(updates: Partial<Omit<AlertThresholds, 'id'>>) {
    const merged = { ...thresholds, ...updates }
    setThresholds(merged)

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return

    await supabase.from('alert_thresholds').upsert(
      {
        user_id: userId,
        otif_min: merged.otif_min,
        fill_rate_min: merged.fillRate_min,
        cycle_time_max: merged.cycleTime_max,
        inventory_turnover_min: merged.inventoryTurnover_min,
        stock_out_rate_max: merged.stockOutRate_max,
        avg_shipping_cost_max: merged.avgShippingCost_max,
      },
      { onConflict: 'user_id' },
    )
  }

  return { thresholds, updateThresholds }
}
