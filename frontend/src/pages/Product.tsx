import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useUpdate } from '@thebes/sdk'
import { STORE_CID, M, decodeProducts, addToCart, type Product } from '../lib/store-api'
import { MediaImage } from '../components/MediaImage'
import { PriceTag, Button, Spinner, ErrorNote, EmptyState } from '../components/ui'

export function ProductPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data, loading, error } = useQuery<Product[]>(STORE_CID, M.productsView, undefined, decodeProducts)
  const { pending, error: writeErr } = useUpdate()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner label="Loading product" />
  if (error) return <ErrorNote message={error} />
  const product = (data ?? []).find((p) => p.id.toString() === id)
  if (!product) {
    return <EmptyState title="Product not found" hint="It may have been removed." action={<Link to="/"><Button>Back to shop</Button></Link>} />
  }
  const out = product.stockCount === 0n
  const max = Number(product.stockCount)

  async function add() {
    if (!product) return
    setBusy(true)
    setAdded(false)
    try {
      await addToCart(product.id, qty)
      setAdded(true)
    } catch {
      /* surfaced via writeErr */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)]">
        <MediaImage path={product.photoPath} alt={product.name} ratio="1 / 1" />
      </div>

      <div className="flex flex-col">
        <Link to="/" className="text-sm text-[var(--color-cobalt)] hover:underline">← Back to shop</Link>
        <h1 className="font-display mt-3 text-3xl font-extrabold leading-tight text-ink">{product.name}</h1>
        <div className="mt-3"><PriceTag e8s={product.priceE8s} size="lg" /></div>
        <p className="mt-4 max-w-prose leading-relaxed text-ink-soft">{product.description}</p>

        <p className="mt-4 text-sm text-ink-soft nums">
          {out ? 'Out of stock' : `${product.stockCount.toString()} in stock`}
        </p>

        <div className="mt-6 flex items-center gap-3">
          <div className="inline-flex items-center rounded-lg ring-1 ring-[var(--color-line)]">
            <button
              className="px-3 py-2 text-lg leading-none disabled:opacity-40"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={out || qty <= 1}
              aria-label="Decrease quantity"
            >−</button>
            <span className="w-10 text-center nums" aria-live="polite">{qty}</span>
            <button
              className="px-3 py-2 text-lg leading-none disabled:opacity-40"
              onClick={() => setQty((q) => Math.min(max || 1, q + 1))}
              disabled={out || qty >= max}
              aria-label="Increase quantity"
            >+</button>
          </div>
          <Button onClick={add} disabled={out || busy || pending}>
            {busy ? 'Adding…' : 'Add to cart'}
          </Button>
        </div>

        {added && (
          <p className="mt-3 text-sm text-[var(--color-cobalt-ink)]">
            Added. <button className="underline" onClick={() => nav('/cart')}>Go to cart</button>
          </p>
        )}
        {writeErr && <div className="mt-3"><ErrorNote message={writeErr} /></div>}
      </div>
    </div>
  )
}
