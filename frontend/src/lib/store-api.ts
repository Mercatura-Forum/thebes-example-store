/**
 * store-api.ts — typed reads/writes for the Souk store backend, built on the
 * thebes SDK. Reads use the backend's flat `*View` query methods so the SPA's
 * lightweight Candid decoder (flat records only) suffices; writes pass Candid
 * args. Each function is a thin, named verb the UI calls.
 */
import { query, update, encodeArgs, decodeVecRecord, decodeNat } from '@thebes/sdk'
import { STORE_CID } from './config'

// ── Read models (mirror the backend view records, field-for-field) ──

export interface Product {
  id: bigint
  name: string
  description: string
  priceE8s: bigint
  categoryId: bigint // 0n = uncategorised
  categoryName: string
  available: bigint // onHand − reserved: what a buyer can take right now
  onHand: bigint
  reserved: bigint
  photoPath: string // "" when none
}

export interface AdminProduct extends Product {
  received: bigint
  sold: bigint
  returned: bigint
  archived: boolean
}

export interface Category {
  id: bigint
  name: string
  productCount: bigint
}

export interface CartLine {
  productId: bigint
  quantity: bigint
  name: string
  priceE8s: bigint
  available: bigint
  photoPath: string
}

export interface Hold {
  expiresAt: bigint // ns, chain time
  nowNs: bigint // chain "now" so the countdown ignores client clock skew
  subtotalE8s: bigint
  itemCount: bigint
}

export interface HoldLine {
  productId: bigint
  name: string
  quantity: bigint
  unitPriceE8s: bigint
  photoPath: string
}

export interface Quote {
  subtotalE8s: bigint
  discountE8s: bigint
  totalE8s: bigint
  codeOk: boolean
  note: string // why the code did not apply ("" when fine)
}

export interface OrderRow {
  id: bigint
  subtotalE8s: bigint
  discountE8s: bigint
  totalE8s: bigint
  status: string // placed | shipped | delivered | cancelled | refunded
  createdAt: bigint
  itemCount: bigint
  discountCode: string
}

export interface AdminOrderRow extends OrderRow {
  buyer: string // principal hex
}

export interface OrderLine {
  productId: bigint
  name: string
  quantity: bigint
  unitPriceE8s: bigint
}

export interface OrderEvent {
  at: bigint
  kind: string
  detail: string
}

export interface Discount {
  code: string
  percentBps: bigint // 0 when fixed
  fixedE8s: bigint // 0 when percent
  minSubtotalE8s: bigint
  maxRedemptions: bigint // 0 = unlimited
  redemptions: bigint
  expiresAt: bigint // 0 = never
  active: boolean
}

export interface AuditRow {
  id: bigint
  at: bigint
  who: string // principal hex
  kind: string
  detail: string
  orderId: bigint
  productId: bigint
}

export interface ShopStats {
  products: bigint
  activeProducts: bigint
  categories: bigint
  ordersTotal: bigint
  ordersPlaced: bigint
  ordersShipped: bigint
  ordersDelivered: bigint
  ordersCancelled: bigint
  ordersRefunded: bigint
  unitsOnHand: bigint
  unitsReserved: bigint
  unitsSold: bigint
  unitsReturned: bigint
  revenueE8s: bigint
  activeHolds: bigint
  discountsActive: bigint
  invoiceCount: bigint
  auditEvents: bigint
}

export interface Conservation {
  productsChecked: bigint
  violations: bigint
  unitsOnHand: bigint
  unitsReserved: bigint
  checkedAt: bigint
}

export interface InvariantViolation {
  productId: bigint
  name: string
  rule: string
  expected: bigint
  actual: bigint
}

export interface InvoiceRow {
  id: bigint
  issuer: string
  recipient: string
  subtotalE8s: bigint
  taxE8s: bigint
  totalE8s: bigint
  status: string
  itemCount: bigint
  createdAt: bigint
}

// ── Field specs for the flat vec-record decoder ──

const nat = (name: string) => ({ name, type: 'nat' as const })
const int = (name: string) => ({ name, type: 'int' as const })
const text = (name: string) => ({ name, type: 'text' as const })
const bool = (name: string) => ({ name, type: 'bool' as const })
const principal = (name: string) => ({ name, type: 'principal' as const })

