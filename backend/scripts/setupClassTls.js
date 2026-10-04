const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dir = path.resolve(__dirname, '../../.local/tls');
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const key = path.join(dir, 'localhost-key.pem');
const cert = path.join(dir, 'localhost-cert.pem');
if (fs.existsSync(key) && fs.existsSync(cert)) {
  console.log('Local certificate already exists.'); process.exit(0);
}
const config = path.join(dir, 'openssl.cnf');
fs.writeFileSync(config, `[req]\nprompt = no\ndistinguished_name = dn\nx509_extensions = ext\n[dn]\nCN = localhost\n[ext]\nsubjectAltName = DNS:localhost,IP:127.0.0.1,IP:::1\nbasicConstraints = critical,CA:FALSE\nkeyUsage = critical,digitalSignature,keyEncipherment\nextendedKeyUsage = serverAuth\n`);
const result = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '30', '-keyout', key, '-out', cert, '-config', config], { stdio: 'inherit' });
if (result.status !== 0) process.exit(1);
fs.chmodSync(key, 0o600);
console.log('Created a 30-day localhost TLS certificate. Trust this exact certificate manually before the demo; see CLASS-DEMO.md.');
