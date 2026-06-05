import { describe, it, expect } from 'vitest'
import {
  calcOTIF,
  calcOrderCycleTime,
  calcFillRate,
  calcInventoryTurnover,
  calcStockOutRate,
  calcAvgShippingCost,
} from './kpi'
import type { Order, OrderLine, Shipment, Inventory, Product } from '../types'

function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

const JAN_01 = d(2024, 1, 1)
const JAN_10 = d(2024, 1, 10)
const JAN_15 = d(2024, 1, 15)
const JAN_20 = d(2024, 1, 20)

function order(id: string, requestedDelivery: Date, status: Order['status'] = 'delivered'): Order {
  return {
    id,
    customer_name: 'ACME',
    customer_region: 'EU',
    order_date: JAN_01,
    requested_delivery_date: requestedDelivery,
    status,
    total_value: 500,
  }
}

function line(id: string, orderId: string, ordered: number, fulfilled: number): OrderLine {
  return { id, order_id: orderId, product_id: 'p1', qty_ordered: ordered, qty_fulfilled: fulfilled, unit_price: 10 }
}

function shipment(id: string, orderId: string, actualDelivery: Date | null): Shipment {
  return {
    id,
    order_id: orderId,
    carrier: 'UPS',
    tracking_number: 'T' + id,
    shipped_date: JAN_10,
    estimated_delivery: JAN_15,
    actual_delivery: actualDelivery,
    shipping_cost: 100,
    status: 'delivered',
  }
}

function invItem(productId: string, onHand: number, reorderPoint: number): Inventory {
  return {
    id: 'i-' + productId,
    product_id: productId,
    warehouse_location: 'A1',
    quantity_on_hand: onHand,
    reorder_point: reorderPoint,
    reorder_quantity: 20,
    last_updated: JAN_01,
  }
}

function product(id: string, unitCost: number): Product {
  return { id, sku: id, name: id, category: 'cat', unit_cost: unitCost, unit_price: unitCost * 2 }
}

// ─── calcOTIF ─────────────────────────────────────────────────────────────────

describe('calcOTIF', () => {
  it('returns 0 with no delivered orders', () => {
    expect(calcOTIF([], [], [])).toBe(0)
  })

  it('returns 0 when all orders are pending (not delivered)', () => {
    const orders = [order('o1', JAN_15, 'pending')]
    expect(calcOTIF(orders, [line('l1', 'o1', 10, 10)], [])).toBe(0)
  })

  it('returns 100 when on-time AND in-full', () => {
    const orders = [order('o1', JAN_15)]
    const lines = [line('l1', 'o1', 10, 10)]
    const shipments = [shipment('s1', 'o1', JAN_10)]
    expect(calcOTIF(orders, lines, shipments)).toBe(100)
  })

  it('returns 0 when delivery is late', () => {
    const orders = [order('o1', JAN_10)]
    const lines = [line('l1', 'o1', 10, 10)]
    const shipments = [shipment('s1', 'o1', JAN_15)]
    expect(calcOTIF(orders, lines, shipments)).toBe(0)
  })

  it('returns 0 when qty_fulfilled < qty_ordered', () => {
    const orders = [order('o1', JAN_15)]
    const lines = [line('l1', 'o1', 10, 8)]
    const shipments = [shipment('s1', 'o1', JAN_10)]
    expect(calcOTIF(orders, lines, shipments)).toBe(0)
  })

  it('returns 0 when there is no shipment record', () => {
    const orders = [order('o1', JAN_15)]
    const lines = [line('l1', 'o1', 10, 10)]
    expect(calcOTIF(orders, lines, [])).toBe(0)
  })

  it('calculates 50% when 1 of 2 orders passes', () => {
    const orders = [order('o1', JAN_15), order('o2', JAN_10)]
    const lines = [line('l1', 'o1', 10, 10), line('l2', 'o2', 10, 10)]
    const shipments = [
      shipment('s1', 'o1', JAN_10),  // on time (JAN_10 <= JAN_15)
      shipment('s2', 'o2', JAN_15),  // late    (JAN_15 > JAN_10)
    ]
    expect(calcOTIF(orders, lines, shipments)).toBe(50)
  })
})

// ─── calcOrderCycleTime ───────────────────────────────────────────────────────

describe('calcOrderCycleTime', () => {
  it('returns 0 with no delivered orders', () => {
    expect(calcOrderCycleTime([], [])).toBe(0)
  })

  it('calculates cycle time from order_date to actual_delivery', () => {
    // JAN_01 → JAN_15 = 14 days
    const orders = [order('o1', JAN_20)]
    const shipments = [shipment('s1', 'o1', JAN_15)]
    expect(calcOrderCycleTime(orders, shipments)).toBe(14)
  })

  it('falls back to requested_delivery_date when no shipment exists', () => {
    // JAN_01 → JAN_20 = 19 days
    const orders = [order('o1', JAN_20)]
    expect(calcOrderCycleTime(orders, [])).toBe(19)
  })

  it('averages across multiple orders', () => {
    // o1: 9 days, o2: 19 days → avg 14
    const orders = [order('o1', JAN_20), order('o2', JAN_20)]
    const shipments = [shipment('s1', 'o1', JAN_10), shipment('s2', 'o2', JAN_20)]
    expect(calcOrderCycleTime(orders, shipments)).toBe(14)
  })
})

