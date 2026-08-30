# thebes-example-store

An on-chain storefront built on [Thebes Protocol](https://github.com/Mercatura-Forum/Thebes-Protocol-):
a Motoko backend that holds the catalog, carts, checkout holds, orders and
invoices, and a React frontend served as certified assets — with a procedural
3D hero, hand-drawn product art, categories and scoped search.

The property this example proves is **inventory conservation**. Every unit that
enters the shop is accounted across on-hand stock, checkout holds, sales and
returns, and anyone can re-verify the ledger identity at any time through the
public oracle (`invariantReportView` / `conservationView`):

```
onHand + sold == received + returned      (per product)
reserved      == Σ active checkout holds
reserved      <= onHand
```

Checkout is validate-all-then-mutate inside one message; promo discounts are
allocated into invoice line items unit-exactly, so an invoice total always
equals the charged total.

## Architecture

```
frontend (React + Vite + Tailwind)   →   store backend (Motoko)
   @thebes/sdk  ── boundary client       mo:thebes-lib ── Admin / Users / Pagination
   Memphis passkey gate                  catalog · carts · orders
```

- **frontend/** uses `@thebes/sdk` for the boundary client, typed query/update
  calls, React hooks, and the Memphis passkey gate. The SDK is **vendored** under
  `frontend/vendor/@thebes/sdk` and resolved as a local dependency
  (upstream source of truth: [`thebes-sdk`](https://github.com/Mercatura-Forum/thebes-sdk)).
- **motoko/** uses `thebes-lib` for `Admin` (controller-gated operations) and
  `Invoices`; the storefront logic lives in `main.mo`. The library is **vendored**
  under `motoko/thebes-lib` and resolved as a local Mops dependency.

Both halves are self-contained: the repository builds with no external Git or Mops
toolkit pins. The frontend asset-canister wasm is the one artifact fetched at
deploy time (see [Deploy](#deploy)).

## Identity

The header sign-in is a Memphis (contract **921**) **frontend gate**. It gives
the UI a display name and nothing more: this example's backend authorises on
`msg.caller` through `thebes-lib`'s `Admin`, and never verifies a Memphis
session. No write here is gated by who you signed in as.

That is correct for an owner-and-admin surface, which is what this example is.
**It is not enough if you are copying this for anything user-scoped** — a
balance, a profile, a document someone owns. For that, take the session token
as a call argument and verify it on the backend:

```motoko
switch (await* MemphisAuth.verifyWithAudience(gate, token, AUDIENCE)) {
  case (#ok(id)) { /* id.principal — key user state on this */ };
  case (#err(_)) { /* refuse */ };
};
```

`origin` on the gate is a pseudonym namespace and is frozen for the life of the
app; `AUDIENCE` is the web origin you are served from, and it is the one line
that changes when you move to your own domain. On your own domain the passkey
ceremony cannot run in the page — a page may only claim a WebAuthn RP ID that is
a registrable-domain suffix of its own origin — so use `<MemphisConnectGate>`
from `@thebes/sdk`.

Full guide, both halves: **[`docs/memphis.md`](https://github.com/Mercatura-Forum/thebes-sdk/blob/main/docs/memphis.md)**.

## Backend interface (selected)

| Method | Kind | Purpose |
| --- | --- | --- |
| `getProductsView` / `getCategoriesView` | query | Browse the catalog and its categories (availability is net of other shoppers' holds). |
| `seedDemo` | update | Populate a demo shop — categories, products, promo codes. |
| `addProduct` / `updateProduct` / `restockProduct` / `setProductPhoto` / `setProductArchived` | update | Catalogue management (admin); archive keeps history intact. |
| `addCategory` / `renameCategory` / `createDiscount` / `setDiscountActive` | update | Categories and promo codes (admin). |
| `addToCart` / `setCartQuantity` / `removeFromCart` / `getCartView` | update / query | Build and edit the caller's cart. |
| `beginCheckoutOrTrap` / `quoteCheckoutView` / `checkoutOrTrap` | update / query / update | Take a 10-minute stock hold, price it (promo validated by the same on-chain rules), place the order atomically. |
| `cancelOrderOrTrap` / `shipOrder` / `deliverOrder` / `refundOrder` | update | Order lifecycle; cancel and refund restock and void the invoice. |
| `getOrderHistoryView` / `getOrderLinesView` / `getOrderEventsView` / `myInvoicesView` | query | The caller's orders (price-snapshotted lines), per-order timeline, invoices. |
| `getShopStatsView` / `getAuditView` | query | Shop dashboard and the append-only audit trail (admin). |
| `invariantReportView` / `conservationView` | query | **The public oracle** — recomputes the conservation laws; an empty report is the proof. |
| `claimOwner` / `addAdmin` / `setPaused` | update | Ownership and admin surface (from `thebes-lib`'s `Admin`). |

The token uses 8 decimals (e8s); prices are stored and returned in base units.

## Toolchain

- **Motoko compiler 1.4.1.** `mops install` fetches the pinned compiler to
  `~/.cache/mops/moc/1.4.1/moc` (macOS: `~/Library/Caches/mops/moc/1.4.1/moc`).
  Use that binary — the `moc` on a default `PATH` may be a different version, or
  Qt's unrelated Meta-Object Compiler.
- **Node 18+** and **[Mops](https://mops.one)** for the two builds.
- **[`thebes-deploy`](https://github.com/Mercatura-Forum/Thebes-Protocol-/releases)**
  to deploy. The prebuilt binary is Linux x86-64; on other platforms build it from
  the release source bundle (`cargo build --release -p thebes-deploy`).

## Run locally

```sh
# Frontend
cd frontend
npm install            # resolves the vendored @thebes/sdk
npm run dev            # sync-sdk copies the browser runtimes into public/, then Vite serves

