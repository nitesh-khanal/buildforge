const { validateReviewInput } = require('../validators/reviewValidator');

describe('validateReviewInput', () => {
  it('accepts a valid full review with no errors', () => {
    expect(
      validateReviewInput({ rating: 4, title: 'Solid', comment: 'Runs cool and quiet.' })
    ).toEqual([]);
  });

  it('requires a rating on a full (non-partial) submission', () => {
    const errors = validateReviewInput({ comment: 'no rating given' });
    expect(errors.some((e) => e.includes('rating'))).toBe(true);
  });

  it.each([0, 6, -1, 5.5])('rejects a rating of %p as outside 1-5', (rating) => {
    const errors = validateReviewInput({ rating });
    if (rating === 5.5) {
      // 5.5 is out of the 1-5 *integer-ish* range check via > 5, still invalid
      expect(errors.some((e) => e.includes('rating'))).toBe(true);
    } else {
      expect(errors.some((e) => e.includes('rating'))).toBe(true);
    }
  });

  it('accepts ratings at the boundaries (1 and 5)', () => {
    expect(validateReviewInput({ rating: 1 })).toEqual([]);
    expect(validateReviewInput({ rating: 5 })).toEqual([]);
  });

  it('rejects a title over 120 characters', () => {
    const errors = validateReviewInput({ rating: 4, title: 'x'.repeat(121) });
    expect(errors.some((e) => e.includes('title'))).toBe(true);
  });

  it('rejects a comment over 2000 characters', () => {
    const errors = validateReviewInput({ rating: 4, comment: 'x'.repeat(2001) });
    expect(errors.some((e) => e.includes('comment'))).toBe(true);
  });

  describe('partial mode (updates)', () => {
    it('still requires rating even in partial mode when present', () => {
      const errors = validateReviewInput({ rating: 9 }, { partial: true });
      expect(errors.some((e) => e.includes('rating'))).toBe(true);
    });

    it('allows omitted optional fields', () => {
      expect(validateReviewInput({ rating: 3 }, { partial: true })).toEqual([]);
    });
  });
});
