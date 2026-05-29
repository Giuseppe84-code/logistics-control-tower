import Dexie, { type Table } from 'dexie'
import type {
  Supplier,
  Product,
  Inventory,
  Order,
  OrderLine,
  Shipment,
  SupplierOrder,
  AlertThresholds,
} from '../types'

export class LogisticsDB extends Dexie {
  suppliers!: Table<Supplier, string>
  products!: Table<Product, string>
  inventory!: Table<Inventory, string>
  orders!: Table<Order, string>
  orderLines!: Table<OrderLine, string>
  shipments!: Table<Shipment, string>
  supplierOrders!: Table<SupplierOrder, string>
  alertThresholds!: Table<AlertThresholds, string>

  constructor() {
    super('LogisticsControlTower')
    this.version(1).stores({
      suppliers: 'id, name, country, status',
      products: 'id, sku, category',
      inventory: 'id, product_id, warehouse_location',
      orders: 'id, status, order_date, customer_region',
      orderLines: 'id, order_id, product_id',
      shipments: 'id, order_id, status, shipped_date',
      supplierOrders: 'id, supplier_id, product_id, status',
      alertThresholds: 'id',
    })
  }
}
