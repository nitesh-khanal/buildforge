const { isAllowedImageMime, imageFileFilter, MAX_IMAGE_BYTES } = require('../utils/imageUpload');

describe('isAllowedImageMime', () => {
  it('accepts jpeg, png, and webp', () => {
    expect(isAllowedImageMime('image/jpeg')).toBe(true);
    expect(isAllowedImageMime('image/png')).toBe(true);
    expect(isAllowedImageMime('image/webp')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isAllowedImageMime('image/gif')).toBe(false);
    expect(isAllowedImageMime('application/pdf')).toBe(false);
    expect(isAllowedImageMime('text/html')).toBe(false);
    expect(isAllowedImageMime('')).toBe(false);
    expect(isAllowedImageMime(undefined)).toBe(false);
  });
});

describe('imageFileFilter', () => {
  it('calls back with (null, true) for an allowed mime type', (done) => {
    imageFileFilter(null, { mimetype: 'image/png' }, (err, accept) => {
      expect(err).toBeNull();
      expect(accept).toBe(true);
      done();
    });
  });

  it('calls back with an error for a disallowed mime type', (done) => {
    imageFileFilter(null, { mimetype: 'application/pdf' }, (err, accept) => {
      expect(err).toBeInstanceOf(Error);
      expect(accept).toBeUndefined();
      done();
    });
  });
});

describe('MAX_IMAGE_BYTES', () => {
  it('is a positive number of bytes (5MB)', () => {
    expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024);
  });
});
