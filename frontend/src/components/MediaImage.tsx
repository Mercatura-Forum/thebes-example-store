import { useState } from 'react'
import { mediaUrl } from '@thebes/sdk'
import { MEDIA_CID } from '../lib/config'
import { ProductArt } from './ProductArt'
import { useT } from '../lib/i18n'

/**
 * The universal product visual: a fixed aspect-ratio box. A real uploaded
 * photo (path on the media contract) always wins, with object-cover and a
 * blur-up reveal. Without one, the product's stall drawing (ProductArt —
 * curated SVG or the deterministic girih tile) fills the frame, so the shelf
 * is never a wall of grey placeholders.
 */
export function MediaImage({
  path,
  alt,
  ratio = '4 / 3',
  className = '',
  artId,
  artName,
}: {
  path: string
  alt: string
  ratio?: string
  className?: string
  /** When set, an empty path renders the product's drawing instead of a blank. */
  artId?: bigint
  artName?: string
}) {
  const t = useT()
  const [loaded, setLoaded] = useState(false)
  if (!path) {
    if (artId !== undefined && artName) {
      return (
        <div className={`relative ${className}`} style={{ aspectRatio: ratio }}>
          <ProductArt id={artId} name={artName} className="art-lift h-full w-full" />
        </div>
      )
    }
    return (
      <div
        className={`media grid place-items-center text-ink-soft/50 ${className}`}
        style={{ aspectRatio: ratio }}
        aria-label={t.noImage(alt)}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    )
  }
  return (
    <div className={`media ${className}`} style={{ aspectRatio: ratio }}>
      <img
        src={mediaUrl(MEDIA_CID, path)}
        alt={alt}
        loading="lazy"
        decoding="async"
        data-loaded={loaded}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
