import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { dateLabel, rewardLabel } from './Competitions';
import { formatNPR } from '../utils/format';
export default function MyCoupons() {
  const [coupons,setCoupons] = useState(null);
  const [error,setError] = useState('');
  const [copied,setCopied] = useState('');
  useEffect(()=>{let cancelled=false;api.get('/coupons/mine').then(({data})=>{if(!cancelled)setCoupons(data.coupons);}).catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;};},[]);
  async function copy(code) {try{await navigator.clipboard.writeText(code);setCopied(code);}catch{setError('Select and copy the coupon code below.');}}
  return <div className="max-w-content mx-auto px-4 sm:px-6 py-10 space-y-6"><h1 className="font-display text-2xl font-semibold">My reward coupons</h1><p className="text-muted">Your competition prizes belong to your account. Apply a code in checkout.</p><Link to="/competitions" className="text-accent">Browse competitions →</Link>{error&&<p role="alert" className="text-stock-out">{error}</p>}{!coupons ? !error&&<p>Loading coupons…</p> : !coupons.length ? <p>You haven’t won any reward coupons yet.</p> : <div className="grid md:grid-cols-2 gap-4">{coupons.map(c=>{const state=c.used?'Used':!c.isActive?'Inactive':new Date(c.expiryDate)<new Date()?'Expired':'Available';return <article key={c._id} className="border border-border-soft rounded p-5 space-y-3"><span className="text-xs uppercase text-accent">{state}</span><h2 className="text-xl font-semibold">{rewardLabel(c)}</h2><p>Place #{c.rewardRank} · {c.sourceCompetition?.title || 'Build competition'}</p><p className="text-sm text-muted">Minimum order {formatNPR(c.minOrderAmount)} · expires {dateLabel(c.expiryDate)}</p><code className="block font-mono break-all select-all">{c.code}</code><button className="btn-secondary" onClick={()=>copy(c.code)} disabled={state!=='Available'}>{copied===c.code?'Copied!':'Copy code'}</button></article>;})}</div>}</div>;
}
