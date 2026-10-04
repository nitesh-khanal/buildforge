const crypto = require('crypto');
function canonicalize(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function createProof(transaction, privateKey, publicKey) {
  const bytes = Buffer.from(canonicalize(transaction));
  return {
    transaction,
    hash: crypto.createHash('sha256').update(bytes).digest('hex'),
    signature: crypto.sign('sha256', bytes, { key: privateKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }).toString('base64'),
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    algorithm: 'RSA-PSS / SHA-256',
  };
}
module.exports = { canonicalize, createProof };