const PRODUCT_FIELDS = [
  nat('id'), text('name'), text('description'), nat('priceE8s'),
  nat('categoryId'), text('categoryName'),
  nat('available'), nat('onHand'), nat('reserved'), text('photoPath'),
]
const ADMIN_PRODUCT_FIELDS = [
  nat('id'), text('name'), text('description'), nat('priceE8s'),
  nat('categoryId'), text('categoryName'),
  nat('available'), nat('onHand'), nat('reserved'),
  nat('received'), nat('sold'), nat('returned'), bool('archived'), text('photoPath'),
]
const CATEGORY_FIELDS = [nat('id'), text('name'), nat('productCount')]
const CART_FIELDS = [
  nat('productId'), nat('quantity'), text('name'), nat('priceE8s'),
  nat('available'), text('photoPath'),
]
const HOLD_FIELDS = [int('expiresAt'), int('nowNs'), nat('subtotalE8s'), nat('itemCount')]
const HOLD_LINE_FIELDS = [nat('productId'), text('name'), nat('quantity'), nat('unitPriceE8s'), text('photoPath')]
const QUOTE_FIELDS = [nat('subtotalE8s'), nat('discountE8s'), nat('totalE8s'), bool('codeOk'), text('note')]
const ORDER_FIELDS = [
  nat('id'), nat('subtotalE8s'), nat('discountE8s'), nat('totalE8s'),
  text('status'), int('createdAt'), nat('itemCount'), text('discountCode'),
]
const ADMIN_ORDER_FIELDS = [
  nat('id'), principal('buyer'), nat('subtotalE8s'), nat('discountE8s'), nat('totalE8s'),
  text('status'), int('createdAt'), nat('itemCount'), text('discountCode'),
]
const ORDER_LINE_FIELDS = [nat('productId'), text('name'), nat('quantity'), nat('unitPriceE8s')]
const ORDER_EVENT_FIELDS = [int('at'), text('kind'), text('detail')]
const DISCOUNT_FIELDS = [
  text('code'), nat('percentBps'), nat('fixedE8s'), nat('minSubtotalE8s'),
  nat('maxRedemptions'), nat('redemptions'), int('expiresAt'), bool('active'),
]
const AUDIT_FIELDS = [
  nat('id'), int('at'), principal('who'), text('kind'), text('detail'),
  nat('orderId'), nat('productId'),
]
const STATS_FIELDS = [
  nat('products'), nat('activeProducts'), nat('categories'),
  nat('ordersTotal'), nat('ordersPlaced'), nat('ordersShipped'), nat('ordersDelivered'),
  nat('ordersCancelled'), nat('ordersRefunded'),
  nat('unitsOnHand'), nat('unitsReserved'), nat('unitsSold'), nat('unitsReturned'),
  nat('revenueE8s'), nat('activeHolds'), nat('discountsActive'),
  nat('invoiceCount'), nat('auditEvents'),
]
const CONSERVATION_FIELDS = [
  nat('productsChecked'), nat('violations'), nat('unitsOnHand'), nat('unitsReserved'), int('checkedAt'),
]
const VIOLATION_FIELDS = [nat('productId'), text('name'), text('rule'), nat('expected'), nat('actual')]
const INVOICE_FIELDS = [
  nat('id'), principal('issuer'), principal('recipient'),
  nat('subtotalE8s'), nat('taxE8s'), nat('totalE8s'),
  text('status'), nat('itemCount'), int('createdAt'),
]

// ── Decoders (stable references — safe as useQuery deps) ──

const vec = <T>(fields: { name: string; type: 'nat' | 'int' | 'bool' | 'text' | 'principal' }[]) =>
  (replyHex: string): T[] => decodeVecRecord(replyHex, fields) as unknown as T[]

