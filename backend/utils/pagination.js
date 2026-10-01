// Keep database offsets and limits finite, positive integers.
function positiveInteger(value, fallback, maximum) {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) return fallback;
  return Math.min(number, maximum);
}

function pagination(query, maxLimit = 100) {
  const limit = positiveInteger(query.limit, 20, maxLimit);
  const page = positiveInteger(query.page, 1, Math.floor(Number.MAX_SAFE_INTEGER / limit));
  return { page, limit, skip: (page - 1) * limit };
}

module.exports = pagination;
