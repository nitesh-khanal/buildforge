# BuildForge — Phase 0 Audit Report

Audit date: 2026-09-04
Scope: full inspection of the uploaded project. **No functional code was
changed in this phase** — this is read-only reconnaissance to plan Phases
1–11 safely.

---

## 1. What this project already is

BuildForge is **not a skeleton** — it's a complete, working 8-phase build
(its own `ROADMAP.md` documents Phases 1–8 as already shipped, and the
`README.md` describes a finished product). This audit treats that existing
code as authoritative, per the project's safety rules, and plans new phases
as additive work on top of it — not a rewrite.

**Stack**: Express 4 / Mongoose 8 / MongoDB backend, React 18 + Vite 5 +
Tailwind 3 frontend, JWT auth (httpOnly cookie or bearer), eSewa ePay v2
sandbox, Nodemailer, an optional Gemini text layer. No TypeScript, no
component library beyond Tailwind utility classes, no Redux (Context API
for auth/cart state).

## 2. Backend architecture

```
backend/
├── app.js              Express app wiring (helmet, cors, mongo-sanitize, routes)
├── server.js            entrypoint (connects DB, starts app)
├── config/db.js         Mongoose connection
├── models/               User, Product, Cart, Order, Build, Counter
├── controllers/          auth, product, cart, order, build, recommendation,
│                         admin{Product,Order,User,Analytics}
├── routes/                one router per controller, mounted in app.js
├── services/              compatibilityService, recommendationService,
│                         esewaService, emailService, shippingNotificationService,
│                         orderNotificationService, geminiService
├── middleware/            auth (protect/optionalAuth/authorize), errorHandler,
│                         rateLimiters (auth only), upload (multer, image-only)
├── utils/                 asyncHandler, apiFeatures (filter/sort/paginate),
│                         inventory (stock flatten/restock), jwt, generateOrderId
├── validators/            productValidator
├── seed/                  seedProducts.js + ~40 realistic products
└── tests/                 7 Jest suites (see §7)
```

**Route mounting** (`app.js`): `/api/auth`, `/api/products`,
`/api/categories`, `/api/cart`, `/api/orders`, `/api/builds`,
`/api/recommendations`, plus `/api/admin/{products,orders,users,analytics}`.
All admin routers apply `protect` + `authorize('admin')` internally.

## 3. Frontend architecture

```
frontend/src/
├── App.jsx              route table (React Router v6)
├── context/              AuthContext, CartContext
├── components/           Navbar, Footer, ProductCard, FilterSidebar,
│                         SearchBar, Pagination, StockBadge, QuantityStepper,
│                         ProtectedRoute, AdminRoute, ErrorBoundary,
│                         build/ (BuildSlotRow, CompatibilityPanel, PartPickerModal,
│                                 MyBuildsSection),
│                         order/ (OrderStatusBadge, OrderSummaryCard),
│                         admin/ (Modal, ConfirmDialog, StatCard,
│                                 ProductFormModal, OrderDetailModal, UserDetailModal)
└── pages/                Home, Shop, ProductDetail, Cart, Build, Login,
                          Register, Checkout, OrderConfirmation, OrderHistory,
                          OrderDetail, NotFound, ComingSoon,
                          admin/ (AdminLayout, AdminDashboard, AdminProducts,
                                  AdminOrders, AdminUsers)
```

Current routes: `/`, `/shop`, `/products/:id`, `/cart`, `/build`, `/login`,
`/register`, `/checkout` (protected), `/order-confirmation[/:orderId]`,
`/orders` (protected), `/orders/:id` (protected), `/admin/*` (admin-gated,
nested: dashboard/products/orders/users). No account/profile route exists
yet — confirmed gap (see §8).

## 4. Database models (current)

