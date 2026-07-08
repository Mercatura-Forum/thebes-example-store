import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@thebes/sdk'
import { STORE_CID, M, decodeProducts, decodeCategories, type Product, type Category } from '../lib/store-api'
import { ProductCard } from '../components/ProductCard'
import { MediaImage } from '../components/MediaImage'
import { PriceTag, Spinner, EmptyState, ErrorNote, Button } from '../components/ui'

/** Pick a hero: the first in-stock product that has a photo (the photo is the
 *  thesis of the page), else the first product. */
function pickHero(products: Product[]): Product | undefined {
  return products.find((p) => p.photoPath && p.available > 0n) ?? products.find((p) => p.photoPath) ?? products[0]
}

export function Browse() {
  const { data, loading, error } = useQuery<Product[]>(
    STORE_CID,
    M.productsView,
    undefined,
    decodeProducts,
  )
  const { data: cats } = useQuery<Category[]>(STORE_CID, M.categoriesView, undefined, decodeCategories)
  const [catFilter, setCatFilter] = useState<bigint>(0n)

  if (loading) return <Spinner label="Loading the shop" />
  if (error) return <ErrorNote message={error} />
  const products = data ?? []
  if (products.length === 0) {
    return (
      <EmptyState
        title="The shelves are empty"
        hint="This shop has no products yet. Open Admin to add the first one — with a real on-chain photo."
        action={<Link to="/admin"><Button>Go to Admin</Button></Link>}
      />
    )
  }

  const hero = pickHero(products)!
  const categories = (cats ?? []).filter((c) => c.productCount > 0n)
  const shelf = catFilter === 0n
    ? products.filter((p) => p.id !== hero.id)
    : products.filter((p) => p.categoryId === catFilter)

  return (
    <div className="space-y-12">
      {/* Hero — the most characteristic thing in the shop's world: a product,
          full-bleed, with its price-tag. Not a big-number-and-gradient template. */}
      <section className="grid items-stretch gap-6 md:grid-cols-2">
        <Link to={`/p/${hero.id}`} className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)]">
          <MediaImage path={hero.photoPath} alt={hero.name} ratio="4 / 3" />
        </Link>
        <div className="flex flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
            {hero.categoryName || 'Featured'}
          </p>
          <h1 className="font-display mt-2 text-4xl font-extrabold leading-[1.05] text-ink md:text-5xl">
            {hero.name}
          </h1>
          <p className="mt-3 max-w-prose text-ink-soft line-clamp-3">{hero.description}</p>
          <div className="mt-5 flex items-center gap-4">
            <PriceTag e8s={hero.priceE8s} size="lg" />
            <Link to={`/p/${hero.id}`}>
              <Button>View product</Button>
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">The shelf</h2>
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {shelf.map((p) => (
              <ProductCard key={p.id.toString()} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
