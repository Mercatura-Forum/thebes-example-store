import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@thebes/sdk'
import {
  STORE_CID, M, decodeProducts, decodeCategories, decodeConservation,
  type Product, type Category, type Conservation,
} from '../lib/store-api'
import { ProductCard } from '../components/ProductCard'
import { ProductArt } from '../components/ProductArt'
import { CategoryRail } from '../components/CategoryRail'
import { Hero3D } from '../components/Hero3D'
import { Spinner, EmptyState, ErrorNote, Button } from '../components/ui'

/** Category scope + search live in the URL hash (#/?cat=2&q=mug), so any view
 *  of the souk is a shareable link. */
export function Browse() {
  const { data, loading, error } = useQuery<Product[]>(
    STORE_CID,
    M.productsView,
    undefined,
    decodeProducts,
  )
  const { data: cats } = useQuery<Category[]>(STORE_CID, M.categoriesView, undefined, decodeCategories)
  const { data: cons } = useQuery<Conservation[]>(STORE_CID, M.conservationView, undefined, decodeConservation)

  const [params, setParams] = useSearchParams()
  const catFilter = BigInt(params.get('cat') ?? '0')
  const urlQ = params.get('q') ?? ''
  const [q, setQ] = useState(urlQ)
  useEffect(() => { setQ(urlQ) }, [urlQ]) // back/forward + shared links win

  const [webglDown, setWebglDown] = useState(false)
  const onHeroFail = useCallback(() => setWebglDown(true), [])
  const shelfRef = useRef<HTMLElement>(null)

  const apply = useCallback((cat: bigint, query: string) => {
    const next = new URLSearchParams()
    if (cat !== 0n) next.set('cat', cat.toString())
    if (query.trim()) next.set('q', query.trim())
    setParams(next, { replace: true })
  }, [setParams])

  const pickCategory = useCallback((id: bigint) => {
    apply(id, q)
    shelfRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [apply, q])

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
  const activeCat = categories.find((c) => c.id === catFilter)
  const needle = q.trim().toLowerCase()
  const scoped = catFilter === 0n ? products : products.filter((p) => p.categoryId === catFilter)
  const shelf = needle
    ? scoped.filter((p) => p.name.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle))
    : scoped

  const shelfTitle = needle
    ? `“${q.trim()}” ${activeCat ? `in ${activeCat.name}` : 'across the souk'}`
    : activeCat
      ? activeCat.name
      : 'Walk the stalls'

  return (
    <div className="space-y-14">
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

      {/* The aisles — first-class category navigation, shareable by URL. */}
      <CategoryRail categories={categories} products={products} active={catFilter} onPick={pickCategory} />

      <section ref={shelfRef} style={{ scrollMarginTop: '5rem' }}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold" aria-live="polite">{shelfTitle}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* Search — scoped to the active aisle, instant, in the URL. */}
            <label className="relative">
              <span className="sr-only">Search the souk</span>
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft/60"
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden
              >
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
              </svg>
              <input
                className="w-56 rounded-full border border-[var(--color-line)] bg-surface py-1.5 pl-9 pr-8 text-sm text-ink outline-none transition focus:border-[var(--color-cobalt)]"
                placeholder={activeCat ? `Search ${activeCat.name}…` : 'Search the souk…'}
                value={q}
                onChange={(e) => { setQ(e.target.value); apply(catFilter, e.target.value) }}
                aria-label={activeCat ? `Search within ${activeCat.name}` : 'Search all products'}
              />
              {q && (
                <button
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
                  onClick={() => { setQ(''); apply(catFilter, '') }}
                  aria-label="Clear search"
                >✕</button>
              )}
            </label>
            {activeCat && (
              <button className="chip" data-on="true" onClick={() => apply(0n, q)}>
                {activeCat.name} ✕
              </button>
            )}
          </div>
        </div>
        {shelf.length === 0 ? (
          <EmptyState
            title={needle ? `Nothing matches “${q.trim()}”` : 'Nothing in this aisle yet'}
            hint={
              needle
                ? activeCat
                  ? `No ${activeCat.name.toLowerCase()} match that. Try the whole souk, or clear the search.`
                  : 'Try a different word — or wander the aisles instead.'
                : 'The shopkeeper is still stocking this corner of the market.'
            }
            action={
              <div className="flex justify-center gap-2">
                {needle && <Button variant="ghost" onClick={() => { setQ(''); apply(catFilter, '') }}>Clear search</Button>}
                {(activeCat || needle) && <Button onClick={() => { setQ(''); apply(0n, '') }}>Show everything</Button>}
              </div>
            }
          />
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
