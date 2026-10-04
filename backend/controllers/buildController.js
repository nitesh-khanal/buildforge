const Product = require('../models/Product');
const Build = require('../models/Build');
const asyncHandler = require('../utils/asyncHandler');
const { checkBuildCompatibility, isBuildOrderable } = require('../services/compatibilityService');

const CATEGORY_KEYS = ['cpu', 'cpu-cooler', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case'];

// Turns { cpu: '<id>', gpu: '<id>', ... } into { cpu: <Product>, gpu: <Product>, ... }
// Missing/omitted slots become null. Ignores unknown keys.
async function loadComponents(componentIds = {}) {
  const ids = CATEGORY_KEYS.map((key) => componentIds[key]).filter(Boolean);
  const products = await Product.find({ _id: { $in: ids } });
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  const components = {};
  for (const key of CATEGORY_KEYS) {
    const id = componentIds[key];
    components[key] = id ? byId.get(id.toString()) || null : null;
  }
  return components;
}

function buildSummary(components) {
  return CATEGORY_KEYS.reduce((acc, key) => {
    const product = components[key];
    acc[key] = product
      ? { _id: product._id, name: product.name, brand: product.brand, price: product.price, image: product.image }
      : null;
    return acc;
  }, {});
}

function totalPrice(components) {
  return Object.values(components).reduce((sum, p) => sum + (p ? p.price : 0), 0);
}

// POST /api/builds/check — no auth required; the builder must work for
// guests too (spec section 3: building doesn't require login).
// Body: { components: { cpu: '<id>', motherboard: '<id>', ... } }
const checkCompatibility = asyncHandler(async (req, res) => {
  const componentIds = req.body.components || {};
  const components = await loadComponents(componentIds);
  const report = checkBuildCompatibility(components);
  const orderable = isBuildOrderable(components, report);

  res.json({
    success: true,
    report,
    orderable,
    total: totalPrice(components),
    components: buildSummary(components),
  });
});

// Batch preview for the visible picker page; no AI or per-card requests.
const previewParts = asyncHandler(async (req, res) => {
  const { slot, candidateIds, components = {} } = req.body;
  const validId = require('mongoose').isValidObjectId;
  if (!CATEGORY_KEYS.includes(slot) || !Array.isArray(candidateIds) || candidateIds.length > 24 ||
      candidateIds.some(id => !validId(id)) || !components || typeof components !== 'object' || Array.isArray(components) ||
      Object.entries(components).some(([key, id]) => !CATEGORY_KEYS.includes(key) || !validId(id))) {
    res.status(400); throw new Error('Invalid part preview request.');
  }
  const selected = await loadComponents(components);
  const candidates = await Product.findActive({ _id: { $in: candidateIds }, category: slot });
  const relevant = {
    'cpu-motherboard': ['cpu', 'motherboard'], 'ram-motherboard': ['ram', 'motherboard'],
    'motherboard-case': ['motherboard', 'case'], 'gpu-case': ['gpu', 'case'],
    'cooler-cpu': ['cpu-cooler', 'cpu'], 'cooler-case': ['cpu-cooler', 'case'],
    'cooler-cpu-tdp': ['cpu-cooler', 'cpu'], 'psu-power': CATEGORY_KEYS,
    'psu-case': ['psu', 'case'],
  };
  const baseline = checkBuildCompatibility({ ...selected, [slot]: null });
  const previews = {};
  for (const candidate of candidates) {
    const report = checkBuildCompatibility({ ...selected, [slot]: candidate });
    const issues = report.issues.filter(issue => {
      if (!(relevant[issue.category] || []).includes(slot)) return false;
      if (issue.category === 'psu-power' && slot !== 'psu') {
        return !baseline.issues.some(old => old.category === issue.category && old.message === issue.message);
      }
      return true;
    });
    previews[String(candidate._id)] = {
      status: issues.some(i => i.level === 'error') ? 'error' : issues.length ? 'warning' : 'compatible', issues,
    };
  }
  res.json({ success: true, previews });
});

// POST /api/builds — save a build. Requires login (saved builds are
// per-account, spec section 42).
const saveBuild = asyncHandler(async (req, res) => {
  const { name, components: componentIds } = req.body;
  const components = await loadComponents(componentIds || {});
  const report = checkBuildCompatibility(components);

  const build = await Build.create({
    user: req.user._id,
    name: name || 'My Build',
    components: CATEGORY_KEYS.reduce((acc, key) => {
      acc[key] = components[key]?._id || null;
      return acc;
    }, {}),
    totalPrice: totalPrice(components),
    compatibilityStatus: report.status,
  });

  res.status(201).json({ success: true, build });
});

// GET /api/builds — the current user's saved builds
const getMyBuilds = asyncHandler(async (req, res) => {
  const builds = await Build.find({ user: req.user._id })
    .sort('-updatedAt')
    .populate(CATEGORY_KEYS.map((key) => ({ path: `components.${key}` })));

  res.json({ success: true, count: builds.length, builds });
});

// GET /api/builds/:id — a single saved build with a freshly recomputed
// compatibility report (prices/stock/specs may have changed since saving).
const getBuildById = asyncHandler(async (req, res) => {
  const build = await Build.findById(req.params.id).populate(
    CATEGORY_KEYS.map((key) => ({ path: `components.${key}` }))
  );
  if (!build) {
    res.status(404);
    throw new Error('Saved build not found.');
  }
  if (build.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('You are not authorized to view this build.');
  }

  const components = CATEGORY_KEYS.reduce((acc, key) => {
    acc[key] = build.components[key] || null;
    return acc;
  }, {});
  const report = checkBuildCompatibility(components);

  res.json({ success: true, build, report, orderable: isBuildOrderable(components, report) });
});

// PUT /api/builds/:id — update name and/or component selections
const updateBuild = asyncHandler(async (req, res) => {
  const build = await Build.findById(req.params.id);
  if (!build) {
    res.status(404);
    throw new Error('Saved build not found.');
  }
  if (build.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You are not authorized to modify this build.');
  }

  const { name, components: componentIds } = req.body;
  if (name) build.name = name;

  if (componentIds) {
    const components = await loadComponents(componentIds);
    const report = checkBuildCompatibility(components);
    build.components = CATEGORY_KEYS.reduce((acc, key) => {
      acc[key] = components[key]?._id || null;
      return acc;
    }, {});
    build.totalPrice = totalPrice(components);
    build.compatibilityStatus = report.status;
  }

  await build.save();
  res.json({ success: true, build });
});

// DELETE /api/builds/:id
const deleteBuild = asyncHandler(async (req, res) => {
  const build = await Build.findById(req.params.id);
  if (!build) {
    res.status(404);
    throw new Error('Saved build not found.');
  }
  if (build.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You are not authorized to delete this build.');
  }
  await build.deleteOne();
  res.json({ success: true, message: 'Build deleted.' });
});

module.exports = {
  previewParts,
  checkCompatibility,
  saveBuild,
  getMyBuilds,
  getBuildById,
  updateBuild,
  deleteBuild,
};
