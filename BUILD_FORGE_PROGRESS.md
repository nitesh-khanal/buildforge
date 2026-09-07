# BuildForge — Progress Tracker

**Current completed phase:** Phase 11 — Security + Testing + Final UI/UX
**Next phase to implement:** none — Phase 11 was the last phase on the roadmap. See that phase's "Still open" note for realistic next steps (a live-DB/`npm install` validation pass, and a deeper security review) rather than a new numbered phase.

---

## Completed features (pre-existing, verified in Phase 0)

This project arrived as a complete 8-phase build (see its own
`ROADMAP.md`), not a skeleton. All of the below was verified present and
syntactically sound during the Phase 0 audit — nothing in this section was
built by this workflow.

- Product catalog: browse/search/filter/sort/paginate, category pages,
  featured products, "works with" / related products
- Guest-friendly cart (session-id header) with merge into user cart on
  login/register
- PC Builder: 8-slot builder, live compatibility checking (socket, RAM
  type/capacity, form factor, GPU/case clearance, cooler/socket,
  cooler/case, cooler TDP warning, PSU wattage/form factor), save/load
  builds, guest building allowed (save requires login)
- Recommendations: similar products, frequently-bought-together,
  build-completion suggestions, personalized for-you, optional Gemini
  natural-language blurb (off unless `GEMINI_API_KEY` set)
- Checkout: COD, simulated card (clearly labeled, last-4 `0000` = decline
  path for testing), eSewa ePay v2 sandbox (signed redirect, HMAC callback
  verification, independent status cross-check, duplicate-callback
  guards, manual reconciliation endpoint)
- Orders: human-readable order IDs (atomic daily counter), order history,
  order detail, guarded status transitions (`Delivered`/`Cancelled` are
  terminal), stock decrement inside a Mongo transaction at checkout,
  centralized restock logic (`utils/inventory.js`) shared by eSewa-failure
  and admin-cancel paths
- Notifications: order-confirmation/payment-failed emails (Nodemailer, off
  unless `EMAIL_*` configured, fail-soft), shipping-partner handoff email +
  `wa.me` click-to-chat link (not a real WhatsApp Business API — by design)
- Admin dashboard: revenue/order/customer analytics (AOV, revenue over
  time, top sellers, category revenue), product CRUD + image upload +
  stock management, order management (status/payment overrides), user
  management (role promotion/demotion, delete — both guarded against
  self-modification and removing the last admin)
- Auth: JWT (httpOnly cookie + bearer, either works), bcrypt passwords,
  `customer`/`admin` roles, rate-limited login/register
- Security baseline: helmet, CORS (credentialed, origin from `CLIENT_URL`),
  `express-mongo-sanitize`, multer file-type/size restrictions on uploads,
  backend-authoritative compatibility/stock/price validation (frontend
  values are never trusted)
- Tests: 7 Jest suites covering auth, compatibility engine, recommendation
  engine, apiFeatures (filter/sort/paginate), inventory
  flatten/restock, eSewa signature/status logic, product validation

## Completed features (Phase 1 — this phase)

Database foundation only — **no routes, no controllers, no frontend
changes**. All 11 new models are defined but currently unused by any
running code path; they'll be wired up starting Phase 2.

- **New models** (`backend/models/`): `Wishlist`, `Review`, `Address`,
  `Notification`, `Coupon`, `CouponUsage`, `CommunityBuild`, `BuildLike`,
  `Comment`, `BuildRating`, `Report`.
