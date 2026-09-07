const { computeRatingAggregate } = require('../services/ratingService');

describe('computeRatingAggregate', () => {
  it('returns zeroed-out values for no reviews', () => {
    expect(computeRatingAggregate([])).toEqual({
      rating: 0,
      numReviews: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  it('averages a simple set of ratings, rounded to one decimal', () => {
    const result = computeRatingAggregate([5, 4, 4]);
    expect(result.numReviews).toBe(3);
    expect(result.rating).toBeCloseTo(4.3, 5);
  });

  it('buckets each rating into the distribution', () => {
    const result = computeRatingAggregate([5, 5, 3, 1]);
    expect(result.ratingDistribution).toEqual({ 1: 1, 2: 0, 3: 1, 4: 0, 5: 2 });
  });

  it('accepts plain numbers and {rating} objects interchangeably', () => {
    const fromNumbers = computeRatingAggregate([4, 5]);
    const fromObjects = computeRatingAggregate([{ rating: 4 }, { rating: 5 }]);
    expect(fromObjects).toEqual(fromNumbers);
  });

  it('does not divide by zero or crash on a single review', () => {
    const result = computeRatingAggregate([3]);
    expect(result).toEqual({
      rating: 3,
      numReviews: 1,
      ratingDistribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 0 },
    });
  });
});
