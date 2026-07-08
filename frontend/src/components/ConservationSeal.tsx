import { useEffect, useState } from 'react'
import { useQuery } from '@thebes/sdk'
import { STORE_CID, M, decodeConservation, decodeViolations, type Conservation, type InvariantViolation } from '../lib/store-api'
import { calibrateChainTime } from '../lib/format'

/**
 * The shop's public audit line. It calls the backend's conservation oracle —
 * which RECOMPUTES the inventory invariants from scratch on-chain — and shows
 * the verdict. Anyone can click through to the rule-by-rule report. This is
 * the example's thesis made visible: the books are open, and they balance.
 */
export function ConservationSeal() {
  const [open, setOpen] = useState(false)
  const { data } = useQuery<Conservation[]>(STORE_CID, M.conservationView, undefined, decodeConservation)
  const seal = data?.[0]

  // The audit reply carries the chain's "now" — calibrate chain→wall time for
  // every date the app renders (chain time counts from genesis, not 1970).
  useEffect(() => {
    if (seal) calibrateChainTime(seal.checkedAt)
  }, [seal])

  if (!seal) return null
  const ok = seal.violations === 0n

  return (
    <div className="flex flex-col items-start gap-3">
      <button className="seal" data-ok={ok} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="seal-dot" aria-hidden />
        {ok ? (
          <span>
            The books balance — {seal.productsChecked.toString()} products,{' '}
            <span className="nums">{seal.unitsOnHand.toString()}</span> units on hand
            {seal.unitsReserved > 0n && (
              <>, <span className="nums">{seal.unitsReserved.toString()}</span> held at checkout</>
            )}{' '}
            · audited on-chain
          </span>
        ) : (
          <span>
            Audit found {seal.violations.toString()} violation{seal.violations === 1n ? '' : 's'} — open the report
          </span>
        )}
        <span aria-hidden className="text-ink-soft/60">{open ? '▴' : '▾'}</span>
      </button>
      {open && <SealReport ok={ok} />}
    </div>
  )
}

function SealReport({ ok }: { ok: boolean }) {
  const { data, loading } = useQuery<InvariantViolation[]>(STORE_CID, M.invariantsView, undefined, decodeViolations)
  return (
    <div className="w-full max-w-xl rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-4 text-xs text-ink-soft">
      <p className="font-medium text-ink">What the on-chain audit checks, for every product</p>
      <ul className="mt-2 space-y-1">
        <li><code className="text-[var(--color-cobalt-ink)]">conservation</code> — units on hand + units sold = units received + units returned</li>
        <li><code className="text-[var(--color-cobalt-ink)]">reserve-match</code> — the reserve counter equals the sum of active checkout holds</li>
        <li><code className="text-[var(--color-cobalt-ink)]">reserve-bound</code> — reserved stock never exceeds stock on hand</li>
      </ul>
      <p className="mt-3">
        {loading ? 'Re-running the audit…' : ok
          ? 'The report is empty — every invariant holds right now. Call invariantReportView on the contract to reproduce this yourself.'
          : 'Violations below (this should never happen — it means a bug in the shop, and the audit caught it):'}
      </p>
      {(data ?? []).length > 0 && (
        <ul className="mt-2 space-y-1 font-mono">
          {(data ?? []).map((v, i) => (
            <li key={i} className="text-[var(--color-sold)]">
              #{v.productId.toString()} {v.name}: {v.rule} expected {v.expected.toString()} got {v.actual.toString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
