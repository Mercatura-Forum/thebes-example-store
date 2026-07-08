import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Char "mo:core/Char";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";
import Result "mo:core/Result";
import Iter "mo:core/Iter";
import Admin "mo:thebes-lib/Admin";
import Invoices "mo:thebes-lib/Invoices";

// Souk — an on-chain storefront that keeps honest books.
//
// The property this example proves: INVENTORY CONSERVATION. Every unit that
// enters the shop (seed/restock) is accounted for across on-hand stock,
// checkout holds, sales and returns, and the ledger identity
//
//     onHand + sold == received + returned      (per product)
//     reserved      == Σ active checkout holds  (per product)
//     reserved      <= onHand
//
// is recomputable by ANYONE at ANY time via the public `invariantReportView`
// query. Checkout is validate-all-then-mutate inside one message, so a failed
// order can never leave the books in a partial state.
persistent actor Store {
  type ProductId = Nat;
  type OrderId = Nat;
  type CategoryId = Nat;

  // ── Domain types ──────────────────────────────────────────────────────────

  type Category = {
    id : CategoryId;
    name : Text;
  };

  type Product = {
    id : ProductId;
    name : Text;
    description : Text;
    priceE8s : Nat;
    categoryId : ?CategoryId;
    // The inventory ledger. `onHand` is what sits on the shelf; `reserved` is
    // the slice of onHand held by active checkout reservations; the three
    // lifetime counters make conservation externally checkable.
    onHand : Nat;
    reserved : Nat;
    received : Nat; // lifetime units added (seed + restock)
    sold : Nat;     // lifetime units sold (checkout decrements)
    returned : Nat; // lifetime units restocked by cancel/refund
    // Pointer to the product photo on the media contract (e.g. "/photo/{hash}").
    // The image BYTES live in the media contract; this store holds only the
    // pointer (the storage law). null = no photo yet.
    photoPath : ?Text;
    // Archived products disappear from the shop and can't be bought, but stay
    // on the books so order history and the conservation ledger never dangle.
    archived : Bool;
  };

  type CartItem = {
    productId : ProductId;
    quantity : Nat;
  };

  // Order lines snapshot name AND unit price at purchase time, so later price
  // edits or archival never rewrite a buyer's history.
  type OrderLine = {
    productId : ProductId;
    name : Text;
    quantity : Nat;
    unitPriceE8s : Nat;
  };

  // A checkout hold: the buyer's cart snapshot with stock set aside for a
  // bounded window. Expiry is lazy — every state-touching entry point first
  // releases stale holds, so no timer is needed and queries see fresh math.
  type Reservation = {
    items : [CartItem];
    subtotalE8s : Nat;
    createdAt : Int;
    expiresAt : Int;
  };

  type DiscountKind = {
    #percentBps : Nat; // basis points off the subtotal (250 = 2.5%)
    #fixedE8s : Nat;   // flat amount off, clamped to the subtotal
  };

  type Discount = {
    code : Text; // stored upper-cased; matching is case-insensitive
    kind : DiscountKind;
    minSubtotalE8s : Nat;
    maxRedemptions : Nat; // 0 = unlimited
    redemptions : Nat;
    expiresAt : ?Int;
    active : Bool;
  };

  // Lifecycle: placed → shipped → delivered → (refunded)
  //            placed → cancelled
  // Cancel restocks immediately (nothing left the shop); refund restocks after
  // delivery (the goods came back). Both append to `returned` on the ledger.
  type OrderStatus = { #placed; #shipped; #delivered; #cancelled; #refunded };

  type Order = {
    id : OrderId;
    buyer : Principal;
    lines : [OrderLine];
    subtotalE8s : Nat;
    discountE8s : Nat;
    totalE8s : Nat;
    discountCode : ?Text;
    status : OrderStatus;
    createdAt : Int;
    invoiceId : ?Nat;
  };

  // Typed error taxonomy. Public SPA-facing methods trap with `errText` so the
  // boundary surfaces a reason; Result-returning twins carry the variant for
  // programmatic callers.
  type StoreError = {
    #anonymous;
    #emptyCart;
    #notFound : Text;
    #archived : ProductId;
    #insufficientStock : { productId : ProductId; requested : Nat; available : Nat };
    #invalidDiscount : Text;
    #invalidTransition : { from : Text; to : Text };
    #notYours;
    #badInput : Text;
  };

  // Append-only audit trail: every state change lands here with its actor.
  // Order events double as the buyer-visible order timeline.
  type AuditEvent = {
    id : Nat;
    at : Int;
    who : Principal;
    kind : Text;   // e.g. "order.place", "product.restock", "reserve.expire"
    detail : Text;
    orderId : Nat;   // 0 = not order-related
    productId : Nat; // 0 = not product-related
  };

  // ── State ─────────────────────────────────────────────────────────────────

  var nextProductId : Nat = 1;
  var nextOrderId : Nat = 1;
  var nextCategoryId : Nat = 1;
  var nextEventId : Nat = 1;

  // Standard admin surface (lib/Admin): owner claim/transfer, admins tier,
  // emergency-stop pause. Catalogue/order admin mutations are guarded by it.
  var admin = Admin.init();

  let products = Map.empty<ProductId, Product>();
  let categories = Map.empty<CategoryId, Category>();
  // Carts are keyed by Principal so each caller has exactly one cart; identity
  // is always taken from msg.caller, never from a passed-in principal.
  let carts = Map.empty<Principal, [CartItem]>();
  // One active checkout hold per buyer.
  let reservations = Map.empty<Principal, Reservation>();
  let orders = Map.empty<OrderId, Order>();
  let discounts = Map.empty<Text, Discount>();
  let audit = List.empty<AuditEvent>();
  // Invoicing comes from the shared thebes-lib module: each checkout issues an
  // invoice (seller → buyer) whose line items carry the discount allocation,
  // so invoice total == charged total, always.
  let invoices = Invoices.init();

  // How long a checkout hold keeps stock aside (10 minutes, in ns).
  let HOLD_NS : Int = 10 * 60 * 1_000_000_000;

  // ── Small helpers ─────────────────────────────────────────────────────────

  func satSub(a : Nat, b : Nat) : Nat { if (b >= a) 0 else a - b };

  func upcase(t : Text) : Text {
    Text.map(t, func(c : Char) : Char {
      let n = Char.toNat32(c);
      if (n >= 97 and n <= 122) { Char.fromNat32(n - 32) } else { c };
    });
  };

  func statusText(s : OrderStatus) : Text {
    switch s {
      case (#placed) "placed"; case (#shipped) "shipped"; case (#delivered) "delivered";
      case (#cancelled) "cancelled"; case (#refunded) "refunded";
    };
  };

  func errText(e : StoreError) : Text {
    switch e {
      case (#anonymous) "Sign in first — anonymous callers can't do this.";
      case (#emptyCart) "Your cart is empty.";
      case (#notFound(what)) what # " not found.";
      case (#archived(id)) "Product #" # Nat.toText(id) # " is no longer sold.";
      case (#insufficientStock(d)) {
        "Only " # Nat.toText(d.available) # " of product #" # Nat.toText(d.productId)
        # " available (you asked for " # Nat.toText(d.requested) # ").";
      };
      case (#invalidDiscount(why)) "Promo code: " # why;
      case (#invalidTransition(t)) "Can't move an order from " # t.from # " to " # t.to # ".";
      case (#notYours) "That order belongs to someone else.";
      case (#badInput(why)) why;
    };
  };

  func logEvent(who : Principal, kind : Text, detail : Text, orderId : Nat, productId : Nat) {
    List.add(audit, {
      id = nextEventId; at = Time.now(); who; kind; detail; orderId; productId;
    });
    nextEventId += 1;
  };

  func getProduct(id : ProductId) : ?Product { Map.get(products, Nat.compare, id) };

  func putProduct(p : Product) { Map.add(products, Nat.compare, p.id, p) };

  func availableOf(p : Product) : Nat { satSub(p.onHand, p.reserved) };

  // Consolidate a cart into one requested quantity per product (defensive —
  // cart mutations keep entries merged, but checkout math must not rely on it).
  func consolidate(cart : [CartItem]) : Map.Map<ProductId, Nat> {
    let wanted = Map.empty<ProductId, Nat>();
    for (item in cart.values()) {
      let prev = switch (Map.get(wanted, Nat.compare, item.productId)) {
        case (?q) q; case null 0;
      };
      Map.add(wanted, Nat.compare, item.productId, prev + item.quantity);
    };
    wanted;
  };

  func cartSubtotal(cart : [CartItem]) : Nat {
    var sum : Nat = 0;
    for (item in cart.values()) {
      switch (getProduct(item.productId)) {
        case (?p) { sum += p.priceE8s * item.quantity };
        case null {};
      };
    };
    sum;
  };

  // ── Reservations: hold, release, lazy expiry ──────────────────────────────

  func releaseUnits(items : [CartItem]) {
    for ((pid, qty) in Map.entries(consolidate(items))) {
      switch (getProduct(pid)) {
        case (?p) { putProduct({ p with reserved = satSub(p.reserved, qty) }) };
        case null {};
      };
    };
  };

  func releaseOwn(who : Principal, why : Text) {
    switch (Map.take(reservations, Principal.compare, who)) {
      case (?r) {
        releaseUnits(r.items);
        logEvent(who, "reserve.release", why, 0, 0);
      };
      case null {};
    };
  };

  // Lazy expiry: called at the top of every state-touching entry point AND at
  // the top of read views (query-context mutations are discarded by the engine,
  // but the view then computes over post-expiry numbers, so reads stay honest).
  func releaseExpired(now : Int) {
    let stale = List.empty<Principal>();
    for ((who, r) in Map.entries(reservations)) {
      if (r.expiresAt <= now) { List.add(stale, who) };
    };
    for (who in List.values(stale)) {
      switch (Map.take(reservations, Principal.compare, who)) {
        case (?r) {
          releaseUnits(r.items);
          logEvent(who, "reserve.expire", "checkout hold expired", 0, 0);
        };
        case null {};
      };
    };
  };

  // ── Admin surface ─────────────────────────────────────────────────────────

  // First caller wins. Anonymous callers are rejected before the claim so the
  // anonymous principal can never own the store (preserved from the audit fix —
  // Admin.claimOwner itself does not reject anonymous).
  public shared(msg) func claimOwner() : async Bool {
    if (Principal.isAnonymous(msg.caller)) Runtime.trap("anonymous caller");
    let claimed = Admin.claimOwner(admin, msg.caller);
    if (claimed) { logEvent(msg.caller, "admin.claim", "ownership claimed", 0, 0) };
    claimed;
  };
  public shared(msg) func transferOwner(n : Principal) : async Bool { Admin.transferOwner(admin, msg.caller, n) };
  public shared(msg) func addAdmin(w : Principal) : async Bool { Admin.addAdmin(admin, msg.caller, w) };
  public shared(msg) func removeAdmin(w : Principal) : async Bool { Admin.removeAdmin(admin, msg.caller, w) };
  public shared(msg) func setPaused(v : Bool) : async Bool {
    let ok = Admin.setPaused(admin, msg.caller, v);
    if (ok) { logEvent(msg.caller, if v "admin.pause" else "admin.unpause", "emergency stop", 0, 0) };
    ok;
  };
  public query func getOwner() : async ?Principal { Admin.getOwner(admin) };
  public query func getAdmins() : async [Principal] { Admin.getAdmins(admin) };
  public query func isPaused() : async Bool { Admin.isPaused(admin) };
  public shared query(msg) func amAdmin() : async Bool { Admin.isAdmin(admin, msg.caller) };

  // ── Categories ────────────────────────────────────────────────────────────

  public shared(msg) func addCategory(name : Text) : async CategoryId {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, msg.caller);
    if (Text.size(name) == 0) Runtime.trap(errText(#badInput("category name must not be empty")));
    let id = nextCategoryId;
    nextCategoryId += 1;
    Map.add(categories, Nat.compare, id, { id; name });
    logEvent(msg.caller, "category.add", name, 0, 0);
    id;
  };

  public shared(msg) func renameCategory(id : CategoryId, name : Text) : async () {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, msg.caller);
    if (Text.size(name) == 0) Runtime.trap(errText(#badInput("category name must not be empty")));
    switch (Map.get(categories, Nat.compare, id)) {
      case null { Runtime.trap(errText(#notFound("Category"))) };
      case (?_) {
        Map.add(categories, Nat.compare, id, { id; name });
        logEvent(msg.caller, "category.rename", name, 0, 0);
      };
    };
  };

  // ── Catalogue ─────────────────────────────────────────────────────────────

  // No-auth core: append a product. Shared by the admin-gated public method and
  // by seedDemo (which bypasses the gate only on an empty just-deployed store).
  private func addProductRaw(name : Text, description : Text, priceE8s : Nat, initialStock : Nat, categoryId : ?CategoryId, photoPath : ?Text) : ProductId {
    if (priceE8s == 0) Runtime.trap(errText(#badInput("price must be > 0")));
    if (Text.size(name) == 0) Runtime.trap(errText(#badInput("product name must not be empty")));
    switch (categoryId) {
      case (?cid) {
        if (Map.get(categories, Nat.compare, cid) == null) Runtime.trap(errText(#notFound("Category")));
      };
      case null {};
    };
    let productId = nextProductId;
    nextProductId += 1;
    putProduct({
      id = productId; name; description; priceE8s; categoryId;
      onHand = initialStock; reserved = 0;
      received = initialStock; sold = 0; returned = 0;
      photoPath; archived = false;
    });
    productId;
  };

  public shared(msg) func addProduct(name : Text, description : Text, priceE8s : Nat, initialStock : Nat, categoryId : Nat, photoPath : ?Text) : async ProductId {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, msg.caller);
    let cat : ?CategoryId = if (categoryId == 0) null else ?categoryId;
    let id = addProductRaw(name, description, priceE8s, initialStock, cat, photoPath);
    logEvent(msg.caller, "product.add", name # " (+" # Nat.toText(initialStock) # " units)", 0, id);
    id;
  };

  // Edit price/copy/category. The inventory ledger is untouched; order lines
  // hold their own price snapshots, so history never rewrites.
  public shared(msg) func updateProduct(productId : ProductId, name : Text, description : Text, priceE8s : Nat, categoryId : Nat) : async () {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, msg.caller);
    if (priceE8s == 0) Runtime.trap(errText(#badInput("price must be > 0")));
    if (Text.size(name) == 0) Runtime.trap(errText(#badInput("product name must not be empty")));
    let cat : ?CategoryId = if (categoryId == 0) null else ?categoryId;
    switch (cat) {
      case (?cid) { if (Map.get(categories, Nat.compare, cid) == null) Runtime.trap(errText(#notFound("Category"))) };
      case null {};
    };
    switch (getProduct(productId)) {
      case null { Runtime.trap(errText(#notFound("Product"))) };
      case (?p) {
        putProduct({ p with name; description; priceE8s; categoryId = cat });
        logEvent(msg.caller, "product.update", name, 0, productId);
      };
    };
  };

  // Set/replace a product's photo. The admin uploads the image to the media
  // contract first (frontend → /photo/{hash}), then passes that path here.
  public shared(msg) func setProductPhoto(productId : ProductId, photoPath : Text) : async () {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, msg.caller);
    switch (getProduct(productId)) {
      case null { Runtime.trap(errText(#notFound("Product"))) };
      case (?p) {
        putProduct({ p with photoPath = ?photoPath });
        logEvent(msg.caller, "product.photo", photoPath, 0, productId);
      };
    };
  };

  // Archive (soft-delete): hidden from the shop, unbuyable, but the ledger row
  // and every order line referencing it stay intact. Reversible.
  public shared(msg) func setProductArchived(productId : ProductId, archived : Bool) : async () {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, msg.caller);
    switch (getProduct(productId)) {
      case null { Runtime.trap(errText(#notFound("Product"))) };
      case (?p) {
        putProduct({ p with archived });
        logEvent(msg.caller, if archived "product.archive" else "product.unarchive", p.name, 0, productId);
      };
    };
  };

  public shared(msg) func restockProduct(productId : ProductId, additionalStock : Nat) : async () {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, msg.caller);
    if (additionalStock == 0) Runtime.trap(errText(#badInput("restock quantity must be > 0")));
    switch (getProduct(productId)) {
      case null { Runtime.trap(errText(#notFound("Product"))) };
      case (?p) {
        putProduct({ p with onHand = p.onHand + additionalStock; received = p.received + additionalStock });
        logEvent(msg.caller, "product.restock", "+" # Nat.toText(additionalStock) # " units", 0, productId);
      };
    };
  };

  // Seed a demo shop on a fresh deploy so a just-deployed souk is alive:
  // categories, catalogue, and two live promo codes. Fires only while the
  // catalog is empty (bypasses the admin gate so the first signed-in visitor
  // brings it to life). Photos seed empty — image bytes live on the media
  // contract, content-addressed by upload.
  public shared(msg) func seedDemo() : async Bool {
    Admin.requireNotPaused(admin);
    if (Principal.isAnonymous(msg.caller)) Runtime.trap("Sign in to load demo data");
    if (Map.size(products) > 0) return false;

    let kitchen = nextCategoryId; nextCategoryId += 1;
    Map.add(categories, Nat.compare, kitchen, { id = kitchen; name = "Kitchen" });
    let textiles = nextCategoryId; nextCategoryId += 1;
    Map.add(categories, Nat.compare, textiles, { id = textiles; name = "Textiles" });
    let light = nextCategoryId; nextCategoryId += 1;
    Map.add(categories, Nat.compare, light, { id = light; name = "Light & Scent" });

    ignore addProductRaw("Stoneware Mug", "Hand-glazed 12oz ceramic mug, dishwasher safe.", 1_800_000_000, 40, ?kitchen, null);
    ignore addProductRaw("Pour-Over Kettle", "Gooseneck kettle in brushed steel, 900ml.", 6_500_000_000, 12, ?kitchen, null);
    ignore addProductRaw("Cedar Cutting Board", "End-grain board, food-safe oil finish.", 5_400_000_000, 25, ?kitchen, null);
    ignore addProductRaw("Linen Apron", "Stonewashed flax apron with leather ties.", 4_200_000_000, 18, ?textiles, null);
    ignore addProductRaw("Wool Throw", "Lambswool blanket in a herringbone weave.", 8_900_000_000, 9, ?textiles, null);
    ignore addProductRaw("Waffle Towel Set", "Two organic-cotton waffle towels.", 3_600_000_000, 30, ?textiles, null);
    ignore addProductRaw("Beeswax Candle", "Hand-poured, unscented, 50-hour burn.", 1_500_000_000, 60, ?light, null);
    ignore addProductRaw("Brass Oil Lamp", "Refillable brass lamp with a cotton wick.", 7_200_000_000, 7, ?light, null);

    Map.add(discounts, Text.compare, "WELCOME10", {
      code = "WELCOME10"; kind = #percentBps(1000); minSubtotalE8s = 0;
      maxRedemptions = 0; redemptions = 0; expiresAt = null; active = true;
    });
    Map.add(discounts, Text.compare, "SOUK5", {
      code = "SOUK5"; kind = #fixedE8s(500_000_000); minSubtotalE8s = 3_000_000_000;
      maxRedemptions = 100; redemptions = 0; expiresAt = null; active = true;
    });

    logEvent(msg.caller, "seed.demo", "demo catalog: 3 categories, 8 products, 2 promo codes", 0, 0);
    true;
  };

  // ── Discounts ─────────────────────────────────────────────────────────────

  // Create a promo code. Exactly one of percentBps / fixedE8s must be non-zero;
  // percent is capped at 100%. expiresAtNs = 0 means no expiry;
  // maxRedemptions = 0 means unlimited.
  public shared(msg) func createDiscount(code : Text, percentBps : Nat, fixedE8s : Nat, minSubtotalE8s : Nat, maxRedemptions : Nat, expiresAtNs : Int) : async () {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, msg.caller);
    let norm = upcase(Text.trim(code, #char ' '));
    if (Text.size(norm) == 0) Runtime.trap(errText(#badInput("promo code must not be empty")));
    if (percentBps > 0 and fixedE8s > 0) Runtime.trap(errText(#badInput("choose percent OR fixed, not both")));
    if (percentBps == 0 and fixedE8s == 0) Runtime.trap(errText(#badInput("discount value must be > 0")));
    if (percentBps > 10_000) Runtime.trap(errText(#badInput("percent cannot exceed 100% (10000 bps)")));
    if (Map.get(discounts, Text.compare, norm) != null) Runtime.trap(errText(#badInput("that code already exists")));
    let kind : DiscountKind = if (percentBps > 0) #percentBps(percentBps) else #fixedE8s(fixedE8s);
    Map.add(discounts, Text.compare, norm, {
      code = norm; kind; minSubtotalE8s; maxRedemptions; redemptions = 0;
      expiresAt = if (expiresAtNs == 0) null else ?expiresAtNs; active = true;
    });
    logEvent(msg.caller, "discount.create", norm, 0, 0);
  };

  public shared(msg) func setDiscountActive(code : Text, active : Bool) : async () {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, msg.caller);
    let norm = upcase(Text.trim(code, #char ' '));
    switch (Map.get(discounts, Text.compare, norm)) {
      case null { Runtime.trap(errText(#notFound("Promo code"))) };
      case (?d) {
        Map.add(discounts, Text.compare, norm, { d with active });
        logEvent(msg.caller, if active "discount.enable" else "discount.disable", norm, 0, 0);
      };
    };
  };

  func validateDiscount(codeRaw : Text, subtotal : Nat, now : Int) : Result.Result<Discount, Text> {
    let norm = upcase(Text.trim(codeRaw, #char ' '));
    switch (Map.get(discounts, Text.compare, norm)) {
      case null { #err("code not recognized") };
      case (?d) {
        if (not d.active) return #err("code is no longer active");
        switch (d.expiresAt) {
          case (?t) { if (now > t) return #err("code has expired") };
          case null {};
        };
        if (d.maxRedemptions > 0 and d.redemptions >= d.maxRedemptions) {
          return #err("code is fully redeemed");
        };
        if (subtotal < d.minSubtotalE8s) {
          return #err("order is below the code's minimum");
        };
        #ok(d);
      };
    };
  };

  func discountAmount(d : Discount, subtotal : Nat) : Nat {
    let raw = switch (d.kind) {
      case (#percentBps(bps)) { subtotal * bps / 10_000 };
      case (#fixedE8s(v)) { v };
    };
    if (raw > subtotal) subtotal else raw;
  };

  // Allocate a discount across invoice line items EXACTLY, unit by unit:
  // whole units drop to zero while the discount covers them, at most one unit
  // carries a reduced price, and the rest stay at list. All-Nat, no rounding
  // residue — the invoice total always equals the charged total.
  func allocateDiscount(lines : [OrderLine], discount : Nat) : [Invoices.LineItem] {
    let out = List.empty<Invoices.LineItem>();
    var left = discount;
    for (l in lines.values()) {
      if (left == 0 or l.unitPriceE8s == 0) {
        List.add(out, { description = l.name; quantity = l.quantity; unitPriceE8s = l.unitPriceE8s });
      } else {
        let lineTotal = l.quantity * l.unitPriceE8s;
        if (left >= lineTotal) {
          // Whole line is covered by the promo.
          List.add(out, { description = l.name # " (promo)"; quantity = l.quantity; unitPriceE8s = 0 });
          left -= lineTotal;
        } else {
          let zeroUnits = left / l.unitPriceE8s;
          let residue = left % l.unitPriceE8s;
          let reducedUnits : Nat = if (residue > 0) 1 else 0;
          let fullUnits = l.quantity - zeroUnits - reducedUnits;
          if (fullUnits > 0) {
            List.add(out, { description = l.name; quantity = fullUnits; unitPriceE8s = l.unitPriceE8s });
          };
          if (reducedUnits > 0) {
            List.add(out, { description = l.name # " (promo)"; quantity = 1; unitPriceE8s = l.unitPriceE8s - residue });
          };
          if (zeroUnits > 0) {
            List.add(out, { description = l.name # " (promo)"; quantity = zeroUnits; unitPriceE8s = 0 });
          };
          left := 0;
        };
      };
    };
    List.toArray(out);
  };

  // ── Cart ──────────────────────────────────────────────────────────────────

  // Any cart mutation releases the caller's active checkout hold: the hold is a
  // snapshot, and the snapshot is stale the moment the cart changes.

  public shared(msg) func addToCart(productId : ProductId, quantity : Nat) : async () {
    Admin.requireNotPaused(admin);
    // Anonymous callers would all share one cart keyed by the anonymous
    // principal; reject them so carts stay per-identity.
    if (Principal.isAnonymous(msg.caller)) Runtime.trap(errText(#anonymous));
    if (quantity == 0) Runtime.trap(errText(#badInput("quantity must be > 0")));
    releaseExpired(Time.now());

    switch (getProduct(productId)) {
      case null { Runtime.trap(errText(#notFound("Product"))) };
      case (?product) {
        if (product.archived) Runtime.trap(errText(#archived(productId)));
        releaseOwn(msg.caller, "cart changed");

        let existingCart = switch (Map.get(carts, Principal.compare, msg.caller)) {
          case (?c) { c };
          case null { [] };
        };

        // Merge into an existing entry for the same product so a cart never
        // holds two entries for one productId, and gate the MERGED quantity
        // against what's actually available right now.
        var already : Nat = 0;
        for (it in existingCart.values()) {
          if (it.productId == productId) { already += it.quantity };
        };
        let avail = availableOf(product);
        if (already + quantity > avail) {
          Runtime.trap(errText(#insufficientStock({ productId; requested = already + quantity; available = avail })));
        };

        var merged = false;
        let updatedCart = Array.map<CartItem, CartItem>(existingCart, func(it) {
          if (it.productId == productId) {
            merged := true;
            { productId; quantity = it.quantity + quantity };
          } else { it };
        });
        let finalCart = if (merged) { updatedCart } else {
          Array.concat(updatedCart, [{ productId; quantity }]);
        };
        Map.add(carts, Principal.compare, msg.caller, finalCart);
      };
    };
  };

  // Set a line to an exact quantity; 0 removes the line.
  public shared(msg) func setCartQuantity(productId : ProductId, quantity : Nat) : async () {
    Admin.requireNotPaused(admin);
    if (Principal.isAnonymous(msg.caller)) Runtime.trap(errText(#anonymous));
    releaseExpired(Time.now());
    releaseOwn(msg.caller, "cart changed");

    let existingCart = switch (Map.get(carts, Principal.compare, msg.caller)) {
      case (?c) { c }; case null { [] };
    };
    let without = Array.filter<CartItem>(existingCart, func(it) { it.productId != productId });
    if (quantity == 0) {
      Map.add(carts, Principal.compare, msg.caller, without);
      return;
    };
    switch (getProduct(productId)) {
      case null { Runtime.trap(errText(#notFound("Product"))) };
      case (?product) {
        if (product.archived) Runtime.trap(errText(#archived(productId)));
        let avail = availableOf(product);
        if (quantity > avail) {
          Runtime.trap(errText(#insufficientStock({ productId; requested = quantity; available = avail })));
        };
        Map.add(carts, Principal.compare, msg.caller, Array.concat(without, [{ productId; quantity }]));
      };
    };
  };

  public shared(msg) func removeFromCart(productId : ProductId) : async () {
    Admin.requireNotPaused(admin);
    if (Principal.isAnonymous(msg.caller)) Runtime.trap(errText(#anonymous));
    releaseOwn(msg.caller, "cart changed");
    let existingCart = switch (Map.get(carts, Principal.compare, msg.caller)) {
      case (?c) { c }; case null { [] };
    };
    Map.add(carts, Principal.compare, msg.caller,
      Array.filter<CartItem>(existingCart, func(it) { it.productId != productId }));
  };

  public shared(msg) func clearCart() : async () {
    Admin.requireNotPaused(admin);
    if (Principal.isAnonymous(msg.caller)) Runtime.trap(errText(#anonymous));
    releaseOwn(msg.caller, "cart cleared");
    ignore Map.take(carts, Principal.compare, msg.caller);
  };

  // ── Checkout: reserve → (quote) → place ──────────────────────────────────

  // Step 1: take a hold. Validates the WHOLE cart against available stock
  // (onHand − reserved), then moves those units into `reserved` for HOLD_NS.
  // Re-calling replaces the previous hold with a fresh snapshot + window.
  private func doBeginCheckout(caller : Principal) : Result.Result<Int, StoreError> {
    Admin.requireNotPaused(admin);
    if (Principal.isAnonymous(caller)) return #err(#anonymous);
    let now = Time.now();
    releaseExpired(now);
    releaseOwn(caller, "hold replaced");

    let cart = switch (Map.get(carts, Principal.compare, caller)) {
      case (?c) { c }; case null { return #err(#emptyCart) };
    };
    if (Array.size(cart) == 0) return #err(#emptyCart);

    // Validate everything before touching any counter.
    let wanted = consolidate(cart);
    for ((pid, qty) in Map.entries(wanted)) {
      switch (getProduct(pid)) {
        case null { return #err(#notFound("Product #" # Nat.toText(pid))) };
        case (?p) {
          if (p.archived) return #err(#archived(pid));
          let avail = availableOf(p);
          if (avail < qty) return #err(#insufficientStock({ productId = pid; requested = qty; available = avail }));
        };
      };
    };

    // Mutation phase: move units into reserve.
    for ((pid, qty) in Map.entries(wanted)) {
      switch (getProduct(pid)) {
        case (?p) { putProduct({ p with reserved = p.reserved + qty }) };
        case null {};
      };
    };
    let expiresAt = now + HOLD_NS;
    Map.add(reservations, Principal.compare, caller, {
      items = cart; subtotalE8s = cartSubtotal(cart); createdAt = now; expiresAt;
    });
    logEvent(caller, "reserve.begin", "stock held for checkout", 0, 0);
    #ok(expiresAt);
  };

  public shared(msg) func beginCheckout() : async Result.Result<Int, StoreError> { doBeginCheckout(msg.caller) };
  public shared(msg) func beginCheckoutOrTrap() : async Int {
    switch (doBeginCheckout(msg.caller)) { case (#ok(t)) t; case (#err(e)) Runtime.trap(errText(e)) };
  };

  public shared(msg) func cancelCheckout() : async () {
    releaseExpired(Time.now());
    releaseOwn(msg.caller, "hold cancelled");
  };

  // Step 2: place the order. If the buyer holds an active reservation the
  // order consumes its snapshot (guaranteed stock); without one this is the
  // classic direct path, validate-all-then-mutate against available stock.
  // Either way every mutation happens in ONE message — atomic.
  private func doCheckout(caller : Principal, codeRaw : Text) : Result.Result<OrderId, StoreError> {
    Admin.requireNotPaused(admin);
    // Identity always from msg.caller, never a passed-in principal.
    if (Principal.isAnonymous(caller)) return #err(#anonymous);
    let now = Time.now();
    releaseExpired(now);

    let held = Map.get(reservations, Principal.compare, caller);
    let items = switch (held) {
      case (?r) { r.items };
      case null {
        switch (Map.get(carts, Principal.compare, caller)) {
          case (?c) { c }; case null { return #err(#emptyCart) };
        };
      };
    };
    if (Array.size(items) == 0) return #err(#emptyCart);
    let fromHold = held != null;

    // Validate-all-then-mutate: consolidate quantities, check every product
    // BEFORE any state mutation, so a failed checkout never leaves the books
    // in a partial state. Held units are already ours (they sit in reserved);
    // unheld checkouts must fit inside what's available right now.
    let wanted = consolidate(items);
    var subtotal : Nat = 0;
    for ((pid, qty) in Map.entries(wanted)) {
      switch (getProduct(pid)) {
        case null { return #err(#notFound("Product #" # Nat.toText(pid))) };
        case (?p) {
          if (p.archived) return #err(#archived(pid));
          if (fromHold) {
            // Defensive: a hold guarantees reserved >= qty, but never trust a
            // counter you can re-check against the physical one.
            if (p.onHand < qty) return #err(#insufficientStock({ productId = pid; requested = qty; available = p.onHand }));
          } else {
            let avail = availableOf(p);
            if (avail < qty) return #err(#insufficientStock({ productId = pid; requested = qty; available = avail }));
          };
          subtotal += p.priceE8s * qty;
        };
      };
    };

    // Promo code: validated against the same subtotal the order will carry;
    // redemption counts only after full validation (same atomic message).
    var discountE8s : Nat = 0;
    var appliedCode : ?Text = null;
    if (Text.size(Text.trim(codeRaw, #char ' ')) > 0) {
      switch (validateDiscount(codeRaw, subtotal, now)) {
        case (#err(why)) { return #err(#invalidDiscount(why)) };
        case (#ok(d)) {
          discountE8s := discountAmount(d, subtotal);
          appliedCode := ?d.code;
          Map.add(discounts, Text.compare, d.code, { d with redemptions = d.redemptions + 1 });
        };
      };
    };
    let totalE8s = satSub(subtotal, discountE8s);

    // Snapshot order lines (name + unit price at purchase).
    let lines = Array.map<(ProductId, Nat), OrderLine>(
      Iter.toArray(Map.entries(wanted)),
      func((pid, qty)) {
        switch (getProduct(pid)) {
          case (?p) { { productId = pid; name = p.name; quantity = qty; unitPriceE8s = p.priceE8s } };
          case null { { productId = pid; name = "item"; quantity = qty; unitPriceE8s = 0 } };
        };
      },
    );

    let orderId = nextOrderId;
    nextOrderId += 1;

    // Issue the invoice (seller → buyer) with the promo allocated across the
    // line items unit-exactly, so invoice total == order total.
    let seller = switch (Admin.getOwner(admin)) { case (?o) o; case null caller };
    let inv = Invoices.createIssued(invoices, now, seller, caller, allocateDiscount(lines, discountE8s), 0);

    Map.add(orders, Nat.compare, orderId, {
      id = orderId; buyer = caller; lines;
      subtotalE8s = subtotal; discountE8s; totalE8s;
      discountCode = appliedCode; status = #placed; createdAt = now;
      invoiceId = ?inv.id;
    });

    // Mutation phase: one ledger move per product from the validated sums —
    // out of reserve (if held) and off the shelf, onto lifetime `sold`.
    for ((pid, qty) in Map.entries(wanted)) {
      switch (getProduct(pid)) {
        case (?p) {
          putProduct({
            p with
            onHand = satSub(p.onHand, qty);
            reserved = if (fromHold) satSub(p.reserved, qty) else p.reserved;
            sold = p.sold + qty;
          });
        };
        case null {};
      };
    };

    if (fromHold) { ignore Map.take(reservations, Principal.compare, caller) };
    ignore Map.take(carts, Principal.compare, caller);
    logEvent(caller, "order.place",
      (switch (appliedCode) { case (?c) "placed with promo " # c; case null "placed" }),
      orderId, 0);
    #ok(orderId);
  };

  public shared(msg) func checkout(code : Text) : async Result.Result<OrderId, StoreError> { doCheckout(msg.caller, code) };

  // Frontend-friendly checkout: returns the new order id, or traps with the
  // reason so the SPA's update call resolves to a clean value or a typed error.
  public shared(msg) func checkoutOrTrap(code : Text) : async Nat {
    switch (doCheckout(msg.caller, code)) { case (#ok(id)) { id }; case (#err(e)) { Runtime.trap(errText(e)) } };
  };

  // ── Order lifecycle ───────────────────────────────────────────────────────

  // Restock an order's lines back onto the shelf (cancel/refund). The units
  // return to onHand and to the lifetime `returned` counter — conservation
  // (onHand + sold == received + returned) holds because `sold` keeps counting
  // the original sale.
  func restockLines(lines : [OrderLine]) {
    for (l in lines.values()) {
      switch (getProduct(l.productId)) {
        case (?p) { putProduct({ p with onHand = p.onHand + l.quantity; returned = p.returned + l.quantity }) };
        case null {};
      };
    };
  };

  func voidOrderInvoice(orderId : OrderId) {
    switch (Map.get(orders, Nat.compare, orderId)) {
      case (?o) {
        switch (o.invoiceId) {
          case (?iid) {
            switch (Invoices.get(invoices, iid)) {
              // The lib requires the issuer to void; the store acts on the
              // issuer's behalf here (the audit trail keeps the real actor).
              case (?inv) { ignore Invoices.void(invoices, Time.now(), inv.issuer, iid) };
              case null {};
            };
          };
          case null {};
        };
      };
      case null {};
    };
  };

  // Buyer cancels while the order is still #placed. Stock returns instantly.
  private func doCancelOrder(caller : Principal, orderId : OrderId) : Result.Result<(), StoreError> {
    Admin.requireNotPaused(admin);
    if (Principal.isAnonymous(caller)) return #err(#anonymous);
    switch (Map.get(orders, Nat.compare, orderId)) {
      case null { #err(#notFound("Order")) };
      case (?o) {
        if (not Principal.equal(o.buyer, caller) and not Admin.isAdmin(admin, caller)) {
          return #err(#notYours);
        };
        if (o.status != #placed) {
          return #err(#invalidTransition({ from = statusText(o.status); to = "cancelled" }));
        };
        Map.add(orders, Nat.compare, orderId, { o with status = #cancelled });
        restockLines(o.lines);
        voidOrderInvoice(orderId);
        logEvent(caller, "order.cancel", "stock returned to shelf", orderId, 0);
        #ok(());
      };
    };
  };

  public shared(msg) func cancelOrder(orderId : OrderId) : async Result.Result<(), StoreError> { doCancelOrder(msg.caller, orderId) };
  public shared(msg) func cancelOrderOrTrap(orderId : OrderId) : async () {
    switch (doCancelOrder(msg.caller, orderId)) { case (#ok()) {}; case (#err(e)) Runtime.trap(errText(e)) };
  };

  // Admin moves an order along its lifecycle. Transitions are explicit edges,
  // never free-form: placed→shipped→delivered, delivered→refunded (goods come
  // back: restock + void invoice), placed→cancelled (admin-side cancel).
  func adminTransition(caller : Principal, orderId : OrderId, to : OrderStatus) : Result.Result<(), StoreError> {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, caller);
    switch (Map.get(orders, Nat.compare, orderId)) {
      case null { #err(#notFound("Order")) };
      case (?o) {
        let ok = switch (o.status, to) {
          case (#placed, #shipped) true;
          case (#shipped, #delivered) true;
          case (#delivered, #refunded) true;
          case (#placed, #cancelled) true;
          case _ false;
        };
        if (not ok) return #err(#invalidTransition({ from = statusText(o.status); to = statusText(to) }));
        Map.add(orders, Nat.compare, orderId, { o with status = to });
        switch (to) {
          case (#refunded) {
            restockLines(o.lines);
            voidOrderInvoice(orderId);
            logEvent(caller, "order.refund", "refunded — goods restocked", orderId, 0);
          };
          case (#cancelled) {
            restockLines(o.lines);
            voidOrderInvoice(orderId);
            logEvent(caller, "order.cancel", "cancelled by the shop", orderId, 0);
          };
          case (#shipped) { logEvent(caller, "order.ship", "handed to the courier", orderId, 0) };
          case (#delivered) { logEvent(caller, "order.deliver", "delivered to the buyer", orderId, 0) };
          case (#placed) {};
        };
        #ok(());
      };
    };
  };

  public shared(msg) func shipOrder(orderId : OrderId) : async () {
    switch (adminTransition(msg.caller, orderId, #shipped)) { case (#ok()) {}; case (#err(e)) Runtime.trap(errText(e)) };
  };
  public shared(msg) func deliverOrder(orderId : OrderId) : async () {
    switch (adminTransition(msg.caller, orderId, #delivered)) { case (#ok()) {}; case (#err(e)) Runtime.trap(errText(e)) };
  };
  public shared(msg) func refundOrder(orderId : OrderId) : async () {
    switch (adminTransition(msg.caller, orderId, #refunded)) { case (#ok()) {}; case (#err(e)) Runtime.trap(errText(e)) };
  };
  public shared(msg) func adminCancelOrder(orderId : OrderId) : async () {
    switch (adminTransition(msg.caller, orderId, #cancelled)) { case (#ok()) {}; case (#err(e)) Runtime.trap(errText(e)) };
  };

  // ── Frontend view-models (flat records, easy to decode in the SPA) ────────
  // The example SPA uses a lightweight Candid decoder that reads flat records
  // (no opt/variant/nested-vec). These mirror the rich types for the UI:
  // opt → "" / 0 when absent, status variant → its text tag, and joined views
  // so each page needs one call.

  func categoryName(id : ?CategoryId) : Text {
    switch (id) {
      case (?cid) { switch (Map.get(categories, Nat.compare, cid)) { case (?c) c.name; case null "" } };
      case null "";
    };
  };

  public type ProductView = {
    id : Nat; name : Text; description : Text; priceE8s : Nat;
    categoryId : Nat; categoryName : Text;
    available : Nat; onHand : Nat; reserved : Nat;
    photoPath : Text;
  };

  // The shop window: live (non-archived) products with availability computed
  // net of active checkout holds.
  public query func getProductsView() : async [ProductView] {
    releaseExpired(Time.now());
    let live = Array.filter<(Nat, Product)>(Map.toArray(products), func((_, p)) { not p.archived });
    Array.map<(Nat, Product), ProductView>(live, func((_, p)) {
      {
        id = p.id; name = p.name; description = p.description; priceE8s = p.priceE8s;
        categoryId = (switch (p.categoryId) { case (?c) c; case null 0 });
        categoryName = categoryName(p.categoryId);
        available = availableOf(p); onHand = p.onHand; reserved = p.reserved;
        photoPath = (switch (p.photoPath) { case (?s) s; case null "" });
      };
    });
  };

  // The admin ledger: every product including archived rows, with the lifetime
  // conservation counters.
  public shared query(msg) func getAdminProductsView() : async [{
    id : Nat; name : Text; description : Text; priceE8s : Nat;
    categoryId : Nat; categoryName : Text;
    available : Nat; onHand : Nat; reserved : Nat;
    received : Nat; sold : Nat; returned : Nat; archived : Bool;
    photoPath : Text;
  }] {
    Admin.requireAdmin(admin, msg.caller);
    releaseExpired(Time.now());
    Array.map<(Nat, Product), {
      id : Nat; name : Text; description : Text; priceE8s : Nat;
      categoryId : Nat; categoryName : Text;
      available : Nat; onHand : Nat; reserved : Nat;
      received : Nat; sold : Nat; returned : Nat; archived : Bool;
      photoPath : Text;
    }>(Map.toArray(products), func((_, p)) {
      {
        id = p.id; name = p.name; description = p.description; priceE8s = p.priceE8s;
        categoryId = (switch (p.categoryId) { case (?c) c; case null 0 });
        categoryName = categoryName(p.categoryId);
        available = availableOf(p); onHand = p.onHand; reserved = p.reserved;
        received = p.received; sold = p.sold; returned = p.returned; archived = p.archived;
        photoPath = (switch (p.photoPath) { case (?s) s; case null "" });
      };
    });
  };

  public query func getCategoriesView() : async [{ id : Nat; name : Text; productCount : Nat }] {
    Array.map<(Nat, Category), { id : Nat; name : Text; productCount : Nat }>(
      Map.toArray(categories),
      func((_, c)) {
        var n : Nat = 0;
        for ((_, p) in Map.entries(products)) {
          if (not p.archived and p.categoryId == ?c.id) { n += 1 };
        };
        { id = c.id; name = c.name; productCount = n };
      },
    );
  };

  public shared query(msg) func getCartView() : async [{
    productId : Nat; quantity : Nat; name : Text; priceE8s : Nat;
    available : Nat; photoPath : Text;
  }] {
    releaseExpired(Time.now());
    let cart = switch (Map.get(carts, Principal.compare, msg.caller)) { case (?c) c; case null [] };
    Array.map<CartItem, { productId : Nat; quantity : Nat; name : Text; priceE8s : Nat; available : Nat; photoPath : Text }>(
      cart,
      func(it) {
        switch (getProduct(it.productId)) {
          case (?p) {
            {
              productId = it.productId; quantity = it.quantity; name = p.name; priceE8s = p.priceE8s;
              available = availableOf(p);
              photoPath = (switch (p.photoPath) { case (?s) s; case null "" });
            };
          };
          case null {
            { productId = it.productId; quantity = it.quantity; name = "(removed)"; priceE8s = 0; available = 0; photoPath = "" };
          };
        };
      },
    );
  };

  // The caller's active checkout hold (0-or-1 element). `nowNs` rides along so
  // the SPA computes the countdown from chain time, immune to client clock skew.
  public shared query(msg) func getMyReservationView() : async [{
    expiresAt : Int; nowNs : Int; subtotalE8s : Nat; itemCount : Nat;
  }] {
    let now = Time.now();
    releaseExpired(now);
    switch (Map.get(reservations, Principal.compare, msg.caller)) {
      case (?r) { [{ expiresAt = r.expiresAt; nowNs = now; subtotalE8s = r.subtotalE8s; itemCount = r.items.size() }] };
      case null { [] };
    };
  };

  public shared query(msg) func getMyReservationLinesView() : async [{
    productId : Nat; name : Text; quantity : Nat; unitPriceE8s : Nat; photoPath : Text;
  }] {
    releaseExpired(Time.now());
    switch (Map.get(reservations, Principal.compare, msg.caller)) {
      case null { [] };
      case (?r) {
        Array.map<CartItem, { productId : Nat; name : Text; quantity : Nat; unitPriceE8s : Nat; photoPath : Text }>(
          r.items,
          func(it) {
            switch (getProduct(it.productId)) {
              case (?p) {
                {
                  productId = it.productId; name = p.name; quantity = it.quantity; unitPriceE8s = p.priceE8s;
                  photoPath = (switch (p.photoPath) { case (?s) s; case null "" });
                };
              };
              case null { { productId = it.productId; name = "(removed)"; quantity = it.quantity; unitPriceE8s = 0; photoPath = "" } };
            };
          },
        );
      };
    };
  };

  // Price a checkout before placing it: subtotal from the active hold (or the
  // cart), promo validated exactly as checkout will. One element, always.
  public shared query(msg) func quoteCheckoutView(code : Text) : async [{
    subtotalE8s : Nat; discountE8s : Nat; totalE8s : Nat; codeOk : Bool; note : Text;
  }] {
    let now = Time.now();
    releaseExpired(now);
    let items = switch (Map.get(reservations, Principal.compare, msg.caller)) {
      case (?r) { r.items };
      case null { switch (Map.get(carts, Principal.compare, msg.caller)) { case (?c) c; case null [] } };
    };
    let subtotal = cartSubtotal(items);
    var discount : Nat = 0;
    var codeOk = false;
    var note = "";
    if (Text.size(Text.trim(code, #char ' ')) > 0) {
      switch (validateDiscount(code, subtotal, now)) {
        case (#ok(d)) { discount := discountAmount(d, subtotal); codeOk := true };
        case (#err(why)) { note := why };
      };
    };
    [{ subtotalE8s = subtotal; discountE8s = discount; totalE8s = satSub(subtotal, discount); codeOk; note }];
  };

  // Returns only the caller's own orders (newest first); identity from
  // msg.caller so no caller can read another principal's history.
  public shared query(msg) func getOrderHistoryView() : async [{
    id : Nat; subtotalE8s : Nat; discountE8s : Nat; totalE8s : Nat;
    status : Text; createdAt : Int; itemCount : Nat; discountCode : Text;
  }] {
    let mine = Array.filter<(OrderId, Order)>(Map.toArray(orders), func((_, o)) { Principal.equal(o.buyer, msg.caller) });
    Array.map<(Nat, Order), { id : Nat; subtotalE8s : Nat; discountE8s : Nat; totalE8s : Nat; status : Text; createdAt : Int; itemCount : Nat; discountCode : Text }>(
      Array.reverse(mine),
      func((_, o)) {
        {
          id = o.id; subtotalE8s = o.subtotalE8s; discountE8s = o.discountE8s; totalE8s = o.totalE8s;
          status = statusText(o.status); createdAt = o.createdAt; itemCount = o.lines.size();
          discountCode = (switch (o.discountCode) { case (?c) c; case null "" });
        };
      },
    );
  };

  func requireOrderAccess(caller : Principal, o : Order) {
    if (not Principal.equal(o.buyer, caller) and not Admin.isAdmin(admin, caller)) {
      Runtime.trap(errText(#notYours));
    };
  };

  // One order's header (0-or-1). Buyer or admin.
  public shared query(msg) func getOrderView(orderId : Nat) : async [{
    id : Nat; subtotalE8s : Nat; discountE8s : Nat; totalE8s : Nat;
    status : Text; createdAt : Int; itemCount : Nat; discountCode : Text; invoiceId : Nat;
  }] {
    switch (Map.get(orders, Nat.compare, orderId)) {
      case null { [] };
      case (?o) {
        requireOrderAccess(msg.caller, o);
        [{
          id = o.id; subtotalE8s = o.subtotalE8s; discountE8s = o.discountE8s; totalE8s = o.totalE8s;
          status = statusText(o.status); createdAt = o.createdAt; itemCount = o.lines.size();
          discountCode = (switch (o.discountCode) { case (?c) c; case null "" });
          invoiceId = (switch (o.invoiceId) { case (?i) i; case null 0 });
        }];
      };
    };
  };

  // One order's lines — the purchase-time snapshot (names + prices as bought).
  public shared query(msg) func getOrderLinesView(orderId : Nat) : async [{
    productId : Nat; name : Text; quantity : Nat; unitPriceE8s : Nat;
  }] {
    switch (Map.get(orders, Nat.compare, orderId)) {
      case null { [] };
      case (?o) {
        requireOrderAccess(msg.caller, o);
        Array.map<OrderLine, { productId : Nat; name : Text; quantity : Nat; unitPriceE8s : Nat }>(
          o.lines,
          func(l) { { productId = l.productId; name = l.name; quantity = l.quantity; unitPriceE8s = l.unitPriceE8s } },
        );
      };
    };
  };

  // One order's timeline, oldest first — the audit events wearing buyer-safe
  // clothes. Buyer or admin.
  public shared query(msg) func getOrderEventsView(orderId : Nat) : async [{
    at : Int; kind : Text; detail : Text;
  }] {
    switch (Map.get(orders, Nat.compare, orderId)) {
      case null { [] };
      case (?o) {
        requireOrderAccess(msg.caller, o);
        let out = List.empty<{ at : Int; kind : Text; detail : Text }>();
        for (e in List.values(audit)) {
          if (e.orderId == orderId) { List.add(out, { at = e.at; kind = e.kind; detail = e.detail }) };
        };
        List.toArray(out);
      };
    };
  };

  // The shop's whole order book (newest first, paged). Admin only.
  public shared query(msg) func getAllOrdersView(offset : Nat, limit : Nat) : async [{
    id : Nat; buyer : Principal; subtotalE8s : Nat; discountE8s : Nat; totalE8s : Nat;
    status : Text; createdAt : Int; itemCount : Nat; discountCode : Text;
  }] {
    Admin.requireAdmin(admin, msg.caller);
    let newestFirst = Array.reverse(Map.toArray(orders));
    let n = Array.size(newestFirst);
    if (offset >= n) return [];
    let upto = Nat.min(n, offset + Nat.min(limit, 100));
    let out = List.empty<{ id : Nat; buyer : Principal; subtotalE8s : Nat; discountE8s : Nat; totalE8s : Nat; status : Text; createdAt : Int; itemCount : Nat; discountCode : Text }>();
    var i = offset;
    while (i < upto) {
      let (_, o) = newestFirst[i];
      List.add(out, {
        id = o.id; buyer = o.buyer; subtotalE8s = o.subtotalE8s; discountE8s = o.discountE8s; totalE8s = o.totalE8s;
        status = statusText(o.status); createdAt = o.createdAt; itemCount = o.lines.size();
        discountCode = (switch (o.discountCode) { case (?c) c; case null "" });
      });
      i += 1;
    };
    List.toArray(out);
  };

  // Invoices issued to the caller (flat view the frontend decodes directly).
  public type InvoiceView = {
    id : Nat; issuer : Principal; recipient : Principal;
    subtotalE8s : Nat; taxE8s : Nat; totalE8s : Nat;
    status : Text; itemCount : Nat; createdAt : Int;
  };
  public shared query (msg) func myInvoicesView() : async [InvoiceView] {
    Array.map<Invoices.Invoice, InvoiceView>(
      Invoices.forPrincipal(invoices, msg.caller),
      func(i) {
        {
          id = i.id; issuer = i.issuer; recipient = i.recipient;
          subtotalE8s = i.subtotalE8s; taxE8s = i.taxE8s; totalE8s = i.totalE8s;
          status = Invoices.statusText(i.status); itemCount = i.lineItems.size(); createdAt = i.createdAt;
        };
      },
    );
  };

  // Promo codes with their redemption counters. Admin only.
  public shared query(msg) func getDiscountsView() : async [{
    code : Text; percentBps : Nat; fixedE8s : Nat; minSubtotalE8s : Nat;
    maxRedemptions : Nat; redemptions : Nat; expiresAt : Int; active : Bool;
  }] {
    Admin.requireAdmin(admin, msg.caller);
    Array.map<(Text, Discount), { code : Text; percentBps : Nat; fixedE8s : Nat; minSubtotalE8s : Nat; maxRedemptions : Nat; redemptions : Nat; expiresAt : Int; active : Bool }>(
      Map.toArray(discounts),
      func((_, d)) {
        {
          code = d.code;
          percentBps = (switch (d.kind) { case (#percentBps(b)) b; case _ 0 });
          fixedE8s = (switch (d.kind) { case (#fixedE8s(v)) v; case _ 0 });
          minSubtotalE8s = d.minSubtotalE8s; maxRedemptions = d.maxRedemptions; redemptions = d.redemptions;
          expiresAt = (switch (d.expiresAt) { case (?t) t; case null 0 });
          active = d.active;
        };
      },
    );
  };

  // The audit trail, newest first, paged. Admin only (order-scoped slices are
  // available to buyers via getOrderEventsView).
  public shared query(msg) func getAuditView(offset : Nat, limit : Nat) : async [{
    id : Nat; at : Int; who : Principal; kind : Text; detail : Text; orderId : Nat; productId : Nat;
  }] {
    Admin.requireAdmin(admin, msg.caller);
    let n = List.size(audit);
    if (offset >= n) return [];
    let take = Nat.min(Nat.min(limit, 100), n - offset);
    let out = List.empty<{ id : Nat; at : Int; who : Principal; kind : Text; detail : Text; orderId : Nat; productId : Nat }>();
    var i = 0;
    // newest first = walk the list backwards from the end, skipping `offset`.
    for (e in List.reverseValues(audit)) {
      if (i >= offset and i < offset + take) { List.add(out, e) };
      i += 1;
    };
    List.toArray(out);
  };

  // ── The books, held open ──────────────────────────────────────────────────

  // Recompute every inventory invariant from scratch and report violations.
  // PUBLIC on purpose: anyone can audit the shop. An empty reply is the proof.
  //   rule "conservation":  onHand + sold == received + returned
  //   rule "reserve-match": reserved == Σ quantities in active holds
  //   rule "reserve-bound": reserved <= onHand
  public query func invariantReportView() : async [{
    productId : Nat; name : Text; rule : Text; expected : Nat; actual : Nat;
  }] {
    releaseExpired(Time.now());
    // Independent recomputation of reserved-per-product from the holds map.
    let heldPer = Map.empty<ProductId, Nat>();
    for ((_, r) in Map.entries(reservations)) {
      for ((pid, qty) in Map.entries(consolidate(r.items))) {
        let prev = switch (Map.get(heldPer, Nat.compare, pid)) { case (?q) q; case null 0 };
        Map.add(heldPer, Nat.compare, pid, prev + qty);
      };
    };
    let bad = List.empty<{ productId : Nat; name : Text; rule : Text; expected : Nat; actual : Nat }>();
    for ((_, p) in Map.entries(products)) {
      if (p.onHand + p.sold != p.received + p.returned) {
        List.add(bad, { productId = p.id; name = p.name; rule = "conservation"; expected = p.received + p.returned; actual = p.onHand + p.sold });
      };
      let held = switch (Map.get(heldPer, Nat.compare, p.id)) { case (?q) q; case null 0 };
      if (p.reserved != held) {
        List.add(bad, { productId = p.id; name = p.name; rule = "reserve-match"; expected = held; actual = p.reserved });
      };
      if (p.reserved > p.onHand) {
        List.add(bad, { productId = p.id; name = p.name; rule = "reserve-bound"; expected = p.onHand; actual = p.reserved });
      };
    };
    List.toArray(bad);
  };

  // The one-line seal for the storefront footer: how many products were
  // checked, how many invariants failed (0 = the books balance), plus the
  // headline stock numbers. Public.
  public query func conservationView() : async [{
    productsChecked : Nat; violations : Nat; unitsOnHand : Nat; unitsReserved : Nat; checkedAt : Int;
  }] {
    releaseExpired(Time.now());
    let heldPer = Map.empty<ProductId, Nat>();
    for ((_, r) in Map.entries(reservations)) {
      for ((pid, qty) in Map.entries(consolidate(r.items))) {
        let prev = switch (Map.get(heldPer, Nat.compare, pid)) { case (?q) q; case null 0 };
        Map.add(heldPer, Nat.compare, pid, prev + qty);
      };
    };
    var checked : Nat = 0;
    var violations : Nat = 0;
    var onHand : Nat = 0;
    var reserved : Nat = 0;
    for ((_, p) in Map.entries(products)) {
      checked += 1;
      onHand += p.onHand;
      reserved += p.reserved;
      if (p.onHand + p.sold != p.received + p.returned) { violations += 1 };
      let held = switch (Map.get(heldPer, Nat.compare, p.id)) { case (?q) q; case null 0 };
      if (p.reserved != held) { violations += 1 };
      if (p.reserved > p.onHand) { violations += 1 };
    };
    [{ productsChecked = checked; violations; unitsOnHand = onHand; unitsReserved = reserved; checkedAt = Time.now() }];
  };

  // The shop dashboard in one call. Admin only (it aggregates buyer activity).
  public shared query(msg) func getShopStatsView() : async [{
    products : Nat; activeProducts : Nat; categories : Nat;
    ordersTotal : Nat; ordersPlaced : Nat; ordersShipped : Nat; ordersDelivered : Nat;
    ordersCancelled : Nat; ordersRefunded : Nat;
    unitsOnHand : Nat; unitsReserved : Nat; unitsSold : Nat; unitsReturned : Nat;
    revenueE8s : Nat; activeHolds : Nat; discountsActive : Nat;
    invoiceCount : Nat; auditEvents : Nat;
  }] {
    Admin.requireAdmin(admin, msg.caller);
    releaseExpired(Time.now());
    var activeProducts : Nat = 0;
    var unitsOnHand : Nat = 0; var unitsReserved : Nat = 0;
    var unitsSold : Nat = 0; var unitsReturned : Nat = 0;
    for ((_, p) in Map.entries(products)) {
      if (not p.archived) { activeProducts += 1 };
      unitsOnHand += p.onHand; unitsReserved += p.reserved;
      unitsSold += p.sold; unitsReturned += p.returned;
    };
    var placed : Nat = 0; var shipped : Nat = 0; var delivered : Nat = 0;
    var cancelled : Nat = 0; var refunded : Nat = 0; var revenue : Nat = 0;
    for ((_, o) in Map.entries(orders)) {
      switch (o.status) {
        case (#placed) { placed += 1; revenue += o.totalE8s };
        case (#shipped) { shipped += 1; revenue += o.totalE8s };
        case (#delivered) { delivered += 1; revenue += o.totalE8s };
        case (#cancelled) { cancelled += 1 };
        case (#refunded) { refunded += 1 };
      };
    };
    var discountsActive : Nat = 0;
    for ((_, d) in Map.entries(discounts)) { if (d.active) { discountsActive += 1 } };
    [{
      products = Map.size(products); activeProducts; categories = Map.size(categories);
      ordersTotal = Map.size(orders); ordersPlaced = placed; ordersShipped = shipped;
      ordersDelivered = delivered; ordersCancelled = cancelled; ordersRefunded = refunded;
      unitsOnHand; unitsReserved; unitsSold; unitsReturned;
      revenueE8s = revenue; activeHolds = Map.size(reservations); discountsActive;
      invoiceCount = Invoices.count(invoices); auditEvents = List.size(audit);
    }];
  };
}
