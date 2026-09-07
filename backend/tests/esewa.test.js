const esewaService = require('../services/esewaService');
const { buildWhatsAppLink } = require('../services/shippingNotificationService');

// Use eSewa's own published UAT test credentials so this matches the
// service's zero-config defaults (no env vars needed to run these).
const fakeOrder = { orderId: 'BF-20260115-00042', total: 1000 };

describe('esewaService', () => {
  describe('buildPaymentPayload', () => {
    it('signs the amount, transaction_uuid, and product_code fields', () => {
      const { fields, formUrl } = esewaService.buildPaymentPayload(fakeOrder, {
        backendUrl: 'http://localhost:5000',
      });

      expect(fields.transaction_uuid).toBe(fakeOrder.orderId);
      expect(fields.total_amount).toBe('1000.00');
      expect(fields.product_code).toBe('EPAYTEST');
      expect(fields.signature).toEqual(expect.any(String));
      expect(fields.success_url).toBe('http://localhost:5000/api/orders/esewa/success');
      expect(fields.failure_url).toBe('http://localhost:5000/api/orders/esewa/failure');
      expect(formUrl).toContain('esewa.com.np');
    });

    it('produces a signature that verifySignature accepts round-trip', () => {
      const { fields } = esewaService.buildPaymentPayload(fakeOrder, {
        backendUrl: 'http://localhost:5000',
      });

      // Simulate the shape of eSewa's own success callback, which signs
      // total_amount,transaction_uuid,status,transaction_code,product_code
      // (order/subset varies) — here we just prove our own round-trip.
      const callbackPayload = {
        total_amount: fields.total_amount,
        transaction_uuid: fields.transaction_uuid,
        product_code: fields.product_code,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature: fields.signature,
      };

      expect(esewaService.verifySignature(callbackPayload)).toBe(true);
    });
  });

  describe('verifySignature', () => {
    it('rejects a tampered amount', () => {
      const { fields } = esewaService.buildPaymentPayload(fakeOrder, {
        backendUrl: 'http://localhost:5000',
      });

      const tampered = {
        total_amount: '1.00', // customer changed the amount client-side
        transaction_uuid: fields.transaction_uuid,
        product_code: fields.product_code,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature: fields.signature,
      };

      expect(esewaService.verifySignature(tampered)).toBe(false);
    });

    it('rejects a missing signature', () => {
      expect(esewaService.verifySignature({ total_amount: '1000.00' })).toBe(false);
    });

    it('rejects a null/undefined payload', () => {
      expect(esewaService.verifySignature(null)).toBe(false);
    });
  });

  describe('decodeCallbackData', () => {
    it('decodes a base64 JSON payload', () => {
      const raw = { status: 'COMPLETE', transaction_uuid: fakeOrder.orderId };
      const encoded = Buffer.from(JSON.stringify(raw)).toString('base64');
      expect(esewaService.decodeCallbackData(encoded)).toEqual(raw);
    });

    it('returns null for garbage input instead of throwing', () => {
      expect(esewaService.decodeCallbackData('not-valid-base64-json')).toBeNull();
    });
  });
});

describe('shippingNotificationService.buildWhatsAppLink', () => {
  const order = {
    orderId: 'BF-20260115-00042',
    paymentMethod: 'cod',
    paymentStatus: 'COD',
    total: 55000,
    items: [{ name: 'Ryzen 5 7600X', quantity: 1, isCustomBuild: false }],
    shippingAddress: {
      fullName: 'Test Customer',
      phone: '9800000000',
      address: 'Baneshwor',
      city: 'Kathmandu',
      province: 'Bagmati',
    },
  };

  it('returns null when no shipping-partner WhatsApp number is configured', () => {
    delete process.env.SHIPPING_PARTNER_WHATSAPP;
    expect(buildWhatsAppLink(order)).toBeNull();
  });

  it('builds a wa.me link with a URL-encoded order summary when configured', () => {
    process.env.SHIPPING_PARTNER_WHATSAPP = '+977-980-000-1111';
    const link = buildWhatsAppLink(order);
    expect(link).toMatch(/^https:\/\/wa\.me\/9779800001111\?text=/);
    const decoded = decodeURIComponent(link.split('?text=')[1]);
    expect(decoded).toContain(order.orderId);
    expect(decoded).toContain('Ryzen 5 7600X');
    delete process.env.SHIPPING_PARTNER_WHATSAPP;
  });
});
