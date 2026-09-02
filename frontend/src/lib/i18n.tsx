import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * The souk speaks two languages. One typed message catalogue, two complete
 * renderings — English and Arabic — and the compiler holds them in parity:
 * `Messages` is the contract, so a key added to one language without the
 * other fails the build, not the shopper.
 *
 * Direction comes with the language: picking Arabic stamps `dir="rtl"` on
 * <html>, and the layout mirrors through CSS logical properties (ms-/me-,
 * ps-/pe-, start/end) — there is no second stylesheet.
 *
 * Two deliberate choices, stated once:
 * - Digits stay Latin in both languages. Prices, stock counts and the ledger
 *   table are tabular columns; one numeral system keeps them aligned and
 *   comparable everywhere.
 * - Counted nouns go through Intl.PluralRules. Arabic inflects counts six
 *   ways (zero/one/two/few/many/other) — a "s"-suffix helper would read as
 *   broken Arabic on every shelf label.
 */
export type Lang = 'en' | 'ar'

const RULES: Record<Lang, Intl.PluralRules> = {
  en: new Intl.PluralRules('en'),
  ar: new Intl.PluralRules('ar'),
}

type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }

/** Pick the CLDR plural form for n and substitute it into "{n}". */
function plural(lang: Lang, n: number | bigint, forms: PluralForms): string {
  const form = forms[RULES[lang].select(Number(n))] ?? forms.other
  return form.replace('{n}', n.toString())
}

export interface Messages {
  // ── App chrome ──
  appTitle: string
  brand: string
  navBrowse: string
  navOrders: string
  navAdmin: string
  navCart: string
  cartBadge: (n: number) => string
  footerLine: string
  loading: string
  themeToLight: string
  themeToDark: string
  themeLight: string
  themeDark: string
  langToggleLabel: string
  langToggleShort: string
  decrease: (label: string) => string
  increase: (label: string) => string

  // ── Browse ──
  openingSouk: string
  stallsEmptyTitle: string
  stallsEmptyHint: string
  goToAdmin: string
  heroKicker: string
  heroTitle: string
  heroLede: string
  walkTheStalls: string
  trackAnOrder: string
  stripProducts: (n: bigint) => string
  stripUnits: (n: bigint) => string
  stripHeld: (n: bigint) => string
  stripAudited: string
  stripViolations: string
  searchIn: (q: string, cat: string) => string
  searchAcross: (q: string) => string
  searchSouk: string
  searchPlaceholder: string
  searchCatPlaceholder: (cat: string) => string
  searchAllAria: string
  searchCatAria: (cat: string) => string
  clearSearch: string
  noMatchTitle: (q: string) => string
  emptyAisleTitle: string
  noMatchInCatHint: (cat: string) => string
  noMatchHint: string
  emptyAisleHint: string
  showEverything: string

  // ── Category rail ──
  byCategory: string
  emptyAisleCard: string
  itemCount: (n: bigint) => string
  showing: string
  walkThisAisle: string

  // ── Product card / page ──
  allHeld: string
  soldOut: string
  noneAvailable: string
  available: (n: bigint) => string
  loadingProduct: string
  notFoundTitle: string
  notFoundHint: string
  backToSouk: string
  backToSoukArrow: string
  noneAvailableLong: string
  outOfStock: string
  heldInOtherCarts: (n: bigint) => string
  accountedOnChain: string
  onTheShelf: (n: bigint) => string
  held: (n: bigint) => string
  everyUnitAudited: string
  quantity: string
  adding: string
  addToCart: string
  added: string
  goToCart: string

  // ── Cart ──
  loadingCart: string
  cartEmptyTitle: string
  cartEmptyHint: string
  browseTheShop: string
  cartTitle: string
  eachAvailable: (price: string, n: bigint) => string
  removeFromCart: (name: string) => string
  remove: string
  total: string
  keepShopping: string
  settingAside: string
  reviewOrder: string
  holdExplainer: string

  // ── Checkout ──
  orderPlacedTitle: (id: bigint) => string
  orderPlacedHint: string
  viewOrders: string
  loadingHold: string
  holdExpiredTitle: string
  noActiveHold: string
  holdGoneHint: string
  backToCart: string
  holdSetAside: string
  promoCode: string
  apply: string
  clear: string
  promoApplied: (code: string, amount: string) => string
  promoRejected: string
  subtotal: string
  promoLine: (code: string) => string
  releaseHold: string
  placingOrder: string
  placeOrder: string

  // ── Orders (buyer) ──
  loadingOrders: string
  noOrdersTitle: string
  noOrdersHint: string
  yourOrders: string
  orderNo: (id: bigint) => string
  orderMeta: (n: bigint) => string
  promoTag: (code: string) => string
  hideDetail: string
  showDetail: string
  loadingLines: string
  eventLabels: Record<string, string>
  statusLabels: Record<string, string>
  cancelling: string
  cancelOrder: string

  // ── Conservation seal ──
  sealOk: (products: bigint, onHand: bigint) => string
  sealHeld: (n: bigint) => string
  sealAudited: string
  sealBad: (n: bigint) => string
  sealReportTitle: string
  ruleConservation: string
  ruleReserveMatch: string
  ruleReserveBound: string
  rerunningAudit: string
  reportEmpty: string
  reportViolations: string
  expectedGot: (expected: bigint, actual: bigint) => string

