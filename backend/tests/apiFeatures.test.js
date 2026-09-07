const ApiFeatures = require('../utils/apiFeatures');

// Fake chainable Mongoose query — records every call so assertions can
// check what ApiFeatures actually asked for, without needing a real DB.
function fakeQuery() {
  const calls = [];
  const proxy = {
    find(filter) {
      calls.push(['find', filter]);
      return proxy;
    },
    sort(by) {
      calls.push(['sort', by]);
      return proxy;
    },
    skip(n) {
      calls.push(['skip', n]);
      return proxy;
    },
    limit(n) {
      calls.push(['limit', n]);
      return proxy;
    },
    __calls: calls,
  };
  return proxy;
}

describe('ApiFeatures', () => {
  it('builds a category + price range filter', () => {
    const features = new ApiFeatures(fakeQuery(), { category: 'gpu', minPrice: '20000', maxPrice: '80000' });
    features.filterBasics();
    expect(features.filter).toEqual({
      category: 'gpu',
      price: { $gte: 20000, $lte: 80000 },
    });
  });

  it('escapes regex special characters in brand and search so they cannot break the query', () => {
    const features = new ApiFeatures(fakeQuery(), { brand: 'A+B', search: 'a.b*c' });
    features.filterBasics();
    expect(features.filter.brand.source).toBe('^A\\+B$');
    expect(features.filter.$or[0].name.source).toBe('a\\.b\\*c');
  });

  it('maps availability=in-stock and out-of-stock to stock thresholds', () => {
    const inStock = new ApiFeatures(fakeQuery(), { availability: 'in-stock' }).filterBasics();
    expect(inStock.filter.stock).toEqual({ $gt: 3 });

    const outOfStock = new ApiFeatures(fakeQuery(), { availability: 'out-of-stock' }).filterBasics();
    expect(outOfStock.filter.stock).toEqual({ $lte: 0 });
  });

  it('collects spec.* query params into a specifications filter', () => {
    const features = new ApiFeatures(fakeQuery(), { 'spec.socket': 'AM5', 'spec.cores': '8' });
    const query = fakeQuery();
    features.query = query;
    features.filterSpecs();
    const findCall = query.__calls.find(([op]) => op === 'find');
    expect(findCall[1]).toEqual({ 'specifications.socket': 'AM5', 'specifications.cores': '8' });
  });

  it('defaults to sorting by newest when no sort param is given', () => {
    const query = fakeQuery();
    const features = new ApiFeatures(query, {});
    features.query = query;
    features.sort();
    expect(query.__calls).toContainEqual(['sort', '-createdAt']);
  });

  it('maps known sort keywords to the right field', () => {
    const cases = [
      ['price-asc', 'price'],
      ['price-desc', '-price'],
      ['rating', '-rating'],
      ['name', 'name'],
    ];
    for (const [input, expected] of cases) {
      const query = fakeQuery();
      const features = new ApiFeatures(query, { sort: input });
      features.query = query;
      features.sort();
      expect(query.__calls).toContainEqual(['sort', expected]);
    }
  });

  it('clamps page to at least 1 and limit to at most 60', () => {
    const features = new ApiFeatures(fakeQuery(), { page: '0', limit: '500' });
    features.query = fakeQuery();
    features.paginate();
    expect(features.pagination).toEqual({ page: 1, limit: 60 });
  });

  it('computes the correct skip for a given page and limit', () => {
    const query = fakeQuery();
    const features = new ApiFeatures(query, { page: '3', limit: '10' });
    features.query = query;
    features.paginate();
    expect(query.__calls).toContainEqual(['skip', 20]);
    expect(query.__calls).toContainEqual(['limit', 10]);
  });
});
