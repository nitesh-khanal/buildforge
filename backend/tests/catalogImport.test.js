const { validateCatalog, importOperations } = require('../utils/catalogImport');
const part = { sku: 'supplier-cpu-01', name: 'CPU', brand: 'AMD', category: 'cpu', price: 42000, stock: 5, image: '/uploads/photo.jpg', sourceUrl: 'https://supplier.example.org/cpu', photoRightsConfirmed: true, commercialDataVerified: true, compatibilityReviewed: true, specifications: { cores: 6 }, compatibilityData: { socket: 'AM5', tdp: 105 } };
it('imports reviewed parts by SKU and records photo permission and source', () => {
  const value = validateCatalog([part]);
  expect(value.errors).toEqual([]);
  expect(value.products[0]).toMatchObject({ sku: 'SUPPLIER-CPU-01', catalogVerified: true, isArchived: false, catalogSource: { photoRightsConfirmed: true } });
  const operation = importOperations(value.products)[0].updateOne;
  expect(operation.filter).toEqual({ sku: 'SUPPLIER-CPU-01' });
  expect(operation.update.$set.rating).toBeUndefined();
  expect(operation.upsert).toBe(true);
});
it('keeps incomplete commercial reviews as archived drafts', () => {
  expect(validateCatalog([{ ...part, commercialDataVerified: false, price: 0, stock: 0 }]).products[0]).toMatchObject({ catalogVerified: false, isArchived: true });
});
it('rejects duplicate SKUs, unlicensed photos and missing compatibility information', () => {
  expect(validateCatalog([part, part]).errors.join(' ')).toMatch(/duplicate SKU/);
  expect(validateCatalog([{ ...part, photoRightsConfirmed: false }]).errors.join(' ')).toMatch(/permission/);
  expect(validateCatalog([{ ...part, compatibilityData: {} }]).errors.join(' ')).toMatch(/socket/);
});
it.each([Infinity, NaN, '100', -1])('rejects invalid prices %p', (price) => {
  expect(validateCatalog([{ ...part, price }]).errors.length).toBeGreaterThan(0);
});
it.each([1.5, Infinity, -2, '5'])('rejects invalid inventory %p', (stock) => {
  expect(validateCatalog([{ ...part, stock }]).errors.length).toBeGreaterThan(0);
});
it('rejects database operators, executable images and third-party Icecat hotlinks', () => {
  expect(validateCatalog([{ ...part, specifications: { $where: 'attack' } }]).errors.join(' ')).toMatch(/operators/);
  expect(validateCatalog([{ ...part, image: 'javascript:alert(1)' }]).errors.length).toBeGreaterThan(0);
  expect(validateCatalog([{ ...part, image: 'https://images.icecat.biz/img/one.jpg' }]).errors.join(' ')).toMatch(/own storage/);
});
