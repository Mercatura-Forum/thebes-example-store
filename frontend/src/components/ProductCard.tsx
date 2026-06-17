import { Link } from 'react-router-dom'
import type { Product } from '../lib/store-api'
import { MediaImage } from './MediaImage'
import { PriceTag } from './ui'

/** Image-forward card: the photo dominates, the price-tag is the focal accent,
 *  stock reads as a quiet status. Hover lifts the card (reduced-motion gated). */
export function ProductCard({ p }: { p: Product }) {
  const out = p.stockCount === 0n
  return (
    <Link
      to={`/p/${p.id}`}
      className="group block overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(15,23,34,0.25)]"
    >
      <div className="relative">
        <MediaImage path={p.photoPath} alt={p.name} ratio="1 / 1" />
        {out && (
          <span className="absolute right-2 top-2 rounded-full bg-[var(--color-sold)] px-2 py-0.5 text-[11px] font-semibold text-white">
            Sold out
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="font-display font-semibold leading-tight text-ink line-clamp-1">{p.name}</p>
          <p className="mt-0.5 text-xs text-ink-soft nums">
            {out ? 'out of stock' : `${p.stockCount.toString()} in stock`}
          </p>
        </div>
        <PriceTag e8s={p.priceE8s} />
      </div>
    </Link>
  )
}
