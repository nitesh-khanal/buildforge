# Deploying BuildForge

The code is prepared for a single-domain storefront with an Express API, persistent uploads and automatic HTTPS. It is not a live store until you supply a domain, server, database and actual business/catalog information. No accounts, merchant subscriptions or hosting charges are created by this repository.

## What works without external accounts

- Local storefront and compatibility builder, demo catalog and demo payments in development.
- Admin catalog JSON preview/import, photo upload, source records, SKU-based updates and archived drafts.
- SEO metadata delivered in HTML for public/product pages, canonical URLs, Product JSON-LD, robots.txt and paginated XML sitemaps.
- Optional GA4 with opt-in preferences, public-page measurements and excluded private pages.
- Docker deployment definition, readiness checks, graceful shutdown, production configuration validation and GitHub CI.

## When a domain and server are available

Use one public Linux server with Docker Compose and a MongoDB replica set (Atlas is suitable). Checkout and catalog imports use transactions; a standalone MongoDB database is not sufficient.

1. Copy `deploy/production.env.example` to `deploy/production.env`. Set your domain, ACME contact email, public HTTPS origins, MongoDB URI and a unique random JWT secret. Keep this file outside version control.
2. Point the domain's A record at the server (and only publish an AAAA record if IPv6 is configured correctly). Open inbound TCP 80/443 and UDP 443. The API's port 5000 stays private inside Docker.
3. Start from the project root:
   ```sh
   docker compose up -d --build
   docker compose ps
   docker compose logs --tail=100 app caddy
   ```
4. Caddy obtains and renews certificates automatically and redirects HTTP to HTTPS. Its certificate state and uploaded photos use persistent volumes. Never run `docker compose down --volumes` on your live deployment unless you intend to delete these volumes.
5. Verify `https://YOUR-DOMAIN/api/ready` returns 200, the home page loads over HTTPS, product deep links work and uploads survive a restart.

Automatic HTTPS requires a working domain, public DNS and reachable challenge ports. Source: [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https).

## Create a real administrator

Demo seeding is blocked in production and must never be used on the live database. It clears existing products and recreates predictable test passwords in development.

Set `ADMIN_EMAIL`, `ADMIN_NAME` and a unique `ADMIN_PASSWORD` of at least 12 characters in a temporary environment file, then:

```sh
docker compose run --rm --env-from-file /path/to/admin.env app npm run admin:create
```

If your Compose version does not support `--env-from-file`, pass `-e ADMIN_EMAIL -e ADMIN_NAME -e ADMIN_PASSWORD` from an exported shell environment instead. The script creates a new account only; it never silently resets or promotes an existing account. Remove the temporary credentials after use. Remove or demote any old demo accounts through the admin interface before going live.

## Load parts with photos

See [CATALOG.md](CATALOG.md). The admin's **Catalog import** page includes an eight-category template and manufacturer reference links. It accepts batches of 1–100 rows, has a preview step and uploads JPEG/PNG/WEBP files (5 MB maximum). Photo signatures are checked and filenames are generated on the server.

Production discovery only shows catalog-verified products. Incomplete imports remain archived drafts. Updating product descriptions/specifications or replacing a photo clears verification, requiring another reviewed SKU import. Normal stock updates do not clear verification. Existing customer reviews are preserved.

## Open checkout when the business is ready

Leave `CHECKOUT_ENABLED=false` until your catalog, actual prices and quantities, shipping process, support address and policies are ready. Development demo card payments are never available in production. Cash on delivery is the default production method.

Set actual `SHIPPING_FLAT_RATE_NPR` and `FREE_SHIPPING_THRESHOLD_NPR` values. Fill `STORE_NAME`, `SUPPORT_EMAIL`, `STORE_ADDRESS`, `SHIPPING_POLICY` and `RETURN_POLICY`. Configure the SMTP settings and set `EMAIL_ENABLED=true`. Then set `CHECKOUT_ENABLED=true` and restart the app. Run:

```sh
docker compose exec app npm run launch:check
```

This checks configuration, MongoDB transaction support, a non-demo administrator and stocked verified products. It does not replace staging tests of order placement, cancellation/restocking, email delivery, fulfillment and backup restoration.

For real eSewa, obtain a merchant account, set `ESEWA_ENABLED=true`, `ESEWA_TEST_MODE=false` and production merchant credentials. Keep eSewa disabled until then; enabling it with sandbox credentials causes production startup validation to fail. There is no live credit-card gateway in this release. The unsigned failure redirect never changes payment or stock state; authenticated reconciliation and scheduled checks resolve gateway outcomes. Test payment callbacks, expiry and concurrent cancellation on staging before enabling eSewa.

