# BuildForge classroom payment and security labs

All lab payments use fictional funds and dummy card tokens. They do not charge a bank card or fund a real account. The lab API exists only in the dedicated development HTTPS server and is disabled in production. It listens on this computer's loopback address.

## Start the demonstration

From the project folder:

```bash
npm run build --prefix frontend
npm run demo:tls:setup --prefix backend
npm run demo:https --prefix backend
```

The backend `.env` and local MongoDB must be configured/running. The setup generates a 30-day self-signed localhost certificate and private key in `.local/tls/`, excluded from Git. If renewing an expired certificate, remove only those two local TLS files, then rerun setup. Do not publish the private key.

Open https://localhost:5443/security-demo. The normal checkout is at https://localhost:5443/checkout. Sign in again on the HTTPS origin, add a sample part to the cart, and open checkout. Demo card flow is shown separately on the lab page; the existing store checkout/payment methods remain unchanged.

## Trust the localhost certificate on macOS

Do this yourself before presenting:

1. Open `.local/tls/localhost-cert.pem` in Keychain Access and import it into your **login** keychain.
2. Open the imported `localhost` certificate. Check its fingerprint against `openssl x509 -in .local/tls/localhost-cert.pem -noout -fingerprint -sha256` in your project folder.
3. Expand Trust and set **Secure Sockets Layer (SSL)** to Always Trust for this exact certificate. Confirm with your Mac credentials if prompted. Leave other trust categories unchanged.
4. Restart the browser and open the HTTPS URL. Inspect the certificate/connection information. Do not present a browser certificate warning as a trusted secure connection.
5. After class, remove this specific demo certificate from the login keychain.

This is local classroom TLS, not a publicly trusted website certificate. Public deployment uses the existing Caddy automatic HTTPS configuration after you supply a domain and hosting.

## Lab: SSL/TLS and transaction integrity

- Show HTTPS checkout and inspect its certificate, localhost subject/SAN, and expiry.
- Visit http://localhost:5080/checkout to demonstrate an HTTP 308 redirect to HTTPS. TLS 1.2 is the minimum; TLS 1.3 can negotiate when supported.
- On the lab page, verify the original transaction: its SHA-256 digest matches and its RSA-PSS signature is valid.
- Click **Tamper: add NPR 1**, then verify again: the digest changes and the original signature fails.
- Restore the original: verification passes again. JSON keys are canonically sorted, so whitespace and key order do not alter transaction meaning.
- Only the server holds the RSA private key. The browser uses its public key for verification with Web Crypto. This public key's authenticity relies on the trusted TLS session; independently verifying the signer would require a separately trusted key/certificate.
- Hashing/signing provides integrity/authentication, not encryption or evidence of actual settlement. The dummy gateway and wallet transaction records can also be loaded into this proof panel.

## Lab 5: stored-value wallets and peer-to-peer transfers

- Alice starts with NPR 1,000; Bob starts with NPR 500.
- Transfer NPR 100 from Alice to Bob. Show balances of NPR 900 and NPR 600; total stored value remains NPR 1,500.
- Reverse the direction and transfer back.
- Try transferring more than the sender's balance: the server rejects it without moving funds.
- Amounts are integer paisa; negative, fractional-paisa, self and unknown-account transfers are rejected.
- Request IDs prevent the same transfer from being debited twice. Duplicate IDs with changed details are rejected.
- After a successful transfer, show and verify its signed transaction record.

## Lab 4: dummy payment gateway / credit-card flow

- Select the approved dummy card token ending 4242 and submit an amount.
- Show checkout submission → tokenization simulation → gateway authorization → approved authorization.
- Click **Capture authorized payment** to show capture and simulated merchant settlement. Verify the signed capture record below.
- Select the declining dummy token ending 0002 to demonstrate a decline. Declined payments cannot be captured.
- Repeated capture does not create a second transaction. No real PAN, expiry, or CVV is accepted or stored; tokenization is simulated rather than a PCI-certified gateway integration.

## Limits and validation

Wallet balances, payment states, recent records, request IDs and RSA keys live in this single demo server's memory and reset on restart. These are intentionally isolated classroom simulations, not persistent production financial accounts. Do not expose the demo server through a public tunnel. Real wallets require durable transactional accounting, authenticated account ownership and payment-provider integration.

Validation: unit tests cover value conservation, insufficient balances, invalid transfers, duplicate transfer prevention, authorization/capture/decline rules, repeated capture and signature tampering. HTTPS verification uses the generated certificate as an explicit trust anchor; certificate validation is never disabled.
