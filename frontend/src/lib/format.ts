/** Shared formatting for money, quantities and chain time. */
import { useEffect, useState } from 'react'
export { formatPrice } from './config'

/** Parse a human price ("12.50") into e8s base units. */
export function toE8s(s: string): bigint {
  const [w, f = ''] = s.trim().split('.')
  const frac = (f + '00000000').slice(0, 8)
  return BigInt(w || '0') * 100_000_000n + BigInt(frac || '0')
}

// ── Chain time ──
// The chain's Time.now() counts ns since GENESIS, not the Unix epoch, so a raw
// timestamp renders as 1970. Any view that carries a chain "now" (the seal's
// conservation check, the checkout hold) calibrates a chain→wall offset once;
// after that every timestamp renders as real local time.
let chainOffsetNs: bigint | undefined

export function calibrateChainTime(chainNowNs: bigint) {
  const next = BigInt(Date.now()) * 1_000_000n - chainNowNs
  const first = chainOffsetNs === undefined
  chainOffsetNs = next
  if (first) window.dispatchEvent(new CustomEvent('souk:chain-time'))
}

/** Re-render the caller once calibration lands (dates upgrade in place). */
export function useChainTime(): boolean {
  const [ready, setReady] = useState(chainOffsetNs !== undefined)
  useEffect(() => {
    if (ready) return
    const on = () => setReady(true)
    window.addEventListener('souk:chain-time', on)
    return () => window.removeEventListener('souk:chain-time', on)
  }, [ready])
  return ready
}

function toWallDate(ns: bigint): Date | undefined {
  if (chainOffsetNs === undefined) return undefined
  return new Date(Number((ns + chainOffsetNs) / 1_000_000n))
}

/** Chain time (ns) → short local date ("Jul 7, 2026"). */
export function whenDate(ns: bigint): string {
  const d = toWallDate(ns)
  if (!d) return '…'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Chain time (ns) → local date + time (for timelines and the audit feed). */
export function whenExact(ns: bigint): string {
  const d = toWallDate(ns)
  if (!d) return '…'
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** "a1b2c3…d4e5" — a principal hex shortened for table cells. */
export function shortHex(hex: string): string {
  if (hex.length <= 12) return hex
  return `${hex.slice(0, 6)}…${hex.slice(-4)}`
}

/** Notify the app shell that the cart changed (badge refresh). */
export function pokeCart() {
  window.dispatchEvent(new CustomEvent('souk:cart-changed'))
}
