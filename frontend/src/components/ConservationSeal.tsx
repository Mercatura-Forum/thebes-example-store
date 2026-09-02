import { useEffect, useState } from 'react'
import { useQuery } from '@thebes/sdk'
import { STORE_CID, M, decodeConservation, decodeViolations, type Conservation, type InvariantViolation } from '../lib/store-api'
import { calibrateChainTime } from '../lib/format'
import { useT } from '../lib/i18n'

/**
 * The shop's public audit line. It calls the backend's conservation oracle —
 * which RECOMPUTES the inventory invariants from scratch on-chain — and shows
 * the verdict. Anyone can click through to the rule-by-rule report. This is
 * the example's thesis made visible: the books are open, and they balance.
 */
export function ConservationSeal() {
  const t = useT()
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
      <button className="seal nums" data-ok={ok} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="seal-dot" aria-hidden />
        {ok ? (
          <span>
            {t.sealOk(seal.productsChecked, seal.unitsOnHand)}
            {seal.unitsReserved > 0n && t.sealHeld(seal.unitsReserved)}
            {t.sealAudited}
          </span>
        ) : (
          <span>{t.sealBad(seal.violations)}</span>
        )}
        <span aria-hidden className="text-ink-soft/60">{open ? '▴' : '▾'}</span>
      </button>
      {open && <SealReport ok={ok} />}
    </div>
  )
}

function SealReport({ ok }: { ok: boolean }) {
  const t = useT()
  const { data, loading } = useQuery<InvariantViolation[]>(STORE_CID, M.invariantsView, undefined, decodeViolations)
  return (
    <div className="w-full max-w-xl rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-4 text-xs text-ink-soft">
      <p className="font-medium text-ink">{t.sealReportTitle}</p>
      <ul className="mt-2 space-y-1">
        <li><code className="text-[var(--color-cobalt-ink)]">conservation</code> — {t.ruleConservation}</li>
        <li><code className="text-[var(--color-cobalt-ink)]">reserve-match</code> — {t.ruleReserveMatch}</li>
        <li><code className="text-[var(--color-cobalt-ink)]">reserve-bound</code> — {t.ruleReserveBound}</li>
      </ul>
      <p className="mt-3">
        {loading ? t.rerunningAudit : ok ? t.reportEmpty : t.reportViolations}
      </p>
      {(data ?? []).length > 0 && (
        <ul className="mt-2 space-y-1 font-mono">
          {(data ?? []).map((v, i) => (
            <li key={i} className="text-[var(--color-sold)]">
              #{v.productId.toString()} {v.name}: {v.rule} {t.expectedGot(v.expected, v.actual)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
