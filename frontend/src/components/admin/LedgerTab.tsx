import { useMemo, useState } from 'react'
import { useQuery } from '@thebes/sdk'
import {
  STORE_CID, M, decodeAdminProducts, decodeViolations, decodeAudit, argPage,
  type AdminProduct, type InvariantViolation, type AuditRow,
} from '../../lib/store-api'
import { whenExact, shortHex, useChainTime } from '../../lib/format'
import { Spinner, ErrorNote, Button } from '../ui'
import { useT } from '../../lib/i18n'

/** The open books: the per-product conservation ledger, the recomputed
 *  invariant report, and the append-only audit trail behind them. */
export function LedgerTab() {
  const t = useT()
  const { data: products, loading, error } = useQuery<AdminProduct[]>(STORE_CID, M.adminProductsView, undefined, decodeAdminProducts)
  const { data: violations } = useQuery<InvariantViolation[]>(STORE_CID, M.invariantsView, undefined, decodeViolations)

  if (loading) return <Spinner label={t.openingBooks} />
  if (error) return <ErrorNote message={error} />
  const rows = products ?? []
  const bad = violations ?? []
  const badFor = (id: bigint) => bad.filter((v) => v.productId === id)

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold">{t.inventoryLedger}</h2>
          <span className={`text-sm font-medium ${bad.length === 0 ? 'text-[var(--color-leaf)]' : 'text-[var(--color-sold)]'}`}>
            {bad.length === 0 ? t.invariantsHold : t.violationCount(bad.length)}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          {t.ledgerExplainer}
        </p>
        <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-line)]">
          <table className="w-full min-w-[560px] bg-surface text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-start text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-2 text-start font-medium">{t.thProduct}</th>
                <th className="px-3 py-2 text-end font-medium">{t.thReceived}</th>
                <th className="px-3 py-2 text-end font-medium">{t.thSold}</th>
                <th className="px-3 py-2 text-end font-medium">{t.thReturned}</th>
                <th className="px-3 py-2 text-end font-medium">{t.thOnHand}</th>
                <th className="px-3 py-2 text-end font-medium">{t.thHeld}</th>
                <th className="px-3 py-2 text-center font-medium">{t.thBooks}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const pv = badFor(p.id)
                return (
                  <tr key={p.id.toString()} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-medium text-ink">{p.name}</span>
                      {p.archived && <span className="ms-1.5 text-[10px] uppercase text-ink-soft">{t.archived}</span>}
                    </td>
                    <td className="px-3 py-2 text-end nums">{p.received.toString()}</td>
                    <td className="px-3 py-2 text-end nums">{p.sold.toString()}</td>
                    <td className="px-3 py-2 text-end nums">{p.returned.toString()}</td>
                    <td className="px-3 py-2 text-end nums">{p.onHand.toString()}</td>
                    <td className="px-3 py-2 text-end nums">{p.reserved.toString()}</td>
                    <td className="px-3 py-2 text-center" title={pv.map((v) => v.rule).join(', ') || t.balanced}>
                      {pv.length === 0
                        ? <span className="text-[var(--color-leaf)]">✓</span>
                        : <span className="font-medium text-[var(--color-sold)]">✗ {pv.map((v) => v.rule).join(', ')}</span>}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-soft">{t.noProductsOnBooks}</td></tr>
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
  const t = useT()
  const [offset, setOffset] = useState(0)
  useChainTime() // re-render once chain→wall calibration lands
  const arg = useMemo(() => argPage(offset, PAGE), [offset])
  const { data, loading, error } = useQuery<AuditRow[]>(STORE_CID, M.auditView, arg, decodeAudit, [offset])

  return (
    <section>
      <h2 className="font-display text-lg font-bold">{t.auditTrail}</h2>
      <p className="mt-1 text-xs text-ink-soft">
        {t.auditExplainer}
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
                {e.orderId > 0n && <span className="text-ink-soft nums">{t.auditOrderRef(e.orderId)}</span>}
                {e.productId > 0n && <span className="text-ink-soft nums">{t.auditProductRef(e.productId)}</span>}
                <span className="ms-auto text-ink-soft/70 nums" title={e.who}>{shortHex(e.who)}</span>
              </li>
            ))}
            {(data ?? []).length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-soft">{t.nothingAtPage}</li>
            )}
          </ol>
          <div className="mt-3 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setOffset(Math.max(0, offset - PAGE))} disabled={offset === 0}>{t.newer}</Button>
            <Button variant="ghost" onClick={() => setOffset(offset + PAGE)} disabled={(data ?? []).length < PAGE}>{t.older}</Button>
          </div>
        </>
      )}
    </section>
  )
}
