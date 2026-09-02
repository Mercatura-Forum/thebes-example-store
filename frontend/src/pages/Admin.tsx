import { useState } from 'react'
import { useQuery, decodeBool } from '@thebes/sdk'
import { STORE_CID, claimOwner, seedDemo } from '../lib/store-api'
import { Button, Spinner, ErrorNote } from '../components/ui'
import { Card, errStr } from '../components/admin/common'
import { OverviewTab } from '../components/admin/OverviewTab'
import { OrdersTab } from '../components/admin/OrdersTab'
import { CatalogueTab } from '../components/admin/CatalogueTab'
import { PromosTab } from '../components/admin/PromosTab'
import { LedgerTab } from '../components/admin/LedgerTab'
import { useT, type Messages } from '../lib/i18n'

const TAB_KEYS = ['overview', 'orders', 'catalogue', 'promos', 'ledger'] as const
type TabKey = (typeof TAB_KEYS)[number]

const TAB_LABELS: Record<TabKey, (t: Messages) => string> = {
  overview: (t) => t.tabOverview,
  orders: (t) => t.tabOrders,
  catalogue: (t) => t.tabCatalogue,
  promos: (t) => t.tabPromos,
  ledger: (t) => t.tabLedger,
}

/** The back office. Owner-gated: an unclaimed shop shows the claim card; once
 *  the caller is an admin, the five desks open — stats, fulfilment, catalogue,
 *  promos, and the open books. */
export function Admin() {
  const t = useT()
  const { data: isAdmin, loading, refetch } = useQuery<boolean>(
    STORE_CID, 'amAdmin', undefined, (hex) => decodeBool(hex),
  )
  const [tab, setTab] = useState<TabKey>('overview')

  if (loading) return <Spinner label={t.checkingKeys} />

  if (!isAdmin) return <ClaimCard onClaimed={refetch} />

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] pb-3" role="tablist" aria-label={t.adminSections}>
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === key
                ? 'bg-[var(--color-cobalt)]/10 text-[var(--color-cobalt-ink)]'
                : 'text-ink-soft hover:text-ink'
            }`}
            onClick={() => setTab(key)}
          >
            {TAB_LABELS[key](t)}
          </button>
        ))}
      </div>
      <div className="pt-6">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'orders' && <OrdersTab />}
        {tab === 'catalogue' && <CatalogueTab />}
        {tab === 'promos' && <PromosTab />}
        {tab === 'ledger' && <LedgerTab />}
      </div>
    </div>
  )
}

function ClaimCard({ onClaimed }: { onClaimed: () => void }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [note, setNote] = useState<string>()
  const [err, setErr] = useState<string>()

  async function claim() {
    setBusy(true)
    setErr(undefined)
    try {
      await claimOwner()
      setNote(t.ownershipClaimed)
      onClaimed()
    } catch (e) {
      setErr(errStr(e))
    } finally {
      setBusy(false)
    }
  }

  async function seed() {
    setSeeding(true)
    setErr(undefined)
    try {
      await seedDemo()
      setNote(t.demoLoaded)
    } catch (e) {
      setErr(errStr(e))
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card title={t.shopOwner}>
        <p className="mt-1 text-sm text-ink-soft">
          {t.claimExplainer}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={claim} disabled={busy}>{busy ? t.claiming : t.claimOwnership}</Button>
          <Button variant="ghost" onClick={seed} disabled={seeding}>{seeding ? t.loadingSimple : t.loadDemoShop}</Button>
        </div>
        {note && <p className="mt-3 text-sm text-[var(--color-cobalt-ink)]">{note}</p>}
        {err && <div className="mt-3"><ErrorNote message={err} /></div>}
      </Card>
    </div>
  )
}
