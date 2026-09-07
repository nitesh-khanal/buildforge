import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { formatNPR } from '../../utils/format';
import { CATEGORY_LABELS } from '../../utils/specs';
import StatCard from '../../components/admin/StatCard';

function SalesChart({ sales }) {
  if (sales.length === 0) {
    return <p className="text-sm text-faint py-8 text-center">No confirmed sales in this window yet.</p>;
  }
  const max = Math.max(...sales.map((s) => s.revenue), 1);
  return (
    <div className="flex items-end gap-1 h-40">
      {sales.map((s) => (
        <div key={s.date} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group relative">
          <div
            className="w-full bg-accent/70 group-hover:bg-accent rounded-t transition-colors"
            style={{ height: `${Math.max(2, (s.revenue / max) * 100)}%` }}
          />
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:block bg-surface border border-border-soft rounded px-2 py-1 text-[10px] font-mono text-ink whitespace-nowrap z-10">
            {s.date} · {formatNPR(s.revenue)}
          </div>
        </div>
      ))}
    </div>
  );
}

function TopProducts({ products }) {
  if (products.length === 0) return <p className="text-sm text-faint py-4">No sales yet.</p>;
  const max = Math.max(...products.map((p) => p.unitsSold), 1);
  return (
    <div className="space-y-3">
      {products.map((p, i) => (
        <div key={p.productId || i} className="flex items-center gap-3">
          <span className="w-5 shrink-0 text-xs font-mono text-faint text-right">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm text-ink truncate">{p.name}</p>
              <p className="text-xs font-mono text-muted shrink-0">{p.unitsSold} sold</p>
            </div>
            <div className="h-1.5 bg-raised rounded mt-1 overflow-hidden">
              <div className="h-full bg-accent rounded" style={{ width: `${(p.unitsSold / max) * 100}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryBreakdown({ breakdown }) {
  if (breakdown.length === 0) return <p className="text-sm text-faint py-4">No sales yet.</p>;
  const totalRevenue = breakdown.reduce((sum, b) => sum + b.revenue, 0) || 1;
  return (
    <div className="space-y-3">
      {breakdown.map((b) => (
        <div key={b.category} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-sm text-ink truncate">{CATEGORY_LABELS[b.category] || b.category}</span>
          <div className="flex-1 h-1.5 bg-raised rounded overflow-hidden">
            <div className="h-full bg-accent rounded" style={{ width: `${(b.revenue / totalRevenue) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-xs font-mono text-muted text-right">{formatNPR(b.revenue)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [sales, setSales] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/admin/analytics/overview'),
      api.get('/admin/analytics/sales', { params: { period: 'daily', days } }),
      api.get('/admin/analytics/top-products', { params: { limit: 8 } }),
      api.get('/admin/analytics/category-breakdown'),
    ])
      .then(([ov, sl, tp, cb]) => {
        if (cancelled) return;
        setOverview(ov.data.overview);
        setSales(sl.data.sales);
        setTopProducts(tp.data.topProducts);
        setBreakdown(cb.data.breakdown);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded border border-border-soft bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-stock-out">{error}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total revenue" value={formatNPR(overview.totalRevenue)} sub={`${overview.confirmedOrders} confirmed orders`} />
        <StatCard label="Discounts given" value={formatNPR(overview.totalDiscountGiven)} sub="confirmed orders, coupons" />
        <StatCard label="Average order value" value={formatNPR(overview.averageOrderValue)} />
        <StatCard label="Total orders" value={overview.totalOrders} sub={`${overview.pendingOrders} pending`} tone={overview.pendingOrders > 0 ? 'warn' : undefined} />
        <StatCard label="Customers" value={overview.totalCustomers} />
        <StatCard label="Products in catalog" value={overview.totalProducts} />
        <StatCard label="Low stock" value={overview.lowStockCount} tone={overview.lowStockCount > 0 ? 'warn' : undefined} sub="3 units or fewer" />
        <StatCard label="Out of stock" value={overview.outOfStockCount} tone={overview.outOfStockCount > 0 ? 'bad' : undefined} />
        <StatCard label="Pending orders" value={overview.pendingOrders} tone={overview.pendingOrders > 0 ? 'warn' : undefined} />
      </div>

      <div className="border border-border-soft rounded p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-ink">Revenue, last {days} days</h2>
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  days === d ? 'bg-accent text-ink' : 'text-muted hover:text-ink hover:bg-raised'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <SalesChart sales={sales} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="border border-border-soft rounded p-5">
          <h2 className="text-sm font-medium text-ink mb-4">Top selling products</h2>
          <TopProducts products={topProducts} />
        </div>
        <div className="border border-border-soft rounded p-5">
          <h2 className="text-sm font-medium text-ink mb-4">Revenue by category</h2>
          <CategoryBreakdown breakdown={breakdown} />
        </div>
      </div>
    </div>
  );
}
