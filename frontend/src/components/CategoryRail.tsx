import type { Category, Product } from '../lib/store-api'
import { ProductArt } from './ProductArt'
import { MediaImage } from './MediaImage'

/**
 * The aisles of the souk: one wide arch card per category, wearing a fan of
 * its own products' artwork. Clicking an aisle scopes the shelf (and the URL,
 * so the aisle is shareable). First-class navigation — not a filter chip.
 */
export function CategoryRail({
  categories,
  products,
  active,
  onPick,
}: {
  categories: Category[]
  products: Product[]
  active: bigint
  onPick: (id: bigint) => void
}) {
  if (categories.length === 0) return null
  return (
    <section aria-label="Browse by category">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c, i) => {
          const inAisle = products.filter((p) => p.categoryId === c.id)
          const faces = inAisle.slice(0, 3)
          const on = active === c.id
          return (
            <button
              key={c.id.toString()}
              onClick={() => onPick(on ? 0n : c.id)}
              aria-pressed={on}
              className={`rise group relative overflow-hidden rounded-[999px_999px_var(--radius-card)_var(--radius-card)] border bg-surface p-5 pt-7 text-left transition hover:-translate-y-1 ${
                on ? 'border-[var(--color-cobalt)] shadow-[0_16px_38px_-18px_rgba(61,77,158,0.45)]' : 'border-[var(--color-line)]'
              }`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-28"
                style={{ background: 'radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--color-gold) 13%, transparent), transparent 65%)' }}
                aria-hidden
              />
              {/* the aisle's faces — up to three of its products, fanned */}
              <div className="relative mx-auto flex h-28 w-full items-end justify-center">
                {faces.length === 0 ? (
                  <p className="pb-6 text-sm text-ink-soft">An empty aisle, for now.</p>
                ) : (
                  faces.map((p, j) => (
                    <div
                      key={p.id.toString()}
                      className="w-24 shrink-0 transition group-hover:-translate-y-1"
                      style={{
                        transform: `rotate(${(j - (faces.length - 1) / 2) * 9}deg) translateY(${Math.abs(j - (faces.length - 1) / 2) * 7}px)`,
                        transitionDelay: `${j * 40}ms`,
                        marginInline: '-0.6rem',
                        zIndex: j === 1 ? 2 : 1,
                      }}
                    >
                      {p.photoPath ? (
                        <div className="overflow-hidden rounded-xl border border-[var(--color-line)]">
                          <MediaImage path={p.photoPath} alt={p.name} ratio="1 / 1" />
                        </div>
                      ) : (
                        <ProductArt id={p.id} name={p.name} />
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="relative mt-3 flex items-baseline justify-between gap-2">
                <span className="font-display text-lg font-bold text-ink">{c.name}</span>
                <span className="text-xs text-ink-soft nums">
                  {c.productCount.toString()} item{c.productCount === 1n ? '' : 's'}
                  <span className={`ml-2 font-medium ${on ? 'text-[var(--color-cobalt)]' : 'text-[var(--color-gold)]'}`}>
                    {on ? 'showing ✓' : 'walk this aisle →'}
                  </span>
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
