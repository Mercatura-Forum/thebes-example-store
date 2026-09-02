import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@thebes/sdk'
import {
  STORE_CID, M, decodeOrders, decodeOrderLines, decodeOrderEvents, cancelOrder,
  argNat, type OrderRow, type OrderLine, type OrderEvent,
} from '../lib/store-api'
import { formatPrice } from '../lib/config'
import { whenDate, whenExact, useChainTime } from '../lib/format'
import { StatusTrail } from '../components/StatusTrail'
import { Spinner, EmptyState, ErrorNote, Button } from '../components/ui'
import { useT } from '../lib/i18n'

export function Orders() {
  const t = useT()
  const { data, loading, error, refetch } = useQuery<OrderRow[]>(STORE_CID, M.ordersView, undefined, decodeOrders)
  const [openId, setOpenId] = useState<bigint>()
  useChainTime() // re-render once chain→wall calibration lands

  if (loading) return <Spinner label={t.loadingOrders} />
  if (error) return <ErrorNote message={error} />
  const orders = data ?? []
  if (orders.length === 0) {
    return (
      <EmptyState
        title={t.noOrdersTitle}
        hint={t.noOrdersHint}
        action={<Link to="/"><Button>{t.browseTheShop}</Button></Link>}
      />
    )
  }
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold">{t.yourOrders}</h1>
      <ul className="mt-5 space-y-3">
        {orders.map((o) => (
          <li
            key={o.id.toString()}
            className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface"
          >
            <button
              className="w-full p-4 text-start"
              onClick={() => setOpenId(openId === o.id ? undefined : o.id)}
              aria-expanded={openId === o.id}
            >
              <div className="flex items-center justify-between">
                <p className="font-display font-semibold">{t.orderNo(o.id)}</p>
                <span className="font-display font-semibold nums">◈{formatPrice(o.totalE8s)}</span>
              </div>
              <p className="mt-0.5 text-xs text-ink-soft nums">
                {t.orderMeta(o.itemCount)} · {whenDate(o.createdAt)}
                {o.discountCode && <span className="text-[var(--color-gold)]"> · {t.promoTag(o.discountCode)}</span>}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <StatusTrail status={o.status} />
                <span className="text-xs text-ink-soft">{openId === o.id ? t.hideDetail : t.showDetail}</span>
              </div>
            </button>
            {openId === o.id && <OrderDetail order={o} onChanged={refetch} />}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Lines as bought (price snapshots) + the on-chain timeline for this order. */
function OrderDetail({ order, onChanged }: { order: OrderRow; onChanged: () => void }) {
  const t = useT()
  const arg = argNat(order.id)
  const { data: lines, loading: l1 } = useQuery<OrderLine[]>(STORE_CID, M.orderLinesView, arg, decodeOrderLines, [order.id])
  const { data: events, loading: l2 } = useQuery<OrderEvent[]>(STORE_CID, M.orderEventsView, arg, decodeOrderEvents, [order.id, order.status])
  const [cancelling, setCancelling] = useState(false)
  const [err, setErr] = useState<string>()

  async function cancel() {
    setCancelling(true)
    setErr(undefined)
    try {
      await cancelOrder(order.id)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="border-t border-[var(--color-line)] p-4">
      {l1 ? <Spinner label={t.loadingLines} /> : (
        <ul className="space-y-1.5">
          {(lines ?? []).map((l) => (
            <li key={l.productId.toString()} className="flex items-center justify-between text-sm">
              <span className="text-ink">{l.name} <span className="text-ink-soft nums">× {l.quantity.toString()}</span></span>
              <span className="nums text-ink-soft">◈{formatPrice(l.unitPriceE8s * l.quantity)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-1 border-t border-dashed border-[var(--color-line)] pt-3 text-sm">
        <div className="flex justify-between"><span className="text-ink-soft">{t.subtotal}</span><span className="nums">◈{formatPrice(order.subtotalE8s)}</span></div>
        {order.discountE8s > 0n && (
          <div className="flex justify-between"><span className="text-ink-soft">{t.promoLine(order.discountCode)}</span><span className="nums text-[var(--color-leaf)]">−◈{formatPrice(order.discountE8s)}</span></div>
        )}
        <div className="flex justify-between font-medium"><span>{t.total}</span><span className="nums">◈{formatPrice(order.totalE8s)}</span></div>
      </div>

      {/* The timeline is the order's slice of the shop's on-chain audit log. */}
      {l2 ? null : (events ?? []).length > 0 && (
        <ol className="mt-4 space-y-2 border-t border-dashed border-[var(--color-line)] pt-3">
          {(events ?? []).map((e, i) => (
            <li key={i} className="flex items-baseline gap-3 text-xs">
              <span className="w-28 shrink-0 text-ink-soft nums">{whenExact(e.at)}</span>
              <span className="font-medium text-ink">{t.eventLabels[e.kind] ?? e.kind}</span>
              <span className="text-ink-soft">{e.detail}</span>
            </li>
          ))}
        </ol>
      )}

      {err && <div className="mt-3"><ErrorNote message={err} /></div>}

      {order.status === 'placed' && (
        <div className="mt-4 flex justify-end">
          <Button variant="danger" onClick={cancel} disabled={cancelling}>
            {cancelling ? t.cancelling : t.cancelOrder}
          </Button>
        </div>
      )}
    </div>
  )
}
