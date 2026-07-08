import { useQuery } from '@thebes/sdk'
import { STORE_CID, M, decodeStats, type ShopStats } from '../../lib/store-api'
import { formatPrice } from '../../lib/config'
import { Spinner, ErrorNote, Stat } from '../ui'

/** The shop at a glance — every number computed on-chain in one query. */
export function OverviewTab() {
  const { data, loading, error } = useQuery<ShopStats[]>(STORE_CID, M.statsView, undefined, decodeStats)
  if (loading) return <Spinner label="Computing shop stats" />
  if (error) return <ErrorNote message={error} />
  const s = data?.[0]
  if (!s) return <ErrorNote message="Stats unavailable." />

  const open = s.ordersPlaced + s.ordersShipped

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Revenue (live orders)" value={`◈${formatPrice(s.revenueE8s)}`} accent />
        <Stat label="Orders to fulfil" value={open.toString()} />
        <Stat label="Units on hand" value={s.unitsOnHand.toString()} />
        <Stat label="Held at checkout" value={s.unitsReserved.toString()} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-ink-soft">Order book</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Placed" value={s.ordersPlaced.toString()} />
          <Stat label="Shipped" value={s.ordersShipped.toString()} />
          <Stat label="Delivered" value={s.ordersDelivered.toString()} />
          <Stat label="Cancelled" value={s.ordersCancelled.toString()} />
          <Stat label="Refunded" value={s.ordersRefunded.toString()} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-ink-soft">Lifetime ledger</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Units sold" value={s.unitsSold.toString()} />
          <Stat label="Units returned" value={s.unitsReturned.toString()} />
          <Stat label="Invoices issued" value={s.invoiceCount.toString()} />
          <Stat label="Audit entries" value={s.auditEvents.toString()} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-ink-soft">Catalogue</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Products live" value={s.activeProducts.toString()} />
          <Stat label="Products total" value={s.products.toString()} />
          <Stat label="Categories" value={s.categories.toString()} />
          <Stat label="Promos active" value={s.discountsActive.toString()} />
        </div>
      </div>
    </div>
  )
}