| Model | Key fields | Notes |
|---|---|---|
| **User** | name, email (unique), password (hashed, `select:false`), phone, role (`customer`/`admin`), single embedded `address` | No saved-addresses array yet — one address only |
| **Product** | name, brand, category (enum, 8 fixed values), price, stock, rating, `specifications` (Mixed), `compatibilityData` (Mixed), `isFeatured` | Categories are a hardcoded enum, not a collection — confirmed gap |
| **Cart** | user OR sessionId, items[] (snapshot name/image/price + optional `buildComponents[]` for custom builds) | Guest carts merge into user cart on login/register (`authController.mergeGuestCart`) |
| **Order** | orderId (human-readable, unique), user, items[], shippingAddress (embedded snapshot), paymentMethod, paymentStatus, orderStatus, subtotal/shippingCost/discount/total, `esewaDetails`, `notifications` (idempotency flags) | Status transitions already guarded (`Delivered`/`Cancelled` are terminal) in `adminOrderController.updateOrderStatus` |
| **Build** | user, name, components (8 fixed slots, each nullable `Product` ref), totalPrice, compatibilityStatus | One document per saved build; no sharing/visibility field yet |
| **Counter** | `_id` (e.g. `orders-YYYYMMDD`), seq | Backs `generateOrderId()` for atomic daily sequence numbers |

No models yet exist for: Wishlist, Review, ProductComparison (comparison is
stateless/client-side by nature so may not need one), Address (plural),
Notification, Coupon, CommunityBuild, BuildLike, Comment, BuildRating,
Report/Moderation queue.

## 5. Authentication & authorization

- JWT signed in `utils/jwt.js`, sent as **both** an httpOnly cookie and in
  the JSON body (frontend can use either).
