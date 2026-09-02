import { useState } from 'react'
import { useQuery } from '@thebes/sdk'
import {
  STORE_CID, M, decodeDiscounts, createDiscount, setDiscountActive, type Discount,
} from '../../lib/store-api'
import { formatPrice } from '../../lib/config'
import { toE8s } from '../../lib/format'
import { Spinner, ErrorNote, Button, EmptyState } from '../ui'
import { Field, Card, inputCls, errStr } from './common'
import { useT } from '../../lib/i18n'

/** Promo codes with live redemption counters; create percent or fixed codes
 *  with an optional order minimum and redemption cap. */
export function PromosTab() {
  const t = useT()
  const { data, loading, error, refetch } = useQuery<Discount[]>(STORE_CID, M.discountsView, undefined, decodeDiscounts)

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <CreatePromoCard onChanged={refetch} />
      <section>
        <h2 className="font-display text-lg font-bold">{t.liveCodes}</h2>
        {loading ? (
          <div className="mt-4"><Spinner /></div>
        ) : error ? (
          <div className="mt-4"><ErrorNote message={error} /></div>
        ) : (data ?? []).length === 0 ? (
          <div className="mt-4">
            <EmptyState title={t.noPromosTitle} hint={t.noPromosHint} />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {(data ?? []).map((d) => (
              <PromoRow key={d.code} d={d} onChanged={refetch} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function CreatePromoCard({ onChanged }: { onChanged: () => void }) {
  const t = useT()
  const [code, setCode] = useState('')
  const [kind, setKind] = useState<'percent' | 'fixed'>('percent')
  const [value, setValue] = useState('')
  const [minSub, setMinSub] = useState('')
  const [maxRed, setMaxRed] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string>()
  const [err, setErr] = useState<string>()

  async function create() {
    setBusy(true)
    setErr(undefined)
    setNote(undefined)
    try {
      const percentBps = kind === 'percent' ? Math.round(Number(value) * 100) : 0
      const fixed = kind === 'fixed' ? toE8s(value) : 0n
      await createDiscount(
        code.trim(), percentBps, fixed,
        minSub.trim() ? toE8s(minSub) : 0n,
        Number(maxRed || '0'),
        0n,
      )
      setNote(t.codeLive(code.trim().toUpperCase()))
      setCode(''); setValue(''); setMinSub(''); setMaxRed('')
      onChanged()
    } catch (e) {
      setErr(errStr(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={t.newPromo}>
      <div className="mt-4 space-y-3">
        <Field label={t.fieldCode}>
          <input className={`${inputCls} uppercase tracking-wide`} dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="WELCOME10" autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.fieldType}>
            <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as 'percent' | 'fixed')}>
              <option value="percent">{t.percentOff}</option>
              <option value="fixed">{t.fixedOff}</option>
            </select>
          </Field>
          <Field label={kind === 'percent' ? t.fieldPercent : t.fieldAmount}>
            <input className={`${inputCls} nums`} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={kind === 'percent' ? '10' : '5.00'} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.fieldMinimum}>
            <input className={`${inputCls} nums`} inputMode="decimal" value={minSub} onChange={(e) => setMinSub(e.target.value)} placeholder="0" />
          </Field>
          <Field label={t.fieldMaxRedemptions}>
            <input className={`${inputCls} nums`} inputMode="numeric" value={maxRed} onChange={(e) => setMaxRed(e.target.value)} placeholder="0" />
          </Field>
        </div>
      </div>
      {err && <div className="mt-3"><ErrorNote message={err} /></div>}
      {note && <p className="mt-3 text-sm text-[var(--color-cobalt-ink)]">{note}</p>}
      <Button className="mt-4 w-full" onClick={create} disabled={busy || !code.trim() || !value.trim()}>
        {busy ? t.creating : t.createCode}
      </Button>
    </Card>
  )
}

function PromoRow({ d, onChanged }: { d: Discount; onChanged: () => void }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string>()

  async function toggle() {
    setBusy(true)
    setErr(undefined)
    try {
      await setDiscountActive(d.code, !d.active)
      onChanged()
    } catch (e) {
      setErr(errStr(e))
    } finally {
      setBusy(false)
    }
  }

  const worth = d.percentBps > 0n
    ? t.worthPercent((Number(d.percentBps) / 100).toString())
    : t.worthFixed(formatPrice(d.fixedE8s))

  return (
    <li className={`rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-4 ${d.active ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display font-bold tracking-wide">
            {d.code}
            {!d.active && <span className="ms-2 rounded-full bg-[var(--color-line)] px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">{t.offBadge}</span>}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft nums">
            {worth}
            {d.minSubtotalE8s > 0n && ` · ${t.minTag(formatPrice(d.minSubtotalE8s))}`}
            {' · '}
            {t.redeemed(d.redemptions, d.maxRedemptions)}
          </p>
        </div>
        <Button variant="ghost" className="px-3 py-1 text-xs" onClick={toggle} disabled={busy}>
          {d.active ? t.deactivate : t.reactivate}
        </Button>
      </div>
      {err && <div className="mt-2"><ErrorNote message={err} /></div>}
    </li>
  )
}
