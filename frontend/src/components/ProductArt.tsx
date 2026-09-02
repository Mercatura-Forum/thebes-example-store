/**
 * ProductArt — the souk's product visuals, drawn by hand as inline SVG.
 *
 * Every illustration ships inside the app bundle, so the imagery is as
 * on-chain and self-contained as the catalogue itself (no external URLs, no
 * CDN). A real uploaded photo (photoPath) always wins; these are the stall
 * drawings for products that don't have one. Unknown products get a
 * deterministic girih-tile drawn from the product id — every product is
 * beautiful by default, none share a face.
 *
 * One warm palette across the set (terracotta, clay, flax, brass, indigo,
 * olive) so the shelf reads as one market, on both the sand and night themes.
 */
import type { ReactElement } from 'react'
import { useT } from '../lib/i18n'

// The set palette — art stays warm and fixed; the arch behind it adapts.
const P = {
  terracotta: '#c96f4a',
  clay: '#a04a2b',
  cream: '#f3e3c8',
  flax: '#e6d2ac',
  brass: '#c99a3f',
  brassDeep: '#9a7020',
  indigo: '#3d4d9e',
  indigoDeep: '#2c3877',
  olive: '#7d8b4e',
  walnut: '#6f4a2f',
  smoke: '#8d8577',
  steel: '#b9b3a6',
  steelDeep: '#8f8878',
  shadow: 'rgba(43,33,24,0.14)',
}

function Ground() {
  return <ellipse cx="100" cy="170" rx="58" ry="10" fill={P.shadow} />
}

function Mug() {
  return (
    <g>
      <Ground />
      {/* handle */}
      <path d="M138 92 c22 0 22 34 0 34" fill="none" stroke={P.clay} strokeWidth="11" strokeLinecap="round" />
      {/* body */}
      <path d="M62 78 h76 v72 a14 14 0 0 1 -14 14 h-48 a14 14 0 0 1 -14 -14 z" fill={P.terracotta} />
      {/* cream glaze dip */}
      <path d="M62 78 h76 v22 c-14 8 -24 -6 -38 0 c-14 6 -26 -4 -38 2 z" fill={P.cream} />
      {/* rim */}
      <rect x="62" y="74" width="76" height="8" rx="4" fill={P.cream} />
      {/* speckles */}
      <circle cx="84" cy="122" r="2.2" fill={P.cream} opacity=".55" />
      <circle cx="104" cy="138" r="2.2" fill={P.cream} opacity=".55" />
      <circle cx="120" cy="118" r="2.2" fill={P.cream} opacity=".55" />
      <circle cx="76" cy="146" r="2.2" fill={P.cream} opacity=".4" />
    </g>
  )
}

function Kettle() {
  return (
    <g>
      <Ground />
      {/* gooseneck spout */}
      <path d="M64 106 C 34 100 30 74 48 64" fill="none" stroke={P.steel} strokeWidth="10" strokeLinecap="round" />
      {/* body */}
      <path d="M66 92 h72 l8 62 a12 12 0 0 1 -12 14 h-64 a12 12 0 0 1 -12 -14 z" fill={P.steel} />
      <path d="M66 92 h72 l3 24 h-78 z" fill={P.steelDeep} opacity=".35" />
      {/* lid */}
      <rect x="76" y="82" width="52" height="12" rx="6" fill={P.steelDeep} />
      <circle cx="102" cy="76" r="7" fill={P.walnut} />
      {/* handle */}
      <path d="M78 88 C 88 58 116 58 126 88" fill="none" stroke={P.walnut} strokeWidth="9" strokeLinecap="round" />
      {/* brushed sheen */}
      <path d="M120 100 l4 56" stroke={P.cream} strokeWidth="4" strokeLinecap="round" opacity=".5" />
    </g>
  )
}

function Board() {
  return (
    <g>
      <Ground />
      {/* board, slightly rotated */}
      <g transform="rotate(-7 100 118)">
        <rect x="52" y="66" width="96" height="104" rx="16" fill={P.walnut} />
        <rect x="58" y="72" width="84" height="92" rx="12" fill={P.terracotta} opacity=".28" />
        {/* end-grain stripes */}
        <path d="M70 72 v92 M88 72 v92 M106 72 v92 M124 72 v92" stroke={P.clay} strokeWidth="3" opacity=".35" />
        {/* handle hole */}
        <circle cx="100" cy="84" r="7" fill="var(--color-surface)" />
      </g>
      {/* olive sprig */}
      <path d="M136 64 q14 -10 24 -6" fill="none" stroke={P.olive} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="150" cy="56" rx="5" ry="3" fill={P.olive} transform="rotate(-24 150 56)" />
      <ellipse cx="160" cy="59" rx="5" ry="3" fill={P.olive} transform="rotate(-10 160 59)" />
    </g>
  )
}

