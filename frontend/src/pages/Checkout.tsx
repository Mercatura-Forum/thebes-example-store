import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@thebes/sdk'
import {
  STORE_CID, M, decodeHold, decodeHoldLines, decodeQuote, checkout, cancelCheckout,
  argText, type Hold, type HoldLine, type Quote,
} from '../lib/store-api'
import { formatPrice } from '../lib/config'
import { pokeCart, calibrateChainTime } from '../lib/format'
import { MediaImage } from '../components/MediaImage'
import { PriceTag, Button, Spinner, EmptyState, ErrorNote, HoldRing } from '../components/ui'

const HOLD_SECONDS = 10 * 60

/** The review step: your items are set aside on-chain (the hold), a promo code
 *  prices against the same math checkout will use, and one click places the
 *  order atomically. The ring is honest — it counts chain time down to when
 *  the shop releases your hold back to the shelf. */
export function Checkout() {
  const nav = useNavigate()
  const { data: holds, loading: holdLoading } = useQuery<Hold[]>(STORE_CID, M.holdView, undefined, decodeHold)
  const { data: lines, loading: linesLoading } = useQuery<HoldLine[]>(STORE_CID, M.holdLinesView, undefined, decodeHoldLines)

  const [codeInput, setCodeInput] = useState('')
  const [appliedCode, setAppliedCode] = useState('')
  const quoteArg = useMemo(() => argText(appliedCode), [appliedCode])
  const { data: quotes } = useQuery<Quote[]>(STORE_CID, M.quoteView, quoteArg, decodeQuote, [appliedCode])

  const [placing, setPlacing] = useState(false)
  const [err, setErr] = useState<string>()
  const [orderId, setOrderId] = useState<bigint>()

  // Countdown anchored to CHAIN time: expiresAt − nowNs is the true remaining
  // window regardless of the client clock; we tick it down locally.
  const hold = holds?.[0]
  const [secondsLeft, setSecondsLeft] = useState<number>()
  useEffect(() => {
    if (!hold) return
    calibrateChainTime(hold.nowNs)
    const leftAtLoad = Number((hold.expiresAt - hold.nowNs) / 1_000_000_000n)
    const loadedAt = Date.now()
    const tick = () => {
      const left = leftAtLoad - Math.floor((Date.now() - loadedAt) / 1000)
      setSecondsLeft(Math.max(0, left))
    }
    tick()
    const t = window.setInterval(tick, 1000)
    return () => window.clearInterval(t)
  }, [hold])

  if (orderId !== undefined) {
    return (
      <EmptyState
        title={`Order #${orderId.toString()} placed`}
        hint="Stock moved from the shelf to your order in one atomic step. Track it in Orders."
        action={<Button onClick={() => nav('/orders')}>View orders</Button>}
      />
    )
  }

  if (holdLoading || linesLoading) return <Spinner label="Loading your hold" />

  if (!hold || (secondsLeft !== undefined && secondsLeft === 0)) {
    return (
      <EmptyState
        title={hold ? 'Your hold expired' : 'No active hold'}
        hint="The stock went back on the shelf for other shoppers. Your cart is untouched — review it again to take a fresh hold."
        action={<Link to="/cart"><Button>Back to cart</Button></Link>}
      />
    )
  }

  const quote = quotes?.[0]
  const holdLines = lines ?? []
  const mm = Math.floor((secondsLeft ?? 0) / 60)
  const ss = (secondsLeft ?? 0) % 60

  async function place() {
    setPlacing(true)
    setErr(undefined)
    try {
      const id = await checkout(appliedCode)
      pokeCart()
      setOrderId(id)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setPlacing(false)
    }
  }

  async function abandon() {
    try { await cancelCheckout() } catch { /* the hold expires on its own */ }
    nav('/cart')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Review order</h1>
        <HoldRing
          fraction={(secondsLeft ?? 0) / HOLD_SECONDS}
          label={`${mm}:${ss.toString().padStart(2, '0')}`}
        />
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        These items are set aside for you on-chain until the timer runs out.
      </p>

      <ul className="mt-5 divide-y divide-[var(--color-line)] rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface">
        {holdLines.map((l) => (
          <li key={l.productId.toString()} className="flex items-center gap-3 px-4 py-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              <MediaImage path={l.photoPath} alt={l.name} ratio="1 / 1" artId={l.productId} artName={l.name} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink line-clamp-1">{l.name}</p>
              <p className="text-xs text-ink-soft nums">{l.quantity.toString()} × ◈{formatPrice(l.unitPriceE8s)}</p>
            </div>
            <span className="font-display font-semibold nums">◈{formatPrice(l.unitPriceE8s * l.quantity)}</span>
          </li>
        ))}
      </ul>

      {/* Promo code: quoted by the SAME on-chain validation checkout runs. */}
      <div className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-4">
        <label className="block text-sm font-medium" htmlFor="promo">Promo code</label>
        <div className="mt-2 flex gap-2">
          <input
            id="promo"
            className="w-full rounded-lg border border-[var(--color-line)] bg-paper px-3 py-2 text-sm uppercase tracking-wide text-ink outline-none focus:border-[var(--color-cobalt)]"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="WELCOME10"
            autoComplete="off"
          />
          <Button variant="ghost" onClick={() => setAppliedCode(codeInput.trim())} disabled={!codeInput.trim()}>
            Apply
          </Button>
          {appliedCode && (
            <Button variant="ghost" onClick={() => { setAppliedCode(''); setCodeInput('') }}>
              Clear
            </Button>
          )}
        </div>
        {quote && appliedCode && (
          quote.codeOk ? (
            <p className="mt-2 text-sm text-[var(--color-leaf)]">
              {appliedCode.toUpperCase()} applied — you save ◈{formatPrice(quote.discountE8s)}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--color-sold)]">{quote.note || 'That code did not apply.'}</p>
          )
        )}
      </div>

      {/* Totals from the on-chain quote — the numbers checkout will charge. */}
      <div className="mt-5 space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">Subtotal</span>
          <span className="nums">◈{formatPrice(quote?.subtotalE8s ?? hold.subtotalE8s)}</span>
        </div>
        {quote && quote.discountE8s > 0n && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">Promo {appliedCode.toUpperCase()}</span>
            <span className="nums text-[var(--color-leaf)]">−◈{formatPrice(quote.discountE8s)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-2">
          <span className="text-sm text-ink-soft">Total</span>
          <PriceTag e8s={quote?.totalE8s ?? hold.subtotalE8s} size="lg" />
        </div>
      </div>

      {err && <div className="mt-4"><ErrorNote message={err} /></div>}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={abandon}>Release hold</Button>
        <Button onClick={place} disabled={placing || (appliedCode !== '' && quote !== undefined && !quote.codeOk)}>
          {placing ? 'Placing order…' : 'Place order'}
        </Button>
      </div>
    </div>
  )
}
