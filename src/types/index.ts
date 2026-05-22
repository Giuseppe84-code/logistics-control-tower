// ─── Domain types (mirror of relational schema) ───────────────────────────────

export type SupplierStatus = 'active' | 'inactive'

export interface Supplier {
  id: string
  name: string
  country: string
  lead_time_days: number        // average days from PO to delivery
  reliability_score: number     // 0..1, probability of on-time delivery
  status: SupplierStatus
  created_at: Date
}

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  unit_cost: number             // purchase cost
  unit_price: number            // selling price
}

export interface Inventory {
  id: string
  product_id: string            // FK → Product
  warehouse_location: string
  quantity_on_hand: number
  reorder_point: number
  reorder_quantity: number
  last_updated: Date
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

export interface Order {
  id: string
  customer_name: string
  customer_region: string
  order_date: Date
  requested_delivery_date: Date
  status: OrderStatus
  total_value: number
}

export interface OrderLine {
  id: string
  order_id: string              // FK → Order
  product_id: string            // FK → Product
  qty_ordered: number
  qty_fulfilled: number
  unit_price: number
}

export type ShipmentStatus = 'in_transit' | 'delivered' | 'delayed' | 'lost'

export interface Shipment {
  id: string
  order_id: string              // FK → Order
  carrier: string
  tracking_number: string
  shipped_date: Date
  estimated_delivery: Date
  actual_delivery: Date | null
  shipping_cost: number
  status: ShipmentStatus
}

export type SupplierOrderStatus = 'pending' | 'confirmed' | 'shipped' | 'received' | 'cancelled'

export interface SupplierOrder {
  id: string
  supplier_id: string           // FK → Supplier
  product_id: string            // FK → Product
  quantity: number
  order_date: Date
  expected_delivery: Date
  actual_delivery: Date | null
  unit_cost: number
  status: SupplierOrderStatus
}

// ─── KPI types ────────────────────────────────────────────────────────────────

export interface KPIValue {
  value: number
  label: string
  unit: string                  // '%', 'days', '€', 'x'
  definition: string
  trend: MonthlyPoint[]
}

export interface MonthlyPoint {
  month: string                 // 'Jan 25', 'Feb 25' …
  value: number
}

export interface KPISnapshot {
  otif: KPIValue
  orderCycleTime: KPIValue
  fillRate: KPIValue
  inventoryTurnover: KPIValue
  stockOutRate: KPIValue
  avgShippingCost: KPIValue
}

// ─── Alert thresholds (persisted in IndexedDB) ────────────────────────────────

export interface AlertThresholds {
  id: 'thresholds'              // singleton row
  otif_min: number              // e.g. 90  (%)
  fillRate_min: number          // e.g. 95  (%)
  cycleTime_max: number         // e.g. 7   (days)
  inventoryTurnover_min: number // e.g. 4   (x/year)
  stockOutRate_max: number      // e.g. 5   (%)
  avgShippingCost_max: number   // e.g. 80  (€)
}

// ─── Scenario types ────────────────────────────────────────────────────────────

export interface ScenarioParams {
  demandDelta: number           // e.g. +20 means +20%
  shippingCostDelta: number     // e.g. -10 means -10%
  supplierReliabilityDelta: number // e.g. -15 means -15%
}

export interface ScenarioImpact {
  otif: number
  fillRate: number
  stockOutRate: number
  avgShippingCost: number
  inventoryTurnover: number
}
