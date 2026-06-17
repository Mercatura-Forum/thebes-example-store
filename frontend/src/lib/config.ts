/**
 * Contract ids. Overridable at deploy time via window globals (the deploy step
 * injects the freshly-assigned cids); otherwise fall back to the current cluster
 * cids. Keeping ids out of the bundle means one build serves any deployment.
 */
declare global {
  interface Window {
    STORE_CID?: number
    MEDIA_CID?: number
  }
}

export const STORE_CID: number =
  (typeof window !== 'undefined' && window.STORE_CID) || 34321969660512

export const MEDIA_CID: number =
  (typeof window !== 'undefined' && window.MEDIA_CID) || 201025201603509

/** Token has 8 decimals (e8s). Format a base-unit price for display. */
export function formatPrice(e8s: bigint | number): string {
  const v = typeof e8s === 'bigint' ? e8s : BigInt(Math.trunc(e8s))
  const whole = v / 100_000_000n
  const frac = (v % 100_000_000n).toString().padStart(8, '0').slice(0, 2)
  return `${whole.toString()}.${frac}`
}