function Apron() {
  return (
    <g>
      <Ground />
      {/* neck strap */}
      <path d="M84 46 q16 -14 32 0" fill="none" stroke={P.walnut} strokeWidth="6" strokeLinecap="round" />
      {/* bib + skirt */}
      <path d="M78 52 h44 v34 l16 10 v62 a8 8 0 0 1 -8 8 h-60 a8 8 0 0 1 -8 -8 v-62 l16 -10 z" fill={P.flax} />
      {/* waist ties */}
      <path d="M62 96 q-16 8 -22 22" fill="none" stroke={P.walnut} strokeWidth="5" strokeLinecap="round" />
      <path d="M138 96 q16 8 22 22" fill="none" stroke={P.walnut} strokeWidth="5" strokeLinecap="round" />
      {/* pocket with indigo trim */}
      <path d="M82 118 h36 v22 a6 6 0 0 1 -6 6 h-24 a6 6 0 0 1 -6 -6 z" fill={P.cream} />
      <path d="M82 118 h36" stroke={P.indigo} strokeWidth="4" strokeLinecap="round" />
      {/* stitch dashes */}
      <path d="M74 60 v100 M126 60 v100" stroke={P.smoke} strokeWidth="1.6" strokeDasharray="4 5" opacity=".6" />
    </g>
  )
}

function Throw() {
  return (
    <g>
      <Ground />
      {/* three stacked folds */}
      <rect x="52" y="120" width="96" height="26" rx="12" fill={P.cream} />
      <rect x="48" y="96" width="104" height="28" rx="13" fill={P.flax} />
      <rect x="54" y="70" width="92" height="28" rx="13" fill={P.cream} />
      {/* herringbone on the middle fold */}
      <path d="M60 110 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8"
        fill="none" stroke={P.smoke} strokeWidth="2" opacity=".5" />
      {/* indigo stripe on the top fold */}
      <path d="M54 78 h92" stroke={P.indigo} strokeWidth="5" strokeLinecap="round" opacity=".85" />
      <path d="M54 86 h92" stroke={P.indigo} strokeWidth="2.5" strokeLinecap="round" opacity=".5" />
      {/* fringe */}
      <path d="M58 146 v10 M70 146 v10 M82 146 v10 M94 146 v10 M106 146 v10 M118 146 v10 M130 146 v10 M142 146 v10"
        stroke={P.flax} strokeWidth="3" strokeLinecap="round" />
    </g>
  )
}

function Candle() {
  return (
    <g>
      <Ground />
      {/* flame halo */}
      <circle cx="100" cy="56" r="18" fill={P.brass} opacity=".18" />
      {/* flame */}
      <path d="M100 44 c7 8 7 14 0 19 c-7 -5 -7 -11 0 -19" fill={P.brass} />
      <path d="M100 50 c3.5 4 3.5 7 0 10 c-3.5 -3 -3.5 -6 0 -10" fill={P.cream} />
      {/* wick */}
      <path d="M100 63 v8" stroke={P.walnut} strokeWidth="3" strokeLinecap="round" />
      {/* pillar */}
      <rect x="72" y="70" width="56" height="92" rx="10" fill={P.brass} opacity=".92" />
      <path d="M72 80 a28 8 0 0 0 56 0 v-10 h-56 z" fill={P.brassDeep} opacity=".5" />
      {/* honeycomb press */}
      <g stroke={P.brassDeep} strokeWidth="1.6" opacity=".45" fill="none">
        <path d="M84 100 l7 -4 l7 4 v9 l-7 4 l-7 -4 z" />
        <path d="M102 100 l7 -4 l7 4 v9 l-7 4 l-7 -4 z" />
        <path d="M93 118 l7 -4 l7 4 v9 l-7 4 l-7 -4 z" />
        <path d="M84 136 l7 -4 l7 4 v9 l-7 4 l-7 -4 z" />
        <path d="M102 136 l7 -4 l7 4 v9 l-7 4 l-7 -4 z" />
      </g>
    </g>
  )
}