  // ── Admin shell ──
  checkingKeys: string
  adminSections: string
  tabOverview: string
  tabOrders: string
  tabCatalogue: string
  tabPromos: string
  tabLedger: string
  shopOwner: string
  claimExplainer: string
  claiming: string
  claimOwnership: string
  loadingSimple: string
  loadDemoShop: string
  ownershipClaimed: string
  demoLoaded: string

  // ── Admin: overview ──
  computingStats: string
  statsUnavailable: string
  statRevenue: string
  statToFulfil: string
  statOnHand: string
  statHeld: string
  orderBook: string
  statPlaced: string
  statShipped: string
  statDelivered: string
  statCancelled: string
  statRefunded: string
  lifetimeLedger: string
  statSold: string
  statReturned: string
  statInvoices: string
  statAuditEntries: string
  catalogueHeading: string
  statLive: string
  statTotal: string
  statCategories: string
  statPromosActive: string

  // ── Admin: orders ──
  loadingOrderBook: string
  ordersLandHere: string
  newer: string
  older: string
  buyer: (hex: string) => string
  ship: string
  cancel: string
  markDelivered: string
  refundRestock: string

  // ── Admin: ledger ──
  openingBooks: string
  inventoryLedger: string
  invariantsHold: string
  violationCount: (n: number) => string
  ledgerExplainer: string
  thProduct: string
  thReceived: string
  thSold: string
  thReturned: string
  thOnHand: string
  thHeld: string
  thBooks: string
  archived: string
  balanced: string
  noProductsOnBooks: string
  auditTrail: string
  auditExplainer: string
  auditOrderRef: (id: bigint) => string
  auditProductRef: (id: bigint) => string
  nothingAtPage: string

  // ── Admin: promos ──
  liveCodes: string
  noPromosTitle: string
  noPromosHint: string
  newPromo: string
  fieldCode: string
  fieldType: string
  percentOff: string
  fixedOff: string
  fieldPercent: string
  fieldAmount: string
  fieldMinimum: string
  fieldMaxRedemptions: string
  codeLive: (code: string) => string
  creating: string
  createCode: string
  worthPercent: (p: string) => string
  worthFixed: (a: string) => string
  minTag: (a: string) => string
  redeemed: (n: bigint, cap: bigint) => string
  deactivate: string
  reactivate: string
  offBadge: string

  // ── Admin: catalogue ──
  seedExplainer: string
  addAProduct: string
  photo: string
  newProductAlt: string
  uploading: (pct: number) => string
  storedOnChain: string
  compressedNote: string
  fieldName: string
  fieldDescription: string
  fieldPrice: string
  fieldStock: string
  fieldCategory: string
  noCategory: string
  addedProduct: (id: bigint) => string
  addProduct: string
  categoriesTitle: string
  noCategoriesYet: string
  newCategoryPlaceholder: string
  add: string
  close: string
  edit: string
  restockAria: (name: string) => string
  restock: string
  heldParen: (n: bigint) => string
  unarchive: string
  archive: string
  saveChanges: string
  namePlaceholder: string
  descPlaceholder: string

  // ── Media / art ──
  noImage: (alt: string) => string
  illustration: (name: string) => string
}

