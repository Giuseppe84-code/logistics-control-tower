import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { buildKPISnapshot } from '../lib/kpi'
import type { KPISnapshot } from '../types'

export function useKPIs(): KPISnapshot | undefined {
  return useLiveQuery(async () => {
    const [orders, lines, shipments, inventory, products] = await Promise.all([
      db.orders.toArray(),
      db.orderLines.toArray(),
      db.shipments.toArray(),
      db.inventory.toArray(),
      db.products.toArray(),
    ])
    return buildKPISnapshot(orders, lines, shipments, inventory, products)
  })
}
