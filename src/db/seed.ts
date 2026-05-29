import { db } from './db'
import type { Supplier, Product, Inventory, Order, OrderLine, Shipment, SupplierOrder, AlertThresholds } from '../types'

const MONTHS = 6
const SEED_VERSION = 'v1'

function uid(prefix: string, i: number | string) {
  return `${prefix}_${i}`
}

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

const SUPPLIERS_SEED: Supplier[] = [
  { id: 'sup_1', name: 'AlphaLogix GmbH', country: 'Germany', lead_time_days: 7, reliability_score: 0.96, status: 'active', created_at: monthStart(12) },
  { id: 'sup_2', name: 'BetaTrans SpA', country: 'Italy', lead_time_days: 5, reliability_score: 0.91, status: 'active', created_at: monthStart(12) },
  { id: 'sup_3', name: 'GammaCargo Ltd', country: 'UK', lead_time_days: 10, reliability_score: 0.85, status: 'active', created_at: monthStart(12) },
  { id: 'sup_4', name: 'DeltaFreight SA', country: 'France', lead_time_days: 8, reliability_score: 0.88, status: 'active', created_at: monthStart(12) },
  { id: 'sup_5', name: 'EpsilonSupply BV', country: 'Netherlands', lead_time_days: 6, reliability_score: 0.94, status: 'active', created_at: monthStart(12) },
]

const PRODUCTS_SEED: Product[] = [
  { id: 'prd_1', sku: 'WH-PALLET-STD', name: 'Standard Pallet', category: 'Warehouse Equipment', unit_cost: 18, unit_price: 32 },
  { id: 'prd_2', sku: 'PKG-CARDBOX-L', name: 'Large Cardboard Box', category: 'Packaging', unit_cost: 2.5, unit_price: 5 },
  { id: 'prd_3', sku: 'PKG-BUBBLE-10M', name: 'Bubble Wrap 10m Roll', category: 'Packaging', unit_cost: 4, unit_price: 9 },
  { id: 'prd_4', sku: 'COLD-COOLER-M', name: 'Medium Cooler Box', category: 'Cold Chain', unit_cost: 45, unit_price: 89 },
  { id: 'prd_5', sku: 'TRACK-GPS-V2', name: 'GPS Tracker v2', category: 'Technology', unit_cost: 120, unit_price: 220 },
  { id: 'prd_6', sku: 'FORK-HAND-STD', name: 'Hand Pallet Truck', category: 'Warehouse Equipment', unit_cost: 280, unit_price: 490 },
  { id: 'prd_7', sku: 'LABEL-THERM-A4', name: 'Thermal Labels A4', category: 'Packaging', unit_cost: 12, unit_price: 22 },
  { id: 'prd_8', sku: 'SHELF-RACK-3M', name: 'Storage Rack 3m', category: 'Warehouse Equipment', unit_cost: 340, unit_price: 620 },
]

const CARRIERS = ['DHL Express', 'FedEx Priority', 'UPS Ground', 'GLS Freight', 'TNT Road']
const REGIONS = ['North Italy', 'South Italy', 'Germany', 'France', 'Spain', 'Eastern Europe', 'Nordic']
const CUSTOMER_NAMES = [
  'Rossi Distribution', 'Müller Logistics', 'Dupont Industries', 'Santos & Co',
  'Nordic Supply AS', 'Eco Pack SRL', 'FastMove GmbH', 'Iberia Trans SA',
  'Baltic Cargo OÜ', 'Alpine Freight AG', 'Med Supply SpA', 'Rhine Logistics BV',
]

