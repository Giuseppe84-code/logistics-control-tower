import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { buildSupplierScores } from '../lib/suppliers'
import type { SupplierScore } from '../lib/suppliers'

export function useSupplierScores(): SupplierScore[] | undefined {
  return useLiveQuery(async () => {
    const [suppliers, supplierOrders] = await Promise.all([
      db.suppliers.toArray(),
      db.supplierOrders.toArray(),
    ])
    return buildSupplierScores(suppliers, supplierOrders)
  })
}
