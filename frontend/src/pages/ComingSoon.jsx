import { Link } from 'react-router-dom';

export default function ComingSoon({ title, description }) {
  return (
    <div className="max-w-content mx-auto px-4 sm:px-6 py-24 text-center">
      <p className="font-mono text-xs text-faint mb-3">Not built yet</p>
      <h1 className="font-display text-2xl font-semibold text-ink mb-3">{title}</h1>
      <p className="text-muted max-w-md mx-auto">{description}</p>
      <Link to="/shop" className="btn-secondary mt-8 inline-flex">
        Browse parts instead
      </Link>
    </div>
  );
}
