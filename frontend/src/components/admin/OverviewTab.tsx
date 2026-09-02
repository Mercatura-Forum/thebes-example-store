import { useQuery } from '@thebes/sdk'
import { STORE_CID, M, decodeStats, type ShopStats } from '../../lib/store-api'
import { formatPrice } from '../../lib/config'
import { Spinner, ErrorNote, Stat } from '../ui'
import { useT } from '../../lib/i18n'

/** The shop at a glance — every number computed on-chain in one query. */
export function OverviewTab() {
  const t = useT()
  const { data, loading, error } = useQuery<ShopStats[]>(STORE_CID, M.statsView, undefined, decodeStats)
  if (loading) return <Spinner label={t.computingStats} />
  if (error) return <ErrorNote message={error} />
  const s = data?.[0]
  if (!s) return <ErrorNote message={t.statsUnavailable} />

  const open = s.ordersPlaced + s.ordersShipped

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t.statRevenue} value={`◈${formatPrice(s.revenueE8s)}`} accent />
        <Stat label={t.statToFulfil} value={open.toString()} />
        <Stat label={t.statOnHand} value={s.unitsOnHand.toString()} />
        <Stat label={t.statHeld} value={s.unitsReserved.toString()} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-ink-soft">{t.orderBook}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label={t.statPlaced} value={s.ordersPlaced.toString()} />
          <Stat label={t.statShipped} value={s.ordersShipped.toString()} />
          <Stat label={t.statDelivered} value={s.ordersDelivered.toString()} />
          <Stat label={t.statCancelled} value={s.ordersCancelled.toString()} />
          <Stat label={t.statRefunded} value={s.ordersRefunded.toString()} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-ink-soft">{t.lifetimeLedger}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t.statSold} value={s.unitsSold.toString()} />
          <Stat label={t.statReturned} value={s.unitsReturned.toString()} />
          <Stat label={t.statInvoices} value={s.invoiceCount.toString()} />
          <Stat label={t.statAuditEntries} value={s.auditEvents.toString()} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-ink-soft">{t.catalogueHeading}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t.statLive} value={s.activeProducts.toString()} />
          <Stat label={t.statTotal} value={s.products.toString()} />
          <Stat label={t.statCategories} value={s.categories.toString()} />
          <Stat label={t.statPromosActive} value={s.discountsActive.toString()} />
        </div>
      </div>
    </div>
  )
}
