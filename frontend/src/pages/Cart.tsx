import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@thebes/sdk'
import {
  STORE_CID, M, decodeCart, setCartQuantity, removeFromCart, beginCheckout, type CartLine,
} from '../lib/store-api'
import { formatPrice } from '../lib/config'
import { pokeCart } from '../lib/format'
import { MediaImage } from '../components/MediaImage'
import { PriceTag, Button, Spinner, EmptyState, ErrorNote, QtyStepper } from '../components/ui'

/** The cart is editable in place; "Review order" takes a checkout hold (stock
 *  set aside on-chain for ten minutes) and moves to the review step. */
export function Cart() {
  const nav = useNavigate()
  const { data, loading, error, refetch } = useQuery<CartLine[]>(STORE_CID, M.cartView, undefined, decodeCart)
  const [busyLine, setBusyLine] = useState<bigint>()
  const [reserving, setReserving] = useState(false)
  const [err, setErr] = useState<string>()

  if (loading) return <Spinner label="Loading cart" />
  if (error) return <ErrorNote message={error} />
  const lines = data ?? []

  if (lines.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        hint="Browse the shelf and add something you like."
        action={<Link to="/"><Button>Browse the shop</Button></Link>}
      />
    )
  }

  const total = lines.reduce((acc, l) => acc + l.priceE8s * l.quantity, 0n)

  async function changeQty(l: CartLine, next: number) {
    setBusyLine(l.productId)
    setErr(undefined)
    try {
      await setCartQuantity(l.productId, next)
      pokeCart()
      refetch()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      refetch()
    } finally {
      setBusyLine(undefined)
    }
  }

  async function removeLine(l: CartLine) {
    setBusyLine(l.productId)
    setErr(undefined)
    try {
      await removeFromCart(l.productId)
      pokeCart()
      refetch()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyLine(undefined)
    }
  }

  async function review() {
    setReserving(true)
    setErr(undefined)
    try {
      await beginCheckout()
      nav('/checkout')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      refetch() // availability may have moved under us
    } finally {
      setReserving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Cart</h1>
      <ul className="mt-5 divide-y divide-[var(--color-line)] rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface">
        {lines.map((l) => (
          <li key={l.productId.toString()} className="flex items-center gap-3 px-4 py-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
              <MediaImage path={l.photoPath} alt={l.name} ratio="1 / 1" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink line-clamp-1">{l.name}</p>
              <p className="text-xs text-ink-soft nums">
                ◈{formatPrice(l.priceE8s)} each · {l.available.toString()} available
              </p>
            </div>
            <QtyStepper
              value={Number(l.quantity)}
              max={Number(l.available)}
              onChange={(n) => changeQty(l, n)}
              disabled={busyLine === l.productId}
              label={l.name}
            />
            <span className="w-24 text-right font-display font-semibold nums">◈{formatPrice(l.priceE8s * l.quantity)}</span>
            <button
              className="rounded-lg p-1.5 text-ink-soft transition hover:text-[var(--color-sold)]"
              onClick={() => removeLine(l)}
              disabled={busyLine === l.productId}
              aria-label={`Remove ${l.name} from cart`}
              title="Remove"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm text-ink-soft">Total</span>
        <PriceTag e8s={total} size="lg" />
      </div>

      {err && <div className="mt-4"><ErrorNote message={err} /></div>}

      <div className="mt-6 flex items-center justify-end gap-3">
        <Link to="/"><Button variant="ghost">Keep shopping</Button></Link>
        <Button onClick={review} disabled={reserving || busyLine !== undefined}>
          {reserving ? 'Setting stock aside…' : 'Review order'}
        </Button>
      </div>
      <p className="mt-3 text-right text-xs text-ink-soft">
        Reviewing holds your items on-chain for 10 minutes, so nobody can buy them out from under you.
      </p>
    </div>
  )
}
