import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";
import Result "mo:core/Result";
import Admin "mo:thebes-lib/Admin";

persistent actor Store {
  type ProductId = Nat;
  type OrderId = Nat;

  type Product = {
    id : ProductId;
    name : Text;
    description : Text;
    priceE8s : Nat;
    stockCount : Nat;
    // Pointer to the product photo on the media contract (e.g. "/photo/{hash}").
    // The image BYTES live in the media contract; this store holds only the
    // pointer (the storage law). null = no photo yet.
    photoPath : ?Text;
  };

  type CartItem = {
    productId : ProductId;
    quantity : Nat;
  };

  // Spec statuses: placed -> shipped -> delivered (forward-only).
  type OrderStatus = { #placed; #shipped; #delivered };

  type Order = {
    id : OrderId;
    buyer : Principal;
    items : [CartItem];
    totalAmount : Nat;
    status : OrderStatus;
    createdAt : Int;
  };

  var nextProductId : Nat = 1;
  var nextOrderId : Nat = 1;

  // Standard admin surface (lib/Admin): owner claim/transfer, admins tier,
  // emergency-stop pause. Catalogue/order admin mutations are guarded by it.
  var admin = Admin.init();

  let products = Map.empty<ProductId, Product>();
  // Carts are keyed by Principal so each caller has exactly one cart; identity
  // is always taken from msg.caller, never from a passed-in principal.
  let carts = Map.empty<Principal, [CartItem]>();
  let orders = Map.empty<OrderId, Order>();

  // First caller wins. Anonymous callers are rejected before the claim so the
  // anonymous principal can never own the store (preserved from the audit fix —
  // Admin.claimOwner itself does not reject anonymous).
  public shared(msg) func claimOwner() : async Bool {
    if (Principal.isAnonymous(msg.caller)) Runtime.trap("anonymous caller");
    Admin.claimOwner(admin, msg.caller)
  };
  public shared(msg) func transferOwner(n : Principal) : async Bool { Admin.transferOwner(admin, msg.caller, n) };
  public shared(msg) func addAdmin(w : Principal) : async Bool { Admin.addAdmin(admin, msg.caller, w) };
  public shared(msg) func removeAdmin(w : Principal) : async Bool { Admin.removeAdmin(admin, msg.caller, w) };
  public shared(msg) func setPaused(v : Bool) : async Bool { Admin.setPaused(admin, msg.caller, v) };
  public query func getOwner() : async ?Principal { Admin.getOwner(admin) };
  public query func getAdmins() : async [Principal] { Admin.getAdmins(admin) };
  public query func isPaused() : async Bool { Admin.isPaused(admin) };

  // No-auth core: append a product. Shared by the admin-gated public method and
  // by seedDemo (which bypasses the gate only on an empty just-deployed store).
  private func addProductRaw(name : Text, description : Text, priceE8s : Nat, stockCount : Nat, photoPath : ?Text) : ProductId {
    if (priceE8s == 0) Runtime.trap("price must be > 0");
    let productId = nextProductId;
    nextProductId += 1;
    let product : Product = { id = productId; name; description; priceE8s; stockCount; photoPath };
    Map.add(products, Nat.compare, productId, product);
    productId;
  };

  public shared(msg) func addProduct(name : Text, description : Text, priceE8s : Nat, stockCount : Nat, photoPath : ?Text) : async ProductId {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, msg.caller);
    addProductRaw(name, description, priceE8s, stockCount, photoPath);
  };

  // Seed a demo catalog on a fresh store so a just-deployed shop is alive.
  // Global content: fires only when the catalog is empty (bypasses the admin
  // gate so the first signed-in visitor brings it to life). Photos seed empty
  // (image bytes live on the media contract, content-addressed by upload).
  public shared(msg) func seedDemo() : async Bool {
    Admin.requireNotPaused(admin);
    if (Principal.isAnonymous(msg.caller)) Runtime.trap("Sign in to load demo data");
    if (Map.size(products) > 0) return false;
    ignore addProductRaw("Stoneware Mug", "Hand-glazed 12oz ceramic mug.", 1800000000, 40, null);
    ignore addProductRaw("Linen Apron", "Stonewashed flax apron with leather ties.", 4200000000, 18, null);
    ignore addProductRaw("Pour-Over Kettle", "Gooseneck kettle, brushed steel.", 6500000000, 12, null);
    ignore addProductRaw("Cedar Cutting Board", "End-grain board, food-safe oil finish.", 5400000000, 25, null);
    ignore addProductRaw("Wool Throw", "Lambswool blanket, herringbone weave.", 8900000000, 9, null);
    ignore addProductRaw("Beeswax Candle", "Hand-poured, unscented, 50hr burn.", 1500000000, 60, null);
    true;
  };

  // Set/replace a product's photo. The admin uploads the image to the media
  // contract first (frontend → /photo/{hash}), then passes that path here.
  public shared(msg) func setProductPhoto(productId : ProductId, photoPath : Text) : async () {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, msg.caller);
    switch (Map.get(products, Nat.compare, productId)) {
      case null { Runtime.trap("product not found") };
      case (?product) {
        Map.add(products, Nat.compare, productId, { product with photoPath = ?photoPath });
      };
    };
  };

  public query func getProducts() : async [Product] {
    let prodArray = Map.toArray(products);
    Array.map(prodArray, func((_, p)) { p })
  };

  public shared(msg) func addToCart(productId : ProductId, quantity : Nat) : async () {
    Admin.requireNotPaused(admin);
    // Anonymous callers would all share one cart keyed by the anonymous
    // principal; reject them so carts stay per-identity.
    if (Principal.isAnonymous(msg.caller)) Runtime.trap("anonymous caller");
    if (quantity == 0) return;

    switch (Map.get(products, Nat.compare, productId)) {
      case null { Runtime.trap("Product not found") };
      case (?product) {
        if (product.stockCount == 0) return;

        let existingCart = switch (Map.get(carts, Principal.compare, msg.caller)) {
          case (?c) { c };
          case null { [] };
        };

        // Merge into an existing entry for the same product so a cart never
        // holds two entries for one productId. Without this, checkout would
        // validate each entry independently against full stock, then the
        // sequential decrements would trap on Nat underflow.
        var merged = false;
        let updatedCart = Array.map<CartItem, CartItem>(existingCart, func(it) {
          if (it.productId == productId) {
            merged := true;
            { productId; quantity = it.quantity + quantity }
          } else {
            it
          }
        });

        let finalCart = if (merged) {
          updatedCart
        } else {
          Array.concat(updatedCart, [{ productId; quantity }])
        };

        Map.add(carts, Principal.compare, msg.caller, finalCart);
      };
    };
  };

  // Core checkout over an explicit caller, so both the Result-returning
  // `checkout()` (programmatic callers) and the trap-wrapping `checkoutOrTrap()`
  // (the SPA, which wants a clean success value or a typed error) share one
  // implementation. Synchronous (no await) — safe to call from both wrappers.
  private func doCheckout(caller : Principal) : Result.Result<OrderId, Text> {
    Admin.requireNotPaused(admin);
    // Identity always from msg.caller, never a passed-in principal.
    if (Principal.isAnonymous(caller)) return #err("anonymous caller");

    let cart = switch (Map.get(carts, Principal.compare, caller)) {
      case (?c) { c };
      case null { return #err("empty cart") };
    };

    if (Array.size(cart) == 0) return #err("empty cart");

    // Validate-all-then-mutate: sum the requested quantity per product first
    // (defensive — addToCart merges entries, but checkout must not rely on
    // that invariant), validate every sum against stock BEFORE any state
    // mutation, and only then decrement stock and create the order, so a
    // failed validation never leaves the catalogue in a partial state.
    let wanted = Map.empty<ProductId, Nat>();
    for (item in cart.values()) {
      let prev = switch (Map.get(wanted, Nat.compare, item.productId)) {
        case (?q) { q };
        case null { 0 };
      };
      Map.add(wanted, Nat.compare, item.productId, prev + item.quantity);
    };

    var totalAmount : Nat = 0;
    for ((productId, quantity) in Map.entries(wanted)) {
      switch (Map.get(products, Nat.compare, productId)) {
        case null { return #err("unknown product") };
        case (?product) {
          if (product.stockCount < quantity) return #err("insufficient stock");
          totalAmount += product.priceE8s * quantity;
        };
      };
    };

    let orderId = nextOrderId;
    nextOrderId += 1;

    let order : Order = {
      id = orderId;
      buyer = caller;
      items = cart;
      totalAmount;
      status = #placed;
      createdAt = Time.now();
    };

    Map.add(orders, Nat.compare, orderId, order);

    // Mutation phase: one decrement per product from the validated sums.
    for ((productId, quantity) in Map.entries(wanted)) {
      switch (Map.get(products, Nat.compare, productId)) {
        case (?product) {
          let updatedProduct = { product with stockCount = product.stockCount - quantity };
          Map.add(products, Nat.compare, productId, updatedProduct);
        };
        case null {};
      };
    };

    ignore Map.take(carts, Principal.compare, caller);

    #ok(orderId)
  };

  public shared(msg) func checkout() : async Result.Result<OrderId, Text> { doCheckout(msg.caller) };

  // Frontend-friendly checkout: returns the new order id, or traps with the
  // reason so the SPA's update call resolves to a clean value or a typed error.
  public shared(msg) func checkoutOrTrap() : async Nat {
    switch (doCheckout(msg.caller)) { case (#ok(id)) { id }; case (#err(e)) { Runtime.trap(e) } };
  };

  // Returns only the caller's own orders; identity from msg.caller so no
  // caller can read another principal's order history.
  public shared query(msg) func getOrderHistory() : async [Order] {
    let allOrders = Map.toArray(orders);
    let userOrders = Array.filter(allOrders, func((_, o)) { Principal.equal(o.buyer, msg.caller) });
    Array.map(userOrders, func((_, o)) { o })
  };

  // Forward-only status transitions: placed -> shipped -> delivered. Backward
  // or skipping transitions are rejected. Owner-only.
  func validTransition(from : OrderStatus, to : OrderStatus) : Bool {
    switch (from, to) {
      case (#placed, #shipped) { true };
      case (#shipped, #delivered) { true };
      case _ { false };
    };
  };

  public shared(msg) func updateOrderStatus(orderId : OrderId, newStatus : OrderStatus) : async () {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, msg.caller);
    switch (Map.get(orders, Nat.compare, orderId)) {
      case null { Runtime.trap("order not found") };
      case (?order) {
        if (not validTransition(order.status, newStatus)) {
          Runtime.trap("invalid status transition");
        };
        let updatedOrder = { order with status = newStatus };
        Map.add(orders, Nat.compare, orderId, updatedOrder);
      };
    };
  };

  public shared(msg) func restockProduct(productId : ProductId, additionalStock : Nat) : async () {
    Admin.requireNotPaused(admin);
    Admin.requireAdmin(admin, msg.caller);
    switch (Map.get(products, Nat.compare, productId)) {
      case null { Runtime.trap("product not found") };
      case (?product) {
        let updatedProduct = { product with stockCount = product.stockCount + additionalStock };
        Map.add(products, Nat.compare, productId, updatedProduct);
      };
    };
  };

  // ── Frontend view-models (flat records, easy to decode in the SPA) ──
  // The example SPA uses a lightweight Candid decoder that reads flat records
  // (no opt/variant/nested-vec). These mirror the rich types for the UI:
  // photoPath opt → "" when absent, status variant → its text tag, and a cart
  // view that joins product name + price so the cart page needs one call.

  func statusText(s : OrderStatus) : Text {
    switch s { case (#placed) "placed"; case (#shipped) "shipped"; case (#delivered) "delivered" };
  };

  public query func getProductsView() : async [{ id : Nat; name : Text; description : Text; priceE8s : Nat; stockCount : Nat; photoPath : Text }] {
    Array.map<(Nat, Product), { id : Nat; name : Text; description : Text; priceE8s : Nat; stockCount : Nat; photoPath : Text }>(
      Map.toArray(products),
      func((_, p)) {
        {
          id = p.id; name = p.name; description = p.description;
          priceE8s = p.priceE8s; stockCount = p.stockCount;
          photoPath = (switch (p.photoPath) { case (?s) s; case null "" });
        }
      },
    )
  };

  public shared query(msg) func getCartView() : async [{ productId : Nat; quantity : Nat; name : Text; priceE8s : Nat }] {
    let cart = switch (Map.get(carts, Principal.compare, msg.caller)) { case (?c) c; case null [] };
    Array.map<CartItem, { productId : Nat; quantity : Nat; name : Text; priceE8s : Nat }>(
      cart,
      func(it) {
        let (nm, pr) = switch (Map.get(products, Nat.compare, it.productId)) {
          case (?p) (p.name, p.priceE8s); case null ("(removed)", 0);
        };
        { productId = it.productId; quantity = it.quantity; name = nm; priceE8s = pr }
      },
    )
  };

  public shared query(msg) func getOrderHistoryView() : async [{ id : Nat; totalAmount : Nat; status : Text; createdAt : Int; itemCount : Nat }] {
    let mine = Array.filter(Map.toArray(orders), func((_, o) : (OrderId, Order)) : Bool { Principal.equal(o.buyer, msg.caller) });
    Array.map<(Nat, Order), { id : Nat; totalAmount : Nat; status : Text; createdAt : Int; itemCount : Nat }>(
      mine,
      func((_, o)) {
        { id = o.id; totalAmount = o.totalAmount; status = statusText(o.status); createdAt = o.createdAt; itemCount = o.items.size() }
      },
    )
  };
}