const en: Messages = {
  appTitle: 'Souk — on-chain storefront',
  brand: 'souk',
  navBrowse: 'Browse',
  navOrders: 'Orders',
  navAdmin: 'Admin',
  navCart: 'Cart',
  cartBadge: (n) => plural('en', n, { one: '{n} line in cart', other: '{n} lines in cart' }),
  footerLine:
    'An on-chain storefront — the shop, the catalogue, every product photo and every ledger entry live on the chain. You own it.',
  loading: 'Loading',
  themeToLight: 'Switch to light mode',
  themeToDark: 'Switch to dark mode',
  themeLight: 'Light mode',
  themeDark: 'Dark mode',
  langToggleLabel: 'التبديل إلى العربية',
  langToggleShort: 'ع',
  decrease: (label) => `Decrease ${label}`,
  increase: (label) => `Increase ${label}`,

  openingSouk: 'Opening the souk',
  stallsEmptyTitle: 'The stalls are empty',
  stallsEmptyHint:
    'This souk has no products yet. Open Admin to add the first one — with its own on-chain artwork.',
  goToAdmin: 'Go to Admin',
  heroKicker: 'An on-chain souk',
  heroTitle: 'A market that keeps honest books.',
  heroLede:
    'Hand-picked goods on an open ledger. The shelves, the checkout holds and the audit all live on-chain — nothing behind the counter.',
  walkTheStalls: 'Walk the stalls',
  trackAnOrder: 'Track an order →',
  stripProducts: (n) => plural('en', n, { one: '{n} product', other: '{n} products' }),
  stripUnits: (n) => plural('en', n, { one: '{n} unit on the shelves', other: '{n} units on the shelves' }),
  stripHeld: (n) => plural('en', n, { one: '{n} held at checkout', other: '{n} held at checkout' }),
  stripAudited: '✓ books audited on-chain',
  stripViolations: '✗ audit found violations',
  searchIn: (q, cat) => `“${q}” in ${cat}`,
  searchAcross: (q) => `“${q}” across the souk`,
  searchSouk: 'Search the souk',
  searchPlaceholder: 'Search the souk…',
  searchCatPlaceholder: (cat) => `Search ${cat}…`,
  searchAllAria: 'Search all products',
  searchCatAria: (cat) => `Search within ${cat}`,
  clearSearch: 'Clear search',
  noMatchTitle: (q) => `Nothing matches “${q}”`,
  emptyAisleTitle: 'Nothing in this aisle yet',
  noMatchInCatHint: (cat) => `No ${cat.toLowerCase()} match that. Try the whole souk, or clear the search.`,
  noMatchHint: 'Try a different word — or wander the aisles instead.',
  emptyAisleHint: 'The shopkeeper is still stocking this corner of the market.',
  showEverything: 'Show everything',

  byCategory: 'Browse by category',
  emptyAisleCard: 'An empty aisle, for now.',
  itemCount: (n) => plural('en', n, { one: '{n} item', other: '{n} items' }),
  showing: 'showing ✓',
  walkThisAisle: 'walk this aisle →',

  allHeld: 'All held',
  soldOut: 'Sold out',
  noneAvailable: 'none available',
  available: (n) => plural('en', n, { one: '{n} available', other: '{n} available' }),
  loadingProduct: 'Loading product',
  notFoundTitle: 'Product not found',
  notFoundHint: 'It may have been removed.',
  backToSouk: 'Back to the souk',
  backToSoukArrow: '← Back to the souk',
  noneAvailableLong: 'None available — all held in other checkouts',
  outOfStock: 'Out of stock',
  heldInOtherCarts: (n) => plural('en', n, { one: '{n} held in another cart', other: '{n} held in other carts' }),
  accountedOnChain: 'Accounted on-chain',
  onTheShelf: (n) => `${n} on the shelf`,
  held: (n) => `${n} held`,
  everyUnitAudited: 'every unit audited — anyone can re-run the check',
  quantity: 'quantity',
  adding: 'Adding…',
  addToCart: 'Add to cart',
  added: 'Added.',
  goToCart: 'Go to cart',

  loadingCart: 'Loading cart',
  cartEmptyTitle: 'Your cart is empty',
  cartEmptyHint: 'Browse the shelf and add something you like.',
  browseTheShop: 'Browse the shop',
  cartTitle: 'Cart',
  eachAvailable: (price, n) => `◈${price} each · ${plural('en', n, { one: '{n} available', other: '{n} available' })}`,
  removeFromCart: (name) => `Remove ${name} from cart`,
  remove: 'Remove',
  total: 'Total',
  keepShopping: 'Keep shopping',
  settingAside: 'Setting stock aside…',
  reviewOrder: 'Review order',
  holdExplainer:
    'Reviewing holds your items on-chain for 10 minutes, so nobody can buy them out from under you.',

  orderPlacedTitle: (id) => `Order #${id} placed`,
  orderPlacedHint: 'Stock moved from the shelf to your order in one atomic step. Track it in Orders.',
  viewOrders: 'View orders',
  loadingHold: 'Loading your hold',
  holdExpiredTitle: 'Your hold expired',
  noActiveHold: 'No active hold',
  holdGoneHint:
    'The stock went back on the shelf for other shoppers. Your cart is untouched — review it again to take a fresh hold.',
  backToCart: 'Back to cart',
  holdSetAside: 'These items are set aside for you on-chain until the timer runs out.',
  promoCode: 'Promo code',
  apply: 'Apply',
  clear: 'Clear',
  promoApplied: (code, amount) => `${code} applied — you save ◈${amount}.`,
  promoRejected: 'That code did not apply.',
  subtotal: 'Subtotal',
  promoLine: (code) => `Promo ${code}`,
  releaseHold: 'Release hold',
  placingOrder: 'Placing order…',
  placeOrder: 'Place order',

  loadingOrders: 'Loading orders',
  noOrdersTitle: 'No orders yet',
  noOrdersHint: 'When you check out, your orders, their timeline and delivery status appear here.',
  yourOrders: 'Your orders',
  orderNo: (id) => `Order #${id}`,
  orderMeta: (n) => plural('en', n, { one: '{n} item', other: '{n} items' }),
  promoTag: (code) => `promo ${code}`,
  hideDetail: 'Hide detail ▴',
  showDetail: 'Detail ▾',
  loadingLines: 'Loading lines',
  eventLabels: {
    'order.place': 'Order placed',
    'order.ship': 'Shipped',
    'order.deliver': 'Delivered',
    'order.cancel': 'Cancelled',
    'order.refund': 'Refunded',
  },
  statusLabels: {
    placed: 'placed',
    shipped: 'shipped',
    delivered: 'delivered',
    cancelled: 'cancelled',
    refunded: 'refunded',
  },
  cancelling: 'Cancelling…',
  cancelOrder: 'Cancel order',

  sealOk: (products, onHand) =>
    `The books balance — ${plural('en', products, { one: '{n} product', other: '{n} products' })}, ` +
    `${plural('en', onHand, { one: '{n} unit on hand', other: '{n} units on hand' })}`,
  sealHeld: (n) => `, ${n} held at checkout`,
  sealAudited: ' · audited on-chain',
  sealBad: (n) => `Audit found ${plural('en', n, { one: '{n} violation', other: '{n} violations' })} — open the report`,
  sealReportTitle: 'What the on-chain audit checks, for every product',
  ruleConservation: 'units on hand + units sold = units received + units returned',
  ruleReserveMatch: 'the reserve counter equals the sum of active checkout holds',
  ruleReserveBound: 'reserved stock never exceeds stock on hand',
  rerunningAudit: 'Re-running the audit…',
  reportEmpty:
    'The report is empty — every invariant holds right now. Call invariantReportView on the contract to reproduce this yourself.',
  reportViolations:
    'Violations below (this should never happen — it means a bug in the shop, and the audit caught it):',
  expectedGot: (expected, actual) => `expected ${expected} got ${actual}`,

  checkingKeys: 'Checking your keys',
  adminSections: 'Admin sections',
  tabOverview: 'Overview',
  tabOrders: 'Orders',
  tabCatalogue: 'Catalogue',
  tabPromos: 'Promos',
  tabLedger: 'Ledger',
  shopOwner: 'Shop owner',
  claimExplainer:
    'This shop is claimed by its first caller. After that, only the owner and their admins can manage the catalogue, promos and orders — everyone else just shops.',
  claiming: 'Claiming…',
  claimOwnership: 'Claim ownership',
  loadingSimple: 'Loading…',
  loadDemoShop: 'Load demo shop',
  ownershipClaimed: 'Ownership claimed — opening the back office…',
  demoLoaded: 'Demo shop loaded. Claim ownership to manage it.',

  computingStats: 'Computing shop stats',
  statsUnavailable: 'Stats unavailable.',
  statRevenue: 'Revenue (live orders)',
  statToFulfil: 'Orders to fulfil',
  statOnHand: 'Units on hand',
  statHeld: 'Held at checkout',
  orderBook: 'Order book',
  statPlaced: 'Placed',
  statShipped: 'Shipped',
  statDelivered: 'Delivered',
  statCancelled: 'Cancelled',
  statRefunded: 'Refunded',
  lifetimeLedger: 'Lifetime ledger',
  statSold: 'Units sold',
  statReturned: 'Units returned',
  statInvoices: 'Invoices issued',
  statAuditEntries: 'Audit entries',
  catalogueHeading: 'Catalogue',
  statLive: 'Products live',
  statTotal: 'Products total',
  statCategories: 'Categories',
  statPromosActive: 'Promos active',

  loadingOrderBook: 'Loading the order book',
  ordersLandHere: 'Orders land here the moment a buyer checks out.',
  newer: '← Newer',
  older: 'Older →',
  buyer: (hex) => `buyer ${hex}`,
  ship: 'Ship',
  cancel: 'Cancel',
  markDelivered: 'Mark delivered',
  refundRestock: 'Refund & restock',

  openingBooks: 'Opening the books',
  inventoryLedger: 'Inventory ledger',
  invariantsHold: '✓ every invariant holds',
  violationCount: (n) => plural('en', n, { one: '{n} violation', other: '{n} violations' }),
  ledgerExplainer:
    'For every product: on hand + sold = received + returned, and the reserve counter must match active checkout holds. Recomputed on-chain each read.',
  thProduct: 'Product',
  thReceived: 'Received',
  thSold: 'Sold',
  thReturned: 'Returned',
  thOnHand: 'On hand',
  thHeld: 'Held',
  thBooks: 'Books',
  archived: 'archived',
  balanced: 'balanced',
  noProductsOnBooks: 'No products on the books yet.',
  auditTrail: 'Audit trail',
  auditExplainer:
    "Append-only. Every state change lands here with its actor — buyers see their order's slice of this same log.",
  auditOrderRef: (id) => `order #${id}`,
  auditProductRef: (id) => `product #${id}`,
  nothingAtPage: 'Nothing here yet at this page.',

  liveCodes: 'Live codes',
  noPromosTitle: 'No promo codes',
  noPromosHint: 'Create one — buyers apply it at checkout and the discount lands on the invoice, unit-exactly.',
  newPromo: 'New promo code',
  fieldCode: 'Code',
  fieldType: 'Type',
  percentOff: 'Percent off',
  fixedOff: 'Fixed amount off',
  fieldPercent: 'Percent (%)',
  fieldAmount: 'Amount (◈)',
  fieldMinimum: 'Order minimum (◈, optional)',
  fieldMaxRedemptions: 'Max redemptions (0 = ∞)',
  codeLive: (code) => `Code ${code} is live`,
  creating: 'Creating…',
  createCode: 'Create code',
  worthPercent: (p) => `${p}% off`,
  worthFixed: (a) => `◈${a} off`,
  minTag: (a) => `min ◈${a}`,
  redeemed: (n, cap) => `${n}${cap > 0n ? ` / ${cap}` : ''} redeemed`,
  deactivate: 'Deactivate',
  reactivate: 'Reactivate',
  offBadge: 'off',

  seedExplainer:
    'No products yet. Add the first one — or load the demo shop (3 categories, 8 products, 2 promo codes) to see everything working.',
  addAProduct: 'Add a product',
  photo: 'Photo',
  newProductAlt: 'New product',
  uploading: (pct) => `Uploading… ${pct}%`,
  storedOnChain: 'Stored on-chain ✓',
  compressedNote: 'Compressed on-chain to a bounded JPEG/WebP.',
  fieldName: 'Name',
  fieldDescription: 'Description',
  fieldPrice: 'Price (◈)',
  fieldStock: 'Stock',
  fieldCategory: 'Category',
  noCategory: 'None',
  addedProduct: (id) => `Added product #${id}`,
  addProduct: 'Add product',
  categoriesTitle: 'Categories',
  noCategoriesYet: 'No categories yet.',
  newCategoryPlaceholder: 'New category',
  add: 'Add',
  close: 'Close',
  edit: 'Edit',
  restockAria: (name) => `Restock ${name}`,
  restock: 'Restock',
  heldParen: (n) => `(${n} held)`,
  unarchive: 'Unarchive',
  archive: 'Archive',
  saveChanges: 'Save changes',
  namePlaceholder: 'Hand-thrown mug',
  descPlaceholder: 'Stoneware, 300ml…',

  noImage: (alt) => `${alt} — no image`,
  illustration: (name) => `${name} — illustration`,
}

