import { Link } from 'react-router-dom'
import { useQuery } from '@thebes/sdk'
import { STORE_CID, M, decodeProducts, type Product } from '../lib/store-api'
import { ProductCard } from '../components/ProductCard'
import { MediaImage } from '../components/MediaImage'
import { PriceTag, Spinner, EmptyState, ErrorNote, Button } from '../components/ui'

/** Pick a hero: the first in-stock product that has a photo (the photo is the
 *  thesis of the page), else the first product. */
function pickHero(products: Product[]): Product | undefined {
  return products.find((p) => p.photoPath && p.stockCount > 0n) ?? products.find((p) => p.photoPath) ?? products[0]
}

export function Browse() {
  const { data, loading, error } = useQuery<Product[]>(
    STORE_CID,
    M.productsView,
    undefined,
    decodeProducts,
  )

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
  const rest = products.filter((p) => p.id !== hero.id)

  return (
    <div className="space-y-12">
      {/* Hero — the most characteristic thing in the shop's world: a product,
          full-bleed, with its price-tag. Not a big-number-and-gradient template. */}
      <section className="grid items-stretch gap-6 md:grid-cols-2">
        <Link to={`/p/${hero.id}`} className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)]">
          <MediaImage path={hero.photoPath} alt={hero.name} ratio="4 / 3" />
        </Link>
        <div className="flex flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">Featured</p>
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
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">The shelf</h2>
          <span className="text-sm text-ink-soft nums">{products.length} items</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rest.map((p) => (
            <ProductCard key={p.id.toString()} p={p} />
          ))}
        </div>
      </section>
    </div>
  )
}
