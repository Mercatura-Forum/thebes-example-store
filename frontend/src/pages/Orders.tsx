import { Link } from 'react-router-dom'
import { useQuery } from '@thebes/sdk'
import { STORE_CID, M, decodeOrders, type OrderRow } from '../lib/store-api'
import { formatPrice } from '../lib/config'
import { Spinner, EmptyState, ErrorNote, Button } from '../components/ui'

const STAGES = ['placed', 'shipped', 'delivered'] as const

function StatusTrail({ status }: { status: string }) {
  const at = Math.max(0, STAGES.indexOf(status as (typeof STAGES)[number]))
  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((s, i) => (
        <span key={s} className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${i <= at ? 'bg-[var(--color-cobalt)]' : 'bg-[var(--color-line)]'}`}
            title={s}
          />
          {i < STAGES.length - 1 && (
            <span className={`h-px w-6 ${i < at ? 'bg-[var(--color-cobalt)]' : 'bg-[var(--color-line)]'}`} />
          )}
        </span>
      ))}
      <span className="ml-2 text-xs capitalize text-ink-soft">{status}</span>
    </div>
  )
}

function when(ns: bigint): string {
  const ms = Number(ns / 1_000_000n)
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Orders() {
  const { data, loading, error } = useQuery<OrderRow[]>(STORE_CID, M.ordersView, undefined, decodeOrders)
  if (loading) return <Spinner label="Loading orders" />
  if (error) return <ErrorNote message={error} />
  const orders = [...(data ?? [])].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
  if (orders.length === 0) {
    return (
      <EmptyState
        title="No orders yet"
        hint="When you check out, your orders and their delivery status appear here."
        action={<Link to="/"><Button>Browse the shop</Button></Link>}
      />
    )
  }
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Your orders</h1>
      <ul className="mt-5 space-y-3">
        {orders.map((o) => (
          <li
            key={o.id.toString()}
            className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-4"
          >
            <div className="flex items-center justify-between">
              <p className="font-display font-semibold">Order #{o.id.toString()}</p>
              <span className="font-display font-semibold nums">◈{formatPrice(o.totalAmount)}</span>
            </div>
            <p className="mt-0.5 text-xs text-ink-soft nums">
              {o.itemCount.toString()} item{o.itemCount === 1n ? '' : 's'} · {when(o.createdAt)}
            </p>
            <div className="mt-3"><StatusTrail status={o.status} /></div>
          </li>
        ))}
      </ul>
    </div>
  )
}
