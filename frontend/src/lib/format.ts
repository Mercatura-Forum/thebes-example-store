/** Shared formatting for money, quantities and chain time. */
export { formatPrice } from './config'

/** Parse a human price ("12.50") into e8s base units. */
export function toE8s(s: string): bigint {
  const [w, f = ''] = s.trim().split('.')
  const frac = (f + '00000000').slice(0, 8)
  return BigInt(w || '0') * 100_000_000n + BigInt(frac || '0')
}

/** Chain time (ns) → short local date. */
export function whenDate(ns: bigint): string {
  const ms = Number(ns / 1_000_000n)
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Chain time (ns) → local date + time (for timelines and the audit feed). */
export function whenExact(ns: bigint): string {
  const ms = Number(ns / 1_000_000n)
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** "a1b2c3…d4e5" — a principal hex shortened for table cells. */
export function shortHex(hex: string): string {
  if (hex.length <= 12) return hex
  return `${hex.slice(0, 6)}…${hex.slice(-4)}`
}

/** mm:ss remaining between two chain timestamps (ns), floored at zero. */
export function countdown(expiresAt: bigint, nowNs: bigint): string {
  const left = expiresAt > nowNs ? Number((expiresAt - nowNs) / 1_000_000_000n) : 0
  const m = Math.floor(left / 60)
  const s = left % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Notify the app shell that the cart changed (badge refresh). */
export function pokeCart() {
  window.dispatchEvent(new CustomEvent('souk:cart-changed'))
}
