# thebes-example-store

An on-chain storefront built on [Thebes Protocol](https://github.com/Mercatura-Forum/Thebes-Protocol-):
a Motoko backend that holds the product catalog, carts, and orders, and a React
frontend served as certified assets. It demonstrates the full shape of a Thebes
application — passkey sign-in, controller-gated admin, paginated reads, and
threshold-signed on-chain state — in one self-contained example.

## Architecture

```
frontend (React + Vite + Tailwind)   →   store backend (Motoko)
   @thebes/sdk  ── boundary client       mo:thebes-lib ── Admin / Users / Pagination
   Memphis passkey gate                  catalog · carts · orders
```

- **frontend/** depends on [`@thebes/sdk`](https://github.com/Mercatura-Forum/thebes-sdk)
  for the boundary client, typed query/update calls, React hooks, and the Memphis
  passkey gate.
- **motoko/** depends on [`thebes-lib`](https://github.com/Mercatura-Forum/thebes-lib)
  for `Admin` (controller-gated operations); the storefront logic lives in `main.mo`.

Neither toolkit is copied into this repo — both resolve as pinned git/mops
dependencies, so there is exactly one source of truth for each.

## Backend interface (selected)

| Method | Kind | Purpose |
| --- | --- | --- |
| `getProducts` / `getProductsView` | query | Browse the catalog. |
| `seedDemo` | update | Populate demo products (admin). |
| `addProduct` / `restockProduct` / `setProductPhoto` | update | Catalog management (admin). |
| `addToCart` / `getCartView` | update / query | Build and read the caller's cart. |
| `checkoutOrTrap` | update | Place an order; traps on any guard failure so the client never silently ignores an error. |
| `updateOrderStatus` | update | Advance an order (admin). |
| `claimOwner` / `addAdmin` / `setPaused` | update | Ownership and admin surface (from `thebes-lib`'s `Admin`). |

The token uses 8 decimals (e8s); prices are stored and returned in base units.

## Run locally

```sh
# Frontend
cd frontend
npm install            # pulls @thebes/sdk (git dependency)
npm run dev            # sync-sdk copies the browser runtimes into public/, then Vite serves

# Backend (compile-check)
cd ../motoko
mops install           # pulls thebes-lib (mops github dependency)
moc --check $(mops sources) main.mo
```

## Deploy to the cluster

The backend and the built frontend assets deploy with
[`thebes-deploy`](https://github.com/Mercatura-Forum/Thebes-Protocol-). Build the
frontend first (`npm run build`), then deploy the backend wasm and the `dist/`
assets, injecting the assigned canister ids via the `window.STORE_CID` /
`window.MEDIA_CID` globals the frontend reads at runtime.

## License

Apache-2.0. See [LICENSE](LICENSE).
