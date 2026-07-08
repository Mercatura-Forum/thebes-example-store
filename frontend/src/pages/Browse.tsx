import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@thebes/sdk'
import {
  STORE_CID, M, decodeProducts, decodeCategories, decodeConservation,
  type Product, type Category, type Conservation,
} from '../lib/store-api'
import { ProductCard } from '../components/ProductCard'
import { ProductArt } from '../components/ProductArt'
import { Hero3D } from '../components/Hero3D'
import { Spinner, EmptyState, ErrorNote, Button } from '../components/ui'

export function Browse() {
  const { data, loading, error } = useQuery<Product[]>(
    STORE_CID,
    M.productsView,
    undefined,
    decodeProducts,
  )
  const { data: cats } = useQuery<Category[]>(STORE_CID, M.categoriesView, undefined, decodeCategories)
  const { data: cons } = useQuery<Conservation[]>(STORE_CID, M.conservationView, undefined, decodeConservation)
  const [catFilter, setCatFilter] = useState<bigint>(0n)
  const [webglDown, setWebglDown] = useState(false)
  const onHeroFail = useCallback(() => setWebglDown(true), [])
  const shelfRef = useRef<HTMLElement>(null)

  if (loading) return <Spinner label="Opening the souk" />
  if (error) return <ErrorNote message={error} />
  const products = data ?? []
  if (products.length === 0) {
    return (
      <EmptyState
        title="The stalls are empty"
        hint="This souk has no products yet. Open Admin to add the first one — with its own on-chain artwork."
        action={<Link to="/admin"><Button>Go to Admin</Button></Link>}
      />
    )
  }

  const seal = cons?.[0]
  const categories = (cats ?? []).filter((c) => c.productCount > 0n)
  const shelf = catFilter === 0n ? products : products.filter((p) => p.categoryId === catFilter)

  return (
    <div className="space-y-16">
      {/* The hero is the souk itself: the potter's vessel turning in the stall
          arch (real WebGL, drawn fallback), the market's claim in display type,
          and a strip of LIVE numbers from the on-chain audit under it. */}
      <section className="grid items-center gap-10 md:grid-cols-[5fr_6fr]">
        <div className="arch relative mx-auto aspect-[4/5] w-full max-w-sm hero-float">
          <span className="arch-inner" />
          {webglDown
            ? <ProductArt id={1n} name="Stoneware Mug" className="h-full w-full" />
            : <Hero3D onFail={onHeroFail} />}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-gold)]">An on-chain souk</p>
          <h1 className="font-display mt-3 text-5xl font-extrabold leading-[0.96] text-ink md:text-7xl" style={{ textWrap: 'balance' }}>
            A market that keeps honest books.
          </h1>
          <p className="mt-5 max-w-prose text-lg leading-relaxed text-ink-soft">
            Hand-picked goods on an open ledger. The shelves, the checkout holds
            and the audit all live on-chain — nothing behind the counter.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Button onClick={() => shelfRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Walk the stalls
            </Button>
            <Link to="/orders" className="text-sm font-medium text-[var(--color-cobalt)] hover:underline">
              Track an order →
            </Link>
          </div>
          {seal && (
            <p className="market-strip mt-8">
              <span><b className="nums">{seal.productsChecked.toString()}</b> products</span>
              <span><b className="nums">{seal.unitsOnHand.toString()}</b> units on the shelves</span>
              {seal.unitsReserved > 0n && (
                <span><b className="nums">{seal.unitsReserved.toString()}</b> held at checkout</span>
              )}
              <span className={seal.violations === 0n ? 'text-[var(--color-leaf)]' : 'text-[var(--color-sold)]'}>
                {seal.violations === 0n ? '✓ books audited on-chain' : '✗ audit found violations'}
              </span>
            </p>
          )}
        </div>
      </section>

      <section ref={shelfRef} style={{ scrollMarginTop: '5rem' }}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">Walk the stalls</h2>
          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
              <button className="chip" data-on={catFilter === 0n} onClick={() => setCatFilter(0n)}>
                Everything
              </button>
              {categories.map((c) => (
                <button
                  key={c.id.toString()}
                  className="chip"
                  data-on={catFilter === c.id}
                  onClick={() => setCatFilter(catFilter === c.id ? 0n : c.id)}
                >
                  {c.name}
                  <span className="nums opacity-60">{c.productCount.toString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {shelf.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing in this corner of the souk yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {shelf.map((p, i) => (
              <div key={p.id.toString()} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                <ProductCard p={p} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
