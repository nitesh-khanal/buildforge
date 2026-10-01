const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const { PUBLIC_PAGES, escape, origin, renderPage } = require('../utils/seo');
const PAGE_SIZE = 10000;
const activeFilter = { isArchived: { $ne: true }, catalogVerified: true };

module.exports = function mountStorefront(app) {
  app.get('/robots.txt', (req, res) => res.type('text/plain').send(process.env.SITE_INDEXABLE === 'true'
    ? `User-agent: *\nDisallow: /api/\nDisallow: /admin\nSitemap: ${origin()}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n'));
  app.get('/sitemap.xml', asyncHandler(async (req, res) => {
    const count = process.env.SITE_INDEXABLE === 'true' ? await Product.countDocuments(activeFilter) : 0;
    const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    const maps = Array.from({ length: pages }, (_, page) => `<sitemap><loc>${escape(origin())}/sitemaps/${page}.xml</loc></sitemap>`).join('');
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${maps}</sitemapindex>`);
  }));
  app.get('/sitemaps/:page.xml', asyncHandler(async (req, res) => {
    const page = Number(req.params.page);
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000) return res.sendStatus(404);
    const products = process.env.SITE_INDEXABLE === 'true' ? await Product.find(activeFilter).select('_id updatedAt').sort('_id').skip(page * PAGE_SIZE).limit(PAGE_SIZE).lean() : [];
    const routes = page === 0 && process.env.SITE_INDEXABLE === 'true' ? Object.keys(PUBLIC_PAGES) : [];
    const urls = routes.map((route) => `<url><loc>${escape(origin() + route)}</loc></url>`);
    products.forEach((product) => urls.push(`<url><loc>${escape(origin())}/products/${product._id}</loc><lastmod>${new Date(product.updatedAt).toISOString()}</lastmod></url>`));
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
  }));
  const dist = process.env.FRONTEND_DIST || path.resolve(__dirname, '../../frontend/dist');
  const index = path.join(dist, 'index.html');
  if (!fs.existsSync(index)) return;
  const html = fs.readFileSync(index, 'utf8');
  app.get('/index.html', (req, res) => res.redirect(301, '/'));
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', asyncHandler(async (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    let product;
    let status = 200;
    if (req.path.startsWith('/products/')) {
      const id = req.path.slice('/products/'.length);
      product = mongoose.isValidObjectId(id) ? await Product.findById(id).lean() : null;
      if (!product || (process.env.NODE_ENV === 'production' && !product.catalogVerified)) { status = 404; product = null; }
    } else if (!PUBLIC_PAGES[req.path] && !/^\/(cart|compare|login|register|checkout|wishlist|notifications|orders|order-confirmation|admin|account|community\/mine|community\/builds)(\/|$)/.test(req.path)) status = 404;
    res.status(status).set('Cache-Control', 'no-store').type('html').send(renderPage(html, req.path, product));
  }));
};
