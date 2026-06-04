// Generates the same realistic ~6 month dataset as the old Dexie seed, but
// targeting Supabase: real UUID PKs/FKs, user_id stamped on every row, dates as
// ISO strings, inserted in FK-safe order in batches.

import { supabase } from './supabase'

const MONTHS = 6

function rng(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function rngInt(min: number, max: number) {
  return Math.floor(rng(min, max + 1))
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function monthStart(offset: number): Date {
  const now = new Date()
  now.setDate(1)
  now.setHours(0, 0, 0, 0)
  now.setMonth(now.getMonth() - offset)
  return now
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function uuid(): string {
  return crypto.randomUUID()
}

const CARRIERS = ['DHL Express', 'FedEx Priority', 'UPS Ground', 'GLS Freight', 'TNT Road']
const REGIONS = ['North Italy', 'South Italy', 'Germany', 'France', 'Spain', 'Eastern Europe', 'Nordic']
const CUSTOMER_NAMES = [
  'Rossi Distribution', 'Müller Logistics', 'Dupont Industries', 'Santos & Co',
  'Nordic Supply AS', 'Eco Pack SRL', 'FastMove GmbH', 'Iberia Trans SA',
  'Baltic Cargo OÜ', 'Alpine Freight AG', 'Med Supply SpA', 'Rhine Logistics BV',
]

interface SupplierSeed {
  id: string
  name: string
  country: string
  lead_time_days: number
  reliability_score: number
  status: 'active' | 'inactive'
  created_at: Date
}

interface ProductSeed {
  id: string
  sku: string
  name: string
  category: string
  unit_cost: number
  unit_price: number
}

async function insertChunked(table: string, rows: Record<string, unknown>[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    const { error } = await supabase.from(table).insert(chunk)
    if (error) throw new Error(`Seed insert into ${table} failed: ${error.message}`)
  }
}

export async function hasData(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
  if (error) throw new Error(`hasData check failed: ${error.message}`)
  return (data?.length ?? 0) > 0
}

export async function seedCloudData(userId: string): Promise<void> {
  const suppliers: SupplierSeed[] = [
    { id: uuid(), name: 'AlphaLogix GmbH', country: 'Germany', lead_time_days: 7, reliability_score: 0.96, status: 'active', created_at: monthStart(12) },
    { id: uuid(), name: 'BetaTrans SpA', country: 'Italy', lead_time_days: 5, reliability_score: 0.91, status: 'active', created_at: monthStart(12) },
    { id: uuid(), name: 'GammaCargo Ltd', country: 'UK', lead_time_days: 10, reliability_score: 0.85, status: 'active', created_at: monthStart(12) },
    { id: uuid(), name: 'DeltaFreight SA', country: 'France', lead_time_days: 8, reliability_score: 0.88, status: 'active', created_at: monthStart(12) },
    { id: uuid(), name: 'EpsilonSupply BV', country: 'Netherlands', lead_time_days: 6, reliability_score: 0.94, status: 'active', created_at: monthStart(12) },
  ]

  const products: ProductSeed[] = [
    { id: uuid(), sku: 'WH-PALLET-STD', name: 'Standard Pallet', category: 'Warehouse Equipment', unit_cost: 18, unit_price: 32 },
    { id: uuid(), sku: 'PKG-CARDBOX-L', name: 'Large Cardboard Box', category: 'Packaging', unit_cost: 2.5, unit_price: 5 },
    { id: uuid(), sku: 'PKG-BUBBLE-10M', name: 'Bubble Wrap 10m Roll', category: 'Packaging', unit_cost: 4, unit_price: 9 },
    { id: uuid(), sku: 'COLD-COOLER-M', name: 'Medium Cooler Box', category: 'Cold Chain', unit_cost: 45, unit_price: 89 },
    { id: uuid(), sku: 'TRACK-GPS-V2', name: 'GPS Tracker v2', category: 'Technology', unit_cost: 120, unit_price: 220 },
    { id: uuid(), sku: 'FORK-HAND-STD', name: 'Hand Pallet Truck', category: 'Warehouse Equipment', unit_cost: 280, unit_price: 490 },
    { id: uuid(), sku: 'LABEL-THERM-A4', name: 'Thermal Labels A4', category: 'Packaging', unit_cost: 12, unit_price: 22 },
    { id: uuid(), sku: 'SHELF-RACK-3M', name: 'Storage Rack 3m', category: 'Warehouse Equipment', unit_cost: 340, unit_price: 620 },
  ]

  const inventory = products.map(p => ({
    id: uuid(),
    user_id: userId,
    product_id: p.id,
    warehouse_location: pick(['A1', 'A2', 'B1', 'B2', 'C1', 'C3']),
    quantity_on_hand: rngInt(20, 500),
    reorder_point: rngInt(30, 80),
    reorder_quantity: rngInt(100, 300),
    last_updated: new Date().toISOString(),
  }))

  const orders: Record<string, unknown>[] = []
  const orderLines: Record<string, unknown>[] = []
  const shipments: Record<string, unknown>[] = []
  const supplierOrders: Record<string, unknown>[] = []

  let shipIdx = 0

  const avgReliability = suppliers.reduce((a, s) => a + s.reliability_score, 0) / suppliers.length

  for (let m = MONTHS - 1; m >= 0; m--) {
    const mStart = monthStart(m)
    const ordersThisMonth = rngInt(30, 60)

    for (let o = 0; o < ordersThisMonth; o++) {
      const orderId = uuid()
      const orderDate = addDays(mStart, rngInt(0, 27))
      const requestedDays = rngInt(3, 12)
      const requestedDelivery = addDays(orderDate, requestedDays)

      const isOnTime = Math.random() < avgReliability
      const isFullyFulfilled = Math.random() < 0.93

      let status: string
      if (orderDate > new Date()) {
        status = 'pending'
      } else if (addDays(orderDate, 1) > new Date()) {
        status = 'processing'
      } else if (isOnTime) {
        status = 'delivered'
      } else if (Math.random() < 0.3) {
        status = 'shipped'
      } else {
        status = 'delivered'
      }

      const numLines = rngInt(1, 3)
      const selectedProducts = [...products].sort(() => 0.5 - Math.random()).slice(0, numLines)
      let orderTotal = 0

      for (const product of selectedProducts) {
        const qtyOrdered = rngInt(5, 50)
        const qtyFulfilled = isFullyFulfilled ? qtyOrdered : rngInt(Math.floor(qtyOrdered * 0.7), qtyOrdered - 1)
        const lineValue = qtyOrdered * product.unit_price
        orderTotal += lineValue

        orderLines.push({
          id: uuid(),
          user_id: userId,
          order_id: orderId,
          product_id: product.id,
          qty_ordered: qtyOrdered,
          qty_fulfilled: qtyFulfilled,
          unit_price: product.unit_price,
        })
      }

      orders.push({
        id: orderId,
        user_id: userId,
        customer_name: pick(CUSTOMER_NAMES),
        customer_region: pick(REGIONS),
        order_date: orderDate.toISOString(),
        requested_delivery_date: requestedDelivery.toISOString(),
        status,
        total_value: Math.round(orderTotal * 100) / 100,
      })

      if (status === 'shipped' || status === 'delivered') {
        shipIdx++
        const shippedDate = addDays(orderDate, rngInt(1, 2))
        const estimatedDelivery = addDays(shippedDate, rngInt(2, 5))
        const actualDelivery = status === 'delivered'
          ? (isOnTime ? estimatedDelivery : addDays(estimatedDelivery, rngInt(1, 4)))
          : null

        const shipStatus =
          status === 'delivered' ? 'delivered'
          : (isOnTime ? 'in_transit' : 'delayed')

        shipments.push({
          id: uuid(),
          user_id: userId,
          order_id: orderId,
          carrier: pick(CARRIERS),
          tracking_number: `TRK${String(shipIdx).padStart(8, '0')}`,
          shipped_date: shippedDate.toISOString(),
          estimated_delivery: estimatedDelivery.toISOString(),
          actual_delivery: actualDelivery ? actualDelivery.toISOString() : null,
          shipping_cost: Math.round(rng(25, 130) * 100) / 100,
          status: shipStatus,
        })
      }

      if (o % 4 === 0) {
        const supplier = pick(suppliers)
        const product = pick(products)
        const soDate = addDays(mStart, rngInt(0, 10))
        const expectedDelivery = addDays(soDate, supplier.lead_time_days + rngInt(-2, 3))
        const isSOOnTime = Math.random() < supplier.reliability_score

        supplierOrders.push({
          id: uuid(),
          user_id: userId,
          supplier_id: supplier.id,
          product_id: product.id,
          quantity: rngInt(100, 500),
          order_date: soDate.toISOString(),
          expected_delivery: expectedDelivery.toISOString(),
          actual_delivery: (isSOOnTime
            ? expectedDelivery
            : addDays(expectedDelivery, rngInt(2, 8))).toISOString(),
          unit_cost: product.unit_cost,
          status: soDate < new Date() ? 'received' : 'confirmed',
        })
      }
    }
  }

  // FK-safe insertion order
  await insertChunked('suppliers', suppliers.map(s => ({
    id: s.id,
    user_id: userId,
    name: s.name,
    country: s.country,
    lead_time_days: s.lead_time_days,
    reliability_score: s.reliability_score,
    status: s.status,
    created_at: s.created_at.toISOString(),
  })))
  await insertChunked('products', products.map(p => ({
    id: p.id,
    user_id: userId,
    sku: p.sku,
    name: p.name,
    category: p.category,
    unit_cost: p.unit_cost,
    unit_price: p.unit_price,
  })))
  await insertChunked('inventory', inventory)
  await insertChunked('orders', orders)
  await insertChunked('order_lines', orderLines)
  await insertChunked('shipments', shipments)
  await insertChunked('supplier_orders', supplierOrders)

  const { error: thrErr } = await supabase.from('alert_thresholds').upsert(
    {
      user_id: userId,
      otif_min: 90,
      fill_rate_min: 95,
      cycle_time_max: 7,
      inventory_turnover_min: 4,
      stock_out_rate_max: 5,
      avg_shipping_cost_max: 80,
    },
    { onConflict: 'user_id' },
  )
  if (thrErr) throw new Error(`Seed alert_thresholds failed: ${thrErr.message}`)
}
