import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import ProductCard from '../components/ProductCard';
import CategoryIcon from '../components/CategoryIcon';
import { CATEGORY_LABELS } from '../utils/specs';

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [{ data: fData }, { data: cData }] = await Promise.all([
          api.get('/products/featured'),
          api.get('/categories'),
        ]);
        if (!cancelled) {
          setFeatured(fData.products);
          setCategories(cData.categories);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="max-w-content mx-auto px-4 sm:px-6 pt-14 pb-16 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-ink leading-[1.08] max-w-lg">
            Every part checked against every other part.
          </h1>
          <p className="mt-5 text-muted max-w-md leading-relaxed">
            Browse CPUs, GPUs, motherboards and the rest of a build individually, or let the
            compatibility engine flag socket, wattage and clearance conflicts before they reach
            your cart. Prices in NPR, stock tracked live.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop" className="btn-primary">
              Browse parts
            </Link>
            <Link to="/build" className="btn-secondary">
              Start a build
            </Link>
          </div>
        </div>

        {/* Schematic panel: grounds the hero in the actual product (the
            compatibility engine) instead of generic imagery. */}
        <div className="border border-border rounded bg-surface overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border-soft flex items-center justify-between">
            <span className="font-mono text-xs text-faint">build-check.log</span>
            <span className="flex items-center gap-1.5 text-xs font-mono text-stock-in">
              <span className="w-1.5 h-1.5 rounded-full bg-stock-in" /> compatible
            </span>
          </div>
          <div className="p-4">
            <div className="spec-row">
              <span className="spec-label">CPU socket</span>
              <span className="spec-value">AM5</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Motherboard socket</span>
              <span className="spec-value">AM5 ✓</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">RAM type</span>
              <span className="spec-value">DDR5 ✓</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">GPU length vs. case</span>
              <span className="spec-value">310mm / 325mm ✓</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">PSU wattage</span>
              <span className="spec-value">850W ✓</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Cooler clearance</span>
              <span className="spec-value">158mm / 165mm ✓</span>
            </div>
          </div>
        </div>
      </section>

      {/* Category tiles */}
      <section className="max-w-content mx-auto px-4 sm:px-6 py-10">
        <h2 className="text-sm font-medium text-muted mb-4">Shop by part</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(categories.length ? categories : Object.keys(CATEGORY_LABELS).map((slug) => ({ slug, count: null }))).map(
            (c) => (
              <Link
                key={c.slug}
                to={`/shop?category=${c.slug}`}
                className="group flex flex-col gap-3 border border-border-soft hover:border-border rounded p-4 transition-colors"
              >
                <CategoryIcon category={c.slug} className="w-6 h-6 text-muted group-hover:text-accent transition-colors" />
                <div>
                  <p className="text-sm text-ink">{CATEGORY_LABELS[c.slug]}</p>
                  {c.count !== null && <p className="text-xs font-mono text-faint mt-0.5">{c.count} items</p>}
                </div>
              </Link>
            )
          )}
        </div>
      </section>

      {/* Featured products */}
      <section className="max-w-content mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted">Featured</h2>
          <Link to="/shop" className="text-sm text-faint hover:text-ink">
            View all
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-faint">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
