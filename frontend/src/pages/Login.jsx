import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Login() {
  const { login } = useAuth();
  const { refresh: refreshCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await login(form);
    setSubmitting(false);
    if (res.ok) {
      // Logging in merges the guest cart server-side (business rule) — pull
      // the merged cart so the navbar/cart page reflect it right away.
      await refreshCart();
      navigate(from, { replace: true });
    } else {
      setError(res.message);
    }
  }

  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-16">
      <div className="max-w-sm mx-auto">
        <p className="font-mono text-xs text-faint mb-3">Account</p>
        <h1 className="font-display text-2xl font-semibold text-ink mb-8">Log in</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input-field w-full"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="input-field w-full"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-stock-out">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="text-sm text-faint mt-6 text-center">
          Don&apos;t have an account?{' '}
          <Link to="/register" state={{ from }} className="text-ink underline underline-offset-4 hover:text-accent">
            Create one
          </Link>
        </p>

        <div className="mt-8 border-t border-border-soft pt-4">
          <p className="text-xs text-faint">
            Dev seed accounts: <span className="font-mono text-muted">customer@buildforge.com</span> /{' '}
            <span className="font-mono text-muted">ChangeMe123!</span> (or{' '}
            <span className="font-mono text-muted">admin@buildforge.com</span> for the admin role)
          </p>
        </div>
      </div>
    </div>
  );
}
