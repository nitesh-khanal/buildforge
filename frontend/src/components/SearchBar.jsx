import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { formatNPR } from '../utils/format';

export default function SearchBar({ className = '' }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const { data } = await api.get('/products/search/suggestions', { params: { q: query } });
        setSuggestions(data.suggestions);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function submit(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setOpen(false);
    navigate(`/shop?search=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form onSubmit={submit} className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search parts — RTX 4070, AM5, 650W…"
          className="input-field w-full pr-9"
        />
        <button
          type="submit"
          aria-label="Search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </button>
      </form>

      {open && suggestions.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-surface border border-border rounded shadow-xl overflow-hidden">
          {suggestions.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => {
                setOpen(false);
                setQuery('');
                navigate(`/products/${p._id}`);
              }}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-raised transition-colors border-b border-border-soft last:border-b-0"
            >
              <span className="text-sm text-ink truncate">
                <span className="text-faint font-mono text-xs mr-2">{p.brand}</span>
                {p.name}
              </span>
              <span className="text-xs font-mono text-muted shrink-0">{formatNPR(p.price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
