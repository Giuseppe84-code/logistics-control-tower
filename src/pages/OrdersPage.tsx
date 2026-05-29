import { OrdersTable } from '../components/orders/OrdersTable'

export function OrdersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-200">Orders</h2>
        <p className="text-sm text-slate-500 mt-1">All customer orders — filterable and sortable. Click column headers to sort.</p>
      </div>
      <OrdersTable />
    </div>
  )
}
