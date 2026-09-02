import { useMemo, useState } from 'react'
import { useQuery } from '@thebes/sdk'
import {
  STORE_CID, M, decodeAdminOrders, shipOrder, deliverOrder, refundOrder, adminCancelOrder,
  argPage, type AdminOrderRow,
} from '../../lib/store-api'
import { formatPrice } from '../../lib/config'
import { whenExact, shortHex, useChainTime } from '../../lib/format'
import { StatusTrail } from '../StatusTrail'
import { Spinner, ErrorNote, Button, EmptyState } from '../ui'
import { errStr } from './common'
import { useT } from '../../lib/i18n'

const PAGE = 25

/** The fulfilment queue: every order in the shop, newest first, with its next
 *  lifecycle action inline. Transitions are the backend's explicit edges —
 *  the UI only ever offers moves the contract will accept. */
export function OrdersTab() {
  const t = useT()
  const [offset, setOffset] = useState(0)
  useChainTime() // re-render once chain→wall calibration lands
  const arg = useMemo(() => argPage(offset, PAGE), [offset])
  const { data, loading, error, refetch } = useQuery<AdminOrderRow[]>(STORE_CID, M.allOrdersView, arg, decodeAdminOrders, [offset])

  if (loading) return <Spinner label={t.loadingOrderBook} />
  if (error) return <ErrorNote message={error} />
  const orders = data ?? []
  if (orders.length === 0 && offset === 0) {
    return <EmptyState title={t.noOrdersTitle} hint={t.ordersLandHere} />
  }

  return (
    <div>
      <ul className="space-y-3">
        {orders.map((o) => (
          <OrderRow key={o.id.toString()} o={o} onChanged={refetch} />
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setOffset(Math.max(0, offset - PAGE))} disabled={offset === 0}>
          {t.newer}
        </Button>
        <span className="text-xs text-ink-soft nums">
          {offset + 1}–{offset + orders.length}
        </span>
        <Button variant="ghost" onClick={() => setOffset(offset + PAGE)} disabled={orders.length < PAGE}>
          {t.older}
        </Button>
      </div>
    </div>
  )
}

function OrderRow({ o, onChanged }: { o: AdminOrderRow; onChanged: () => void }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()

  async function run(action: (id: bigint) => Promise<void>) {
    setBusy(true)
    setErr(undefined)
    try {
      await action(o.id)
      onChanged()
    } catch (e) {
      setErr(errStr(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display font-semibold">
            {t.orderNo(o.id)}
            <span className="ms-2 text-xs font-normal text-ink-soft nums" title={o.buyer}>{t.buyer(shortHex(o.buyer))}</span>
          </p>
          <p className="mt-0.5 text-xs text-ink-soft nums">
            {t.orderMeta(o.itemCount)} · {whenExact(o.createdAt)}
            {o.discountCode && <span className="text-[var(--color-gold)]"> · {t.promoTag(o.discountCode)}</span>}
          </p>
        </div>
        <span className="font-display font-semibold nums">◈{formatPrice(o.totalE8s)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <StatusTrail status={o.status} />
        <div className="flex gap-2">
          {o.status === 'placed' && (
            <>
              <Button className="px-3 py-1 text-xs" onClick={() => run(shipOrder)} disabled={busy}>{t.ship}</Button>
              <Button variant="danger" className="px-3 py-1 text-xs" onClick={() => run(adminCancelOrder)} disabled={busy}>{t.cancel}</Button>
            </>
          )}
          {o.status === 'shipped' && (
            <Button className="px-3 py-1 text-xs" onClick={() => run(deliverOrder)} disabled={busy}>{t.markDelivered}</Button>
          )}
          {o.status === 'delivered' && (
            <Button variant="danger" className="px-3 py-1 text-xs" onClick={() => run(refundOrder)} disabled={busy}>{t.refundRestock}</Button>
          )}
        </div>
      </div>
      {err && <div className="mt-2"><ErrorNote message={err} /></div>}
    </li>
  )
}
