import { Link } from 'react-router-dom'
import type { Product } from '../lib/store-api'
import { MediaImage } from './MediaImage'
import { PriceTag } from './ui'

/** A stall in the arcade: the product's artwork under its arch, the brass
 *  price-tag as the focal accent, availability as a quiet status line.
 *  "Available" is net of other shoppers' checkout holds. */
export function ProductCard({ p }: { p: Product }) {
  const out = p.available === 0n
  return (
    <Link
      to={`/p/${p.id}`}
      className="group block transition hover:-translate-y-1"
    >
      <div className="arch relative">
        <span className="arch-inner" />
        <MediaImage path={p.photoPath} alt={p.name} ratio="1 / 1.05" artId={p.id} artName={p.name} />
        {out && (
          <span className="absolute right-3 top-6 rounded-full bg-[var(--color-sold)] px-2 py-0.5 text-[11px] font-semibold text-white">
            {p.reserved > 0n ? 'All held' : 'Sold out'}
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 px-1.5 pt-3">
        <div className="min-w-0">
          <p className="font-display font-semibold leading-tight text-ink line-clamp-1">{p.name}</p>
          <p className="mt-0.5 text-xs text-ink-soft nums">
            {p.categoryName && <span>{p.categoryName} · </span>}
            {out ? 'none available' : `${p.available.toString()} available`}
          </p>
        </div>
        <PriceTag e8s={p.priceE8s} />
      </div>
    </Link>
  )
}
