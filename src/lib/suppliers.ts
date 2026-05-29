import type { Supplier, SupplierOrder } from '../types'

export interface SupplierScore {
  id: string
  name: string
  country: string
  leadTimeDays: number
  reliabilityScore: number      // 0..1 stated reliability
  poCount: number               // number of received purchase orders
  onTimeRate: number            // % of received POs delivered on or before expected date
  avgDelayDays: number          // avg days late across received POs (0 if always on time)
  totalSpend: number            // sum of quantity * unit_cost for received POs
}

// Joins suppliers with their purchase orders and derives a performance scorecard.
export function buildSupplierScores(
  suppliers: Supplier[],
  supplierOrders: SupplierOrder[],
): SupplierScore[] {
  const ordersBySupplier = new Map<string, SupplierOrder[]>()
  for (const so of supplierOrders) {
    const bucket = ordersBySupplier.get(so.supplier_id) ?? []
    bucket.push(so)
    ordersBySupplier.set(so.supplier_id, bucket)
  }

  return suppliers
    .map(sup => {
      const pos = (ordersBySupplier.get(sup.id) ?? []).filter(
        so => so.status === 'received' && so.actual_delivery != null,
      )

      let onTime = 0
      let totalDelay = 0
      let totalSpend = 0

      for (const po of pos) {
        const delayMs = po.actual_delivery!.getTime() - po.expected_delivery.getTime()
        const delayDays = delayMs / 86_400_000
        if (delayDays <= 0) onTime++
        else totalDelay += delayDays
        totalSpend += po.quantity * po.unit_cost
      }

      const poCount = pos.length
      return {
        id: sup.id,
        name: sup.name,
        country: sup.country,
        leadTimeDays: sup.lead_time_days,
        reliabilityScore: sup.reliability_score,
        poCount,
        onTimeRate: poCount > 0 ? Math.round((onTime / poCount) * 1000) / 10 : 0,
        avgDelayDays: poCount > 0 ? Math.round((totalDelay / poCount) * 10) / 10 : 0,
        totalSpend: Math.round(totalSpend * 100) / 100,
      }
    })
    .sort((a, b) => b.onTimeRate - a.onTimeRate)
}
