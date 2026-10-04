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
  const [loadError, setLoadError] = useState('');

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
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
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
      <section className="max-w-content mx-auto px-4 sm:px-6 pt-10 pb-14">
        <div className="relative overflow-hidden rounded-[24px] border border-border-soft bg-surface px-6 py-12 sm:px-10 lg:px-14 lg:py-16 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center shadow-[0_24px_70px_-48px_rgba(23,37,43,0.35)]">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-accent-soft blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent">Build smarter, from the first part</p>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-ink leading-[1.04] max-w-xl tracking-tight">
            Your next PC starts with the right parts.
          </h1>
          <p className="mt-6 text-muted max-w-lg leading-relaxed text-base sm:text-lg">
            Explore components, compare your choices, and catch compatibility issues before checkout. Build with confidence, priced in NPR.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop" className="btn-primary">
              Shop components <span aria-hidden="true">↗</span>
            </Link>
            <Link to="/build" className="btn-secondary">
              Open PC builder
            </Link>
          </div>
        </div>

        {/* Schematic panel: grounds the hero in the actual product (the
            compatibility engine) instead of generic imagery. */}
        <div className="relative border border-border-soft rounded-[18px] bg-base overflow-hidden shadow-[0_24px_50px_-32px_rgba(23,37,43,0.42)]">
          <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between bg-surface">
            <span className="font-display font-semibold text-sm text-ink">Compatibility preview</span>
            <span className="flex items-center gap-1.5 text-xs font-mono text-stock-in">
              <span className="w-1.5 h-1.5 rounded-full bg-stock-in" /> All checks pass
            </span>
          </div>
          <div className="p-5 sm:p-6">
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
            <p className="mt-5 text-xs text-muted">A sample of the checks available in the PC builder.</p>
          </div>
        </div>
        </div>
      </section>

      {loadError && <p role="alert" className="max-w-content mx-auto px-4 sm:px-6 text-stock-out text-sm">The catalog is temporarily unavailable. Please try again shortly.</p>}
      {/* Category tiles */}
      <section className="max-w-content mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Find your fit</p><h2 className="mt-2 font-display text-2xl sm:text-3xl font-semibold text-ink">Shop by part</h2></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(categories.length ? categories : Object.keys(CATEGORY_LABELS).map((slug) => ({ slug, count: null }))).map(
            (c) => (
              <Link
                key={c.slug}
                to={`/shop?category=${c.slug}`}
                className="group flex flex-col gap-5 border border-border-soft hover:border-accent/50 bg-surface rounded-[16px] p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded bg-accent-soft"><CategoryIcon category={c.slug} className="w-6 h-6 text-accent" /></span>
                <div>
                  <p className="font-display font-semibold text-ink">{CATEGORY_LABELS[c.slug]}</p>
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
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">The catalog</p><h2 className="mt-2 font-display text-2xl sm:text-3xl font-semibold text-ink">Featured parts</h2></div>
          <Link to="/shop" className="text-sm font-medium text-accent hover:text-accent-hover">
            View all parts →
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
