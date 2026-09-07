import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../lib/api';
import { useCart } from '../context/CartContext';
import { formatNPR } from '../utils/format';
import { getSpecEntries, CATEGORY_LABELS } from '../utils/specs';
import StockBadge from '../components/StockBadge';
import QuantityStepper from '../components/QuantityStepper';
import ProductCard from '../components/ProductCard';
import ReviewsSection from '../components/review/ReviewsSection';

const WORKS_WITH_LABELS = {
  compatibleMotherboards: 'Compatible motherboards',
  compatibleCpus: 'Compatible CPUs',
  compatibleRam: 'Compatible RAM',
  compatibleCases: 'Compatible cases',
  compatibleGpus: 'Compatible GPUs',
  compatibleCpuCoolers: 'Compatible CPU coolers',
  recommendedPsus: 'Recommended PSUs',
  recommendedForGpus: 'Recommended for these GPUs',
};

function apiOrigin() {
  return import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
}

export default function ProductDetail() {
  const { id } = useParams();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [worksWith, setWorksWith] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [qty, setQty] = useState(1);
  const [addState, setAddState] = useState('idle');
  const [addError, setAddError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setQty(1);
    setAddState('idle');

    api
      .get(`/products/${id}`)
      .then(({ data }) => {
        if (cancelled) return;
        setProduct(data.product);
        return Promise.all([
          api.get(`/products/${id}/related`).catch(() => ({ data: { products: [] } })),
          api.get(`/products/${id}/works-with`).catch(() => ({ data: { worksWith: {} } })),
        ]);
      })
      .then((results) => {
        if (cancelled || !results) return;
        const [relatedRes, worksWithRes] = results;
        setRelated(relatedRes.data.products);
        setWorksWith(worksWithRes.data.worksWith);
      })
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleAdd() {
    setAddState('adding');
    setAddError(null);
    const res = await addItem(product._id, qty);
    if (res.ok) {
      setAddState('added');
      setTimeout(() => setAddState('idle'), 1600);
    } else {
      setAddState('error');
      setAddError(res.message);
    }
  }

  if (loading) {
    return <div className="max-w-content mx-auto px-4 sm:px-6 py-16 text-sm text-faint">Loading…</div>;
  }

  if (notFound || !product) {
    return (
      <div className="max-w-content mx-auto px-4 sm:px-6 py-24 text-center">
        <h1 className="font-display text-xl text-ink mb-2">Product not found</h1>
        <p className="text-muted mb-6">It may have been removed or the link is wrong.</p>
        <Link to="/shop" className="btn-secondary inline-flex">
          Back to shop
        </Link>
      </div>
    );
  }

  const specs = getSpecEntries(product);
  const outOfStock = product.stockStatus === 'out-of-stock' || product.isArchived;
  const worksWithGroups = Object.entries(worksWith || {}).filter(([, list]) => list?.length);

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-10">
      <nav className="text-xs font-mono text-faint mb-6">
        <Link to="/shop" className="hover:text-ink">
          Shop
        </Link>
        {' / '}
        <Link to={`/shop?category=${product.category}`} className="hover:text-ink">
          {CATEGORY_LABELS[product.category]}
        </Link>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10">
        <div className="aspect-square bg-surface border border-border-soft rounded flex items-center justify-center overflow-hidden">
          <img
            src={product.image?.startsWith('http') ? product.image : `${apiOrigin()}${product.image}`}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        <div>
          <p className="text-xs font-mono text-faint uppercase tracking-wide">{product.brand}</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink mt-1 leading-tight">
            {product.name}
          </h1>

          {product.isArchived && (
            <p className="text-sm text-stock-out bg-accent-soft/40 border border-stock-out/40 rounded px-3 py-2 mt-4">
              This product has been discontinued and is no longer available to purchase.
            </p>
          )}

          <div className="flex items-center gap-4 mt-3">
            {product.rating > 0 && (
              <span className="text-sm font-mono text-muted">
                ★ {product.rating.toFixed(1)}
                {product.numReviews > 0 && ` (${product.numReviews})`}
              </span>
            )}
            {!product.isArchived && <StockBadge status={product.stockStatus} stock={product.stock} />}
          </div>

          <p className="font-display text-3xl font-semibold text-ink mt-6">{formatNPR(product.price)}</p>

          {product.description && <p className="text-muted mt-4 leading-relaxed max-w-md">{product.description}</p>}

          <div className="flex items-center gap-3 mt-7">
            <QuantityStepper value={qty} max={product.stock || 1} onChange={setQty} disabled={outOfStock} />
            <button
              type="button"
              onClick={handleAdd}
              disabled={outOfStock || addState === 'adding'}
              className="btn-primary"
            >
              {product.isArchived
                ? 'No longer available'
                : outOfStock
                ? 'Out of stock'
                : addState === 'added'
                ? 'Added to cart ✓'
                : addState === 'adding'
                ? 'Adding…'
                : 'Add to cart'}
            </button>
          </div>
          {addError && <p className="text-sm text-stock-out mt-2">{addError}</p>}

          {specs.length > 0 && (
            <div className="mt-10">
              <h2 className="text-sm font-medium text-ink mb-2">Specifications</h2>
              <dl className="border border-border-soft rounded px-4">
                {specs.map(([label, value]) => (
                  <div key={label} className="spec-row">
                    <dt className="spec-label">{label}</dt>
                    <dd className="spec-value">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {worksWithGroups.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-lg font-semibold text-ink mb-6">Works with</h2>
          <div className="space-y-10">
            {worksWithGroups.map(([key, list]) => (
              <div key={key}>
                <h3 className="text-sm font-medium text-muted mb-4">{WORKS_WITH_LABELS[key] || key}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {list.slice(0, 4).map((p) => (
                    <ProductCard key={p._id} product={p} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-lg font-semibold text-ink mb-6">You might also consider</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {related.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </section>
      )}

      <ReviewsSection productId={product._id} />
    </div>
  );
}
