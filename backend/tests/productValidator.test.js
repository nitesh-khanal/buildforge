const { validateProductInput } = require('../validators/productValidator');

const validProduct = {
  name: 'Ryzen 5 7600X',
  brand: 'AMD',
  category: 'cpu',
  price: 42000,
  stock: 10,
  rating: 4.6,
  specifications: { socket: 'AM5' },
  compatibilityData: { socket: 'AM5', tdp: 105 },
};

describe('validateProductInput', () => {
  it('accepts a fully valid product with no errors', () => {
    expect(validateProductInput(validProduct)).toEqual([]);
  });

  it('requires name, brand, category, and price on a full (non-partial) submission', () => {
    const errors = validateProductInput({});
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('name'),
        expect.stringContaining('brand'),
        expect.stringContaining('category'),
        expect.stringContaining('price'),
      ])
    );
  });

  it('rejects a category outside the known list', () => {
    const errors = validateProductInput({ ...validProduct, category: 'motherboard-x' });
    expect(errors.some((e) => e.includes('category'))).toBe(true);
  });

  it('rejects a negative price', () => {
    const errors = validateProductInput({ ...validProduct, price: -100 });
    expect(errors.some((e) => e.includes('price'))).toBe(true);
  });

  it('rejects a rating outside 0-5', () => {
    const errors = validateProductInput({ ...validProduct, rating: 7 });
    expect(errors.some((e) => e.includes('rating'))).toBe(true);
  });

  it('rejects specifications that are not an object', () => {
    const errors = validateProductInput({ ...validProduct, specifications: 'not-an-object' });
    expect(errors.some((e) => e.includes('specifications'))).toBe(true);
  });

  describe('partial mode (updates)', () => {
    it('allows omitted fields entirely', () => {
      expect(validateProductInput({ price: 45000 }, { partial: true })).toEqual([]);
    });

    it('still validates a field that IS present', () => {
      const errors = validateProductInput({ price: -50 }, { partial: true });
      expect(errors.some((e) => e.includes('price'))).toBe(true);
    });

    it('validates stock even though it is optional in full mode', () => {
      const errors = validateProductInput({ stock: -5 }, { partial: true });
      expect(errors.some((e) => e.includes('stock'))).toBe(true);
    });
  });
});
