const {
  MIN_COMPARE,
  MAX_COMPARE,
  parseCompareIds,
  validateComparison,
  buildSpecKeyUnion,
} = require('../utils/compareUtils');

describe('parseCompareIds', () => {
  it('splits and trims a comma-separated list', () => {
    expect(parseCompareIds(' id1, id2 ,id3')).toEqual(['id1', 'id2', 'id3']);
  });

  it('dedupes while preserving first-occurrence order', () => {
    expect(parseCompareIds('id1,id2,id1,id3,id2')).toEqual(['id1', 'id2', 'id3']);
  });

  it('drops empty segments from stray commas', () => {
    expect(parseCompareIds('id1,,id2,')).toEqual(['id1', 'id2']);
  });

  it('returns an empty array for missing/blank input', () => {
    expect(parseCompareIds(undefined)).toEqual([]);
    expect(parseCompareIds('')).toEqual([]);
    expect(parseCompareIds('   ')).toEqual([]);
  });
});

describe('validateComparison', () => {
  const cpu = (id) => ({ _id: id, category: 'cpu' });

  it('rejects fewer than the minimum', () => {
    const ids = ['a'];
    const { error } = validateComparison(ids, [cpu('a')]);
    expect(error).toMatch(new RegExp(`${MIN_COMPARE} and ${MAX_COMPARE}`));
  });

  it('rejects more than the maximum', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const products = ids.map(cpu);
    const { error } = validateComparison(ids, products);
    expect(error).toMatch(new RegExp(`${MIN_COMPARE} and ${MAX_COMPARE}`));
  });

  it('rejects when one or more ids were not found', () => {
    const ids = ['a', 'b', 'c'];
    const products = [cpu('a'), cpu('b')]; // "c" missing
    const { error } = validateComparison(ids, products);
    expect(error).toMatch(/could not be found/);
  });

  it('rejects mixed categories', () => {
    const ids = ['a', 'b'];
    const products = [cpu('a'), { _id: 'b', category: 'gpu' }];
    const { error } = validateComparison(ids, products);
    expect(error).toMatch(/same category/);
  });

  it('accepts 2-4 found products all in the same category', () => {
    const ids = ['a', 'b', 'c'];
    const products = ids.map(cpu);
    expect(validateComparison(ids, products)).toEqual({ error: null });
  });
});

describe('buildSpecKeyUnion', () => {
  it('unions spec keys across products in first-seen order', () => {
    const products = [
      { specifications: { socket: 'AM5', cores: 8 } },
      { specifications: { cores: 16, tdp: 105 } },
    ];
    expect(buildSpecKeyUnion(products)).toEqual(['socket', 'cores', 'tdp']);
  });

  it('skips keys whose value is null, undefined, or an empty string', () => {
    const products = [{ specifications: { socket: 'AM5', cores: null, tdp: undefined, notes: '' } }];
    expect(buildSpecKeyUnion(products)).toEqual(['socket']);
  });

  it('treats a missing specifications object as empty', () => {
    const products = [{ specifications: { socket: 'AM5' } }, {}];
    expect(buildSpecKeyUnion(products)).toEqual(['socket']);
  });

  it('returns an empty array for no products', () => {
    expect(buildSpecKeyUnion([])).toEqual([]);
  });
});