const ar: Messages = {
  appTitle: 'السوق — متجر على السلسلة',
  brand: 'سوق',
  navBrowse: 'تجوَّل',
  navOrders: 'الطلبات',
  navAdmin: 'الإدارة',
  navCart: 'السلة',
  cartBadge: (n) =>
    plural('ar', n, {
      zero: 'السلة فارغة',
      one: 'سطر واحد في السلة',
      two: 'سطران في السلة',
      few: '{n} سطور في السلة',
      many: '{n} سطرًا في السلة',
      other: '{n} سطر في السلة',
    }),
  footerLine:
    'متجر على السلسلة — المحل والكتالوج وكل صورة منتج وكل قيد في الدفاتر يعيش على السلسلة. إنه ملكك.',
  loading: 'جارٍ التحميل',
  themeToLight: 'التبديل إلى الوضع الفاتح',
  themeToDark: 'التبديل إلى الوضع الداكن',
  themeLight: 'الوضع الفاتح',
  themeDark: 'الوضع الداكن',
  langToggleLabel: 'Switch to English',
  langToggleShort: 'EN',
  decrease: (label) => `تقليل ${label}`,
  increase: (label) => `زيادة ${label}`,

  openingSouk: 'نفتح السوق',
  stallsEmptyTitle: 'البسطات فارغة',
  stallsEmptyHint: 'لا منتجات في هذا السوق بعد. افتح الإدارة وأضف أول منتج — بلوحته المرسومة على السلسلة.',
  goToAdmin: 'إلى الإدارة',
  heroKicker: 'سوق على السلسلة',
  heroTitle: 'سوقٌ يمسك دفاتره بأمانة.',
  heroLede:
    'بضائع منتقاة بعناية على دفتر مفتوح. الرفوف وحجوزات الشراء والتدقيق كلها تعيش على السلسلة — لا شيء مخبأ خلف الطاولة.',
  walkTheStalls: 'تمشَّ بين البسطات',
  trackAnOrder: '← تتبَّع طلبك',
  stripProducts: (n) =>
    plural('ar', n, {
      zero: 'لا منتجات',
      one: 'منتج واحد',
      two: 'منتجان',
      few: '{n} منتجات',
      many: '{n} منتجًا',
      other: '{n} منتج',
    }),
  stripUnits: (n) =>
    plural('ar', n, {
      zero: 'لا وحدات على الرفوف',
      one: 'وحدة واحدة على الرفوف',
      two: 'وحدتان على الرفوف',
      few: '{n} وحدات على الرفوف',
      many: '{n} وحدة على الرفوف',
      other: '{n} وحدة على الرفوف',
    }),
  stripHeld: (n) =>
    plural('ar', n, {
      one: 'وحدة واحدة محجوزة عند الدفع',
      two: 'وحدتان محجوزتان عند الدفع',
      few: '{n} وحدات محجوزة عند الدفع',
      many: '{n} وحدة محجوزة عند الدفع',
      other: '{n} محجوزة عند الدفع',
    }),
  stripAudited: '✓ الدفاتر مدقَّقة على السلسلة',
  stripViolations: '✗ وجد التدقيق مخالفات',
  searchIn: (q, cat) => `«${q}» في ${cat}`,
  searchAcross: (q) => `«${q}» في السوق كله`,
  searchSouk: 'ابحث في السوق',
  searchPlaceholder: 'ابحث في السوق…',
  searchCatPlaceholder: (cat) => `ابحث في ${cat}…`,
  searchAllAria: 'ابحث في كل المنتجات',
  searchCatAria: (cat) => `ابحث ضمن ${cat}`,
  clearSearch: 'امسح البحث',
  noMatchTitle: (q) => `لا شيء يطابق «${q}»`,
  emptyAisleTitle: 'لا شيء في هذا الممر بعد',
  noMatchInCatHint: (cat) => `لا شيء في ${cat} يطابق بحثك. جرّب السوق كله، أو امسح البحث.`,
  noMatchHint: 'جرّب كلمة أخرى — أو تمشَّ بين الممرات.',
  emptyAisleHint: 'ما زال صاحب المحل يرصّ بضاعة هذا الركن.',
  showEverything: 'اعرض كل شيء',

  byCategory: 'تصفَّح حسب الفئة',
  emptyAisleCard: 'ممرٌ فارغ، حتى الآن.',
  itemCount: (n) =>
    plural('ar', n, {
      zero: 'لا قطع',
      one: 'قطعة واحدة',
      two: 'قطعتان',
      few: '{n} قطع',
      many: '{n} قطعة',
      other: '{n} قطعة',
    }),
  showing: 'معروض ✓',
  walkThisAisle: '← ادخل هذا الممر',

  allHeld: 'محجوز كله',
  soldOut: 'نفدت الكمية',
  noneAvailable: 'غير متوفر',
  available: (n) =>
    plural('ar', n, {
      zero: 'غير متوفر',
      one: 'قطعة واحدة متوفرة',
      two: 'قطعتان متوفرتان',
      few: '{n} قطع متوفرة',
      many: '{n} قطعة متوفرة',
      other: '{n} متوفر',
    }),
  loadingProduct: 'جارٍ تحميل المنتج',
  notFoundTitle: 'المنتج غير موجود',
  notFoundHint: 'ربما أُزيل من المتجر.',
  backToSouk: 'عودة إلى السوق',
  backToSoukArrow: '→ عودة إلى السوق',
  noneAvailableLong: 'لا شيء متوفر — كله محجوز في عمليات شراء أخرى',
  outOfStock: 'نفدت الكمية',
  heldInOtherCarts: (n) =>
    plural('ar', n, {
      one: 'قطعة واحدة محجوزة في سلة أخرى',
      two: 'قطعتان محجوزتان في سلات أخرى',
      few: '{n} قطع محجوزة في سلات أخرى',
      many: '{n} قطعة محجوزة في سلات أخرى',
      other: '{n} محجوزة في سلات أخرى',
    }),
  accountedOnChain: 'محسوبة على السلسلة',
  onTheShelf: (n) => `${n} على الرف`,
  held: (n) => `${n} محجوزة`,
  everyUnitAudited: 'كل وحدة مدقَّقة — وبإمكان أي أحد إعادة الفحص',
  quantity: 'الكمية',
  adding: 'جارٍ الإضافة…',
  addToCart: 'أضِف إلى السلة',
  added: 'أُضيف.',
  goToCart: 'اذهب إلى السلة',

  loadingCart: 'جارٍ تحميل السلة',
  cartEmptyTitle: 'سلتك فارغة',
  cartEmptyHint: 'تجوَّل بين الرفوف وأضف ما يعجبك.',
  browseTheShop: 'تجوَّل في المتجر',
  cartTitle: 'السلة',
  eachAvailable: (price, n) =>
    `◈${price} للقطعة · ${plural('ar', n, {
      zero: 'غير متوفر',
      one: 'قطعة واحدة متوفرة',
      two: 'قطعتان متوفرتان',
      few: '{n} قطع متوفرة',
      many: '{n} قطعة متوفرة',
      other: '{n} متوفر',
    })}`,
  removeFromCart: (name) => `أزل ${name} من السلة`,
  remove: 'إزالة',
  total: 'الإجمالي',
  keepShopping: 'واصل التسوق',
  settingAside: 'جارٍ حجز البضاعة…',
  reviewOrder: 'راجع الطلب',
  holdExplainer: 'المراجعة تحجز قطعك على السلسلة عشر دقائق، فلا يخطفها أحد من بين يديك.',

  orderPlacedTitle: (id) => `سُجِّل الطلب #${id}`,
  orderPlacedHint: 'انتقلت البضاعة من الرف إلى طلبك في خطوة ذرّية واحدة. تتبَّعه في الطلبات.',
  viewOrders: 'اعرض الطلبات',
  loadingHold: 'جارٍ تحميل حجزك',
  holdExpiredTitle: 'انتهت مهلة حجزك',
  noActiveHold: 'لا يوجد حجز نشط',
  holdGoneHint: 'عادت البضاعة إلى الرف لبقية المتسوقين. سلتك كما هي — راجعها من جديد لتأخذ حجزًا جديدًا.',
  backToCart: 'عودة إلى السلة',
  holdSetAside: 'هذه القطع محجوزة لك على السلسلة حتى ينفد العدّاد.',
  promoCode: 'رمز الخصم',
  apply: 'طبِّق',
  clear: 'امسح',
  promoApplied: (code, amount) => `${code} مُطبَّق — توفِّر ◈${amount}.`,
  promoRejected: 'هذا الرمز لم ينطبق.',
  subtotal: 'المجموع الفرعي',
  promoLine: (code) => `خصم ${code}`,
  releaseHold: 'أطلِق الحجز',
  placingOrder: 'جارٍ تسجيل الطلب…',
  placeOrder: 'سجِّل الطلب',

  loadingOrders: 'جارٍ تحميل الطلبات',
  noOrdersTitle: 'لا طلبات بعد',
  noOrdersHint: 'حين تُتمّ الشراء تظهر طلباتك هنا، بخطّها الزمني وحالة التسليم.',
  yourOrders: 'طلباتك',
  orderNo: (id) => `طلب #${id}`,
  orderMeta: (n) =>
    plural('ar', n, {
      zero: 'لا قطع',
      one: 'قطعة واحدة',
      two: 'قطعتان',
      few: '{n} قطع',
      many: '{n} قطعة',
      other: '{n} قطعة',
    }),
  promoTag: (code) => `خصم ${code}`,
  hideDetail: 'أخفِ التفاصيل ▴',
  showDetail: 'التفاصيل ▾',
  loadingLines: 'جارٍ تحميل السطور',
  eventLabels: {
    'order.place': 'سُجِّل الطلب',
    'order.ship': 'شُحن',
    'order.deliver': 'سُلِّم',
    'order.cancel': 'أُلغي',
    'order.refund': 'استُردّ',
  },
  statusLabels: {
    placed: 'مسجَّل',
    shipped: 'مشحون',
    delivered: 'مسلَّم',
    cancelled: 'ملغى',
    refunded: 'مستردّ',
  },
  cancelling: 'جارٍ الإلغاء…',
  cancelOrder: 'ألغِ الطلب',

  sealOk: (products, onHand) =>
    `الدفاتر متوازنة — ${plural('ar', products, {
      zero: 'لا منتجات',
      one: 'منتج واحد',
      two: 'منتجان',
      few: '{n} منتجات',
      many: '{n} منتجًا',
      other: '{n} منتج',
    })}، ${plural('ar', onHand, {
      zero: 'لا وحدات على الرف',
      one: 'وحدة واحدة على الرف',
      two: 'وحدتان على الرف',
      few: '{n} وحدات على الرف',
      many: '{n} وحدة على الرف',
      other: '{n} وحدة على الرف',
    })}`,
  sealHeld: (n) => `، ${n} محجوزة عند الدفع`,
  sealAudited: ' · مدقَّقة على السلسلة',
  sealBad: (n) =>
    `وجد التدقيق ${plural('ar', n, {
      one: 'مخالفة واحدة',
      two: 'مخالفتين',
      few: '{n} مخالفات',
      many: '{n} مخالفة',
      other: '{n} مخالفة',
    })} — افتح التقرير`,
  sealReportTitle: 'ما يفحصه التدقيق على السلسلة، لكل منتج',
  ruleConservation: 'الوحدات على الرف + المبيعة = المستلَمة + المرتجَعة',
  ruleReserveMatch: 'عدّاد الحجز يساوي مجموع حجوزات الدفع النشطة',
  ruleReserveBound: 'المحجوز لا يتجاوز الموجود على الرف أبدًا',
  rerunningAudit: 'جارٍ إعادة التدقيق…',
  reportEmpty: 'التقرير فارغ — كل الثوابت صامدة الآن. استدعِ invariantReportView على العقد لتتحقق بنفسك.',
  reportViolations: 'المخالفات أدناه (هذا لا ينبغي أن يحدث أبدًا — معناه خلل في المتجر، والتدقيق أمسك به):',
  expectedGot: (expected, actual) => `المتوقَّع ${expected} والفعلي ${actual}`,

  checkingKeys: 'جارٍ فحص مفاتيحك',
  adminSections: 'أقسام الإدارة',
  tabOverview: 'نظرة عامة',
  tabOrders: 'الطلبات',
  tabCatalogue: 'الكتالوج',
  tabPromos: 'الخصومات',
  tabLedger: 'الدفاتر',
  shopOwner: 'صاحب المحل',
  claimExplainer:
    'أول من يستدعي هذا المحل يملكه. بعدها لا يدير الكتالوج والخصومات والطلبات إلا المالك ومديروه — والبقية يتسوقون فحسب.',
  claiming: 'جارٍ المطالبة…',
  claimOwnership: 'طالِب بالملكية',
  loadingSimple: 'جارٍ التحميل…',
  loadDemoShop: 'حمِّل المتجر التجريبي',
  ownershipClaimed: 'صارت الملكية لك — نفتح المكتب الخلفي…',
  demoLoaded: 'حُمِّل المتجر التجريبي. طالِب بالملكية لتديره.',

  computingStats: 'جارٍ حساب إحصاءات المحل',
  statsUnavailable: 'الإحصاءات غير متاحة.',
  statRevenue: 'الإيراد (طلبات حيّة)',
  statToFulfil: 'طلبات للتنفيذ',
  statOnHand: 'وحدات على الرف',
  statHeld: 'محجوزة عند الدفع',
  orderBook: 'دفتر الطلبات',
  statPlaced: 'مسجَّلة',
  statShipped: 'مشحونة',
  statDelivered: 'مسلَّمة',
  statCancelled: 'ملغاة',
  statRefunded: 'مستردَّة',
  lifetimeLedger: 'الدفتر التراكمي',
  statSold: 'وحدات مبيعة',
  statReturned: 'وحدات مرتجَعة',
  statInvoices: 'فواتير صادرة',
  statAuditEntries: 'قيود التدقيق',
  catalogueHeading: 'الكتالوج',
  statLive: 'منتجات معروضة',
  statTotal: 'إجمالي المنتجات',
  statCategories: 'الفئات',
  statPromosActive: 'خصومات نشطة',

  loadingOrderBook: 'جارٍ تحميل دفتر الطلبات',
  ordersLandHere: 'تهبط الطلبات هنا لحظة إتمام المشتري للشراء.',
  newer: '→ الأحدث',
  older: 'الأقدم ←',
  buyer: (hex) => `المشتري ${hex}`,
  ship: 'اشحن',
  cancel: 'ألغِ',
  markDelivered: 'علِّم مسلَّمًا',
  refundRestock: 'استردّ وأعد الرصّ',

  openingBooks: 'نفتح الدفاتر',
  inventoryLedger: 'دفتر المخزون',
  invariantsHold: '✓ كل الثوابت صامدة',
  violationCount: (n) =>
    plural('ar', n, {
      one: 'مخالفة واحدة',
      two: 'مخالفتان',
      few: '{n} مخالفات',
      many: '{n} مخالفة',
      other: '{n} مخالفة',
    }),
  ledgerExplainer:
    'لكل منتج: على الرف + المبيع = المستلَم + المرتجَع، وعدّاد الحجز يطابق حجوزات الدفع النشطة. يُعاد حسابها على السلسلة عند كل قراءة.',
  thProduct: 'المنتج',
  thReceived: 'مستلَم',
  thSold: 'مبيع',
  thReturned: 'مرتجَع',
  thOnHand: 'على الرف',
  thHeld: 'محجوز',
  thBooks: 'الدفاتر',
  archived: 'مؤرشف',
  balanced: 'متوازن',
  noProductsOnBooks: 'لا منتجات في الدفاتر بعد.',
  auditTrail: 'سجل التدقيق',
  auditExplainer: 'سجلّ إلحاقي فقط. كل تغيير في الحالة يهبط هنا مع فاعله — والمشترون يرون حصة طلبهم من السجل نفسه.',
  auditOrderRef: (id) => `طلب #${id}`,
  auditProductRef: (id) => `منتج #${id}`,
  nothingAtPage: 'لا شيء هنا في هذه الصفحة بعد.',

  liveCodes: 'الرموز الفعّالة',
  noPromosTitle: 'لا رموز خصم',
  noPromosHint: 'أنشئ واحدًا — يطبّقه المشترون عند الدفع فيهبط الخصم على الفاتورة بدقة الوحدة.',
  newPromo: 'رمز خصم جديد',
  fieldCode: 'الرمز',
  fieldType: 'النوع',
  percentOff: 'نسبة مئوية',
  fixedOff: 'مبلغ ثابت',
  fieldPercent: 'النسبة (%)',
  fieldAmount: 'المبلغ (◈)',
  fieldMinimum: 'حد أدنى للطلب (◈، اختياري)',
  fieldMaxRedemptions: 'أقصى مرات استخدام (0 = ∞)',
  codeLive: (code) => `الرمز ${code} فعّال`,
  creating: 'جارٍ الإنشاء…',
  createCode: 'أنشئ الرمز',
  worthPercent: (p) => `خصم ${p}%`,
  worthFixed: (a) => `خصم ◈${a}`,
  minTag: (a) => `الحد الأدنى ◈${a}`,
  redeemed: (n, cap) => `استُخدم ${n}${cap > 0n ? ` / ${cap}` : ''}`,
  deactivate: 'عطِّل',
  reactivate: 'فعِّل',
  offBadge: 'معطَّل',

  seedExplainer:
    'لا منتجات بعد. أضف الأول — أو حمِّل المتجر التجريبي (3 فئات، 8 منتجات، رمزا خصم) لترى كل شيء يعمل.',
  addAProduct: 'أضف منتجًا',
  photo: 'الصورة',
  newProductAlt: 'منتج جديد',
  uploading: (pct) => `جارٍ الرفع… ${pct}%`,
  storedOnChain: 'محفوظة على السلسلة ✓',
  compressedNote: 'تُضغط على السلسلة إلى JPEG/WebP محدودة الحجم.',
  fieldName: 'الاسم',
  fieldDescription: 'الوصف',
  fieldPrice: 'السعر (◈)',
  fieldStock: 'المخزون',
  fieldCategory: 'الفئة',
  noCategory: 'بلا',
  addedProduct: (id) => `أُضيف المنتج #${id}`,
  addProduct: 'أضف المنتج',
  categoriesTitle: 'الفئات',
  noCategoriesYet: 'لا فئات بعد.',
  newCategoryPlaceholder: 'فئة جديدة',
  add: 'أضف',
  close: 'أغلق',
  edit: 'حرِّر',
  restockAria: (name) => `زوِّد مخزون ${name}`,
  restock: 'زوِّد',
  heldParen: (n) => `(${n} محجوزة)`,
  unarchive: 'أخرِج من الأرشيف',
  archive: 'أرشِف',
  saveChanges: 'احفظ التغييرات',
  namePlaceholder: 'كوب فخار يدوي',
  descPlaceholder: 'خزف حجري، 300 مل…',

  noImage: (alt) => `${alt} — بلا صورة`,
  illustration: (name) => `${name} — رسم توضيحي`,
}

