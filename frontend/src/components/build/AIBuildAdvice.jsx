import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';

export default function AIBuildAdvice({ components }) {
  const [enabled, setEnabled] = useState(null);
  const [statusError, setStatusError] = useState(false);
  const [state, setState] = useState('idle');
  const [advice, setAdvice] = useState('');
  const [message, setMessage] = useState('');
  const version = useRef(0);
  const signature = JSON.stringify(components);
  const currentSignature = useRef(signature);
  currentSignature.current = signature;

  useEffect(() => {
    let active = true;
    api.get('/recommendations/ai-status').then(({ data }) => {
      if (active) { setEnabled(data.enabled); setStatusError(false); }
    }).catch(() => { if (active) setStatusError(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    version.current += 1;
    setAdvice(''); setMessage(''); setState('idle');
    return () => { version.current += 1; };
  }, [signature]);

  async function requestAdvice() {
    const request = ++version.current;
    const requestedSignature = signature;
    setState('loading'); setMessage('');
    try {
      const { data } = await api.post('/recommendations/build-advice', { components });
      if (request !== version.current || requestedSignature !== currentSignature.current) return;
      setEnabled(data.enabled); setStatusError(false);
      if (!data.enabled) { setState('idle'); return; }
      if (!data.advice) throw new Error('AI advice is temporarily unavailable. Please try again.');
      setAdvice(data.advice); setState('success');
    } catch (error) {
      if (request !== version.current || requestedSignature !== currentSignature.current) return;
      setMessage(error.message || 'Could not get AI advice. Please try again.'); setState('error');
    }
  }

  const hasParts = Object.keys(components).length > 0;
  return (
    <section className="mt-5 border border-border-soft rounded p-5 bg-raised" aria-labelledby="ai-advice-title">
      <h2 id="ai-advice-title" className="text-sm font-medium text-ink">AI build advisor</h2>
      <p className="text-xs text-muted mt-2">Get a short explanation of your selected parts, possible uses, and compatibility concerns.</p>
      <div className="mt-3 text-sm text-muted" aria-live="polite" aria-atomic="true">
        {enabled === false && <p>AI advice is not enabled yet. Compatibility checks and part suggestions are available below and alongside your build.</p>}
        {enabled === null && !statusError && <p>Checking availability…</p>}
        {statusError && <p>Could not check AI availability. Choose a part and try requesting advice.</p>}
        {enabled !== false && !hasParts && <p className="mt-2">Choose at least one part to get advice.</p>}
        {state === 'loading' && <p>Reviewing your build…</p>}
        {state === 'success' && <p className="whitespace-pre-wrap leading-relaxed">{advice}</p>}
        {state === 'error' && <p className="text-stock-low">{message}</p>}
      </div>
      {(enabled === true || statusError) && <>
        <p className="text-xs text-faint mt-3">Requesting advice sends the selected part names and compatibility findings to Google Gemini. AI advice may contain mistakes; review the compatibility checks.</p>
        <button type="button" onClick={requestAdvice} disabled={!hasParts || state === 'loading'}
          className="mt-3 w-full border border-accent rounded px-3 py-2 text-sm text-ink hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed">
          {state === 'loading' ? 'Getting advice…' : state === 'error' ? 'Try again' : state === 'success' ? 'Refresh advice' : 'Get AI advice'}
        </button>
      </>}
    </section>
  );
}
