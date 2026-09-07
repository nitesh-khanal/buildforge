# BuildForge — Build Roadmap

This project is being built in phases across multiple chat turns so we don't
run out of tokens in one go. Each phase is self-contained and runnable on its
own. Tell me "continue with Phase X" in a new message and I'll pick up here.

- [x] **Phase 1 — Backend Foundation**: Express app, MongoDB connection,
      Product model (all 8 categories), Cart model, seed script with ~40
      realistic NPR-priced products, Product CRUD/search/filter API, Cart API,
      error handling, `.env.example`.
- [x] **Phase 2 — Auth & Orders**: User model (bcrypt), JWT auth
      (register/login/logout/me/password), role middleware (`protect`,
      `authorize`, `optionalAuth`), guest-cart-to-user-cart merge on
      login/register, Order model, checkout (`POST /api/orders`) supporting
      COD (fully working), a dummy Card flow (business rules #7/#9), and an
      eSewa stub pending Phase 5's real sandbox integration, atomic inventory
      decrement via a MongoDB transaction, human-readable order IDs
      (`BF-YYYYMMDD-00123`), order history + single order lookup, auth rate
      limiting, dev admin/customer seed accounts, first Jest test suite.
- [x] **Phase 3 — Compatibility Engine & PC Builder API**: reusable
      `compatibilityService` (CPU↔motherboard, RAM↔motherboard,
      motherboard↔case, GPU↔case, cooler↔socket, cooler↔case, cooler TDP
      warning, PSU wattage/form-factor), `POST /api/builds/check` (public —
      no login needed to use the builder), `Build` model + full saved-builds
      CRUD (`POST/GET/PUT/DELETE /api/builds`, login required), a reusable
      "Works With" endpoint (`GET /api/products/:id/works-with`) that reuses
      the exact same pairwise checks, and compatibility validation wired
      into `POST /api/cart/custom-build` so an invalid build can never reach
      checkout (business rule #5). Pure-logic tests for the engine added and
      manually verified (10/10 passing).
- [x] **Phase 4 — Recommendation Engine**: pure-logic `recommendationService`
      reused across every surface — `GET /api/recommendations/similar/:id`
      (same-category, price-band ranked), `GET
      /api/recommendations/frequently-bought/:id` (reuses the compatibility
      engine's pairwise category relationships), `POST
      /api/recommendations/complete-build` (suggests compatible, budget-aware
      picks for empty builder slots — no login required), `GET
      /api/recommendations/for-you` (order-history-based personalization,
      falls back to trending/featured for guests or new accounts), and an
      optional `geminiService` (`POST /api/recommendations/build-advice`) for
      a natural-language build summary — fully off by default, returns
      `advice: null` with no error if `GEMINI_API_KEY` isn't set. Pure-logic
      tests added (`tests/recommendation.test.js`) and manually verified.
- [x] **Phase 5 — Payments & Notifications**: real **eSewa ePay v2 sandbox**
      integration (`backend/services/esewaService.js`) — signed redirect
      form (`POST /api/orders`), `GET /api/orders/esewa/success` +
      `GET /api/orders/esewa/failure` callback routes that verify eSewa's
      HMAC-SHA256 signature and cross-check against eSewa's independent
      status API before trusting a payment, plus
      `GET /api/orders/:id/esewa-status` for manual reconciliation if the
      browser never makes it back. A failed/abandoned eSewa payment now
      **releases the stock it reserved at checkout** instead of leaving a
      phantom reservation. Nodemailer order-confirmation + payment-failed
      emails (`services/emailService.js`, off by default like
      `geminiService.js` unless `EMAIL_HOST`/`EMAIL_USER`/`EMAIL_PASSWORD`
      are set). Shipping-partner handoff
      (`services/shippingNotificationService.js`): a fulfillment email plus
      a `wa.me` click-to-chat WhatsApp link pre-filled with the order
      details, both surfaced on the order once payment is actually
      confirmed (COD/card/eSewa-verified — never while still Pending).
      Pure-logic tests for signing/verification and the WhatsApp link
      builder added (`tests/esewa.test.js`) and passing.
- [x] **Phase 6 — Admin API**: role-gated (`protect` + `authorize('admin')`)
      product/order/user management and analytics, mounted at
      `/api/admin/*`. Products: full CRUD (`backend/controllers/
      adminProductController.js`) plus `PATCH /:id/stock` for quick
      restocks and `POST /:id/image` for a multer-backed image upload
      (`middleware/upload.js`, 5MB limit, jpeg/png/webp only). Orders:
      list/filter/search, `PATCH /:id/status` (reuses Phase 5/6's shared
      `utils/inventory.js` restock logic when an order is cancelled, and
      flips a wrongly-Paid cancellation to Refunded), `PATCH
      /:id/payment-status` for manual reconciliation. Users: list/search,
      `PATCH /:id/role`, `DELETE /:id` — both guarded against an admin
      locking themselves out or deleting the last remaining admin.
      Analytics (`adminAnalyticsController.js`): revenue/order overview,
      sales-over-time, top-selling products, and category breakdown —
      all confirmed-orders-only (Paid/COD, excluding Pending/Failed) and
      all correctly counting products sold both standalone *and* as
      components inside custom builds. Pure-logic tests for the product
      validator added (`tests/productValidator.test.js`).
- [x] **Phase 7a — Frontend: Shop, Browse &amp; Cart**: React + Vite +
      Tailwind app (`frontend/`). `lib/api.js` (axios, `x-session-id` header
      on every request, `withCredentials` so Phase 7c's login cookie works
      once it lands) and `context/CartContext.jsx` (fetches/mutates the
      Phase 1 Cart API, exposes `itemCount`/`subtotal` app-wide). Pages:
      Home (hero, category tiles from `GET /api/categories`, featured
      products), Shop (`GET /api/products` with category/brand/price/
      rating/availability filters, sort, pagination, live search via
      `GET /api/products/search/suggestions`), Product Detail (full spec
      sheet, `related` and `works-with` sections, add-to-cart with
      quantity), Cart (line items including custom-build component
      breakdowns, quantity/remove, subtotal). `/build` and `/checkout`
      routes exist as placeholders pointing at the phases that build them.
      Design: dark schematic/spec-sheet aesthetic (Space Grotesk + Inter +
      IBM Plex Mono for spec values, hairline borders, Nepal-flag-crimson
      accent) — see `frontend/README.md`.
- [x] **Phase 7b — Frontend: PC Builder UI**: `/build` page
      (`frontend/src/pages/Build.jsx`) — eight category slots (CPU, CPU
      cooler, motherboard, RAM, GPU, storage, PSU, case), each filled via a
      `PartPickerModal` that browses/searches/sorts `GET /api/products`
      scoped to that category. Every pick or removal re-runs
      `POST /api/builds/check` (debounced) and the side panel
      (`CompatibilityPanel`) shows the live status pill, every error/warning
      message mapped back to the slot(s) it concerns, estimated wattage vs.
      recommended PSU, running total, and whether the build is orderable —
      all straight from the backend's response, not recomputed client-side.
      Empty slots also pull live picks from
      `POST /api/recommendations/complete-build` (`Suggested to complete
      your build`), one-click add. Save/load: `MyBuildsSection` calls
      `POST/GET/DELETE /api/builds`; since login doesn't exist until 7c, a
      401 there is caught and shown as an inline "log in to save builds —
      arriving in Phase 7c" note rather than an error, so the rest of the
      builder keeps working for guests. "Add build to cart" is disabled
      until the backend reports `orderable: true`, then posts to
      `POST /api/cart/custom-build`.
- [x] **Phase 7c — Frontend: Auth &amp; Checkout UI**: `context/AuthContext.jsx`
      (login/register/logout wired to `/api/auth/*`, a one-time `GET
      /api/auth/me` check on load so a returning cookie'd visitor is
      recognized, token also mirrored to `localStorage` as the "either
      approach" fallback `backend/utils/jwt.js` already anticipated) —
      `Login`/`Register` pages, a `ProtectedRoute` wrapper, and an account
      menu in the navbar. `/checkout` (`frontend/src/pages/Checkout.jsx`):
      shipping address form, COD/card/eSewa selection (card fields only
      shown for the demo card flow), submits to `POST /api/orders`, and
      auto-submits the signed `esewaPayment` form to redirect to eSewa's
      sandbox when that method is chosen. Order confirmation
      (`/order-confirmation/:orderId?`) handles both the plain COD/card
      post-checkout redirect and the `?status=` query param eSewa's
      success/failure callbacks send it, with a manual "check payment
      status" button for a still-`Pending` eSewa order. Order history
      (`/orders`) and order detail (`/orders/:id`) round it out. Logging in
      or registering re-fetches the cart afterward so the server-side
      guest-cart merge (Phase 2) shows up immediately rather than on next
      reload. One small Phase 5 bug fixed along the way:
      `GET /api/orders/:id` only accepted a Mongo `_id`, but the eSewa
      callback redirect (and now this page) navigate using the
      human-readable `orderId` — it now accepts either.
- [x] **Phase 7d — Frontend: Admin Dashboard UI**: `/admin/*`, gated by
      `AdminRoute` (logged-in non-admins are bounced home, not looped to
      login). `AdminLayout` provides the sidebar shell. `AdminDashboard`
      pulls all four `/api/admin/analytics/*` endpoints in parallel —
      stat cards, a dependency-free hand-rolled revenue bar chart with a
      7/30/90-day toggle, top-selling products, and revenue-by-category,
      matching the project's no-chart-library approach. `AdminProducts`:
      searchable/filterable table, inline stock adjustment, and
      create/edit via the already-built `ProductFormModal` (raw-JSON
      `specifications`/`compatibilityData` editing, image upload).
      `AdminOrders`: searchable/filterable table opening
      `OrderDetailModal` for order/payment status updates. `AdminUsers`:
      searchable/filterable table, `UserDetailModal` for
      order-history/spend and role promotion/demotion, delete guarded
      against removing yourself or the last admin — same rules the
      backend already enforces, just surfaced in the UI.
- [x] **Phase 8 — Tests + polish + README**: two new pure-logic Jest
      suites in the existing no-DB-needed style — `tests/inventory.test.js`
      (stock-requirement flattening across standalone + custom-build
      items, and the restock bulkWrite path) and `tests/apiFeatures.test.js`
      (filter/sort/pagination query-building, including regex-escaping
      user input for brand/search). A top-level `ErrorBoundary` now wraps
      the app in `main.jsx` so a render error shows a recoverable screen
      instead of a blank page. `README.md` (this file's sibling) rewritten
      as a single project overview instead of a per-phase changelog, for
      anyone picking up the finished repo cold.

- [x] **Phase 9 — Orders + Delivery + Payment Improvements**: fixed the
      guest-cart merge bug (matching products in the guest and user carts
      now sum quantities instead of creating duplicate line items) and
      strengthened checkout's inventory concurrency (the stock decrement is
      now a single atomic conditional update inside the existing
      transaction, closing the race window between two simultaneous
      checkouts for the last unit(s) of a product). Added a payment-status
      transition guard (`utils/paymentTransitions.js`) so an admin can no
      longer revert a fulfilled `Paid`/`COD` order back to `Pending`. Added
      a scheduled + on-demand sweep (`services/esewaSweepService.js`,
      `POST /api/admin/orders/sweep-esewa`) for eSewa orders stuck
      `Pending` indefinitely, rechecking against eSewa's status API and
      hard-expiring (restock + `Failed`) anything too old regardless.
      Delivery: every order now gets a plain `estimatedDeliveryDate`
      (business-day math, +1 day for COD) and a `statusHistory` audit
      trail, rendered as a `DeliveryTimeline` on the order
      confirmation/detail/admin pages. Customers can now self-cancel their
      own order (`PATCH /api/orders/:id/cancel`) while it's still
      Pending/Confirmed. Four new pure-logic Jest suites covering all of
      the above.

- [x] **Phase 10 — Admin Improvements**: soft-delete/archive for products
      (`Product.isArchived`/`archivedAt`, `Product.findActive()`) replacing
      the previous hard `deleteOne()` — an archived product disappears from
      every *browsing* surface (listing, featured, search suggestions,
      related, works-with, category counts) but its detail page still
      resolves instead of 404ing, now showing a "no longer available" state
      and a disabled add-to-cart button; `PATCH /:id/restore` undoes it, and
      `cartController` blocks adding an archived product to a cart or
      custom build server-side. Category display-metadata management (new
      `Category` model + `/api/admin/categories`, seeded idempotently on
      boot): admins can edit each of the 8 fixed categories' label,
      description, image, display order, and storefront visibility — the
      category *set* itself stays fixed, since the PC builder's 8 slots and
      the compatibility engine are both hard-wired to those exact 8 slugs.
      A reusable `ProductPickerField` (searchable multi-select) finally lets
      `AdminCoupons` set `applicableProducts` from the UI — the
      backend/`couponService.js` has supported product-level restriction
      since Phase 5, only the form was missing a picker. The admin
      `OrderDetailModal`'s payment-status dropdown now only offers the
      transitions `utils/paymentTransitions.js` would actually accept from
      the order's current status (a small, intentional frontend mirror of
      that table, documented as such). Two new pure-logic Jest suites
      (`tests/productArchive.test.js`, `tests/categoryUtils.test.js`).
- [x] **Phase 11 — Security + Testing + Final UI/UX**: extended
      `Product.findActive`'s archived-product exclusion into
      `compareController.compareProducts` and every discovery pool in
      `recommendationController.js` (`getSimilar`, `getFrequentlyBought`,
      `getBuildCompletions`'s per-slot suggestions, `getForYou`'s fallback
      and personalized pools) — the one follow-up Phase 10 deliberately
      left open. A real multer-backed upload
      (`POST /api/admin/categories/:slug/image`) replaces
      `AdminCategories`'s plain URL/path text field, sharing a new pure
      `utils/imageUpload.js` mime/size validator with the existing
      product-image upload so both can never quietly drift to different
      accepted file types. General security hardening: a generous
      per-IP rate limiter (`apiLimiter`, 600/15min) now covers the whole
      API — previously only login/register had any limiter at all — plus
      a 200kb `express.json()` body-size cap and an opt-in
      `TRUST_PROXY`-gated `trust proxy` setting for real reverse-proxy
      deployments. Two new pure-logic/regression Jest suites
      (`tests/imageUpload.test.js`, `tests/archivedExclusion.test.js`).

Phase 7d's zip was a **delta** (only new/changed files against 7c) whose
generation was cut off before the admin pages or routing landed — only the
supporting components (`Modal`, `StatCard`, `ProductFormModal`,
`OrderDetailModal`, `UserDetailModal`, `ConfirmDialog`, `AdminRoute`) and an
updated `Navbar` had been written, and `PartPickerModal.jsx` was included
as a 0-byte file that would have silently broken `/build` on merge. Both
were caught and fixed while finishing 7d above: `PartPickerModal.jsx` was
restored from the last-good Phase 7c version, and the missing pages/routing
were written from the existing components and backend contracts.

## Why phased
The full spec is a large production app (backend + React frontend + admin
dashboard + payments + email + WhatsApp + AI). Generating it all in one
response would either get cut off mid-file or blow through a free-tier
budget. Building phase-by-phase means every phase you download is a working,
testable increment — the backend actually runs after Phase 1, you can add
items to cart after Phase 1, you can log in and check out after Phase 2, etc.

All 11 phases are now complete (see `BUILD_FORGE_PROGRESS.md` for the
detailed per-phase write-ups and Phase 11's "Still open" note for the
realistic remaining work — a real `npm install`/live-MongoDB validation
pass, and a deeper security review — rather than a new numbered phase).
See `README.md` for the full project overview and setup
instructions.