- **Existing models extended additively** (old behavior unchanged, verified
  against a schema-construction smoke test — see "Tests performed" below):
  - `Product.js` — added `numReviews` and `ratingDistribution` (a
    Mongoose `Map<String,Number>` keyed `"1"`.."5"`, fresh instance per
    document). Both default to zero/empty and aren't read or written by any
    existing code — purely additive.
  - `Build.js` — now also exports `componentsSchema`, `CATEGORY_KEYS`, and
    `COMPATIBILITY_STATUSES` as static properties on the model (same
    pattern `Product.js` already used for `CATEGORIES`). `CommunityBuild`
    imports `componentsSchema` from here instead of redefining the 8
    builder slots — the "don't duplicate the PC component structure" rule
    from the master prompt. Every existing `require('../models/Build')`
    call site still gets the same model constructor as before.
  - `User.js` — **untouched**. The planned "addresses array on User" was
    replaced with a separate `Address` collection instead (see below) so
    the existing single embedded `address` field and its update flow in
    `authController.updateMe` needed zero changes.

### Design notes on the new models

- **Wishlist**, **BuildLike**, **BuildRating** are all join-row collections
  (`{user, <target>}` with a unique compound index) rather than arrays
  embedded on User/Product/CommunityBuild — adding/removing one entry is a
  single indexed write, not a read-modify-write of a growing array, and
  "is X already liked/wishlisted by this user?" is one indexed lookup.
- **Review** and **Comment** use a soft-delete-style `status:
  'visible'|'hidden'` field (plus `moderatedBy`/`moderatedAt`/
  `moderationReason`) instead of hard deletes, matching this codebase's
  existing preference for preserving history (order/cart item snapshots)
  over destructive deletes. `CommunityBuild` uses the same pattern for
  admin takedowns, kept separate from the user's own `visibility` choice
  (`public`/`unlisted`/`private`).
- **Address** is a separate collection (not a `User.addresses[]` array) so
  each saved address has its own `_id` for simple add/edit/delete/
  set-default operations; a `post('save')` hook unsets `isDefault` on a
  user's other addresses when one is saved as default.
- **Coupon** validates percentage-vs-fixed bounds and date ordering at the
  schema level (`pre('validate')`); actual usage-limit enforcement is
  deferred to **CouponUsage**, a separate append-only ledger (one row per
  order, unique on `order`) — `Coupon.usedCount` is only a denormalized
  display cache, the same relationship `Product.rating` has to `Review`
  documents.
- **CommunityBuild** snapshots `components`/`totalPrice`/
  `compatibilityStatus` at publish time (via `Build.componentsSchema`)
  rather than staying live-linked to the source `Build`, and keeps
  denormalized `likesCount`/`commentsCount`/`viewsCount`/`copiesCount`/
  `averageRating`/`ratingCount` counters for feed sorting — `BuildLike`/
  `Comment`/`BuildRating` remain the source of truth; the Phase 6
  controller will keep the counters in sync.
- **Report** is one generic model for both reportable target types
  (`communityBuild`/`comment`) rather than two near-identical schemas,
  since the admin moderation workflow (list pending → review → resolve) is
  identical either way.
- **No `Category` model** was added — categories stay the hardcoded enum
  for now; category management is explicitly Phase 10 scope, not Phase 1.
- **No comparison model** was added — product comparison (Phase 3) reads
  existing `Product.specifications`/`compatibilityData` directly and holds
  compared-product state client-side; there's no server-side "comparison
  session" to persist.

## Completed features (Phase 2 — this phase)

Wired up the `Wishlist` and `Review` models from Phase 1 to real
routes/controllers, plus the matching frontend UI. No Phase 1 model files
were modified.

- **Wishlist** (`backend/controllers/wishlistController.js`,
  `routes/wishlistRoutes.js`, mounted at `/api/wishlist`, login required —
  no guest wishlist): list (with dangling entries for hard-deleted products
  filtered out), `GET /status?productIds=` for lighting up product-card
  hearts without a full fetch, add (idempotent on duplicate — the existing
  unique index is trusted rather than pre-checked), remove, and
  `POST /:productId/move-to-cart` (same stock/quantity rules as
  `cartController.addItem`, then deletes the wishlist entry on success).
- **Reviews** (`backend/controllers/reviewController.js`,
  `routes/reviewRoutes.js`, mounted onto the existing `/api/products` base
  as a second router rather than editing `productRoutes.js`): public
  paginated/sorted list (`GET /:id/reviews`, `status: 'visible'` only) with
  the product's rating summary attached, `GET /:id/reviews/mine` (the
  caller's own review + eligibility), create/update/delete of the caller's
  one review per product (`POST`/`PUT`/`DELETE /:id/reviews` — no
  `reviewId` in the URL, since the unique index caps it at one). Verified-
  purchase status is derived server-side from `Order` history
  (`paymentStatus` in `Paid`/`COD`, checking both standalone `items.product`
  and `items.buildComponents.product` for custom-build purchases) — never
  trusted from the client.
- **Rating recalculation** (`backend/services/ratingService.js`):
  `computeRatingAggregate` is a pure, DB-free function (covered by
  `tests/ratingService.test.js`) that turns a set of review ratings into
  `{rating, numReviews, ratingDistribution}`; `recalculateProductRating`
  takes `Review`/`Product` as parameters rather than `require()`-ing them
  at the top of the file — same dependency-injection shape as
  `utils/inventory.js`'s `restockOrderItems(Product, items)` — and is
  called after every create/update/delete of a review and every admin
  hide/unhide, always re-reading only `status: 'visible'` reviews.
- **Admin moderation** (`backend/controllers/adminReviewController.js`,
  `routes/adminReviewRoutes.js`, mounted at `/api/admin/reviews`): list/
  filter all reviews by status/product/rating, `PATCH /:id/hide` (sets the
  existing `status`/`moderatedBy`/`moderatedAt`/`moderationReason` fields —
  a soft moderation, not a delete) and `PATCH /:id/unhide`, both
  recalculating the product's rating aggregate afterward.
- **Frontend**: `context/WishlistContext.jsx` (optimistic add/remove,
  mirrors `CartContext`'s shape, clears on logout), a heart toggle on
  `ProductCard`, a wishlist nav link + count in `Navbar`, and a `/wishlist`
  page (protected route) with move-to-cart/remove. A `components/review/`
  folder (`RatingStars`, `ReviewForm`, `ReviewsSection`) adds a rating
  summary + distribution bars + write/edit/delete-your-review flow +
  paginated review list to `ProductDetail`. `pages/admin/AdminReviews.jsx`
  (new `/admin/reviews` route + sidebar entry) gives admins the list/hide/
  unhide moderation view.
- **Tests**: `tests/ratingService.test.js` (aggregate math: empty set,
  averaging/rounding, distribution bucketing, number-vs-object input) and
  `tests/reviewValidator.test.js` (rating bounds, title/comment length,
  partial mode) — both pure-logic, no DB. Manually verified against Node
  directly (see "Tests performed" below — same `npm install`-blocked
  sandbox limitation as Phase 1).

## Completed features (Phase 3 — this phase)

Product Comparison. No new model — per the Phase 1 design note, comparison
state is a handful of product ids the frontend holds client-side; the
backend just reads straight from each product's existing `specifications`.

- **Backend** (`backend/utils/compareUtils.js`,
  `controllers/compareController.js`, `routes/compareRoutes.js`, mounted at
  `GET /api/products/compare?ids=id1,id2,id3,id4`, public — no login
  required, same as `/works-with`): validates 2-4 ids, all found, all the
  same category, then returns `{ category, specKeys, products }` where
  `specKeys` is the union of every non-empty `specifications` key across the
  requested products, in first-seen order — the frontend renders an aligned
  table off of that without needing to guess which fields exist on every
  product. Products come back in the order the ids were requested in (the
  order the user added them), not whatever order MongoDB returns.
  - `compareUtils.js`'s three functions (`parseCompareIds`,
    `validateComparison`, `buildSpecKeyUnion`) are pure/DB-free, split out of
    the controller for the same reason as `ratingService.
    computeRatingAggregate` — directly unit-testable with zero mongoose
    dependency.
  - **Routing note:** `compareRoutes.js` has to be mounted *before*
    `productRoutes.js` in `app.js` (unlike `reviewRoutes.js`, which is safe
    to mount after it). `/compare` is a bare single-segment path, so
    `productRoutes`'s `router.get('/:id', getProductById)` catch-all would
    otherwise swallow it first, treating `"compare"` as a product id.
- **Frontend**: `context/CompareContext.jsx` — client-side-only selection
  (no backend persistence, matching the design note), storing lightweight
  product snapshots (id/name/image/price/brand/category) the same way
  Cart/Order line items already snapshot product data, capped at 4 items,
  single-category enforcement (adding a product from a different category
  than what's already selected is rejected with a message rather than
  silently clearing the list), persisted to `localStorage` (same pattern as
  the guest session id in `lib/session.js`) so an in-progress comparison
  survives a reload. `components/compare/CompareToggleButton.jsx` is an
  icon toggle wired into `ProductCard` next to the existing wishlist heart
  — "similar in spirit," as called out in the Phase 1 note.
  `components/compare/CompareBar.jsx` is a floating bottom bar (rendered
  once at the `App` layout level, like `Navbar`/`Footer`) showing the
  in-progress selection with per-item remove, clear, and a link to
  `/compare?ids=...` once 2+ are selected; it hides itself on the
  comparison page. `pages/Compare.jsx` reads `ids` from the query string,
  calls the backend endpoint, and renders the spec table. `utils/specs.js`
  gained `getComparisonRows()`/`formatSpecValue()`, which reuse the
  existing `CATEGORY_SPEC_FIELDS` table for ordering/labels/units rather
  than duplicating it — known fields first, then any leftover keys the
  table doesn't cover yet, labeled with their raw key so nothing is
  silently hidden (same fallback philosophy as `getSpecEntries`). A
  `Navbar` compare link (count badge, same treatment as the wishlist/cart
  links) appears once at least one item is selected.
  - Deliberately did **not** add a compare (or wishlist) control to the
    main product on `ProductDetail.jsx` — Phase 2 didn't add one there
    either (the wishlist heart only appears via the `ProductCard`s used in
    its "works with"/"related" sections), so this keeps the same scope
    rather than introducing new UI Phase 2 didn't already establish.
- **Tests**: `tests/compareUtils.test.js` (id parsing/dedup, count bounds,
  not-found handling, mixed-category rejection, spec-key union ordering and
  empty-value filtering) — pure-logic, no DB, same convention as
  `ratingService.test.js`/`reviewValidator.test.js`.

## Completed features (Phase 4 — this phase)

User Account + Addresses + Notifications. Wires up the two Phase 1 models
still sitting unused: `Address` and `Notification`. `authController` was
re-checked against `PHASE_00_AUDIT.md` §4 first, per this file's own Phase 4
scope note — it already exposes name/phone/embedded-address editing
(`PATCH /api/auth/me`) and password change, so neither needed new work here.

- **Addresses** (`backend/controllers/addressController.js`,
  `routes/addressRoutes.js`, mounted at `/api/addresses`, login required —
  same no-guest-concept convention as `/api/wishlist`): list (default
  first, then most recent), create, update, `PATCH /:id/default`, delete.
  A user's very first saved address is automatically made their default
  (otherwise nothing would ever be picked at checkout without an extra
  step right after signing up); deleting the current default promotes the
  next most-recent address rather than leaving no default at all. Both of
  those are the controller's own bookkeeping on top of the Phase 1
  `post('save')` hook, which only handles "unset every *other* address when
  one is explicitly saved as default."
- **Notifications** (`backend/controllers/notificationController.js`,
  `routes/notificationRoutes.js`, mounted at `/api/notifications`, login
  required): paginated `GET /` (newest first, unread count attached so the
  list and the badge come from one request on first load),
  `GET /unread-count` for a lightweight navbar poll, `PATCH /:id/read`,
  `PATCH /read-all`. No off-by-default env-var gate here, unlike
  email/WhatsApp/Gemini — an in-app notification has no external service to
  misconfigure.
- **`backend/services/notificationService.js`**: fed by the same order
  lifecycle events that already trigger emails (`orderController.js`'s
  `createOrder`, `esewaSuccessCallback`, `esewaFailureCallback`,
  `checkEsewaStatus`, and `adminOrderController.updateOrderStatus`) so an
  order confirmation, payment result, or status change becomes a bell-icon
  notification too, not just an email. Split into pure, DB-free "builder"
  functions (`buildOrderPlacedNotification`, `buildPaymentSuccessfulNotification`,
  `buildPaymentFailedNotification`, `buildOrderStatusChangedNotification` —
  directly unit-testable, same convention as `ratingService.
  computeRatingAggregate`) and a thin `writeNotification` wrapper that takes
  the `Notification` model as a parameter instead of `require()`-ing it —
  same dependency-injection shape `ratingService.recalculateProductRating`
  uses for `Review`/`Product`. `writeNotification` never throws (a DB
  hiccup while writing a notification must never undo or block the order/
  status change that triggered it, same reasoning as the email/shipping
  side effects it sits alongside) — logs and swallows instead.
- **Frontend**: `context/AddressContext.jsx` (mirrors `WishlistContext`'s
  shape — refetch on auth change, clear on logout) backs a new
  `/account/addresses` page (`pages/Addresses.jsx`, protected route,
  add/edit/delete/set-default). `context/NotificationContext.jsx` polls
  `GET /api/notifications/unread-count` every 30s for the navbar badge
  (no websockets needed at this project's scale) and exposes optimistic
  `markAsRead`/`markAllAsRead`. `components/NotificationBell.jsx` is a
  navbar icon (unread badge, same treatment as the wishlist/cart/compare
  counts) with a dropdown of the 5 most recent notifications and a link to
  the full `pages/Notifications.jsx` list. Both new context providers are
  added to `main.jsx`'s provider tree; an "Addresses" link was added to the
  navbar's account dropdown alongside the existing "Orders" link.
  `pages/Checkout.jsx` now shows a saved-address picker (radio list,
  defaulting to the user's default address, or the first if none is
  marked default) above the existing inline shipping-address form; picking
  a saved address copies its fields in and makes the form fields read-only,
  and a "Use a different address" option switches back to the original
  editable inline form. A brand-new account with zero saved addresses sees
  only the inline form, unchanged from Phase 7c — this is what the
  progress-note's "guest checkout must keep working" concern actually
  meant, since `/checkout` has required login since Phase 2 (business rule
  #2) and there's no true guest checkout path to break.
- **Tests**: `tests/notificationService.test.js` (all four content
  builders' message/type/link/data shape, plus `writeNotification`'s
  no-user-id short-circuit, fail-soft swallowing of a rejected `create()`,
  and that it passes `{user, ...content}` through correctly) — pure-logic,
  no DB, same convention as the rest of this project's non-DB test suites.

## Completed features (Phase 5 — this phase)

Coupons + Discounts + Pricing. Wires up the two Phase 1 models still
sitting unused: `Coupon` and `CouponUsage`. Replaces
`orderController.createOrder`'s hardcoded `const discount = 0;` with a
real, checkout-time discount computation.

- **`backend/services/couponService.js`**: pure, DB-free discount logic —
  `getEligibleSubtotal`, `computeDiscountAmount`, `evaluateCoupon`,
  `collectReferencedProductIds` — directly unit-testable with zero
  mongoose dependency, same convention as `ratingService.
  computeRatingAggregate`/`compareUtils`'s pure functions. `evaluateCoupon`
  is the single entry point both the customer-facing preview and checkout
  itself call, so the two can never compute a different answer for the
  same inputs.
  - **Restriction scoping**: an empty `applicableProducts`/
    `applicableCategories` (the common case) means the coupon applies to
    the full cart subtotal. A non-empty restriction narrows the discount
    to only the matching line items' subtotal — `minOrderAmount` is still
    checked against the *full* cart subtotal, so a restricted coupon can
    still require a minimum overall order size. A custom build's
    components are each checked individually against the restriction
    (`10% off GPUs` discounts just the GPU portion of a saved build), not
    the whole build line.
  - **Discount math**: percentage coupons are capped by
    `maxDiscountAmount` when set; fixed coupons can never discount more
    than the eligible subtotal itself (no negative line totals). Rounded
    to the nearest whole NPR.
  - **Usage-limit enforcement reads `CouponUsage`, not
    `Coupon.usedCount`** — per the Phase 1 design note on the model
    itself, `usedCount` is only a denormalized display cache. Both the
    per-user (`usageLimitPerUser`) and global (`usageLimit`) checks count
    real `CouponUsage` documents.
- **Customer-facing preview** (`backend/controllers/couponController.js`,
  `routes/couponRoutes.js`, mounted at `/api/coupons`, login required —
  same no-guest-concept convention as `/api/wishlist`/`/api/addresses`,
  since usage limits are tracked per-user): `POST /api/coupons/validate
  { code }` reads the caller's live cart, builds the productId -> category
  map a restricted coupon needs, and returns `evaluateCoupon`'s verdict —
  a discount amount plus the normalized code, or a customer-facing reason
  it doesn't apply. Nothing is reserved or recorded here.
- **Authoritative checkout-time evaluation**
  (`backend/controllers/orderController.js`): `createOrder` now accepts an
  optional `couponCode` and **re-evaluates it from scratch** against the
  live cart — never trusting whatever discount the preview endpoint showed
  earlier, since the cart, the coupon, or its usage count can all have
  changed in between. An invalid/expired/exhausted code at this point
  fails the whole checkout (400) rather than silently charging full price,
  so the total a customer sees at checkout always matches what they're
  actually charged. On success, a `CouponUsage` row is created and
  `Coupon.usedCount` is incremented **inside the same Mongo transaction**
  as the order creation and stock decrement — a usage record can never
  exist without its order, or vice versa, exactly the same atomicity
  guarantee the existing stock-decrement step already relies on.
  `Order.couponCode` (new field, additive) records which code was used,
  alongside the existing `discount` amount.
- **Admin CRUD** (`backend/controllers/adminCouponController.js`,
  `routes/adminCouponRoutes.js`, mounted at `/api/admin/coupons`,
  `protect` + `authorize('admin')`): list (search by code, filter by
  active/inactive/expired, paginated), get-one (includes a live
  `CouponUsage` count alongside the cached `usedCount`), create, update,
  `PATCH /:id/toggle` (flip `isActive` — the common "pause this coupon"
  action), delete. **Delete is blocked once a coupon has any real
  `CouponUsage` rows** — deactivate instead. This deliberately avoids
  repeating the hard-delete mistake `BUILD_FORGE_PROGRESS.md` itself
  already flags as a Phase-10 fix for `Product`; there was no reason to
  introduce the same problem here when "stop this coupon from working"
  (toggle) already covers the real need without breaking historical
  `CouponUsage`/`Order` references.
- **Analytics**: `adminAnalyticsController.getOverview` gained
  `totalDiscountGiven`, summed in the *same* aggregate as `totalRevenue`
  (confirmed orders only — `Paid`/`COD`, excluding `Pending`/`Failed` —
  per this file's pre-existing rule, which the "important architectural
  decisions" section below already called out as binding for Phase 5).
- **Frontend**: `pages/Checkout.jsx` gained a coupon code field (apply/
  remove, inline error message) and a discount line in the order summary;
  the applied code is sent as `couponCode` with the order. This is
  explicitly a *preview* — if the cart or coupon state changes before
  submit, the backend's authoritative re-evaluation is what actually
  determines the order's discount, and a stale preview at worst surfaces a
  fresh error at submit rather than a wrong charge. No changes were needed
  to order confirmation/history: `OrderSummaryCard` already rendered an
  `order.discount > 0` line (built ahead of this phase, per its Phase 4
  write-up). Admin: `pages/admin/AdminCoupons.jsx` (searchable/filterable
  table, activate/deactivate, delete-guard messaging) +
  `components/admin/CouponFormModal.jsx` (create/edit, category-restriction
  toggles — `applicableProducts` isn't exposed in this form since the admin
  UI has no product picker yet; a coupon needing specific-product
  restriction can still be created via the API directly), both following
  `AdminProducts`/`ProductFormModal`'s existing pattern. A new "Discounts
  given" stat card was added to `AdminDashboard` alongside the existing
  revenue/order cards, and `/admin/coupons` was added to `AdminLayout`'s
  nav and `App.jsx`'s admin route tree.
- **Tests**: `tests/couponService.test.js` (`getEligibleSubtotal` for
  unrestricted/product-restricted/category-restricted/no-match/custom-build
  cases, `computeDiscountAmount` for plain percentage, capped percentage,
  fixed, fixed-clamped-to-subtotal, zero-subtotal, and rounding,
  `collectReferencedProductIds` dedup, and `evaluateCoupon` across every
  rejection path — not found, inactive, not-yet-started, expired,
  global-limit reached, per-user-limit reached, below minimum order,
  no eligible items, plus the valid unrestricted and valid
  restricted-discount-amount cases) — pure-logic, no DB, same convention
  as the rest of this project's non-DB test suites.

## Completed features (Phase 6 — this phase)

Wired up the five Phase 1 models that had been sitting unused since then:
`CommunityBuild`, `BuildLike`, `Comment`, `BuildRating`, `Report`. Backend
only — no frontend changes (that's Phase 7).

- **Publishing** (`backend/controllers/communityBuildController.js`,
  `POST /api/community/builds`): takes a `sourceBuildId` pointing at one of
  the caller's own saved `Build`s, re-loads its components fresh from
  `Product` and re-runs `compatibilityService.checkBuildCompatibility` at
  publish time (specs/prices may have drifted since the build was saved —
  same reasoning `getBuildById` already uses), then snapshots
  `components`/`totalPrice`/`compatibilityStatus` onto the new
  `CommunityBuild` via `Build.componentsSchema`. Two guards: a build with a
  compatibility **error** can't be published, and neither can a fully empty
  one. The snapshot is never touched again by anything else in this phase —
  editing a post only changes its metadata (title/description/category/
  tags/visibility/image), per the Phase 1 design note that a community post
  doesn't stay live-linked to its source `Build`.
- **Feed** (`GET /api/community/builds`): `public`+`visible` only, filter by
  `category`/`tags`/`search` (`$text` over the model's existing text index),
  sort `newest`/`popular`/`top-rated`/`most-viewed`, paginated.
  `optionalAuth` so each card can carry the caller's own `isLiked`/
  `myRating`/`isOwner` without a second round-trip. `GET .../mine` (login
  required) lists the caller's own posts at every visibility/status,
  registered before `/:id` so Express doesn't swallow it as an id.
- **Detail** (`GET /api/community/builds/:id`, `optionalAuth`): a shared
  `canView` helper (owner or admin always; otherwise blocked on `hidden`
  status or `private` visibility — `unlisted` is viewable by direct link,
  just excluded from the feed query) gates this and every other per-build
  route below. Decided the `viewsCount` open question from the Phase 1 note
  by incrementing unconditionally except for the owner viewing their own
  post — cheap, trivially inflatable by repeat requests, and documented
  in-line as an intentional trade-off rather than building session/IP
  de-duplication for a display-only counter.
- **Likes** (`POST /api/community/builds/:id/like`): a true toggle
  (`findOneAndDelete` → create if nothing was deleted, delete path already
  found it otherwise) keeping `CommunityBuild.likesCount` in sync with the
  `BuildLike` join-row collection, check-then-act same as
  `wishlistController.moveToCart`'s existing style rather than a
  transaction over a like button.
- **Comments** (`backend/controllers/commentController.js`, nested under
  `/builds/:id/comments`): list (paginated, oldest-first, visible only),
  create, edit-own (sets `isEdited`), delete-own (a real delete — the
  author removing their own content, not the moderation path — same
  distinction `reviewController.deleteReview` draws). `commentsCount` is
  incremented/decremented directly at each of these points rather than
  recomputed, per the Phase 1 design note's "kept in sync on each
  create/delete" framing.
- **Ratings** (`backend/controllers/buildRatingController.js`, nested under
  `/builds/:id/rating(s)`): `BuildRating` upserts (one rating per user per
  build, matching its unique index) rather than reject-on-duplicate, a
  build owner can't rate their own post, and every create/delete
  recalculates `averageRating`/`ratingCount` via a new
  `ratingService.recalculateBuildRating` — the same `computeRatingAggregate`
  Review→Product already uses, since the aggregation math doesn't care what
  kind of thing is being rated, just re-pointed at `BuildRating`/
  `CommunityBuild` field names.
- **Reports** (`backend/controllers/reportController.js`,
  `POST /api/community/reports`): one endpoint for both `communityBuild`
  and `comment` targets per the Phase 1 design note, confirms the target
  actually exists before logging it. No dedupe against repeat reports on
  the same target — left for the admin queue to surface as a signal, not
  filtered out as noise.
- **Admin moderation** (`backend/controllers/adminCommunityController.js`,
  mounted at `/api/admin/community`): build hide/unhide (same
  `status`/`moderatedBy`/`moderatedAt`/`moderationReason` pattern as
  `adminReviewController`), comment hide/unhide (keeps the parent build's
  `commentsCount` in sync going in both directions, with a defensive
  existence check on unhide in case the parent was deleted in the
  meantime), and a report queue (`GET /api/admin/community/reports`,
  defaults to pending-oldest-first per `Report`'s own index) with a
  `resolve` endpoint that only records the moderator's decision
  (`reviewed`/`dismissed`/`actioned`) — deliberately decoupled from
  actually hiding the reported content, since a report can be actioned
  (e.g. a warning) without taking the content down.
- Deleting your own community build (`DELETE /api/community/builds/:id`)
  cascades to every row referencing it — `BuildLike`, `BuildRating`,
  `Comment`, and any `Report`s naming it as `targetType: 'communityBuild'`
  — so nothing dangling is left for the feed or the admin queues to trip
  over.
- **Tests**: `tests/communityValidator.test.js` (28 cases across all four
  validators — build publish/update including partial-mode title handling,
  comment text length, rating bounds, and report target-type/reason
  validation), same pure-logic convention as `reviewValidator.test.js`/
  `productValidator.test.js`.

## Completed features (Phase 7 — this phase)

Wired the Phase 6 community backend up to a UI. Frontend only — no
backend routes/controllers/models were touched.

- **Feed** (`frontend/src/pages/Community.jsx`, `/community`): category
  (the `BUILD_USE_CASES` use-case tag, mirrored client-side in the new
  `utils/community.js` rather than fetched, same treatment
  `utils/specs.js`'s `CATEGORY_LABELS` gives the 8 product categories),
  search, and `newest`/`popular`/`top-rated`/`most-viewed` sort, all as
  URL search params (`useSearchParams`) the same way `Shop.jsx` already
  does it, paginated with the existing `Pagination` component.
  `components/community/CommunityBuildCard.jsx` renders each result: up to
  four component thumbnails, use-case badge, compatibility-status dot
  (reusing `Build.jsx`'s `compatible`/`warning`/`error` → dot-color
  mapping), price, and an optimistic like toggle that reconciles against
  the server's returned `likesCount` on success and reverts on failure —
  same optimistic-then-reconcile shape `WishlistContext.toggle` already
  uses, just local to the card instead of a context, since likes here
  are a per-card action rather than an app-wide "is this in my wishlist"
  lookup needed on many surfaces at once.
- **Detail page** (`pages/CommunityBuildDetail.jsx`,
  `/community/builds/:id`): title/description/tags, a read-only 8-slot
  parts list (new `components/community/BuildComponentsList.jsx`, same
  slot order and `CategoryIcon`/`CATEGORY_LABELS` `Build.jsx` already
  uses, just non-interactive), like button, and for the owner an
  Edit/Delete pair instead of a Report link. Handles the backend's
  uniform 404 for "not found, hidden, or private" (`canView`) with a
  simple "this build could not be found" state rather than trying to
  distinguish the reasons — the backend deliberately doesn't leak which
  one it is either.
- **Comments** (`components/community/CommentThread.jsx`): paginated
  list, post, edit-own (sets the `isEdited` flag the backend already
  tracks), delete-own, and a per-comment "Report" action for everyone
  else — same visible/own-content-only affordances
  `ReviewsSection.jsx` established for reviews.
- **Ratings** (`components/community/BuildRatingWidget.jsx`): average +
  count display always shown; a logged-in non-owner gets an interactive
  `RatingStars` picker (upserts via `POST .../rating`) plus a "Remove"
  link (`DELETE .../rating`) once they've rated. The owner sees a plain
  "You can't rate your own build" note instead of a picker, matching the
  backend's own guard rather than only discovering it on a rejected
  submit.
- **Reporting** (`components/community/ReportModal.jsx`): a fixed
  frontend-only reason-picker (`utils/community.js`'s `REPORT_REASONS`)
  plus an optional free-text `details` field, posting straight to the
  one shared `POST /api/community/reports` endpoint for both builds and
  comments — resolves the open question the Phase 6 write-up left for
  this phase in favor of a picker over a blank text box, since the
  backend's `reason` field is unconstrained free text and a handful of
  presets covers the common cases without forcing every reporter to
  compose a sentence.
- **Publish flow**: `components/community/PublishBuildModal.jsx` is one
  form used two ways — from `Build.jsx`'s existing
  `MyBuildsSection.jsx` (now with a "Publish" button per saved build,
  disabled with an explanatory `title` tooltip when that build's
  `compatibilityStatus` is `error`, since the backend rejects those
  publishes anyway) it posts `POST /api/community/builds` with a
  `sourceBuildId`; from the detail page's owner Edit action or
  `MyCommunityBuilds.jsx`'s per-post Edit button, the same form (minus
  the "this snapshots your current parts" notice) instead calls
  `PUT /api/community/builds/:id` with no `sourceBuildId` — matching the
  backend's own split that publishing snapshots components while editing
  only ever touches metadata.
- **"My posts"** (`pages/MyCommunityBuilds.jsx`, `/community/mine`,
  login required): lists every one of the caller's posts regardless of
  visibility or moderation status (per `GET /api/community/builds/mine`),
  surfacing a hidden post's `moderationReason` inline so an author knows
  why without needing to ask, plus Edit/Delete per row.
- **Admin moderation** (`pages/admin/AdminCommunity.jsx`, `/admin/community`):
  three tabs over one page rather than three separate routes, since
  they share no independent top-level nav weight of their own (following
  `AdminReviews.jsx`'s hide/unhide-with-optional-reason pattern exactly
  for both the builds and comments tables) — a **Reports** tab lists the
  moderation queue (defaults to `pending`, matching the backend's own
  default ordering) with an inline status-picker + resolution-notes
  field per pending row calling `PATCH .../reports/:id/resolve`,
  deliberately not auto-hiding the reported content (matching the
  backend's own decoupling of "resolve the report" from "hide the
  build/comment" — a moderator who wants both takes two actions, same as
  the API requires).
- Added `frontend/src/utils/community.js`: the community `category`
  use-case list, `visibility` option labels, and the report reason
  presets — kept separate from `utils/specs.js` since that file is
  product-category specs, not community metadata.
- One small pre-existing-bug fix while touching `MyBuildsSection.jsx`
  for the Publish button: its "log in to save builds" note still read
  "arrives in Phase 7c" (stale since Phase 7c actually shipped login) —
  replaced with a working `Link` to `/login`.

## Completed features (Phase 8 — this phase)

Community → PC Builder → Cart (Copy Build). Wires up `CommunityBuild.copiesCount`,
the one Phase 1 field that had been sitting unused since then. No new model.

- **Backend** (`backend/controllers/communityBuildController.js`,
  `POST /api/community/builds/:id/copy`, mounted in `communityRoutes.js`,
  `optionalAuth` — copying works for guests too, same as the builder itself
  per spec section 3, and `cartController.addCustomBuild` already accepts
  guest carts via `x-session-id`): gated by the same `canView` check as
  `getBuildById` (a build a visitor can't view can't be copied either),
  then reuses the *existing* `loadBuildComponents` helper (already written
  for `publishBuild`) to reload the components fresh from `Product` and
  reruns `compatibilityService.checkBuildCompatibility`/`isBuildOrderable` —
  the same "recompute at the point of use" rule `publishBuild` itself
  already follows against the *source* Build, applied here against the
  *published* snapshot, since prices/stock/specs may have drifted since the
  post went up. Returns the fresh `components`/`report`/`orderable`/`total`
  plus the updated `copiesCount`. The counter increment is a plain atomic
  `findByIdAndUpdate($inc)` (no read-then-write race), and — same trade-off
  already made for `viewsCount` — skips incrementing when the owner copies
  their own post.
  - Resolved the two open questions the Phase 7 write-up left for this
    phase: a `warning`-status build **can** be copied (only `error` blocks
    the "add straight to cart" shortcut, matching the exact rule
    `cartController.addCustomBuild` itself already enforces); and a guest
    (not logged in) **can** copy, into either the builder or a guest cart,
    consistent with this project's existing "building/cart don't require
    login" rule.
- **Frontend**: `pages/CommunityBuildDetail.jsx` gained a "Copy this build"
  action (next to Like, shows the live `copiesCount`) that calls the new
  endpoint and renders an inline result panel — always a "Continue in
  Builder" button, plus an "Add straight to cart" button that only appears
  when the backend reports `orderable: true`, with a one-line status note
  (clean / minor warnings / a compatibility issue was found since posting).
  "Continue in Builder" navigates to `/build` carrying the already-fetched
  components in router state (`location.state.loadBuild`) rather than
  re-fetching; "Add straight to cart" calls the existing
  `CartContext.addCustomBuild` (same helper `Build.jsx`'s own "Add to Cart"
  button already uses) with the fresh component ids and redirects to
  `/cart` on success. `pages/Build.jsx` gained a one-time effect that reads
  `location.state.loadBuild` on mount, seeds the builder's slot selection
  and name from it (the copy endpoint's `components` shape already matches
  `Build.jsx`'s own `selected` state — both keyed by the same 8
  `CATEGORY_KEYS` — so no reshaping is needed), shows a dismissible banner
  noting prices/stock were just refreshed (or, if compatibility had
  drifted, that an issue needs fixing), and clears the router state via a
  `replace` navigation so a refresh or back-navigation doesn't reload it a
  second time. From there the existing debounced `POST /builds/check`
  effect takes over exactly as it does for any manually-built selection.
- No new Jest suite: this phase introduced no new pure-logic module —
  `copyBuild` is a thin composition of `loadBuildComponents` (Phase 6),
  `checkBuildCompatibility`/`isBuildOrderable` (Phase 3, already covered by
  `tests/compatibility.test.js`), and `totalPrice` (Phase 6), all already
  exercised by existing suites/manual verification. The recompute-at-copy
  behavior itself was exercised directly against `compatibilityService.js`
  in a throwaway script: a build whose CPU/motherboard sockets were made to
  mismatch (simulating drift since publish) correctly reported `status:
  'error'`/`orderable: false`, and a matched, fully-populated build
  correctly reported `status: 'compatible'`/`orderable: true` — see "Tests
  performed" below.

## Completed features (Phase 9 — this phase)

Orders + Delivery + Payment Improvements. No new model — extends the
existing `Order` model additively (`statusHistory`, `estimatedDeliveryDate`)
and fixes three of the "Known bugs/issues" this file itself was already
tracking, plus adds the delivery-facing features the phase name promises.

- **Guest-cart merge bug fixed** (`backend/utils/mergeCartItems.js`,
  `authController.mergeGuestCart`): previously a product already present in
  both the guest cart and the user's cart ended up as two separate line
  items after login/register, instead of one line item with a summed
  quantity — confirmed and explicitly flagged for Phase 9 in this file's own
  "Known bugs" section. `mergeCartItems` is a pure, DB-free function (same
  convention as `utils/inventory.js`'s `flattenStockRequirements`) that sums
  matching standalone items and leaves custom-build items untouched as
  separate lines (a saved build was never meant to merge into another one).
  `mergeGuestCart` now also caps a merged quantity at the product's current
  live stock, the same cap `cartController.addItem` already applies when
  adding a single item.
- **Inventory concurrency strengthened** (`orderController.createOrder`):
  the pre-transaction stock check was only ever a friendly early check —
  the actual decrement was a blind `$inc` with no floor guard, so two
  simultaneous checkouts for the last unit(s) of a product could both pass
  the check and both decrement before either committed. Explicitly called
  out as in-scope ("Strengthen inventory concurrency") in this file's
  "Known bugs" section. Each decrement is now a single atomic conditional
  update (`{ _id, stock: { $gte: qty } }` in the *filter*, not just the
  update) inside the same Mongo transaction as order creation; if any
  item's conditional update doesn't match, the whole transaction throws and
  rolls back — no order is left half-created and no other item's stock is
  left decremented. The loser of the race gets a clean 409 naming the
  product that ran out, rather than a confusing partial success.
- **Payment-status transition guard added**
  (`backend/utils/paymentTransitions.js`,
  `adminOrderController.updatePaymentStatus`): previously any enum value was
  accepted with no guard at all — unlike `updateOrderStatus`, which already
  blocked `Delivered`/`Cancelled` reversals — so an admin could revert a
  fulfilled `Paid`/`COD` order back to `Pending` by mistake. Flagged for
  Phase 9/11 in this file's own "Known bugs" section. `isValidPaymentTransition`
  is a small pure lookup table: `Refunded` is now terminal, `Paid` can only
  move to `Refunded`, `COD` can move to `Paid` or `Refunded`, `Pending` can
  move to `Paid`/`Failed`/`COD`, and `Failed` can move to `Paid` (manual
  reconciliation) or back to `Pending` (retry) — an invalid transition now
  returns a 400 naming the two statuses involved instead of silently
  succeeding.
- **Scheduled eSewa stale-Pending sweep**
  (`backend/services/esewaSweepService.js` — pure, dependency-injected
  decision logic, same DI shape `utils/inventory.js`/`ratingService.js`
  already use — plus `esewaSweepRunner.js`, the thin wiring layer that
  supplies the real Mongoose models/services): previously an eSewa order
  only ever left `Pending` via the customer's own browser hitting the
  success/failure redirect, or a manual `GET /api/orders/:id/esewa-status`
  call — flagged as a candidate for Phase 9 in this file's "Known bugs"
  section ("no scheduled sweep for eSewa orders stuck Pending
  indefinitely"). The sweep runs on an interval (`server.js`, default every
  30 minutes, configurable/disable-able via `ESEWA_SWEEP_INTERVAL_MINUTES`,
  off entirely when `NODE_ENV=test`): any `esewa`/`Pending` order older than
  `ESEWA_SWEEP_RECHECK_AFTER_MINUTES` (default 15) is rechecked against
  eSewa's status API — `COMPLETE` finalizes it as `Paid` (same
  confirmation/notification side effects `esewaSuccessCallback` already
  fires), a terminal eSewa status (`CANCELED`/`NOT_FOUND`/`EXPIRED`) or
  simply exceeding `ESEWA_SWEEP_EXPIRE_AFTER_HOURS` (default 24, applied
  regardless of what the status check says — including if the check itself
  errors) expires it (restocks via the existing `restockOrderItems`, marks
  `Failed`/`Cancelled`). Also exposed as an on-demand admin action,
  `POST /api/admin/orders/sweep-esewa`, for support to force a
  reconciliation pass without waiting for the next interval.
- **Delivery tracking** (`Order.statusHistory`, `Order.estimatedDeliveryDate`,
  `backend/utils/delivery.js`): BuildForge still has no real courier
  integration (`shippingNotificationService.js`'s own design note already
  documents this as by-design, not a gap), so there's no live tracking feed
  to show a customer — but every `orderStatus` change is now appended to a
  `statusHistory` array (`{status, changedAt, changedBy}`, `changedBy` one
  of `system`/`customer`/`admin`) so the frontend can render a delivery
  timeline instead of only ever showing the current status. `estimateDeliveryDate`
  (pure, DB-free) computes a plain estimate at checkout time — 5 business
  days, +1 extra for COD orders (they route through an extra
  cash-verification step) — stored once on the order, never recomputed
  client-side, matching this project's "frontend never recomputes what the
  backend decided" rule.
- **Customer self-service cancellation** (`PATCH /api/orders/:id/cancel`,
  `orderController.cancelMyOrder`): a shopper can now cancel their own order
  directly — owner-only, and only while `orderStatus` is still `Pending` or
  `Confirmed` (once fulfillment has actually started, they're pointed to
  support instead of being able to cancel out from under a courier).
  Restocks and flips a `Paid` order to `Refunded` using the exact same
  bookkeeping `adminOrderController.updateOrderStatus` already applies for
  an admin-driven cancellation, and fires the same
  email/in-app-notification side effects.
- **Frontend**: `components/order/DeliveryTimeline.jsx` — a simple stepper
  built from `order.statusHistory` (or, for a cancelled order, a single
  "Order cancelled" entry) plus the plain estimated-delivery-date, rendered
  inside `OrderSummaryCard` (so it shows on `OrderDetail`, `OrderConfirmation`,
  and the admin `OrderDetailModal` alike, with zero duplicated markup).
  `OrderSummaryCard` also gained an optional "Cancel order" button (only
  rendered when the caller passes `onCancelOrder` *and* the order is still
  in a cancellable status) — `pages/OrderDetail.jsx` wires it up behind a
  `ConfirmDialog` (the same confirm-before-destructive-action component
  `AdminUsers`/`AdminProducts` already use) and surfaces the backend's error
  message inline if cancellation is rejected.
- **Tests**: four new pure-logic Jest suites, same no-DB-needed convention
  as every prior phase's suites — `tests/mergeCartItems.test.js` (summing
  matching standalone items, never merging custom builds, the stock cap,
  an empty guest cart no-op), `tests/paymentTransitions.test.js` (every
  allowed/blocked transition in the table, including `Refunded`'s
  terminality), `tests/delivery.test.js` (business-day math skipping
  weekends, the COD extra-day surcharge), and
  `tests/esewaSweepService.test.js` (the pure `decideAction` branch logic,
  plus a fake-model exercise of the full sweep — finalize-as-paid,
  expire-and-restock, leave-still-pending, and a failed status-check call
  not itself crashing the sweep and correctly falling through to the
  age-based expiry).

## Completed features (Phase 10 — this phase)

Admin Improvements. No new model for the product side (`Product` gained two
additive fields); one new model for categories. Scoped to the four
candidates `BUILD_FORGE_PROGRESS.md` itself had already flagged across the
"Known bugs" and "Next phase to implement" sections — see that history
below for exactly which write-up first raised each one.

- **Soft delete/archive for products** (`backend/utils/productArchive.js`,
  `models/Product.js`, `controllers/adminProductController.js`,
  `controllers/productController.js`, `controllers/cartController.js`):
  fixes the bug this file has been tracking since Phase 0 — a hard
  `deleteOne()` left existing product-page links 404ing even though
  historical orders were always safe (item snapshots, not live references).
  `Product` gained `isArchived`/`archivedAt` (additive) and a
  `Product.findActive(filter)` static that every *browsing* surface now
  goes through instead of `Product.find(...)` directly — `getProducts`,
  `getFeaturedProducts`, `getRelatedProducts`, `getSearchSuggestions`,
  `getWorksWith`, and `getCategories`'s count aggregate all exclude
  archived products now. `getProductById` deliberately does **not** —
  an archived product's detail page still resolves (200, not 404), with
  `isArchived: true` in the response the frontend uses to show a "no
  longer available" state and disable add-to-cart, which is the actual fix
  for the tracked bug (a resolving-but-marked-discontinued page beats a
  broken link). `adminProductController.deleteProduct` now archives
  instead of hard-deleting (idempotent — archiving an already-archived
  product is a no-op success, not an error) and a new
  `PATCH /:id/restore` undoes it (also idempotent). `listProducts` (admin)
  gained `?status=active|archived|all` (pure filter-building logic split
  into `utils/productArchive.js`'s `buildAdminArchiveFilter`, same
  DB-free-helper convention as `utils/inventory.js`/`utils/delivery.js`),
  defaulting to `all` so an admin can find and restore an archived item
  without an extra step. `cartController.addItem`/`addCustomBuild` both
  reject an archived product server-side (same backend-authoritative
  spirit as their existing out-of-stock checks) — archiving a product
  can never be silently bypassed by an already-open browser tab's stale
  add-to-cart button.
  - Deliberately left for a later pass rather than touched here:
    `compareController`, `recommendationController`/`recommendationService`,
    and `cartController.addCustomBuild`'s build-slot product lookups still
    query `Product.find` directly rather than `Product.findActive` — an
    archived product could in principle still surface in a recommendation
    or a comparison. None of these are purchase paths (cart/checkout are
    covered above), so the risk is a discontinued item appearing in a
    "similar products" list, not becoming orderable. Flagged as a
    candidate for **Phase 11** rather than expanded here, to keep this
    phase's diff reviewable.
- **Category display-metadata management** (`backend/models/Category.js`,
  `utils/categoryDefaults.js`, `utils/categoryUtils.js`,
  `controllers/adminCategoryController.js`, mounted at
  `/api/admin/categories`): resolves the other Phase 10 candidate this file
  flagged ("categories are still a hardcoded 8-value enum, not a
  collection") — but deliberately *not* by making the category set itself
  manageable. `Product.CATEGORIES`'s 8 slugs are structurally load-bearing
  everywhere else in this codebase: the PC builder's 8 fixed slots
  (`Build.CATEGORY_KEYS`), every pairwise check in
  `compatibilityService.js`, and `Product.category`'s own enum all assume
  exactly these 8 values — adding a 9th here wouldn't do anything (nothing
  else knows what to do with it) and removing one would orphan its
  existing products. So `Category` is a small metadata-only collection
  (`slug` fixed/enum-constrained, `label`/`description`/`image`/
  `displayOrder`/`isActive`) — admins edit *how* each fixed category is
  presented, not *which* categories exist. `ensureDefaultCategories`
  (`utils/categoryDefaults.js`) idempotently backfills a document for any
  of the 8 slugs missing one — run once at boot (`server.js`), never
  overwriting an existing admin edit. The public `GET /api/categories`
  (`productController.getCategories`) now merges this metadata with a
  live, archived-excluded product count via a new pure function,
  `utils/categoryUtils.js`'s `mergeCategoryData` (DB-free, directly
  unit-testable, same convention as `compareUtils.js`'s pure functions),
  sorted by `displayOrder` and dropping any category an admin has hidden
  from the storefront (`isActive: false`) — the response shape stays
  backward compatible (`slug`/`count` unchanged) with new fields alongside.
  `GET /api/admin/categories` (admin-only) shows every category regardless
  of `isActive`, with counts that include archived products, so an admin
  sees the full picture. `PUT /api/admin/categories/:slug` edits metadata
  only — `slug` itself is never an editable field.
- **Product-picker for coupon restrictions**
  (`frontend/src/components/admin/ProductPickerField.jsx`): a reusable
  searchable multi-select (debounced search against the existing
  `GET /admin/products?search=`, add/remove chips) — resolves the Phase
  5/9-flagged gap where `AdminCoupons`'s form only exposed
  `applicableCategories`, not `applicableProducts`, purely for lack of a
  picker component (the backend/`couponService.js` has fully supported
  product-level restriction since Phase 5). Wired into
  `CouponFormModal.jsx` alongside the existing category-restriction
  buttons; both restrictions now compose exactly as `couponService.
  getEligibleSubtotal` already expected. Written generically (ids in/out,
  no coupon-specific logic) so a future admin need (e.g.
  `ProductFormModal`'s eventual "related products" field) can reuse it
  instead of building a second picker.
- **Payment-status dropdown filtering**
  (`frontend/src/utils/paymentTransitions.js`,
  `components/admin/OrderDetailModal.jsx`): resolves the Phase 9-flagged
  gap where the dropdown listed every `PAYMENT_STATUSES` enum value
  regardless of whether `utils/paymentTransitions.js`'s
  `isValidPaymentTransition` would actually accept it from the order's
  current status. The frontend file is a small, explicitly-documented
  duplication of the backend's `ALLOWED_PAYMENT_TRANSITIONS` table (same
  trade-off this file's own Phase 9 write-up already named) — the backend
  remains authoritative and re-checks every request regardless, so a
  stale copy here can only ever be *more* permissive in what it offers,
  never less safe. `getSelectablePaymentStatuses(current)` returns
  `[current, ...allowed]` so the dropdown always includes the order's
  existing value, matching how the order-status dropdown already behaves.
- **Tests**: two new pure-logic Jest suites, same no-DB-needed convention
  as every prior phase — `tests/productArchive.test.js`
  (`buildAdminArchiveFilter`'s three named filters, the `undefined`/
  unrecognized-value fallback to `'all'`) and `tests/categoryUtils.test.js`
  (`mergeCategoryData`: metadata merging, fallback-to-slug/zero-count for
  a category with no doc or count yet, `displayOrder`-then-label sorting,
  the `activeOnly` filter, ignoring an unrelated extra doc, and not
  mutating its inputs).

## Completed features (Phase 11 — this phase)

Security + Testing + Final UI/UX. The previous turn only had the Phase 10
diff (plus `app.js`/`server.js`) in its working copy and did the one piece
of this phase fully answerable from those files (category image upload);
this turn received the full Phase 9 repo snapshot plus the Phase 10 diff
overlaid on it, so the two items that were deferred pending
`compareController.js`/`recommendationController.js`/
`recommendationService.js` are now done as real, reviewable diffs against
the actual source instead of guesses.

- **Archived-product exclusion extended to comparison and recommendations**
  (`controllers/compareController.js`, `controllers/recommendationController.js`):
  resolves the follow-up Phase 10 explicitly left open ("None of these are
  purchase paths... the risk is a discontinued item appearing in a
  'similar products' list, not becoming orderable"). Every *discovery*
  query in both files now goes through `Product.findActive` instead of
  `Product.find`, matching the rule `productController.js` already applies
  to listing/featured/search/related/works-with:
  - `compareController.compareProducts` — the products being compared.
  - `recommendationController.getSimilar` / `getFrequentlyBought` — each
    candidate pool.
  - `getBuildCompletions` — the per-empty-slot candidate pool (a real
    purchase-path leak if left unfixed, since these are one-click
    "add to my build" suggestions, not just a cosmetic listing).
  - `getForYou` — both the guest/new-account fallback pool and the
    logged-in personalized pool.
  - Deliberately **left as a direct `Product.find`/`findById`** (not a
    bug, not touched): `getSimilar`/`getFrequentlyBought`'s own
    `req.params.productId` lookup (same "resolves by id regardless of
    archived status" rule `getProductById` already establishes — a
    since-archived product's own page can still show recommendations for
    *other*, active products), and `getBuildCompletions`'s
    `selectedProducts` lookup (the components a user has *already* picked
    for their build, read back by id to compute compatibility against —
    not a discovery surface). `recommendationService.js` itself needed no
    change — it's pure ranking/filtering logic with zero `Product.find`
    calls of its own, same as every prior phase's pure-logic modules.
  - `cartController.addCustomBuild` was re-checked against this same
    question and needed no change — it already does its own explicit
    `isArchived` check per component (with a specific "X is no longer
    available" error) rather than silently filtering, which is the
    stricter, more correct behavior for an actual checkout path; see its
    inline comment.
  - **Tests**: `tests/archivedExclusion.test.js` — a static regression
    guard (5 cases) asserting each discovery query above is spelled with
    `Product.findActive`, and that the two deliberately-unchanged direct-
    by-id lookups stay plain `Product.find`/`findById`. This sandbox still
    has no live MongoDB to exercise the real query results end-to-end
    against actual archived/active documents (same limitation every
    DB-backed phase's own testing section has already flagged — Phase 6's
    fake-mongoose-shim workaround, Phase 9's "needs a live Mongo instance"
    notes, etc.) — a source-level guard was judged more useful here than
    another one-off fake-mongoose module for just two files, since what
    actually needs protecting against is a future edit silently reverting
    `findActive` back to `find`, which this catches with zero DB
    dependency.
- **Category image upload** (`backend/utils/imageUpload.js`,
  `backend/middleware/upload.js`, `controllers/adminCategoryController.js`,
  `routes/adminCategoryRoutes.js`): resolves the Phase 10-flagged gap —
  `AdminCategories`'s image field was a plain URL/path text input, not a
  multer-backed upload like `ProductFormModal`'s. `POST
  /api/admin/categories/:slug/image` (multipart field `image`, admin-only)
  stores the file under the same `backend/uploads/` directory the existing
  product-image upload already uses (already served statically at
  `/uploads`), named `category-<slug>-<timestamp><ext>` — human-readable
  and collision-free without needing randomization the way product images
  do, since there's exactly one image per fixed category slug rather than
  an unbounded number of products — and upserts the `Category` document
  the same way `updateCategory` already does (a freshly-seeded database
  may not have one yet). Added directly to the existing
  `middleware/upload.js` (now home to both `handleProductImageUpload` and
  the new `handleCategoryImageUpload`) once the real file was available,
  rather than the standalone module a prior pass had to invent without
  seeing it — both now share one `fileFilter` pulled from a new pure,
  DB-free module, `utils/imageUpload.js` (`isAllowedImageMime`, jpeg/png/
  webp, 5MB cap matching the existing product-upload limit), so the two
  upload targets can never quietly drift to different accepted file types.
  - **Frontend**: `AdminCategories.jsx` gained a real file input (posts a
    `FormData` to the new endpoint, swaps in the returned `category.image`
    on success) alongside — not replacing — the existing URL text field,
    relabeled "Or image URL (e.g. a CDN link)" for the case of an
    already-hosted image.
  - **Tests**: `tests/imageUpload.test.js` (mime allow/reject list
    including `undefined`, the multer-shaped `fileFilter` callback's
    accept/reject paths, the byte-limit constant) — pure-logic, no DB.
- **General security hardening** (`backend/app.js`,
  `middleware/rateLimiters.js`): the auth routes were the only endpoints
  with any rate limiting at all — search, cart mutations, coupon
  validation, and the entire admin API had no per-IP ceiling whatsoever,
  and `express.json()` had no body-size limit. Added, both deliberately
  generous so real traffic (including `NotificationContext`'s 30s poll)
  never comes close:
  - `apiLimiter` (new, alongside the existing `authLimiter`) — 600
    requests/15min per IP, mounted at `/api` (after the health-check
    route, so an uptime monitor doesn't count against it) ahead of every
    other route. `authLimiter` keeps its own separate, much tighter
    ceiling on login/register.
  - `express.json({ limit: '200kb' })` — previously unbounded; 200kb
    comfortably covers every real JSON payload in this app (binary image
    uploads go through multer's own separate file-size limit, not this).
  - `app.set('trust proxy', 1)`, gated behind a new `TRUST_PROXY` env var
    (off by default, same off-by-default spirit as email/WhatsApp/Gemini)
    — blindly trusting `X-Forwarded-For` when there's no real reverse
    proxy in front of the app would let a client spoof its own IP and
    dodge both rate limiters.
- Confirmed via `node --check` on every backend `.js` file in the full
  repo (not just Phase 11's own new/modified files) and an `esbuild`
  bundle of the full frontend module graph (same techniques every prior
  phase's own testing section has used) — see "Tests performed (Phase 11)"
  below for details.

### Still open

- A deeper security review beyond the rate-limiting/body-size items above
  (e.g. an actual dependency-vulnerability pass — `npm audit` has never
  been run for real in this sandbox, same no-network-egress limitation
  every phase has hit; JWT/cookie flag review; a closer look at the eSewa
  HMAC verification path) would be the natural next step for whoever has
  real `npm install`/live-MongoDB access.
- `npm install && npm test`/`npm run dev` against a live MongoDB — every
  phase's own "Tests performed" section has recommended this and it has
  never actually happened in this sandbox. Still the right first real
  validation step before merging any of this.

## Remaining phases (not yet started)

None — Phase 11 is the last phase on the roadmap, though see "Deferred to
a follow-up" immediately above for what's still open within it.

## Important architectural decisions (pre-existing, to respect going forward)

- **Compatibility logic lives in exactly one place**
  (`backend/services/compatibilityService.js`), a pure DB-free function.
  Every new feature that needs compatibility data (comparison, copy-build)
  must call into this module — never re-implement pairwise checks
  elsewhere.
- **Stock accounting is centralized** in `backend/utils/inventory.js`
  (`flattenStockRequirements`, `restockOrderItems`). Any new code path
  that touches stock (coupon-triggered holds, community copy-build) should
  reuse these helpers.
- **Revenue/analytics only count confirmed payments** (`Paid`/`COD`,
  excluding `Pending`/`Failed`) — new coupon/discount analytics in Phase 5
  and community analytics in Phase 10 must follow the same rule.
- **The frontend never recomputes what the backend decided** — compatibility
  status, totals, stock status, and revenue all come from API responses.
  Applies equally to future coupon totals and comparison specs.
- **Email/WhatsApp/Gemini are all off-by-default, fail-soft integrations**
  gated by presence of env vars, and must never block a core flow
  (checkout, order status) if unconfigured or erroring. The Phase 4 in-app
  notification center follows the same fail-soft-never-blocks-checkout
  rule but has no env-var gate of its own — see `notificationService.js`.
- Cart items and order items store **snapshots** (name/image/price at time
  of add/purchase), not live references — this is why historical orders
  stay valid even if a product is later hard-deleted, and why any future
  soft-delete work in Phase 10 doesn't need to touch historical order data.
- Order IDs are generated atomically via a per-day `Counter` document
  (`utils/generateOrderId.js`) — reuse this pattern if any new
  human-readable ID scheme is needed (e.g. coupon codes, community build
  slugs) rather than inventing a new counter mechanism.

## Database models currently present

**Pre-existing (Phase 0):** `User`, `Product`, `Cart`, `Order`, `Build`,
`Counter` — see `PHASE_00_AUDIT.md` §4 for full field-level detail.
`Product` and `Build` were extended additively in Phase 1 (see above).

**Wired up in Phase 2:** `Wishlist`, `Review` (routes/controllers now live —
see above).

**Wired up in Phase 4:** `Address`, `Notification` (routes/controllers now
live — see above).

**Wired up in Phase 5:** `Coupon`, `CouponUsage` (routes/controllers now
live — see above).

**Wired up in Phase 6:** `CommunityBuild`, `BuildLike`, `Comment`,
`BuildRating`, `Report` (routes/controllers now live — see above). Every
Phase 1 model is now wired to a route.

**Phase 3 added no model** — product comparison reads existing
`Product.specifications`/`compatibilityData` directly; comparison state is
held client-side (see Phase 3 write-up above).

**Phase 4 added no model** — it wired up the two models Phase 1 already
defined for it.

**Phase 5 added no model** — it wired up the two models (`Coupon`,
`CouponUsage`) Phase 1 already defined for it. `Order` gained one
additive field, `couponCode`.

**Phase 6 added no model** — it wired up the five models (`CommunityBuild`,
`BuildLike`, `Comment`, `BuildRating`, `Report`) Phase 1 already defined
for it.

**Phase 7 added no model and no route** — frontend-only, consuming the
routes Phase 6 already exposed (see above).

**Phase 9 added no model** — `Order` gained two additive fields,
`statusHistory` and `estimatedDeliveryDate` (see Phase 9 write-up above).

**Wired up in Phase 10:** `Category` (new model, metadata-only — see Phase
10 write-up above). `Product` gained two additive fields, `isArchived` and
`archivedAt`.

## API routes currently present

- `/api/auth` — register, login, logout, me (get/patch), password
- `/api/products` — list/detail/search/filter, `/works-with`, `/:id/reviews`
  (list, mine, create, update, delete — Phase 2), `/compare?ids=` (public,
  2-4 same-category products — Phase 3). Listing/featured/search/related/
  works-with all exclude archived products (Phase 10); `/:id` still
  resolves for one, flagged `isArchived: true`.
- `/api/categories` — list with counts and each category's admin-managed
  display metadata (label/description/image/displayOrder), sorted by
  displayOrder, storefront-hidden categories excluded (Phase 10 — was
  "derived from hardcoded enum" only, no metadata, before this phase)
- `/api/cart` — get, add item, add custom build, update qty, remove, clear.
  Adding an archived product to either is rejected (Phase 10).
- `/api/wishlist` — list, `/status`, add, remove, `/:productId/move-to-cart`
  (Phase 2, login required)
- `/api/addresses` — list, create, update, `/:id/default`, delete (Phase 4,
  login required)
- `/api/notifications` — list (paginated, unread count attached),
  `/unread-count`, `/:id/read`, `/read-all` (Phase 4, login required)
- `/api/coupons` — `/validate` (preview a code against the caller's live
  cart — Phase 5, login required)
- `/api/orders` — create (checkout, accepts an optional `couponCode`),
  list mine, detail, `/:id/cancel` (customer self-service cancellation,
  Pending/Confirmed only — Phase 9), eSewa success/failure callbacks
  (public, HMAC-verified), eSewa status check
- `/api/builds` — check compatibility (public), save, list mine, detail,
  update, delete
- `/api/recommendations` — similar/frequently-bought-together/build-completion/for-you
- `/api/admin/products` — CRUD, image upload, stock, `?status=` filter,
  `/:id/restore` (Phase 10 — `DELETE` now archives instead of hard-deleting)
- `/api/admin/orders` — list/detail/status (now writes `statusHistory`) /
  payment-status (now transition-guarded — Phase 9), `/sweep-esewa`
  (manual on-demand trigger for the Phase 9 stale-Pending eSewa sweep)
- `/api/admin/users` — list/detail/role/delete
- `/api/admin/analytics` — revenue (now includes `totalDiscountGiven`),
  top sellers, category revenue, etc.
- `/api/admin/reviews` — list/filter, hide, unhide (Phase 2)
- `/api/admin/coupons` — list/filter, get-one, create, update, `/toggle`,
  delete (Phase 5, delete blocked once a coupon has real usage)
- `/api/admin/categories` (Phase 10) — list (every fixed category,
  including hidden ones, with total counts), `PUT /:slug` (display
  metadata only — the 8 slugs themselves aren't creatable/deletable)
- `/api/community` (Phase 6) — `/builds` (list feed, `optionalAuth`),
  `/builds/mine` (login required), create (`POST /builds`, login
  required), `/builds/:id` (detail, `optionalAuth`; update/delete, owner
  only), `/builds/:id/like` (toggle, login required), `/builds/:id/comments`
  (list, `optionalAuth`; create/update/delete, login required — update/
  delete own only), `/builds/:id/rating(s)` (list, `optionalAuth`;
  create/delete own, login required), `/builds/:id/copy` (`optionalAuth` —
  guests can copy too, same as the builder — Phase 8), `/reports` (create,
  login required)
- `/api/admin/community` (Phase 6) — `/builds` (list/filter, hide, unhide),
  `/comments` (list/filter, hide, unhide), `/reports` (list/filter,
  `/resolve`)

## Environment variables required

From `backend/.env.example`:
`PORT`, `NODE_ENV`, `MONGODB_URI` (required), `JWT_SECRET` (required),
`JWT_EXPIRES_IN`, `GEMINI_API_KEY` (optional), `ESEWA_MERCHANT_ID`,
`ESEWA_SECRET_KEY`, `ESEWA_TEST_MODE`, `BACKEND_URL` (must be publicly
reachable for real eSewa callback testing), `EMAIL_HOST`, `EMAIL_PORT`,
`EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` (all optional — email
features silently disable without them), `SHIPPING_PARTNER_EMAIL`,
`SHIPPING_PARTNER_PHONE`, `SHIPPING_PARTNER_WHATSAPP` (optional),
`ESEWA_SWEEP_INTERVAL_MINUTES`, `ESEWA_SWEEP_RECHECK_AFTER_MINUTES`,
`ESEWA_SWEEP_EXPIRE_AFTER_HOURS` (all optional, Phase 9 — sane defaults
apply if unset; set the interval to `0` to disable the scheduled sweep),
`CLIENT_URL`.

From `frontend/.env.example`: `VITE_API_URL` (defaults to
`http://localhost:5000/api`).

No new env vars were introduced in Phase 0.

## Known bugs/issues (verified, not yet fixed — targeted phases noted)

- ~~Guest-cart merge on login concatenates line items instead of summing
  quantities for the same product already in both carts → duplicate line
  items.~~ **Fixed in Phase 9** — see `utils/mergeCartItems.js`.
- ~~Stock check-then-decrement at checkout isn't a single atomic conditional
  update — a narrow race window exists between two simultaneous checkouts
  for the last unit(s) of a product, despite running inside a
  transaction.~~ **Fixed in Phase 9** — the decrement is now a conditional
  `{ stock: { $gte: qty } }` update inside the transaction.
- ~~`adminOrderController.updatePaymentStatus` has no transition guard (can
  set a fulfilled order back to `Pending`), unlike `updateOrderStatus`
  which blocks invalid reversals.~~ **Fixed in Phase 9** — see
  `utils/paymentTransitions.js`.
- ~~Product deletion is a hard delete (`deleteOne()`), not a soft
  archive/status flag. Historical orders are safe (item snapshots), but
  product pages/links 404 after deletion.~~ **Fixed in Phase 10** — see
  `utils/productArchive.js`/`Product.isArchived`. An archived product's
  detail page now resolves (marked "no longer available") instead of
  404ing; browsing surfaces exclude it; cart/checkout reject it. Not yet
  extended to `compareController`/`recommendationService` — see the Phase
  10 write-up's own follow-up note.
- ~~Categories are a hardcoded 8-value enum, not a manageable
  collection.~~ **Partially addressed in Phase 10** — see the new
  `Category` model/`/api/admin/categories`. The *set* of 8 categories is
  still fixed on purpose (see the Phase 10 write-up's design note on why);
  what's now manageable is each one's display metadata.
- ~~No scheduled sweep for eSewa orders stuck `Pending` indefinitely if the
  customer never returns and no callback arrives.~~ **Fixed in Phase 9** —
  see `services/esewaSweepService.js`.
- ~~`AdminCoupons`'s create/edit form only exposes category-level
  restriction (`applicableCategories`), not product-level
  (`applicableProducts`).~~ **Fixed in Phase 10** — see
  `ProductPickerField.jsx`.
- ~~`AdminOrders`'s `OrderDetailModal` payment-status dropdown lists every
  enum value rather than only the ones `isValidPaymentTransition` would
  actually accept.~~ **Fixed in Phase 10** — see
  `frontend/src/utils/paymentTransitions.js`.
- `AdminCategories`'s image field is a plain URL/path text input, not a
  multer-backed upload like `ProductFormModal`'s image field — there was
  no obvious existing upload target for a category-level image (Product's
  upload route is per-product-id). A candidate for **Phase 11** if
  category images end up used anywhere customer-facing.

## Tests performed (Phase 2)

- `node --check` on every backend `.js` file — zero syntax errors.
- Confirmed locally (2026-09-02, real `npm install && npm test` /
  `npm install && npm run build` — not the sandbox's manual Node checks):
  - **Backend**: `jest --runInBand` — **8 of 9 suites pass**, including
    both new Phase 2 suites (`ratingService.test.js`,
    `reviewValidator.test.js`) and all 5 pre-existing pure-logic suites
    (`recommendation`, `compatibility`, `esewa`, `apiFeatures`,
    `inventory`, `productValidator`). 66/72 individual tests pass.
  - `tests/auth.test.js` fails — but this is **pre-existing, not a Phase 2
    regression**: it's the one suite in the repo that needs a live
    database (`beforeAll` throws `Set MONGODB_URI (a test database) before
    running tests.` when the env var isn't set), exactly as the README's
    testing section already documents. Re-run with a test
    `MONGODB_URI` set (e.g. `MONGODB_URI=<test-db-uri> npm test`) to get a
    clean 9/9. Nothing added in Phase 2 touched auth.
  - **Frontend**: `vite build` succeeds — 144 modules transformed, no
    errors, output at `dist/`.
  - `npm audit` on both flags 4 pre-existing vulnerabilities (3 moderate,
    1 high) in transitive dependencies (`esbuild`/`vite`'s dev-server
    request-forwarding advisory, `react-router` open-redirect/SSR-hydration
    advisories, plus backend's `multer`/`glob`/`inflight` deprecation
    warnings) — none introduced by Phase 2, all present in the Phase 0
    `package-lock.json` already. `npm audit fix --force` for either would
    bump major versions (Vite 8, React Router 7.18) and isn't something to
    do casually mid-build; flagging for a dedicated dependency-upgrade pass
    rather than folding it into a feature phase.
- `ratingService.recalculateProductRating` takes `Review`/`Product` as
  parameters instead of `require()`-ing them, so `computeRatingAggregate`
  stays loadable (and testable) with zero mongoose dependency.

## Tests performed (Phase 3)

This sandbox had no network access this round, so unlike Phase 2 this
wasn't confirmed with a real `npm install && npm test`/`npm run build` —
only what's verifiable offline:

- `node --check` on every backend `.js` file (including the three new
  Phase 3 files) — zero syntax errors.
- No bundler/babel available offline either, so the frontend was checked
  with the `esbuild` binary bundled inside the sandbox's globally-installed
  `tsx` package (not a project dependency): every new/modified `.jsx` file
  transforms with zero errors, and `main.jsx` bundles the *entire* frontend
  module graph (all imports resolve, no syntax errors anywhere in the
  chain) down to a 279kb bundle.
- `compareUtils.js`'s pure functions were exercised directly against the
  real `backend/seed/products.js` data (not mocks) in a throwaway Node
  script: comparing 3 real CPUs validates cleanly and produces the expected
  spec-key union (`socket, cores, threads, baseClock, boostClock, tdp,
  integratedGraphics`); mixing a CPU with a GPU correctly returns the
  same-category error.
- `getComparisonRows`/`formatSpecValue` (frontend) were exercised the same
  way against sample CPU specs: known fields come back ordered/labeled from
  `CATEGORY_SPEC_FIELDS`, an unmodeled field falls back to its raw key
  instead of disappearing, unit suffixes apply once, and a product missing
  a given field renders `—` instead of `undefined`.
- `tests/compareUtils.test.js` was written to the same convention as
  `ratingService.test.js`/`reviewValidator.test.js` (pure logic, no DB) but
  **not run under Jest itself** — no `node_modules` in this sandbox and no
  network to install them. Recommend an actual `npm install && npm test`
  pass before merging, same as Phase 2's own recommendation for
  `tests/auth.test.js`.
- Not exercised at all (needs a live Mongo instance + running dev server,
  neither available here): the actual `GET /api/products/compare` HTTP
  route end-to-end, the `CompareContext` localStorage round-trip in a real
  browser, and the `CompareBar`/`Compare` page rendering.

## Tests performed (Phase 4)

Same offline-sandbox limitation as Phase 3 — no network access this round,
so verified with what's available locally rather than a real
`npm install && npm test`/`npm run build`:

- `node --check` on every backend `.js` file (all of them, not just the new
  ones) — zero syntax errors.
- `notificationService.js`'s pure builder functions and the
  `writeNotification` DB wrapper were exercised directly in a throwaway
  Node script against real sample orders (COD/esewa/card, Paid/Pending) and
  a fake `Notification.create` (both a resolving and a rejecting one):
  every builder's `type`/`link`/`data` shape matched expectations, the NPR
  amounts formatted via the same `en-IN` locale convention `emailService.
  formatNpr` already uses (e.g. `NPR 1,25,000`), `writeNotification`
  returned `null` without calling `create()` when there was no user id,
  and swallowed a rejected `create()` and returned `null` rather than
  throwing.
- `tests/notificationService.test.js` was written to the same convention as
  `tests/ratingService.test.js`/`tests/compareUtils.test.js` (pure logic,
  no DB, plus a couple of cases against a hand-rolled fake `Notification`
  model for `writeNotification`) but **not run under Jest itself** — no
  `node_modules` in this sandbox and no network to install them. Recommend
  an actual `npm install && npm test` pass before merging, same
  recommendation Phase 2/3 already made for their own suites.
- The frontend was checked with the `esbuild` binary bundled inside the
  sandbox's globally-installed `tsx` package (not a project dependency),
  same technique as Phase 3: `main.jsx` bundles the *entire* frontend
  module graph (all imports resolve, including every new/modified Phase 4
  file, no syntax errors anywhere in the chain) down to a 264kb bundle with
  `react`/`react-dom`/`react-router-dom`/`axios` marked external.
- Not exercised at all (needs a live Mongo instance + running dev server,
  neither available here): the actual `/api/addresses` and
  `/api/notifications` HTTP routes end-to-end, the `Address` model's
  `post('save')` default-unsetting hook firing against real documents, the
  `Checkout.jsx` saved-address picker rendering and pre-filling a real
  order, and the `NotificationBell` dropdown/poll cycle in a real browser.

## Tests performed (Phase 5)

Same offline-sandbox limitation as Phases 2-4 — no network access this
round, so verified with what's available locally rather than a real
`npm install && npm test`/`npm run build`:

- `node --check` on every backend `.js` file (all of them, not just the
  new ones) — zero syntax errors.
- `couponService.js`'s pure functions (`getEligibleSubtotal`,
  `computeDiscountAmount`, `evaluateCoupon`, `collectReferencedProductIds`
  — this module has zero `require()`s at all, so it's loadable with no
  mongoose dependency whatsoever) were exercised directly in a throwaway
  Node script: an unrestricted percentage coupon against a two-item cart
  computed the expected eligible subtotal and discount; a
  category-restricted fixed coupon correctly narrowed the eligible
  subtotal to only the matching item and returned the fixed amount
  unchanged; `collectReferencedProductIds` deduplicated ids referenced by
  both a standalone item and a custom build's components.
- `tests/couponService.test.js` was written to the same convention as
  `tests/ratingService.test.js`/`tests/compareUtils.test.js`/
  `tests/notificationService.test.js` (pure logic, no DB) but **not run
  under Jest itself** — no `node_modules` in this sandbox and no network
  to install them. Recommend an actual `npm install && npm test` pass
  before merging, same recommendation every prior phase's own suite has
  made.
- The frontend was checked with the `esbuild` binary bundled inside the
  sandbox's globally-installed `tsx` package (not a project dependency),
  same technique as Phases 3/4: `main.jsx` bundles the *entire* frontend
  module graph (all imports resolve, including every new/modified Phase 5
  file — `Checkout.jsx`, `App.jsx`, `AdminLayout.jsx`,
  `AdminDashboard.jsx`, `AdminCoupons.jsx`, `CouponFormModal.jsx` — no
  syntax errors anywhere in the chain) down to a ~282kb bundle with
  `react`/`react-dom`/`react-router-dom`/`axios` marked external.
- Not exercised at all (needs a live Mongo instance + running dev server,
  neither available here): the actual `/api/coupons/validate` and
  `/api/admin/coupons/*` HTTP routes end-to-end, the coupon-redemption
  write happening correctly inside the same Mongo transaction as order
  creation/stock decrement (including the rollback case — a mid-
  transaction failure should leave neither the order nor the
  `CouponUsage` row behind), the `Coupon` schema's own `pre('validate')`
  bounds/date-ordering checks firing against a real save, and the
  `Checkout.jsx` coupon apply/remove flow and `AdminCoupons.jsx` table
  rendering in a real browser.

## Tests performed (Phase 6)

Same offline-sandbox limitation as every prior phase — no network access
this round, so verified with what's available locally rather than a real
`npm install && npm test`/`npm run build`:

- `node --check` on every backend `.js` file (all of them, not just the
  new ones) — zero syntax errors.
- Built a throwaway minimal fake `mongoose` module (no `node_modules` in
  this sandbox and no network to install the real one) purely to let the
  new controllers `require()` successfully, then exercised the pure/
  DB-adjacent logic directly against it — deleted afterward, not part of
  the delivered project:
  - `canView` against a 10-case matrix of owner/admin/guest ×
    public/unlisted/private × visible/hidden — all 10 as expected
    (private blocks everyone but the owner and an admin; hidden blocks
    everyone but the owner and an admin; unlisted behaves like public for
    direct access).
  - `toggleLike` end-to-end against a fake `CommunityBuild`/`BuildLike`:
    first call (not yet liked) created the like row and incremented
    `likesCount` 3→4; second call (already liked) deleted it and
    decremented 4→3, with `liked: true`/`false` in the response matching
    each transition.
  - `ratingService.recalculateBuildRating` against three fake ratings
    (5, 3, 4) correctly wrote back `averageRating: 4, ratingCount: 3`.
  - `publishBuild`'s guard clauses (missing `sourceBuildId`, source build
    not found, source build owned by someone else, an empty build) each
    rejected with the right status/message; then a real
    `compatibilityService.checkBuildCompatibility` run with a
    socket-mismatched CPU/motherboard pair correctly blocked publish
    (400, compatibility error), and a matched pair correctly published —
    `totalPrice` summed right (300+200=500), tags lowercased/trimmed,
    `compatibilityStatus: 'compatible'` snapshotted.
- `tests/communityValidator.test.js` (28 cases across all four
  validators) was run against the real validator file through a tiny
  hand-rolled `describe`/`it`/`expect` shim (same fake-mongoose trick, no
  real Jest available) — 28/28 passed. Also written to run under real
  Jest once dependencies are installed, same convention as every other
  `tests/*.test.js` in this project.
- Not exercised at all (needs a live Mongo instance + running dev server,
  neither available here): the actual `/api/community/*` and
  `/api/admin/community/*` HTTP routes end-to-end, the `$text` search
  index firing against real documents, a real duplicate-like race on the
  `BuildLike` unique index, and the cascade-delete on
  `DELETE /api/community/builds/:id` against real referencing rows.

## Tests performed (Phase 7)

Frontend-only phase, no live backend/Mongo/browser available in this
sandbox — same constraint every prior phase's frontend work noted:

- Every new API call (`community/builds`, `community/builds/mine`,
  `community/builds/:id`, `.../like`, `.../comments`, `.../rating(s)`,
  `community/reports`, `admin/community/*`) was checked by hand against
  the actual Phase 6 controller/route/validator/model source (not just
  the Phase 6 write-up above) for exact param names, response shapes, and
  status-code/error-message conventions before any UI was written against
  them.
- The full frontend module graph was bundled with the `esbuild` binary
  bundled inside the sandbox's globally-installed `tsx` package (not a
  project dependency), same technique every prior phase's frontend work
  has used: `main.jsx` in, `react`/`react-dom`/`react-router-dom`/`axios`
  marked external — resolves cleanly (all new/modified Phase 7 files
  included, no syntax or import errors anywhere in the chain) down to a
  ~346kb bundle, the same handful of pre-existing `import.meta` warnings
  (harmless under Vite's real ESM build, only shows up under esbuild's
  IIFE mode) every prior phase's bundle check has also shown.
- Not exercised at all (needs a live Mongo instance + running dev server
  + real browser, none available here): the actual pages rendering
  against real data, the like/comment/rating optimistic-update-then-
  reconcile paths against real network latency/failures, the admin
  moderation tabs against a real reports queue, and the `esbuild` check
  above says nothing about runtime behavior — only that the code parses,
  every import resolves, and no JSX is malformed. Recommend an actual
  `npm install && npm run dev` pass (frontend) alongside a running
  backend + MongoDB before merging.

## Tests performed (Phase 8)

Same offline-sandbox limitation as every prior phase — no network access
this round, so verified with what's available locally rather than a real
`npm install && npm test`/`npm run build`:

- `node --check` on every backend `.js` file (all of them, not just the
  new/modified ones) — zero syntax errors.
- `compatibilityService.js` has zero `require()`s (pure JS, no mongoose
  dependency), so `copyBuild`'s recompute-at-copy behavior was exercised
  directly against the real module in a throwaway script: a build whose
  CPU/motherboard sockets were made to mismatch (simulating drift between
  publish time and copy time) correctly returned `status: 'error'`,
  `errors: ['CPU socket (AM5) does not match motherboard socket (AM4).']`,
  `orderable: false`; a fully-populated, matched build correctly returned
  `status: 'compatible'`, `orderable: true` — exactly the branch
  `copyBuild` and the frontend's result panel both key off of.
- The frontend was checked with the `esbuild` binary bundled inside the
  sandbox's globally-installed `tsx` package (not a project dependency),
  same technique every prior phase's frontend work has used: `main.jsx` in,
  `react`/`react-dom`/`react-router-dom`/`axios` marked external — resolves
  cleanly (both modified Phase 8 files included, no syntax or import
  errors anywhere in the chain) down to a ~350kb bundle, the same handful
  of pre-existing `import.meta` warnings (harmless under Vite's real ESM
  build, only shows up under esbuild's IIFE mode) every prior phase's
  bundle check has also shown.
- Not exercised at all (needs a live Mongo instance + running dev server +
  real browser, none available here): the actual
  `POST /api/community/builds/:id/copy` HTTP route end-to-end (including
  the atomic `copiesCount` increment against a real document and the
  owner-doesn't-inflate-their-own-count guard), the `CommunityBuildDetail`
  copy button's result panel rendering against real network latency, the
  `Build.jsx` router-state hand-off surviving a real browser navigation,
  and `CartContext.addCustomBuild`'s guest-cart path from the new "Add
  straight to cart" button. Recommend an actual
  `npm install && npm run dev` pass (frontend) alongside a running backend
  + MongoDB before merging, same recommendation every prior phase has made.

## Tests performed (Phase 9)

Same offline-sandbox limitation as every prior phase — no network access
this round (confirmed: `npm install` fails with `403 Forbidden` against
the real npm registry, the same "no network egress" constraint every prior
phase's own testing section has already hit), so verified with what's
available locally rather than a real `npm install && npm test`/
`npm run build`:

- `node --check` on every backend `.js` file (all of them, not just the
  new/modified ones) — zero syntax errors, including the four new files
  (`utils/mergeCartItems.js`, `utils/paymentTransitions.js`,
  `utils/delivery.js`, `services/esewaSweepService.js`,
  `services/esewaSweepRunner.js`) and the modified
  `orderController.js`/`adminOrderController.js`/`authController.js`/
  `models/Order.js`.
- All four new Jest suites (`tests/mergeCartItems.test.js`,
  `tests/paymentTransitions.test.js`, `tests/delivery.test.js`,
  `tests/esewaSweepService.test.js` — 24 test cases total) were run
  against the real, unmodified source files through a small hand-rolled
  `describe`/`it`/`expect`/`jest.fn` shim (no real Jest available in this
  sandbox), same technique Phase 6's own testing note used for its
  `communityValidator.test.js` suite — **24/24 passed**, including the
  `esewaSweepService` suite's fake-model exercises (finalize-as-paid,
  expire-and-restock, leave-still-pending, and a rejected status-check
  call correctly falling through to age-based expiry rather than
  crashing the sweep). Written to also run under real Jest once
  dependencies are installed, same convention as every other
  `tests/*.test.js` in this project.
- The atomic conditional stock decrement in `orderController.createOrder`
  (`{ _id, stock: { $gte: qty } }` as the update filter) was reviewed
  against MongoDB's documented semantics for conditional updates inside a
  multi-document transaction rather than exercised against a live replica
  set — this sandbox has no MongoDB instance to actually race two
  simultaneous checkouts against. Recommend a real concurrency test
  (two parallel `POST /api/orders` requests against a product with
  `stock: 1`) against a running dev server + MongoDB before merging.
- The frontend was checked with the `esbuild` binary bundled inside the
  sandbox's globally-installed `tsx` package (not a project dependency),
  same technique every prior phase's frontend work has used: `main.jsx` in,
  `react`/`react-dom`/`react-router-dom`/`axios` marked external — resolves
  cleanly (the new `DeliveryTimeline.jsx` plus modified
  `OrderSummaryCard.jsx`/`OrderDetail.jsx` all included, no syntax or
  import errors anywhere in the chain) down to a ~425kb bundle, the same
  handful of pre-existing `import.meta` warnings (harmless under Vite's
  real ESM build, only shows up under esbuild's IIFE mode) every prior
  phase's bundle check has also shown.
- Not exercised at all (needs a live Mongo instance + running dev server +
  real browser, none available here): the actual
  `PATCH /api/orders/:id/cancel` and `POST /api/admin/orders/sweep-esewa`
  HTTP routes end-to-end, the `setInterval`-driven sweep actually firing
  in a running process, the guest-cart-merge fix against two real carts in
  MongoDB, the `DeliveryTimeline` rendering against a real order's
  `statusHistory` in a browser, and the `OrderDetailModal`'s payment-status
  save surfacing a 400 from the new transition guard through a real
  network round-trip. Recommend an actual `npm install && npm run dev`
  pass (frontend) alongside a running backend + MongoDB before merging,
  same recommendation every prior phase has made.

## Tests performed (Phase 10)

Same offline-sandbox limitation as every prior phase — no network access
this round, so verified with what's available locally rather than a real
`npm install && npm test`/`npm run build`:

- `node --check` on every backend `.js` file (all of them, not just the
  new/modified ones) — zero syntax errors, including the four new files
  (`utils/productArchive.js`, `utils/categoryUtils.js`,
  `utils/categoryDefaults.js`, `models/Category.js`,
  `controllers/adminCategoryController.js`, `routes/adminCategoryRoutes.js`)
  and the modified `models/Product.js`/`controllers/adminProductController.js`/
  `controllers/productController.js`/`controllers/cartController.js`/
  `app.js`/`server.js`.
- Both new Jest suites (`tests/productArchive.test.js` — 6 cases,
  `tests/categoryUtils.test.js` — 6 cases) were run against the real,
  unmodified source files through the same hand-rolled
  `describe`/`it`/`expect` shim Phase 6/9's own testing notes used (no
  real Jest available in this sandbox) — **12/12 passed**, including
  `mergeCategoryData`'s displayOrder-then-label sort, the `activeOnly`
  filter, and a check that it never mutates its inputs. Written to also
  run under real Jest once dependencies are installed.
- `mergeCategoryData` and `buildAdminArchiveFilter` have zero `require()`s
  (pure JS, no mongoose dependency) — both were also exercised directly in
  a throwaway Node script against the real modules (not just through the
  test shim) with the same results.
- The frontend was checked with the `esbuild` binary bundled inside the
  sandbox's globally-installed `tsx` package (not a project dependency),
  same technique every prior phase's frontend work has used: `main.jsx`
  in, `react`/`react-dom`/`react-router-dom`/`axios` marked external —
  resolves cleanly (every new/modified Phase 10 file included —
  `ProductPickerField.jsx`, `CouponFormModal.jsx`, `AdminProducts.jsx`,
  `AdminCategories.jsx`, `AdminLayout.jsx`, `App.jsx`,
  `OrderDetailModal.jsx`, `utils/paymentTransitions.js`,
  `ProductDetail.jsx` — no syntax or import errors anywhere in the chain)
  down to a ~370kb bundle, the same handful of pre-existing `import.meta`
  warnings (harmless under Vite's real ESM build, only shows up under
  esbuild's IIFE mode) every prior phase's bundle check has also shown.
- Not exercised at all (needs a live Mongo instance + running dev server +
  real browser, none available here): the actual
  `PATCH /api/admin/products/:id/restore`, `/api/admin/categories/*`, and
  archived-product-rejection paths in `cartController` end-to-end;
  `ensureDefaultCategories` actually running against a real (empty or
  pre-existing) `categories` collection at boot; the
  `AdminCategories`/`AdminProducts` pages and `ProductPickerField`'s debounced
  search rendering against real network latency; and the
  `OrderDetailModal` payment-status dropdown's option list actually
  narrowing in a real browser. Recommend an actual
  `npm install && npm run dev` pass (frontend) alongside a running backend
  + MongoDB before merging, same recommendation every prior phase has made.

## Next phase to implement

None. Phase 11 has been completed (see its write-up above) and it was the
last phase on `ROADMAP.md`. See Phase 11's "Still open" note for the
realistic remaining work — a real `npm install && npm test`/`npm run dev`
pass against a live MongoDB, and a deeper security review — rather than a
new numbered phase.

## Tests performed (Phase 11)

Same offline-sandbox limitation as every prior phase — no network access
this round (`npm install` still 403s against the real npm registry), so
verified with what's available locally rather than a real
`npm install && npm test`/`npm run build`. Unlike Phase 10's own working
copy, this turn's working copy is the **full** Phase 9 repo snapshot with
the Phase 10 diff overlaid on top, so — for the first time since Phase 2 —
`node --check` and the frontend bundle check below cover literally every
file in the project, not just a given phase's own diff.

- `node --check` on every backend `.js` file in the full repo — zero
  syntax errors, including all of this phase's new/modified files
  (`utils/imageUpload.js`, `middleware/upload.js`,
  `middleware/rateLimiters.js`, `app.js`,
  `controllers/adminCategoryController.js`,
  `controllers/compareController.js`,
  `controllers/recommendationController.js`,
  `routes/adminCategoryRoutes.js`) and every file carried over unmodified.
- `tests/imageUpload.test.js` (6 cases: mime allow/reject list including
  `undefined`, the `fileFilter` callback's accept/reject paths, the byte-
  limit constant) was run against the real, unmodified
  `utils/imageUpload.js` via a plain Node script calling the exported
  functions directly (this module has zero `require()`s beyond none at
  all — no multer, no mongoose — so no shim was even needed) — **6/6
  passed**. Also written to run under real Jest, same convention as every
  other `tests/*.test.js` in this project.
- `tests/archivedExclusion.test.js` (5 cases, a static regression guard —
  see its own header comment for why a source-level check was chosen over
  another fake-mongoose shim for just two files) was run against the real,
  unmodified `compareController.js`/`recommendationController.js` through
  a small hand-rolled `describe`/`it`/`expect` shim (no real Jest available
  in this sandbox), same technique Phase 6/9/10's own testing notes used —
  **5/5 passed**.
- The frontend was checked with the `esbuild` binary bundled inside the
  sandbox's globally-installed `tsx` package (not a project dependency),
  same technique every prior phase's frontend work has used: `main.jsx` in,
  `react`/`react-dom`/`react-router-dom`/`axios` marked external — resolves
  cleanly (the entire frontend module graph, not just this phase's own
  `AdminCategories.jsx` change, no syntax or import errors anywhere in the
  chain) down to a ~371kb bundle, the same handful of pre-existing
  `import.meta` warnings (harmless under Vite's real ESM build, only shows
  up under esbuild's IIFE mode) every prior phase's bundle check has also
  shown.
- Not exercised at all (needs a live Mongo instance + running dev server +
  real browser, none available here): the actual
  `POST /api/admin/categories/:slug/image` HTTP route end-to-end (the
  upsert-on-first-upload path, the on-disk file actually landing in
  `backend/uploads/`); `compareProducts`/the recommendation endpoints
  actually excluding a real archived document from a real query result
  (the regression guard above confirms the *query shape* changed, not the
  live database behavior); the new `apiLimiter`/body-size limit/
  `trust proxy` gating under real traffic and a real reverse proxy; and
  `AdminCategories.jsx`'s new file input against real network latency.
  Recommend an actual `npm install && npm run dev` pass (frontend)
  alongside a running backend + MongoDB before merging, same
  recommendation every prior phase has made — and, for this phase
  specifically, a real concurrent-request test against `apiLimiter`'s
  600/15min ceiling to confirm it doesn't false-positive on normal
  multi-tab browsing.

