# Catalog sourcing and photo workflow

The catalog needs two separate inputs: product content (model, specifications and licensed photos) and commercial information (your NPR selling price, available quantity, warranty and supplier terms). Manufacturer/catalog feeds do not prove what you can sell or how much stock you have.

## Preferred sources

1. **Your Nepal distributor or supplier.** Request an XLSX/CSV/JSON export with exact brand + manufacturer part number (MPN), current purchase price, tax treatment, available quantity, warranty and licensed JPEG/PNG/WEBP images. Ask for ongoing updates. Convert the rows into the JSON template used by BuildForge; do not rely on guessed currency conversions or another shop's stock.
2. **Open Icecat.** [Open Icecat content access](https://icecat.com/content-subscription/) offers brand-authorized product content after registration. Match exact brand + MPN or GTIN, confirm brand/publication restrictions and download the authorized image files. [The official JSON manual](https://iceclog.com/manual-for-icecat-json-product-requests/) says shop users should host the downloaded images themselves; the importer rejects Icecat image hotlinks. No Icecat account or credential is created by BuildForge.
3. **Manufacturer/reseller media kits.** Use the manufacturer links in the admin import page to verify the exact variant and its specifications. Request permission or use an approved reseller media kit before republishing product photography.
4. **Your own photos.** Photograph the actual inventory or ask your supplier to provide pictures with publication permission. Avoid image search results and unrelated stock photos for product listings.

## Import steps

1. Open `/admin/catalog-import` and download either `catalog-template.json` (one example for each category) or `catalog-starter.json` (eight manufacturer-linked research drafts).
2. Enter a stable internal `sku`, exact `mpn` where available, name, brand, category, price in NPR, integer stock and supplier-approved description. Starter rows have zero prices/stock intentionally; they are not real inventory or an import-ready catalog.
3. Fill `specifications` for display and `compatibilityData` for the builder. Fields vary by category: CPU socket/TDP, GPU dimensions/power, motherboard socket/RAM/form factor, RAM type/capacity, PSU wattage/form factor, case clearances, cooler sockets/height/cooling rating. The template values are examples, not verified claims about the starter models. Read the compatibility engine's limitations, especially AIO radiator fit and BIOS/CPU support, before advertising a build as compatible.
4. Load the JSON array. Use each row's photo chooser to upload the actual licensed photo. Local uploads produce a `/uploads/...` URL. Alternatively use an HTTPS URL on image storage you control; a third-party hotlink can break or disallow redistribution.
5. Record `sourceUrl`, set `photoRightsConfirmed=true` only when you have rights, and mark `commercialDataVerified=true` / `compatibilityReviewed=true` only after checking those data. Unreviewed commercial/compatibility data save as archived drafts. Missing photo rights block the import.
6. Preview the batch, fix validation errors, then import. Imports use a database transaction and upsert by SKU. Reimporting updates that SKU and preserves reviews. Use a test/staging database for first imports and back up before large catalog updates.

The JSON file must be under 180 KB in the admin interface, with up to 100 products per batch. Large supplier spreadsheets can be divided into batches. Imported stock is an absolute available quantity: schedule updates when checkout is quiet or coordinate with your supplier so a feed refresh does not reintroduce quantities already sold/reserved by this store. There is no automatic inventory synchronization in this release.

## Photo storage

The Docker deployment keeps photos in a persistent `uploads` volume and backs them up with the database. Only JPEG, PNG and WEBP are accepted, and the binary signature must match the declared type. Missing images show a clearly labelled placeholder; it is not a product photo.

For multiple app servers, move photos to object storage/CDN before scaling. Keep the source and permission records, periodically verify image availability, and archive discontinued parts instead of deleting historical references.
