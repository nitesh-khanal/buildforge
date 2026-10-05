# BuildForge

A full-stack e-commerce platform for buying PC parts and building
compatibility-checked custom PCs, priced in NPR for the Nepali market.
Express/MongoDB backend, React (Vite + Tailwind) frontend, eSewa sandbox
payments, email + WhatsApp order notifications, and an admin dashboard.

This was built in 8 incremental phases so each step stayed small enough to
generate reliably — see `ROADMAP.md` for the phase-by-phase build log if
you're curious how it came together. This file is the project as it stands
today.

## Features
- **Catalog** — 8 component categories (CPU, GPU, motherboard, RAM,
  storage, PSU, case, CPU cooler), search/filter/sort, category-specific
  spec sheets.
- **Guest-friendly cart** — add to cart with no account via a session-id
  header; merges into your account cart automatically on login/register.
- **PC Builder** — pick a part per slot, get live compatibility checking
  (socket, RAM type, form factor, PSU wattage, cooler clearance, etc.),
  wattage estimate vs. recommended PSU, and suggested picks for empty
  slots. Save/load builds when logged in. An invalid build can never reach
  checkout.
- **Recommendations** — similar products, frequently-bought-together,
  build-completion suggestions, and personalized for-you picks based on
  order history. An optional Gemini-powered natural-language build summary
  layers on top when configured (silently absent otherwise).
- **Checkout & payments** — cash on delivery, a dummy card flow for demos,
  and a real eSewa ePay v2 **sandbox** integration (signed redirect, HMAC
  callback verification, independent status cross-check, stock release on
  a failed/abandoned payment).
- **Notifications** — order-confirmation and payment-failed emails, plus a
  shipping-partner handoff (email + click-to-chat WhatsApp link). Both
  email and the AI layer are off by default and fail silently if
  unconfigured — nothing about checkout depends on them.
- **Admin dashboard** — revenue/order analytics with a sales trend chart,
  top products, category breakdown; full product CRUD with image upload;
  order status/payment management; customer lookup and role management.
- **Auth** — JWT (httpOnly cookie + bearer token, either works), bcrypt
  passwords, `customer`/`admin` roles.

## Project structure
```
backend/     Express API, MongoDB models, services, Jest tests
frontend/    React + Vite + Tailwind SPA
ROADMAP.md   Phase-by-phase build log
```

## Launch preparation

See [LAUNCH.md](LAUNCH.md) for HTTPS deployment, production settings, SEO, optional analytics, backups and launch checks. See [CATALOG.md](CATALOG.md) for supplier data and photo sourcing. The admin catalog import screen includes templates, manufacturer references and photo uploads. Production orders stay closed until you configure actual business details and import verified inventory.

## Setup

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
```
Edit `.env`:
- `MONGODB_URI` — a MongoDB connection string (a free cluster at
  https://www.mongodb.com/atlas works fine).
- `JWT_SECRET` — any long random string.
- Everything else (`GEMINI_API_KEY`, `EMAIL_*`, `ESEWA_*`,
  `SHIPPING_PARTNER_*`) is optional — those features quietly disable
  themselves if left blank. eSewa's sandbox itself needs *no* config to
  work against their published UAT test merchant.

```bash
npm run seed   # ~40 realistic NPR-priced products + dev accounts
npm run dev    # http://localhost:5000
```

#### Local MongoDB for checkout

Checkout uses transactions, so local MongoDB must run as a replica set.
For the configured `buildforgeLocal` development database, run this from
the project root in a separate terminal and keep it running:

```bash
mkdir -p .local/mongo
mongod --dbpath "$PWD/.local/mongo" --port 27018 --replSet buildforgeLocal --bind_ip 127.0.0.1 --logpath "$PWD/.local/mongo/mongod.log"
```

The replica set on this machine is already initialized. Its data lives in
`.local/mongo`; restarting it with the same directory preserves the data.
The backend connection in `backend/.env` is:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27018/buildforge_local_dev?replicaSet=buildforgeLocal
```

On a new machine, initialize the set once using `mongosh` connected to
`mongodb://localhost:27018/?directConnection=true`:

```javascript
rs.initiate({ _id: 'buildforgeLocal', members: [{ _id: 0, host: 'localhost:27018' }] })
```

Dev accounts created by the seed script (change before production):
- `admin@buildforge.com` / `ChangeMe123!` (admin)
- `customer@buildforge.com` / `ChangeMe123!` (customer)

Run the test suite (needs `MONGODB_URI` pointed at a **test** database —
some suites clear collections):
```bash
npm test
```

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL defaults to http://localhost:5000/api
npm run dev            # http://localhost:5173
```

Make sure the backend's `CLIENT_URL` matches the frontend's dev URL
(`http://localhost:5173` is the default in `backend/.env.example`) so CORS
allows it.

