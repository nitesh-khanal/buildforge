const { buildAdminArchiveFilter, STATUS_FILTERS } = require('../utils/productArchive');

describe('buildAdminArchiveFilter', () => {
  it('returns the active-only filter for "active"', () => {
    expect(buildAdminArchiveFilter('active')).toEqual({ isArchived: { $ne: true } });
  });

  it('returns the archived-only filter for "archived"', () => {
    expect(buildAdminArchiveFilter('archived')).toEqual({ isArchived: true });
  });

  it('returns an empty filter for "all"', () => {
    expect(buildAdminArchiveFilter('all')).toEqual({});
  });

  it('defaults to "all" (empty filter) when status is undefined', () => {
    expect(buildAdminArchiveFilter(undefined)).toEqual({});
  });

  it('defaults to "all" for an unrecognized value rather than throwing', () => {
    expect(buildAdminArchiveFilter('bogus')).toEqual({});
  });

  it('exposes the same three filters directly on STATUS_FILTERS', () => {
    expect(Object.keys(STATUS_FILTERS).sort()).toEqual(['active', 'all', 'archived']);
  });
});
