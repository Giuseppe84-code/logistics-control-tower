import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildSupplierScores } from '../lib/suppliers'
import { mapSupplier, mapSupplierOrder } from '../lib/dataMappers'
import type { SupplierScore } from '../lib/suppliers'

export function useSupplierScores(): SupplierScore[] | undefined {
  const [scores, setScores] = useState<SupplierScore[] | undefined>(undefined)

  useEffect(() => {
    let active = true

    async function load() {
      const [suppliersRes, supplierOrdersRes] = await Promise.all([
        supabase.from('suppliers').select('*'),
        supabase.from('supplier_orders').select('*'),
      ])

      if (!active) return

      const suppliers = (suppliersRes.data ?? []).map(mapSupplier)
      const supplierOrders = (supplierOrdersRes.data ?? []).map(mapSupplierOrder)

      setScores(buildSupplierScores(suppliers, supplierOrders))
    }

    load()
    return () => {
      active = false
    }
  }, [])

  return scores
}
