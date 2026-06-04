// Maps raw Supabase rows (dates as ISO strings) into the app's domain types
// from src/types, parsing date columns into Date objects.

import type {
  Supplier,
  Product,
  Inventory,
  Order,
  OrderLine,
  Shipment,
  SupplierOrder,
} from '../types'

type Row = Record<string, unknown>

function toDate(value: unknown): Date {
  return new Date(value as string)
}

function toDateOrNull(value: unknown): Date | null {
  return value == null ? null : new Date(value as string)
}

function num(value: unknown): number {
  return Number(value)
}

export function mapSupplier(row: Row): Supplier {
  return {
    id: row.id as string,
    name: row.name as string,
    country: row.country as string,
    lead_time_days: num(row.lead_time_days),
    reliability_score: num(row.reliability_score),
    status: row.status as Supplier['status'],
    created_at: toDate(row.created_at),
  }
}

export function mapProduct(row: Row): Product {
  return {
    id: row.id as string,
    sku: row.sku as string,
    name: row.name as string,
    category: row.category as string,
    unit_cost: num(row.unit_cost),
    unit_price: num(row.unit_price),
  }
}

export function mapInventory(row: Row): Inventory {
  return {
    id: row.id as string,
    product_id: row.product_id as string,
    warehouse_location: row.warehouse_location as string,
    quantity_on_hand: num(row.quantity_on_hand),
    reorder_point: num(row.reorder_point),
    reorder_quantity: num(row.reorder_quantity),
    last_updated: toDate(row.last_updated),
  }
}

export function mapOrder(row: Row): Order {
  return {
    id: row.id as string,
    customer_name: row.customer_name as string,
    customer_region: row.customer_region as string,
    order_date: toDate(row.order_date),
    requested_delivery_date: toDate(row.requested_delivery_date),
    status: row.status as Order['status'],
    total_value: num(row.total_value),
  }
}

export function mapOrderLine(row: Row): OrderLine {
  return {
    id: row.id as string,
    order_id: row.order_id as string,
    product_id: row.product_id as string,
    qty_ordered: num(row.qty_ordered),
    qty_fulfilled: num(row.qty_fulfilled),
    unit_price: num(row.unit_price),
  }
}

export function mapShipment(row: Row): Shipment {
  return {
    id: row.id as string,
    order_id: row.order_id as string,
    carrier: row.carrier as string,
    tracking_number: row.tracking_number as string,
    shipped_date: toDate(row.shipped_date),
    estimated_delivery: toDate(row.estimated_delivery),
    actual_delivery: toDateOrNull(row.actual_delivery),
    shipping_cost: num(row.shipping_cost),
    status: row.status as Shipment['status'],
  }
}

export function mapSupplierOrder(row: Row): SupplierOrder {
  return {
    id: row.id as string,
    supplier_id: row.supplier_id as string,
    product_id: row.product_id as string,
    quantity: num(row.quantity),
    order_date: toDate(row.order_date),
    expected_delivery: toDate(row.expected_delivery),
    actual_delivery: toDateOrNull(row.actual_delivery),
    unit_cost: num(row.unit_cost),
    status: row.status as SupplierOrder['status'],
  }
}
