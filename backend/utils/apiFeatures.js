// Turns req.query into a Mongoose query for product listing.
// Supports: category, brand, minPrice/maxPrice, rating, availability, search,
// sort, page/limit, plus arbitrary spec filters like socket/vram/wattage
// passed as spec.<field>=value (e.g. spec.socket=AM5).
class ApiFeatures {
  constructor(query, reqQuery) {
    this.query = query;
    this.reqQuery = reqQuery;
    this.filter = {};
  }

  filterBasics() {
    const { category, brand, minPrice, maxPrice, rating, availability, search } = this.reqQuery;

    if (category) this.filter.category = category;
    if (brand) this.filter.brand = new RegExp(`^${escapeRegex(brand)}$`, 'i');

    if (minPrice || maxPrice) {
      this.filter.price = {};
      if (minPrice) this.filter.price.$gte = Number(minPrice);
      if (maxPrice) this.filter.price.$lte = Number(maxPrice);
    }

    if (rating) this.filter.rating = { $gte: Number(rating) };

    if (availability === 'in-stock') this.filter.stock = { $gt: 3 };
    if (availability === 'out-of-stock') this.filter.stock = { $lte: 0 };

    if (search) {
      const re = new RegExp(escapeRegex(search), 'i');
      this.filter.$or = [
        { name: re },
        { brand: re },
        { 'specifications.model': re },
      ];
    }

    this.query = this.query.find(this.filter);
    return this;
  }

  filterSpecs() {
    // Category-specific filters like spec.socket=AM5&spec.cores=8
    const specFilter = {};
    Object.keys(this.reqQuery).forEach((key) => {
      if (key.startsWith('spec.')) {
        const field = key.replace('spec.', '');
        specFilter[`specifications.${field}`] = this.reqQuery[key];
      }
    });
    if (Object.keys(specFilter).length) {
      this.query = this.query.find(specFilter);
    }
    return this;
  }

  sort() {
    const map = {
      'price-asc': 'price',
      'price-desc': '-price',
      newest: '-createdAt',
      rating: '-rating',
      name: 'name',
    };
    const sortBy = map[this.reqQuery.sort] || '-createdAt';
    this.query = this.query.sort(sortBy);
    return this;
  }

  paginate() {
    const page = Math.max(1, Number(this.reqQuery.page) || 1);
    const limit = Math.min(60, Number(this.reqQuery.limit) || 20);
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);
    this.pagination = { page, limit };
    return this;
  }
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = ApiFeatures;
