import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Order, OrderStatus } from '../../types'
import { Badge } from '../ui/Badge'
import { toCSV, downloadCSV } from '../../lib/csv'

type SortKey = keyof Pick<Order, 'order_date' | 'requested_delivery_date' | 'total_value' | 'status'>
type SortDir = 'asc' | 'desc'

const STATUS_BADGE: Record<OrderStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  delivered: 'success',
  shipped: 'warning',
  processing: 'neutral',
  pending: 'neutral',
  cancelled: 'danger',
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function OrdersTable() {
  const orders = useLiveQuery(() => db.orders.toArray())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [regionFilter, setRegionFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('order_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const regions = useMemo(() => {
    if (!orders) return []
    return Array.from(new Set(orders.map(o => o.customer_region))).sort()
  }, [orders])

  const filtered = useMemo(() => {
    if (!orders) return []
    let result = orders

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_region.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter)
    }

    if (regionFilter !== 'all') {
      result = result.filter(o => o.customer_region === regionFilter)
    }

    return [...result].sort((a, b) => {
      const av: number | string = a[sortKey] instanceof Date ? (a[sortKey] as Date).getTime() : a[sortKey] as number | string
      const bv: number | string = b[sortKey] instanceof Date ? (b[sortKey] as Date).getTime() : b[sortKey] as number | string
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [orders, search, statusFilter, regionFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-slate-600 ml-1">↕</span>
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function handleExport() {
    const csv = toCSV(filtered, [
      { key: 'id', header: 'Order ID' },
      { key: 'customer_name', header: 'Customer' },
      { key: 'customer_region', header: 'Region' },
      { key: 'order_date', header: 'Order Date', get: o => o.order_date.toISOString().slice(0, 10) },
      { key: 'requested_delivery_date', header: 'Requested Delivery', get: o => o.requested_delivery_date.toISOString().slice(0, 10) },
      { key: 'status', header: 'Status' },
      { key: 'total_value', header: 'Total Value (EUR)' },
    ])
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCSV(`orders_${stamp}.csv`, csv)
  }

  const statuses: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search ID, customer, region…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-64"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as OrderStatus | 'all')}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={regionFilter}
          onChange={e => setRegionFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="self-center text-xs text-slate-500">{filtered.length} orders</span>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="ml-auto self-center text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 rounded-lg px-4 py-2 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Order ID</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Customer</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Region</th>
              <th
                className="text-left px-4 py-3 text-slate-400 font-medium cursor-pointer hover:text-slate-200 select-none"
                onClick={() => toggleSort('order_date')}
              >
                Order Date <SortIcon col="order_date" />
              </th>
              <th
                className="text-left px-4 py-3 text-slate-400 font-medium cursor-pointer hover:text-slate-200 select-none"
                onClick={() => toggleSort('requested_delivery_date')}
              >
                Req. Delivery <SortIcon col="requested_delivery_date" />
              </th>
              <th
                className="text-left px-4 py-3 text-slate-400 font-medium cursor-pointer hover:text-slate-200 select-none"
                onClick={() => toggleSort('status')}
              >
                Status <SortIcon col="status" />
              </th>
              <th
                className="text-right px-4 py-3 text-slate-400 font-medium cursor-pointer hover:text-slate-200 select-none"
                onClick={() => toggleSort('total_value')}
              >
                Value <SortIcon col="total_value" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filtered.slice(0, 200).map(order => (
              <tr key={order.id} className="bg-slate-900/50 hover:bg-slate-800/80 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{order.id}</td>
                <td className="px-4 py-2.5 text-slate-200">{order.customer_name}</td>
                <td className="px-4 py-2.5 text-slate-400">{order.customer_region}</td>
                <td className="px-4 py-2.5 text-slate-300">{formatDate(order.order_date)}</td>
                <td className="px-4 py-2.5 text-slate-300">{formatDate(order.requested_delivery_date)}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={STATUS_BADGE[order.status]}>{order.status}</Badge>
                </td>
                <td className="px-4 py-2.5 text-right text-slate-200 font-medium">€{order.total_value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