export const decodeProducts = vec<Product>(PRODUCT_FIELDS)
export const decodeAdminProducts = vec<AdminProduct>(ADMIN_PRODUCT_FIELDS)
export const decodeCategories = vec<Category>(CATEGORY_FIELDS)
export const decodeCart = vec<CartLine>(CART_FIELDS)
export const decodeHold = vec<Hold>(HOLD_FIELDS)
export const decodeHoldLines = vec<HoldLine>(HOLD_LINE_FIELDS)
export const decodeQuote = vec<Quote>(QUOTE_FIELDS)
export const decodeOrders = vec<OrderRow>(ORDER_FIELDS)
export const decodeAdminOrders = vec<AdminOrderRow>(ADMIN_ORDER_FIELDS)
export const decodeOrderLines = vec<OrderLine>(ORDER_LINE_FIELDS)
export const decodeOrderEvents = vec<OrderEvent>(ORDER_EVENT_FIELDS)
export const decodeDiscounts = vec<Discount>(DISCOUNT_FIELDS)
export const decodeAudit = vec<AuditRow>(AUDIT_FIELDS)
export const decodeStats = vec<ShopStats>(STATS_FIELDS)
export const decodeConservation = vec<Conservation>(CONSERVATION_FIELDS)
export const decodeViolations = vec<InvariantViolation>(VIOLATION_FIELDS)
export const decodeInvoices = vec<InvoiceRow>(INVOICE_FIELDS)

// Query method names (paired with the decoders above via useQuery in pages).
export const M = {
  productsView: 'getProductsView',
  adminProductsView: 'getAdminProductsView',
  categoriesView: 'getCategoriesView',
  cartView: 'getCartView',
  holdView: 'getMyReservationView',
  holdLinesView: 'getMyReservationLinesView',
  quoteView: 'quoteCheckoutView',
  ordersView: 'getOrderHistoryView',
  allOrdersView: 'getAllOrdersView',
  orderView: 'getOrderView',
  orderLinesView: 'getOrderLinesView',
  orderEventsView: 'getOrderEventsView',
  discountsView: 'getDiscountsView',
  auditView: 'getAuditView',
  statsView: 'getShopStatsView',
  conservationView: 'conservationView',
  invariantsView: 'invariantReportView',
  invoicesView: 'myInvoicesView',
} as const

// ── Arg encoders for parameterised queries ──

export const argNat = (v: bigint) => encodeArgs([{ type: 'nat', value: v }])
export const argText = (v: string) => encodeArgs([{ type: 'text', value: v }])
export const argPage = (offset: number, limit: number) =>
  encodeArgs([{ type: 'nat', value: BigInt(offset) }, { type: 'nat', value: BigInt(limit) }])

// ── Writes ──

export async function addToCart(productId: bigint, quantity: number): Promise<void> {
  await update(STORE_CID, 'addToCart', encodeArgs([
    { type: 'nat', value: productId },
    { type: 'nat', value: BigInt(quantity) },
  ]))
}

export async function setCartQuantity(productId: bigint, quantity: number): Promise<void> {
  await update(STORE_CID, 'setCartQuantity', encodeArgs([
    { type: 'nat', value: productId },
    { type: 'nat', value: BigInt(quantity) },
  ]))
}

export async function removeFromCart(productId: bigint): Promise<void> {
  await update(STORE_CID, 'removeFromCart', encodeArgs([{ type: 'nat', value: productId }]))
}

/** Take a checkout hold: stock moves into reserve for the hold window. */
export async function beginCheckout(): Promise<void> {
  await update(STORE_CID, 'beginCheckoutOrTrap')
}

export async function cancelCheckout(): Promise<void> {
  await update(STORE_CID, 'cancelCheckout')
}

/** Place the order (promo code optional, "" for none) → the new order id. */
export async function checkout(code: string): Promise<bigint> {
  const r = await update(STORE_CID, 'checkoutOrTrap', encodeArgs([{ type: 'text', value: code }]))
  return decodeNat(r.reply_hex ?? r.reply ?? '')
}

export async function cancelOrder(orderId: bigint): Promise<void> {
  await update(STORE_CID, 'cancelOrderOrTrap', encodeArgs([{ type: 'nat', value: orderId }]))
}

export async function claimOwner(): Promise<void> {
  await update(STORE_CID, 'claimOwner')
}

