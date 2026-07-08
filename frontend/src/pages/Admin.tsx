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

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'orders', label: 'Orders' },
  { key: 'catalogue', label: 'Catalogue' },
  { key: 'promos', label: 'Promos' },
  { key: 'ledger', label: 'Ledger' },
] as const
type TabKey = (typeof TABS)[number]['key']

/** The back office. Owner-gated: an unclaimed shop shows the claim card; once
 *  the caller is an admin, the five desks open — stats, fulfilment, catalogue,
 *  promos, and the open books. */
export function Admin() {
  const { data: isAdmin, loading, refetch } = useQuery<boolean>(
    STORE_CID, 'amAdmin', undefined, (hex) => decodeBool(hex),
  )
  const [tab, setTab] = useState<TabKey>('overview')

  if (loading) return <Spinner label="Checking your keys" />

  if (!isAdmin) return <ClaimCard onClaimed={refetch} />

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-line)] pb-3" role="tablist" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? 'bg-[var(--color-cobalt)]/10 text-[var(--color-cobalt-ink)]'
                : 'text-ink-soft hover:text-ink'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
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
  const [busy, setBusy] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [note, setNote] = useState<string>()
  const [err, setErr] = useState<string>()

  async function claim() {
    setBusy(true)
    setErr(undefined)
    try {
      await claimOwner()
      setNote('Ownership claimed — opening the back office…')
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
      setNote('Demo shop loaded. Claim ownership to manage it.')
    } catch (e) {
      setErr(errStr(e))
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card title="Shop owner">
        <p className="mt-1 text-sm text-ink-soft">
          This shop is claimed by its first caller. After that, only the owner and
          their admins can manage the catalogue, promos and orders — everyone else
          just shops.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={claim} disabled={busy}>{busy ? 'Claiming…' : 'Claim ownership'}</Button>
          <Button variant="ghost" onClick={seed} disabled={seeding}>{seeding ? 'Loading…' : 'Load demo shop'}</Button>
        </div>
        {note && <p className="mt-3 text-sm text-[var(--color-cobalt-ink)]">{note}</p>}
        {err && <div className="mt-3"><ErrorNote message={err} /></div>}
      </Card>
    </div>
  )
}
