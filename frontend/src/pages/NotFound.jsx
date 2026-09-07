import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-24 text-center">
      <p className="font-mono text-5xl text-border mb-4">404</p>
      <h1 className="font-display text-2xl font-semibold text-ink mb-3">Page not found</h1>
      <p className="text-muted">The page you're looking for doesn't exist or was moved.</p>
      <Link to="/" className="btn-primary mt-8 inline-flex">
        Back to home
      </Link>
    </div>
  );
}
