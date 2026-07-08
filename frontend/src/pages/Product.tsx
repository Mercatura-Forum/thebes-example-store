import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useUpdate } from '@thebes/sdk'
import { STORE_CID, M, decodeProducts, addToCart, type Product } from '../lib/store-api'
import { pokeCart } from '../lib/format'
import { MediaImage } from '../components/MediaImage'
import { PriceTag, Button, Spinner, ErrorNote, EmptyState, QtyStepper } from '../components/ui'

export function ProductPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { data, loading, error, refetch } = useQuery<Product[]>(STORE_CID, M.productsView, undefined, decodeProducts)
  const { pending, error: writeErr } = useUpdate()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [addErr, setAddErr] = useState<string>()

  // Product-to-product navigation is a same-document hash change, so this
  // component instance survives it — reset the purchase state per product.
  // (Caught live: qty carried from one product to the next and over-ordered.)
  useEffect(() => {
    setQty(1)
    setAdded(false)
    setAddErr(undefined)
  }, [id])

  if (loading) return <Spinner label="Loading product" />
  if (error) return <ErrorNote message={error} />
  const product = (data ?? []).find((p) => p.id.toString() === id)
  if (!product) {
    return <EmptyState title="Product not found" hint="It may have been removed." action={<Link to="/"><Button>Back to the souk</Button></Link>} />
  }
  const out = product.available === 0n
  const max = Number(product.available)

  async function add() {
    if (!product) return
    setBusy(true)
    setAdded(false)
    setAddErr(undefined)
    try {
      await addToCart(product.id, qty)
      setAdded(true)
      pokeCart()
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : String(e))
      refetch() // availability may have moved under us
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-10 md:grid-cols-[5fr_6fr]">
      <div className="arch relative mx-auto w-full max-w-md self-start">
        <span className="arch-inner" />
        <MediaImage path={product.photoPath} alt={product.name} ratio="1 / 1.1" artId={product.id} artName={product.name} />
      </div>

      <div className="flex flex-col">
        <Link to="/" className="text-sm text-[var(--color-cobalt)] hover:underline">← Back to the souk</Link>
        {product.categoryName && (
          <p className="mt-4 text-xs uppercase tracking-[0.24em] text-[var(--color-gold)]">{product.categoryName}</p>
        )}
        <h1 className="font-display mt-1 text-4xl font-extrabold leading-tight text-ink" style={{ textWrap: 'balance' }}>
          {product.name}
        </h1>
        <div className="mt-4"><PriceTag e8s={product.priceE8s} size="lg" /></div>
        <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-soft">{product.description}</p>

        <p className="mt-4 text-sm text-ink-soft nums">
          {out
            ? (product.reserved > 0n ? 'None available — all held in other checkouts' : 'Out of stock')
            : `${product.available.toString()} available`}
          {!out && product.reserved > 0n && (
            <span className="text-[var(--color-gold)]"> · {product.reserved.toString()} held in other carts</span>
          )}
        </p>

        {/* Provenance, shopper-facing: this product's shelf accounting is live
            chain state — the same numbers the public audit checks. */}
        <p className="mt-3 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--color-line)] bg-surface px-3 py-2 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--color-leaf)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-leaf)]" aria-hidden />
            Accounted on-chain
          </span>
          <span className="nums"><b className="font-semibold text-ink">{product.onHand.toString()}</b> on the shelf</span>
          <span className="nums"><b className="font-semibold text-ink">{product.reserved.toString()}</b> held</span>
          <span>every unit audited — anyone can re-run the check</span>
        </p>

        <div className="mt-7 flex items-center gap-3">
          <QtyStepper value={qty} max={max || 1} onChange={setQty} disabled={out} label="quantity" />
          <Button onClick={add} disabled={out || busy || pending}>
            {busy ? 'Adding…' : 'Add to cart'}
          </Button>
        </div>

        {added && (
          <p className="mt-3 text-sm text-[var(--color-cobalt-ink)]">
            Added. <button className="underline" onClick={() => nav('/cart')}>Go to cart</button>
          </p>
        )}
        {(addErr || writeErr) && <div className="mt-3"><ErrorNote message={addErr ?? writeErr ?? ''} /></div>}
      </div>
    </div>
  )
}
