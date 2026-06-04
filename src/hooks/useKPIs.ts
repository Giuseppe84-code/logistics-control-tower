import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildKPISnapshot } from '../lib/kpi'
import { mapOrder, mapOrderLine, mapShipment, mapInventory, mapProduct } from '../lib/dataMappers'
import type { KPISnapshot } from '../types'

export function useKPIs(): KPISnapshot | undefined {
  const [snapshot, setSnapshot] = useState<KPISnapshot | undefined>(undefined)

  useEffect(() => {
    let active = true

    async function load() {
      const [ordersRes, linesRes, shipmentsRes, inventoryRes, productsRes] = await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('order_lines').select('*'),
        supabase.from('shipments').select('*'),
        supabase.from('inventory').select('*'),
        supabase.from('products').select('*'),
      ])

      if (!active) return

      const orders = (ordersRes.data ?? []).map(mapOrder)
      const lines = (linesRes.data ?? []).map(mapOrderLine)
      const shipments = (shipmentsRes.data ?? []).map(mapShipment)
      const inventory = (inventoryRes.data ?? []).map(mapInventory)
      const products = (productsRes.data ?? []).map(mapProduct)

      setSnapshot(buildKPISnapshot(orders, lines, shipments, inventory, products))
    }

    load()
    return () => {
      active = false
    }
  }, [])

  return snapshot
}
