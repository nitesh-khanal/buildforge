const { generateBuildAdvice } = require('../services/geminiService');

describe('optional AI build advice', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = originalModel;
    jest.restoreAllMocks();
  });
  it('does not contact Google without a key', async () => {
    delete process.env.GEMINI_API_KEY;
    global.fetch = jest.fn();
    expect(await generateBuildAdvice({})).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('sends catalog names and findings, with a backend key and timeout', async () => {
    process.env.GEMINI_API_KEY = 'test-only';
    process.env.GEMINI_MODEL = 'configured-model';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: ' Advice ' }] } }] }) });
    expect(await generateBuildAdvice({ components: { cpu: { name: 'Catalog CPU' } }, report: { issues: [{ level: 'warning', message: 'Power concern' }] } })).toBe('Advice');
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('configured-model:generateContent');
    expect(url).not.toContain('test-only');
    expect(options.headers['x-goog-api-key']).toBe('test-only');
    expect(options.signal).toBeDefined();
    expect(options.body).toContain('Catalog CPU');
    expect(options.body).toContain('Power concern');
  });
  it('returns an unavailable result for provider errors', async () => {
    process.env.GEMINI_API_KEY = 'test-only';
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });
    expect(await generateBuildAdvice({})).toBeNull();
  });
  it('returns an unavailable result for timeout', async () => {
    process.env.GEMINI_API_KEY = 'test-only';
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn().mockRejectedValue(new Error('Timeout'));
    expect(await generateBuildAdvice({})).toBeNull();
  });
});
