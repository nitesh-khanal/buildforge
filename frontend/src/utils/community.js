// Mirrors backend/models/CommunityBuild.js's BUILD_USE_CASES enum — kept as
// a plain array here (not fetched from the API) since it's a small fixed
// set, same treatment CATEGORY_LABELS in specs.js gives the 8 product
// categories.
export const COMMUNITY_CATEGORIES = [
  { value: 'gaming', label: 'Gaming' },
  { value: 'workstation', label: 'Workstation' },
  { value: 'budget', label: 'Budget' },
  { value: 'high-end', label: 'High-end' },
  { value: 'office', label: 'Office' },
  { value: 'custom', label: 'Custom' },
];

export const COMMUNITY_CATEGORY_LABELS = COMMUNITY_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.value]: c.label }),
  {}
);

export const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public — shown in the community feed' },
  { value: 'unlisted', label: 'Unlisted — viewable by direct link only' },
  { value: 'private', label: 'Private — only visible to you' },
];

// The backend's Report model stores `reason` as free text (200 chars, no
// enum) — this fixed list is a frontend-only reason-picker so reporting is
// one tap instead of a blank text box, with an optional free-text `details`
// field alongside it for anything more specific.
export const REPORT_REASONS = [
  'Spam or advertising',
  'Inappropriate or offensive content',
  'Harassment or hate speech',
  'Misleading or fake build',
  'Other',
];
