const CommunityBuild = require('../models/CommunityBuild');
const Build = require('../models/Build');
const BuildLike = require('../models/BuildLike');
const BuildRating = require('../models/BuildRating');
const Comment = require('../models/Comment');
const Report = require('../models/Report');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const { validateCommunityBuildInput } = require('../validators/communityValidator');
const { checkBuildCompatibility, isBuildOrderable } = require('../services/compatibilityService');
const { CATEGORY_KEYS } = Build;

function totalPrice(components) {
  return CATEGORY_KEYS.reduce((sum, key) => sum + (components[key] ? components[key].price : 0), 0);
}

// Loads a Build's populated components the same way buildController does,
// so publish-time compatibility/price are recomputed fresh rather than
// trusting whatever the saved Build last had (specs/prices/stock may have
// changed since it was saved — same reasoning as getBuildById).
async function loadBuildComponents(build) {
  const ids = CATEGORY_KEYS.map((key) => build.components[key]).filter(Boolean);
  const products = await Product.find({ _id: { $in: ids } });
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  const components = {};
  for (const key of CATEGORY_KEYS) {
    const id = build.components[key];
    components[key] = id ? byId.get(id.toString()) || null : null;
  }
  return components;
}

function publicSummary(build, { isOwner, isLiked, myRating } = {}) {
  const obj = build.toObject ? build.toObject() : build;
  return { ...obj, isOwner: Boolean(isOwner), isLiked: Boolean(isLiked), myRating: myRating || null };
}

// A visitor may view a build if it's public+visible, or if they're the
// owner, or an admin. `unlisted` builds are reachable by anyone who has the
// direct link (not shown in the feed) but are otherwise treated like
// `public` for the purposes of this check — only `private` is blocked.
function canView(build, user) {
  const isOwner = Boolean(user) && build.user.toString() === user._id.toString();
  const isAdmin = Boolean(user) && user.role === 'admin';
  if (isOwner || isAdmin) return true;
  if (build.status === 'hidden') return false;
  if (build.visibility === 'private') return false;
  return true;
}

// POST /api/community/builds  { sourceBuildId, title, description?, category?, tags?, visibility?, image? }
// Publishes one of the user's own saved builds to the community feed. The
// component snapshot is frozen at publish time (Build.componentsSchema,
// same object shape a saved Build already uses) — the community post never
// stays live-linked to the source Build, per the Phase 1 design note.
const publishBuild = asyncHandler(async (req, res) => {
  const errors = validateCommunityBuildInput(req.body, { partial: false });
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join(' '));
  }

  const { sourceBuildId } = req.body;
  if (!sourceBuildId) {
    res.status(400);
    throw new Error('sourceBuildId is required — publish an existing saved build.');
  }

  const sourceBuild = await Build.findById(sourceBuildId);
  if (!sourceBuild) {
    res.status(404);
    throw new Error('Saved build not found.');
  }
  if (sourceBuild.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You can only publish your own saved builds.');
  }

  const components = await loadBuildComponents(sourceBuild);
  const report = checkBuildCompatibility(components);
  if (report.status === 'error') {
    res.status(400);
    throw new Error('This build has a compatibility error and cannot be published — fix it first.');
  }
  if (CATEGORY_KEYS.every((key) => !components[key])) {
    res.status(400);
    throw new Error('An empty build cannot be published.');
  }

  const communityBuild = await CommunityBuild.create({
    user: req.user._id,
    title: req.body.title.trim(),
    description: req.body.description || '',
    sourceBuild: sourceBuild._id,
    components: CATEGORY_KEYS.reduce((acc, key) => {
      acc[key] = components[key]?._id || null;
      return acc;
    }, {}),
    totalPrice: totalPrice(components),
    compatibilityStatus: report.status,
    image: req.body.image || '',
    category: req.body.category || 'custom',
    tags: (req.body.tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean),
    visibility: req.body.visibility || 'public',
  });

  res.status(201).json({ success: true, build: publicSummary(communityBuild, { isOwner: true }) });
});

