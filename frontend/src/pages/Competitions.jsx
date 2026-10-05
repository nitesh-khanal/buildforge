import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import Pagination from '../components/Pagination';

export function rewardLabel(r) {
  return `${r.discountType === 'percentage' ? `${r.discountValue}%` : `NPR ${r.discountValue}`} off${r.discountType === 'percentage' && r.maxDiscountAmount ? `, up to NPR ${r.maxDiscountAmount}` : ''}`;
}
export function dateLabel(date) { return new Date(date).toLocaleString(); }
const blankReward = () => ({ discountType: 'percentage', discountValue: 10, minOrderAmount: 0, maxDiscountAmount: '', validityDays: 30 });

function CompetitionForm({ onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', startsAt: '', endsAt: '', rewards: [blankReward(), blankReward(), blankReward()] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const reward = (i, field, value) => setForm(f => ({ ...f, rewards: f.rewards.map((r, j) => j === i ? { ...r, [field]: value } : r) }));
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (new Date(form.endsAt) <= new Date(form.startsAt)) throw new Error('End time must be after start time.');
      await api.post('/admin/competitions', { ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), rewards: form.rewards.map(r => ({ ...r, discountValue: Number(r.discountValue), minOrderAmount: Number(r.minOrderAmount), maxDiscountAmount: r.discountType !== 'percentage' || r.maxDiscountAmount === '' ? null : Number(r.maxDiscountAmount), validityDays: Number(r.validityDays) })) });
      setForm({ title: '', description: '', startsAt: '', endsAt: '', rewards: [blankReward(), blankReward(), blankReward()] });
      onCreated();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="border border-border-soft rounded p-4 sm:p-6 space-y-5 mb-8">
    <h2 className="text-lg font-semibold">Create a competition</h2>
    <label className="block text-sm">Title<input required maxLength={100} className="input-field block h-11 min-w-0 w-full mt-2" value={form.title} onChange={e => update('title', e.target.value)} /></label>
    <label className="block text-sm">Description and rules<textarea rows={3} maxLength={2000} className="input-field block min-w-0 w-full mt-2 resize-y" value={form.description} onChange={e => update('description', e.target.value)} /></label>
    <div className="grid sm:grid-cols-2 items-end gap-4">
      <label className="block min-w-0 text-sm">Starts<input required type="datetime-local" className="input-field block h-11 min-w-0 w-full mt-2" value={form.startsAt} onChange={e => update('startsAt', e.target.value)} /></label>
      <label className="block min-w-0 text-sm">Ends<input required type="datetime-local" className="input-field block h-11 min-w-0 w-full mt-2" value={form.endsAt} onChange={e => update('endsAt', e.target.value)} /></label>
    </div>
    <p className="text-xs text-muted">Dates use your browser’s local time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Entry and voting close together at the end time.</p>
    {form.rewards.map((r, i) => <fieldset key={i} className="min-w-0 border border-border-soft rounded p-4 sm:p-5"><legend className="px-2 text-sm font-semibold">Place {i + 1} coupon</legend><div className="grid sm:grid-cols-2 xl:grid-cols-3 items-end gap-x-4 gap-y-5">
      <label className="block min-w-0 text-sm">Discount type<select className="input-field block h-11 min-w-0 w-full mt-2" value={r.discountType} onChange={e => reward(i, 'discountType', e.target.value)}><option value="percentage">Percentage</option><option value="fixed">Fixed NPR</option></select></label>
      <label className="block min-w-0 text-sm">Discount value<input required type="number" min="1" max={r.discountType === 'percentage' ? 100 : undefined} className="input-field block h-11 min-w-0 w-full mt-2" value={r.discountValue} onChange={e => reward(i, 'discountValue', e.target.value)} /></label>
      <label className="block min-w-0 text-sm">Minimum order (NPR)<input required type="number" min="0" className="input-field block h-11 min-w-0 w-full mt-2" value={r.minOrderAmount} onChange={e => reward(i, 'minOrderAmount', e.target.value)} /></label>
      {r.discountType === 'percentage' && <label className="block min-w-0 text-sm">Maximum discount (NPR, optional)<input type="number" min="1" className="input-field block h-11 min-w-0 w-full mt-2" value={r.maxDiscountAmount} onChange={e => reward(i, 'maxDiscountAmount', e.target.value)} /></label>}
      <label className="block min-w-0 text-sm">Coupon validity (days)<input required type="number" min="1" max="365" step="1" className="input-field block h-11 min-w-0 w-full mt-2" value={r.validityDays} onChange={e => reward(i, 'validityDays', e.target.value)} /></label>
    </div></fieldset>)}
    <p className="text-sm text-muted">One entry per customer. The three builds with the most competition likes win. Ties go to the earlier entry. Ratings do not determine winners. Rewards are single-use and belong to the winning account. Competition dates and rewards are fixed once created.</p>
    {error && <p role="alert" className="text-stock-out">{error}</p>}
    <button disabled={busy} className="btn-primary">{busy ? 'Creating…' : 'Create competition'}</button>
  </form>;
}

export default function Competitions({ admin = false }) {
  const [data, setData] = useState({ competitions: [], pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { const { data: result } = await api.get(admin ? '/admin/competitions' : '/competitions', { params: { page } }); setData(result); setError(''); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [admin, page]);
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [load]);
  return <div className={admin ? '' : 'max-w-content mx-auto px-4 sm:px-6 py-10'}>
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6"><div><h1 className="font-display text-2xl font-semibold">Build competitions</h1><p className="text-sm text-muted mt-2">Share your build, collect likes, and win discount coupons.</p></div><Link to="/account/coupons" className="btn-secondary shrink-0 self-start sm:self-center">My coupons</Link></div>
    {admin && <CompetitionForm onCreated={load} />}
    {error && <p role="alert" className="text-stock-out mb-4">{error}</p>}
    {loading ? <p>Loading competitions…</p> : data.competitions.length === 0 ? <p className="text-muted">No competitions yet.</p> : <div className="grid md:grid-cols-2 gap-5">{data.competitions.map(c => <article key={c._id} className="border border-border-soft rounded p-5 space-y-3">
      <span className="text-xs uppercase text-accent">{c.phase}</span><h2 className="text-xl font-semibold">{c.title}</h2><p className="text-sm text-muted whitespace-pre-wrap">{c.description}</p>
      <p className="block min-w-0 text-sm">{dateLabel(c.startsAt)} → {dateLabel(c.endsAt)}</p>
      <ol className="list-decimal ml-5 text-sm space-y-1">{c.rewards.map((r,i) => <li key={i}>{rewardLabel(r)} · valid {r.validityDays} days after award</li>)}</ol>
      <Link className="btn-secondary inline-flex" to={`/competitions/${c._id}`}>{c.phase === 'finished' ? 'View winners' : 'View competition'}</Link>
    </article>)}</div>}
    <Pagination page={page} pages={data.pages} onChange={setPage} />
  </div>;
}
