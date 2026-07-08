import { useMemo, useState } from 'react'
import { useQuery } from '@thebes/sdk'
import {
  STORE_CID, M, decodeAdminProducts, decodeViolations, decodeAudit, argPage,
  type AdminProduct, type InvariantViolation, type AuditRow,
} from '../../lib/store-api'
import { whenExact, shortHex } from '../../lib/format'
import { Spinner, ErrorNote, Button } from '../ui'

/** The open books: the per-product conservation ledger, the recomputed
 *  invariant report, and the append-only audit trail behind them. */
export function LedgerTab() {
  const { data: products, loading, error } = useQuery<AdminProduct[]>(STORE_CID, M.adminProductsView, undefined, decodeAdminProducts)
  const { data: violations } = useQuery<InvariantViolation[]>(STORE_CID, M.invariantsView, undefined, decodeViolations)

  if (loading) return <Spinner label="Opening the books" />
  if (error) return <ErrorNote message={error} />
  const rows = products ?? []
  const bad = violations ?? []
  const badFor = (id: bigint) => bad.filter((v) => v.productId === id)

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">Inventory ledger</h2>
          <span className={`text-sm font-medium ${bad.length === 0 ? 'text-[var(--color-leaf)]' : 'text-[var(--color-sold)]'}`}>
            {bad.length === 0 ? '✓ every invariant holds' : `${bad.length} violation${bad.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          For every product: on hand + sold = received + returned, and the reserve
          counter must match active checkout holds. Recomputed on-chain each read.
        </p>
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-line)]">
          <table className="w-full min-w-[560px] bg-surface text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 text-right font-medium">Received</th>
                <th className="px-3 py-2 text-right font-medium">Sold</th>
                <th className="px-3 py-2 text-right font-medium">Returned</th>
                <th className="px-3 py-2 text-right font-medium">On hand</th>
                <th className="px-3 py-2 text-right font-medium">Held</th>
                <th className="px-3 py-2 text-center font-medium">Books</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const pv = badFor(p.id)
                return (
                  <tr key={p.id.toString()} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-medium text-ink">{p.name}</span>
                      {p.archived && <span className="ml-1.5 text-[10px] uppercase text-ink-soft">archived</span>}
                    </td>
                    <td className="px-3 py-2 text-right nums">{p.received.toString()}</td>
                    <td className="px-3 py-2 text-right nums">{p.sold.toString()}</td>
                    <td className="px-3 py-2 text-right nums">{p.returned.toString()}</td>
                    <td className="px-3 py-2 text-right nums">{p.onHand.toString()}</td>
                    <td className="px-3 py-2 text-right nums">{p.reserved.toString()}</td>
                    <td className="px-3 py-2 text-center" title={pv.map((v) => v.rule).join(', ') || 'balanced'}>
                      {pv.length === 0
                        ? <span className="text-[var(--color-leaf)]">✓</span>
                        : <span className="font-medium text-[var(--color-sold)]">✗ {pv.map((v) => v.rule).join(', ')}</span>}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-soft">No products on the books yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AuditFeed />
    </div>
  )
}

const PAGE = 25

function AuditFeed() {
  const [offset, setOffset] = useState(0)
  const arg = useMemo(() => argPage(offset, PAGE), [offset])
  const { data, loading, error } = useQuery<AuditRow[]>(STORE_CID, M.auditView, arg, decodeAudit, [offset])

  return (
    <section>
      <h2 className="font-display text-lg font-bold">Audit trail</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Append-only. Every state change lands here with its actor — buyers see
        their order's slice of this same log.
      </p>
      {loading ? (
        <div className="mt-4"><Spinner /></div>
      ) : error ? (
        <div className="mt-4"><ErrorNote message={error} /></div>
      ) : (
        <>
          <ol className="mt-4 divide-y divide-[var(--color-line)] rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface">
            {(data ?? []).map((e) => (
              <li key={e.id.toString()} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 text-xs">
                <span className="w-28 shrink-0 text-ink-soft nums">{whenExact(e.at)}</span>
                <code className="rounded bg-[var(--color-paper)] px-1.5 py-0.5 font-medium text-[var(--color-cobalt-ink)]">{e.kind}</code>
                <span className="text-ink">{e.detail}</span>
                {e.orderId > 0n && <span className="text-ink-soft nums">order #{e.orderId.toString()}</span>}
                {e.productId > 0n && <span className="text-ink-soft nums">product #{e.productId.toString()}</span>}
                <span className="ml-auto text-ink-soft/70 nums" title={e.who}>{shortHex(e.who)}</span>
              </li>
            ))}
            {(data ?? []).length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-soft">Nothing here yet at this page.</li>
            )}
          </ol>
          <div className="mt-3 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setOffset(Math.max(0, offset - PAGE))} disabled={offset === 0}>← Newer</Button>
            <Button variant="ghost" onClick={() => setOffset(offset + PAGE)} disabled={(data ?? []).length < PAGE}>Older →</Button>
          </div>
        </>
      )}
    </section>
  )
}