/** Seed a demo shop on a fresh store (no-op once any product exists). */
export async function seedDemo(): Promise<void> {
  await update(STORE_CID, 'seedDemo')
}

// ── Admin writes ──

export async function addProduct(
  name: string,
  description: string,
  priceE8s: bigint,
  initialStock: number,
  categoryId: bigint, // 0n = none
  photoPath: string | null,
): Promise<bigint> {
  const r = await update(STORE_CID, 'addProduct', encodeArgs([
    { type: 'text', value: name },
    { type: 'text', value: description },
    { type: 'nat', value: priceE8s },
    { type: 'nat', value: BigInt(initialStock) },
    { type: 'nat', value: categoryId },
    { type: 'opt', inner: { type: 'text' }, value: photoPath },
  ]))
  return decodeNat(r.reply_hex ?? r.reply ?? '')
}

export async function updateProduct(
  productId: bigint,
  name: string,
  description: string,
  priceE8s: bigint,
  categoryId: bigint,
): Promise<void> {
  await update(STORE_CID, 'updateProduct', encodeArgs([
    { type: 'nat', value: productId },
    { type: 'text', value: name },
    { type: 'text', value: description },
    { type: 'nat', value: priceE8s },
    { type: 'nat', value: categoryId },
  ]))
}

export async function setProductPhoto(productId: bigint, photoPath: string): Promise<void> {
  await update(STORE_CID, 'setProductPhoto', encodeArgs([
    { type: 'nat', value: productId },
    { type: 'text', value: photoPath },
  ]))
}

export async function setProductArchived(productId: bigint, archived: boolean): Promise<void> {
  await update(STORE_CID, 'setProductArchived', encodeArgs([
    { type: 'nat', value: productId },
    { type: 'bool', value: archived },
  ]))
}

export async function restock(productId: bigint, additional: number): Promise<void> {
  await update(STORE_CID, 'restockProduct', encodeArgs([
    { type: 'nat', value: productId },
    { type: 'nat', value: BigInt(additional) },
  ]))
}

export async function addCategory(name: string): Promise<bigint> {
  const r = await update(STORE_CID, 'addCategory', encodeArgs([{ type: 'text', value: name }]))
  return decodeNat(r.reply_hex ?? r.reply ?? '')
}

export async function renameCategory(id: bigint, name: string): Promise<void> {
  await update(STORE_CID, 'renameCategory', encodeArgs([
    { type: 'nat', value: id },
    { type: 'text', value: name },
  ]))
}

export async function createDiscount(
  code: string,
  percentBps: number, // exactly one of percentBps / fixedE8s is non-zero
  fixedE8s: bigint,
  minSubtotalE8s: bigint,
  maxRedemptions: number,
  expiresAtNs: bigint, // 0n = never
): Promise<void> {
  await update(STORE_CID, 'createDiscount', encodeArgs([
    { type: 'text', value: code },
    { type: 'nat', value: BigInt(percentBps) },
    { type: 'nat', value: fixedE8s },
    { type: 'nat', value: minSubtotalE8s },
    { type: 'nat', value: BigInt(maxRedemptions) },
    { type: 'int', value: expiresAtNs },
  ]))
}

export async function setDiscountActive(code: string, active: boolean): Promise<void> {
  await update(STORE_CID, 'setDiscountActive', encodeArgs([
    { type: 'text', value: code },
    { type: 'bool', value: active },
  ]))
}

export async function shipOrder(orderId: bigint): Promise<void> {
  await update(STORE_CID, 'shipOrder', encodeArgs([{ type: 'nat', value: orderId }]))
}
export async function deliverOrder(orderId: bigint): Promise<void> {
  await update(STORE_CID, 'deliverOrder', encodeArgs([{ type: 'nat', value: orderId }]))
}
export async function refundOrder(orderId: bigint): Promise<void> {
  await update(STORE_CID, 'refundOrder', encodeArgs([{ type: 'nat', value: orderId }]))
}
export async function adminCancelOrder(orderId: bigint): Promise<void> {
  await update(STORE_CID, 'adminCancelOrder', encodeArgs([{ type: 'nat', value: orderId }]))
}

export { query, STORE_CID }
