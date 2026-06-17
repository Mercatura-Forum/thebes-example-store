import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@thebes/sdk'
import { STORE_CID, M, decodeCart, checkout, type CartLine } from '../lib/store-api'
import { formatPrice } from '../lib/config'
import { PriceTag, Button, Spinner, EmptyState, ErrorNote } from '../components/ui'

export function Cart() {
  const nav = useNavigate()
  const { data, loading, error, refetch } = useQuery<CartLine[]>(STORE_CID, M.cartView, undefined, decodeCart)
  const [placing, setPlacing] = useState(false)
  const [placeErr, setPlaceErr] = useState<string>()
  const [orderId, setOrderId] = useState<bigint>()

  if (loading) return <Spinner label="Loading cart" />
  if (error) return <ErrorNote message={error} />
  const lines = data ?? []

  if (orderId !== undefined) {
    return (
      <EmptyState
        title={`Order #${orderId.toString()} placed`}
        hint="Stock was reserved and your order is on its way. Track it in Orders."
        action={<Button onClick={() => nav('/orders')}>View orders</Button>}
      />
    )
  }
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

  async function placeOrder() {
    setPlacing(true)
    setPlaceErr(undefined)
    try {
      setOrderId(await checkout())
    } catch (e) {
      setPlaceErr(e instanceof Error ? e.message : String(e))
      refetch() // stock may have changed under us
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Cart</h1>
      <ul className="mt-5 divide-y divide-[var(--color-line)] rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface">
        {lines.map((l) => (
          <li key={l.productId.toString()} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-ink line-clamp-1">{l.name}</p>
              <p className="text-xs text-ink-soft nums">
                {l.quantity.toString()} × ◈{formatPrice(l.priceE8s)}
              </p>
            </div>
            <span className="font-display font-semibold nums">◈{formatPrice(l.priceE8s * l.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm text-ink-soft">Total</span>
        <PriceTag e8s={total} size="lg" />
      </div>

      {placeErr && <div className="mt-4"><ErrorNote message={placeErr} /></div>}

      <div className="mt-6 flex justify-end gap-3">
        <Link to="/"><Button variant="ghost">Keep shopping</Button></Link>
        <Button onClick={placeOrder} disabled={placing}>{placing ? 'Placing order…' : 'Checkout'}</Button>
      </div>
    </div>
  )
}
