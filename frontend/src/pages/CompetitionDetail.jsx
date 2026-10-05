import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { formatNPR } from '../utils/format';
import { dateLabel, rewardLabel } from './Competitions';

export default function CompetitionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [builds, setBuilds] = useState([]);
  const [buildId, setBuildId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const { data: result } = await api.get(`/competitions/${id}`); setData(result); }
    catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { setData(null); setError(''); load(); const timer = setInterval(load, 15000); return () => clearInterval(timer); }, [load]);
  useEffect(() => {
    let cancelled = false;
    setBuilds([]);
    if (user?.role === 'customer') api.get('/community/builds/mine').then(({data:result}) => { if (!cancelled) setBuilds(result.builds.filter(b => b.visibility === 'public' && b.status === 'visible' && b.compatibilityStatus !== 'error')); }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [user?._id, user?.role]);
  async function act(path, payload, method = 'put') {
    setBusy(true); setError('');
    try { await api[method](path, payload); await load(); } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!data) return <div className="max-w-content mx-auto px-4 py-10">{error ? <p role="alert" className="text-stock-out">{error}</p> : 'Loading competition…'}</div>;
  const { competition: c, entries } = data;
  const open = c.phase === 'active' && new Date() < new Date(c.endsAt);
  const entered = entries.some(e => e.isOwner);
  return <div className="max-w-content mx-auto px-4 sm:px-6 py-10 space-y-6">
    <Link to="/competitions" className="text-accent">← All competitions</Link>
    <header className="space-y-3"><span className="text-xs uppercase text-accent">{c.phase}</span><h1 className="font-display text-3xl font-semibold">{c.title}</h1><p className="text-muted whitespace-pre-wrap">{c.description}</p><p>{dateLabel(c.startsAt)} → {dateLabel(c.endsAt)}</p></header>
    <section className="grid sm:grid-cols-3 gap-4" aria-label="Coupon rewards">{c.rewards.map((r,i) => <div key={i} className="border border-border-soft rounded p-4"><h2 className="font-semibold">Place {i+1}</h2><p className="text-accent mt-2">{rewardLabel(r)}</p><p className="text-sm text-muted">Minimum order: {formatNPR(r.minOrderAmount)} · valid {r.validityDays} days after award · one use</p></div>)}</section>
    <p className="text-sm text-muted">One build per customer. Competition likes decide the top three; earlier entries win ties. Ratings do not affect placement. No self-voting. Builds are saved as submitted; hidden, private, or deleted community posts are disqualified.</p>
    {error && <p role="alert" className="text-stock-out">{error}</p>}
    {c.phase === 'finished' && <section className="border border-accent rounded p-5 space-y-3"><h2 className="text-xl font-semibold">Winners</h2>{c.winners.length ? c.winners.map(w => <p key={w.rank}>#{w.rank} · {w.title} · {w.likes} likes</p>) : <p>No eligible entries were submitted.</p>}<p>Coupons have been added to each winner’s account.</p><Link className="btn-secondary inline-flex" to="/account/coupons">My coupons</Link></section>}
    {open && !user && <Link to="/login" className="btn-primary inline-flex">Log in to enter or vote</Link>}
    {open && user?.role === 'customer' && !entered && <form className="border border-border-soft rounded p-5 space-y-3" onSubmit={e => {e.preventDefault(); act(`/competitions/${id}/entries`, {buildId}, 'post');}}>
      <h2 className="text-lg font-semibold">Enter your build</h2><label className="block text-sm">Your published build<select required className="input-field w-full mt-2" value={buildId} onChange={e => setBuildId(e.target.value)}><option value="">Choose a build</option>{builds.map(b => <option key={b._id} value={b._id}>{b.title}</option>)}</select></label>
      <p className="text-sm text-muted">Create and save a build in the <Link to="/build" className="text-accent underline">PC Builder</Link>, then publish it from your saved builds. <Link to="/community/mine" className="text-accent underline">My community posts</Link></p>
      <button className="btn-primary" disabled={busy || !buildId}>Submit entry</button>
    </form>}
    {entered && <p className="text-accent">Your build is entered.</p>}
    <section className="space-y-4"><h2 className="text-xl font-semibold">{c.phase === 'finished' ? 'Final entries' : 'Leaderboard'}</h2>{entries.length === 0 ? <p className="text-muted">No entries yet.</p> : entries.map((e,i) => <article key={e._id} className="border border-border-soft rounded p-5 space-y-3">
      <div className="flex justify-between gap-4"><div><h3 className="text-lg font-semibold">#{i+1} · {e.title}</h3><p className="text-sm text-muted">By {e.user?.name || 'Community member'}{e.isOwner ? ' · Your entry' : ''}</p></div><p className="text-accent">{e.likes} likes</p></div>
      <p className="text-sm whitespace-pre-wrap">{e.description}</p><p className="font-mono">{formatNPR(e.totalPrice)}</p><ul className="text-sm text-muted space-y-1">{e.parts.map(p => <li key={p._id}>{p.category}: {p.name}</li>)}</ul>
      <p className="text-sm">Rating: {e.ratingCount ? `${e.averageRating.toFixed(1)}/5 (${e.ratingCount})` : 'No ratings yet'}</p>
      {open && user?.role === 'customer' && !e.isOwner && <div className="flex flex-wrap gap-4 items-center"><button className="btn-secondary" disabled={busy} onClick={() => act(`/competitions/${id}/entries/${e._id}/vote`, {liked:!e.isLiked})}>{e.isLiked ? 'Unlike' : 'Like build'}</button><label className="text-sm">Your rating<select className="input-field ml-2" disabled={busy} value={e.myRating || ''} onChange={event => act(`/competitions/${id}/entries/${e._id}/vote`,{rating:event.target.value ? Number(event.target.value) : null})}><option value="">No rating</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} stars</option>)}</select></label></div>}
    </article>)}</section>
  </div>;
}