Then open `http://localhost:5173`, browse as a guest, or log in with the
seeded admin account to see `/admin`.

## Testing eSewa
The backend talks to eSewa's UAT sandbox using their published test
merchant (`EPAYTEST`) with zero configuration. eSewa needs to redirect the
customer's browser back to `BACKEND_URL`, so for local testing that has to
be a publicly reachable URL — use a tunnel (e.g. ngrok) pointed at
`localhost:5000` and set `BACKEND_URL` to the tunnel's URL.

## Architecture notes
- **Compatibility and recommendation logic each live in exactly one
  place** (`backend/services/compatibilityService.js` and
  `recommendationService.js`), reused across the builder API, the
  product-detail "works with" section, and cart validation — never
  duplicated per endpoint. Both are pure functions with no DB/network
  dependency, which is why they're covered by fast, isolated Jest suites
  rather than integration tests.
- **Revenue accounting is confirmed-payments-only** everywhere in
  analytics (`Paid`/`COD`, excluding `Pending`/`Failed`), and correctly
  attributes sales for products bought both standalone and as components
  inside a saved custom build.
- **Stock accounting is centralized** in `backend/utils/inventory.js` —
  the same restock logic runs whether an eSewa payment fails/expires after
  checkout already reserved stock, or an admin cancels an order.
- **The frontend never recomputes what the backend already decided** —
  compatibility status, order totals, stock status, and revenue numbers
  all come straight from API responses.

## What's not production-ready as-is
This is a demo/portfolio-scale build, not a hardened production deploy.
Before shipping for real:
- Move file uploads (`backend/uploads/`) to object storage (S3, etc.) —
  local disk storage doesn't survive a redeploy or scale past one instance.
- Add request logging/monitoring and a real error-tracking service.
- Review rate limits (`backend/middleware/rateLimiters.js`) for your
  actual traffic patterns.
- Rotate the seeded dev account passwords and `JWT_SECRET` before any
  public deployment.
- Get real eSewa production credentials (`ESEWA_MERCHANT_ID` /
  `ESEWA_SECRET_KEY`) — the sandbox defaults only work against UAT.

### AI build advisor

The PC Builder includes an optional AI advice panel. Add `GEMINI_API_KEY` to the backend environment and restart the backend to enable it. `GEMINI_MODEL` can select another supported text model (default `gemini-3.8-flash`; see [Google's model list](https://ai.google.dev/gemini-api/docs/models)). Keep the key on the backend; never use a `VITE_` variable for it. Without a key, the panel explains that AI is inactive while compatibility checks and recommendations still work. Advice is requested only when the shopper clicks, and changing parts clears the previous advice. Catalog parts and compatibility are resolved on the server; generation times out after 15 seconds and is limited to five requests per minute per IP.

### Classroom payment and security labs

See [CLASS-DEMO.md](CLASS-DEMO.md) for local HTTPS checkout, SHA-256 hashing, RSA-PSS signatures, stored-value wallet transfers, a dummy card authorization/capture/decline flow, and Khalti-style and bank-transfer simulations. These labs are development-only simulations, with no real money or card credentials.

### Community build competitions

Admins create contests at `/admin/competitions`, choosing start/end times and
separate coupon rewards for first, second and third place. Dates in the form
use the browser's local time zone. A reward can be a percentage or fixed NPR
discount, with a minimum order, optional cap and 1–365 days of validity.
Dates and rewards are fixed after creation.

Customers visit `/competitions`, select an owned public community build,
and submit one entry per competition. The entry captures the build's title,
parts and price. Competition likes and ratings are separate from ordinary
community engagement. No self-voting is allowed. Likes decide placement;
earlier submission wins ties. Hidden, private or deleted community posts
are excluded. With fewer than three eligible entries, only the available
places receive rewards.

Entry and voting stop at the server's end time. A 30-second background sweep
awards the top three, with catch-up on server restart and competition/account
requests. The server must be running to settle results; an offline deadline
is processed after startup. Settlement, unique account-bound coupons and
in-app notifications commit together in one MongoDB transaction. Repeated
settlement cannot duplicate rewards. Coupons are shown at `/account/coupons`,
can be copied into checkout, and cannot be redeemed by another account.

Competition integration tests require an explicitly disposable database:

```bash
cd backend
COMPETITION_TEST_URI='mongodb://127.0.0.1:27018/buildforge_competition_test_local?replicaSet=buildforgeLocal' JWT_SECRET=local-test-secret npx jest --runInBand tests/competition.integration.test.js
```

This suite deletes only the named `buildforge_competition_test_*` database.