## SEO activation

Set `SITE_INDEXABLE=true` only on your final domain after verifying content, then restart. Until then, public pages carry `noindex` and robots.txt discourages crawling. Account, checkout and admin pages remain noindex. Product offers are generated from verified prices/stock; review markup is included only when actual review counts exist.

Submit `/sitemap.xml` in Google Search Console once you have an account and domain verification. Check a real product URL in Google's Rich Results Test. Product content still renders through React; HTML contains server-generated metadata and structured data, not full server-rendered React page content. Validate rendered content with Search Console after launch. Share-card SVG is a fallback; social networks differ in SVG preview support, so supply a PNG/JPEG share card via `SOCIAL_IMAGE_URL` when available.

Sources: [Google product structured data](https://developers.google.com/search/docs/appearance/structured-data/product), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview).

## Optional analytics

Create a GA4 property later and set `GA_MEASUREMENT_ID=G-...` in the runtime environment. Until configured, no analytics script or prompt appears. Visitors must opt in before the tag loads and can change that choice in the footer/privacy page. Ads personalization is disabled. Measurements exclude search queries, account pages, checkout, order identifiers and admin pages.

**Turn off Enhanced Measurement in the GA4 web stream**, including browser-history pageviews, form interactions and site search. BuildForge sends its own sanitized pageviews; leaving automatic events on can duplicate counts or collect unwanted URLs. Use GA4 DebugView to verify one page_view per public navigation and no events on account/checkout/admin pages. Do not add another tag in Google Tag Manager at the same time.

Sources: [GA4 pageviews](https://developers.google.com/analytics/devguides/collection/ga4/views), [single-page applications](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications).

## Backups, updates and monitoring

Run `sh deploy/backup.sh` on the deployment server to back up MongoDB and uploaded photos. Store encrypted copies off the server and periodically test restoring them to a separate staging database/volume. The script needs Docker and uses the official MongoDB tools image. No backup schedule or external storage is activated automatically.

Monitor `/api/ready` with an uptime service once one is available. Logs omit query strings; do not enable verbose request-body logging in production. Keep database access limited to your server, enable backups in your database service, and keep production secrets out of GitHub.

For an update, record the current Git commit, pull the new version, run `docker compose up -d --build`, then verify health and a test purchase. To roll back, check out the previous commit and rebuild; keep database and upload volumes. This initial setup supports one app instance. Multi-instance rate limiting, shared object storage and durable background jobs require additional infrastructure.

## Validation

```sh
cd backend
npm ci
npm run test:unit
cd ../frontend
npm ci
npm run test:unit
npm run build
```

Use Node.js 22.12 or newer (the Docker image and CI use Node 22). The database-free suite includes mocked HTTP storefront tests. Database integration tests require a separate test MongoDB replica set (its name must include a separate `test` marker) and are excluded by `test:unit`. Run `npm run test:integration` with that test database. GitHub CI provisions a disposable local MongoDB replica set, tests login and transactional catalog imports, audits dependencies and builds the Docker image. Local checks cannot issue a certificate or validate real payment/email accounts until those resources exist.

### Khalti and bank transfer checkout

The actual checkout supports Khalti and manual bank transfer. In development, Khalti uses a clearly labeled local test page if `KHALTI_SECRET_KEY` is unset; this creates a development order but makes no external charge. To test Khalti's hosted sandbox, create a sandbox merchant account, set `KHALTI_SECRET_KEY` in the backend `.env`, keep `KHALTI_TEST_MODE=true`, and use an HTTPS callback URL reachable by Khalti. Khalti's [web checkout guide](https://docs.khalti.com/khalti-epayment/) documents its server-side initiation, `pidx`, redirect and lookup. The app marks an order Paid only after the server looks up the stored `pidx` and matches the amount and completed status. Production requires `KHALTI_ENABLED=true`, a production merchant key and `KHALTI_TEST_MODE=false`.

Bank transfer creates a Pending order and shows the order ID as its payment reference. In development the displayed account is explicitly fictional. Production requires `BANK_TRANSFER_ENABLED=true` plus `BANK_NAME`, `BANK_ACCOUNT_NAME`, and `BANK_ACCOUNT_NUMBER`. Staff must independently verify the actual deposit, then mark the order Paid in the admin order view. Never mark an order Paid merely because a customer supplies a transfer screenshot or reference. The store sends confirmation/shipping notifications only after staff marks the bank payment Paid. No automated bank API or reconciliation exists yet.