export async function seedDatabase() {
  const alreadySeeded = localStorage.getItem('lct_seed') === SEED_VERSION
  if (alreadySeeded) return

  // Clear all tables
  await Promise.all([
    db.suppliers.clear(),
    db.products.clear(),
    db.inventory.clear(),
    db.orders.clear(),
    db.orderLines.clear(),
    db.shipments.clear(),
    db.supplierOrders.clear(),
  ])

  // Insert suppliers and products
  await db.suppliers.bulkAdd(SUPPLIERS_SEED)
  await db.products.bulkAdd(PRODUCTS_SEED)

  // Insert inventory
  const inventory: Inventory[] = PRODUCTS_SEED.map((p, i) => ({
    id: uid('inv', i + 1),
    product_id: p.id,
    warehouse_location: pick(['A1', 'A2', 'B1', 'B2', 'C1', 'C3']),
    quantity_on_hand: rngInt(20, 500),
    reorder_point: rngInt(30, 80),
    reorder_quantity: rngInt(100, 300),
    last_updated: new Date(),
  }))
  await db.inventory.bulkAdd(inventory)

  // Default alert thresholds
  const thresholds: AlertThresholds = {
    id: 'thresholds',
    otif_min: 90,
    fillRate_min: 95,
    cycleTime_max: 7,
    inventoryTurnover_min: 4,
    stockOutRate_max: 5,
    avgShippingCost_max: 80,
  }
  await db.alertThresholds.put(thresholds)

  // Generate orders over last 6 months
  const orders: Order[] = []
  const orderLines: OrderLine[] = []
  const shipments: Shipment[] = []
  const supplierOrders: SupplierOrder[] = []

  let orderIdx = 0
  let lineIdx = 0
  let shipIdx = 0
  let soIdx = 0

  for (let m = MONTHS - 1; m >= 0; m--) {
    const mStart = monthStart(m)
    const ordersThisMonth = rngInt(30, 60)

    for (let o = 0; o < ordersThisMonth; o++) {
      orderIdx++
      const orderId = uid('ord', orderIdx)
      const orderDate = addDays(mStart, rngInt(0, 27))
      const requestedDays = rngInt(3, 12)
      const requestedDelivery = addDays(orderDate, requestedDays)

      // Determine if order will be delivered on time (based on supplier reliability avg)
      const avgReliability = SUPPLIERS_SEED.reduce((a, s) => a + s.reliability_score, 0) / SUPPLIERS_SEED.length
      const isOnTime = Math.random() < avgReliability
      const isFullyFulfilled = Math.random() < 0.93

      let status: Order['status']
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

      // Order lines: 1-3 products per order
      const numLines = rngInt(1, 3)
      const selectedProducts = [...PRODUCTS_SEED].sort(() => 0.5 - Math.random()).slice(0, numLines)
      let orderTotal = 0

      for (const product of selectedProducts) {
        lineIdx++
        const qtyOrdered = rngInt(5, 50)
        const qtyFulfilled = isFullyFulfilled ? qtyOrdered : rngInt(Math.floor(qtyOrdered * 0.7), qtyOrdered - 1)
        const lineValue = qtyOrdered * product.unit_price
        orderTotal += lineValue

        orderLines.push({
          id: uid('line', lineIdx),
          order_id: orderId,
          product_id: product.id,
          qty_ordered: qtyOrdered,
          qty_fulfilled: qtyFulfilled,
          unit_price: product.unit_price,
        })
      }

      orders.push({
        id: orderId,
        customer_name: pick(CUSTOMER_NAMES),
        customer_region: pick(REGIONS),
        order_date: orderDate,
        requested_delivery_date: requestedDelivery,
        status,
        total_value: Math.round(orderTotal * 100) / 100,
      })

      // Shipment for shipped/delivered orders
      if (status === 'shipped' || status === 'delivered') {
        shipIdx++
        const shippedDate = addDays(orderDate, rngInt(1, 2))
        const estimatedDelivery = addDays(shippedDate, rngInt(2, 5))
        const actualDelivery = status === 'delivered'
          ? (isOnTime ? estimatedDelivery : addDays(estimatedDelivery, rngInt(1, 4)))
          : null

        const shipStatus: Shipment['status'] =
          status === 'delivered' ? 'delivered'
          : (isOnTime ? 'in_transit' : 'delayed')

        shipments.push({
          id: uid('shp', shipIdx),
          order_id: orderId,
          carrier: pick(CARRIERS),
          tracking_number: `TRK${String(shipIdx).padStart(8, '0')}`,
          shipped_date: shippedDate,
          estimated_delivery: estimatedDelivery,
          actual_delivery: actualDelivery,
          shipping_cost: Math.round(rng(25, 130) * 100) / 100,
          status: shipStatus,
        })
      }

      // Supplier orders (purchase orders) - one per order month
      if (o % 4 === 0) {
        soIdx++
        const supplier = pick(SUPPLIERS_SEED)
        const product = pick(PRODUCTS_SEED)
        const soDate = addDays(mStart, rngInt(0, 10))
        const expectedDelivery = addDays(soDate, supplier.lead_time_days + rngInt(-2, 3))
        const isSOOnTime = Math.random() < supplier.reliability_score

        supplierOrders.push({
          id: uid('so', soIdx),
          supplier_id: supplier.id,
          product_id: product.id,
          quantity: rngInt(100, 500),
          order_date: soDate,
          expected_delivery: expectedDelivery,
          actual_delivery: isSOOnTime
            ? expectedDelivery
            : addDays(expectedDelivery, rngInt(2, 8)),
          unit_cost: product.unit_cost,
          status: soDate < new Date() ? 'received' : 'confirmed',
        })
      }
    }
  }

  await db.orders.bulkAdd(orders)
  await db.orderLines.bulkAdd(orderLines)
  await db.shipments.bulkAdd(shipments)
  await db.supplierOrders.bulkAdd(supplierOrders)

  localStorage.setItem('lct_seed', SEED_VERSION)
}