const MESSAGES: Record<Lang, Messages> = { en, ar }

// The date locale mirrors the UI language. `-u-nu-latn` keeps Latin digits in
// Arabic dates for the same column-alignment reason as everywhere else.
let dateLocale: string | undefined
export function currentDateLocale(): string | undefined {
  return dateLocale
}

const LANG_KEY = 'souk-lang'

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Messages }>({
  lang: 'en',
  setLang: () => {},
  t: en,
})

export function LangProvider({ children }: { children: ReactNode }) {
  // A stored choice wins; a first visit follows the browser, like the theme.
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'en' || saved === 'ar') return saved
    return typeof navigator !== 'undefined' && navigator.language?.startsWith('ar') ? 'ar' : 'en'
  })

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title = MESSAGES[lang].appTitle
    dateLocale = lang === 'ar' ? 'ar-u-nu-latn' : undefined
  }, [lang])

  const setLang = (l: Lang) => {
    localStorage.setItem(LANG_KEY, l)
    setLangState(l)
  }

  return <LangContext.Provider value={{ lang, setLang, t: MESSAGES[lang] }}>{children}</LangContext.Provider>
}

export function useLang() {
  return useContext(LangContext)
}

/** The message catalogue for the current language. */
export function useT(): Messages {
  return useContext(LangContext).t
}