function Towels() {
  return (
    <g>
      <Ground />
      {/* bottom towel — sage */}
      <rect x="54" y="112" width="92" height="40" rx="10" fill={P.olive} opacity=".8" />
      <path d="M54 126 h92" stroke={P.cream} strokeWidth="2" opacity=".5" />
      {/* top towel — cream, waffle grid */}
      <rect x="60" y="66" width="80" height="48" rx="10" fill={P.cream} />
      <g stroke={P.flax} strokeWidth="1.8" opacity=".9">
        <path d="M60 78 h80 M60 90 h80 M60 102 h80" />
        <path d="M74 66 v48 M88 66 v48 M102 66 v48 M116 66 v48 M130 66 v48" />
      </g>
      {/* hanging loop */}
      <path d="M96 62 q4 -8 8 0" fill="none" stroke={P.indigo} strokeWidth="3" strokeLinecap="round" />
    </g>
  )
}

function Lamp() {
  return (
    <g>
      <Ground />
      {/* glow */}
      <circle cx="128" cy="72" r="22" fill={P.brass} opacity=".16" />
      {/* flame at the spout */}
      <path d="M128 62 c6 7 6 12 0 16 c-6 -4 -6 -9 0 -16" fill={P.brass} />
      <path d="M128 67 c3 3.5 3 6 0 8.5 c-3 -2.5 -3 -5 0 -8.5" fill={P.cream} />
      {/* body — classic oil lamp profile */}
      <path d="M56 116 c0 -18 18 -30 40 -30 c8 0 16 2 22 5 l14 -7 c3 -1 5 1 4 4 l-6 13 c6 6 10 12 10 20 c0 16 -20 26 -42 26 s-42 -12 -42 -31 z" fill={P.brass} />
      <path d="M60 132 c10 10 24 14 38 14 s28 -4 36 -12" fill="none" stroke={P.brassDeep} strokeWidth="3" opacity=".5" />
      {/* lid knob */}
      <circle cx="96" cy="84" r="6" fill={P.brassDeep} />
      {/* handle */}
      <path d="M54 112 c-18 2 -18 26 2 26" fill="none" stroke={P.brassDeep} strokeWidth="7" strokeLinecap="round" />
      {/* base */}
      <path d="M84 146 h28 l6 14 h-40 z" fill={P.brassDeep} />
    </g>
  )
}

const CURATED: [RegExp, () => ReactElement][] = [
  [/mug|cup/i, Mug],
  [/kettle|pour/i, Kettle],
  [/board/i, Board],
  [/apron/i, Apron],
  [/throw|blanket|wool/i, Throw],
  [/candle/i, Candle],
  [/towel/i, Towels],
  [/lamp|lantern/i, Lamp],
]

/** Deterministic girih tile for products without curated art: an eight-point
 *  star whose rotation and colors come from the product id, so every new
 *  product gets its own tile — same market, different stall. */
function GirihTile({ seed, initial }: { seed: bigint; initial: string }) {
  const n = Number(seed % 997n)
  const rot = (n * 37) % 45
  const warm = [P.terracotta, P.brass, P.indigo, P.olive, P.clay]
  const a = warm[n % warm.length]
  const b = warm[(n + 2) % warm.length]
  const pts: string[] = []
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? 56 : 30
    const th = (Math.PI * i) / 8
    pts.push(`${100 + r * Math.sin(th)},${108 - r * Math.cos(th)}`)
  }
  return (
    <g>
      <Ground />
      <g transform={`rotate(${rot} 100 108)`}>
        <polygon points={pts.join(' ')} fill={a} opacity=".9" />
        <g transform={`rotate(22.5 100 108)`}>
          <polygon points={pts.join(' ')} fill={b} opacity=".45" />
        </g>
        <circle cx="100" cy="108" r="20" fill="var(--color-surface)" />
      </g>
      <text
        x="100" y="115" textAnchor="middle"
        fontFamily="'Bricolage Grotesque Variable', 'Cairo Variable', sans-serif" fontWeight="800" fontSize="22"
        fill="var(--color-ink)"
      >{initial.toUpperCase()}</text>
    </g>
  )
}

export function ProductArt({ id, name, className = '' }: { id: bigint; name: string; className?: string }) {
  const t = useT()
  const curated = CURATED.find(([re]) => re.test(name))?.[1]
  return (
    <div className={`art-frame ${className}`} aria-label={t.illustration(name)} role="img">
      <svg viewBox="0 0 200 200">
        {curated ? curated() : <GirihTile seed={id} initial={name.trim().charAt(0) || '◈'} />}
      </svg>
    </div>
  )
}
