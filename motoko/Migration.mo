import Map "mo:core/Map";
import Nat "mo:core/Nat";
import List "mo:core/List";

/// v1 → v2 state migration for the Souk store.
///
/// v1 products carried a single `stockCount`; v2 splits the shelf into the
/// conservation ledger (onHand / reserved / received / sold / returned). The
/// lifetime `sold` counter is RECONSTRUCTED from the v1 order book, and
/// `received` is derived as onHand + sold, so the v2 conservation law
/// (onHand + sold == received + returned) holds for migrated state and the
/// public invariant oracle stays green from the first post-upgrade read.
///
/// v1 orders carried bare (productId, quantity) items and one total; v2 order
/// lines snapshot name + unit price. Names and prices are resolved from the
/// v1 catalogue at migration time (the best information that exists), the
/// v1 total becomes both subtotal and charged total (no promos existed), and
/// the invoice link is left empty (v1 didn't record it).
module {
  type CartItem = { productId : Nat; quantity : Nat };

  type ProductV1 = {
    id : Nat; name : Text; description : Text; priceE8s : Nat;
    stockCount : Nat; photoPath : ?Text;
  };
  type OrderV1 = {
    id : Nat; buyer : Principal; items : [CartItem]; totalAmount : Nat;
    status : { #placed; #shipped; #delivered }; createdAt : Int;
  };

  type ProductV2 = {
    id : Nat; name : Text; description : Text; priceE8s : Nat;
    categoryId : ?Nat;
    onHand : Nat; reserved : Nat; received : Nat; sold : Nat; returned : Nat;
    photoPath : ?Text; archived : Bool;
  };
  type OrderLine = { productId : Nat; name : Text; quantity : Nat; unitPriceE8s : Nat };
  type OrderV2 = {
    id : Nat; buyer : Principal; lines : [OrderLine];
    subtotalE8s : Nat; discountE8s : Nat; totalE8s : Nat;
    discountCode : ?Text;
    status : { #placed; #shipped; #delivered; #cancelled; #refunded };
    createdAt : Int; invoiceId : ?Nat;
  };

  public func run(old : {
    products : Map.Map<Nat, ProductV1>;
    orders : Map.Map<Nat, OrderV1>;
  }) : {
    products : Map.Map<Nat, ProductV2>;
    orders : Map.Map<Nat, OrderV2>;
  } {
    // Lifetime sold per product, rebuilt from every v1 order (v1 had no
    // cancel/refund, so every order line counts as sold).
    let soldPer = Map.empty<Nat, Nat>();
    for ((_, o) in Map.entries(old.orders)) {
      for (it in o.items.values()) {
        let prev = switch (Map.get(soldPer, Nat.compare, it.productId)) { case (?q) q; case null 0 };
        Map.add(soldPer, Nat.compare, it.productId, prev + it.quantity);
      };
    };

    let products = Map.empty<Nat, ProductV2>();
    for ((k, p) in Map.entries(old.products)) {
      let sold = switch (Map.get(soldPer, Nat.compare, p.id)) { case (?q) q; case null 0 };
      Map.add(products, Nat.compare, k, {
        id = p.id; name = p.name; description = p.description; priceE8s = p.priceE8s;
        categoryId = null;
        onHand = p.stockCount; reserved = 0;
        received = p.stockCount + sold; sold; returned = 0;
        photoPath = p.photoPath; archived = false;
      });
    };

    let orders = Map.empty<Nat, OrderV2>();
    for ((k, o) in Map.entries(old.orders)) {
      let lines = List.empty<OrderLine>();
      for (it in o.items.values()) {
        let (name, price) = switch (Map.get(old.products, Nat.compare, it.productId)) {
          case (?p) (p.name, p.priceE8s);
          case null ("item", 0);
        };
        List.add(lines, { productId = it.productId; name; quantity = it.quantity; unitPriceE8s = price });
      };
      Map.add(orders, Nat.compare, k, {
        id = o.id; buyer = o.buyer; lines = List.toArray(lines);
        subtotalE8s = o.totalAmount; discountE8s = 0; totalE8s = o.totalAmount;
        discountCode = null; status = o.status; createdAt = o.createdAt;
        invoiceId = null;
      });
    };

    { products; orders };
  };
}
