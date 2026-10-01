const pagination = require('../utils/pagination');

describe('pagination boundaries', () => {
  test.each(['-2', '0', '1.5', 'Infinity', 'NaN', '9007199254740992', ['2'], { value: 2 }])(
    'rejects invalid page/limit input %p', (value) => {
      expect(pagination({ page: value, limit: value })).toEqual({ page: 1, limit: 20, skip: 0 });
    }
  );
  it('caps catalog and admin limits and computes offsets', () => {
    expect(pagination({ page: '3', limit: '500' }, 60)).toEqual({ page: 3, limit: 60, skip: 120 });
    expect(pagination({ page: '3', limit: '500' })).toEqual({ page: 3, limit: 100, skip: 200 });
  });
  it('keeps offsets within safe integer range', () => {
    const result = pagination({ page: String(Number.MAX_SAFE_INTEGER), limit: '60' });
    expect(Number.isSafeInteger(result.skip)).toBe(true);
  });
});
