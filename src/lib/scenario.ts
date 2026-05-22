import type { ScenarioParams, ScenarioImpact, KPISnapshot } from '../types'

export function applyScenario(
  base: KPISnapshot,
  params: ScenarioParams,
): ScenarioImpact {
  const { demandDelta, shippingCostDelta, supplierReliabilityDelta } = params

  // Demand increase → more stock-outs, lower fill rate, higher turnover
  const demandFactor = demandDelta / 100

  // Reliability decrease → lower OTIF
  const reliabilityFactor = supplierReliabilityDelta / 100

  // Shipping cost change → direct on avg shipping cost
  const shippingFactor = shippingCostDelta / 100

  const otif = Math.max(0, Math.min(100,
    base.otif.value + reliabilityFactor * base.otif.value * -0.8
  ))

  const fillRate = Math.max(0, Math.min(100,
    base.fillRate.value - demandFactor * 8
  ))

  const stockOutRate = Math.max(0, Math.min(100,
    base.stockOutRate.value + demandFactor * 15
  ))

  const avgShippingCost = Math.max(0,
    base.avgShippingCost.value * (1 + shippingFactor)
  )

  const inventoryTurnover = Math.max(0,
    base.inventoryTurnover.value * (1 + demandFactor * 0.6)
  )

  return {
    otif: Math.round(otif * 10) / 10,
    fillRate: Math.round(fillRate * 10) / 10,
    stockOutRate: Math.round(stockOutRate * 10) / 10,
    avgShippingCost: Math.round(avgShippingCost * 100) / 100,
    inventoryTurnover: Math.round(inventoryTurnover * 10) / 10,
  }
}