- `middleware/auth.js`: `protect` (required), `optionalAuth` (attaches user
  if present, doesn't fail otherwise — used for guest-aware routes),
  `authorize(...roles)`.
- Passwords hashed with bcrypt (`genSalt(10)`) in a `pre('save')` hook.
- Admin self-protection already implemented: an admin cannot demote or
  delete their own account, and the last remaining admin cannot be deleted
  (`adminUserController.js`).
- Rate limiting currently covers only `/api/auth` (login/register), via
  `rateLimiters.js`.

## 6. PC Builder & compatibility engine

Lives entirely in `services/compatibilityService.js` — a **pure, DB-free
function** (`checkBuildCompatibility(components)`) reused identically by:
the `/build` page (`POST /api/builds/check`, no auth required per spec),
the product-detail "works with" section (`recommendationController`), and
cart custom-build validation (`cartController.addCustomBuild`, which
re-runs the same check server-side before allowing checkout — the frontend
result is never trusted).

Checks confirmed present: CPU↔motherboard socket, RAM↔motherboard
type/capacity, motherboard↔case form factor, GPU↔case clearance,
cooler↔socket, cooler↔case clearance, cooler TDP-vs-CPU-TDP warning, PSU
wattage vs. estimated system draw, PSU form factor, and a stock/orderability
gate (`isBuildOrderable`). An incomplete build (missing slots) is never
treated as an error, matching the stated spec.

**This engine is the most reused piece of business logic in the codebase
and must not be duplicated anywhere in later phases** — any new feature
(comparison, community copy-build flow) that needs compatibility data
should call into this module.

## 7. Existing tests

`backend/tests/` (Jest, 7 suites): `auth.test.js`, `compatibility.test.js`,
`recommendation.test.js`, `apiFeatures.test.js`, `inventory.test.js`,
`esewa.test.js`, `productValidator.test.js`. Pattern: pure-logic/unit tests
that don't require a live DB where possible; `auth.test.js` presumably uses
`supertest` + a real Mongo test DB per the README's test instructions. No
frontend tests exist.

**Verification performed this phase**: every `.js` file in `backend/`
(controllers, models, routes, services, middleware, utils, tests, seed) was
checked with `node --check` — **zero syntax errors**. `npm install` could
not be run (this sandbox has no network egress), so a live server boot /
`npm test` run was not possible here; the person running Phase 0 locally
should run `npm install && npm test` to confirm the baseline still passes
before Phase 1 begins. No zero-byte or truncated files were found anywhere
in the archive (the `ROADMAP.md` notes a past incident with a 0-byte
`PartPickerModal.jsx` from a delta-zip mishap — confirmed already fixed,
file is intact).

## 8. Confirmed gaps (verified against source, not assumed)

| Gap | Verified how |
|---|---|
| No profile/account page | `App.jsx` has no `/account` or `/profile` route; only `/login`, `/register` |
| No wishlist | No `Wishlist` model, route, or frontend page/component anywhere |
| No review system | No `Review` model; `Product.rating` is a plain number field with no computation path feeding it (no route sets it) |
| No coupon system | `Order` schema has a flat `discount: Number` field but no `Coupon` model, no code ever sets `discount` to anything but `0` (`orderController.js`: `const discount = 0;`) |
| No real courier integration | `shippingNotificationService.js` explicitly documents it only builds a `wa.me` click-to-chat link — no courier API, by design, not a bug |
| No product comparison | No comparison route/page/component |
| No build sharing/community | No `CommunityBuild`/`BuildLike`/`Comment`/`BuildRating` models, no `/community` routes |
| No saved address management | `User.address` is a single embedded subdocument, not an array; no add/edit/delete/default endpoints |
| eSewa failure/callback reliability | Already fairly robust: HMAC signature check, independent status cross-check via `checkTransactionStatus`, duplicate-callback protection (`order.paymentStatus !== 'Paid'` guards), manual reconciliation endpoint. Real remaining risk: no expiration sweep for orders stuck `Pending` forever if the customer never returns and no callback ever arrives — worth a scheduled job in a later phase |
| Guest cart merging edge cases | Merge logic (`authController.mergeGuestCart`) simply concatenates guest items into the user cart array — it does **not** dedupe/merge quantities if the same product exists in both carts (creates two line items instead of summing). Confirmed by reading the function; worth fixing but out of scope for Phase 0 |
| Inventory race conditions | Stock decrement happens inside a Mongo transaction (`session.withTransaction`) at order creation, which is good, but uses `$inc` without a stock-floor guard *inside* the transaction — two simultaneous checkouts each passing the pre-transaction stock check could theoretically both decrement past zero before either commits, since the check and the decrement aren't in a single atomic conditional update. Flagged for Phase 9 |
| Admin payment status transition validation | `updatePaymentStatus` accepts any value in the enum with no transition guard (unlike `updateOrderStatus`, which blocks `Delivered`/`Cancelled` reversals) — an admin could set `Paid` back to `Pending` on a fulfilled order. Flagged for Phase 9/11 |
| Hard deletion of products | Confirmed: `adminProductController.deleteProduct` calls `product.deleteOne()` — a real delete, not a soft archive. Historical orders store a full item **snapshot** (name/image/price at time of purchase) so old orders stay readable even after a hard delete, but the product page itself would 404 and any live "works with"/comparison links would break |
| Fixed/hardcoded categories | Confirmed: `Product.CATEGORIES` is a hardcoded array of 8 strings used as a Mongoose enum; `getCategories` derives counts from it rather than a `Category` collection |
| Notification improvements | Only email + WhatsApp-link exist, both fire-and-forget/best-effort with no in-app notification center or read/unread state |
| Testing improvements | Backend has decent unit coverage of pure logic; no frontend tests, no integration tests for cart/checkout/admin flows |
| UX/accessibility improvements | Not deeply audited yet (would require running the frontend); deferred to Phase 11 per the plan |

## 9. What Phase 0 deliberately did NOT touch

Per the project's safety rules, no models, controllers, routes, or frontend
files were modified. No dependencies were added. The only new files are
this audit report and `BUILD_FORGE_PROGRESS.md`.

## 10. Recommendation for Phase 1

Phase 1 should:
- Add new models only (`Wishlist`, `Review`, `Address` — or extend `User`
  with an `addresses[]` array — `Notification`, `Coupon`; scaffold
  `CommunityBuild`/`BuildLike`/`Comment`/`BuildRating` schemas even though
  Phase 6 wires up their APIs) without touching existing models except
  where minimally necessary (e.g. adding an addresses array to `User`
  alongside, not instead of, the existing single `address` field, to avoid
  a breaking migration).
- Add indexes/unique constraints (`Wishlist`: unique `user`+`product`;
  `Review`: unique `user`+`product`; `BuildLike`/`BuildRating`: unique
  `user`+`communityBuild`, as the master prompt specifies).
- Not wire up any routes/frontend yet — that starts in Phase 2.
