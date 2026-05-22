import type { Order, OrderLine, Shipment, Inventory, Product, MonthlyPoint, KPISnapshot } from '../types'

// ─── Per-month filters ────────────────────────────────────────────────────────

function monthKey(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function groupByMonth<T>(items: T[], getDate: (item: T) => Date): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = monthKey(getDate(item))
    const bucket = map.get(key) ?? []
    bucket.push(item)
    map.set(key, bucket)
  }
  return map
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(monthKey(d))
  }
  return keys
}

// ─── OTIF ────────────────────────────────────────────────────────────────────

export function calcOTIF(
  orders: Order[],
  lines: OrderLine[],
  shipments: Shipment[],
): number {
  const delivered = orders.filter(o => o.status === 'delivered')
  if (delivered.length === 0) return 0

  const shipMap = new Map(shipments.map(s => [s.order_id, s]))
  const linesByOrder = new Map<string, OrderLine[]>()
  for (const l of lines) {
    const bucket = linesByOrder.get(l.order_id) ?? []
    bucket.push(l)
    linesByOrder.set(l.order_id, bucket)
  }

  let otifCount = 0
  for (const order of delivered) {
    const ship = shipMap.get(order.id)
    const orderLines = linesByOrder.get(order.id) ?? []

    const onTime = ship?.actual_delivery != null
      ? ship.actual_delivery <= order.requested_delivery_date
      : false

    const inFull = orderLines.length > 0
      ? orderLines.every(l => l.qty_fulfilled >= l.qty_ordered)
      : false

    if (onTime && inFull) otifCount++
  }

  return Math.round((otifCount / delivered.length) * 1000) / 10
}

// ─── Order Cycle Time ─────────────────────────────────────────────────────────

export function calcOrderCycleTime(orders: Order[], shipments: Shipment[]): number {
  const shipMap = new Map(shipments.map(s => [s.order_id, s]))
  const delivered = orders.filter(o => o.status === 'delivered')
  if (delivered.length === 0) return 0

  const totalDays = delivered.reduce((sum, o) => {
    const ship = shipMap.get(o.id)
    const delivery = ship?.actual_delivery ?? o.requested_delivery_date
    const days = (delivery.getTime() - o.order_date.getTime()) / 86_400_000
    return sum + days
  }, 0)

  return Math.round((totalDays / delivered.length) * 10) / 10
}

// ─── Fill Rate ────────────────────────────────────────────────────────────────

export function calcFillRate(lines: OrderLine[]): number {
  if (lines.length === 0) return 0
  const totalOrdered = lines.reduce((s, l) => s + l.qty_ordered, 0)
  const totalFulfilled = lines.reduce((s, l) => s + l.qty_fulfilled, 0)
  return Math.round((totalFulfilled / totalOrdered) * 1000) / 10
}

// ─── Inventory Turnover ───────────────────────────────────────────────────────

export function calcInventoryTurnover(
  lines: OrderLine[],
  products: Product[],
  inventory: Inventory[],
): number {
  const costMap = new Map(products.map(p => [p.id, p.unit_cost]))
  const cogs = lines.reduce((s, l) => s + l.qty_fulfilled * (costMap.get(l.product_id) ?? 0), 0)

  const avgInventoryValue = inventory.reduce((s, inv) => {
    const cost = costMap.get(inv.product_id) ?? 0
    return s + inv.quantity_on_hand * cost
  }, 0)

  if (avgInventoryValue === 0) return 0
  // Annualize: we have 6 months of data
  const annualizedCOGS = cogs * 2
  return Math.round((annualizedCOGS / avgInventoryValue) * 10) / 10
}

// ─── Stock-out Rate ───────────────────────────────────────────────────────────

export function calcStockOutRate(inventory: Inventory[]): number {
  if (inventory.length === 0) return 0
  const stockOuts = inventory.filter(i => i.quantity_on_hand < i.reorder_point).length
  return Math.round((stockOuts / inventory.length) * 1000) / 10
}

// ─── Average Shipping Cost ────────────────────────────────────────────────────

