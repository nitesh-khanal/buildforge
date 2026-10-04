const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
if (process.env.NODE_ENV === 'production') throw new Error('Class demo is disabled in production.');
process.env.NODE_ENV = 'development';
process.env.SECURITY_DEMO_ENABLED = 'true';
process.env.CLIENT_URL = 'https://localhost:5443';
process.env.BACKEND_URL = 'https://localhost:5443';
const fs = require('fs');
const https = require('https');
const http = require('http');
const app = require('../app');
const connectDB = require('../config/db');
const tlsDir = path.resolve(__dirname, '../../.local/tls');
const options = {
  key: fs.readFileSync(path.join(tlsDir, 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(tlsDir, 'localhost-cert.pem')),
  minVersion: 'TLSv1.2',
};
connectDB().then(() => {
  const secure = https.createServer(options, app).listen(5443, '127.0.0.1', () => console.log('Class demo: https://localhost:5443/security-demo | Checkout: https://localhost:5443/checkout'));
  const redirect = http.createServer((req, res) => {
    res.writeHead(308, { Location: 'https://localhost:5443' + (req.url.startsWith('/') && !req.url.startsWith('//') ? req.url : '/') }); res.end();
  }).listen(5080, '127.0.0.1');
  const close = async () => { redirect.close(); secure.close(); await require('mongoose').disconnect(); process.exit(0); };
  process.once('SIGINT', close); process.once('SIGTERM', close);
}).catch(err => { console.error(err.message); process.exit(1); });
