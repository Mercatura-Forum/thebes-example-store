/**
 * store-api.ts — typed reads/writes for the Souk store backend, built on the
 * thebes SDK. Reads use the backend's flat `*View` query methods so the SPA's
 * lightweight Candid decoder (flat records only) suffices; writes pass Candid
 * args. Each function is a thin, named verb the UI calls.
 */
import { query, update, encodeArgs, decodeVecRecord, decodeNat } from '@thebes/sdk'
import { STORE_CID } from './config'

export interface Product {
  id: bigint
  name: string
  description: string
  priceE8s: bigint
  stockCount: bigint
  photoPath: string // "" when none
}

export interface CartLine {
  productId: bigint
  quantity: bigint
  name: string
  priceE8s: bigint
}

export interface OrderRow {
  id: bigint
  totalAmount: bigint
  status: string // "placed" | "shipped" | "delivered"
  createdAt: bigint
  itemCount: bigint
}

const PRODUCT_FIELDS = [
  { name: 'id', type: 'nat' as const },
  { name: 'name', type: 'text' as const },
  { name: 'description', type: 'text' as const },
  { name: 'priceE8s', type: 'nat' as const },
  { name: 'stockCount', type: 'nat' as const },
  { name: 'photoPath', type: 'text' as const },
]

const CART_FIELDS = [
  { name: 'productId', type: 'nat' as const },
  { name: 'quantity', type: 'nat' as const },
  { name: 'name', type: 'text' as const },
  { name: 'priceE8s', type: 'nat' as const },
]

const ORDER_FIELDS = [
  { name: 'id', type: 'nat' as const },
  { name: 'totalAmount', type: 'nat' as const },
  { name: 'status', type: 'text' as const },
  { name: 'createdAt', type: 'int' as const },
  { name: 'itemCount', type: 'nat' as const },
]

export function decodeProducts(replyHex: string): Product[] {
  return decodeVecRecord(replyHex, PRODUCT_FIELDS) as unknown as Product[]
}
export function decodeCart(replyHex: string): CartLine[] {
  return decodeVecRecord(replyHex, CART_FIELDS) as unknown as CartLine[]
}
export function decodeOrders(replyHex: string): OrderRow[] {
  return decodeVecRecord(replyHex, ORDER_FIELDS) as unknown as OrderRow[]
}

// Query method names (paired with the decoders above via useQuery in pages).
export const M = {
  productsView: 'getProductsView',
  cartView: 'getCartView',
  ordersView: 'getOrderHistoryView',
} as const

// ── Writes ──

export async function addToCart(productId: bigint, quantity: number): Promise<void> {
  await update(STORE_CID, 'addToCart', encodeArgs([
    { type: 'nat', value: productId },
    { type: 'nat', value: BigInt(quantity) },
  ]))
}

/** Checkout via the trap-wrapping backend method → returns the new order id. */
export async function checkout(): Promise<bigint> {
  const r = await update(STORE_CID, 'checkoutOrTrap')
  return decodeNat(r.reply_hex ?? r.reply ?? '')
}

export async function claimOwner(): Promise<void> {
  await update(STORE_CID, 'claimOwner')
}

export async function addProduct(
  name: string,
  description: string,
  priceE8s: bigint,
  stockCount: number,
  photoPath: string | null,
): Promise<bigint> {
  const r = await update(STORE_CID, 'addProduct', encodeArgs([
    { type: 'text', value: name },
    { type: 'text', value: description },
    { type: 'nat', value: priceE8s },
    { type: 'nat', value: BigInt(stockCount) },
    { type: 'opt', inner: { type: 'text' }, value: photoPath },
  ]))
  return decodeNat(r.reply_hex ?? r.reply ?? '')
}

export async function setProductPhoto(productId: bigint, photoPath: string): Promise<void> {
  await update(STORE_CID, 'setProductPhoto', encodeArgs([
    { type: 'nat', value: productId },
    { type: 'text', value: photoPath },
  ]))
}

export async function restock(productId: bigint, additional: number): Promise<void> {
  await update(STORE_CID, 'restockProduct', encodeArgs([
    { type: 'nat', value: productId },
    { type: 'nat', value: BigInt(additional) },
  ]))
}

/** Seed a demo catalog on a fresh store (no-op once any product exists). */
export async function seedDemo(): Promise<void> {
  await update(STORE_CID, 'seedDemo')
}

export { query, STORE_CID }