// ─── calcFillRate ─────────────────────────────────────────────────────────────

describe('calcFillRate', () => {
  it('returns 0 for empty lines', () => {
    expect(calcFillRate([])).toBe(0)
  })

  it('returns 100 when all lines are fully fulfilled', () => {
    const lines = [line('l1', 'o1', 10, 10), line('l2', 'o1', 20, 20)]
    expect(calcFillRate(lines)).toBe(100)
  })

  it('calculates partial fill rate correctly', () => {
    const lines = [line('l1', 'o1', 100, 80)]
    expect(calcFillRate(lines)).toBe(80)
  })

  it('aggregates across multiple lines', () => {
    // 50 + 30 = 80 fulfilled / 100 ordered = 80%
    const lines = [line('l1', 'o1', 60, 50), line('l2', 'o2', 40, 30)]
    expect(calcFillRate(lines)).toBe(80)
  })
})

// ─── calcInventoryTurnover ────────────────────────────────────────────────────

describe('calcInventoryTurnover', () => {
  it('returns 0 when inventory value is zero', () => {
    const products = [product('p1', 0)]
    const inventory = [invItem('p1', 100, 10)]
    const lines = [line('l1', 'o1', 10, 10)]
    expect(calcInventoryTurnover(lines, products, inventory)).toBe(0)
  })

  it('returns 0 for empty inventory array', () => {
    const products = [product('p1', 5)]
    const lines = [line('l1', 'o1', 10, 10)]
    expect(calcInventoryTurnover(lines, products, [])).toBe(0)
  })

  it('annualises 6 months of COGS correctly', () => {
    // COGS = 10 * €5 = €50 → annualised = €100
    // avg inventory value = 20 * €5 = €100
    // turnover = 100 / 100 = 1.0
    const products = [product('p1', 5)]
    const inventory = [invItem('p1', 20, 5)]
    const lines = [line('l1', 'o1', 10, 10)]
    expect(calcInventoryTurnover(lines, products, inventory)).toBe(1)
  })

  it('uses qty_fulfilled (not qty_ordered) for COGS', () => {
    // fulfilled=5, cost=10 → COGS=50, annualised=100
    // inventory = 10 * 10 = 100 → turnover = 1
    const products = [product('p1', 10)]
    const inventory = [invItem('p1', 10, 2)]
    const lines = [line('l1', 'o1', 10, 5)]
    expect(calcInventoryTurnover(lines, products, inventory)).toBe(1)
  })
})

// ─── calcStockOutRate ─────────────────────────────────────────────────────────

describe('calcStockOutRate', () => {
  it('returns 0 for empty inventory', () => {
    expect(calcStockOutRate([])).toBe(0)
  })

  it('returns 0 when no SKU is below reorder point', () => {
    const inventory = [invItem('p1', 50, 10), invItem('p2', 30, 10)]
    expect(calcStockOutRate(inventory)).toBe(0)
  })

  it('returns 100 when all SKUs are below reorder point', () => {
    const inventory = [invItem('p1', 5, 10), invItem('p2', 3, 10)]
    expect(calcStockOutRate(inventory)).toBe(100)
  })

  it('calculates 50% when half of SKUs are below reorder point', () => {
    const inventory = [invItem('p1', 5, 10), invItem('p2', 50, 10)]
    expect(calcStockOutRate(inventory)).toBe(50)
  })

  it('treats quantity_on_hand === reorder_point as NOT a stock-out', () => {
    const inventory = [invItem('p1', 10, 10)]
    expect(calcStockOutRate(inventory)).toBe(0)
  })
})

// ─── calcAvgShippingCost ──────────────────────────────────────────────────────

describe('calcAvgShippingCost', () => {
  it('returns 0 for no shipments', () => {
    expect(calcAvgShippingCost([])).toBe(0)
  })

  it('returns the single shipment cost when there is only one', () => {
    const shipments = [shipment('s1', 'o1', JAN_15)]
    expect(calcAvgShippingCost(shipments)).toBe(100)
  })

  it('averages cost across multiple shipments', () => {
    const s1 = { ...shipment('s1', 'o1', JAN_15), shipping_cost: 100 }
    const s2 = { ...shipment('s2', 'o2', JAN_15), shipping_cost: 200 }
    expect(calcAvgShippingCost([s1, s2])).toBe(150)
  })

  it('rounds to 2 decimal places', () => {
    const s1 = { ...shipment('s1', 'o1', JAN_15), shipping_cost: 10 }
    const s2 = { ...shipment('s2', 'o2', JAN_15), shipping_cost: 20 }
    const s3 = { ...shipment('s3', 'o3', JAN_15), shipping_cost: 30 }
    expect(calcAvgShippingCost([s1, s2, s3])).toBe(20)
  })
})