# Backend (compile-check)
cd ../motoko
mops install           # resolves the vendored thebes-lib + the pinned compiler
"$(ls "$HOME/.cache/mops/moc/1.4.1/moc" "$HOME/Library/Caches/mops/moc/1.4.1/moc" 2>/dev/null | head -1)" --check $(mops sources) main.mo
```

## Deploy

`thebes.toml` describes the deploy. It ships with the current WAN cluster
validator endpoints already filled in — `thebes-deploy init` reprints the current
set if they ever change.

> **Deploying your own copy?** The committed `cid` values pin the **live catalog
> deployment** (that's what the demo links serve — only its controller can
> upgrade it). Before your first deploy, set `cid = "auto"` on both canisters:
> the deploy allocates fresh canisters you control and writes their ids back
> into the manifest.

### 1. Backend

```sh
thebes-deploy identity new me      # one-time local signing identity
thebes-deploy deploy store         # build + install + verify → prints the backend cid
```

### 2. Frontend

The frontend installs an asset canister, then uploads your built bundle. Fetch the
asset-canister wasm once (it is referenced by `thebes.toml` as `asset_canister.wasm`):

```sh
curl -L -o asset_canister.wasm \
  https://github.com/Mercatura-Forum/Thebes-Protocol-/releases/download/asset-canister-v0.1.0/asset_canister.wasm
```

Build the bundle and point it at your backend cid (the frontend reads
`window.STORE_CID` at runtime), then deploy:

```sh
cd frontend && npm run build && cd ..
# inject the backend cid from step 1 into the built page:
sed -i 's#<head>#<head><script>window.STORE_CID=YOUR_STORE_CID;</script>#' frontend/dist/index.html
thebes-deploy deploy web           # install asset canister + upload bundle + verify
```

The deploy prints the live URL:
`https://memphis.mercaturaforum.com/_/raw/<web-cid>/index.html`.

> Product photos are served by a separate media canister via `window.MEDIA_CID`.
> It is optional — without one, products render without images.

For a machine-readable deploy contract, see [AGENTS.md](AGENTS.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
