// Lightweight validation for create/update of a product review. Mirrors
// productValidator's `partial` convention, though in practice `updateReview`
// still requires a full valid rating — a review without one isn't meaningful
// — so `partial` mainly exists for symmetry and future fields.

function validateReviewInput(body, { partial = false } = {}) {
  const errors = [];
  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);

  if (!partial || has('rating')) {
    const r = Number(body.rating);
    if (body.rating === undefined || body.rating === null || Number.isNaN(r) || r < 1 || r > 5) {
      errors.push('rating must be a number between 1 and 5.');
    }
  }

  if (has('title') && String(body.title).length > 120) {
    errors.push('title must be 120 characters or fewer.');
  }

  if (has('comment') && String(body.comment).length > 2000) {
    errors.push('comment must be 2000 characters or fewer.');
  }

  return errors;
}

module.exports = { validateReviewInput };
