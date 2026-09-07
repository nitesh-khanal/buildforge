// Phase 11: extends the archived-product exclusion (Product.findActive,
// see models/Product.js and Phase 10's write-up in BUILD_FORGE_PROGRESS.md)
// into compareController.js and recommendationController.js — flagged as a
// follow-up ever since Phase 10 deliberately left them untouched to keep
// that phase's diff reviewable.
//
// This sandbox has no live MongoDB to exercise the controllers end-to-end
// against real archived/active documents (same limitation every DB-backed
// phase's own testing section has already noted — see e.g. Phase 6's
// "Tests performed" section for the fake-mongoose-shim workaround it used
// instead). Rather than build another throwaway fake-mongoose module just
// for two files, this is a plain static regression guard: it reads the
// actual source and asserts every *discovery/browsing* Product query in
// each file goes through `Product.findActive`, not `Product.find`— so a
// future edit that quietly reintroduces a raw `Product.find` for one of
// these pools fails this test immediately, without needing a database.
//
// Deliberately NOT asserted here (these are correct as plain `Product.find`
// — see the inline comments in both controllers for why): compareController
// has none; recommendationController's `getBuildCompletions` resolves
// *already-selected* build components by id (same "resolves regardless of
// archived status" rule as `getProductById`), not a discovery pool.

const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Phase 11: archived-product exclusion in discovery surfaces', () => {
  it('compareController resolves the requested ids via Product.findActive', () => {
    const src = read('controllers/compareController.js');
    expect(src).toMatch(/Product\.findActive\(\{\s*_id:\s*\{\s*\$in:\s*validIds\s*\}/);
    expect(src).not.toMatch(/Product\.find\(\{\s*_id:\s*\{\s*\$in:\s*validIds/);
  });

  it('recommendationController.getSimilar pools via Product.findActive', () => {
    const src = read('controllers/recommendationController.js');
    expect(src).toMatch(/Product\.findActive\(\{\s*category:\s*product\.category,\s*_id:\s*\{\s*\$ne:\s*product\._id\s*\}\s*\}\)\.limit\(40\)/);
  });

  it('recommendationController.getFrequentlyBought pools via Product.findActive', () => {
    const src = read('controllers/recommendationController.js');
    expect(src).toMatch(/poolsByCategory\[category\]\s*=\s*await Product\.findActive\(query\)/);
  });

  it('recommendationController.getBuildCompletions candidate pool uses Product.findActive, selected-by-id lookup stays plain find', () => {
    const src = read('controllers/recommendationController.js');
    expect(src).toMatch(/const candidates = await Product\.findActive\(\{\s*category:\s*slot\s*\}\)\.limit\(40\)/);
    // The already-selected components (looked up by id from the request
    // body) intentionally stay a direct findById-equivalent lookup.
    expect(src).toMatch(/const selectedProducts = await Product\.find\(\{\s*_id:\s*\{\s*\$in:\s*ids\s*\}\s*\}\)/);
  });

  it('recommendationController.getForYou fallback and personalized pool use Product.findActive', () => {
    const src = read('controllers/recommendationController.js');
    expect(src).toMatch(/const products = await Product\.findActive\(\{\s*isFeatured:\s*true\s*\}\)/);
    expect(src).toMatch(/const pool = await Product\.findActive\(\{\s*_id:\s*\{\s*\$nin:\s*profile\.purchasedProductIds\s*\}\s*\}\)/);
  });
});
