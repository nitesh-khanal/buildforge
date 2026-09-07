const {
  validateCommunityBuildInput,
  validateCommentInput,
  validateBuildRatingInput,
  validateReportInput,
} = require('../validators/communityValidator');

describe('validateCommunityBuildInput', () => {
  it('accepts a minimal valid publish (title only) with no errors', () => {
    expect(validateCommunityBuildInput({ title: 'My Gaming Rig' })).toEqual([]);
  });

  it('accepts a fully populated publish with no errors', () => {
    expect(
      validateCommunityBuildInput({
        title: 'Budget 1440p Build',
        description: 'Great value for the price.',
        category: 'gaming',
        visibility: 'public',
        tags: ['budget', 'amd'],
      })
    ).toEqual([]);
  });

  it('requires a title on a full (non-partial) submission', () => {
    const errors = validateCommunityBuildInput({});
    expect(errors.some((e) => e.includes('title'))).toBe(true);
  });

  it('rejects a title that is only whitespace', () => {
    const errors = validateCommunityBuildInput({ title: '   ' });
    expect(errors.some((e) => e.includes('title'))).toBe(true);
  });

  it('rejects a title over 100 characters', () => {
    const errors = validateCommunityBuildInput({ title: 'x'.repeat(101) });
    expect(errors.some((e) => e.includes('title'))).toBe(true);
  });

  it('rejects a description over 2000 characters', () => {
    const errors = validateCommunityBuildInput({ title: 'ok', description: 'x'.repeat(2001) });
    expect(errors.some((e) => e.includes('description'))).toBe(true);
  });

  it('rejects a category outside the known use-case list', () => {
    const errors = validateCommunityBuildInput({ title: 'ok', category: 'server-farm' });
    expect(errors.some((e) => e.includes('category'))).toBe(true);
  });

  it('rejects a visibility value outside the known list', () => {
    const errors = validateCommunityBuildInput({ title: 'ok', visibility: 'friends-only' });
    expect(errors.some((e) => e.includes('visibility'))).toBe(true);
  });

  it('rejects tags that are not an array', () => {
    const errors = validateCommunityBuildInput({ title: 'ok', tags: 'gaming,amd' });
    expect(errors.some((e) => e.includes('tags'))).toBe(true);
  });

  it('rejects more than 10 tags', () => {
    const errors = validateCommunityBuildInput({ title: 'ok', tags: Array(11).fill('tag') });
    expect(errors.some((e) => e.includes('tags'))).toBe(true);
  });

  describe('partial mode (updates)', () => {
    it('allows omitted fields entirely, including title', () => {
      expect(validateCommunityBuildInput({}, { partial: true })).toEqual([]);
    });

    it('still validates a field that IS present', () => {
      const errors = validateCommunityBuildInput({ category: 'nope' }, { partial: true });
      expect(errors.some((e) => e.includes('category'))).toBe(true);
    });

    it('rejects an empty title if title is explicitly sent', () => {
      const errors = validateCommunityBuildInput({ title: '' }, { partial: true });
      expect(errors.some((e) => e.includes('title'))).toBe(true);
    });
  });
});

describe('validateCommentInput', () => {
  it('accepts valid comment text', () => {
    expect(validateCommentInput({ text: 'Nice parts list!' })).toEqual([]);
  });

  it('rejects empty text', () => {
    expect(validateCommentInput({}).length).toBeGreaterThan(0);
    expect(validateCommentInput({ text: '   ' }).length).toBeGreaterThan(0);
  });

  it('rejects text over 1000 characters', () => {
    const errors = validateCommentInput({ text: 'x'.repeat(1001) });
    expect(errors.some((e) => e.includes('1000'))).toBe(true);
  });
});

describe('validateBuildRatingInput', () => {
  it('accepts a valid rating with an optional review', () => {
    expect(validateBuildRatingInput({ rating: 4, review: 'Solid build.' })).toEqual([]);
  });

  it('accepts ratings at the boundaries (1 and 5)', () => {
    expect(validateBuildRatingInput({ rating: 1 })).toEqual([]);
    expect(validateBuildRatingInput({ rating: 5 })).toEqual([]);
  });

  it.each([0, 6, -1])('rejects a rating of %p as outside 1-5', (rating) => {
    const errors = validateBuildRatingInput({ rating });
    expect(errors.some((e) => e.includes('rating'))).toBe(true);
  });

  it('requires a rating', () => {
    const errors = validateBuildRatingInput({});
    expect(errors.some((e) => e.includes('rating'))).toBe(true);
  });

  it('rejects a review over 1000 characters', () => {
    const errors = validateBuildRatingInput({ rating: 3, review: 'x'.repeat(1001) });
    expect(errors.some((e) => e.includes('review'))).toBe(true);
  });
});

describe('validateReportInput', () => {
  it('accepts a valid report', () => {
    expect(
      validateReportInput({ targetType: 'communityBuild', targetId: 'abc123', reason: 'Spam' })
    ).toEqual([]);
  });

  it('requires targetType, targetId, and reason', () => {
    const errors = validateReportInput({});
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('targetType'),
        expect.stringContaining('targetId'),
        expect.stringContaining('reason'),
      ])
    );
  });

  it('rejects a targetType outside the known list', () => {
    const errors = validateReportInput({ targetType: 'product', targetId: 'abc', reason: 'x' });
    expect(errors.some((e) => e.includes('targetType'))).toBe(true);
  });

  it('rejects a reason over 200 characters', () => {
    const errors = validateReportInput({
      targetType: 'comment',
      targetId: 'abc',
      reason: 'x'.repeat(201),
    });
    expect(errors.some((e) => e.includes('reason'))).toBe(true);
  });

  it('rejects details over 1000 characters', () => {
    const errors = validateReportInput({
      targetType: 'comment',
      targetId: 'abc',
      reason: 'spam',
      details: 'x'.repeat(1001),
    });
    expect(errors.some((e) => e.includes('details'))).toBe(true);
  });
});
