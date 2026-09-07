# BuildForge — Frontend

React + Vite + Tailwind frontend for the BuildForge backend. Covers
browsing, searching/filtering, product detail pages, a fully working cart,
the PC Builder, login/register, the full checkout flow (COD / card /
eSewa) through order confirmation and order history, and an admin
dashboard for managing products, orders, and customers.

## Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

`.env` just needs `VITE_API_URL` pointing at your running backend (defaults
to `http://localhost:5000/api` if unset — matches the backend's default
`PORT=5000`). Make sure the backend's `.env` has
`CLIENT_URL=http://localhost:5173` (already the default in
`backend/.env.example`) so CORS allows this dev server.

The backend needs to be running and seeded first:
```bash
cd ../backend
npm install && npm run seed && npm run dev
```

Then open `http://localhost:5173`.

## What's included
- **Home** (`/`) — hero, category tiles (`GET /api/categories`), featured
  products (`GET /api/products/featured`).
- **Shop** (`/shop`) — filters (category, brand, price range, minimum
  rating, in-stock only), sort, pagination, and live search suggestions.
  Filters are stored in the URL's query string so a filtered/sorted view is
  shareable and survives a reload.
- **Product detail** (`/products/:id`) — full spec sheet (rendered from
  `specifications`, with a per-category field map in `src/utils/specs.js`),
  the `related` and `works-with` endpoints, add-to-cart with a quantity
  stepper.
- **Cart** (`/cart`) — line items, including a component breakdown for
  custom-build cart lines (`isCustomBuild` / `buildComponents`), quantity
  editing, removal, and a running subtotal. The subtotal is the same
  `cart.subtotal` virtual the backend computes, not recalculated client-side.
- Guest carts work with no login: a random ID is generated once
  (`src/lib/session.js`) and sent as `x-session-id` on every `/api/cart`
  request, same contract the backend README describes. `api.js` already
  sends `withCredentials: true` so Phase 7c's cookie-based login will merge
  the guest cart in automatically — no changes needed here.
- **PC Builder** (`/build`) — eight category slots filled from a searchable
  part picker (`PartPickerModal`); every change re-runs
  `POST /api/builds/check` and the side panel shows the live compatibility
  status, per-slot error/warning messages, estimated wattage vs.
  recommended PSU, running total, and add-to-cart gated on the backend's
  `orderable` flag. Empty slots surface live picks from
  `POST /api/recommendations/complete-build`. Saving/loading builds
  (`/api/builds`) requires login — since that lands in Phase 7c, a guest
  who tries to save sees an inline "log in to save builds" note instead of
  an error, and the rest of the builder keeps working. Finished builds are
  added to the cart via `POST /api/cart/custom-build`.
- **Auth** (`/login`, `/register`) — forms wired to `context/AuthContext.jsx`,
  which checks `GET /api/auth/me` on load so a returning logged-in visitor
  (recognized via the backend's httpOnly cookie) doesn't have to log in
  again. The JWT is also mirrored to `localStorage` and sent as an
  `Authorization` header — belt and suspenders alongside the cookie.
  Logging in/registering merges the guest cart server-side (existing
  Phase 2 behavior) and the frontend re-fetches the cart right after so
  that shows up immediately rather than on next reload.
- **Checkout** (`/checkout`, login required — see `ProtectedRoute`) —
  shipping address form, COD / card (demo) / eSewa payment selection.
  Posts to `POST /api/orders`; for eSewa, auto-submits the signed
  `esewaPayment` fields as a real form POST to redirect the browser to
  eSewa's hosted sandbox page.
- **Order confirmation** (`/order-confirmation/:orderId?`) — lands here
  either right after a COD/card checkout or via eSewa's success/failure
  redirect (reads the `?status=` query param those set). A still-`Pending`
  eSewa order gets a "check payment status" button
  (`GET /api/orders/:id/esewa-status`).
- **Order history** (`/orders`) and **order detail** (`/orders/:id`, both
  login required) — list and drill into past orders, sharing an
  `OrderSummaryCard` component with the confirmation page.

- **Admin dashboard** (`/admin/*`, requires an `admin`-role account — see
  `AdminRoute`) — a logged-in customer who navigates here is bounced home
  rather than looped to `/login`, since they're authenticated fine, just
  not authorized.
  - **Dashboard** (`/admin`) — revenue/order/customer/stock stat cards, a
    revenue-over-time bar chart (7/30/90-day toggle), top-selling products,
    and revenue-by-category, all from `/api/admin/analytics/*`.
  - **Products** (`/admin/products`) — searchable/filterable table with
    inline stock adjustment, and a create/edit modal
    (`ProductFormModal`) covering every field including the
    category-specific `specifications`/`compatibilityData` JSON blobs and
    image upload.
  - **Orders** (`/admin/orders`) — searchable/filterable table; clicking a
    row opens `OrderDetailModal` to update order/payment status (with the
    same terminal-state and stock-release rules the backend enforces).
  - **Customers** (`/admin/users`) — searchable/filterable table;
    `UserDetailModal` shows order history/spend and lets an admin
    promote/demote a role (guarded against touching your own account).
    Deleting a customer is guarded the same way the backend guards it
    (can't delete yourself or the last remaining admin).
  - Every admin page reads from and writes to the exact `/api/admin/*`
    endpoints — no client-side recomputation of anything the backend
    already decided (stock status, order totals, revenue).

## Error handling
`components/ErrorBoundary.jsx` wraps the whole app (in `main.jsx`, outside
the router) so an unhandled render error shows a recoverable "something
went wrong" screen instead of a blank white page.

## Design notes
Dark, schematic/spec-sheet visual language grounded in the product itself
(a compatibility-checked PC parts catalog) rather than a generic SaaS
look: hairline borders, near-black surfaces, monospace (`IBM Plex Mono`)
for spec *values* only, `Space Grotesk` for headings, and a single
accent — crimson, echoing the Nepali flag — reserved for prices, primary
actions, and stock status. Tokens live in `tailwind.config.js`. The admin
section reuses the same tokens and components (tables, badges, buttons)
rather than a separate "admin theme".
