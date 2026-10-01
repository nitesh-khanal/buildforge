// Multer config for admin image uploads. Files land in backend/uploads/
// (already served statically at /uploads by app.js) with a randomized
// filename so two admins uploading "image.jpg" at the same time can't
// clobber each other.

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { imageExtension } = require('../utils/imageUpload');
const mimeExtensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
function verifyPhoto(req) {
  if (!req.file) return;
  const signature = imageExtension(fs.readFileSync(req.file.path));
  if (!signature || signature !== mimeExtensions[req.file.mimetype]) {
    fs.unlinkSync(req.file.path);
    throw new Error('The file is not a valid JPEG, PNG or WEBP photo.');
  }
}
const { isAllowedImageMime, MAX_IMAGE_BYTES } = require('../utils/imageUpload');

// Phase 11: the mime/size rule itself now lives in utils/imageUpload.js —
// a pure, DB-free module shared with the new category-image upload below —
// instead of being redefined here. Behavior is unchanged (jpeg/png/webp,
// 5MB), just no longer duplicated.
function fileFilter(req, file, cb) {
  if (!isAllowedImageMime(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, and WEBP images are allowed.'));
  }
  cb(null, true);
}

const productStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = mimeExtensions[file.mimetype];
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `product-${unique}${ext}`);
  },
});

const uploadProductImage = multer({
  storage: productStorage,
  fileFilter,
  limits: { fileSize: MAX_IMAGE_BYTES },
}).single('image');

// Wraps multer's callback-style middleware so multer-specific errors (bad
// file type, too large) surface as normal 400s through the existing error
// handler instead of an unhandled exception.
function handleProductImageUpload(req, res, next) {
  uploadProductImage(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(new Error(err.message || 'Image upload failed.'));
    }
    try { verifyPhoto(req); next(); } catch (error) { res.status(400); next(error); }
  });
}

// Phase 11 — category image upload, same middleware file rather than a
// separate one, since both are the exact same "admin uploads a product/
// category image to backend/uploads/" concern and now share `fileFilter`.
// Filenames use the category's own `slug` route param instead of a random
// hex string — there's exactly one image per category (unlike products,
// there's no id collision risk to randomize away), and a human-readable
// filename makes `backend/uploads/` easier to audit for an admin poking
// around it directly.
const categoryStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const slug = /^[a-z0-9-]+$/.test(req.params.slug || '') ? req.params.slug : 'category';
    const ext = mimeExtensions[file.mimetype];
    cb(null, `category-${slug}-${Date.now()}${ext}`);
  },
});

const uploadCategoryImageFile = multer({
  storage: categoryStorage,
  fileFilter,
  limits: { fileSize: MAX_IMAGE_BYTES },
}).single('image');

function handleCategoryImageUpload(req, res, next) {
  uploadCategoryImageFile(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(new Error(err.message || 'Image upload failed.'));
    }
    try { verifyPhoto(req); next(); } catch (error) { res.status(400); next(error); }
  });
}

module.exports = { handleProductImageUpload, handleCategoryImageUpload };
