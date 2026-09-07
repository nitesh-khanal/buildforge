/**
 * Optional AI layer on top of the rule-based recommendation engine.
 *
 * OFF BY DEFAULT: every function here is a no-op unless GEMINI_API_KEY is
 * set in the environment. The rule-based engine in recommendationService.js
 * is fully functional without this file — this only adds an optional
 * natural-language "why this build works" blurb on top of it. If the call
 * fails or the key is missing, callers get `null` back and should just
 * hide/skip the AI section rather than treat it as an error.
 *
 * Uses the classic `generateContent` REST endpoint (still fully supported
 * as of writing). Model name and endpoint shape can change over time —
 * double check https://ai.google.dev/api before relying on this in
 * production, and swap GEMINI_MODEL below if Google deprecates it.
 */

const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function isEnabled() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function buildPrompt(components, report) {
  const parts = Object.entries(components || {})
    .filter(([, product]) => product)
    .map(([slot, product]) => `- ${slot}: ${product.name}`)
    .join('\n');

  const issuesText = (report?.issues || [])
    .map((i) => `- [${i.level}] ${i.message}`)
    .join('\n') || 'None';

  return [
    'You are a concise PC-building assistant for an e-commerce site.',
    'Given this selected build and its compatibility report, write a short',
    '(2-3 sentence) plain-text summary of the build for a shopper — mention',
    'what it is good for (e.g. gaming, productivity) and note any issues in',
    'friendly terms. No markdown, no headers, just prose.',
    '',
    'Selected components:',
    parts || '(none selected yet)',
    '',
    'Compatibility issues:',
    issuesText,
  ].join('\n');
}

// Returns a short natural-language blurb about a build, or null if the
// feature is disabled or the call fails for any reason.
async function generateBuildAdvice({ components, report }) {
  if (!isEnabled()) return null;

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(components, report) }] }],
      }),
    });

    if (!response.ok) {
      console.error('Gemini API returned', response.status);
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch (err) {
    // Never let an AI failure break the rule-based recommendations that
    // already shipped successfully — this is a pure enhancement.
    console.error('Gemini recommendation call failed:', err.message);
    return null;
  }
}

module.exports = { isEnabled, generateBuildAdvice };