// GET /api/community/builds?category=&tags=&search=&sort=newest|popular|top-rated|most-viewed&page=&limit=
// Public feed — only public+visible builds. optionalAuth so a logged-in
// visitor's own like/rating state can be attached per-item.
const listBuilds = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));

  const filter = { visibility: 'public', status: 'visible' };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.tags) {
    const tags = String(req.query.tags).split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (tags.length) filter.tags = { $in: tags };
  }
  if (req.query.search) filter.$text = { $search: req.query.search };

  const sortMap = {
    newest: { createdAt: -1 },
    popular: { likesCount: -1, createdAt: -1 },
    'top-rated': { averageRating: -1, ratingCount: -1 },
    'most-viewed': { viewsCount: -1 },
  };
  const sort = sortMap[req.query.sort] || sortMap.newest;

  const [builds, total] = await Promise.all([
    CommunityBuild.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name')
      .populate(CATEGORY_KEYS.map((key) => ({ path: `components.${key}`, select: 'name brand image price' }))),
    CommunityBuild.countDocuments(filter),
  ]);

  let likedSet = new Set();
  let myRatings = new Map();
  if (req.user) {
    const ids = builds.map((b) => b._id);
    const [likes, ratings] = await Promise.all([
      BuildLike.find({ user: req.user._id, communityBuild: { $in: ids } }).select('communityBuild'),
      BuildRating.find({ user: req.user._id, communityBuild: { $in: ids } }).select('communityBuild rating'),
    ]);
    likedSet = new Set(likes.map((l) => l.communityBuild.toString()));
    myRatings = new Map(ratings.map((r) => [r.communityBuild.toString(), r.rating]));
  }

  res.json({
    success: true,
    builds: builds.map((b) =>
      publicSummary(b, {
        isOwner: req.user && b.user._id.toString() === req.user._id.toString(),
        isLiked: likedSet.has(b._id.toString()),
        myRating: myRatings.get(b._id.toString()),
      })
    ),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
});

// GET /api/community/builds/mine — the current user's own published builds,
// any visibility/status (so they can see their own private/hidden posts).
const getMyBuilds = asyncHandler(async (req, res) => {
  const builds = await CommunityBuild.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate(CATEGORY_KEYS.map((key) => ({ path: `components.${key}`, select: 'name brand image price' })));

  res.json({ success: true, builds: builds.map((b) => publicSummary(b, { isOwner: true })) });
});

// GET /api/community/builds/:id
const getBuildById = asyncHandler(async (req, res) => {
  const build = await CommunityBuild.findById(req.params.id)
    .populate('user', 'name')
    .populate(CATEGORY_KEYS.map((key) => ({ path: `components.${key}` })));

  if (!build || !canView(build, req.user)) {
    res.status(404);
    throw new Error('Community build not found.');
  }

  const isOwner = Boolean(req.user) && build.user._id.toString() === req.user._id.toString();

  // Views are a display-only counter (per the Phase 1 design note, not tied
  // to confirmed-payment analytics), so a simple unconditional increment is
  // an intentional, documented trade-off: cheap and good enough for a
  // "trending" sort, at the cost of being trivially inflatable by repeat
  // requests. The one thing worth guarding against for free is the owner
  // inflating their own build just by looking at it.
  if (!isOwner) {
    build.viewsCount += 1;
    await CommunityBuild.findByIdAndUpdate(build._id, { $inc: { viewsCount: 1 } });
  }

  let isLiked = false;
  let myRating = null;
  if (req.user) {
    const [like, rating] = await Promise.all([
      BuildLike.findOne({ user: req.user._id, communityBuild: build._id }),
      BuildRating.findOne({ user: req.user._id, communityBuild: build._id }),
    ]);
    isLiked = Boolean(like);
    myRating = rating ? rating.rating : null;
  }

  res.json({ success: true, build: publicSummary(build, { isOwner, isLiked, myRating }) });
});

// PUT /api/community/builds/:id  { title?, description?, category?, tags?, visibility?, image? }
// Metadata only — the component snapshot/price/compatibility are frozen at
// publish time and never touched here (see the Phase 1 design note on
// CommunityBuild.js: the post doesn't stay live-linked to the source Build).
const updateBuild = asyncHandler(async (req, res) => {
  const build = await CommunityBuild.findById(req.params.id);
  if (!build) {
    res.status(404);
    throw new Error('Community build not found.');
  }
  if (build.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You can only edit your own community build.');
  }

  const errors = validateCommunityBuildInput(req.body, { partial: true });
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join(' '));
  }

  if (req.body.title !== undefined) build.title = req.body.title.trim();
  if (req.body.description !== undefined) build.description = req.body.description;
  if (req.body.category !== undefined) build.category = req.body.category;
  if (req.body.visibility !== undefined) build.visibility = req.body.visibility;
  if (req.body.image !== undefined) build.image = req.body.image;
  if (req.body.tags !== undefined) {
    build.tags = req.body.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  }

  await build.save();
  res.json({ success: true, build: publicSummary(build, { isOwner: true }) });
});

