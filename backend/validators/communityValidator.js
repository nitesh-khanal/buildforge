// Lightweight validation for the Phase 6 community surface — same
// convention as reviewValidator.js/productValidator.js (a `partial` flag
// for update endpoints, an `errors` array joined into one message by the
// controller, no external validation library).

const { BUILD_USE_CASES, VISIBILITY_OPTIONS } = require('../models/CommunityBuild');
const { REPORT_TARGET_TYPES } = require('../models/Report');

function has(body, field) {
  return Object.prototype.hasOwnProperty.call(body, field);
}

// Used by both publishBuild (partial: false — title is required) and
// updateBuild (partial: true — every field is optional, only what's sent
// gets checked/applied).
function validateCommunityBuildInput(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || has(body, 'title')) {
    const title = (body.title || '').trim();
    if (!title) errors.push('title is required.');
    else if (title.length > 100) errors.push('title must be 100 characters or fewer.');
  }

  if (has(body, 'description') && String(body.description).length > 2000) {
    errors.push('description must be 2000 characters or fewer.');
  }

  if (has(body, 'category') && body.category && !BUILD_USE_CASES.includes(body.category)) {
    errors.push(`category must be one of: ${BUILD_USE_CASES.join(', ')}.`);
  }

  if (has(body, 'visibility') && body.visibility && !VISIBILITY_OPTIONS.includes(body.visibility)) {
    errors.push(`visibility must be one of: ${VISIBILITY_OPTIONS.join(', ')}.`);
  }

  if (has(body, 'tags')) {
    if (!Array.isArray(body.tags)) {
      errors.push('tags must be an array of strings.');
    } else if (body.tags.length > 10) {
      errors.push('a build can have at most 10 tags.');
    }
  }

  return errors;
}

function validateCommentInput(body) {
  const errors = [];
  const text = (body.text || '').trim();
  if (!text) errors.push('comment text is required.');
  else if (text.length > 1000) errors.push('comment must be 1000 characters or fewer.');
  return errors;
}

function validateBuildRatingInput(body) {
  const errors = [];
  const r = Number(body.rating);
  if (body.rating === undefined || body.rating === null || Number.isNaN(r) || r < 1 || r > 5) {
    errors.push('rating must be a number between 1 and 5.');
  }
  if (has(body, 'review') && String(body.review).length > 1000) {
    errors.push('review must be 1000 characters or fewer.');
  }
  return errors;
}

function validateReportInput(body) {
  const errors = [];
  if (!body.targetType || !REPORT_TARGET_TYPES.includes(body.targetType)) {
    errors.push(`targetType must be one of: ${REPORT_TARGET_TYPES.join(', ')}.`);
  }
  if (!body.targetId) errors.push('targetId is required.');
  const reason = (body.reason || '').trim();
  if (!reason) errors.push('reason is required.');
  else if (reason.length > 200) errors.push('reason must be 200 characters or fewer.');
  if (has(body, 'details') && String(body.details).length > 1000) {
    errors.push('details must be 1000 characters or fewer.');
  }
  return errors;
}

module.exports = {
  validateCommunityBuildInput,
  validateCommentInput,
  validateBuildRatingInput,
  validateReportInput,
};
