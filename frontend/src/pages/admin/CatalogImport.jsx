import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { resolveImageUrl, formatNPR } from '../../utils/format';

export default function CatalogImport() {
  const [rows, setRows] = useState([]);
  const [sources, setSources] = useState([]);
  useEffect(() => {
    fetch('/catalog-starter.json').then((res) => res.json()).then(setSources).catch(() => {});
  }, []);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  async function loadFile(event) {
    setPreview(null); setResult(''); setError(''); setRows([]);
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 180000) throw new Error('Use a JSON file smaller than 180 KB (up to 100 parts per batch).');
      const value = JSON.parse(await file.text());
      if (!Array.isArray(value) || value.length > 100) throw new Error('Choose a JSON array with up to 100 products.');
      setRows(value);
    } catch (err) { setError(err.message); }
  }
  async function photo(index, file) {
    if (!file) return;
    setBusy(true); setPreview(null); setError('');
    try {
      const body = new FormData(); body.append('image', file);
      const { data } = await api.post('/admin/products/catalog/photo', body);
      setRows((current) => current.map((row, i) => i === index ? { ...row, image: data.image } : row));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function submit(dryRun) {
    setBusy(true); setError(''); setResult('');
    try {
      const { data } = await api.post('/admin/products/catalog/import', { products: rows, dryRun });
      if (dryRun) setPreview(data.products);
      else { setResult(`Imported ${data.count} parts: ${data.created} new, ${data.updated} updated.`); setPreview(null); setRows([]); }
    } catch (err) { setError(err.message); setPreview(null); } finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <div><h2 className="font-display text-xl text-ink font-semibold">Import catalog</h2>
      <p className="text-sm text-muted mt-2">Add supplier product data with photos. SKU identifies each part. Preview checks the batch before anything is saved.</p></div>
    <div className="border border-border-soft rounded p-5 space-y-3 text-sm text-muted">
      <p>Start with the template, enter supplier prices in NPR, available quantities and reviewed compatibility specifications. Use your own photos or photos you have permission to publish.</p>
      <p>Parts remain archived drafts until both commercial data and compatibility are marked reviewed. Importing an existing SKU updates that part; it preserves customer reviews.</p>
      <a href="/catalog-template.json" download className="text-accent underline">Download template for all eight part categories</a>
    </div>
    <details className="border border-border-soft rounded p-5 text-sm text-muted space-y-3">
      <summary className="cursor-pointer text-ink">Find part specifications and photos</summary>
      <p className="mt-3">Ask your supplier for exact model numbers, current NPR prices, stock and authorized images. Open Icecat can provide brand-authorized content after registration; download approved images to your own storage before uploading here.</p>
      <a className="block text-accent underline" href="https://icecat.com/content-subscription/" target="_blank" rel="noreferrer">Open Icecat content access</a>
      <p>These manufacturer pages are starting points for specifications and identifying the correct model. Image publication rights and local availability still need confirmation.</p>
      <ul className="space-y-2">{sources.map((part) => <li key={part.sku}><a className="text-accent underline" href={part.sourceUrl} target="_blank" rel="noreferrer">{part.name}</a></li>)}</ul>
      <a href="/catalog-starter.json" download className="block text-accent underline">Download these eight research drafts</a>
    </details>
    <label className="block text-sm text-ink">Supplier JSON file
      <input type="file" accept=".json,application/json" onChange={loadFile} disabled={busy} className="block mt-2 text-muted" /></label>
    {error && <p role="alert" className="text-stock-out text-sm whitespace-pre-line">{error}</p>}
    {result && <p role="status" className="text-accent">{result}</p>}
    <div className="grid sm:grid-cols-2 gap-3">{rows.map((row, index) => <div key={index} className="border border-border-soft rounded p-4 space-y-2">
      <p className="text-ink font-medium">{row.name || `Part ${index + 1}`}</p><p className="text-sm text-faint">{row.sku} · {formatNPR(row.price)} · Stock {row.stock}</p>
      {row.image && <img src={resolveImageUrl(row.image)} alt={row.name || 'Product preview'} className="h-32 w-full object-contain bg-white rounded" />}
      <label className="block text-sm text-muted">Upload product photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => photo(index, event.target.files[0])} className="block text-xs mt-1" /></label>
    </div>)}</div>
    {rows.length > 0 && <button type="button" onClick={() => submit(true)} disabled={busy} className="btn-secondary">{busy ? 'Checking…' : 'Preview import'}</button>}
    {preview && <div className="border border-accent rounded p-5 space-y-3"><p className="text-ink">{preview.length} parts validated. {preview.filter((row) => row.catalogVerified).length} ready for sale; the rest will be archived drafts.</p>
      <button type="button" onClick={() => submit(false)} disabled={busy} className="btn-primary">{busy ? 'Importing…' : 'Import validated parts'}</button></div>}
  </div>;
}