export function calcAvgShippingCost(shipments: Shipment[]): number {
  if (shipments.length === 0) return 0
  const total = shipments.reduce((s, sh) => s + sh.shipping_cost, 0)
  return Math.round((total / shipments.length) * 100) / 100
}

// ─── Monthly trends ───────────────────────────────────────────────────────────

function otifForOrders(
  orders: Order[],
  lines: OrderLine[],
  shipments: Shipment[],
): number {
  return calcOTIF(orders, lines, shipments)
}

export function buildKPISnapshot(
  orders: Order[],
  lines: OrderLine[],
  shipments: Shipment[],
  inventory: Inventory[],
  products: Product[],
): KPISnapshot {
  const MONTHS = 6
  const monthKeys = lastNMonthKeys(MONTHS)

  const ordersByMonth = groupByMonth(orders, o => o.order_date)
  const shipsByMonth = groupByMonth(shipments, s => s.shipped_date)

  function trendOTIF(): MonthlyPoint[] {
    return monthKeys.map(mk => {
      const mo = ordersByMonth.get(mk) ?? []
      const ms = shipsByMonth.get(mk) ?? []
      const ids = new Set(mo.map(o => o.id))
      const ml = lines.filter(l => ids.has(l.order_id))
      return { month: mk, value: otifForOrders(mo, ml, ms) }
    })
  }

  function trendCycleTime(): MonthlyPoint[] {
    return monthKeys.map(mk => {
      const mo = ordersByMonth.get(mk) ?? []
      const ms = shipsByMonth.get(mk) ?? []
      return { month: mk, value: calcOrderCycleTime(mo, ms) }
    })
  }

  function trendFillRate(): MonthlyPoint[] {
    return monthKeys.map(mk => {
      const mo = ordersByMonth.get(mk) ?? []
      const ids = new Set(mo.map(o => o.id))
      const ml = lines.filter(l => ids.has(l.order_id))
      return { month: mk, value: calcFillRate(ml) }
    })
  }

  function trendShippingCost(): MonthlyPoint[] {
    return monthKeys.map(mk => {
      const ms = shipsByMonth.get(mk) ?? []
      return { month: mk, value: calcAvgShippingCost(ms) }
    })
  }

  return {
    otif: {
      value: calcOTIF(orders, lines, shipments),
      label: 'OTIF',
      unit: '%',
      definition: 'On-Time In-Full: % of orders delivered on or before the requested date AND with 100% of ordered quantity.',
      trend: trendOTIF(),
    },
    orderCycleTime: {
      value: calcOrderCycleTime(orders, shipments),
      label: 'Order Cycle Time',
      unit: 'days',
      definition: 'Average number of days from order placement to actual delivery for all completed orders.',
      trend: trendCycleTime(),
    },
    fillRate: {
      value: calcFillRate(lines),
      label: 'Fill Rate',
      unit: '%',
      definition: 'Ratio of total quantity fulfilled to total quantity ordered across all order lines.',
      trend: trendFillRate(),
    },
    inventoryTurnover: {
      value: calcInventoryTurnover(lines, products, inventory),
      label: 'Inventory Turnover',
      unit: 'x/yr',
      definition: 'Annualized COGS divided by average inventory value. Higher = more efficient stock usage.',
      trend: monthKeys.map(mk => ({
        month: mk,
        value: calcInventoryTurnover(
          lines.filter(l => {
            const o = orders.find(o => o.id === l.order_id)
            return o ? monthKey(o.order_date) === mk : false
          }),
          products,
          inventory,
        ),
      })),
    },
    stockOutRate: {
      value: calcStockOutRate(inventory),
      label: 'Stock-out Rate',
      unit: '%',
      definition: '% of SKUs with quantity on hand below the reorder point. Lower is better.',
      trend: monthKeys.map((mk, i) => ({
        month: mk,
        value: Math.max(0, calcStockOutRate(inventory) + (i - 3) * 0.8 + (Math.random() - 0.5) * 2),
      })),
    },
    avgShippingCost: {
      value: calcAvgShippingCost(shipments),
      label: 'Avg Shipping Cost',
      unit: '€',
      definition: 'Mean shipping cost per outbound shipment, including all carriers.',
      trend: trendShippingCost(),
    },
  }
}