// DELETE /api/community/builds/:id — a real delete (author removing their
// own post, not a moderation action — see adminCommunityController.js for
// the admin hide/unhide path), cascading to every row that references it so
// nothing dangling is left behind for the feed/admin queues to trip over.
const deleteBuild = asyncHandler(async (req, res) => {
  const build = await CommunityBuild.findById(req.params.id);
  if (!build) {
    res.status(404);
    throw new Error('Community build not found.');
  }
  if (build.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('You can only delete your own community build.');
  }

  await Promise.all([
    BuildLike.deleteMany({ communityBuild: build._id }),
    BuildRating.deleteMany({ communityBuild: build._id }),
    Comment.deleteMany({ communityBuild: build._id }),
    Report.deleteMany({ targetType: 'communityBuild', targetId: build._id }),
    build.deleteOne(),
  ]);

  res.json({ success: true, message: 'Community build deleted.' });
});

// POST /api/community/builds/:id/like — toggle. Check-then-act (not a
// single atomic op) matches this codebase's existing style for this kind of
// low-stakes toggle (see wishlistController.moveToCart) rather than
// reaching for a transaction over a "like" button.
const toggleLike = asyncHandler(async (req, res) => {
  const build = await CommunityBuild.findById(req.params.id);
  if (!build || !canView(build, req.user)) {
    res.status(404);
    throw new Error('Community build not found.');
  }

  const existing = await BuildLike.findOneAndDelete({ user: req.user._id, communityBuild: build._id });
  let liked;
  if (existing) {
    build.likesCount = Math.max(0, build.likesCount - 1);
    liked = false;
  } else {
    await BuildLike.create({ user: req.user._id, communityBuild: build._id });
    build.likesCount += 1;
    liked = true;
  }
  await build.save();

  res.json({ success: true, liked, likesCount: build.likesCount });
});

// POST /api/community/builds/:id/copy — Phase 8. Turns a published post
// into a fresh, compatibility-checked component set the caller can load
// into the /build page or add straight to cart. optionalAuth: copying, like
// the builder itself, must work for guests too (spec section 3 — building
// doesn't require login), and cartController.addCustomBuild already accepts
// guest carts via the x-session-id header, so there's no reason to gate
// this on login either. Owns the copiesCount increment so the frontend
// never has to write that counter directly.
const copyBuild = asyncHandler(async (req, res) => {
  const build = await CommunityBuild.findById(req.params.id);
  if (!build || !canView(build, req.user)) {
    res.status(404);
    throw new Error('Community build not found.');
  }

  // Recompute fresh rather than trusting the snapshot's compatibilityStatus —
  // same "recompute at the point of use" rule publishBuild itself already
  // follows against the *source* Build, since prices/stock/specs may have
  // drifted since this post went up.
  const components = await loadBuildComponents(build);
  const report = checkBuildCompatibility(components);
  const orderable = isBuildOrderable(components, report);

  // Same trade-off already made for viewsCount: a cheap, unconditional
  // counter, except the owner copying their own post doesn't inflate their
  // own stat.
  const isOwner = Boolean(req.user) && build.user.toString() === req.user._id.toString();
  let copiesCount = build.copiesCount;
  if (!isOwner) {
    const updated = await CommunityBuild.findByIdAndUpdate(
      build._id,
      { $inc: { copiesCount: 1 } },
      { new: true }
    );
    copiesCount = updated.copiesCount;
  }

  res.json({
    success: true,
    components,
    report,
    orderable,
    total: totalPrice(components),
    copiesCount,
  });
});

module.exports = {
  publishBuild,
  listBuilds,
  getMyBuilds,
  getBuildById,
  updateBuild,
  deleteBuild,
  toggleLike,
  copyBuild,
  canView,
};
