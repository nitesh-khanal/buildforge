// Pure, DB-free helpers backing every multer-based image upload in this
// project (Phase 6's product image upload, Phase 11's category image
// upload). Split out so the accept/reject rule is defined exactly once and
// is directly unit-testable with zero multer/mongoose dependency — same
// convention as utils/productArchive.js's buildAdminArchiveFilter.

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB, matches the Phase 6 product upload limit

function isAllowedImageMime(mimetype) {
  return ALLOWED_IMAGE_MIME_TYPES.includes(mimetype);
}

// Builds the multer `fileFilter` callback signature (err, acceptBoolean)
// from the pure check above, so the rejection message is consistent
// wherever this is wired into a multer instance.
function imageFileFilter(_req, file, cb) {
  if (!isAllowedImageMime(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, or WEBP images are allowed.'));
  }
  cb(null, true);
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  isAllowedImageMime,
  imageFileFilter,
};
