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
import { useT } from '../lib/i18n'

/** Category scope + search live in the URL hash (#/?cat=2&q=mug), so any view
 *  of the souk is a shareable link. */
export function Browse() {
  const t = useT()
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

  if (loading) return <Spinner label={t.openingSouk} />
  if (error) return <ErrorNote message={error} />
  const products = data ?? []
  if (products.length === 0) {
    return (
      <EmptyState
        title={t.stallsEmptyTitle}
        hint={t.stallsEmptyHint}
        action={<Link to="/admin"><Button>{t.goToAdmin}</Button></Link>}
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
    ? (activeCat ? t.searchIn(q.trim(), activeCat.name) : t.searchAcross(q.trim()))
    : activeCat
      ? activeCat.name
      : t.walkTheStalls

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
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-gold)]">{t.heroKicker}</p>
          <h1 className="font-display mt-3 text-5xl font-extrabold leading-[0.96] text-ink md:text-7xl" style={{ textWrap: 'balance' }}>
            {t.heroTitle}
          </h1>
          <p className="mt-5 max-w-prose text-lg leading-relaxed text-ink-soft">
            {t.heroLede}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Button onClick={() => shelfRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              {t.walkTheStalls}
            </Button>
            <Link to="/orders" className="text-sm font-medium text-[var(--color-cobalt)] hover:underline">
              {t.trackAnOrder}
            </Link>
          </div>
          {seal && (
            <p className="market-strip mt-8 nums">
              <span>{t.stripProducts(seal.productsChecked)}</span>
              <span>{t.stripUnits(seal.unitsOnHand)}</span>
              {seal.unitsReserved > 0n && (
                <span>{t.stripHeld(seal.unitsReserved)}</span>
              )}
              <span className={seal.violations === 0n ? 'text-[var(--color-leaf)]' : 'text-[var(--color-sold)]'}>
                {seal.violations === 0n ? t.stripAudited : t.stripViolations}
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
              <span className="sr-only">{t.searchSouk}</span>
              <svg
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-soft/60"
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden
              >
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
              </svg>
              <input
                className="w-56 rounded-full border border-[var(--color-line)] bg-surface py-1.5 ps-9 pe-8 text-sm text-ink outline-none transition focus:border-[var(--color-cobalt)]"
                placeholder={activeCat ? t.searchCatPlaceholder(activeCat.name) : t.searchPlaceholder}
                value={q}
                onChange={(e) => { setQ(e.target.value); apply(catFilter, e.target.value) }}
                aria-label={activeCat ? t.searchCatAria(activeCat.name) : t.searchAllAria}
              />
              {q && (
                <button
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
                  onClick={() => { setQ(''); apply(catFilter, '') }}
                  aria-label={t.clearSearch}
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
            title={needle ? t.noMatchTitle(q.trim()) : t.emptyAisleTitle}
            hint={
              needle
                ? activeCat
                  ? t.noMatchInCatHint(activeCat.name)
                  : t.noMatchHint
                : t.emptyAisleHint
            }
            action={
              <div className="flex justify-center gap-2">
                {needle && <Button variant="ghost" onClick={() => { setQ(''); apply(catFilter, '') }}>{t.clearSearch}</Button>}
                {(activeCat || needle) && <Button onClick={() => { setQ(''); apply(0n, '') }}>{t.showEverything}</Button>}
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
