import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Register() {
  const { register } = useAuth();
  const { refresh: refreshCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await register(form);
    setSubmitting(false);
    if (res.ok) {
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
        <h1 className="font-display text-2xl font-semibold text-ink mb-8">Create an account</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">Full name</label>
            <input
              required
              autoComplete="name"
              className="input-field w-full"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </div>
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
            <label className="block text-xs text-muted mb-1.5">Phone <span className="text-faint">(optional)</span></label>
            <input
              autoComplete="tel"
              className="input-field w-full"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="input-field w-full"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-stock-out">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-faint mt-6 text-center">
          Already have an account?{' '}
          <Link to="/login" state={{ from }} className="text-ink underline underline-offset-4 hover:text-accent">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
